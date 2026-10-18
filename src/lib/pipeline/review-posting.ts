/**
 * Idempotentes Posten des Gatekeeper-Reviews.
 *
 * Anlass (Live-Receipt 2026-09-26, Job ecb4937c, unslopai/test#16): GitHub
 * antwortete auf `POST /pulls/16/reviews` mit 502 — und legte den Review
 * (44 Findings) TROTZDEM an. Der Job endete als `error`, der Check als
 * "Review failed", das Ergebnis wurde nie persistiert. Ein blinder Retry
 * hätte den Review doppelt gepostet.
 *
 * Deshalb: bei einem 5xx oder Verbindungsabbruch erst nachsehen, ob unser
 * Review schon existiert (gleicher Commit, gleiche Kopfzeile, nach Jobstart
 * eingereicht) — nur wenn nicht, EIN Retry.
 */
import { GitHubApiError, createPullRequestReview, isGitHubConnectionFailure, listPullRequestReviews } from '@/lib/github';
import type { PullRequestReviewComment } from '@/lib/github';
import type { PipelineContext } from '@/lib/pipeline/types';

/** GitHub braucht nach einem 5xx einen Moment, bis ein doch angelegter Review lesbar ist. */
const RECONCILE_DELAY_MS = 3_000;

export type ReviewEvent = 'COMMENT' | 'REQUEST_CHANGES';

export interface ReviewPostingDependencies {
    readonly waitMs: (delayMs: number) => Promise<void>;
}

const DEFAULT_POSTING_DEPENDENCIES: ReviewPostingDependencies = {
    waitMs: (delayMs) => new Promise((resolveWait) => setTimeout(resolveWait, delayMs)),
};

/**
 * 5xx oder abgebrochene Verbindung: der Ausgang des POST ist unbekannt. Dazu
 * zählt `terminated` mitten in der Antwort (Job 0d913d83, unslopai/test#16,
 * 2026-10-13): GitHub hatte den Review angelegt, die Antwort brach ab, und bis
 * dahin galt nur `fetch failed` als unklar — der fertige Job endete als `error`.
 */
export function isAmbiguousPostFailure(postFailure: unknown): boolean {
    if (postFailure instanceof GitHubApiError) return postFailure.status >= 500;
    return isGitHubConnectionFailure(postFailure);
}

export async function postReviewIdempotently(
    context: PipelineContext,
    reviewBody: string,
    inlineComments: readonly PullRequestReviewComment[],
    reviewEvent: ReviewEvent,
    dependencies: ReviewPostingDependencies = DEFAULT_POSTING_DEPENDENCIES,
): Promise<number | null> {
    const postReview = () => createPullRequestReview(
        context.githubToken, context.repoFullName, context.prNumber, context.headSha,
        reviewBody, [...inlineComments], reviewEvent,
    );

    try {
        return await postReview();
    } catch (postFailure: unknown) {
        if (!isAmbiguousPostFailure(postFailure)) throw postFailure;
        console.warn(
            `[ReviewPosting] Review-POST für ${context.repoFullName}#${context.prNumber} mit unklarem Ausgang `
            + `(${postFailure instanceof Error ? postFailure.message.split('\n')[0] : 'unbekannt'}) — prüfe, ob er angelegt wurde.`,
        );
        await dependencies.waitMs(RECONCILE_DELAY_MS);
        const existingReviewId = await findPostedReviewId(context, reviewBody);
        if (existingReviewId !== null) {
            console.log(`[ReviewPosting] Review ${existingReviewId} wurde trotz Fehler angelegt — kein Retry.`);
            return existingReviewId;
        }
        return postReview();
    }
}

/**
 * Unser Review = gleicher Commit, gleiche Kopfzeile, eingereicht nach dem
 * Jobstart. Die Kopfzeile (z.B. "## 🛡️ Anti-Slop Gatekeeper Review") postet
 * nur der Gatekeeper; der Zeitfilter schließt Reviews früherer Jobs auf
 * demselben Commit (Re-Run) aus.
 */
async function findPostedReviewId(context: PipelineContext, reviewBody: string): Promise<number | null> {
    const reviewHeadline = reviewBody.split('\n')[0].trim();
    const existingReviews = await listPullRequestReviews(context.githubToken, context.repoFullName, context.prNumber);
    const postedReview = existingReviews.find((existingReview) => (
        existingReview.commitId === context.headSha
        && existingReview.submittedAtMs >= context.jobStartedAtMs
        && existingReview.body.trim().startsWith(reviewHeadline)
    ));
    return postedReview?.id ?? null;
}
