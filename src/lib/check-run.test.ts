/**
 * Unit Tests: Check-Run-Urteil (GITHUB_APP_SPEC.md D3).
 *
 * Kern-Invariante des Gatings: NUR ein CRITICAL-Finding blockiert den Merge.
 * WARNINGs sind beratend — ein Gatekeeper, der jeden Stilhinweis zum
 * Merge-Blocker macht, wird vom Team abgeschaltet, und dann schützt er nichts mehr.
 */
import { describe, expect, it } from 'vitest';
import { deriveDeterministicOnlyConclusion, deriveReviewConclusion, markCheckRunAiGenerated } from '@/lib/check-run';
import { FAILED_CHECK_RUN_COPY } from '@/lib/job-failure';
import { capRepeatedRuleHits } from '@/lib/pipeline/prescan-hit-cap';
import { buildReviewIssue } from '@/lib/pipeline/testing/context-fixture';

describe('deriveReviewConclusion', () => {
    it('concludes success when there are no findings', () => {
        expect(deriveReviewConclusion([])).toMatchObject({ conclusion: 'success' });
    });

    it('fails the check as soon as one CRITICAL finding exists', () => {
        const mixedFindings = [
            buildReviewIssue({ severity: 'WARNING' }),
            buildReviewIssue({ severity: 'CRITICAL' }),
        ];

        expect(deriveReviewConclusion(mixedFindings)).toMatchObject({ conclusion: 'failure' });
    });

    it('stays neutral when every finding is advisory (no merge block)', () => {
        const advisoryFindings = [
            buildReviewIssue({ severity: 'WARNING' }),
            buildReviewIssue({ severity: 'WARNING' }),
        ];

        expect(deriveReviewConclusion(advisoryFindings)).toMatchObject({ conclusion: 'neutral' });
    });

    it('names the number of critical findings in the check title', () => {
        const criticalFindings = [
            buildReviewIssue({ severity: 'CRITICAL' }),
            buildReviewIssue({ severity: 'CRITICAL' }),
        ];

        expect(deriveReviewConclusion(criticalFindings).title).toContain('2 critical');
    });

    it('counts every hit behind a capped pre-scanner finding (E4): 10 critical stay 10', () => {
        const tenCriticalHits = Array.from({ length: 10 }, (_, hitIndex) => buildReviewIssue({
            rule: 'SEC-004 (SQL built by string interpolation)',
            path: `src/lib/queries/lookup-${hitIndex}.ts`,
            source: 'pre-scanner',
        }));
        const cappedFindings = capRepeatedRuleHits(tenCriticalHits);
        const advisoryHits = capRepeatedRuleHits(tenCriticalHits.map((hit) => ({ ...hit, severity: 'WARNING' as const })));

        expect(cappedFindings).toHaveLength(4);
        expect(deriveReviewConclusion(cappedFindings)).toMatchObject({
            title: '10 critical slop findings',
            summary: 'The Anti-Slop Gatekeeper found 10 critical and 0 non-critical finding(s). See the review comments.',
        });
        expect(deriveReviewConclusion(advisoryHits).title).toBe('10 non-critical findings');
    });
});

