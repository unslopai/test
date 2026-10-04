/**
 * Transiente Vertex-Fehler (429 RESOURCE_EXHAUSTED, 5xx) — Klassifikation,
 * Backoff und der typisierte Endzustand nach erschöpften Retries.
 *
 * Anlass (ROADMAP §6, F5-Befund 2026-09-16, Job e49caffe): ein einzelner
 * Kapazitäts-429 auf dem Draft-Call riss den ganzen Job, obwohl derselbe
 * Diff acht Minuten vorher sauber durchlief. Das SDK wiederholt ohne
 * `httpOptions.retryOptions` NICHTS — und mit ihnen verliert der finale Fehler
 * seinen HTTP-Status (p-retry wirft ein generisches Error), die Telemetrie
 * könnte einen Kapazitätsausfall dann nicht mehr von einem Bug unterscheiden.
 * Deshalb liegt der Retry hier, eine Ebene über dem SDK.
 */

/** HTTP-Status, bei denen ein identischer späterer Call realistisch gelingt. */
const TRANSIENT_HTTP_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

/** Wartezeit VOR dem n-ten Retry; die Länge ist die Retry-Zahl. */
const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [2_000, 6_000];

const MAX_JITTER_MS = 1_000;

/** Obergrenze für einen server-seitigen retryDelay-Hinweis im Fehler-JSON. */
const MAX_SERVER_HINTED_DELAY_MS = 15_000;

/**
 * Dauerte schon der gescheiterte Versuch so lange, wiederholen wir nicht:
 * Draft, Verify und Eskalation teilen sich die 300 s `maxDuration` der Route —
 * ein zweiter Langläufer würde den Job in den Timeout statt ins Review tragen.
 */
const MAX_RETRYABLE_ATTEMPT_MS = 60_000;

const SERVER_RETRY_DELAY_PATTERN = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/;

/**
 * Das Modell war nach allen Retries nicht erreichbar (Kapazität/5xx). Die
 * Message trägt den rohen SDK-Text nur für Log und DB — Clients sehen
 * ausschließlich den stabilen Code (job-failure.ts).
 */
export class ModelUnavailableError extends Error {
    constructor(
        readonly callLabel: string,
        readonly attemptCount: number,
        lastFailureMessage: string,
    ) {
        super(`${callLabel}: Modell nach ${attemptCount} Versuchen nicht verfügbar — ${lastFailureMessage}`);
        this.name = 'ModelUnavailableError';
    }
}

export interface TransientRetryPolicy {
    readonly retryDelaysMs: readonly number[];
    readonly waitMs: (delayMs: number) => Promise<void>;
    readonly jitterMs: () => number;
}

const DEFAULT_RETRY_POLICY: TransientRetryPolicy = {
    retryDelaysMs: DEFAULT_RETRY_DELAYS_MS,
    waitMs: (delayMs) => new Promise((resolveWait) => setTimeout(resolveWait, delayMs)),
    jitterMs: () => Math.floor(Math.random() * MAX_JITTER_MS),
};

type TransientVertexFailure = Error & { readonly status: number };

/**
 * undici meldet einen Verbindungsabbruch (Socket-Reset, abgebrochener
 * Stream, Header-Timeout) als nacktes `TypeError: fetch failed` — ohne
 * HTTP-Status. Beobachtet 2026-09-17 auf einem Verify-Call nach 144 s
 * (Retry in 11 s clean). Ein identischer Call gelingt danach realistisch;
 * gegen den 300-s-Header-Timeout schuetzt MAX_RETRYABLE_ATTEMPT_MS.
 */
const CONNECTION_FAILURE_STATUS = 0;

function isConnectionFailure(candidateFailure: unknown): candidateFailure is TypeError {
    return candidateFailure instanceof TypeError && candidateFailure.message === 'fetch failed';
}

/**
 * Strukturell statt `instanceof ApiError`: Next bündelt @google/genai je nach
 * Import-Pfad als CJS oder ESM — zwei ApiError-Klassen, instanceof wäre dann
 * still false (Dual-Package-Hazard).
 */
