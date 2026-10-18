/**
 * Reine Auswahl-Logik des Stale-Job-Reapers — bewusst ohne DB- und
 * GitHub-Import, damit sie ohne Environment testbar ist. Die IO-Seite liegt in
 * `stale-jobs.ts`.
 */
import { REVIEW_TIMEOUT_MARKER } from '@/lib/job-failure';
import { resolveJobBudgetMs } from '@/lib/pipeline/deadline';

/** Abstand zum Job-Budget, ab dem ein 'processing'-Job sicher tot ist. */
export const STALE_JOB_SLACK_MS = 60_000;

/**
 * Ab wann ein 'processing'-Job als tot gilt (DEADLINE_GUARD_SPEC D10):
 * Job-Budget (= maxDuration der Job-Routen) plus eine Minute. Abgeleitet
 * statt literal — hebt ein Pro-Upgrade das Budget an, darf der Reaper nie
 * einen noch laufenden Job abräumen, sonst schlösse er den Check Run eines
 * Reviews, das gleich danach doch noch postet. Hobby: 6 min (vorher 15).
 */
export function resolveStaleJobThresholdMs(jobBudgetMs: number = resolveJobBudgetMs()): number {
    return jobBudgetMs + STALE_JOB_SLACK_MS;
}

/** Mit `[review_timeout]`-Präfix: Clients sehen den stabilen Code statt `server_error`. */
export const STALE_JOB_ERROR_MESSAGE =
    REVIEW_TIMEOUT_MARKER + 'Der Review wurde abgebrochen: die Ausführungsumgebung wurde beendet '
    + '(Speicher- oder Zeitlimit). Der Job wurde automatisch als fehlgeschlagen markiert.';

export interface StaleJobCandidate {
    readonly id: string;
    readonly updatedAt: string;
    readonly checkRunId: number | null;
    readonly repoFullName: string | null;
    readonly installationId: number | null;
}

/**
 * `nowMs` wird hereingereicht statt Date.now() zu rufen — sonst wäre die
 * Grenzfall-Prüfung (exakt auf der Schwelle) nicht deterministisch testbar.
 */
export function selectStaleJobs(
    candidates: readonly StaleJobCandidate[],
    nowMs: number,
    thresholdMs: number = resolveStaleJobThresholdMs(),
): readonly StaleJobCandidate[] {
    return candidates.filter((candidate) => {
        const updatedAtMs = Date.parse(candidate.updatedAt);
        if (Number.isNaN(updatedAtMs)) return false;
        return nowMs - updatedAtMs > thresholdMs;
    });
}
