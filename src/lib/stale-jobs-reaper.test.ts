/**
 * IO-Seite des Stale-Job-Reapers (DEADLINE_GUARD_SPEC.md D10): seit dem Lazy
 * Reaping laufen mehrere Reaper parallel — der Check Run eines Jobs darf nur
 * von dem Lauf geschlossen werden, der die Zeile wirklich umgestellt hat.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    processingJobsEqMock,
    reapSelectMock,
    reapStatusEqMock,
    completeCheckRunMock,
} = vi.hoisted(() => ({
    processingJobsEqMock: vi.fn(),
    reapSelectMock: vi.fn(),
    reapStatusEqMock: vi.fn(),
    completeCheckRunMock: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({ eq: processingJobsEqMock }),
            update: () => ({ eq: () => ({ eq: reapStatusEqMock }) }),
        }),
    },
}));
vi.mock('@/lib/github-app', () => ({ getInstallationToken: vi.fn(() => Promise.resolve('installation-token')) }));
vi.mock('@/lib/check-run', () => ({ completeGatekeeperCheckRun: completeCheckRunMock }));

const { reapStaleJobs } = await import('@/lib/stale-jobs');

const NOW_MS = Date.parse('2026-09-26T12:00:00.000Z');

const DEAD_JOB_ROW = {
    id: 'job-e409926e',
    updated_at: new Date(NOW_MS - 30 * 60_000).toISOString(),
    check_run_id: 4711,
    payload: { repo_full_name: 'unslopai/unslop' },
    repositories: { full_name: 'unslopai/unslop', installation_id: 146396118 },
};

describe('reapStaleJobs — parallele Lazy-Reaper (D10)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        processingJobsEqMock.mockResolvedValue({ data: [DEAD_JOB_ROW], error: null });
        reapStatusEqMock.mockImplementation(() => ({ select: reapSelectMock }));
    });

    it('schließt den Check nur in dem Lauf, der die Zeile umgestellt hat', async () => {
        reapSelectMock
            .mockResolvedValueOnce({ data: [{ id: DEAD_JOB_ROW.id }], error: null })
            .mockResolvedValueOnce({ data: [], error: null });

        const [firstOutcome, secondOutcome] = await Promise.all([
            reapStaleJobs(NOW_MS),
            reapStaleJobs(NOW_MS),
        ]);

        expect(completeCheckRunMock).toHaveBeenCalledTimes(1);
        expect(firstOutcome.reaped + secondOutcome.reaped).toBe(1);
    });

    it('schließt den Check mit der englischen Timeout-Copy, nie mit dem internen Detailtext', async () => {
        reapSelectMock.mockResolvedValue({ data: [{ id: DEAD_JOB_ROW.id }], error: null });

        await reapStaleJobs(NOW_MS);

        expect(reapStatusEqMock).toHaveBeenCalledWith('status', 'processing');
        expect(completeCheckRunMock).toHaveBeenCalledWith(
            'installation-token', 'unslopai/unslop', 4711,
            expect.objectContaining({ conclusion: 'failure', title: 'Review timed out' }),
        );
    });
});
