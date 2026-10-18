import { describe, expect, it } from 'vitest';
import { STALE_JOB_ERROR_MESSAGE, resolveStaleJobThresholdMs, selectStaleJobs } from './stale-jobs-selection';
import { classifyJobFailure } from './job-failure';
import type { StaleJobCandidate } from './stale-jobs-selection';

const NOW_MS = Date.parse('2026-07-20T14:00:00.000Z');

function candidateAgedMinutes(minutes: number, id = 'job'): StaleJobCandidate {
    return {
        id,
        updatedAt: new Date(NOW_MS - minutes * 60_000).toISOString(),
        checkRunId: 4711,
        repoFullName: 'unslopai/test',
        installationId: 146396118,
    };
}

describe('selectStaleJobs', () => {
    it('reaps a job whose instance died long ago', () => {
        const staleJobs = selectStaleJobs([candidateAgedMinutes(45)], NOW_MS);

        expect(staleJobs).toHaveLength(1);
    });

    it('leaves a job that is still within its execution window alone', () => {
        // Die Webhook-Route darf 300s laufen. Ein Job, der seit 4 Minuten
        // arbeitet, ist gesund — würde der Reaper ihn abräumen, schlösse er den
        // Check Run eines Reviews, das gleich danach doch noch postet.
        const staleJobs = selectStaleJobs([candidateAgedMinutes(4)], NOW_MS);

        expect(staleJobs).toEqual([]);
    });

    it('does not reap a job sitting exactly on the threshold', () => {
        const exactlyOnThreshold: StaleJobCandidate = {
            ...candidateAgedMinutes(0),
            updatedAt: new Date(NOW_MS - resolveStaleJobThresholdMs()).toISOString(),
        };

        expect(selectStaleJobs([exactlyOnThreshold], NOW_MS)).toEqual([]);
    });

    it('räumt einen Job 7 Minuten nach dem letzten Lebenszeichen ab (Hobby-Budget 300 s + 60 s)', () => {
        expect(selectStaleJobs([candidateAgedMinutes(7)], NOW_MS)).toHaveLength(1);
        expect(selectStaleJobs([candidateAgedMinutes(5.5)], NOW_MS)).toEqual([]);
    });

    it('leitet die Schwelle aus dem Job-Budget ab — ein Pro-Budget reapt nie einen laufenden Job', () => {
        expect(resolveStaleJobThresholdMs(300_000)).toBe(360_000);
        expect(resolveStaleJobThresholdMs(800_000)).toBe(860_000);
    });

    it('der Reaper-Text trägt den stabilen review_timeout-Code', () => {
        expect(classifyJobFailure(STALE_JOB_ERROR_MESSAGE)).toBe('review_timeout');
    });

    it('keeps only the stale jobs out of a mixed batch', () => {
        const staleJobs = selectStaleJobs(
            [
                candidateAgedMinutes(2, 'fresh'),
                candidateAgedMinutes(30, 'dead'),
                candidateAgedMinutes(90, 'very-dead'),
            ],
            NOW_MS,
        );

        expect(staleJobs.map((staleJob) => staleJob.id)).toEqual(['dead', 'very-dead']);
    });

    it('skips rows with an unparseable timestamp instead of reaping them', () => {
        // Ein kaputter Zeitstempel darf nicht dazu führen, dass ein laufender
        // Job abgeräumt wird — NaN-Vergleiche sind immer false, das ist hier
        // Absicht und wird deshalb festgenagelt.
        const brokenTimestamp: StaleJobCandidate = {
            ...candidateAgedMinutes(60),
            updatedAt: 'not-a-timestamp',
        };

        expect(selectStaleJobs([brokenTimestamp], NOW_MS)).toEqual([]);
    });
});
