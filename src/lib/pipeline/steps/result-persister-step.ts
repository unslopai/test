/**
 * ResultPersisterStep — Persistiert das Pipeline-Ergebnis in review_jobs.
 *
 * Terminaler Pflicht-Step (wird vom Worker immer angehängt, nicht toggelbar).
 * Läuft auch im Abort-Fall, damit kein Job in 'processing' hängen bleibt.
 * Schreibt zusätzlich die Token-Telemetrie des Reviewer-Calls (Unit Economics)
 * und — als EINZIGER Step (MCP_SPEC.md §4.5) — die Re-roll-Buchführung
 * (unresolved_fingerprint + reroll_count).
 */
import { createHash } from 'node:crypto';
import { supabase } from '@/lib/supabase';
import { extractErrorMessage } from '@/lib/errors';
import { collectReportableIssues } from '@/lib/pipeline/helpers';
import type { PipelineContext, PipelineIssue, PipelineStep } from '@/lib/pipeline/types';

/**
 * Der Job war beim terminalen Write nicht mehr 'processing' — Watchdog
 * oder Reaper haben ihn bereits auf 'error' gesetzt und seinen Check rot
 * geschlossen. Der Worker darf dann weder 'done' melden noch den Check
 * überschreiben (DEADLINE_GUARD_SPEC D9).
 */
export class JobAlreadyFinalizedError extends Error {
    constructor(jobId: string) {
        super(`Job ${jobId} war nicht mehr 'processing' — Ergebnis nicht persistiert.`);
        this.name = 'JobAlreadyFinalizedError';
    }
}

export const resultPersisterStep: PipelineStep = {
    id: 'result-persister',
    displayName: 'Result Persister',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        // Merge-Punkt (pre_scanner_design.md §5.1): persistiert wird die
        // vereinigte Issue-Liste aus Prescan- und LLM-Lane — ab hier mit
        // stabilen Finding-IDs (MCP_SPEC.md §4.2).
        const reportableIssues = collectReportableIssues(context);
        const reviewResult = context.shouldAbort
            ? {
                has_slop: false,
                issues: [],
                summary: context.abortReason ?? 'Pipeline aborted.',
            }
            : {
                has_slop: reportableIssues.length > 0,
                issues: reportableIssues,
                summary: context.reviewSummary || 'No AI slop found.',
            };

        const rerollBookkeeping = await resolveRerollBookkeeping(context, reviewResult.issues);

        const { data: persistedRows, error: persistError } = await supabase
            .from('review_jobs')
            .update({
                status: 'done',
                result: {
                    review: reviewResult,
                    files_reviewed: context.reviewableFiles.length,
                    // Ehrlichkeits-Marker (ROADMAP §3): ein Abort-Lauf hat NICHTS
                    // geprüft — Clients dürfen has_slop:false dann nie als
                    // Clean-Urteil rendern. omitted_files nennt die Size-Cap-Opfer.
                    nothing_reviewed: context.shouldAbort,
                    omitted_files: context.omittedFiles,
                    // Für CLI-/Dashboard-Rendering ohne zweiten Query (SPEC.md §6):
                    cognitive_integrity_score: context.cascade.integrityScore,
                    // Ehrlichkeits-Record des Prescan-Laufs (§6.4) — ein
                    // degradierter Lauf ist nie von "0 Findings, clean"
                    // ununterscheidbar. null = Step nicht gelaufen/disabled.
                    prescan: context.prescanStats,
                    // DEADLINE_GUARD_SPEC D6: Degradationen waren bis 2026-09-26 nur
                    // ein generischer Satz im GitHub-Review — in der DB unsichtbar.
                    degradations: context.cascade.degradations,
                    skipped_stages: context.cascade.skippedStages,
                    // LARGE_DIFF_RECALL_SPEC Option A: Dateien gescheiterter
                    // Draft-Batches (`draft_partial`) — Clients nennen sie.
                    draft_unreviewed_files: context.cascade.draftUnreviewedFiles,
                },
                unresolved_fingerprint: rerollBookkeeping.unresolvedFingerprint,
                reroll_count: rerollBookkeeping.rerollCount,
                prompt_tokens: context.tokenUsage?.promptTokens ?? null,
                cached_tokens: context.tokenUsage?.cachedTokens ?? null,
                output_tokens: context.tokenUsage?.outputTokens ?? null,
                model: context.tokenUsage?.model ?? null,
                integrity_score: context.cascade.integrityScore,
                escalated: context.cascade.escalated,
                escalation_reason: context.cascade.escalationReason,
                cascade_route: context.cascade.route,
                updated_at: new Date().toISOString(),
            })
            .eq('id', context.jobId)
            // Nur aus 'processing' heraus (DEADLINE_GUARD_SPEC D9): hat ein
            // Watchdog-Timeout oder der Reaper den Job schon auf 'error'
            // gesetzt, darf dieses Ergebnis ihn nicht wieder auf 'done' drehen.
            .eq('status', 'processing')
            .select('id');

        if (persistError) {
            console.error('[ResultPersister] Fehler beim Persistieren des Job-Ergebnisses:', persistError);
            throw new Error(`Job-Ergebnis konnte nicht gespeichert werden: ${persistError.message}`);
        }

        if (!persistedRows || persistedRows.length === 0) {
            throw new JobAlreadyFinalizedError(context.jobId);
        }

        console.log(`[ResultPersister] Job ${context.jobId} persistiert (${reviewResult.issues.length} Issues).`);
        return context;
    },
};

