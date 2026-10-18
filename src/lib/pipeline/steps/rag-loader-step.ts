/**
 * RagLoaderStep — Lädt den RAG-Kontext (Golden Standards + Local Context).
 *
 * Führt die Dual-Vector-Search aus und schreibt den formatierten
 * RAG-Prompt-Abschnitt in den Pipeline-Kontext. Kein AI-Generations-Call,
 * nur Embedding-basierte Suche.
 */
import { buildRAGContext } from '@/lib/rag';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

export const ragLoaderStep: PipelineStep = {
    id: 'rag-loader',
    displayName: 'RAG Context Loader',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) return context;

        const ragContext = await buildRAGContext(
            context.combinedDiff,
            context.repositoryId,
        );

        console.log(
            `[RagLoader] ${ragContext.goldenStandards.length} Golden Standards, ` +
            `${ragContext.localContext.length} Local Chunks geladen.`,
        );

        return {
            ...context,
            ragPromptSection: ragContext.formattedPromptSection,
        };
    },
};
