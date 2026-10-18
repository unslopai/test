'use client';

/**
 * Karte „Open pull requests“ der Repo-Detailseite (GITHUB_APP_SPEC.md §4.10):
 * die offenen PRs des Repos mit je einem Knopf „Review now“, damit der erste
 * Befund nicht auf den nächsten Push wartet. Bewusst Opt-in per Klick — kein
 * Review ohne Zustimmung des Besitzers.
 *
 * Fork-PRs, die das Fork-Gate beim Push überspringt, behalten ihren Knopf: der
 * Klick ist die ausdrückliche Zustimmung des Besitzers, der die Quota zahlt;
 * die Zeile sagt das vorher. Zustände und Fehlertexte kommen aus
 * open-pull-requests-state.ts, Fetches aus useOpenPullRequests und useReviewSubmissions.
 */
import { useCallback } from 'react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useToast } from '../../Toast';
import {
    deriveCardState,
    deriveReviewAction,
    type OpenPullRequestsCardState,
    type OpenPullRequestView,
    type PullRequestReviewAction,
    type ReviewErrorMessageKey,
    type ReviewSubmission,
} from './open-pull-requests-state';
import { useOpenPullRequests, type OpenPullRequestsSync } from './useOpenPullRequests';
import { useReviewSubmissions } from './useReviewSubmissions';

interface OpenPullRequestsCardProps {
    readonly repoId: string;
    /** Verbunden ohne App-Installation: keine Liste, Hinweis auf die App. */
    readonly isLegacyRepo: boolean;
    /** Installations-Link der App; null = kein GITHUB_APP_SLUG gesetzt. */
    readonly appInstallUrl: string | null;
    /** Nach einem gestarteten Review: die Scan-Historie zeigt den neuen Job. */
    readonly onReviewStarted: () => void;
}

export default function OpenPullRequestsCard({
    repoId,
    isLegacyRepo,
    appInstallUrl,
    onReviewStarted,
}: OpenPullRequestsCardProps) {
    const t = useTranslations('repoDetail.openPulls');
    const tErrors = useTranslations('repoDetail.openPulls.errors');
    const { showToast } = useToast();
    const openPullRequests = useOpenPullRequests(repoId, !isLegacyRepo, t('loadFailed'));
    const { refreshSilently } = openPullRequests;

    const handleReviewStarted = useCallback(() => {
        onReviewStarted();
        refreshSilently();
    }, [onReviewStarted, refreshSilently]);

    // Die Liste zeigt den Grund, wo sie kann (ein laufender Job, ein geschlossener PR).
    const handleReviewRefused = useCallback((messageKey: ReviewErrorMessageKey) => {
        showToast(tErrors(messageKey));
        refreshSilently();
    }, [showToast, tErrors, refreshSilently]);

    const reviewSubmissions = useReviewSubmissions(repoId, {
        onReviewStarted: handleReviewStarted,
        onReviewRefused: handleReviewRefused,
    });

    const cardState = deriveCardState({
        isLegacyRepo,
        loadState: openPullRequests.loadState,
        pullRequestCount: openPullRequests.pullRequests.length,
    });

    return (
        <section className="mb-10">
            <CardHeader openPullRequests={openPullRequests} showsRefresh={!isLegacyRepo} />
            <CardBody
                cardState={cardState}
                appInstallUrl={appInstallUrl}
                errorMessage={openPullRequests.errorMessage}
                pullRequests={openPullRequests.pullRequests}
                submissions={reviewSubmissions.submissions}
                onReviewNow={reviewSubmissions.startReview}
            />
        </section>
    );
}

function CardBody({ cardState, appInstallUrl, errorMessage, pullRequests, submissions, onReviewNow }: {
    readonly cardState: OpenPullRequestsCardState;
    readonly appInstallUrl: string | null;
    readonly errorMessage: string | null;
    readonly pullRequests: readonly OpenPullRequestView[];
    readonly submissions: ReadonlyMap<number, ReviewSubmission>;
    readonly onReviewNow: (prNumber: number) => void;
}) {
    const t = useTranslations('repoDetail.openPulls');

    if (cardState === 'legacy') {
        return <LegacyRepoHint appInstallUrl={appInstallUrl} />;
    }
    if (cardState === 'loading') {
        return <p className="py-4 text-sm text-ink-muted">{t('loading')}</p>;
    }
    if (cardState === 'error') {
        return (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {errorMessage ?? t('loadFailed')}
            </div>
        );
    }
    if (cardState === 'empty') {
        return <p className="rounded-xl border border-edge px-5 py-6 text-sm text-ink-muted">{t('empty')}</p>;
    }
    return <PullRequestList pullRequests={pullRequests} submissions={submissions} onReviewNow={onReviewNow} />;
}