// =============================================================================
// Re-roll-Buchführung (MCP_SPEC.md §4.5)
// =============================================================================

interface RerollBookkeeping {
    readonly unresolvedFingerprint: string | null;
    readonly rerollCount: number;
}

const NO_REROLL: RerollBookkeeping = { unresolvedFingerprint: null, rerollCount: 0 };

/**
 * Fingerprint = sha256 über die SORTIERTEN Finding-IDs. Gemessen wird damit
 * Nicht-Fortschritt direkt (nicht der Diff — den ändert jede Ein-Zeichen-
 * Edit). Gleicher Fingerprint wie der jüngste abgeschlossene Job desselben
 * Repos ⇒ Count + 1, sonst Reset auf 0. Ein sauberer Lauf (0 Findings) ist
 * Fortschritt und resettet immer.
 *
 * Fail-soft: die Notice ist advisory — ein fehlgeschlagener Lookup degradiert
 * auf Count 0 und wird geloggt, er darf nie den Terminal-Write verhindern.
 */
async function resolveRerollBookkeeping(
    context: PipelineContext,
    persistedIssues: readonly PipelineIssue[],
): Promise<RerollBookkeeping> {
    if (context.shouldAbort || !context.repositoryId || persistedIssues.length === 0) {
        return NO_REROLL;
    }

    const sortedFindingIds = persistedIssues
        .map((issue) => issue.id)
        .filter((findingId): findingId is string => typeof findingId === 'string')
        .sort();
    const unresolvedFingerprint = createHash('sha256')
        .update(sortedFindingIds.join('\0'))
        .digest('hex');

    try {
        const { data: previousJobRow, error: lookupError } = await supabase
            .from('review_jobs')
            .select('unresolved_fingerprint, reroll_count')
            .eq('repository_id', context.repositoryId)
            .eq('status', 'done')
            .neq('id', context.jobId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lookupError) {
            throw new Error(lookupError.message);
        }

        const rerollCount = previousJobRow?.unresolved_fingerprint === unresolvedFingerprint
            ? (previousJobRow.reroll_count ?? 0) + 1
            : 0;
        return { unresolvedFingerprint, rerollCount };
    } catch (rerollLookupError: unknown) {
        console.error(
            `[ResultPersister] Job ${context.jobId}: Re-roll-Lookup fehlgeschlagen `
            + `(fail-soft, Count 0): ${extractErrorMessage(rerollLookupError)}`,
        );
        return { unresolvedFingerprint, rerollCount: 0 };
    }
}
