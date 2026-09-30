/**
 * Abbruchpfade ohne reviewbare Datei (LANGUAGE_COVERAGE_SPEC §6.4, Gate G4):
 * nur Markdown bleibt „Nothing to review“, nur Python wird „nur deterministisch
 * geprüft“, der Größen-Cap-Abbruch bleibt unverändert, der Kill-Switch stellt
 * das alte Verhalten wieder her.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPipelineContext, buildPullRequestFile } from '@/lib/pipeline/testing/context-fixture';
import {
    describeNothingReviewed,
    isPrescanScannable,
    planUnreviewableDiff,
    resolveReviewOutcome,
} from '@/lib/pipeline/review-scope';
import type { PrescanStats } from '@unslop/prescan';

const pythonFile = buildPullRequestFile({ filename: 'services/report_job.py' });
const markdownFile = buildPullRequestFile({ filename: 'docs/CHANGELOG.md' });

const COMPLETED_PRESCAN: PrescanStats = {
    degraded: false,
    degradedReason: null,
    findingsCount: 0,
    criticalCount: 0,
    rulesEvaluated: 42,
    rulesDisabled: [],
    filesScanned: 1,
    filesSkipped: [],
    skippedChecks: [],
    llmSkipped: true,
    durationMs: 120,
    engineVersions: null,
};

describe('planUnreviewableDiff', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('keeps a docs-only pull request at "Nothing to review" (E3)', () => {
        const docsOnlyPlan = planUnreviewableDiff({
            changedFiles: [markdownFile], omittedFilePaths: [], surface: 'pull_request',
        });

        expect(docsOnlyPlan).toEqual({
            shouldAbort: true,
            abortReason: 'No reviewable code files in this pull request.',
            llmSkipped: false,
        });
    });

    it('runs the pre-scanner without a model when the diff only has Python', () => {
        const pythonOnlyPlan = planUnreviewableDiff({
            changedFiles: [pythonFile, markdownFile], omittedFilePaths: [], surface: 'pull_request',
        });

        expect(pythonOnlyPlan.shouldAbort).toBe(false);
        expect(pythonOnlyPlan.llmSkipped).toBe(true);
        expect(pythonOnlyPlan.deterministicOnlyReason).toContain('no model reviewed it');
    });

    it('tells a local diff that only regex and registry rules ran', () => {
        const localDiffPlan = planUnreviewableDiff({
            changedFiles: [pythonFile], omittedFilePaths: [], surface: 'local_diff',
        });

        expect(localDiffPlan.deterministicOnlyReason).toContain('only the regex and registry rules ran');
        expect(localDiffPlan.abortReason).toBe('No reviewable code files in this diff.');
    });

    it('leaves the size-cap abort unchanged, even next to a Python file', () => {
        const sizeCapPlan = planUnreviewableDiff({
            changedFiles: [pythonFile], omittedFilePaths: ['src/lib/huge.ts'], surface: 'pull_request',
        });

        expect(sizeCapPlan).toEqual({
            shouldAbort: true,
            abortReason: 'All changed code files exceed the review size cap.',
            llmSkipped: false,
        });
    });

    it('does not count removed, patchless or generated files as something to scan', () => {
        const nothingScannablePlan = planUnreviewableDiff({
            changedFiles: [
                buildPullRequestFile({ filename: 'services/old_job.py', status: 'removed' }),
                buildPullRequestFile({ filename: 'assets/data.json', patch: undefined }),
                buildPullRequestFile({ filename: 'package-lock.json' }),
            ],
            omittedFilePaths: [],
            surface: 'pull_request',
        });

        expect(nothingScannablePlan.shouldAbort).toBe(true);
    });

    it('aborts like before stage 1 when UNSLOP_PRESCAN_ONLY_REVIEW=off (kill switch, §6.3)', () => {
        vi.stubEnv('UNSLOP_PRESCAN_ONLY_REVIEW', 'off');

        const killSwitchPlan = planUnreviewableDiff({
            changedFiles: [pythonFile], omittedFilePaths: [], surface: 'pull_request',
        });

        expect(killSwitchPlan.shouldAbort).toBe(true);
        expect(killSwitchPlan.deterministicOnlyReason).toBeUndefined();
    });
});

describe('resolveReviewOutcome', () => {
    const deterministicOnlyContext = buildPipelineContext({
        llmSkipped: true,
        deterministicOnlyReason: 'Deterministic checks only: no model reviewed it.',
        prescanStats: COMPLETED_PRESCAN,
    });

    it('is deterministic_only only when the pre-scanner actually completed', () => {
        expect(resolveReviewOutcome(deterministicOnlyContext)).toBe('deterministic_only');
        // Step per pipeline_config abgeschaltet (§6.3) oder im Fail-Safe degradiert.
        expect(resolveReviewOutcome({ ...deterministicOnlyContext, prescanStats: null })).toBe('nothing_reviewed');
        expect(resolveReviewOutcome({
            ...deterministicOnlyContext,
            prescanStats: { ...COMPLETED_PRESCAN, degraded: true, degradedReason: 'internal route timeout' },
        })).toBe('nothing_reviewed');
    });

    it('keeps reviewed and aborted runs as they were', () => {
        expect(resolveReviewOutcome(buildPipelineContext())).toBe('reviewed');
        expect(resolveReviewOutcome(buildPipelineContext({ shouldAbort: true }))).toBe('nothing_reviewed');
    });

    it('is never deterministic_only when the pre-scanner checked no file (only lane file over maxFileBytes)', () => {
        const nothingScannedContext = {
            ...deterministicOnlyContext,
            prescanStats: {
                ...COMPLETED_PRESCAN,
                filesScanned: 0,
                filesSkipped: [{ path: 'services/huge_report.py', reason: 'size-cap' as const }],
            },
        };

        expect(resolveReviewOutcome(nothingScannedContext)).toBe('nothing_reviewed');
    });
});

describe('isPrescanScannable — lockfiles (LANGUAGE_COVERAGE_SPEC §6.2)', () => {
    const LOCKFILE_PATHS = [
        'package-lock.json', 'npm-shrinkwrap.json', 'apps/web/pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb',
        'poetry.lock', 'Pipfile.lock', 'crates/core/Cargo.lock', 'go.sum', 'composer.lock', 'Gemfile.lock',
    ];

    it('excludes every common lockfile from the pre-scan path filter', () => {
        for (const lockfilePath of LOCKFILE_PATHS) {
            expect(isPrescanScannable(buildPullRequestFile({ filename: lockfilePath })), lockfilePath).toBe(false);
        }
        expect(isPrescanScannable(buildPullRequestFile({ filename: 'config/lock-settings.yaml' }))).toBe(true);
    });

    it('keeps a lockfile-only pull request (Renovate) at "Nothing to review"', () => {
        const lockfileOnlyPlan = planUnreviewableDiff({
            changedFiles: LOCKFILE_PATHS.map((lockfilePath) => buildPullRequestFile({ filename: lockfilePath })),
            omittedFilePaths: [],
            surface: 'pull_request',
        });

        expect(lockfileOnlyPlan.shouldAbort).toBe(true);
        expect(lockfileOnlyPlan.deterministicOnlyReason).toBeUndefined();
    });
});

describe('describeNothingReviewed', () => {
    const plannedPrescanOnlyContext = buildPipelineContext({
        llmSkipped: true,
        abortReason: 'No reviewable code files in this pull request.',
        deterministicOnlyReason: 'Deterministic checks only: no model reviewed it.',
        prescanStats: COMPLETED_PRESCAN,
    });

    it('reports a degraded pre-scan as a failed check, not as "No reviewable code files"', () => {
        const nothingReviewedNotice = describeNothingReviewed({
            ...plannedPrescanOnlyContext,
            prescanStats: { ...COMPLETED_PRESCAN, filesScanned: 0, degraded: true, degradedReason: 'internal route timeout' },
        });

        expect(nothingReviewedNotice.kind).toBe('check_failed');
        expect(nothingReviewedNotice.reason).toContain('pre-scanner failed');
        expect(nothingReviewedNotice.reason).not.toContain('No reviewable code files');
    });

    it('names the skipped files when the pre-scanner checked none of them', () => {
        const nothingReviewedNotice = describeNothingReviewed({
            ...plannedPrescanOnlyContext,
            prescanStats: {
                ...COMPLETED_PRESCAN,
                filesScanned: 0,
                filesSkipped: [{ path: 'services/huge_report.py', reason: 'size-cap' }],
            },
        });

        expect(nothingReviewedNotice).toEqual({
            kind: 'nothing_to_review',
            reason: 'Nothing to review: this change has no TypeScript or JavaScript file for the model review, '
                + 'and the pre-scanner checked no file (skipped: services/huge_report.py, exceeds the size cap).',
        });
    });

    it('keeps the abort reason for a docs-only pull request and for a pre-scanner switched off for the repo', () => {
        const docsOnlyContext = buildPipelineContext({ shouldAbort: true, abortReason: 'No reviewable code files in this pull request.' });

        expect(describeNothingReviewed(docsOnlyContext).reason).toBe('No reviewable code files in this pull request.');
        expect(describeNothingReviewed({ ...plannedPrescanOnlyContext, prescanStats: null })).toEqual({
            kind: 'nothing_to_review',
            reason: 'No reviewable code files in this pull request.',
        });
    });
});
