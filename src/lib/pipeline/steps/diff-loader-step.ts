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
import { trimReviewableFiles } from '@/lib/pipeline/diff-utils';
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

        const candidateFiles = prFiles.filter(
            (file) => file.patch && isReviewableFile(file.filename),
        );
        const { trimmedFiles: reviewableFiles, omittedFilePaths } = trimReviewableFiles(candidateFiles);

        if (reviewableFiles.length === 0) {
            console.log(`[DiffLoader] Keine reviewbaren Dateien in PR #${context.prNumber}.`);
            return {
                ...context,
                prFiles,
                headSha,
                reviewableFiles: [],
                combinedDiff: '',
                omittedFiles: omittedFilePaths,
                shouldAbort: true,
                abortReason: omittedFilePaths.length > 0
                    ? 'All changed code files exceed the review size cap.'
                    : 'No reviewable code files in this pull request.',
            };
        }

        const combinedDiff = buildCombinedDiff(reviewableFiles);
        console.log(
            `[DiffLoader] ${reviewableFiles.length} Dateien geladen (${combinedDiff.length} chars), ` +
            `${omittedFilePaths.length} wegen Größen-Cap ausgelassen.`,
        );

        return {
            ...context,
            prFiles,
            headSha,
            reviewableFiles,
            combinedDiff,
            omittedFiles: omittedFilePaths,
            promptConfig: {
                ...context.promptConfig,
                filePaths: reviewableFiles.map((file) => file.filename),
            },
        };
    },
};
