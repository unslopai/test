/**
 * IntegrityScorerStep — Paper-Schritt 4: Cognitive Integrity Score (SPEC.md §6).
 *
 * Deterministisch, kein LLM-Call. Wendet die gesammelten Verdicts final auf
 * die Issues an (REFUTED verwerfen, UNCERTAIN downgraden + annotieren) und
 * berechnet den gewichteten Score (CRITICAL ×2). Der Score misst die
 * KONFIDENZ DES REVIEWS, nicht die Code-Qualität — er gated nie den Check (D9).
 */
import { claimIdForIssueIndex } from '@/lib/pipeline/claim-verification';
import type { IssueVerification } from '@unslop/shared';
import type {
    CascadeState,
    ClaimVerdict,
    PipelineContext,
    PipelineIssue,
    PipelineStep,
} from '@/lib/pipeline/types';

const CRITICAL_SCORE_WEIGHT = 2;
const WARNING_SCORE_WEIGHT = 1;

/**
 * Befund-Konfidenz eines UNCERTAIN-Claims (SPEC.md §6). Die Verifier-Zahl
 * misst die Konfidenz ins VERDIKT ("100 % sicher, dass unklar") — als
 * Konfidenz in den Befund ist ein unentschiedenes Urteil ein Münzwurf.
 * Vorher floss die Verdikt-Zahl 1:1 in Score und Finding: ein UNCERTAIN/100
 * ergab "Integrity 100 — every finding survived" neben einem explizit
 * unbestätigten Finding (ROADMAP To-Do §3, entschieden 2026-09-17).
 */
const UNCERTAIN_CLAIM_CONFIDENCE = 50;

// =============================================================================
// Step Implementation
// =============================================================================

export const integrityScorerStep: PipelineStep = {
    id: 'integrity-scorer',
    displayName: 'Integrity Scorer',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) return context;

        // Short-Circuit (pre_scanner_design.md §5.3): es wurden keine Claims
        // verifiziert — ehrliches null statt einer erfundenen 100 (der Score
        // misst LLM-Claim-Survival, und es gab keine LLM-Claims).
        if (context.llmSkipped) {
            console.log(`[IntegrityScorer] LLM-Review übersprungen — Score n/a (Job ${context.jobId}).`);
            return { ...context, cascade: { ...context.cascade, integrityScore: null } };
        }

        // pro-direct: Issues tragen die self-reported Pro-Confidence, keine Verdicts.
        if (context.cascade.route === 'pro-direct') {
            return finalizeScore(context, context.issues.map(labelIssueWithoutVerdict));
        }

        // Verifier degradiert (oder gar nicht gelaufen bei >0 Draft-Issues):
        // ungefiltert durchreichen, kein ehrlicher Score möglich (SPEC.md §8).
        // Second-Opinion-Issues zählen hier NICHT: sie sind bewusst verdict-los
        // und tragen self-reported Pro-Confidence (LLM_LANE_QUALITY_SPEC §4.4) —
        // ein Draft ohne Findings plus Pro-Zweitmeinung ist kein degradierter Lauf.
        const draftIssues = context.issues.filter((issue) => issue.source === 'draft-reviewer');
        if (draftIssues.length > 0 && context.cascade.verdicts.length === 0) {
            console.log(`[IntegrityScorer] Keine Verdicts vorhanden — Score n/a (Job ${context.jobId}).`);
            return {
                ...context,
                issues: context.issues.map(labelIssueWithoutVerdict),
                cascade: { ...context.cascade, integrityScore: null },
            };
        }

        const verdictApplication = applyVerdictsToIssues(context.issues, context.cascade);
        console.log(
            `[IntegrityScorer] ${verdictApplication.refutedCount} Issues verworfen (refuted), ` +
            `${verdictApplication.downgradedCount} auf WARNING downgraded (Job ${context.jobId}).`,
        );

        return finalizeScore(context, verdictApplication.survivingIssues);
    },
};

