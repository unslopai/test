/**
 * ClaimVerifierStep — Paper-Schritte 2+3: Self-Questioning & Self-Consistency
 * (SPEC.md §3, §4.2).
 *
 * Verifiziert jeden Draft-Claim blind (ohne die Draft-Begründung) in
 * Batch-Calls auf dem Verifier-Modell. Die Issues kommen bereits pro
 * Rule+File aggregiert an (draft-reviewer, ROADMAP §7): ein Aggregat ist
 * EIN Claim mit occurrences-Liste und kostet EIN Verdict — nicht N. Der Step verändert die Issues NICHT —
 * er sammelt nur Verdicts und markiert Eskalations-Kandidaten; das Verwerfen/
 * Downgraden übernimmt der integrity-scorer NACH der Pro-Eskalation, damit
 * die Claim-ID <-> Issue-Index-Zuordnung stabil bleibt.
 *
 * Degradation (D10): Schlägt die Verifikation trotz Retry fehl, laufen die
 * Draft-Issues UNGEFILTERT weiter (Score = null) — nie ein Job-Fehler.
 */
import { fetchRenderedLawBlock } from '@/lib/law';
import { MODEL_VERIFIER } from '@/lib/pipeline/models';
import { resolvePromptEnvelope } from '@/lib/pipeline/context-cache';
import { addTokenUsage } from '@/lib/pipeline/helpers';
import type { FlashPromptEnvelope } from '@/lib/pipeline/context-cache';
import { hasBudgetForCall, markStageSkippedForTime } from '@/lib/pipeline/deadline';
import { isCallDeadlineFailure } from '@/lib/pipeline/vertex-retry';
import {
    VerdictCallError,
    buildBlindClaims,
    chunkClaims,
    claimIdForIssueIndex,
    countVerdicts,
    runVerdictCallWithRetry,
} from '@/lib/pipeline/claim-verification';
import type { BlindClaim, VerdictCallResult } from '@/lib/pipeline/claim-verification';
import type {
    ClaimVerdict,
    EscalationReason,
    PipelineContext,
    PipelineIssue,
    PipelineStep,
    TokenUsage,
} from '@/lib/pipeline/types';

// =============================================================================
// Step Implementation
// =============================================================================

export const claimVerifierStep: PipelineStep = {
    id: 'claim-verifier',
    displayName: 'Claim Verifier',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) return context;
        // Short-Circuit (pre_scanner_design.md §5.3): ohne Draft keine Claims.
        if (context.llmSkipped) return context;
        if (context.cascade.route === 'pro-direct') return context;
        if (context.issues.length === 0) return context;
        // D4: ohne 40 s Rest startet kein Verify-Batch — die Claims bleiben
        // unverifiziert, der Score wird ehrlich null (D7).
        if (!hasBudgetForCall(context, 'verify')) {
            console.warn(`[ClaimVerifier] Zeitbudget reicht nicht für die Verifikation (Job ${context.jobId}).`);
            return markStageSkippedForTime(context, 'verifier');
        }

        const renderedLaw = await fetchRenderedLawBlock(context.detectedEcosystems);
        // EIN Envelope pro Job: Draft und Verifier teilen denselben Cache-Key,
        // der Draft-Step hat den Cache in aller Regel schon angelegt (§4.1).
        const verifierEnvelope = await resolvePromptEnvelope({
            variant: 'claim_verifier',
            promptConfig: context.promptConfig,
            renderedLaw,
            detectedEcosystems: context.detectedEcosystems,
            model: MODEL_VERIFIER,
            role: 'verifier',
            deadlineAtMs: context.deadlineAtMs,
        });
        const claimBatches = chunkClaims(
            buildBlindClaims(context.issues),
            context.cascadeConfig.verifierBatchCap,
        );

        try {
            const batchRun = await verifyAllBatches(context, verifierEnvelope, claimBatches);
            return applyVerificationResult(context, batchRun);
        } catch (verificationFailure: unknown) {
            return degradeToUnfilteredDraft(context, verificationFailure);
        }
    },
};

// =============================================================================
// Batch Execution & Degradation
// =============================================================================

interface VerificationBatchRun {
    readonly verdicts: readonly ClaimVerdict[];
    readonly accumulatedUsage: TokenUsage | null;
    readonly cacheFallbackOccurred: boolean;
    /** true = das Zeitbudget hat den Lauf vor dem letzten Batch beendet (D4). */
    readonly stoppedForTime: boolean;
}

async function verifyAllBatches(
    context: PipelineContext,
    verifierEnvelope: FlashPromptEnvelope,
    claimBatches: readonly (readonly BlindClaim[])[],
): Promise<VerificationBatchRun> {
    const collectedVerdicts: ClaimVerdict[] = [];
    let accumulatedUsage: TokenUsage | null = null;
    let cacheFallbackOccurred = false;

    for (const claimBatch of claimBatches) {
        const batchResult = await runBatchWithinBudget(context, verifierEnvelope, claimBatch);
        if (batchResult === null) {
            return { verdicts: collectedVerdicts, accumulatedUsage, cacheFallbackOccurred, stoppedForTime: true };
        }
        collectedVerdicts.push(...batchResult.verdicts);
        accumulatedUsage = addTokenUsage(accumulatedUsage, batchResult.callUsage);
        cacheFallbackOccurred = cacheFallbackOccurred || batchResult.cacheFallbackOccurred;
    }

    return { verdicts: collectedVerdicts, accumulatedUsage, cacheFallbackOccurred, stoppedForTime: false };
}

