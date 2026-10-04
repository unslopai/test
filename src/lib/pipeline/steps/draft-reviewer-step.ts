/**
 * DraftReviewerStep — Erster LLM-Review der Cascade (SPEC.md §4.2).
 *
 * flash-cascade: identisches Verhalten zum früheren ai-reviewer auf dem
 * Draft-Modell; die produzierten Issues sind die CLAIMS für den Verifier.
 * pro-direct: derselbe Review auf dem Eskalations-Modell; Pro liefert die
 * Verbalized Confidence pro Issue direkt mit (kein Verifier-Durchlauf).
 *
 * Datei-Batch-Chunking (LARGE_DIFF_RECALL_SPEC Option A, 2026-09-29): liegt
 * der Diff auf der flash-cascade über `cascadeConfig.draftBatchMaxTokens`,
 * werden die reviewableFiles in Diff-Reihenfolge greedy zu Batches gepackt
 * und ein Reviewer-Pass pro Batch PARALLEL gefahren — gleicher Envelope,
 * gleicher Explicit Cache, <already_flagged> auf die Batch-Dateien gefiltert,
 * Issues vereinigt. Darunter bleibt der Request byte-identisch zum Einzel-
 * Call (Test-Beweis in draft-reviewer-step.test.ts). Ein gescheiterter Batch
 * degradiert zu `draft_partial` (übrige Batches zählen, Score null, Dateien
 * werden genannt); scheitern alle, gilt das Verhalten des Einzel-Drafts.
 *
 * Der Call-/Parse-/Validierungs-Kern lebt in reviewer-call.ts und wird mit
 * dem second-opinion-reviewer geteilt (LLM_LANE_QUALITY_SPEC §4.4).
 *
 * Ein Fehlschlag hier ist FATAL (kein Draft = kein Review möglich) und läuft
 * bewusst in den markJobError-Pfad — die Telemetrie-Zeile wird davor geschrieben.
 * Reißt der Draft das Job-Budget, wird daraus ein ReviewTimeoutError
 * (Client-Code `review_timeout`, DEADLINE_GUARD_SPEC D5) statt eines Jobs,
 * der am Plattform-Kill für immer `processing` bleibt.
 */
import { fetchRenderedLawBlock } from '@/lib/law';
import { MODEL_DRAFT, MODEL_ESCALATION } from '@/lib/pipeline/models';
import { buildAlreadyFlaggedSection } from '@/lib/pipeline/prompt-builder';
import { resolvePromptEnvelope } from '@/lib/pipeline/context-cache';
import { addTokenUsage } from '@/lib/pipeline/helpers';
import { runReviewerPass } from '@/lib/pipeline/reviewer-call';
import { isCallDeadlineFailure } from '@/lib/pipeline/vertex-retry';
import { DRAFT_FALLBACK_MIN_MS, ReviewTimeoutError, remainingLlmMs } from '@/lib/pipeline/deadline';
import {
    estimateDiffTokens,
    resolveDraftBatches,
    selectPrescanIssuesForBatch,
} from '@/lib/pipeline/draft-batching';
import type { DraftBatch } from '@/lib/pipeline/draft-batching';
import type { ReviewerPassOptions, ReviewerPassResult } from '@/lib/pipeline/reviewer-call';
import type {
    CascadeDegradation,
    PipelineContext,
    PipelineIssue,
    PipelineStep,
    TokenUsage,
} from '@/lib/pipeline/types';
import type { PromptVariant } from '@/lib/pipeline/prompt-builder';

/** PipelineIssue.source der Draft-Claims — der integrity-scorer filtert danach. */
const DRAFT_ISSUE_SOURCE = 'draft-reviewer';

/** Summary eines Drafts ohne Findings (Output-Format-Contract, prompt-builder.ts). */
const CLEAN_DRAFT_SUMMARY = 'No AI slop found.';

// =============================================================================
// Step Implementation
// =============================================================================

