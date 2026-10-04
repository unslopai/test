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

export type JobFailureCode = 'model_unavailable' | 'server_error';

const MODEL_UNAVAILABLE_MARKER = '[model_unavailable] ';

/** Detailtext für review_jobs.error_message, bei bekannter Ursache mit Code-Präfix. */
export function buildJobErrorMessage(jobFailure: unknown): string {
    const failureMessage = extractErrorMessage(jobFailure);
    return jobFailure instanceof ModelUnavailableError
        ? `${MODEL_UNAVAILABLE_MARKER}${failureMessage}`
        : failureMessage;
}

/** Der Client-Code eines gescheiterten Jobs — liest nur den server-gesetzten Präfix. */
export function classifyJobFailure(errorMessage: string | null): JobFailureCode {
    return errorMessage?.startsWith(MODEL_UNAVAILABLE_MARKER) ? 'model_unavailable' : 'server_error';
}