function CardHeader({ openPullRequests, showsRefresh }: {
    readonly openPullRequests: OpenPullRequestsSync;
    readonly showsRefresh: boolean;
}) {
    const t = useTranslations('repoDetail.openPulls');

    return (
        <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('heading')}</h2>
            {showsRefresh && (
                <button
                    onClick={openPullRequests.refresh}
                    disabled={openPullRequests.loadState === 'loading'}
                    className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-overlay disabled:opacity-50"
                >
                    {openPullRequests.loadState === 'loading' ? t('refreshing') : t('refresh')}
                </button>
            )}
        </div>
    );
}

function PullRequestList({ pullRequests, submissions, onReviewNow }: {
    readonly pullRequests: readonly OpenPullRequestView[];
    readonly submissions: ReadonlyMap<number, ReviewSubmission>;
    readonly onReviewNow: (prNumber: number) => void;
}) {
    return (
        <ul className="grid gap-3">
            {pullRequests.map((pullRequest) => (
                <PullRequestRow
                    key={pullRequest.prNumber}
                    pullRequest={pullRequest}
                    reviewAction={deriveReviewAction(pullRequest, submissions.get(pullRequest.prNumber))}
                    onReviewNow={() => onReviewNow(pullRequest.prNumber)}
                />
            ))}
        </ul>
    );
}

function LegacyRepoHint({ appInstallUrl }: { readonly appInstallUrl: string | null }) {
    const t = useTranslations('repoDetail.openPulls');

    return (
        <div className="rounded-xl border border-edge bg-surface-raised px-5 py-4 text-sm text-ink-muted">
            <p>{t('legacyHint')}</p>
            {appInstallUrl && (
                <a href={appInstallUrl} className="mt-2 inline-block font-medium text-accent hover:underline">
                    {t('legacyInstall')}
                </a>
            )}
        </div>
    );
}

function PullRequestRow({ pullRequest, reviewAction, onReviewNow }: {
    readonly pullRequest: OpenPullRequestView;
    readonly reviewAction: PullRequestReviewAction;
    readonly onReviewNow: () => void;
}) {
    const t = useTranslations('repoDetail.openPulls');

    return (
        <li className="rounded-xl border border-edge bg-surface-raised px-5 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm">
                    <a
                        href={pullRequest.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-ink hover:underline"
                    >
                        {t('prLink', { number: pullRequest.prNumber })}
                    </a>
                    <span className="ml-2 break-words text-ink">{pullRequest.title}</span>
                    <PullRequestMeta pullRequest={pullRequest} />
                </div>
                <ReviewActionControl reviewAction={reviewAction} onReviewNow={onReviewNow} />
            </div>
            {pullRequest.skippedByForkGate && (
                <p className="mt-2 text-xs leading-relaxed text-warn">{t('forkGateHint')}</p>
            )}
        </li>
    );
}

function PullRequestMeta({ pullRequest }: { readonly pullRequest: OpenPullRequestView }) {
    const t = useTranslations('repoDetail.openPulls');

    return (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            {pullRequest.headBranch && <code className="break-all">{pullRequest.headBranch}</code>}
            {pullRequest.authorLogin && <span>{t('byAuthor', { author: pullRequest.authorLogin })}</span>}
            {pullRequest.isFork && (
                <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] font-medium uppercase">
                    {t('forkBadge')}
                </span>
            )}
        </p>
    );
}

const REVIEW_BUTTON_CLASS = 'shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition '
    + 'hover:bg-accent/85 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed';

function ReviewActionControl({ reviewAction, onReviewNow }: {
    readonly reviewAction: PullRequestReviewAction;
    readonly onReviewNow: () => void;
}) {
    const t = useTranslations('repoDetail.openPulls');
    const format = useFormatter();
    const now = useNow({ updateInterval: 60_000 });

    if (reviewAction.kind === 'running') {
        return <span className="shrink-0 text-xs text-warn">{t('running')}</span>;
    }
    if (reviewAction.kind === 'submitting') {
        return <button disabled className={REVIEW_BUTTON_CLASS}>{t('submitting')}</button>;
    }
    if (reviewAction.kind === 'started') {
        return (
            <span className="shrink-0 text-xs text-accent" aria-live="polite">
                {t('started')}
                {reviewAction.checkRunUrl && (
                    <a href={reviewAction.checkRunUrl} target="_blank" rel="noopener noreferrer" className="ml-2 underline">
                        {t('viewCheck')}
                    </a>
                )}
            </span>
        );
    }
    if (reviewAction.kind === 'review_again') {
        const relativeTime = format.relativeTime(new Date(reviewAction.reviewedAt), now);
        return (
            <span className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-ink-muted">
                    {reviewAction.onCurrentHead
                        ? t('lastReviewed', { relativeTime })
                        : t('lastReviewedEarlierCommit', { relativeTime })}
                </span>
                <button onClick={onReviewNow} className={REVIEW_BUTTON_CLASS}>{t('reviewAgain')}</button>
            </span>
        );
    }
    return <button onClick={onReviewNow} className={REVIEW_BUTTON_CLASS}>{t('reviewNow')}</button>;
}
