/**
 * Pipeline Runner — Sequentielle Ausführung von PipelineSteps.
 *
 * Iteriert über die konfigurierte Step-Liste und reicht den PipelineContext
 * von Step zu Step weiter. Jeder Step entscheidet selbst, ob er bei
 * shouldAbort === true übersprungen wird.
 */
import { logMemory } from '@/lib/memory-log';
import { remainingLlmMs } from '@/lib/pipeline/deadline';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

/**
 * Ab diesen Steps beginnt die Report-Phase: nach ihrem Start darf ein Job
 * nicht mehr als Timeout enden (DEADLINE_GUARD_SPEC D9). Der Reporter ist
 * abschaltbar, der Persister ist immer der terminale Step.
 */
const POST_LLM_STEP_IDS: ReadonlySet<string> = new Set(['github-reporter', 'result-persister']);

/** Kopplung an den Watchdog (job-watchdog.ts); ohne Watchdog greifen die No-op-Defaults. */
export interface PipelineRunHooks {
    /** true = Watchdog gefeuert — kein weiterer Step darf starten. */
    readonly isCancelled: () => boolean;
    /** Genau einmal, unmittelbar vor dem ersten Step der Report-Phase. */
    readonly onPostLlmPhase: () => void;
}

const UNWATCHED_RUN: PipelineRunHooks = {
    isCancelled: () => false,
    onPostLlmPhase: () => undefined,
};

/** Die Pipeline wurde nach dem Watchdog-Timeout vor dem nächsten Step gestoppt. */
export class PipelineCancelledError extends Error {
    constructor(jobId: string, nextStepId: string) {
        super(`Pipeline von Job ${jobId} nach Watchdog-Timeout vor Step ${nextStepId} gestoppt.`);
        this.name = 'PipelineCancelledError';
    }
}

/**
 * Führt eine Pipeline sequentiell aus.
 *
 * @param initialContext - Der initiale Kontext mit Job-Metadaten
 * @param steps - Die geordnete Liste der auszuführenden Steps
 * @param runHooks - Watchdog-Kopplung (D9); Default = ungewacht
 * @returns Der finale, angereicherte Kontext
 */
export async function runPipeline(
    initialContext: PipelineContext,
    steps: readonly PipelineStep[],
    runHooks: PipelineRunHooks = UNWATCHED_RUN,
): Promise<PipelineContext> {
    let currentContext = initialContext;
    let postLlmPhaseStarted = false;

    logMemory('pipeline-start');

    for (const step of steps) {
        if (runHooks.isCancelled()) {
            throw new PipelineCancelledError(currentContext.jobId, step.id);
        }
        if (!postLlmPhaseStarted && POST_LLM_STEP_IDS.has(step.id)) {
            postLlmPhaseStarted = true;
            runHooks.onPostLlmPhase();
        }
        console.log(
            `[Pipeline] Starte Step: ${step.displayName} (${step.id}) — `
            + `LLM-Budget: ${formatRemainingBudget(currentContext)}`,
        );
        currentContext = await step.execute(currentContext);
        console.log(`[Pipeline] Step ${step.id} abgeschlossen.`);
        logMemory(step.id);
    }

    return currentContext;
}

function formatRemainingBudget(context: PipelineContext): string {
    const remainingMs = remainingLlmMs(context);
    return Number.isFinite(remainingMs) ? `${remainingMs} ms` : 'unbegrenzt';
}