export const draftReviewerStep: PipelineStep = {
    id: 'draft-reviewer',
    displayName: 'Draft Reviewer',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) return context;
        // Short-Circuit (pre_scanner_design.md §5.3): deterministische CRITICALs
        // haben den Review bereits entschieden — kein Draft-Call.
        if (context.llmSkipped) return context;
        // Der Draft wird nie übersprungen, solange Zeit übrig ist (D4) — ohne
        // Rest gibt es nichts Ehrliches zu tun außer dem Timeout.
        const remainingAtStartMs = remainingLlmMs(context);
        if (remainingAtStartMs <= 0) {
            throw new ReviewTimeoutError(`kein LLM-Budget mehr vor dem Draft (${remainingAtStartMs} ms)`);
        }

        return context.cascade.route === 'pro-direct'
            ? runProDirectDraft(context)
            : runDraftWithinBudget(context, MODEL_DRAFT);
    },
};

async function runProDirectDraft(context: PipelineContext): Promise<PipelineContext> {
    try {
        return await runDraftOnModel(context, MODEL_ESCALATION);
    } catch (proDraftError: unknown) {
        // Ein zweiter (Flash-)Draft braucht Ø 27–46 s; mit weniger als
        // DRAFT_FALLBACK_MIN_MS Rest würde er nur ebenfalls abbrechen (D5).
        const remainingAfterProMs = remainingLlmMs(context);
        if (remainingAfterProMs < DRAFT_FALLBACK_MIN_MS) {
            // Nur ein Zeit-Abbruch ist ein Timeout; ein Kapazitäts- oder
            // API-Fehler behält seinen ehrlichen Code (model_unavailable/server_error).
            if (!isCallDeadlineFailure(proDraftError)) throw proDraftError;
            throw new ReviewTimeoutError(
                `Pro-direct-Draft gescheitert, nur ${remainingAfterProMs} ms Rest — kein Flash-Fallback`,
                { cause: proDraftError },
            );
        }
        // Ohne Fallback stirbt der ganze Job, weil der Pro-Draft auf dieser
        // Route der KOMPLETTE Review ist (D10: nie ein Job-Fehler wegen der
        // Kaskade). Der Diff war zwar zu komplex für Flash-Qualität, aber ein
        // verifizierter Flash-Review schlägt gar keinen Review.
        console.error(
            `[DraftReviewer] Pro-Volldurchlauf fehlgeschlagen (Job ${context.jobId}) — ` +
            `degradiere auf die Flash-Kaskade:`,
            proDraftError instanceof Error ? proDraftError.message : proDraftError,
        );
        return runDraftWithinBudget(degradeToFlashCascade(context), MODEL_DRAFT);
    }
}

/** Flash-Draft; ein Abbruch an der Job-Deadline wird zum ReviewTimeoutError (D5). */
async function runDraftWithinBudget(context: PipelineContext, reviewerModel: string): Promise<PipelineContext> {
    try {
        return await runDraftOnModel(context, reviewerModel);
    } catch (draftError: unknown) {
        if (!isCallDeadlineFailure(draftError)) throw draftError;
        throw new ReviewTimeoutError(`Draft-Call (${reviewerModel}) an der Job-Deadline abgebrochen`, {
            cause: draftError,
        });
    }
}

function degradeToFlashCascade(context: PipelineContext): PipelineContext {
    return {
        ...context,
        cascade: {
            ...context.cascade,
            route: 'flash-cascade',
            escalated: false,
            escalationReason: null,
            degradations: [...context.cascade.degradations, 'pro_api_error'],
        },
    };
}

// =============================================================================
// Draft auf einem Modell: ein Pass oder parallele Batches
// =============================================================================

/** Alles, was jeder Reviewer-Pass dieses Drafts teilt — Envelope und Cache inklusive. */
interface DraftPassPlan {
    readonly sharedOptions: Omit<ReviewerPassOptions, 'userPrompt' | 'reviewableFiles'>;
    readonly promptVariant: PromptVariant;
}

/** Ergebnis des Drafts über einen oder mehrere Pässe, bevor es in den Kontext fließt. */
interface DraftOutcome {
    readonly issues: readonly PipelineIssue[];
    readonly summary: string;
    readonly callUsage: TokenUsage;
    readonly cacheFellBack: boolean;
    /** Dateien gescheiterter Batches in Diff-Reihenfolge; leer = vollständiger Draft. */
    readonly unreviewedFiles: readonly string[];
}

