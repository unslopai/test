/**
 * Watchdog des Deadline Guards (DEADLINE_GUARD_SPEC.md D9): feuert zur
 * Fire-Zeit, ist nach dem Entschärfen stumm und bleibt nach dem Feuern gefeuert.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { armJobWatchdog } from '@/lib/job-watchdog';
import { JobTimeoutError } from '@/lib/pipeline/deadline';

vi.mock('@/lib/pipeline/runner', () => ({ runPipeline: vi.fn() }));

const ARMED_AT_MS = Date.UTC(2026, 8, 26, 12, 0, 0);

describe('armJobWatchdog', () => {
    beforeEach(() => {
        vi.useFakeTimers({ now: ARMED_AT_MS });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('rejected zur Fire-Zeit mit JobTimeoutError', async () => {
        const watchdog = armJobWatchdog('job-under-test', ARMED_AT_MS + 285_000, 300_000);
        const expiryOutcome = watchdog.expiry.catch((expiryFailure: unknown) => expiryFailure);

        await vi.advanceTimersByTimeAsync(284_999);
        expect(watchdog.hasFired()).toBe(false);
        await vi.advanceTimersByTimeAsync(1);

        expect(watchdog.hasFired()).toBe(true);
        expect(await expiryOutcome).toBeInstanceOf(JobTimeoutError);
    });

    it('feuert nach dem Entschärfen nie', async () => {
        const watchdog = armJobWatchdog('job-under-test', ARMED_AT_MS + 285_000, 300_000);

        watchdog.disarm();
        await vi.advanceTimersByTimeAsync(400_000);

        expect(watchdog.hasFired()).toBe(false);
    });

    it('bleibt gefeuert, auch wenn danach noch entschärft wird', async () => {
        const watchdog = armJobWatchdog('job-under-test', ARMED_AT_MS + 1_000, 300_000);
        watchdog.expiry.catch(() => undefined);

        await vi.advanceTimersByTimeAsync(1_000);
        watchdog.disarm();

        expect(watchdog.hasFired()).toBe(true);
    });
});
