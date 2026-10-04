/**
 * Watchdog des Deadline Guards (DEADLINE_GUARD_SPEC.md D9).
 *
 * Die Budget-Signale decken LLM-Calls ab; ein Hänger außerhalb (GitHub, DB,
 * Cache-Anlage) würde den Job trotzdem in den Plattform-Kill tragen — und
 * dann läuft kein catch mehr, der Job bliebe `processing`. Der Watchdog
 * wirft deshalb 15 s vor dem Kill einen JobTimeoutError in den bestehenden
 * Fehlerpfad des Workers.
 *
 * Zwei Eigenheiten, die ein nacktes Promise.race falsch machen würde:
 *  - ab der Report-Phase ist er ENTSCHÄRFT: ein bereits geposteter Review darf
 *    nie nachträglich auf `error` kippen;
 *  - ein verlorenes Rennen stoppt die Pipeline nicht. `hasFired` wird deshalb
 *    vom Runner vor jedem Step geprüft, damit eine überlebende Pipeline nie
 *    mehr den Reporter erreicht.
 */
import { runPipeline } from '@/lib/pipeline/runner';
import { JobTimeoutError, resolveWatchdogFireAtMs } from '@/lib/pipeline/deadline';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

export interface JobWatchdog {
    /** Rejected mit JobTimeoutError, sobald der Watchdog feuert; settled sonst nie. */
    readonly expiry: Promise<never>;
    readonly hasFired: () => boolean;
    /** Idempotent; nach dem Feuern wirkungslos. */
    readonly disarm: () => void;
}

export function armJobWatchdog(jobId: string, fireAtMs: number, jobBudgetMs: number): JobWatchdog {
    let watchdogState: 'armed' | 'fired' | 'disarmed' = 'armed';
    let timerHandle: ReturnType<typeof setTimeout> | undefined;

    const expiry = new Promise<never>((_resolveNever, rejectWithTimeout) => {
        timerHandle = setTimeout(() => {
            if (watchdogState !== 'armed') return;
            watchdogState = 'fired';
            rejectWithTimeout(new JobTimeoutError(jobId, jobBudgetMs));
        }, Math.max(0, fireAtMs - Date.now()));
    });

    return {
        expiry,
        hasFired: () => watchdogState === 'fired',
        disarm: () => {
            if (watchdogState !== 'armed') return;
            watchdogState = 'disarmed';
            clearTimeout(timerHandle);
        },
    };
}

export interface WatchedPipelineRun {
    readonly finalContext: PipelineContext;
    /** Start der Report-Phase — Basis der Log-Zeile zur 30-s-Reserve (Spec §8). */
    readonly postLlmStartedAtMs: number | null;
}

/** runPipeline unter Watchdog: wirft JobTimeoutError, wenn das Budget vor der Report-Phase reißt. */
export async function runPipelineUnderWatchdog(
    initialContext: PipelineContext,
    steps: readonly PipelineStep[],
    jobBudgetMs: number,
): Promise<WatchedPipelineRun> {
    const watchdog = armJobWatchdog(
        initialContext.jobId,
        resolveWatchdogFireAtMs(initialContext.jobStartedAtMs, jobBudgetMs),
        jobBudgetMs,
    );
    let postLlmStartedAtMs: number | null = null;

    try {
        const finalContext = await Promise.race([
            runPipeline(initialContext, steps, {
                isCancelled: watchdog.hasFired,
                onPostLlmPhase: () => {
                    postLlmStartedAtMs = Date.now();
                    watchdog.disarm();
                },
            }),
            watchdog.expiry,
        ]);
        return { finalContext, postLlmStartedAtMs };
    } finally {
        watchdog.disarm();
    }
}