// =============================================================================
// Verdict Application (D8)
// =============================================================================

interface VerdictApplication {
    readonly survivingIssues: readonly PipelineIssue[];
    readonly refutedCount: number;
    readonly downgradedCount: number;
}

function applyVerdictsToIssues(
    issues: readonly PipelineIssue[],
    cascade: CascadeState,
): VerdictApplication {
    const verdictByClaimId = new Map(
        cascade.verdicts.map((verdictEntry) => [verdictEntry.claimId, verdictEntry]),
    );
    const escalationIdSet = new Set(cascade.escalationClaimIds);
    // Pro sollte eskalierte Claims klären, kam aber nie zum Zug (Budget/API):
    // markierte Claims werden konservativ wie UNCERTAIN behandelt (SPEC.md §8).
    const escalationSkipped = cascade.escalationClaimIds.length > 0 && !cascade.escalated;

    const survivingIssues: PipelineIssue[] = [];
    let refutedCount = 0;
    let downgradedCount = 0;

    issues.forEach((draftIssue, issueIndex) => {
        const claimId = claimIdForIssueIndex(issueIndex);
        const claimVerdict = verdictByClaimId.get(claimId);

        if (!claimVerdict) {
            survivingIssues.push(labelIssueWithoutVerdict(draftIssue));
            return;
        }
        if (claimVerdict.verdict === 'REFUTED') {
            // Ein Flash-REFUTED auf einem eskalations-markierten Claim, den Pro
            // nie geprüft hat, darf NICHT still sterben (False-Refutation-Risiko,
            // PR-#13-Vorfall) — er überlebt sichtbar als downgraded WARNING.
            const refutedWithoutProReview = escalationSkipped && escalationIdSet.has(claimId);
            if (!refutedWithoutProReview) {
                refutedCount += 1;
                return;
            }
            downgradedCount += 1;
            survivingIssues.push(decorateIssue(draftIssue, claimVerdict, 'escalation_skipped'));
            return;
        }

        const downgradeReason = resolveDowngradeReason(claimVerdict, escalationSkipped, escalationIdSet.has(claimId));
        if (downgradeReason) downgradedCount += 1;

        survivingIssues.push(decorateIssue(draftIssue, claimVerdict, downgradeReason));
    });

    return { survivingIssues, refutedCount, downgradedCount };
}

/**
 * Zwei Downgrade-Gründe mit unterschiedlicher Wahrheit: ein UNCERTAIN-Verdict
 * wurde geprüft und blieb unschlüssig; ein übersprungener Eskalations-Claim
 * wurde gar nicht abschließend geprüft. Die Annotation muss den Grund nennen —
 * "Reduced confidence (100/100)" auf dem Skip-Pfad war ein Selbstwiderspruch
 * (F5-Befund 2026-08-31, ROADMAP §3).
 */
type DowngradeReason = 'uncertain_verdict' | 'escalation_skipped' | null;

function resolveDowngradeReason(
    claimVerdict: ClaimVerdict,
    escalationSkipped: boolean,
    claimMarkedForEscalation: boolean,
): DowngradeReason {
    if (claimVerdict.verdict === 'UNCERTAIN') return 'uncertain_verdict';
    if (escalationSkipped && claimMarkedForEscalation) return 'escalation_skipped';
    return null;
}

/**
 * Darstellung je Downgrade-Grund. BEIDE Notes bewusst OHNE die Verifier-Zahl:
 * sie misst die Konfidenz ins VERDIKT, liest sich in der Annotation aber wie
 * Konfidenz in den Befund — "Reduced confidence (100/100)" auf einem
 * UNCERTAIN-Verdict war derselbe Selbstwiderspruch wie auf dem Skip-Pfad
 * (Live-Scan 2026-08-31).
 */
