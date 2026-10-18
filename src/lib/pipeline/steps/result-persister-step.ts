/**
 * ResultPersisterStep — Persistiert das Pipeline-Ergebnis in review_jobs.
 *
 * Terminaler Pflicht-Step (wird vom Worker immer angehängt, nicht toggelbar).
 * Läuft auch im Abort-Fall, damit kein Job in 'processing' hängen bleibt.
 * Schreibt zusätzlich die Token-Telemetrie des Reviewer-Calls (Unit Economics).
 */
import { supabase } from '@/lib/supabase';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

export const resultPersisterStep: PipelineStep = {
    id: 'result-persister',
    displayName: 'Result Persister',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        const reviewResult = context.shouldAbort
            ? {
                has_slop: false,
                issues: [],
                summary: context.abortReason ?? 'Pipeline aborted.',
            }
            : {
                has_slop: context.issues.length > 0,
                issues: context.issues,
                summary: context.reviewSummary || 'No AI slop found.',
            };

        const { error: persistError } = await supabase
            .from('review_jobs')
            .update({
                status: 'done',
                result: {
                    review: reviewResult,
                    files_reviewed: context.reviewableFiles.length,
                },
                prompt_tokens: context.tokenUsage?.promptTokens ?? null,
                cached_tokens: context.tokenUsage?.cachedTokens ?? null,
                output_tokens: context.tokenUsage?.outputTokens ?? null,
                model: context.tokenUsage?.model ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', context.jobId);

        if (persistError) {
            console.error('[ResultPersister] Fehler beim Persistieren des Job-Ergebnisses:', persistError);
            throw new Error(`Job-Ergebnis konnte nicht gespeichert werden: ${persistError.message}`);
        }

        console.log(`[ResultPersister] Job ${context.jobId} persistiert (${reviewResult.issues.length} Issues).`);
        return context;
    },
};
