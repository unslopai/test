/**
 * Deckel für wiederholte Treffer derselben Regel (LANGUAGE_COVERAGE_SPEC §8, E4).
 */
import { describe, expect, it } from 'vitest';
import { buildReviewIssue } from '@/lib/pipeline/testing/context-fixture';
import { capRepeatedRuleHits } from '@/lib/pipeline/prescan-hit-cap';
import type { PipelineIssue } from '@/lib/pipeline/types';

function buildManifestHit(manifestIndex: number, overrides: Partial<PipelineIssue> = {}): PipelineIssue {
    return buildReviewIssue({
        rule: 'INFRA-002 (Container may run as root)',
        severity: 'WARNING',
        path: `manifests/deployment-${manifestIndex}.yaml`,
        line: 10 + manifestIndex,
        source: 'pre-scanner',
        critique: 'The pod spec does not set runAsNonRoot.',
        fixedCodeSnippet: 'runAsNonRoot: true',
        ...overrides,
    });
}

describe('capRepeatedRuleHits', () => {
    it('keeps the first three hits and folds the rest into one finding that names every location', () => {
        const sixHits = [1, 2, 3, 4, 5, 6].map((manifestIndex) => buildManifestHit(manifestIndex));

        const cappedIssues = capRepeatedRuleHits(sixHits);

        expect(cappedIssues).toHaveLength(4);
        expect(cappedIssues.slice(0, 3)).toEqual(sixHits.slice(0, 3));
        const collapsedIssue = cappedIssues[3];
        expect(collapsedIssue.path).toBe('manifests/deployment-4.yaml');
        expect(collapsedIssue.critique).toContain('matched 6 times');
        expect(collapsedIssue.critique).toContain(
            'remaining 3: manifests/deployment-4.yaml:14, manifests/deployment-5.yaml:15, manifests/deployment-6.yaml:16.',
        );
        expect(collapsedIssue.fixedCodeSnippet).toBeUndefined();
    });

    it('leaves three hits of a rule untouched and keeps the original order across rules', () => {
        const secretFinding = buildReviewIssue({ rule: 'SEC-005 (Hardcoded secret)', source: 'pre-scanner' });
        const mixedIssues = [buildManifestHit(1), secretFinding, buildManifestHit(2), buildManifestHit(3)];

        expect(capRepeatedRuleHits(mixedIssues)).toEqual(mixedIssues);
    });

    it('never folds a CRITICAL into a WARNING group of the same rule', () => {
        const warningHits = [1, 2, 3, 4].map((manifestIndex) => buildManifestHit(manifestIndex));
        const criticalHit = buildManifestHit(9, { severity: 'CRITICAL' });

        const cappedIssues = capRepeatedRuleHits([...warningHits, criticalHit]);

        expect(cappedIssues.filter((cappedIssue) => cappedIssue.severity === 'CRITICAL')).toEqual([criticalHit]);
    });
});
