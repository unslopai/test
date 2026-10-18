/**
 * Lazy Reaping (DEADLINE_GUARD_SPEC.md D10): läuft nach der Response, ist pro
 * Instanz auf einen Lauf pro Minute gedrosselt und stört den Aufrufer nie.
 */
import { describe, expect, it, vi } from 'vitest';
import { LAZY_REAP_MIN_INTERVAL_MS, createLazyReapScheduler } from '@/lib/lazy-reaper';
import type { ReapOutcome } from '@/lib/stale-jobs';

vi.mock('@/lib/stale-jobs', () => ({ reapStaleJobs: vi.fn() }));

const QUIET_OUTCOME: ReapOutcome = { scanned: 0, reaped: 0, checkRunsClosed: 0, failures: [] };

function buildSchedulerHarness(reap: () => Promise<ReapOutcome> = () => Promise.resolve(QUIET_OUTCOME)) {
    let clockReadingMs = 1_000_000;
    const scheduledTasks: (() => Promise<void>)[] = [];
    const reapMock = vi.fn(reap);
    const scheduleLazyReap = createLazyReapScheduler({
        reap: reapMock,
        scheduleAfterResponse: (backgroundTask) => {
            scheduledTasks.push(backgroundTask);
        },
        nowMs: () => clockReadingMs,
    });
    return {
        scheduleLazyReap,
        reapMock,
        scheduledTasks,
        advanceClock: (elapsedMs: number) => {
            clockReadingMs += elapsedMs;
        },
    };
}

describe('createLazyReapScheduler', () => {
    it('plant den Reaper nach der Response ein, ohne ihn synchron auszuführen', async () => {
        const harness = buildSchedulerHarness();

        harness.scheduleLazyReap('webhook');

        expect(harness.reapMock).not.toHaveBeenCalled();
        await harness.scheduledTasks[0]();
        expect(harness.reapMock).toHaveBeenCalledTimes(1);
    });

    it('drosselt auf einen Lauf pro Minute und Instanz (MCP pollt alle 2 s)', () => {
        const harness = buildSchedulerHarness();

        harness.scheduleLazyReap('cli-poll');
        harness.advanceClock(2_000);
        harness.scheduleLazyReap('cli-poll');
        harness.advanceClock(LAZY_REAP_MIN_INTERVAL_MS);
        harness.scheduleLazyReap('dashboard');

        expect(harness.scheduledTasks).toHaveLength(2);
    });

    it('ein scheiternder Reaper-Lauf wirft nie in den Hintergrund-Task hinein', async () => {
        const harness = buildSchedulerHarness(() => Promise.reject(new Error('connection reset')));
        const errorLogSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        harness.scheduleLazyReap('webhook');

        await expect(harness.scheduledTasks[0]()).resolves.toBeUndefined();
        expect(errorLogSpy).toHaveBeenCalledWith(expect.stringContaining('connection reset'));
        errorLogSpy.mockRestore();
    });
});
