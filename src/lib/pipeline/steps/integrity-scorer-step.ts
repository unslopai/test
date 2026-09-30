/**
 * IntegrityScorerStep — Paper-Schritt 4: Cognitive Integrity Score (SPEC.md §6).
 *
 * Deterministisch, kein LLM-Call. Wendet die gesammelten Verdicts final auf
 * die Issues an (REFUTED verwerfen, UNCERTAIN downgraden + annotieren) und
 * berechnet den gewichteten Score (CRITICAL ×2). Der Score misst die
 * KONFIDENZ DES REVIEWS, nicht die Code-Qualität — er gated nie den Check (D9).
 */
import { claimIdForIssueIndex } from '@/lib/pipeline/claim-verification';
import {
    buildFinalStateSummary,
    haveDraftFindingsChanged,
    type VerdictOutcomeCounts,
} from '@/lib/pipeline/final-summary';
import { isGatekeeperRule, keepUnresolvedGatekeeperIssue } from '@/lib/pipeline/gatekeeper-rules';
import { collectReportableIssues } from '@/lib/pipeline/helpers';
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

/** Herkunft der verifizierten Draft-Claims; Second-Opinion-Issues sind verdict-los. */
const DRAFT_ISSUE_SOURCE = 'draft-reviewer';

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
        const draftIssues = context.issues.filter((issue) => issue.source === DRAFT_ISSUE_SOURCE);
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

        return finalizeScore(context, verdictApplication.survivingIssues, verdictApplication);
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
        const claimVerdict = verdictByClaimId.get(claimIdForIssueIndex(issueIndex));
        if (!claimVerdict) {
            survivingIssues.push(labelIssueWithoutVerdict(draftIssue));
            return;
        }
        const arbitrationSkipped = escalationSkipped && escalationIdSet.has(claimVerdict.claimId);
        const resolution = resolveVerdictedIssue(draftIssue, claimVerdict, arbitrationSkipped, cascade);
        if (resolution.outcome === 'refuted') refutedCount += 1;
        if (resolution.outcome === 'downgraded') downgradedCount += 1;
        if (resolution.issue) survivingIssues.push(resolution.issue);
    });

    return { survivingIssues, refutedCount, downgradedCount };
}

type VerdictOutcome = 'kept' | 'downgraded' | 'refuted';

interface VerdictedIssueResolution {
    /** null = verworfen, erscheint nirgends mehr (D8). */
    readonly issue: PipelineIssue | null;
    readonly outcome: VerdictOutcome;
}

/** Ein Draft-Issue mit Verdict: GATE-001 folgt seinen eigenen Regeln, alles andere §6/§8. */
function resolveVerdictedIssue(
    draftIssue: PipelineIssue,
    claimVerdict: ClaimVerdict,
    arbitrationSkipped: boolean,
    cascade: CascadeState,
): VerdictedIssueResolution {
    if (isGatekeeperRule(draftIssue.rule)) {
        const gatekeeperIssue = resolveGatekeeperClaim(draftIssue, claimVerdict, arbitrationSkipped, cascade);
        return { issue: gatekeeperIssue, outcome: gatekeeperIssue === null ? 'refuted' : 'kept' };
    }
    if (claimVerdict.verdict === 'REFUTED') {
        // Ein Flash-REFUTED auf einem eskalations-markierten Claim, den Pro
        // nie geprüft hat, darf NICHT still sterben (False-Refutation-Risiko,
        // PR-#13-Vorfall) — er überlebt sichtbar als downgraded WARNING.
        if (!arbitrationSkipped) return { issue: null, outcome: 'refuted' };
        return { issue: decorateIssue(draftIssue, claimVerdict, 'escalation_skipped'), outcome: 'downgraded' };
    }
    const downgradeReason = resolveDowngradeReason(claimVerdict, arbitrationSkipped);
    return {
        issue: decorateIssue(draftIssue, claimVerdict, downgradeReason),
        outcome: downgradeReason ? 'downgraded' : 'kept',
    };
}

/**
 * A12c (SPEC.md §12.4, Regeln 2–6): ein GATE-001-Claim ist nie WARNING und
 * nie `contested`. CONFIRMED bleibt CRITICAL mit der Verifier-Konfidenz —
 * auch unter der Konfidenzschwelle ohne Arbiter (Regel 6; vorher lief dieser
 * Pfad in den generischen `escalation_skipped`-Downgrade, Nachreview
 * 2026-09-28). Nur ein Arbiter-REFUTED auf die feste Frage verwirft (null);
 * ohne Arbiter oder bei UNCERTAIN bleibt der Claim annotiert CRITICAL.
 */
