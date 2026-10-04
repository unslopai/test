/**
 * DraftReviewerStep — Erster LLM-Review der Cascade (SPEC.md §4.2).
 *
 * flash-cascade: identisches Verhalten zum früheren ai-reviewer auf dem
 * Draft-Modell; die produzierten Issues sind die CLAIMS für den Verifier.
 * pro-direct: derselbe Review auf dem Eskalations-Modell; Pro liefert die
 * Verbalized Confidence pro Issue direkt mit (kein Verifier-Durchlauf).
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
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';
import type { PromptVariant } from '@/lib/pipeline/prompt-builder';

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
    const userPrompt = buildUserPrompt(context, promptVariant);

    const passResult = await runReviewerPass(context, {
        reviewerModel,
        telemetryPhase: isProDirect ? 'escalate_full' : 'draft',
        promptEnvelope,
        userPrompt,
        reviewableFiles: context.reviewableFiles,
        renderedLawRuleIds: renderedLaw.ruleIds,
        issueSource: 'draft-reviewer',
        adoptSelfReportedConfidence: isProDirect,
    });

    console.log(
        `[DraftReviewer] ${passResult.aggregatedIssues.length} Issues ` +
        `(${passResult.preAggregationIssueCount} vor der ` +
        `Rule+File-Aggregation, ${passResult.rejectedCount} von der Manifest-Validierung, ` +
        `${passResult.scopeFilteredCount} vom Scope-Post-Filter verworfen), ` +
        `Modell: ${reviewerModel}, has_slop: ${passResult.hasSlop}, cache: ${passResult.effectiveCacheStatus}`,
    );

    return {
        ...context,
        issues: [...context.issues, ...passResult.aggregatedIssues],
        reviewSummary: passResult.summary,
        tokenUsage: addTokenUsage(context.tokenUsage, passResult.callUsage),
        cascade: passResult.effectiveCacheStatus === 'inline_fallback'
            && !context.cascade.degradations.includes('cache_fallback')
            ? { ...context.cascade, degradations: [...context.cascade.degradations, 'cache_fallback'] }
            : context.cascade,
    };
}

// =============================================================================
// Helpers
// =============================================================================

function selectPromptVariant(ragPromptSection: string): PromptVariant {
    return ragPromptSection ? 'reviewer_rag' : 'reviewer_diff';
}

/**
 * Baut den User-Prompt: optionale Kontext-Sektionen (Evidence, Practices,
 * <already_flagged>-Prescan-Tupel) gefolgt vom Diff. Alles Diff-Variable steht
 * bewusst NUR hier und nie im System-Prompt — der bleibt per-Repo
 * byte-identisch (Cache-Contract).
 */
function buildUserPrompt(context: PipelineContext, variant: PromptVariant): string {
    const contextSections: string[] = [];

    if (variant === 'reviewer_rag' && context.ragPromptSection) {
        contextSections.push(context.ragPromptSection);
    }
    if (context.practicesPromptSection) {
        contextSections.push(context.practicesPromptSection);
    }
    const alreadyFlaggedSection = buildAlreadyFlaggedSection(context.prescanIssues);
    if (alreadyFlaggedSection) {
        contextSections.push(alreadyFlaggedSection);
    }

    if (contextSections.length === 0) {
        return context.combinedDiff;
    }

    return `${contextSections.join('\n\n')}\n\n\n=== NEW CODE (Pull Request Diff) ===\n${context.combinedDiff}`;
}