/**
 * Ein Batch unter dem Job-Budget (DEADLINE_GUARD_SPEC §3.3). null = das
 * Budget reicht nicht (mehr): vor dem Start unter der Schwelle oder an der
 * Deadline abgebrochen. Die bis hier gesammelten Verdicts bleiben erhalten —
 * früher warf jeder Fehler ALLE Verdicts weg (degradeToUnfilteredDraft).
 * Nicht-Zeit-Fehler propagieren unverändert in genau diesen Pfad.
 */
async function runBatchWithinBudget(
    context: PipelineContext,
    verifierEnvelope: FlashPromptEnvelope,
    claimBatch: readonly BlindClaim[],
): Promise<VerdictCallResult | null> {
    if (!hasBudgetForCall(context, 'verify')) return null;
    try {
        return await runVerdictCallWithRetry(context, verifierEnvelope, claimBatch, {
            model: MODEL_VERIFIER,
            verdictPhase: 'flash-verify',
            telemetryPhase: 'verify',
        });
    } catch (batchFailure: unknown) {
        // Der Verifier hat keinen eigenen Deckel — jeder Deadline-Abbruch ist das Job-Budget.
        if (!isCallDeadlineFailure(batchFailure)) throw batchFailure;
        console.warn(
            `[ClaimVerifier] Verify-Batch am Zeitbudget beendet (Job ${context.jobId}) — `
            + 'bisherige Verdicts bleiben, Rest unverifiziert.',
        );
        return null;
    }
}

function degradeToUnfilteredDraft(
    context: PipelineContext,
    verificationFailure: unknown,
): PipelineContext {
    const degradationKind = verificationFailure instanceof VerdictCallError
        && verificationFailure.failureKind === 'parse_error'
        ? 'verifier_parse_error' as const
        : 'verifier_api_error' as const;

    console.error(
        `[ClaimVerifier] Verifikation degradiert (${degradationKind}, Job ${context.jobId}) — ` +
        `Draft-Issues laufen ungefiltert weiter.`,
    );

    return {
        ...context,
        cascade: {
            ...context.cascade,
            degradations: [...context.cascade.degradations, degradationKind],
        },
    };
}

// =============================================================================
// Verdict-Auswertung → Eskalations-Markierung (D3)
// =============================================================================

function applyVerificationResult(
    context: PipelineContext,
    batchRun: VerificationBatchRun,
): PipelineContext {
    const escalationClaimIds = selectEscalationClaimIds(
        batchRun.verdicts, context.issues, context.cascadeConfig.confidenceThreshold,
    );
    const verdictCounts = countVerdicts(batchRun.verdicts);
    const verifiedContext = batchRun.stoppedForTime ? markStageSkippedForTime(context, 'verifier') : context;

    console.log(
        `[ClaimVerifier] ${verdictCounts.claimsTotal} Claims: ${verdictCounts.claimsConfirmed} confirmed, ` +
        `${verdictCounts.claimsRefuted} refuted, ${verdictCounts.claimsUncertain} uncertain — ` +
        `${escalationClaimIds.length} zur Pro-Eskalation markiert.`,
    );

    return {
        ...verifiedContext,
        tokenUsage: batchRun.accumulatedUsage
            ? addTokenUsage(context.tokenUsage, batchRun.accumulatedUsage)
            : context.tokenUsage,
        cascade: {
            ...verifiedContext.cascade,
            verdicts: batchRun.verdicts,
            escalationClaimIds,
            escalationReason: deriveEscalationReason(batchRun.verdicts, escalationClaimIds),
            degradations: batchRun.cacheFallbackOccurred
                && !verifiedContext.cascade.degradations.includes('cache_fallback')
                ? [...verifiedContext.cascade.degradations, 'cache_fallback']
                : verifiedContext.cascade.degradations,
        },
    };
}

/**
 * Eskalations-Kriterium (D3, verschärft nach dem PR-#13-Vorfall):
 * UNCERTAIN-Verdicts eskalieren immer. CRITICAL-Claims eskalieren zusätzlich,
 * wenn Flash sie REFUTED (eine False Refutation würde ein echtes Finding
 * unsichtbar löschen — das Risiko ist asymmetrisch) ODER nur mit Confidence
 * unter der Repo-Schwelle bestätigt hat. Nur ein Pro-REFUTED darf einen
 * CRITICAL-Claim endgültig verwerfen (integrity-scorer).
 */
function selectEscalationClaimIds(
    verdicts: readonly ClaimVerdict[],
    draftIssues: readonly PipelineIssue[],
    confidenceThreshold: number,
): readonly string[] {
    const verdictByClaimId = new Map(verdicts.map((verdictEntry) => [verdictEntry.claimId, verdictEntry]));

    return draftIssues.flatMap((draftIssue, issueIndex) => {
        const claimId = claimIdForIssueIndex(issueIndex);
        const claimVerdict = verdictByClaimId.get(claimId);
        if (!claimVerdict) return [];

        const isUncertain = claimVerdict.verdict === 'UNCERTAIN';
        const isContestedCritical = draftIssue.severity === 'CRITICAL'
            && (claimVerdict.verdict === 'REFUTED'
                || (claimVerdict.verdict === 'CONFIRMED' && claimVerdict.confidence < confidenceThreshold));

        return isUncertain || isContestedCritical ? [claimId] : [];
    });
}

function deriveEscalationReason(
    verdicts: readonly ClaimVerdict[],
    escalationClaimIds: readonly string[],
): EscalationReason | null {
    if (escalationClaimIds.length === 0) return null;

    const escalationIdSet = new Set(escalationClaimIds);
    const hasUncertainClaim = verdicts.some(
        (verdictEntry) => escalationIdSet.has(verdictEntry.claimId) && verdictEntry.verdict === 'UNCERTAIN',
    );

    return hasUncertainClaim ? 'uncertain_claims' : 'critical_low_confidence';
}
