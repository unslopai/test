/**
 * Unit Tests: Cognitive Integrity Score & finale Verdict-Anwendung
 * (SPEC.md §6, §11).
 *
 * Score-Semantik: gewichteter Konfidenz-Durchschnitt (CRITICAL zählt doppelt),
 * sauberer Diff = 100, degradierte Verifikation = null (nie ein erfundener Wert),
 * UNCERTAIN-Claim = 50 (Münzwurf, nie die Verifier-Zahl ins Verdikt).
 * Jedes überlebende Issue trägt seinen Verifikationsstatus für die Tagline.
 */
import { describe, expect, it, vi } from 'vitest';
import { integrityScorerStep } from '@/lib/pipeline/steps/integrity-scorer-step';
import {
    buildCascadeState,
    buildClaimVerdict,
    buildPipelineContext,
    buildReviewIssue,
} from '@/lib/pipeline/testing/context-fixture';

// Transitiv über claim-verification: llm-call-log und context-cache
// importieren Supabase- bzw. Vertex-Clients, die ohne Env-Variablen beim
// Import werfen.
vi.mock('@/lib/telemetry/llm-call-log', () => ({
    recordLlmCall: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/vertex', () => ({
    getVertexClient: vi.fn(),
    getVertexGlobalClient: vi.fn(),
}));

