/**
 * Reine Auswahl-Logik des Stale-Job-Reapers — bewusst ohne DB- und
 * GitHub-Import, damit sie ohne Environment testbar ist. Die IO-Seite liegt in
 * `stale-jobs.ts`.
 */

/**
 * Ab wann ein 'processing'-Job als tot gilt. Bewusst deutlich über der
 * maxDuration der Webhook-Route (300s): ein noch laufender Job darf niemals
 * abgeräumt werden, sonst schließen wir den Check Run eines Reviews, das
 * gleich danach doch noch postet.
 */
export const STALE_JOB_THRESHOLD_MS = 15 * 60 * 1_000;

export const STALE_JOB_ERROR_MESSAGE =
    'Der Review wurde abgebrochen: die Ausführungsumgebung wurde beendet '
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
    thresholdMs: number = STALE_JOB_THRESHOLD_MS,
): readonly StaleJobCandidate[] {
    return candidates.filter((candidate) => {
        const updatedAtMs = Date.parse(candidate.updatedAt);
        if (Number.isNaN(updatedAtMs)) return false;
        return nowMs - updatedAtMs > thresholdMs;
    });
}
