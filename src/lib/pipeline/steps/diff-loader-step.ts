/**
 * DiffLoaderStep — Lädt PR-Dateien von GitHub und baut den Diff zusammen.
 *
 * Deterministischer Step (kein AI-Call). Setzt shouldAbort wenn keine
 * reviewbaren Dateien im PR enthalten sind.
 */
import {
    fetchPullRequestFiles,
    getPullRequestHeadSha,
} from '@/lib/github';
import { isReviewableFile, buildCombinedDiff } from '@/lib/pipeline/helpers';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

export const diffLoaderStep: PipelineStep = {
    id: 'diff-loader',
    displayName: 'Diff Loader',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) return context;

        const prFiles = await fetchPullRequestFiles(
            context.githubToken,
            context.repoFullName,
            context.prNumber,
        );

        const headSha = await getPullRequestHeadSha(
            context.githubToken,
            context.repoFullName,
            context.prNumber,
        );

        const reviewableFiles = prFiles.filter(
            (file) => file.patch && isReviewableFile(file.filename),
        );

        if (reviewableFiles.length === 0) {
            console.log(`[DiffLoader] Keine reviewbaren Dateien in PR #${context.prNumber}.`);
            return {
                ...context,
                prFiles,
                headSha,
                reviewableFiles: [],
                combinedDiff: '',
                shouldAbort: true,
                abortReason: 'Keine reviewbaren Code-Dateien in diesem PR.',
            };
        }

        const combinedDiff = buildCombinedDiff(reviewableFiles);
        console.log(`[DiffLoader] ${reviewableFiles.length} Dateien geladen (${combinedDiff.length} chars).`);

        return {
            ...context,
            prFiles,
            headSha,
            reviewableFiles,
            combinedDiff,
            promptConfig: {
                ...context.promptConfig,
                filePaths: reviewableFiles.map((file) => file.filename),
            },
        };
    },
};
