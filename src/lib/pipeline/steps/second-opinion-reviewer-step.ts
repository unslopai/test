/**
 * SecondOpinionReviewerStep — gezielte Pro-Zweitmeinung (LLM_LANE_QUALITY_SPEC §4).
 *
 * Der escalation-reviewer kann nur bestehende Draft-Claims re-verifizieren —
 * ein Draft-MISS ist für ihn unsichtbar. Dieser Step schließt die Lücke:
 * zeigen deterministische Trigger (second-opinion.ts) Draft-Under-Reporting
 * an, reviewt das Eskalations-Modell ein gezieltes Datei-Subset und liefert
 * ADDITIVE Findings mit self-reported Confidence (wie pro-direct, D3) —
 * ohne Flash-Re-Verifikation (Flash über Pro wäre invertierte Autorität).
 *
 * Budget-Gate (D11): consumeProEscalationBudget genau einmal vor dem Call;
 * verweigert oder Pro-Fehler ⇒ Degradation, nie ein Job-Fehler (D10).
 * Läuft NACH escalation-reviewer und VOR integrity-scorer: neue Issues werden
 * ans ENDE von context.issues appended, damit die index-basierte
 * Verdict-Zuordnung des Scorers auf den Draft-Issues stabil bleibt.
 */
import { fetchRenderedLawBlock } from '@/lib/law';
import { consumeProEscalationBudget } from '@/lib/billing/entitlements';
import { MODEL_ESCALATION } from '@/lib/pipeline/models';
import { resolvePromptEnvelope } from '@/lib/pipeline/context-cache';
import { buildAlreadyFlaggedSection } from '@/lib/pipeline/prompt-builder';
import { addTokenUsage, buildCombinedDiff } from '@/lib/pipeline/helpers';
import { runReviewerPass } from '@/lib/pipeline/reviewer-call';
import { dropDuplicateFindings, evaluateSecondOpinionTrigger } from '@/lib/pipeline/second-opinion';
import { recordLlmCall } from '@/lib/telemetry/llm-call-log';
import type { SecondOpinionTrigger } from '@/lib/pipeline/second-opinion';
import type { CascadeDegradation, PipelineContext, PipelineStep } from '@/lib/pipeline/types';

export const secondOpinionReviewerStep: PipelineStep = {
    id: 'second-opinion-reviewer',
    displayName: 'Second Opinion Reviewer',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) return context;
        // Short-Circuit (pre_scanner_design.md §5.3): kein LLM-Review.
        if (context.llmSkipped) return context;
        // pro-direct hat den ganzen Diff bereits auf dem Eskalations-Modell gesehen.
        if (context.cascade.route === 'pro-direct') return context;

        const trigger = evaluateSecondOpinionTrigger(context);
        if (!trigger) return context;

        const escalationBudgetGranted = await consumeProEscalationBudget(context.ownerUserId);
        if (!escalationBudgetGranted) {
            await recordLlmCall({
                jobId: context.jobId,
                repoId: context.repositoryId,
                phase: 'escalate_second_opinion',
                model: MODEL_ESCALATION,
                status: 'skipped_budget',
            });
            console.log(
                `[SecondOpinion] Trigger ${trigger.reasons.join('+')}, aber Pro-Budget erschöpft ` +
                `(Job ${context.jobId}) — degradiere.`,
            );
            return degradeWithoutSecondOpinion(context, 'pro_budget_exhausted');
        }

        try {
            return await runSecondOpinionReview(context, trigger);
        } catch (secondOpinionFailure: unknown) {
            console.error(
                `[SecondOpinion] Pro-Zweitmeinung fehlgeschlagen (Job ${context.jobId}):`,
                secondOpinionFailure instanceof Error ? secondOpinionFailure.message : secondOpinionFailure,
            );
            return degradeWithoutSecondOpinion(context, 'pro_api_error');
        }
    },
};

// =============================================================================
// Pro Subset Review
// =============================================================================

