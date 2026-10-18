/**
 * releaseDeadDashboardReviews (Migration 066, GITHUB_APP_SPEC §4.10): ein toter
 * Dashboard-Job hält den Unique-Index, bis der gedrosselte Lazy Reaper kommt.
 * Der Einreiche-Pfad räumt ihn bei einem 23505 selbst ab — nur tote Jobs, nur
 * Dashboard, nur dieser PR.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type RecordedFilter = readonly [filterName: string, columnName: string, filterValue: unknown];

const { recordedFilters, releaseUpdateMock, releasedRowsMock } = vi.hoisted(() => ({
    recordedFilters: [] as RecordedFilter[],
    releaseUpdateMock: vi.fn<(updatePayload: Record<string, unknown>) => void>(),
    releasedRowsMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({
            update: (updatePayload: Record<string, unknown>) => {
                releaseUpdateMock(updatePayload);
                const recordFilter = (filterName: string) => (columnName: string, filterValue: unknown) => {
                    recordedFilters.push([filterName, columnName, filterValue]);
                    return releaseQuery;
                };
                const releaseQuery: Record<string, unknown> = {
                    eq: recordFilter('eq'),
                    in: recordFilter('in'),
                    lte: recordFilter('lte'),
                    select: releasedRowsMock,
                };
                return releaseQuery;
            },
        }),
    },
}));
vi.mock('@/lib/github-app', () => ({ getInstallationToken: vi.fn() }));
vi.mock('@/lib/check-run', () => ({ completeGatekeeperCheckRun: vi.fn() }));

const { releaseDeadDashboardReviews } = await import('@/lib/pr-head-lifecycle');

const NOW_MS = Date.parse('2026-10-14T09:00:00.000Z');

describe('releaseDeadDashboardReviews', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        recordedFilters.length = 0;
    });

    it('stellt nur tote Dashboard-Jobs dieses PRs um und liefert sie mit ihrem Check', async () => {
        releasedRowsMock.mockResolvedValue({ data: [{ id: 'dead-job', check_run_id: 4712 }], error: null });

        const releasedJobs = await releaseDeadDashboardReviews('repo-under-test', 16, NOW_MS);

        expect(releasedJobs).toEqual([{ jobId: 'dead-job', checkRunId: 4712 }]);
        expect(releaseUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            error_message: expect.stringMatching(/^\[review_timeout\] /),
        }));
        // Reaper-Schwelle: Job-Budget 300 s plus 60 s.
        expect(recordedFilters).toEqual([
            ['eq', 'repository_id', 'repo-under-test'],
            ['eq', 'pr_number', 16],
            ['eq', 'source', 'dashboard'],
            ['in', 'status', ['pending', 'processing']],
            ['lte', 'created_at', new Date(NOW_MS - 360_000).toISOString()],
        ]);
    });

    it('liefert bei einem DB-Fehler nichts, die 409 bleibt stehen', async () => {
        releasedRowsMock.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

        await expect(releaseDeadDashboardReviews('repo-under-test', 16, NOW_MS)).resolves.toEqual([]);
    });
});