describe('integrityScorerStep', () => {
    it('scores a clean diff as 100', async () => {
        const cleanDiffContext = buildPipelineContext();

        const scoredContext = await integrityScorerStep.execute(cleanDiffContext);

        expect(scoredContext.cascade.integrityScore).toBe(100);
        expect(scoredContext.issues).toHaveLength(0);
    });

    it('scores 100 and rewrites the summary when every draft issue was refuted', async () => {
        const allRefutedContext = buildPipelineContext({
            issues: [buildReviewIssue({ severity: 'WARNING' })],
            reviewSummary: 'AI slop detected: something scary.',
            cascade: buildCascadeState({
                verdicts: [buildClaimVerdict({ claimId: 'c1', verdict: 'REFUTED', confidence: 95 })],
            }),
        });

        const scoredContext = await integrityScorerStep.execute(allRefutedContext);

        expect(scoredContext.issues).toHaveLength(0);
        expect(scoredContext.cascade.integrityScore).toBe(100);
        expect(scoredContext.reviewSummary).toContain('refuted during independent blind verification');
    });

    it('keeps a flash-refuted CRITICAL visible as WARNING when Pro never reviewed it', async () => {
        const refutedWithoutProContext = buildPipelineContext({
            issues: [buildReviewIssue({ severity: 'CRITICAL' })],
            cascade: buildCascadeState({
                verdicts: [buildClaimVerdict({ claimId: 'c1', verdict: 'REFUTED', confidence: 65 })],
                escalationClaimIds: ['c1'],
                escalated: false,
                degradations: ['pro_api_error'],
            }),
        });

        const scoredContext = await integrityScorerStep.execute(refutedWithoutProContext);

        expect(scoredContext.issues).toHaveLength(1);
        expect(scoredContext.issues[0].severity).toBe('WARNING');
        // Skip-Pfad: der Grund (übersprungene Eskalation) steht in der Annotation,
        // NICHT die Verifier-Zahl des ungeklärten Urteils (B2, ROADMAP §3).
        expect(scoredContext.issues[0].critique).toContain('escalation was skipped');
        expect(scoredContext.issues[0].critique).not.toContain('Reduced confidence');
    });

    it('drops a claim conclusively when Pro itself refuted it', async () => {
        const proRefutedContext = buildPipelineContext({
            issues: [buildReviewIssue({ severity: 'CRITICAL' })],
            cascade: buildCascadeState({
                verdicts: [buildClaimVerdict({
                    claimId: 'c1', verdict: 'REFUTED', confidence: 95, phase: 'pro-verify',
                })],
                escalationClaimIds: ['c1'],
                escalated: true,
            }),
        });

        const scoredContext = await integrityScorerStep.execute(proRefutedContext);

        expect(scoredContext.issues).toHaveLength(0);
        expect(scoredContext.cascade.integrityScore).toBe(100);
    });

    it('returns a null score when issues exist but verification never produced verdicts', async () => {
        const degradedContext = buildPipelineContext({
            issues: [buildReviewIssue()],
            cascade: buildCascadeState({ degradations: ['verifier_parse_error'] }),
        });

        const scoredContext = await integrityScorerStep.execute(degradedContext);

        expect(scoredContext.cascade.integrityScore).toBeNull();
        expect(scoredContext.issues).toHaveLength(1);
        expect(scoredContext.issues[0].confidence).toBeUndefined();
        expect(scoredContext.issues[0].verification).toBe('unverified');
    });

    it('scores verdict-less second-opinion issues from their self-reported confidence (T2: draft found nothing)', async () => {
        // LLM_LANE_QUALITY_SPEC §4.4: Draft 0 Issues ⇒ 0 Verdicts — die additive
        // Pro-Zweitmeinung darf davon nicht als "degradiert" (null) erfasst werden.
        const secondOpinionOnlyContext = buildPipelineContext({
            issues: [buildReviewIssue({ source: 'second-opinion-reviewer', confidence: 80 })],
        });

        const scoredContext = await integrityScorerStep.execute(secondOpinionOnlyContext);

        expect(scoredContext.cascade.integrityScore).toBe(80);
        expect(scoredContext.issues).toHaveLength(1);
        expect(scoredContext.issues[0].verification).toBe('self_reported');
    });

    it('weights CRITICAL confidences twice as heavily as WARNING', async () => {
        const mixedSeverityContext = buildPipelineContext({
            issues: [
                buildReviewIssue({ severity: 'CRITICAL' }),
                buildReviewIssue({ severity: 'WARNING', line: 50 }),
            ],
            cascade: buildCascadeState({
                verdicts: [
                    buildClaimVerdict({ claimId: 'c1', confidence: 90 }),
                    buildClaimVerdict({ claimId: 'c2', confidence: 60 }),
                ],
            }),
        });

        const scoredContext = await integrityScorerStep.execute(mixedSeverityContext);

        expect(scoredContext.cascade.integrityScore).toBe(80);
        expect(scoredContext.issues.map((scoredIssue) => scoredIssue.confidence)).toEqual([90, 60]);
        expect(scoredContext.issues.map((scoredIssue) => scoredIssue.verification)).toEqual(['confirmed', 'confirmed']);
    });

    it('downgrades an UNCERTAIN issue to WARNING with a confidence annotation', async () => {
        const uncertainContext = buildPipelineContext({
            issues: [buildReviewIssue({ severity: 'CRITICAL' })],
            cascade: buildCascadeState({
                verdicts: [buildClaimVerdict({
                    claimId: 'c1', verdict: 'UNCERTAIN', confidence: 58, phase: 'pro-verify',
                })],
                escalationClaimIds: ['c1'],
                escalated: true,
            }),
        });

        const scoredContext = await integrityScorerStep.execute(uncertainContext);

        expect(scoredContext.issues[0].severity).toBe('WARNING');
        // Ohne Verifier-Zahl: sie misst Verdikt-Konfidenz, würde aber als
        // Befund-Konfidenz gelesen (B2b: "Reduced confidence (100/100)" live
        // auf einem UNCERTAIN/100-Verdict gesichtet, 2026-08-31).
        expect(scoredContext.issues[0].critique).toContain('remained uncertain');
        expect(scoredContext.issues[0].critique).not.toContain('58/100');
        // Die Verifier-Zahl misst Konfidenz ins Verdikt — als Befund-Konfidenz
        // ist ein unentschiedenes Urteil ein Münzwurf (SPEC §6, 2026-09-17).
        expect(scoredContext.issues[0].confidence).toBe(50);
        expect(scoredContext.issues[0].verification).toBe('uncertain');
        expect(scoredContext.cascade.integrityScore).toBe(50);
    });

    it('never scores an UNCERTAIN/100 verdict as a perfect 100 (ROADMAP To-Do §3)', async () => {
        // Live gesichtet: der Verifier war sich zu 100 % sicher, dass der Fall
        // unklar ist — und der Score meldete "100/100, every finding survived".
        const uncertainButConfidentContext = buildPipelineContext({
            issues: [
                buildReviewIssue({ severity: 'CRITICAL' }),
                buildReviewIssue({ severity: 'CRITICAL', line: 50 }),
            ],
            cascade: buildCascadeState({
                verdicts: [
                    buildClaimVerdict({ claimId: 'c1', verdict: 'CONFIRMED', confidence: 100 }),
                    buildClaimVerdict({ claimId: 'c2', verdict: 'UNCERTAIN', confidence: 100 }),
                ],
            }),
        });

        const scoredContext = await integrityScorerStep.execute(uncertainButConfidentContext);

        // CONFIRMED/100 (CRITICAL ×2) + UNCERTAIN→50 (WARNING ×1) = 250/3 ≈ 83.
        expect(scoredContext.cascade.integrityScore).toBe(83);
        expect(scoredContext.issues.map((scoredIssue) => scoredIssue.verification))
            .toEqual(['confirmed', 'uncertain']);
    });

    it('downgrades escalation-marked issues when Pro never ran (budget or API degraded)', async () => {
        const escalationSkippedContext = buildPipelineContext({
            issues: [buildReviewIssue({ severity: 'CRITICAL' })],
            cascade: buildCascadeState({
                verdicts: [buildClaimVerdict({ claimId: 'c1', verdict: 'CONFIRMED', confidence: 55 })],
                escalationClaimIds: ['c1'],
                escalated: false,
                degradations: ['pro_budget_exhausted'],
            }),
        });

        const scoredContext = await integrityScorerStep.execute(escalationSkippedContext);

        expect(scoredContext.issues[0].severity).toBe('WARNING');
        expect(scoredContext.issues[0].critique).toContain('escalation was skipped');
        expect(scoredContext.issues[0].confidence).toBe(55);
        expect(scoredContext.issues[0].verification).toBe('unverified');
    });

    it('never renders the paradoxical "Reduced confidence (100/100)" on the skip path (B2)', async () => {
        // F5-Befund 2026-08-31: ein CONFIRMED/100-Verdict, dessen Pro-Eskalation
        // nie lief, wurde als "⚠️ Reduced confidence (100/100)" annotiert —
        // Label und Zahl widersprachen sich. Der Skip-Pfad nennt jetzt den
        // Grund und lässt die Verifier-Zahl weg.
        const confirmedButSkippedContext = buildPipelineContext({
            issues: [buildReviewIssue({ severity: 'CRITICAL' })],
            cascade: buildCascadeState({
                verdicts: [buildClaimVerdict({ claimId: 'c1', verdict: 'CONFIRMED', confidence: 100 })],
                escalationClaimIds: ['c1'],
                escalated: false,
                degradations: ['pro_budget_exhausted'],
            }),
        });

        const scoredContext = await integrityScorerStep.execute(confirmedButSkippedContext);

        expect(scoredContext.issues[0].severity).toBe('WARNING');
        expect(scoredContext.issues[0].critique).toContain('escalation was skipped');
        expect(scoredContext.issues[0].critique).not.toContain('100/100');
        expect(scoredContext.issues[0].critique).not.toContain('Reduced confidence');
    });

    it('scores the pro-direct route from the self-reported issue confidences', async () => {
        const proDirectContext = buildPipelineContext({
            issues: [
                buildReviewIssue({ severity: 'CRITICAL', confidence: 100 }),
                buildReviewIssue({ severity: 'WARNING', line: 50, confidence: 70 }),
            ],
            cascade: buildCascadeState({
                route: 'pro-direct',
                escalated: true,
                escalationReason: 'complexity_heuristic',
            }),
        });

        const scoredContext = await integrityScorerStep.execute(proDirectContext);

        expect(scoredContext.cascade.integrityScore).toBe(90);
        expect(scoredContext.issues).toHaveLength(2);
        // Keine Blind-Verifikation auf pro-direct — die Tagline darf sie nicht behaupten.
        expect(scoredContext.issues.map((scoredIssue) => scoredIssue.verification))
            .toEqual(['self_reported', 'self_reported']);
    });

    it('passes an aborted pipeline through untouched', async () => {
        const abortedContext = buildPipelineContext({ shouldAbort: true, abortReason: 'No reviewable files.' });

        const scoredContext = await integrityScorerStep.execute(abortedContext);

        expect(scoredContext).toBe(abortedContext);
    });
});