async function runSecondOpinionReview(
    context: PipelineContext,
    trigger: SecondOpinionTrigger,
): Promise<PipelineContext> {
    const renderedLaw = await fetchRenderedLawBlock(context.detectedEcosystems);
    // Client und Cache folgen dem Modell (D3): die Flash-Eskalation teilt sich
    // den Explicit Cache des Drafts, das Pro-Rollback läuft inline (global).
    const secondOpinionEnvelope = await resolvePromptEnvelope({
        variant: 'reviewer_diff',
        promptConfig: context.promptConfig,
        renderedLaw,
        detectedEcosystems: context.detectedEcosystems,
        model: MODEL_ESCALATION,
        role: 'escalation',
    });

    const passResult = await runReviewerPass(context, {
        reviewerModel: MODEL_ESCALATION,
        telemetryPhase: 'escalate_second_opinion',
        promptEnvelope: secondOpinionEnvelope,
        userPrompt: buildSubsetPrompt(context, trigger),
        reviewableFiles: trigger.targetFiles,
        renderedLawRuleIds: renderedLaw.ruleIds,
        issueSource: 'second-opinion-reviewer',
        adoptSelfReportedConfidence: true,
    });

    const additiveIssues = dropDuplicateFindings(
        passResult.aggregatedIssues,
        [...context.issues, ...context.prescanIssues],
    );

    console.log(
        `[SecondOpinion] Trigger ${trigger.reasons.join('+')}: ${additiveIssues.length} neue Issues ` +
        `(${passResult.aggregatedIssues.length - additiveIssues.length} Duplikate verworfen, ` +
        `${passResult.rejectedCount} von der Manifest-Validierung), ` +
        `${trigger.targetFiles.length} Dateien` +
        `${trigger.truncatedFileCount > 0 ? `, ${trigger.truncatedFileCount} über Token-Deckel ausgelassen` : ''} ` +
        `(Job ${context.jobId}).`,
    );

    return {
        ...context,
        issues: [...context.issues, ...additiveIssues],
        reviewSummary: resolveHonestSummary(context, additiveIssues.length, passResult.summary),
        tokenUsage: addTokenUsage(context.tokenUsage, passResult.callUsage),
        cascade: {
            ...context.cascade,
            escalated: true,
            escalationReason: context.cascade.escalationReason ?? 'second_opinion',
        },
    };
}

/**
 * Fand der Draft nichts und die Zweitmeinung widerspricht, ist die
 * Draft-Summary ("No AI slop found.") faktisch falsch — ersetzen statt
 * widersprechen (gleiche Honesty-Disziplin wie der integrity-scorer).
 */
function resolveHonestSummary(
    context: PipelineContext,
    additiveIssueCount: number,
    secondOpinionSummary: string,
): string {
    const draftSaidCleanButProDisagrees = context.issues.length === 0 && additiveIssueCount > 0;
    return draftSaidCleanButProDisagrees ? secondOpinionSummary : context.reviewSummary;
}

/** User-Prompt: <already_flagged>-Prescan-Tupel + Subset-Diff im Produktionsformat. */
function buildSubsetPrompt(context: PipelineContext, trigger: SecondOpinionTrigger): string {
    const subsetDiff = buildCombinedDiff(trigger.targetFiles);
    const alreadyFlaggedSection = buildAlreadyFlaggedSection(context.prescanIssues);
    if (!alreadyFlaggedSection) return subsetDiff;
    return `${alreadyFlaggedSection}\n\n\n=== NEW CODE (Pull Request Diff) ===\n${subsetDiff}`;
}

function degradeWithoutSecondOpinion(
    context: PipelineContext,
    degradationKind: Extract<CascadeDegradation, 'pro_budget_exhausted' | 'pro_api_error'>,
): PipelineContext {
    return {
        ...context,
        cascade: {
            ...context.cascade,
            degradations: [...context.cascade.degradations, degradationKind],
        },
    };
}