async function runDraftOnModel(
    context: PipelineContext,
    reviewerModel: string,
): Promise<PipelineContext> {
    const isProDirect = context.cascade.route === 'pro-direct';

    const promptVariant = selectPromptVariant(context.ragPromptSection);
    const renderedLaw = await fetchRenderedLawBlock(context.detectedEcosystems);
    // Client und Cache folgen dem Modell (D3): eu-Modelle über den Explicit
    // Cache, global-only-Modelle (Pro-Rollback, A/B-Override) inline.
    const promptEnvelope = await resolvePromptEnvelope({
        variant: promptVariant,
        promptConfig: context.promptConfig,
        renderedLaw,
        detectedEcosystems: context.detectedEcosystems,
        model: reviewerModel,
        role: isProDirect ? 'escalation' : 'draft',
        deadlineAtMs: context.deadlineAtMs,
    });
    const passPlan: DraftPassPlan = {
        promptVariant,
        sharedOptions: {
            reviewerModel,
            telemetryPhase: isProDirect ? 'escalate_full' : 'draft',
            promptEnvelope,
            renderedLawRuleIds: renderedLaw.ruleIds,
            issueSource: DRAFT_ISSUE_SOURCE,
            adoptSelfReportedConfidence: isProDirect,
        },
    };

    // Chunking nur auf der Flash-Kaskade (Spec §5, Umsetzungshinweis):
    // pro-direct bleibt EIN Call in der Eskalations-Rolle — sein Fallback ist
    // die Flash-Kaskade, und die chunkt dann selbst.
    const draftBatches = isProDirect
        ? null
        : resolveDraftBatches(context.reviewableFiles, context.combinedDiff, context.cascadeConfig.draftBatchMaxTokens);
    const draftOutcome = draftBatches
        ? await runBatchedDraft(context, passPlan, draftBatches)
        : await runSingleDraft(context, passPlan);

    return applyDraftOutcome(context, draftOutcome);
}

async function runSingleDraft(context: PipelineContext, passPlan: DraftPassPlan): Promise<DraftOutcome> {
    const passResult = await runReviewerPass(context, {
        ...passPlan.sharedOptions,
        userPrompt: buildUserPrompt({
            variant: passPlan.promptVariant,
            ragPromptSection: context.ragPromptSection,
            practicesPromptSection: context.practicesPromptSection,
            prescanIssues: context.prescanIssues,
            diffText: context.combinedDiff,
        }),
        reviewableFiles: context.reviewableFiles,
    });
    logPassResult(passResult, passPlan.sharedOptions.reviewerModel, 'Draft');

    return {
        issues: passResult.aggregatedIssues,
        summary: passResult.summary,
        callUsage: passResult.callUsage,
        cacheFellBack: passResult.effectiveCacheStatus === 'inline_fallback',
        unreviewedFiles: [],
    };
}

async function runBatchedDraft(
    context: PipelineContext,
    passPlan: DraftPassPlan,
    draftBatches: readonly DraftBatch[],
): Promise<DraftOutcome> {
    const batchShapes = draftBatches
        .map((draftBatch) => `${draftBatch.files.length} Dateien/~${draftBatch.estimatedTokens} Tokens`)
        .join(', ');
    console.log(
        `[DraftReviewer] Diff ~${estimateDiffTokens(context.combinedDiff)} Tokens über der Batch-Grenze ` +
        `(${context.cascadeConfig.draftBatchMaxTokens}) — ${draftBatches.length} parallele Batches ` +
        `(${batchShapes}), Job ${context.jobId}.`,
    );

    const settledPasses = await Promise.allSettled(
        draftBatches.map((draftBatch) => runBatchPass(context, passPlan, draftBatch)),
    );
    const { succeededBatches, failedBatches } = partitionBatchPasses(draftBatches, settledPasses);
    if (succeededBatches.length === 0) throw resolveWholeDraftFailure(failedBatches);

    for (const failedBatch of failedBatches) {
        // Kein Swallowing (MAINT-001): der Fehler steht im Log, die Telemetrie-
        // Zeile (api_error/parse_error) ist geschrieben, und das Ergebnis trägt
        // die Degradation samt Dateiliste bis in DB, Check, Review und CLI.
        console.error(
            `[DraftReviewer] Batch ${failedBatch.batch.batchIndex + 1}/${draftBatches.length} gescheitert ` +
            `(${failedBatch.batch.files.length} Dateien, Job ${context.jobId}) — draft_partial:`,
            failedBatch.failure instanceof Error ? failedBatch.failure.message : failedBatch.failure,
        );
    }
    return mergeBatchPasses(succeededBatches, failedBatches);
}