describe('deriveReviewConclusion — Slop Score Gating (Upcoming §6)', () => {
    it('fails the check when the score lies strictly below the threshold', () => {
        const gatedResult = deriveReviewConclusion([], {
            integrityScore: 79,
            minIntegrityScore: 80,
        });

        expect(gatedResult.conclusion).toBe('failure');
        expect(gatedResult.title).toContain('79');
        expect(gatedResult.title).toContain('80');
    });

    it('does not fail when the score meets the threshold exactly (strictly below)', () => {
        expect(deriveReviewConclusion([], {
            integrityScore: 80,
            minIntegrityScore: 80,
        })).toMatchObject({ conclusion: 'success' });
    });

    it('does not fail with the default threshold 0 — the gate is disabled', () => {
        expect(deriveReviewConclusion([], {
            integrityScore: 5,
            minIntegrityScore: 0,
        })).toMatchObject({ conclusion: 'success' });
    });

    it('keeps advisory findings neutral when the score passes the gate', () => {
        const advisoryFindings = [buildReviewIssue({ severity: 'WARNING' })];

        expect(deriveReviewConclusion(advisoryFindings, {
            integrityScore: 95,
            minIntegrityScore: 80,
        })).toMatchObject({ conclusion: 'neutral' });
    });

    it('gates advisory-only reviews too — a low score fails despite zero CRITICALs', () => {
        const advisoryFindings = [buildReviewIssue({ severity: 'WARNING' })];

        expect(deriveReviewConclusion(advisoryFindings, {
            integrityScore: 40,
            minIntegrityScore: 80,
        })).toMatchObject({ conclusion: 'failure' });
    });

    it('does not gate a null score — degraded verification has no honest score', () => {
        expect(deriveReviewConclusion([], {
            integrityScore: null,
            minIntegrityScore: 80,
        })).toMatchObject({ conclusion: 'success' });
    });

    it('keeps the CRITICAL verdict (and its title) ranked above the score gate', () => {
        const criticalFindings = [buildReviewIssue({ severity: 'CRITICAL' })];

        const criticalResult = deriveReviewConclusion(criticalFindings, {
            integrityScore: 40,
            minIntegrityScore: 80,
        });

        expect(criticalResult.conclusion).toBe('failure');
        expect(criticalResult.title).toContain('critical slop finding');
    });
});

describe('deriveDeterministicOnlyConclusion (LANGUAGE_COVERAGE_SPEC §6.2, E2)', () => {
    const deterministicOnlySummary = 'Deterministic checks only: this pull request changes no TypeScript or '
        + 'JavaScript file, so no model reviewed it. The pre-scanner checked 2 files and found nothing.';

    it('is neutral with the title "Deterministic checks only" when nothing was found — never success', () => {
        expect(deriveDeterministicOnlyConclusion([], deterministicOnlySummary)).toEqual({
            conclusion: 'neutral',
            title: 'Deterministic checks only',
            summary: deterministicOnlySummary,
        });
    });

    it('still fails on a CRITICAL and says that no model reviewed the change', () => {
        const criticalResult = deriveDeterministicOnlyConclusion(
            [buildReviewIssue({ severity: 'CRITICAL', source: 'pre-scanner' })],
            deterministicOnlySummary,
        );

        expect(criticalResult.conclusion).toBe('failure');
        expect(criticalResult.title).toBe('1 critical slop finding');
        expect(criticalResult.summary).toContain('no model reviewed it');
    });
});

describe('KI-Kennzeichnung der Check-Summary (LEGAL_PAGES_SPEC §4a.3)', () => {
    const AI_MARKER = '<!-- unslop:ai-generated -->';

    it('markCheckRunAiGenerated hängt Label und Marker an die Summary, Urteil und Titel bleiben', () => {
        const reviewResult = deriveReviewConclusion([buildReviewIssue({ severity: 'CRITICAL' })]);

        const labelledResult = markCheckRunAiGenerated(reviewResult);

        expect(labelledResult.conclusion).toBe(reviewResult.conclusion);
        expect(labelledResult.title).toBe(reviewResult.title);
        expect(labelledResult.summary.startsWith(reviewResult.summary)).toBe(true);
        expect(labelledResult.summary).toContain('_AI-generated. Check it before you rely on it._');
        expect(labelledResult.summary.endsWith(AI_MARKER)).toBe(true);
    });

    it('die Urteile selbst tragen kein Label: der Worker setzt es nur für Läufe mit Modell-Review', () => {
        const deterministicOnlyResult = deriveDeterministicOnlyConclusion(
            [buildReviewIssue({ severity: 'CRITICAL', source: 'pre-scanner', verification: 'deterministic' })],
            'Deterministic checks only: no model reviewed it.',
        );

        expect(deriveReviewConclusion([]).summary).not.toContain('AI-generated');
        expect(deterministicOnlyResult.summary).not.toContain('AI-generated');
        expect(deterministicOnlyResult.summary).not.toContain(AI_MARKER);
    });

    it('die festen Texte eines gescheiterten Checks sind nicht gekennzeichnet', () => {
        for (const failedCheckCopy of Object.values(FAILED_CHECK_RUN_COPY)) {
            expect(failedCheckCopy.summary).not.toContain('AI-generated');
            expect(failedCheckCopy.summary).not.toContain(AI_MARKER);
        }
    });
});
