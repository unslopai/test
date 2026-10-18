/**
 * GET /api/cli/scan/[jobId] — Polling-Endpoint für CLI-/MCP-Scans
 * (SPEC.md §3.4, MCP_SPEC.md §4.1/§4.5).
 *
 * Auth: x-api-key; der Job muss zu einem Repository des Key-Owners gehören.
 * Meldet 'processing'-Jobs älter als 5 Minuten als 'error' (job_stalled),
 * damit der Client nicht endlos pollt, wenn die Serverless-Invocation starb.
 * Solange die LLM-Kaskade läuft, serviert der Endpoint das Prescan-
 * Teilergebnis als phase 'deterministic' (Early Partial Results, D4).
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { resolveApiKey } from '@/lib/api-keys';
import { isAiGeneratedRun } from '@/lib/ai-disclosure';
import { classifyJobFailure } from '@/lib/job-failure';
import { scheduleLazyReap } from '@/lib/lazy-reaper';
import { normalizeBareRuleId } from '@/lib/pipeline/helpers';
import type {
    DraftFailureReason, RerollNotice, ScanOutcome, ScanPhase, ScanPrescanStatus, ScanRepoContext, SkippedStage,
} from '@unslop/shared';

const STALLED_JOB_THRESHOLD_MS = 5 * 60 * 1000;

const DEFAULT_REROLL_LIMIT = 3;
const MAX_REROLL_LIMIT = 50;

interface RouteParams {
    params: Promise<{ jobId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
    const apiKey = await resolveApiKey(request);
    if (!apiKey) {
        return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 });
    }

    // Lazy Reaping (DEADLINE_GUARD_SPEC D10) — nur für authentifizierte
    // Aufrufer, gedrosselt auf einen Lauf pro Minute und Instanz.
    scheduleLazyReap('cli-poll');

    const { jobId } = await params;

    const { data: jobRow, error: jobError } = await supabase
        .from('review_jobs')
        .select('id, status, result, partial_result, reroll_count, reroll_limit:payload->reroll_limit, repository_id, updated_at, error_message')
        .eq('id', jobId)
        .in('source', ['cli', 'mcp'])
        .single();

    if (jobError || !jobRow || !jobRow.repository_id) {
        return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
    }

    // Ownership: das Repository des Jobs muss dem Key-Owner gehören.
    const { data: repoRow, error: repoError } = await supabase
        .from('repositories')
        .select('id')
        .eq('id', jobRow.repository_id)
        .eq('user_id', apiKey.userId)
        .single();

    if (repoError || !repoRow) {
        return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
    }

    const preTerminalPhase: ScanPhase = jobRow.partial_result ? 'deterministic' : 'submitted';

    if (jobRow.status === 'processing' && isStalled(jobRow.updated_at)) {
        return NextResponse.json({ status: 'error', phase: preTerminalPhase, error: 'job_stalled' });
    }

    if (jobRow.status === 'error') {
        // Stable, non-attacker-controlled code — NIE das rohe error_message
        // (ROADMAP §15). error_message kann eine 500-Zeichen-Vorschau der
        // Modellantwort tragen (helpers.ts parseModelJson), deren Inhalt der
        // Diff-Autor mitbestimmt. Der Detailtext bleibt server-seitig (DB + Log);
        // gelesen wird nur der server-gesetzte Code-Präfix (job-failure.ts).
        return NextResponse.json({
            status: 'error',
            phase: preTerminalPhase,
            error: classifyJobFailure(jobRow.error_message),
        });
    }

    // Early Partial (MCP_SPEC.md §4.1): Prescan fertig, LLM-Kaskade läuft noch.
    if (jobRow.status === 'processing' && jobRow.partial_result) {
        return NextResponse.json({
            status: 'processing',
            phase: 'deterministic',
            partialResult: toScanResult(jobRow.partial_result, { terminal: false }),
        });
    }

    if (jobRow.status !== 'done') {
        return NextResponse.json({ status: jobRow.status, phase: 'submitted' });
    }

    const rerollNotice = buildRerollNotice(jobRow.reroll_count, jobRow.reroll_limit, jobRow.result);
    return NextResponse.json({
        status: 'done',
        phase: 'complete',
        result: toScanResult(jobRow.result, { terminal: true }),
        ...(rerollNotice ? { rerollNotice } : {}),
    });
}

// =============================================================================
// Helpers
// =============================================================================

function isStalled(updatedAt: string | null): boolean {
    if (!updatedAt) return false;
    return Date.now() - new Date(updatedAt).getTime() > STALLED_JOB_THRESHOLD_MS;
}

/** Strukturelle Sicht auf persistierte result-/partial_result-Blobs (ARCH-002). */
interface PersistedResultBlob {
    review?: { has_slop?: boolean; issues?: { rule?: string }[]; summary?: string };
    files_reviewed?: number;
    nothing_reviewed?: boolean;
    deterministic_only?: boolean;
    prescan?: { filesScanned?: unknown; llmSkipped?: unknown; degraded?: unknown; unscannedFiles?: unknown } | null;
    omitted_files?: unknown;
    cognitive_integrity_score?: number | null;
    degradations?: unknown;
    skipped_stages?: unknown;
    draft_unreviewed_files?: unknown;
    draft_failure_reason?: unknown;
    repo_context?: { status?: unknown; paths?: unknown; estimated_tokens?: unknown; omissions?: unknown } | null;
}

