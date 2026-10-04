/**
 * Deckel für wiederholte Treffer derselben Regel (LANGUAGE_COVERAGE_SPEC §8, E4):
 * gekürzt wird die Darstellung — Dedupe und Zählungen sehen weiter jeden Treffer.
 */
import { describe, expect, it } from 'vitest';
import { buildPipelineContext, buildReviewIssue } from '@/lib/pipeline/testing/context-fixture';
import { collectReportableIssues } from '@/lib/pipeline/helpers';
import { capRepeatedRuleHits, countHitsBySeverity } from '@/lib/pipeline/prescan-hit-cap';
import type { PipelineIssue } from '@/lib/pipeline/types';

function buildManifestHit(manifestIndex: number, overrides: Partial<PipelineIssue> = {}): PipelineIssue {
    return buildReviewIssue({
        rule: 'INFRA-002 (Container may run as root)',
        severity: 'WARNING',
        path: `manifests/deployment-${manifestIndex}.yaml`,
        line: 10 + manifestIndex,
        endLine: 10 + manifestIndex,
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

    it('records every location the collapsed finding stands for, its own anchor first', () => {
        const sixHits = [1, 2, 3, 4, 5, 6].map((manifestIndex) => buildManifestHit(manifestIndex));

        const collapsedIssue = capRepeatedRuleHits(sixHits)[3];

        expect(collapsedIssue.cappedHits).toEqual([
            { path: 'manifests/deployment-4.yaml', line: 14, endLine: 14 },
            { path: 'manifests/deployment-5.yaml', line: 15, endLine: 15 },
            { path: 'manifests/deployment-6.yaml', line: 16, endLine: 16 },
        ]);
    });
});

describe('countHitsBySeverity', () => {
    it('counts the hits behind a collapsed finding, not the entries', () => {
        const criticalHits = Array.from({ length: 10 }, (_, manifestIndex) => buildManifestHit(manifestIndex, { severity: 'CRITICAL' }));
        const cappedIssues = capRepeatedRuleHits([...criticalHits, buildManifestHit(20, { rule: 'INFRA-007 (No resource limits)' })]);

        expect(cappedIssues).toHaveLength(5);
        expect(countHitsBySeverity(cappedIssues)).toEqual({ criticalCount: 10, warningCount: 1, totalCount: 11 });
    });
});

describe('collectReportableIssues — dedupe against capped hits (E4)', () => {
    it('drops an LLM finding of the same rule at hit 5, which only the collapsed finding covers', () => {
        const sixPrescanHits = [1, 2, 3, 4, 5, 6].map((manifestIndex) => buildManifestHit(manifestIndex));
        const llmFindingAtHitFive = buildReviewIssue({
            rule: 'INFRA-002 (Container may run as root)',
            severity: 'WARNING',
            path: 'manifests/deployment-5.yaml',
            line: 15,
            endLine: 15,
            source: 'draft-reviewer',
            fixedCodeSnippet: 'securityContext:\n  runAsNonRoot: true',
        });

        const reportableIssues = collectReportableIssues(buildPipelineContext({
            issues: [llmFindingAtHitFive],
            prescanIssues: capRepeatedRuleHits(sixPrescanHits),
        }));

        expect(reportableIssues).toHaveLength(4);
        expect(reportableIssues.every((reportableIssue) => reportableIssue.source === 'pre-scanner')).toBe(true);
    });

    it('keeps an LLM finding of the same rule at a location no pre-scanner hit covers', () => {
        const sixPrescanHits = [1, 2, 3, 4, 5, 6].map((manifestIndex) => buildManifestHit(manifestIndex));
        const llmFindingElsewhere = buildReviewIssue({
            rule: 'INFRA-002 (Container may run as root)',
            path: 'manifests/deployment-5.yaml',
            line: 40,
            endLine: 40,
            source: 'draft-reviewer',
        });

        const reportableIssues = collectReportableIssues(buildPipelineContext({
            issues: [llmFindingElsewhere],
            prescanIssues: capRepeatedRuleHits(sixPrescanHits),
        }));

        expect(reportableIssues).toHaveLength(5);
    });
});
