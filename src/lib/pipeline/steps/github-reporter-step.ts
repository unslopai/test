/**
 * GitHubReporterStep — Postet das Review-Ergebnis als PR-Review auf GitHub.
 *
 * Terminaler Step. Konvertiert PipelineIssues zu Inline-Comments,
 * postet den Review und persistiert das Ergebnis in review_jobs.
 * Behandelt auch den Abort-Fall (keine reviewbaren Dateien).
 */
import { supabase } from '@/lib/supabase';
import {
    createPullRequestReview,
    postPRComment,
} from '@/lib/github';
import { buildInlineComments, formatReviewSummary } from '@/lib/pipeline/helpers';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

export const githubReporterStep: PipelineStep = {
    id: 'github-reporter',
    displayName: 'GitHub Reporter',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) {
            await handleAbortedPipeline(context);
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

async function handleAbortedPipeline(context: PipelineContext): Promise<void> {
    await persistJobResult(context.jobId, {
        review: { has_slop: false, issues: [], summary: context.abortReason ?? 'Pipeline abgebrochen.' },
    });

    await postPRComment(
        context.githubToken,
        context.repoFullName,
        context.prNumber,
        `\u2705 **Anti-Slop Gatekeeper**: ${context.abortReason ?? 'Keine reviewbaren Dateien.'}`,
    );

    console.log(`[GitHubReporter] Abort-Kommentar gepostet: ${context.abortReason}`);
}

async function postReviewWithIssues(context: PipelineContext): Promise<void> {
    const inlineComments = buildInlineComments(context.issues, context.reviewableFiles);
    const reviewBody = formatReviewSummary(context.issues, context.reviewSummary);

    await createPullRequestReview(
        context.githubToken,
        context.repoFullName,
        context.prNumber,
        context.headSha,
        reviewBody,
        inlineComments,
        'REQUEST_CHANGES',
    );

    await persistJobResult(context.jobId, {
        review: {
            has_slop: true,
            issues: context.issues,
            summary: context.reviewSummary,
        },
        files_reviewed: context.reviewableFiles.length,
    });

    console.log(`[GitHubReporter] Review mit ${inlineComments.length} Inline-Comments gepostet.`);
}

async function postApprovalComment(context: PipelineContext): Promise<void> {
    await createPullRequestReview(
        context.githubToken,
        context.repoFullName,
        context.prNumber,
        context.headSha,
        '\u2705 **Anti-Slop Gatekeeper**: Kein AI-Slop gefunden. Der Code entspricht den Qualitätsstandards.',
        [],
        'COMMENT',
    );

    await persistJobResult(context.jobId, {
        review: {
            has_slop: false,
            issues: [],
            summary: context.reviewSummary || 'Kein AI-Slop gefunden.',
        },
        files_reviewed: context.reviewableFiles.length,
    });

    console.log('[GitHubReporter] Kein Slop — Approval-Comment gepostet.');
}

// =============================================================================
// Persistence
// =============================================================================

async function persistJobResult(jobId: string, resultPayload: Record<string, unknown>): Promise<void> {
    const { error: persistError } = await supabase
        .from('review_jobs')
        .update({
            status: 'done',
            result: resultPayload,
            updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

    if (persistError) {
        console.error(`[GitHubReporter] Fehler beim Persistieren des Job-Ergebnisses:`, persistError);
        throw new Error(`Job-Ergebnis konnte nicht gespeichert werden: ${persistError.message}`);
    }
}