function isTransientApiError(candidateFailure: unknown): candidateFailure is TransientVertexFailure {
    return candidateFailure instanceof Error
        && candidateFailure.name === 'ApiError'
        && 'status' in candidateFailure
        && typeof candidateFailure.status === 'number'
        && TRANSIENT_HTTP_STATUSES.has(candidateFailure.status);
}

/**
 * Der transiente SDK-Fehler hinter einem Call-Fehlschlag — direkt oder eine
 * Ebene tiefer als `cause` (typisierte Wrapper wie VerdictCallError behalten
 * ihn dort, damit der HTTP-Status nicht verloren geht). null = nicht transient.
 */
export function findTransientVertexFailure(callFailure: unknown): TransientVertexFailure | null {
    if (isTransientApiError(callFailure)) return callFailure;
    if (isConnectionFailure(callFailure)) {
        return Object.assign(callFailure, { status: CONNECTION_FAILURE_STATUS });
    }
    if (!(callFailure instanceof Error)) return null;
    return findTransientVertexFailure(callFailure.cause);
}

/**
 * Der Call ist an seiner eigenen Deadline gestorben (Latenz-Guard der
 * Eskalations-Rolle, context-cache.ts): das SDK bricht den fetch über einen
 * eigenen AbortController ab, der Fehler kommt als DOMException `AbortError`
 * (bei einem nackten AbortSignal.timeout waere es `TimeoutError`) — direkt
 * oder als `cause` eines typisierten Wrappers. Ein Deadline-Abbruch ist
 * NIE retryfaehig: ein zweiter Langlaeufer wuerde genau das Routen-Budget
 * verbrauchen, das die Deadline schuetzen soll.
 */
export function isCallDeadlineFailure(callFailure: unknown): boolean {
    if (!(callFailure instanceof Error)) return false;
    if (callFailure.name === 'AbortError' || callFailure.name === 'TimeoutError') return true;
    return isCallDeadlineFailure(callFailure.cause);
}

/** Backoff + Jitter; ein retryDelay-Hinweis im Fehler-JSON verlängert (gedeckelt). */
export function resolveRetryDelayMs(callFailure: Error, baseDelayMs: number, jitterMs: number): number {
    const hintMatch = SERVER_RETRY_DELAY_PATTERN.exec(callFailure.message);
    const hintedDelayMs = hintMatch
        ? Math.min(Number(hintMatch[1]) * 1000, MAX_SERVER_HINTED_DELAY_MS)
        : 0;
    return Math.max(baseDelayMs, hintedDelayMs) + jitterMs;
}

/**
 * Führt einen Modell-Call mit Backoff-Retries bei transienten Vertex-Fehlern
 * aus. Nicht-transiente Fehler propagieren sofort unverändert; nach dem
 * letzten transienten Fehlschlag wird ein ModelUnavailableError geworfen.
 * Jeder Versuch schreibt seine Telemetrie selbst (api_error … ok).
 */
export async function runWithTransientRetry<CallOutcome>(
    runAttempt: () => Promise<CallOutcome>,
    callLabel: string,
    retryPolicy: TransientRetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<CallOutcome> {
    for (let retryIndex = 0; ; retryIndex += 1) {
        const attemptStartedAt = Date.now();
        try {
            return await runAttempt();
        } catch (attemptFailure: unknown) {
            const transientFailure = findTransientVertexFailure(attemptFailure);
            if (!transientFailure) throw attemptFailure;

            const attemptCount = retryIndex + 1;
            const baseDelayMs = retryPolicy.retryDelaysMs[retryIndex];
            const attemptTooSlowToRepeat = Date.now() - attemptStartedAt > MAX_RETRYABLE_ATTEMPT_MS;
            if (baseDelayMs === undefined || attemptTooSlowToRepeat) {
                throw new ModelUnavailableError(callLabel, attemptCount, transientFailure.message);
            }

            const delayMs = resolveRetryDelayMs(transientFailure, baseDelayMs, retryPolicy.jitterMs());
            console.warn(
                `[VertexRetry] ${callLabel}: HTTP ${transientFailure.status} in Versuch ${attemptCount} — ` +
                `Retry in ${delayMs} ms.`,
            );
            await retryPolicy.waitMs(delayMs);
        }
    }
}
