/**
 * Stabile, kundensichere Fehlercodes gescheiterter review_jobs.
 *
 * `review_jobs.error_message` bleibt der Detailtext für Log und DB — er kann
 * eine Vorschau der Modellantwort tragen, die der Diff-Autor mitbestimmt, und
 * erreicht deshalb nie einen Client (ROADMAP §15). Clients sehen nur den Code.
 * Bis 2026-09-16 gab es genau einen: `server_error` — ein Vertex-Kapazitäts-429
 * sah damit für den Kunden aus wie ein kaputter Repo-Anschluss.
 *
 * Der Code steckt als server-gesetzter Präfix in error_message statt in einer
 * eigenen Spalte: der Präfix steht vor jedem Fremdtext, keine Migration nötig.
 */
import { extractErrorMessage } from '@/lib/errors';
import { ModelUnavailableError } from '@/lib/pipeline/vertex-retry';
import { JobTimeoutError, ReviewTimeoutError } from '@/lib/pipeline/deadline';
import type { CheckRunResult } from '@/lib/check-run';

export type JobFailureCode = 'model_unavailable' | 'review_timeout' | 'server_error';

const MODEL_UNAVAILABLE_MARKER = '[model_unavailable] ';

/**
 * Draft-Timeout (D5), Watchdog (D9) und Reaper (D10) teilen EINEN Marker:
 * für den Kunden ist es dieselbe Lage — das Zeitlimit war zu knapp, ein
 * Re-run kann reichen.
 */
export const REVIEW_TIMEOUT_MARKER = '[review_timeout] ';

function resolveFailureMarker(jobFailure: unknown): string {
    if (jobFailure instanceof ModelUnavailableError) return MODEL_UNAVAILABLE_MARKER;
    if (jobFailure instanceof ReviewTimeoutError || jobFailure instanceof JobTimeoutError) {
        return REVIEW_TIMEOUT_MARKER;
    }
    return '';
}

/** Detailtext für review_jobs.error_message, bei bekannter Ursache mit Code-Präfix. */
export function buildJobErrorMessage(jobFailure: unknown): string {
    return `${resolveFailureMarker(jobFailure)}${extractErrorMessage(jobFailure)}`;
}

/** Der Client-Code eines gescheiterten Jobs — liest nur den server-gesetzten Präfix. */
export function classifyJobFailure(errorMessage: string | null): JobFailureCode {
    if (errorMessage?.startsWith(MODEL_UNAVAILABLE_MARKER)) return 'model_unavailable';
    if (errorMessage?.startsWith(REVIEW_TIMEOUT_MARKER)) return 'review_timeout';
    return 'server_error';
}

/**
 * Öffentlich am PR sichtbare Check-Texte je Fehlercode (ROADMAP §15): nie der
 * rohe Fehlertext, aber ehrlich genug, dass der Autor weiß, ob ein Re-run
 * reicht. `model_unavailable` = Vertex-Kapazität/5xx nach allen Retries,
 * `review_timeout` = Zeitlimit der Plattform (Draft-Timeout, Watchdog, Reaper).
 * Liegt hier statt im Worker, damit der Reaper den Text ohne den
 * Worker-Modulgraphen (alle Pipeline-Steps) nutzen kann.
 */
export const FAILED_CHECK_RUN_COPY: Readonly<Record<JobFailureCode, CheckRunResult>> = {
    model_unavailable: {
        conclusion: 'failure',
        title: 'Review failed: AI model temporarily unavailable',
        summary: 'The AI model provider was temporarily out of capacity, and retries did not succeed. '
            + 'Nothing is wrong with this pull request or the repository connection — re-run this check in a minute.',
    },
    review_timeout: {
        conclusion: 'failure',
        title: 'Review timed out',
        summary: 'The review exceeded the time limit for this plan. '
            + 'Push a new commit or re-run this check to try again.',
    },
    server_error: {
        conclusion: 'failure',
        title: 'Review failed',
        summary: 'The Anti-Slop Gatekeeper could not complete this review due to an internal error. '
            + 'The details are recorded in the server logs.',
    },
};
