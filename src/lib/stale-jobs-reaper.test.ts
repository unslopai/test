/**
 * IO-Seite des Stale-Job-Reapers (DEADLINE_GUARD_SPEC.md D10): seit dem Lazy
 * Reaping laufen mehrere Reaper parallel — der Check Run eines Jobs darf nur
 * von dem Lauf geschlossen werden, der die Zeile wirklich umgestellt hat.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    reapableJobsInMock,
    reapSelectMock,
    reapStatusEqMock,
    completeCheckRunMock,
    pruneDeliveryClaimsMock,
} = vi.hoisted(() => ({
    reapableJobsInMock: vi.fn(),
    reapSelectMock: vi.fn(),
    reapStatusEqMock: vi.fn(),
    completeCheckRunMock: vi.fn(() => Promise.resolve()),
    pruneDeliveryClaimsMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({ in: reapableJobsInMock }),
            update: () => ({ eq: () => ({ eq: reapStatusEqMock }) }),
        }),
    },
}));
vi.mock('@/lib/github-app', () => ({ getInstallationToken: vi.fn(() => Promise.resolve('installation-token')) }));
vi.mock('@/lib/check-run', () => ({ completeGatekeeperCheckRun: completeCheckRunMock }));
vi.mock('@/lib/delivery-retention', () => ({ pruneExpiredDeliveryClaims: pruneDeliveryClaimsMock }));

const { reapStaleJobs } = await import('@/lib/stale-jobs');

const NOW_MS = Date.parse('2026-09-26T12:00:00.000Z');

const DEAD_JOB_ROW = {
    id: 'job-e409926e',
    status: 'processing',
    updated_at: new Date(NOW_MS - 30 * 60_000).toISOString(),
    check_run_id: 4711,
    payload: { repo_full_name: 'unslopai/unslop' },
    repositories: { full_name: 'unslopai/unslop', installation_id: 146396118 },
};

describe('reapStaleJobs — parallele Lazy-Reaper (D10)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        reapableJobsInMock.mockResolvedValue({ data: [DEAD_JOB_ROW], error: null });
        reapStatusEqMock.mockImplementation(() => ({ select: reapSelectMock }));
        pruneDeliveryClaimsMock.mockResolvedValue(0);
    });

    it('räumt auch einen nie geclaimten pending-Job ab, sonst sperrt er den Index aus Migration 066', async () => {
        const unclaimedDashboardJob = { ...DEAD_JOB_ROW, id: 'job-never-claimed', status: 'pending' };
        reapableJobsInMock.mockResolvedValue({ data: [unclaimedDashboardJob], error: null });
        reapSelectMock.mockResolvedValue({ data: [{ id: unclaimedDashboardJob.id }], error: null });

        const reapOutcome = await reapStaleJobs(NOW_MS);

        expect(reapableJobsInMock).toHaveBeenCalledWith('status', ['pending', 'processing']);
        // Nur aus dem gelesenen Status: ein inzwischen fertiger Job bleibt unberührt.
        expect(reapStatusEqMock).toHaveBeenCalledWith('status', 'pending');
        expect(reapOutcome.reaped).toBe(1);
        expect(completeCheckRunMock).toHaveBeenCalledWith(
            'installation-token', 'unslopai/unslop', 4711,
            expect.objectContaining({ title: 'Review timed out' }),
        );
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

describe('reapStaleJobs — Aufbewahrung der Delivery-Ansprüche (SERVER_AUDIT_2026-09 §8)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        reapableJobsInMock.mockResolvedValue({ data: [], error: null });
    });

    it('löscht bei jedem Lauf abgelaufene Ansprüche zur Uhrzeit des Laufs und meldet ihre Zahl', async () => {
        pruneDeliveryClaimsMock.mockResolvedValue(4);

        const reapOutcome = await reapStaleJobs(NOW_MS);

        expect(pruneDeliveryClaimsMock).toHaveBeenCalledWith(NOW_MS);
        expect(reapOutcome).toMatchObject({ deliveryClaimsPruned: 4, failures: [] });
    });

    it('führt einen Fehler beim Löschen als Fehler, ohne das Abräumen der Jobs zu stoppen', async () => {
        reapableJobsInMock.mockResolvedValue({ data: [DEAD_JOB_ROW], error: null });
        reapStatusEqMock.mockImplementation(() => ({ select: reapSelectMock }));
        reapSelectMock.mockResolvedValue({ data: [{ id: DEAD_JOB_ROW.id }], error: null });
        pruneDeliveryClaimsMock.mockRejectedValue(new Error('Delivery-Aufbewahrung fehlgeschlagen: timeout'));

        const reapOutcome = await reapStaleJobs(NOW_MS);

        expect(reapOutcome).toMatchObject({
            reaped: 1,
            deliveryClaimsPruned: 0,
            failures: ['Delivery-Aufbewahrung fehlgeschlagen: timeout'],
        });
    });
});