/**
 * Mappt das persistierte review_jobs.result auf den Shared ScanResult-Contract.
 *
 * outcome (ROADMAP §3): 'nothing_reviewed' kommt primär vom persistierten
 * Marker; für terminale Alt-Blobs ohne Marker greift files_reviewed === 0 als
 * Fallback — ein terminales Ergebnis mit 0 geprüften Dateien darf sich nie
 * als geprüfter Clean-Scan ausgeben. Partials (terminal=false) sind kein
 * Urteil und bleiben 'reviewed'; ihre Phase 'deterministic' trägt den Status.
 * 'deterministic_only' (LANGUAGE_COVERAGE_SPEC §6.2) kommt nur vom Marker: dort
 * sind 0 geprüfte Dateien der Normalfall, der Pre-Scanner lief trotzdem.
 */
function toScanResult(persistedResult: unknown, options: { terminal: boolean }): Record<string, unknown> {
    const resultBlob = (persistedResult ?? {}) as PersistedResultBlob;

    const filesReviewed = resultBlob.files_reviewed ?? 0;
    const filesScanned = resultBlob.prescan?.filesScanned;
    const reviewOutcome = resolvePersistedOutcome(resultBlob, options.terminal);

    return {
        hasSlop: resultBlob.review?.has_slop ?? false,
        issues: resultBlob.review?.issues ?? [],
        summary: resultBlob.review?.summary ?? '',
        filesReviewed,
        ...(typeof filesScanned === 'number' ? { filesScanned } : {}),
        outcome: reviewOutcome,
        // KI-Kennzeichnung (LEGAL_PAGES_SPEC §4a.3): ein Partial trägt nur
        // Pre-Scan-Findings, auch wenn sein Outcome vorläufig 'reviewed' heißt;
        // beim Short-Circuit des Pre-Scanners lief ebenfalls kein Modell.
        aiGenerated: options.terminal
            && isAiGeneratedRun(reviewOutcome, resultBlob.prescan?.llmSkipped === true),
        omittedFiles: parseStringList(resultBlob.omitted_files),
        cognitiveIntegrityScore: resultBlob.cognitive_integrity_score ?? null,
        degradations: parseStringList(resultBlob.degradations),
        skippedStages: parseSkippedStages(resultBlob.skipped_stages),
        draftUnreviewedFiles: parseStringList(resultBlob.draft_unreviewed_files),
        ...parseDraftFailureReason(resultBlob.draft_failure_reason),
        ...parsePrescanStatus(resultBlob.prescan),
        ...parseRepoContext(resultBlob.repo_context),
    };
}

const REPO_CONTEXT_STATUS_VALUES: ReadonlySet<string> = new Set<ScanRepoContext['status']>([
    'loaded', 'unavailable', 'disabled', 'not_provided',
]);

function isRepoContextStatus(rawStatus: unknown): rawStatus is ScanRepoContext['status'] {
    return typeof rawStatus === 'string' && REPO_CONTEXT_STATUS_VALUES.has(rawStatus);
}

/**
 * Additiv (REPO_CONTEXT_SPEC §9.2): Pfade und Größe des Kontextpakets, nie
 * Inhalt. Fehlt bei Ergebnissen vor Stufe 1 und bei Partials.
 */
function parseRepoContext(persistedContext: PersistedResultBlob['repo_context']): { repoContext?: ScanRepoContext } {
    if (!persistedContext || !isRepoContextStatus(persistedContext.status)) return {};
    const omittedPaths = Array.isArray(persistedContext.omissions)
        ? persistedContext.omissions.flatMap((rawOmission: unknown) =>
            // `not_selected` (ältere Migrationen jenseits des Schema-Deckels) ist die Regel, keine Kürzung.
            (rawOmission && typeof rawOmission === 'object' && 'path' in rawOmission && typeof rawOmission.path === 'string'
                && !('reason' in rawOmission && rawOmission.reason === 'not_selected')
                ? [rawOmission.path]
                : []))
        : [];
    return {
        repoContext: {
            status: persistedContext.status,
            paths: parseStringList(persistedContext.paths),
            estimatedTokens: typeof persistedContext.estimated_tokens === 'number' ? persistedContext.estimated_tokens : 0,
            omittedPaths,
        },
    };
}

