/**
 * GitHubReporterStep — Postet das Review-Ergebnis als PR-Review auf GitHub.
 *
 * Konvertiert PipelineIssues zu Inline-Comments und postet den Review.
 * Behandelt auch den Abort-Fall (keine reviewbaren Dateien).
 * Persistenz liegt im nachgelagerten ResultPersisterStep.
 */
import {
    createPullRequestReview,
    postPRComment,
} from '@/lib/github';
import { buildInlineComments, formatReviewSummary, partitionIssuesByAnchor } from '@/lib/pipeline/helpers';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

export const githubReporterStep: PipelineStep = {
    id: 'github-reporter',
    displayName: 'GitHub Reporter',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) {
            await postAbortComment(context);
            return context;
        }

        if (context.issues.length > 0) {
            await postReviewWithIssues(context);
        } else {
            await postApprovalComment(context);
        }

        return context;
    },
};

// =============================================================================
// Report Handlers
// =============================================================================

async function postAbortComment(context: PipelineContext): Promise<void> {
    await postPRComment(
        context.githubToken,
        context.repoFullName,
        context.prNumber,
        `✅ **Anti-Slop Gatekeeper**: ${context.abortReason ?? 'No reviewable files in this pull request.'}`,
    );

    console.log(`[GitHubReporter] Abort-Kommentar gepostet: ${context.abortReason}`);
}

async function postReviewWithIssues(context: PipelineContext): Promise<void> {
    // Out-of-Hunk-Findings dürfen nicht inline gepostet werden — GitHub lehnt
    // sonst den GESAMTEN Review ab. Sie wandern stattdessen in den Body.
    const { anchoredIssues, unanchoredIssues } = partitionIssuesByAnchor(
        context.issues,
        context.reviewableFiles,
    );
    const inlineComments = buildInlineComments(anchoredIssues);
    const reviewBody = formatReviewSummary(
        context.issues,
        context.reviewSummary,
        unanchoredIssues,
        context.omittedFiles,
    );

    await createPullRequestReview(
        context.githubToken,
        context.repoFullName,
        context.prNumber,
        context.headSha,
        reviewBody,
        inlineComments,
        'REQUEST_CHANGES',
    );

    console.log(
        `[GitHubReporter] Review gepostet: ${inlineComments.length} Inline-Comments, ` +
        `${unanchoredIssues.length} unverankerte Findings im Body.`,
    );
}

async function postApprovalComment(context: PipelineContext): Promise<void> {
    const omittedNote = context.omittedFiles.length > 0
        ? `\n\n_Not reviewed (size cap exceeded): ${context.omittedFiles.map((filePath) => `\`${filePath}\``).join(', ')}_`
        : '';

    await createPullRequestReview(
        context.githubToken,
        context.repoFullName,
        context.prNumber,
        context.headSha,
        '✅ **Anti-Slop Gatekeeper**: No AI slop found. This code meets the quality standards.' + omittedNote,
        [],
        'COMMENT',
    );

    console.log('[GitHubReporter] Kein Slop — Approval-Comment gepostet.');
}
