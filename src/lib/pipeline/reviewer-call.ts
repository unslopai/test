/**
 * Gemeinsamer Reviewer-Pass für draft-reviewer und second-opinion-reviewer
 * (LLM_LANE_QUALITY_SPEC §4.4): LLM-Call + Telemetrie + JSON-Parse +
 * Manifest-Validierung + Scope-Filter + Rule+File-Aggregation.
 *
 * Bewusst EIN Modul statt zweier Kopien — die Validation-Boundary
 * (ROADMAP §12) und der Aggregations-Contract (§7) dürfen zwischen den
 * beiden Pro-/Flash-Review-Pfaden nie divergieren (MAINT-001).
 */
import { filterIssuesByScope } from '@/lib/pipeline/prompt-builder';
import { runEnvelopeGenerateContent } from '@/lib/pipeline/context-cache';
import { extractTokenUsage, parseModelJson } from '@/lib/pipeline/helpers';
import { aggregateIssuesByRuleAndFile } from '@/lib/pipeline/finding-aggregation';
import { validateIssuesAgainstManifest } from '@/lib/pipeline/issue-validation';
import { normalizeGatekeeperIssue } from '@/lib/pipeline/gatekeeper-rules';
import { downgradeImportExistenceClaim, isImportExistenceClaim } from '@/lib/pipeline/import-existence-claims';
import { clampConfidence } from '@/lib/pipeline/claim-verification';
import { CallBudgetExhaustedError, DEFAULT_RETRY_POLICY, runWithTransientRetry } from '@/lib/pipeline/vertex-retry';
import { hasBudgetForCall } from '@/lib/pipeline/deadline';
import { recordLlmCall } from '@/lib/telemetry/llm-call-log';
import type { LlmCallPhase, LlmCallStatus } from '@/lib/telemetry/llm-call-log';
import type { CacheStatus, FlashPromptEnvelope } from '@/lib/pipeline/context-cache';
import type { PullRequestFile } from '@/lib/github';
import type { PipelineContext, PipelineIssue, IssueSeverity, TokenUsage } from '@/lib/pipeline/types';

// =============================================================================
// LLM Response Types (Reviewer-Prompt-Contract)
// =============================================================================

interface LlmDiffIssue {
    rule: string;
    severity: 'CRITICAL' | 'WARNING';
    path: string;
    line: number;
    end_line: number;
    exact_quote: string;
    critique: string;
    fixed_code_snippet?: string;
    confidence?: number;
}

interface LlmDiffReviewResponse {
    has_slop: boolean;
    issues: LlmDiffIssue[];
    summary: string;
}

// =============================================================================
// Reviewer Pass
// =============================================================================

export interface ReviewerPassOptions {
    readonly reviewerModel: string;
    readonly telemetryPhase: LlmCallPhase;
    readonly promptEnvelope: FlashPromptEnvelope;
    readonly userPrompt: string;
    /** Manifest für die line/endLine-Validierung — beim Second-Opinion das Datei-Subset. */
    readonly reviewableFiles: readonly PullRequestFile[];
    readonly renderedLawRuleIds: readonly string[];
    /** PipelineIssue.source des erzeugenden Steps. */
    readonly issueSource: string;
    /** true = self-reported Confidence übernehmen (Pro-Pfade, D3). */
    readonly adoptSelfReportedConfidence: boolean;
}

export interface ReviewerPassResult {
    readonly aggregatedIssues: readonly PipelineIssue[];
    readonly summary: string;
    readonly hasSlop: boolean;
    readonly callUsage: TokenUsage;
    readonly effectiveCacheStatus: CacheStatus;
    readonly rejectedCount: number;
    readonly scopeFilteredCount: number;
    /** Issue-Zahl NACH Validierung/Scope, VOR der Rule+File-Aggregation. */
    readonly preAggregationIssueCount: number;
}