async function runBatchPass(
    context: PipelineContext,
    passPlan: DraftPassPlan,
    draftBatch: DraftBatch,
): Promise<ReviewerPassResult> {
    const passResult = await runReviewerPass(context, {
        ...passPlan.sharedOptions,
        userPrompt: buildUserPrompt({
            variant: passPlan.promptVariant,
            ragPromptSection: context.ragPromptSection,
            practicesPromptSection: context.practicesPromptSection,
            prescanIssues: selectPrescanIssuesForBatch(context.prescanIssues, draftBatch.files),
            diffText: draftBatch.diffText,
        }),
        // Manifest = nur die Batch-Dateien: ein Issue auf einem Pfad außerhalb
        // des Batches ist halluziniert und fällt an der Validation-Boundary.
        reviewableFiles: draftBatch.files,
    });
    logPassResult(passResult, passPlan.sharedOptions.reviewerModel, `Batch ${draftBatch.batchIndex + 1}`);
    return passResult;
}

interface SucceededBatch {
    readonly batch: DraftBatch;
    readonly passResult: ReviewerPassResult;
}

interface FailedBatch {
    readonly batch: DraftBatch;
    readonly failure: unknown;
}

function partitionBatchPasses(
    draftBatches: readonly DraftBatch[],
    settledPasses: readonly PromiseSettledResult<ReviewerPassResult>[],
): { succeededBatches: SucceededBatch[]; failedBatches: FailedBatch[] } {
    const succeededBatches: SucceededBatch[] = [];
    const failedBatches: FailedBatch[] = [];
    settledPasses.forEach((settledPass, batchIndex) => {
        const batch = draftBatches[batchIndex];
        if (settledPass.status === 'fulfilled') {
            succeededBatches.push({ batch, passResult: settledPass.value });
        } else {
            failedBatches.push({ batch, failure: settledPass.reason });
        }
    });
    return { succeededBatches, failedBatches };
}

/**
 * Alle Batches gescheitert ⇒ heutiges Verhalten des Einzel-Drafts. Ein
 * Abbruch am Job-Budget hat Vorrang: dann ist die Restzeit weg, und
 * `review_timeout` ist die ehrliche Ursache (D5) — sonst zählt der erste
 * Fehler in Diff-Reihenfolge (z.B. ModelUnavailableError, A11).
 */
function resolveWholeDraftFailure(failedBatches: readonly FailedBatch[]): unknown {
    const deadlineFailure = failedBatches.find((failedBatch) => isCallDeadlineFailure(failedBatch.failure));
    return (deadlineFailure ?? failedBatches[0]).failure;
}

function mergeBatchPasses(
    succeededBatches: readonly SucceededBatch[],
    failedBatches: readonly FailedBatch[],
): DraftOutcome {
    const passResults = succeededBatches.map((succeededBatch) => succeededBatch.passResult);
    const [firstCallUsage, ...furtherCallUsages] = passResults.map((passResult) => passResult.callUsage);
    return {
        // Batch-Dateien sind disjunkt, die Rule+File-Aggregation je Batch
        // deshalb auch job-weit korrekt (Spec §5, Option A).
        issues: passResults.flatMap((passResult) => passResult.aggregatedIssues),
        summary: mergeBatchSummaries(passResults),
        callUsage: furtherCallUsages.reduce<TokenUsage>(
            (usageSum, callUsage) => addTokenUsage(usageSum, callUsage), firstCallUsage,
        ),
        cacheFellBack: passResults.some((passResult) => passResult.effectiveCacheStatus === 'inline_fallback'),
        unreviewedFiles: failedBatches.flatMap(
            (failedBatch) => failedBatch.batch.files.map((batchFile) => batchFile.filename),
        ),
    };
}

