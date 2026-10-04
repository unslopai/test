/**
 * Produktionspfad-Plan des Rule-Recall-Benchmarks (LANGUAGE_COVERAGE_SPEC §7.1):
 * derselbe Filter und derselbe Abbruch wie im Webhook-Pfad.
 */
import { describe, expect, it } from 'vitest';
import {
    planModelPotentialPath,
    planProductionPath,
    resolveProductionLane,
} from '@/lib/benchmark/production-path';
import { buildPullRequestFile } from '@/lib/pipeline/testing/context-fixture';

const typescriptFile = buildPullRequestFile({ filename: 'src/agent/tool-runner.ts' });
const pythonFile = buildPullRequestFile({ filename: 'agent/tools/code_runner.py' });

describe('planProductionPath', () => {
    it('gives the model only reviewable files and the pre-scanner every file of a mixed fixture', () => {
        const mixedPlan = planProductionPath([typescriptFile, pythonFile]);

        expect(mixedPlan.aborted).toBe(false);
        expect(mixedPlan.reviewableFiles).toEqual([typescriptFile]);
        expect(resolveProductionLane(typescriptFile.filename, mixedPlan)).toBe('model-and-prescan');
        expect(resolveProductionLane(pythonFile.filename, mixedPlan)).toBe('prescan-only');
    });

    it('gives a fixture without a reviewable file to the pre-scanner only (stage 1)', () => {
        const pythonOnlyPlan = planProductionPath([pythonFile]);

        expect(pythonOnlyPlan.aborted).toBe(false);
        expect(pythonOnlyPlan.reviewableFiles).toEqual([]);
        expect(resolveProductionLane(pythonFile.filename, pythonOnlyPlan)).toBe('prescan-only');
    });

    it('aborts a docs-only fixture: no lane scans it', () => {
        const markdownFile = buildPullRequestFile({ filename: 'docs/CHANGELOG.md' });
        const docsOnlyPlan = planProductionPath([markdownFile]);

        expect(docsOnlyPlan.aborted).toBe(true);
        expect(docsOnlyPlan.prescanFiles).toEqual([]);
        expect(resolveProductionLane(markdownFile.filename, docsOnlyPlan)).toBe('not-scanned');
    });
});

describe('planModelPotentialPath', () => {
    it('hands every file to both lanes (--bypass-filter)', () => {
        const potentialPlan = planModelPotentialPath([pythonFile]);

        expect(potentialPlan.aborted).toBe(false);
        expect(potentialPlan.reviewableFiles).toEqual([pythonFile]);
        expect(potentialPlan.prescanFiles).toEqual([pythonFile]);
    });
});