export async function runReviewerPass(
    context: PipelineContext,
    options: ReviewerPassOptions,
): Promise<ReviewerPassResult> {
    const { llmOutput, callUsage, effectiveCacheStatus } = await runReviewerCall(context, options);

    const pipelineIssues = convertToPipelineIssues(llmOutput.issues, options);
    // Validation-Boundary (ROADMAP §12): rule gegen die Enum der tatsächlich
    // gepromoteten Regeln (aktive Conditions + gerenderte Law-IDs),
    // line/endLine gegen die echten Diff-Hunks — alles server-kontrolliert.
    const { acceptedIssues, rejectedCount } = validateIssuesAgainstManifest(
        pipelineIssues, options.reviewableFiles, options.renderedLawRuleIds,
        context.promptConfig.activeConditionIds,
    );
    // GATE-001 (SPEC.md §12.4 A12c): immer CRITICAL, fester Kundentext.
    // HAL-002 auf einer Import-Zeile endet als WARNING (LANGUAGE_COVERAGE_SPEC §6.5).
    const normalizedIssues = acceptedIssues.map(normalizeGatekeeperIssue).map(downgradeImportExistenceClaim);
    const scopedIssues = filterIssuesByScope(normalizedIssues, context.promptConfig);
    // Aggregation VOR der Claim-Verifikation (ROADMAP §7): N Vorkommen
    // derselben Regel in derselben Datei werden EIN Finding mit
    // occurrences-Liste — also ein Claim, ein Verdict, ein Kommentar.
    // Import-Claims bündeln getrennt: sonst zöge ein HAL-002 auf einem Aufruf
    // derselben Datei den abgestuften Import-Claim wieder auf CRITICAL.
    const aggregatedIssues = [
        ...aggregateIssuesByRuleAndFile(scopedIssues.filter((scopedIssue) => !isImportExistenceClaim(scopedIssue))),
        ...aggregateIssuesByRuleAndFile(scopedIssues.filter(isImportExistenceClaim)),
    ];

    return {
        aggregatedIssues,
        summary: llmOutput.summary,
        hasSlop: llmOutput.has_slop,
        callUsage,
        effectiveCacheStatus,
        rejectedCount,
        scopeFilteredCount: acceptedIssues.length - scopedIssues.length,
        preAggregationIssueCount: scopedIssues.length,
    };
}

// =============================================================================
// LLM Call (Telemetrie-Zeile wird IMMER geschrieben, auch im Fehlerfall)
// =============================================================================

/**
 * Retryfähiger Fehlertyp: Parse-/Shape-Fehler entstehen aus der
 * nicht-deterministischen 3.x-JSON-Degeneration (M1-Gate-Lauf 2026-08-26:
 * r02 starb daran, jede Wiederholung war clean) — ein identischer zweiter
 * Call heilt sie fast immer. Transiente API-Fehler (429/5xx) haben ihren
 * eigenen Backoff-Retry (vertex-retry.ts); alle übrigen API-Fehler
 * propagieren sofort in die bestehende Step-Semantik.
 */
class ReviewerParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ReviewerParseError';
    }
}

async function runReviewerCall(
    context: PipelineContext,
    options: ReviewerPassOptions,
): Promise<{ llmOutput: LlmDiffReviewResponse; callUsage: TokenUsage; effectiveCacheStatus: CacheStatus }> {
    // Zwei orthogonale Retry-Achsen: Kapazität (Backoff, innen) und
    // Degeneration (ein Sofort-Retry, außen) — ein 429 verbraucht nie den
    // Parse-Retry und umgekehrt. Beide starten nur, wenn das Job-Budget den
    // vollen Call noch deckt (DEADLINE_GUARD_SPEC §3.2).
    const callLabel = `ReviewerPass/${options.telemetryPhase}/${options.reviewerModel}`;
    const runAttemptWithBackoff = () => runWithTransientRetry(
        () => runReviewerAttempt(context, options),
        callLabel,
        DEFAULT_RETRY_POLICY,
        (delayMs) => hasBudgetForCall(context, options.telemetryPhase, delayMs),
    );
    try {
        return await runAttemptWithBackoff();
    } catch (firstAttemptError: unknown) {
        if (!(firstAttemptError instanceof ReviewerParseError)) throw firstAttemptError;
        if (!hasBudgetForCall(context, options.telemetryPhase)) {
            throw new CallBudgetExhaustedError(callLabel, { cause: firstAttemptError });
        }
        console.warn(
            `[ReviewerPass] Degenerierte Modell-Antwort (${options.telemetryPhase}) — ` +
            `einmaliger Retry: ${firstAttemptError.message}`,
        );
        return runAttemptWithBackoff();
    }
}