function resolveGatekeeperClaim(
    draftIssue: PipelineIssue,
    claimVerdict: ClaimVerdict,
    arbitrationSkipped: boolean,
    cascade: CascadeState,
): PipelineIssue | null {
    if (claimVerdict.verdict === 'CONFIRMED') {
        return { ...decorateIssue(draftIssue, claimVerdict, null), severity: 'CRITICAL' };
    }
    if (arbitrationSkipped) {
        return keepUnresolvedGatekeeperIssue(draftIssue, 'arbitration_skipped', describeSkippedArbitration(cascade));
    }
    if (claimVerdict.verdict === 'REFUTED') return null;
    return keepUnresolvedGatekeeperIssue(draftIssue, 'verdict_uncertain', '');
}

/** Grund-Label für die Annotation, in der Reihenfolge, in der die Stufe scheitern kann. */
function describeSkippedArbitration(cascade: CascadeState): string {
    if (cascade.degradations.includes('time_budget_exhausted')) return 'time budget exhausted';
    if (cascade.degradations.includes('pro_budget_exhausted')) return 'escalation budget exhausted';
    if (cascade.degradations.includes('pro_api_error')) return 'escalation model unavailable';
    return 'escalation unavailable';
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
    arbitrationSkipped: boolean,
): DowngradeReason {
    if (claimVerdict.verdict === 'UNCERTAIN') return 'uncertain_verdict';
    if (arbitrationSkipped) return 'escalation_skipped';
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
            + 'was skipped (budget, API or time-limit degradation), so it could not be conclusively verified.',
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
    verdictOutcome: VerdictOutcomeCounts = NO_VERDICT_OUTCOME,
): PipelineContext {
    // D7: ein nur teilweise gelaufener Verifier hätte nur die verifizierten
    // Claims gezählt — die Zahl würde lügen. Ehrlich ist null. Dasselbe gilt
    // für einen nur teilweise gelaufenen Draft (`draft_partial`, LARGE_DIFF_
    // RECALL_SPEC Option A): Claims aus ungesehenen Dateien fehlen dem Score.
    const coverageIncomplete = context.cascade.skippedStages.includes('verifier')
        || context.cascade.degradations.includes('draft_partial');
    const integrityScore = coverageIncomplete ? null : computeIntegrityScore(survivingIssues);
    console.log(
        `[IntegrityScorer] Cognitive Integrity Score: ${integrityScore ?? 'n/a'} ` +
        `(${survivingIssues.length} Issues, Job ${context.jobId}).`,
    );

    return {
        ...context,
        issues: survivingIssues,
        reviewSummary: resolveFinalSummary(context, survivingIssues, verdictOutcome),
        cascade: { ...context.cascade, integrityScore },
    };
}

const NO_VERDICT_OUTCOME: VerdictOutcomeCounts = { refutedCount: 0, downgradedCount: 0 };

/**
 * A12a (SPEC.md §12.4): die Draft-Summary (oder deren Second-Opinion-Ersatz)
 * bleibt nur, solange jedes Draft-Finding unverändert überlebt hat. Sonst
 * zählt das Template genau die Issues, die Reporter und Persister melden —
 * inklusive der Prescan-Lane, sonst behauptete "no confirmed AI slop" das
 * Gegenteil der deterministischen Findings daneben.
 */
function resolveFinalSummary(
    context: PipelineContext,
    survivingIssues: readonly PipelineIssue[],
    verdictOutcome: VerdictOutcomeCounts,
): string {
    const draftIssuesBefore = context.issues.filter((issue) => issue.source === DRAFT_ISSUE_SOURCE);
    const draftIssuesAfter = survivingIssues.filter((issue) => issue.source === DRAFT_ISSUE_SOURCE);
    if (!haveDraftFindingsChanged(draftIssuesBefore, draftIssuesAfter)) return context.reviewSummary;

    const reportableIssues = collectReportableIssues({ ...context, issues: [...survivingIssues] });
    return buildFinalStateSummary(reportableIssues, verdictOutcome);
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
