/**
 * Unit Tests: Check-Run-Urteil (GITHUB_APP_SPEC.md D3).
 *
 * Kern-Invariante des Gatings: NUR ein CRITICAL-Finding blockiert den Merge.
 * WARNINGs sind beratend — ein Gatekeeper, der jeden Stilhinweis zum
 * Merge-Blocker macht, wird vom Team abgeschaltet, und dann schützt er nichts mehr.
 */
import { describe, expect, it } from 'vitest';
import { deriveReviewConclusion } from '@/lib/check-run';
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