/**
 * Jeder Batch liefert eine eigene Summary. Es bleiben nur die der Batches mit
 * Findings, in Diff-Reihenfolge — ein "No AI slop found." neben Findings
 * anderer Batches wäre falsch. Verändert der Scorer später ein Draft-Finding,
 * ersetzt A12a (final-summary.ts) den Text ohnehin durch das Template.
 */
function mergeBatchSummaries(passResults: readonly ReviewerPassResult[]): string {
    const summariesWithFindings = passResults
        .filter((passResult) => passResult.aggregatedIssues.length > 0)
        .map((passResult) => passResult.summary.trim())
        .filter((batchSummary) => batchSummary.length > 0);
    return summariesWithFindings.length > 0 ? summariesWithFindings.join(' ') : CLEAN_DRAFT_SUMMARY;
}

function applyDraftOutcome(context: PipelineContext, draftOutcome: DraftOutcome): PipelineContext {
    const addedDegradations: CascadeDegradation[] = [];
    if (draftOutcome.cacheFellBack && !context.cascade.degradations.includes('cache_fallback')) {
        addedDegradations.push('cache_fallback');
    }
    if (draftOutcome.unreviewedFiles.length > 0) addedDegradations.push('draft_partial');

    return {
        ...context,
        issues: [...context.issues, ...draftOutcome.issues],
        reviewSummary: draftOutcome.summary,
        tokenUsage: addTokenUsage(context.tokenUsage, draftOutcome.callUsage),
        cascade: {
            ...context.cascade,
            degradations: [...context.cascade.degradations, ...addedDegradations],
            draftUnreviewedFiles: draftOutcome.unreviewedFiles,
        },
    };
}

function logPassResult(passResult: ReviewerPassResult, reviewerModel: string, passLabel: string): void {
    console.log(
        `[DraftReviewer] ${passLabel}: ${passResult.aggregatedIssues.length} Issues ` +
        `(${passResult.preAggregationIssueCount} vor der ` +
        `Rule+File-Aggregation, ${passResult.rejectedCount} von der Manifest-Validierung, ` +
        `${passResult.scopeFilteredCount} vom Scope-Post-Filter verworfen), ` +
        `Modell: ${reviewerModel}, has_slop: ${passResult.hasSlop}, cache: ${passResult.effectiveCacheStatus}`,
    );
}

// =============================================================================
// Helpers
// =============================================================================

function selectPromptVariant(ragPromptSection: string): PromptVariant {
    return ragPromptSection ? 'reviewer_rag' : 'reviewer_diff';
}

interface DraftPromptInputs {
    readonly variant: PromptVariant;
    readonly ragPromptSection: string;
    readonly practicesPromptSection: string;
    readonly prescanIssues: readonly PipelineIssue[];
    /** Der ganze combinedDiff (Einzel-Call) oder der Diff-Text eines Batches. */
    readonly diffText: string;
}

/**
 * Baut den User-Prompt: optionale Kontext-Sektionen (Evidence, Practices,
 * <already_flagged>-Prescan-Tupel) gefolgt vom Diff. Alles Diff-Variable steht
 * bewusst NUR hier und nie im System-Prompt — der bleibt per-Repo
 * byte-identisch (Cache-Contract). Evidence und Practices sind job-weit und
 * stehen deshalb in jedem Batch-Prompt.
 */
function buildUserPrompt(promptInputs: DraftPromptInputs): string {
    const contextSections: string[] = [];

    if (promptInputs.variant === 'reviewer_rag' && promptInputs.ragPromptSection) {
        contextSections.push(promptInputs.ragPromptSection);
    }
    if (promptInputs.practicesPromptSection) {
        contextSections.push(promptInputs.practicesPromptSection);
    }
    const alreadyFlaggedSection = buildAlreadyFlaggedSection(promptInputs.prescanIssues);
    if (alreadyFlaggedSection) {
        contextSections.push(alreadyFlaggedSection);
    }

    if (contextSections.length === 0) {
        return promptInputs.diffText;
    }

    return `${contextSections.join('\n\n')}\n\n\n=== NEW CODE (Pull Request Diff) ===\n${promptInputs.diffText}`;
}
