/**
 * EscalationReviewerStep — Gezielter Pro-"Laser-Eingriff" (SPEC.md §4.2, D3).
 *
 * Re-verifiziert NUR die vom claim-verifier markierten Claims auf dem
 * Eskalations-Modell (gleicher blinder Verdict-Contract). Pro-Verdicts
 * überschreiben die Flash-Verdicts der markierten Claims.
 *
 * Budget-Gate (D11): Das Monats-Budget wird genau EINMAL pro Job verbraucht,
 * unmittelbar vor dem ersten Pro-Call. Verweigertes Budget oder Pro-Fehler
 * degradieren (integrity-scorer downgradet die markierten Claims) —
 * nie ein Job-Fehler.
 */
import { fetchRenderedLawBlock } from '@/lib/law';
import { consumeProEscalationBudget } from '@/lib/billing/entitlements';
import { MODEL_ESCALATION } from '@/lib/pipeline/models';
import { resolvePromptEnvelope } from '@/lib/pipeline/context-cache';
import { addTokenUsage } from '@/lib/pipeline/helpers';
import {
    buildBlindClaims,
    chunkClaims,
    runVerdictCallWithRetry,
} from '@/lib/pipeline/claim-verification';
import { recordLlmCall } from '@/lib/telemetry/llm-call-log';
import type {
    CascadeDegradation,
    ClaimVerdict,
    PipelineContext,
    PipelineStep,
    TokenUsage,
} from '@/lib/pipeline/types';

// =============================================================================
// Step Implementation
// =============================================================================

export const escalationReviewerStep: PipelineStep = {
    id: 'escalation-reviewer',
    displayName: 'Escalation Reviewer',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) return context;
        // Short-Circuit (pre_scanner_design.md §5.3): nichts zu eskalieren.
        if (context.llmSkipped) return context;
        if (context.cascade.route === 'pro-direct') return context;
        if (context.cascade.escalationClaimIds.length === 0) return context;

        const escalationBudgetGranted = await consumeProEscalationBudget(context.ownerUserId);
        if (!escalationBudgetGranted) {
            await recordLlmCall({
                jobId: context.jobId,
                repoId: context.repositoryId,
                phase: 'escalate_targeted',
                model: MODEL_ESCALATION,
                status: 'skipped_budget',
            });
            console.log(`[EscalationReviewer] Pro-Budget erschöpft (Job ${context.jobId}) — degradiere.`);
            return degradeWithoutEscalation(context, 'pro_budget_exhausted');
        }

        try {
            return await reverifyMarkedClaims(context);
        } catch (escalationFailure: unknown) {
            console.error(
                `[EscalationReviewer] Pro-Re-Verifikation fehlgeschlagen (Job ${context.jobId}):`,
                escalationFailure instanceof Error ? escalationFailure.message : escalationFailure,
            );
            return degradeWithoutEscalation(context, 'pro_api_error');
        }
    },
};

// =============================================================================
// Pro Re-Verification
// =============================================================================

async function reverifyMarkedClaims(context: PipelineContext): Promise<PipelineContext> {
    const renderedLaw = await fetchRenderedLawBlock(context.detectedEcosystems);
    // Client und Cache folgen dem Modell (D3): die Flash-Eskalation teilt sich
    // den Explicit Cache des Drafts (gleicher Key), das Pro-Rollback läuft
    // inline auf dem global-Endpoint.
    const escalationEnvelope = await resolvePromptEnvelope({
        variant: 'claim_verifier',
        promptConfig: context.promptConfig,
        renderedLaw,
        detectedEcosystems: context.detectedEcosystems,
        model: MODEL_ESCALATION,
        role: 'escalation',
    });

    const escalationIdSet = new Set(context.cascade.escalationClaimIds);
    const markedClaims = buildBlindClaims(context.issues)
        .filter((blindClaim) => escalationIdSet.has(blindClaim.claimId));
    const claimBatches = chunkClaims(markedClaims, context.cascadeConfig.verifierBatchCap);

    const proVerdicts: ClaimVerdict[] = [];
    let accumulatedUsage: TokenUsage | null = null;

    for (const claimBatch of claimBatches) {
        const batchResult = await runVerdictCallWithRetry(context, escalationEnvelope, claimBatch, {
            model: MODEL_ESCALATION,
            verdictPhase: 'pro-verify',
            telemetryPhase: 'escalate_targeted',
        });
        proVerdicts.push(...batchResult.verdicts);
        accumulatedUsage = addTokenUsage(accumulatedUsage, batchResult.callUsage);
    }

    console.log(
        `[EscalationReviewer] ${proVerdicts.length} Claims per Pro re-verifiziert (Job ${context.jobId}).`,
    );

    return {
        ...context,
        tokenUsage: accumulatedUsage
            ? addTokenUsage(context.tokenUsage, accumulatedUsage)
            : context.tokenUsage,
        cascade: {
            ...context.cascade,
            verdicts: mergeVerdicts(context.cascade.verdicts, proVerdicts),
            escalated: true,
        },
    };
}

/** Pro-Verdicts überschreiben die Flash-Verdicts der markierten Claims (D3). */
function mergeVerdicts(
    flashVerdicts: readonly ClaimVerdict[],
    proVerdicts: readonly ClaimVerdict[],
): ClaimVerdict[] {
    const proVerdictByClaimId = new Map(
        proVerdicts.map((proVerdict) => [proVerdict.claimId, proVerdict]),
    );
    return flashVerdicts.map(
        (flashVerdict) => proVerdictByClaimId.get(flashVerdict.claimId) ?? flashVerdict,
    );
}

function degradeWithoutEscalation(
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
