/**
 * RagLoaderStep — Lädt den Evidence-Kontext (Local Repo Skeletons).
 *
 * Führt die Vector-Search über code_chunks aus und schreibt den formatierten
 * Evidence-Abschnitt in den Pipeline-Kontext. Die Golden Standards ("The Law")
 * werden nicht mehr retrieved — sie stehen statisch im System-Prompt (@/lib/law).
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

        console.log(`[RagLoader] ${ragContext.localContext.length} Evidence-Chunks geladen.`);

        return {
            ...context,
            ragPromptSection: ragContext.formattedPromptSection,
        };
    },
};
