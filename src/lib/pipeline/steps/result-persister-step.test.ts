/**
 * ResultPersisterStep-Tests — Re-roll-Buchführung (MCP_SPEC.md §4.5/§10):
 * identisches Open-Finding-Set inkrementiert, jede Änderung resettet,
 * ein sauberer Lauf resettet, Lookup-Fehler degradieren fail-soft.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildCascadeState,
    buildPipelineContext,
    buildPullRequestFile,
    buildReviewIssue,
} from '@/lib/pipeline/testing/context-fixture';

const {
    terminalUpdateMock,
    terminalUpdateEqMock,
    statusGuardEqMock,
    terminalSelectMock,
    previousJobMaybeSingleMock,
} = vi.hoisted(() => ({
    terminalUpdateMock: vi.fn(),
    terminalUpdateEqMock: vi.fn(),
    statusGuardEqMock: vi.fn(),
    terminalSelectMock: vi.fn(),
    previousJobMaybeSingleMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({
            update: terminalUpdateMock,
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        neq: () => ({
                            order: () => ({
                                limit: () => ({ maybeSingle: previousJobMaybeSingleMock }),
                            }),
                        }),
                    }),
                }),
            }),
        }),
    },
}));

const { resultPersisterStep } = await import('@/lib/pipeline/steps/result-persister-step');

interface TerminalUpdatePayload {
    unresolved_fingerprint: string | null;
    reroll_count: number;
    result: {
        review: {
            issues: {
                id?: string;
                occurrences?: readonly { line: number; endLine: number; exactQuote: string }[];
            }[];
            summary: string;
        };
        files_reviewed: number;
        nothing_reviewed: boolean;
        omitted_files: readonly string[];
    };
}

function capturedUpdatePayload(callIndex = 0): TerminalUpdatePayload {
    return terminalUpdateMock.mock.calls[callIndex][0] as TerminalUpdatePayload;
}

describe('resultPersisterStep — re-roll bookkeeping (MCP_SPEC §4.5)', () => {
    beforeEach(() => {
        terminalUpdateMock.mockReset();
        terminalUpdateEqMock.mockReset();
        statusGuardEqMock.mockReset();
        terminalSelectMock.mockReset();
        previousJobMaybeSingleMock.mockReset();
        terminalUpdateMock.mockImplementation(() => ({ eq: terminalUpdateEqMock }));
        terminalUpdateEqMock.mockImplementation(() => ({ eq: statusGuardEqMock }));
        statusGuardEqMock.mockImplementation(() => ({ select: terminalSelectMock }));
        terminalSelectMock.mockResolvedValue({ data: [{ id: 'job-under-test' }], error: null });
        previousJobMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    });

    const openFindingContext = () => buildPipelineContext({
        issues: [buildReviewIssue({ rule: 'ARCH-002 (Strict Validation Boundary)' })],
    });

    it('persists issues with stable finding ids and a fingerprint on the first run', async () => {
        await resultPersisterStep.execute(openFindingContext());

        const updatePayload = capturedUpdatePayload();
        expect(updatePayload.result.review.issues[0].id).toMatch(/^[0-9a-f]{16}$/);
        expect(updatePayload.unresolved_fingerprint).toMatch(/^[0-9a-f]{64}$/);
        expect(updatePayload.reroll_count).toBe(0);
    });

    it('persistiert die occurrences eines Aggregats unverändert, mit stabiler Anker-ID (ROADMAP §7)', async () => {
        const aggregatedOccurrences = [
            { line: 12, endLine: 12, exactQuote: '// 🚀 blazing' },
            { line: 18, endLine: 18, exactQuote: '// ✨ magic' },
        ];
        await resultPersisterStep.execute(buildPipelineContext({
            issues: [buildReviewIssue({
                line: 12,
                endLine: 12,
                exactQuote: '// 🚀 blazing',
                occurrences: aggregatedOccurrences,
            })],
        }));

        const [persistedIssue] = capturedUpdatePayload().result.review.issues;
        expect(persistedIssue.occurrences).toEqual(aggregatedOccurrences);
        expect(persistedIssue.id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('increments reroll_count when the previous job carries the identical fingerprint', async () => {
        await resultPersisterStep.execute(openFindingContext());
        const firstRunFingerprint = capturedUpdatePayload().unresolved_fingerprint;

        previousJobMaybeSingleMock.mockResolvedValue({
            data: { unresolved_fingerprint: firstRunFingerprint, reroll_count: 2 },
            error: null,
        });
        await resultPersisterStep.execute(openFindingContext());

        expect(capturedUpdatePayload(1).unresolved_fingerprint).toBe(firstRunFingerprint);
        expect(capturedUpdatePayload(1).reroll_count).toBe(3);
    });

    it('resets reroll_count to 0 when the open-finding set changed', async () => {
        previousJobMaybeSingleMock.mockResolvedValue({
            data: { unresolved_fingerprint: 'fingerprint-of-a-different-set', reroll_count: 4 },
            error: null,
        });

        await resultPersisterStep.execute(openFindingContext());

        expect(capturedUpdatePayload().reroll_count).toBe(0);
    });

    it('resets to a null fingerprint on a clean run — zero findings are progress', async () => {
        await resultPersisterStep.execute(buildPipelineContext({ issues: [], prescanIssues: [] }));

        expect(capturedUpdatePayload().unresolved_fingerprint).toBeNull();
        expect(capturedUpdatePayload().reroll_count).toBe(0);
        expect(previousJobMaybeSingleMock).not.toHaveBeenCalled();
    });

    it('degrades to count 0 when the previous-job lookup errors (fail-soft, terminal write intact)', async () => {
        previousJobMaybeSingleMock.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

        await resultPersisterStep.execute(openFindingContext());

        expect(capturedUpdatePayload().unresolved_fingerprint).toMatch(/^[0-9a-f]{64}$/);
        expect(capturedUpdatePayload().reroll_count).toBe(0);
        expect(terminalUpdateEqMock).toHaveBeenCalledWith('id', 'job-under-test');
    });

    it('marks an aborted run as nothing_reviewed with the omitted files (ROADMAP §3)', async () => {
        await resultPersisterStep.execute(buildPipelineContext({
            shouldAbort: true,
            abortReason: 'All changed code files exceed the review size cap.',
            omittedFiles: ['src/lib/huge-a.ts', 'src/lib/huge-b.ts'],
        }));

        const persistedResult = capturedUpdatePayload().result;
        expect(persistedResult.nothing_reviewed).toBe(true);
        expect(persistedResult.files_reviewed).toBe(0);
        expect(persistedResult.omitted_files).toEqual(['src/lib/huge-a.ts', 'src/lib/huge-b.ts']);
        expect(persistedResult.review.summary).toBe('All changed code files exceed the review size cap.');
    });

    it('marks a completed review as reviewed (nothing_reviewed false)', async () => {
        await resultPersisterStep.execute(buildPipelineContext({
            reviewableFiles: [buildPullRequestFile()],
            issues: [],
            prescanIssues: [],
        }));

        const persistedResult = capturedUpdatePayload().result;
        expect(persistedResult.nothing_reviewed).toBe(false);
        expect(persistedResult.files_reviewed).toBe(1);
    });

    it('writes no fingerprint in the abort path', async () => {
        await resultPersisterStep.execute(buildPipelineContext({
            shouldAbort: true,
            abortReason: 'diff loading failed',
            issues: [buildReviewIssue()],
        }));

        expect(capturedUpdatePayload().unresolved_fingerprint).toBeNull();
        expect(capturedUpdatePayload().reroll_count).toBe(0);
    });
});

describe('resultPersisterStep — degradations im result (DEADLINE_GUARD_SPEC D6)', () => {
    beforeEach(() => {
        terminalUpdateMock.mockReset();
        terminalUpdateMock.mockImplementation(() => ({ eq: terminalUpdateEqMock }));
        terminalUpdateEqMock.mockImplementation(() => ({ eq: statusGuardEqMock }));
        statusGuardEqMock.mockImplementation(() => ({ select: terminalSelectMock }));
        terminalSelectMock.mockResolvedValue({ data: [{ id: 'job-under-test' }], error: null });
        previousJobMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    });

    it('persistiert Degradationen und übersprungene Stufen statt sie nur im Review-Text zu erwähnen', async () => {
        await resultPersisterStep.execute(buildPipelineContext({
            cascade: buildCascadeState({
                degradations: ['cache_fallback', 'time_budget_exhausted'],
                skippedStages: ['second_opinion', 'escalation'],
            }),
        }));

        const persistedResult = terminalUpdateMock.mock.calls[0][0].result;
        expect(persistedResult.degradations).toEqual(['cache_fallback', 'time_budget_exhausted']);
        expect(persistedResult.skipped_stages).toEqual(['second_opinion', 'escalation']);
        expect(persistedResult.draft_unreviewed_files).toEqual([]);
    });

    it('persistiert die Dateien gescheiterter Draft-Batches (draft_partial, LARGE_DIFF_RECALL_SPEC §9)', async () => {
        await resultPersisterStep.execute(buildPipelineContext({
            cascade: buildCascadeState({
                degradations: ['draft_partial'],
                draftUnreviewedFiles: ['src/lib/alpha.ts', 'src/lib/beta.ts'],
            }),
        }));

        const persistedResult = terminalUpdateMock.mock.calls[0][0].result;
        expect(persistedResult.degradations).toEqual(['draft_partial']);
        expect(persistedResult.draft_unreviewed_files).toEqual(['src/lib/alpha.ts', 'src/lib/beta.ts']);
    });
});

describe('resultPersisterStep — Summary aus den tatsächlichen Findings (LANGUAGE_COVERAGE_SPEC §5, Befund b)', () => {
    beforeEach(() => {
        terminalUpdateMock.mockReset();
        terminalUpdateMock.mockImplementation(() => ({ eq: terminalUpdateEqMock }));
        terminalUpdateEqMock.mockImplementation(() => ({ eq: statusGuardEqMock }));
        statusGuardEqMock.mockImplementation(() => ({ select: terminalSelectMock }));
        terminalSelectMock.mockResolvedValue({ data: [{ id: 'job-under-test' }], error: null });
        previousJobMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    });

    const sqlInterpolationFinding = buildReviewIssue({
        rule: 'SEC-004 (SQL built by string interpolation)',
        severity: 'CRITICAL',
        path: 'src/lib/user-lookup.ts',
        line: 5,
        endLine: 5,
        source: 'pre-scanner',
    });

    it('Replay Job 3f26b2da: nennt das CRITICAL des Pre-Scanners statt "No AI slop found."', async () => {
        await resultPersisterStep.execute(buildPipelineContext({
            reviewableFiles: [buildPullRequestFile({ filename: 'src/lib/user-lookup.ts' })],
            reviewSummary: 'No AI slop found.',
            issues: [],
            prescanIssues: [sqlInterpolationFinding],
        }));

        expect(capturedUpdatePayload().result.review.summary).toBe(
            'The deterministic pre-scanner found 1 critical and 0 warning findings. '
            + 'The model review reported no further findings.',
        );
    });

    it('hängt die deterministischen Findings an eine Modell-Summary mit eigenen Findings an', async () => {
        await resultPersisterStep.execute(buildPipelineContext({
            reviewSummary: 'Found 1 critical naming issue.',
            issues: [buildReviewIssue()],
            prescanIssues: [sqlInterpolationFinding],
        }));

        expect(capturedUpdatePayload().result.review.summary).toBe(
            'Found 1 critical naming issue. The deterministic pre-scanner found 1 critical and 0 warning findings.',
        );
    });

    it('lässt die Summary eines Laufs ohne Findings und die Short-Circuit-Summary unverändert', async () => {
        await resultPersisterStep.execute(buildPipelineContext({ reviewSummary: '' }));
        await resultPersisterStep.execute(buildPipelineContext({
            reviewSummary: 'LLM review skipped: 1 critical structural violations found by the deterministic pre-scanner. Fix these first.',
            llmSkipped: true,
            prescanIssues: [sqlInterpolationFinding],
        }));

        expect(capturedUpdatePayload(0).result.review.summary).toBe('No AI slop found.');
        expect(capturedUpdatePayload(1).result.review.summary).toContain('LLM review skipped');
    });
});

describe('resultPersisterStep — status guard (DEADLINE_GUARD_SPEC D9)', () => {
    beforeEach(() => {
        terminalUpdateMock.mockReset();
        terminalUpdateMock.mockImplementation(() => ({ eq: terminalUpdateEqMock }));
        terminalUpdateEqMock.mockImplementation(() => ({ eq: statusGuardEqMock }));
        statusGuardEqMock.mockImplementation(() => ({ select: terminalSelectMock }));
        previousJobMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    });

    it('only finalizes a job that is still processing', async () => {
        terminalSelectMock.mockResolvedValue({ data: [{ id: 'job-under-test' }], error: null });

        await resultPersisterStep.execute(buildPipelineContext());

        expect(statusGuardEqMock).toHaveBeenCalledWith('status', 'processing');
    });

    it('meldet einen bereits finalisierten Job, statt still Erfolg zu melden', async () => {
        terminalSelectMock.mockResolvedValue({ data: [], error: null });

        await expect(resultPersisterStep.execute(buildPipelineContext({ issues: [buildReviewIssue()] })))
            .rejects.toMatchObject({ name: 'JobAlreadyFinalizedError' });
    });
});