async function runReviewerAttempt(
    context: PipelineContext,
    options: ReviewerPassOptions,
): Promise<{ llmOutput: LlmDiffReviewResponse; callUsage: TokenUsage; effectiveCacheStatus: CacheStatus }> {
    const callStartedAt = Date.now();

    const writeTelemetry = (callStatus: LlmCallStatus, cacheStatus: CacheStatus, callUsage?: TokenUsage) =>
        recordLlmCall({
            jobId: context.jobId,
            repoId: context.repositoryId,
            phase: options.telemetryPhase,
            model: options.reviewerModel,
            status: callStatus,
            tokenUsage: callUsage,
            latencyMs: Date.now() - callStartedAt,
            cacheStatus,
        });

    let reviewerResponse;
    let effectiveCacheStatus: CacheStatus;
    try {
        const envelopeResult = await runEnvelopeGenerateContent(options.promptEnvelope, options.userPrompt);
        reviewerResponse = envelopeResult.generateResponse;
        effectiveCacheStatus = envelopeResult.effectiveCacheStatus;
    } catch (reviewerCallError: unknown) {
        await writeTelemetry('api_error', options.promptEnvelope.plan.cacheStatus);
        throw reviewerCallError;
    }

    const callUsage = extractTokenUsage(reviewerResponse.usageMetadata, options.reviewerModel);

    try {
        const llmOutput = parseModelJson<LlmDiffReviewResponse>(
            reviewerResponse.text ?? '', 'ReviewerPass',
        );
        assertReviewResponseShape(llmOutput);
        await writeTelemetry('ok', effectiveCacheStatus, callUsage);
        return { llmOutput, callUsage, effectiveCacheStatus };
    } catch (reviewerParseError: unknown) {
        // Jeder Versuch schreibt seine eigene Telemetrie-Zeile — ein geheilter
        // Retry bleibt als parse_error+ok-Paar sichtbar (Frequenz-Monitoring).
        await writeTelemetry('parse_error', effectiveCacheStatus, callUsage);
        throw new ReviewerParseError(
            reviewerParseError instanceof Error ? reviewerParseError.message : String(reviewerParseError),
        );
    }
}

/**
 * Validation-Boundary hinter parseModelJson [ARCH-002]: der generische Cast
 * prüft keine Struktur. Die 3.x-Flash-Modelle liefern selten syntaktisch
 * valides JSON OHNE issues-Array (Degenerations-Bug, beobachtet 2026-08-26
 * auf gemini-3.6-flash @ r17) — ohne diesen Guard stirbt der Step später an
 * einem nichtssagenden `undefined.map` statt als sauberer parse_error.
 */
function assertReviewResponseShape(llmOutput: LlmDiffReviewResponse): void {
    if (!Array.isArray(llmOutput.issues)) {
        throw new Error('ReviewerPass: Modell-JSON ohne issues-Array (degenerierte Antwort).');
    }
}

// =============================================================================
// Issue Conversion
// =============================================================================

/**
 * Validation-Boundary für die self-reported Severity [ARCH-002]: das LLM-JSON
 * ist untrusted, ein blindes `as IssueSeverity` würde z.B. "HIGH"/"info" oder
 * eine Injektion durchreichen. Nur exakt 'CRITICAL' bleibt CRITICAL; alles
 * andere degradiert konservativ auf 'WARNING' statt zu eskalieren.
 */
function normalizeSeverity(rawSeverity: unknown): IssueSeverity {
    return rawSeverity === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
}

/**
 * Konvertiert LLM-Issues in PipelineIssues. Die self-reported Confidence wird
 * NUR auf den Pro-Pfaden übernommen (D3) — auf der flash-cascade liefert
 * der blinde Verifier die maßgebliche Confidence. Ein fehlendes `end_line`
 * degradiert auf die Startzeile statt das Finding später an der
 * Manifest-Validierung sterben zu lassen (kosmetische Auslassung ≠ Verlust).
 */
function convertToPipelineIssues(
    llmIssues: readonly LlmDiffIssue[],
    options: ReviewerPassOptions,
): PipelineIssue[] {
    return llmIssues.map((llmIssue) => ({
        rule: llmIssue.rule,
        severity: normalizeSeverity(llmIssue.severity),
        path: llmIssue.path,
        line: llmIssue.line,
        endLine: llmIssue.end_line ?? llmIssue.line,
        exactQuote: llmIssue.exact_quote,
        critique: llmIssue.critique,
        fixedCodeSnippet: llmIssue.fixed_code_snippet,
        source: options.issueSource,
        ...(options.adoptSelfReportedConfidence
            ? { confidence: clampConfidence(llmIssue.confidence) }
            : {}),
    }));
}