const DOWNGRADE_PRESENTATION: Record<NonNullable<DowngradeReason>, {
    readonly note: string;
    readonly verification: IssueVerification;
}> = {
    uncertain_verdict: {
        note: '⚠️ Reduced confidence — independent verification remained uncertain, '
            + 'so this finding could not be conclusively confirmed.',
        verification: 'uncertain',
    },
    escalation_skipped: {
        note: '⚠️ Downgraded to WARNING — this finding was flagged for Pro escalation, but the escalation '
            + 'was skipped (budget or API degradation), so it could not be conclusively verified.',
        verification: 'unverified',
    },
};

function decorateIssue(
    draftIssue: PipelineIssue,
    claimVerdict: ClaimVerdict,
    downgradeReason: DowngradeReason,
): PipelineIssue {
    if (!downgradeReason) {
        return { ...draftIssue, confidence: claimVerdict.confidence, verification: 'confirmed' };
    }
    const presentation = DOWNGRADE_PRESENTATION[downgradeReason];
    return {
        ...draftIssue,
        severity: 'WARNING',
        confidence: downgradeReason === 'uncertain_verdict'
            ? UNCERTAIN_CLAIM_CONFIDENCE
            : claimVerdict.confidence,
        verification: presentation.verification,
        critique: `${draftIssue.critique}

${presentation.note}`,
    };
}

/**
 * Issues ohne Verdict: pro-direct- und Second-Opinion-Findings tragen die
 * Eigen-Konfidenz des Reviewer-Modells ('self_reported'); ein Draft-Issue
 * ohne Konfidenz wurde nie verifiziert (Verifier degradiert, 'unverified').
 * Ein bereits gesetzter Status (z.B. 'deterministic') bleibt.
 */
function labelIssueWithoutVerdict(issue: PipelineIssue): PipelineIssue {
    if (issue.verification) return issue;
    return {
        ...issue,
        verification: typeof issue.confidence === 'number' ? 'self_reported' : 'unverified',
    };
}

// =============================================================================
// Score Computation (D9)
// =============================================================================

function finalizeScore(
    context: PipelineContext,
    survivingIssues: readonly PipelineIssue[],
): PipelineContext {
    const integrityScore = computeIntegrityScore(survivingIssues);
    console.log(
        `[IntegrityScorer] Cognitive Integrity Score: ${integrityScore ?? 'n/a'} ` +
        `(${survivingIssues.length} Issues, Job ${context.jobId}).`,
    );

    // Wurden ALLE Draft-Findings verworfen, ist die Draft-Summary
    // ("AI slop detected: ...") faktisch falsch — ersetzen statt widersprechen.
    const allDraftFindingsDismissed = context.issues.length > 0 && survivingIssues.length === 0;
    const reviewSummary = allDraftFindingsDismissed
        ? 'All draft findings were refuted during independent blind verification — no confirmed AI slop.'
        : context.reviewSummary;

    return {
        ...context,
        issues: survivingIssues,
        reviewSummary,
        cascade: { ...context.cascade, integrityScore },
    };
}

/**
 * Konfidenz-gewichteter Durchschnitt der überlebenden Issues; CRITICAL zählt
 * doppelt. Keine Issues (sauberer Diff oder alles widerlegt) = 100.
 * UNCERTAIN-Issues gehen mit UNCERTAIN_CLAIM_CONFIDENCE ein (decorateIssue).
 */
function computeIntegrityScore(survivingIssues: readonly PipelineIssue[]): number | null {
    if (survivingIssues.length === 0) return 100;

    const scoredIssues = survivingIssues.filter(
        (survivingIssue) => typeof survivingIssue.confidence === 'number',
    );
    if (scoredIssues.length === 0) return null;

    let weightedConfidenceSum = 0;
    let weightSum = 0;
    for (const scoredIssue of scoredIssues) {
        const severityWeight = scoredIssue.severity === 'CRITICAL'
            ? CRITICAL_SCORE_WEIGHT
            : WARNING_SCORE_WEIGHT;
        weightedConfidenceSum += (scoredIssue.confidence ?? 0) * severityWeight;
        weightSum += severityWeight;
    }

    return Math.round(weightedConfidenceSum / weightSum);
}
