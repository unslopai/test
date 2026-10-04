/**
 * Pipeline Runner — Sequentielle Ausführung von PipelineSteps.
 *
 * Iteriert über die konfigurierte Step-Liste und reicht den PipelineContext
 * von Step zu Step weiter. Jeder Step entscheidet selbst, ob er bei
 * shouldAbort === true übersprungen wird.
 */
import { logMemory } from '@/lib/memory-log';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

/**
 * Führt eine Pipeline sequentiell aus.
 *
 * @param initialContext - Der initiale Kontext mit Job-Metadaten
 * @param steps - Die geordnete Liste der auszuführenden Steps
 * @returns Der finale, angereicherte Kontext
 */
export async function runPipeline(
    initialContext: PipelineContext,
    steps: readonly PipelineStep[],
): Promise<PipelineContext> {
    let currentContext = initialContext;

    logMemory('pipeline-start');

    for (const step of steps) {
        console.log(`[Pipeline] Starte Step: ${step.displayName} (${step.id})`);
        currentContext = await step.execute(currentContext);
        console.log(`[Pipeline] Step ${step.id} abgeschlossen.`);
        logMemory(step.id);
    }

    return currentContext;
}
