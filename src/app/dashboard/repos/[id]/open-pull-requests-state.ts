/**
 * Reine Logik der Karte „Open pull requests“ (GITHUB_APP_SPEC.md §4.10):
 * Kartenzustand, Knopf-Zustand je PR und Zuordnung der API-Fehlercodes auf
 * Katalog-Texte. Ohne React und ohne DOM, damit sie in vitest (environment
 * node) testbar ist; die Komponente rendert nur, was hier abgeleitet wird.
 */
import type { LoadState } from '../../useDashboardSync';

/** Client-Spiegel des DTO aus src/lib/pr-review/open-pull-request-view.ts. */
export interface PullRequestLatestReview {
    readonly jobId: string;
    readonly status: string;
    readonly createdAt: string;
    readonly onCurrentHead: boolean;
    /** Serverseitig: Status läuft UND jünger als die Reaper-Schwelle. */
    readonly isRunning: boolean;
}

export interface OpenPullRequestView {
    readonly prNumber: number;
    readonly title: string;
    readonly authorLogin: string | null;
    readonly headBranch: string | null;
    readonly headSha: string;
    readonly updatedAt: string | null;
    readonly htmlUrl: string;
    readonly isFork: boolean;
    readonly isUntrustedFork: boolean;
    readonly skippedByForkGate: boolean;
    readonly latestReview: PullRequestLatestReview | null;
}

// =============================================================================
// Kartenzustand
// =============================================================================

export type OpenPullRequestsCardState = 'legacy' | 'loading' | 'error' | 'empty' | 'list';

/**
 * Ein Legacy-Repo (ohne App-Installation) lädt gar nicht erst: die Liste
 * braucht das Installation-Token, die Route antwortet dort 409.
 */
export function deriveCardState(input: {
    readonly isLegacyRepo: boolean;
    readonly loadState: LoadState;
    readonly pullRequestCount: number;
}): OpenPullRequestsCardState {
    if (input.isLegacyRepo) return 'legacy';
    if (input.loadState === 'error') return 'error';
    if (input.loadState === 'loading' && input.pullRequestCount === 0) return 'loading';
    return input.pullRequestCount === 0 ? 'empty' : 'list';
}

// =============================================================================
// Knopf je PR
// =============================================================================

/** Was der Klick auf diese Zeile in dieser Sitzung ausgelöst hat. */
export type ReviewSubmission =
    | { readonly kind: 'submitting' }
    | { readonly kind: 'started'; readonly jobId: string | null; readonly checkRunUrl: string | null };

export type PullRequestReviewAction =
    | { readonly kind: 'review_now' }
    | { readonly kind: 'review_again'; readonly reviewedAt: string; readonly onCurrentHead: boolean }
    | { readonly kind: 'running' }
    | { readonly kind: 'submitting' }
    | { readonly kind: 'started'; readonly checkRunUrl: string | null };

/**
 * Der eigene Klick hat Vorrang, bis die Liste den gestarteten Job selbst
 * kennt: davor ist ihr Stand älter als der Klick, danach zeigt sie den
 * Verlauf des Jobs (läuft, dann „Review again“). Ein laufender Job sperrt den
 * Knopf; ein fertiger Job erlaubt „Review again“, zeigt aber vorher, wann und
 * ob auf diesem Commit zuletzt geprüft wurde.
 */
export function deriveReviewAction(
    pullRequest: OpenPullRequestView,
    submission: ReviewSubmission | undefined,
): PullRequestReviewAction {
    const { latestReview } = pullRequest;
    const listKnowsSubmittedJob = submission?.kind === 'started'
        && submission.jobId !== null
        && latestReview?.jobId === submission.jobId;
    if (submission && !listKnowsSubmittedJob) {
        return submission.kind === 'started'
            ? { kind: 'started', checkRunUrl: submission.checkRunUrl }
            : submission;
    }

    if (!latestReview) return { kind: 'review_now' };
    if (latestReview.isRunning) return { kind: 'running' };
    return { kind: 'review_again', reviewedAt: latestReview.createdAt, onCurrentHead: latestReview.onCurrentHead };
}

/** Liest `pullRequests` aus der Antwort von GET …/pulls; null = keine Liste [ARCH-002]. */
export function readOpenPullRequests(responseBody: unknown): OpenPullRequestView[] | null {
    if (typeof responseBody !== 'object' || responseBody === null) return null;
    const pullRequests: unknown = Reflect.get(responseBody, 'pullRequests');
    return Array.isArray(pullRequests) ? pullRequests : null;
}

// =============================================================================
// Fehler → Katalog-Text
// =============================================================================

export type ReviewErrorMessageKey =
    | 'trialExhausted'
    | 'quotaExceeded'
    | 'subscriptionRequired'
    | 'prNotOpen'
    | 'prNotFound'
    | 'reviewInProgress'
    | 'appRequired'
    | 'appUnavailable'
    | 'repositoryNotActive'
    | 'generic';

const MESSAGE_KEY_BY_ERROR_CODE: Readonly<Record<string, ReviewErrorMessageKey>> = {
    trial_quota_exhausted: 'trialExhausted',
    rate_limit_exceeded: 'quotaExceeded',
    no_subscription: 'subscriptionRequired',
    subscription_inactive: 'subscriptionRequired',
    unknown_plan: 'subscriptionRequired',
    pr_not_open: 'prNotOpen',
    pr_not_found: 'prNotFound',
    review_in_progress: 'reviewInProgress',
    github_app_required: 'appRequired',
    github_app_unavailable: 'appUnavailable',
    repository_not_active: 'repositoryNotActive',
};

/** Unbekannte Codes (auch 5xx-Diagnosecodes) fallen auf den allgemeinen Text. */
export function reviewErrorMessageKey(errorCode: unknown): ReviewErrorMessageKey {
    if (typeof errorCode !== 'string') return 'generic';
    return Object.hasOwn(MESSAGE_KEY_BY_ERROR_CODE, errorCode) ? MESSAGE_KEY_BY_ERROR_CODE[errorCode] : 'generic';
}

/** Antwort von POST …/review, strukturell gelesen. */
export type ReviewStartResponse =
    | { readonly kind: 'started'; readonly jobId: string | null; readonly checkRunUrl: string | null }
    | { readonly kind: 'refused'; readonly messageKey: ReviewErrorMessageKey };

export function readReviewStartResponse(httpStatus: number, responseBody: unknown): ReviewStartResponse {
    const bodyObject = typeof responseBody === 'object' && responseBody !== null ? responseBody : {};
    if (httpStatus === 202) {
        const jobId: unknown = Reflect.get(bodyObject, 'jobId');
        const checkRunUrl: unknown = Reflect.get(bodyObject, 'checkRunUrl');
        return {
            kind: 'started',
            jobId: typeof jobId === 'string' ? jobId : null,
            checkRunUrl: typeof checkRunUrl === 'string' ? checkRunUrl : null,
        };
    }
    return { kind: 'refused', messageKey: reviewErrorMessageKey(Reflect.get(bodyObject, 'error')) };
}
