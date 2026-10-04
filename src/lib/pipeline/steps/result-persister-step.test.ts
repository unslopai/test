/**
 * ResultPersisterStep-Tests — Re-roll-Buchführung (MCP_SPEC.md §4.5/§10):
 * identisches Open-Finding-Set inkrementiert, jede Änderung resettet,
 * ein sauberer Lauf resettet, Lookup-Fehler degradieren fail-soft.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPipelineContext, buildPullRequestFile, buildReviewIssue } from '@/lib/pipeline/testing/context-fixture';

const { terminalUpdateMock, terminalUpdateEqMock, previousJobMaybeSingleMock } = vi.hoisted(() => ({
    terminalUpdateMock: vi.fn(),
    terminalUpdateEqMock: vi.fn(),
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
        previousJobMaybeSingleMock.mockReset();
        terminalUpdateMock.mockImplementation(() => ({ eq: terminalUpdateEqMock }));
        terminalUpdateEqMock.mockResolvedValue({ error: null });
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
