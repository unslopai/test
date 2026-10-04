import { describe, expect, it } from 'vitest';
import { STALE_JOB_THRESHOLD_MS, selectStaleJobs } from './stale-jobs-selection';
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
            updatedAt: new Date(NOW_MS - STALE_JOB_THRESHOLD_MS).toISOString(),
        };

        expect(selectStaleJobs([exactlyOnThreshold], NOW_MS)).toEqual([]);
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
