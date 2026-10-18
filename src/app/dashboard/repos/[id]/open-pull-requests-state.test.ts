/**
 * Tests der reinen Logik hinter der Karte „Open pull requests“
 * (GITHUB_APP_SPEC.md §4.10): Kartenzustand, Knopf je PR, Fehlertexte.
 */
import { describe, expect, it } from 'vitest';
import {
    deriveCardState,
    deriveReviewAction,
    readOpenPullRequests,
    readReviewStartResponse,
    reviewErrorMessageKey,
    type OpenPullRequestView,
} from './open-pull-requests-state';

function pullRequestWith(latestReview: OpenPullRequestView['latestReview']): OpenPullRequestView {
    return {
        prNumber: 16,
        title: 'Add widget',
        authorLogin: 'octocat',
        headBranch: 'feature',
        headSha: 'a'.repeat(40),
        updatedAt: '2026-10-13T08:00:00Z',
        htmlUrl: 'https://github.com/unslopai/test/pull/16',
        isFork: false,
        isUntrustedFork: false,
        skippedByForkGate: false,
        latestReview,
    };
}

describe('deriveCardState', () => {
    it('shows the legacy hint for a repository without the app, whatever the load state', () => {
        expect(deriveCardState({ isLegacyRepo: true, loadState: 'error', pullRequestCount: 0 })).toBe('legacy');
    });

    it.each([
        ['loading', 0, 'loading'],
        ['loading', 2, 'list'],
        ['loaded', 0, 'empty'],
        ['loaded', 3, 'list'],
        ['error', 3, 'error'],
    ] as const)('maps load state %s with %i PRs to %s', (loadState, pullRequestCount, expectedCardState) => {
        expect(deriveCardState({ isLegacyRepo: false, loadState, pullRequestCount })).toBe(expectedCardState);
    });
});

describe('deriveReviewAction', () => {
    it('offers "review now" for a pull request that was never reviewed', () => {
        expect(deriveReviewAction(pullRequestWith(null), undefined)).toEqual({ kind: 'review_now' });
    });

    it('locks the button while the latest job is running', () => {
        const pullRequest = pullRequestWith({
            jobId: 'job-1', status: 'processing', createdAt: '2026-10-13T09:00:00Z', onCurrentHead: true, isRunning: true,
        });

        expect(deriveReviewAction(pullRequest, undefined)).toEqual({ kind: 'running' });
    });

    it('does not lock the button for a pending job the server no longer counts as running', () => {
        const pullRequest = pullRequestWith({
            jobId: 'job-stuck', status: 'pending', createdAt: '2026-10-13T09:00:00Z', onCurrentHead: true, isRunning: false,
        });

        expect(deriveReviewAction(pullRequest, undefined)).toMatchObject({ kind: 'review_again' });
    });

    it('allows a second review after a finished one and says when and on which commit', () => {
        const pullRequest = pullRequestWith({
            jobId: 'job-1', status: 'done', createdAt: '2026-10-12T09:00:00Z', onCurrentHead: false, isRunning: false,
        });

        expect(deriveReviewAction(pullRequest, undefined)).toEqual({
            kind: 'review_again', reviewedAt: '2026-10-12T09:00:00Z', onCurrentHead: false,
        });
    });

    it('lets the own click win while the list does not know the started job yet', () => {
        const pullRequest = pullRequestWith({
            jobId: 'job-older', status: 'done', createdAt: '2026-10-12T09:00:00Z', onCurrentHead: true, isRunning: false,
        });

        expect(deriveReviewAction(pullRequest, { kind: 'started', jobId: 'job-new', checkRunUrl: 'https://github.com/x' }))
            .toEqual({ kind: 'started', checkRunUrl: 'https://github.com/x' });
    });

    it('hands over to the list once it knows the started job, so the button returns after the run', () => {
        const startedSubmission = { kind: 'started', jobId: 'job-new', checkRunUrl: null } as const;
        const runningPullRequest = pullRequestWith({
            jobId: 'job-new', status: 'processing', createdAt: '2026-10-13T09:00:00Z', onCurrentHead: true, isRunning: true,
        });
        const finishedPullRequest = pullRequestWith({
            jobId: 'job-new', status: 'done', createdAt: '2026-10-13T09:00:00Z', onCurrentHead: true, isRunning: false,
        });

        expect(deriveReviewAction(runningPullRequest, startedSubmission)).toEqual({ kind: 'running' });
        expect(deriveReviewAction(finishedPullRequest, startedSubmission)).toMatchObject({ kind: 'review_again' });
    });

    it('keeps the submitting state until the POST answers', () => {
        expect(deriveReviewAction(pullRequestWith(null), { kind: 'submitting' })).toEqual({ kind: 'submitting' });
    });
});

describe('reviewErrorMessageKey', () => {
    it.each([
        ['trial_quota_exhausted', 'trialExhausted'],
        ['rate_limit_exceeded', 'quotaExceeded'],
        ['no_subscription', 'subscriptionRequired'],
        ['subscription_inactive', 'subscriptionRequired'],
        ['pr_not_open', 'prNotOpen'],
        ['pr_not_found', 'prNotFound'],
        ['review_in_progress', 'reviewInProgress'],
        ['github_app_required', 'appRequired'],
        ['github_app_unavailable', 'appUnavailable'],
        ['repository_not_active', 'repositoryNotActive'],
    ])('maps %s to the catalog key %s', (errorCode, expectedMessageKey) => {
        expect(reviewErrorMessageKey(errorCode)).toBe(expectedMessageKey);
    });

    it.each([['job_creation_failed'], ['toString'], [undefined], [42]])(
        'falls back to the generic text for %j',
        (unknownErrorCode) => {
            expect(reviewErrorMessageKey(unknownErrorCode)).toBe('generic');
        },
    );
});

describe('readReviewStartResponse', () => {
    it('reads a 202 with its check run link', () => {
        expect(readReviewStartResponse(202, { jobId: 'job-1', checkRunUrl: 'https://github.com/c' }))
            .toEqual({ kind: 'started', jobId: 'job-1', checkRunUrl: 'https://github.com/c' });
    });

    it('reads a 202 without a check run as started without a link', () => {
        expect(readReviewStartResponse(202, { jobId: 'job-1', checkRunUrl: null }))
            .toEqual({ kind: 'started', jobId: 'job-1', checkRunUrl: null });
    });

    it('reads a refusal into its catalog key, also for a body that is not JSON', () => {
        expect(readReviewStartResponse(429, { error: 'rate_limit_exceeded' }))
            .toEqual({ kind: 'refused', messageKey: 'quotaExceeded' });
        expect(readReviewStartResponse(500, null)).toEqual({ kind: 'refused', messageKey: 'generic' });
    });
});

describe('readOpenPullRequests', () => {
    it('reads the list of a GET pulls answer', () => {
        expect(readOpenPullRequests({ pullRequests: [] })).toEqual([]);
    });

    it.each([[null], ['<html>gateway</html>'], [{ pullRequests: 'nope' }], [{ error: 'github_unavailable' }]])(
        'answers null instead of a list for %j',
        (malformedBody) => {
            expect(readOpenPullRequests(malformedBody)).toBeNull();
        },
    );
});