/**
 * Additiv (ROADMAP §1): ein ausgefallener Pre-Scan neben einer Modell-Review,
 * ganz oder für einzelne Datei-Batches. Die Pfade stammen aus dem Diff; die
 * Clients formen daraus denselben Satz wie der PR-Review.
 */
function parsePrescanStatus(persistedPrescan: PersistedResultBlob['prescan']): { prescan?: ScanPrescanStatus } {
    if (!persistedPrescan || typeof persistedPrescan.degraded !== 'boolean') return {};
    const unscannedFiles = parseStringList(persistedPrescan.unscannedFiles);
    return {
        prescan: {
            degraded: persistedPrescan.degraded,
            ...(unscannedFiles.length > 0 ? { unscannedFiles } : {}),
        },
    };
}

function resolvePersistedOutcome(resultBlob: PersistedResultBlob, terminal: boolean): ScanOutcome {
    if (resultBlob.deterministic_only === true) return 'deterministic_only';
    const nothingReviewed = resultBlob.nothing_reviewed === true
        || (terminal && (resultBlob.files_reviewed ?? 0) === 0);
    return nothingReviewed ? 'nothing_reviewed' : 'reviewed';
}

/** Strukturelle Validierung eines persistierten String-Arrays (ARCH-002); alles andere wird []. */
function parseStringList(rawStringList: unknown): readonly string[] {
    const isStringArray = Array.isArray(rawStringList)
        && rawStringList.every((listEntry: unknown) => typeof listEntry === 'string');
    return isStringArray ? rawStringList as string[] : [];
}

const SKIPPED_STAGE_VALUES: ReadonlySet<string> = new Set<SkippedStage>(['second_opinion', 'escalation', 'verifier']);

function isSkippedStage(stageName: string): stageName is SkippedStage {
    return SKIPPED_STAGE_VALUES.has(stageName);
}

/** Nur bekannte Stufen erreichen den Client — ein fremder Wert im Blob wird verworfen. */
function parseSkippedStages(rawSkippedStages: unknown): readonly SkippedStage[] {
    return parseStringList(rawSkippedStages).filter(isSkippedStage);
}

const DRAFT_FAILURE_REASON_VALUES: ReadonlySet<string> = new Set<DraftFailureReason>(['content_filter', 'empty_answer']);

function isDraftFailureReason(rawFailureReason: unknown): rawFailureReason is DraftFailureReason {
    return typeof rawFailureReason === 'string' && DRAFT_FAILURE_REASON_VALUES.has(rawFailureReason);
}

/** Additiv: nur ein bekannter Grund erreicht den Client, sonst fehlt das Feld. */
function parseDraftFailureReason(rawFailureReason: unknown): { draftFailureReason?: DraftFailureReason } {
    return isDraftFailureReason(rawFailureReason) ? { draftFailureReason: rawFailureReason } : {};
}

/**
 * Re-roll-Notice (MCP_SPEC.md §4.5): deterministisches Template, kein LLM-Call.
 * Additiv — die Findings werden immer vollständig geliefert. Die Schwelle
 * kommt vom Client (payload.rerollLimit), geclamped auf [0, 50]; 0 deaktiviert.
 */
function buildRerollNotice(
    rerollCount: number | null,
    clientRerollLimit: unknown,
    persistedResult: unknown,
): RerollNotice | null {
    const rerollLimit = clampRerollLimit(clientRerollLimit);
    if (rerollLimit === 0 || rerollCount === null || rerollCount < rerollLimit) {
        return null;
    }

    const resultBlob = (persistedResult ?? {}) as PersistedResultBlob;
    const persistentRules = [...new Set(
        (resultBlob.review?.issues ?? [])
            .map((issue) => (typeof issue.rule === 'string' ? normalizeBareRuleId(issue.rule) : null))
            .filter((bareRuleId): bareRuleId is string => bareRuleId !== null),
    )];

    const attempts = rerollCount + 1;
    return {
        attempts,
        persistentRules,
        message: `You have scanned this code ${attempts} times and ${persistentRules.join(', ')} `
            + 'are still open. Re-running the scan will not change this. The approach is wrong, '
            + 'not the syntax — reconsider the design rather than adjusting the code and '
            + 're-scanning. To change or disable this notice, set rerollLimit in '
            + '~/.config/unslop/config.json (0 disables it).',
    };
}

function clampRerollLimit(clientRerollLimit: unknown): number {
    if (typeof clientRerollLimit !== 'number' || !Number.isInteger(clientRerollLimit)) {
        return DEFAULT_REROLL_LIMIT;
    }
    return Math.min(Math.max(clientRerollLimit, 0), MAX_REROLL_LIMIT);
}
