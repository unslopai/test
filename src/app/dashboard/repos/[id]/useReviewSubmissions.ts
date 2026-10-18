'use client';

/**
 * "Review now" clicks of the open pull requests card (GITHUB_APP_SPEC.md
 * §4.10): POST /api/repos/[id]/review per pull request, the per-row
 * submission state, and the callbacks after a start or a refusal.
 *
 * Every request has its own AbortController; all of them are aborted on
 * unmount only, never on a re-render, so a slow POST cannot be cut off while
 * the server still creates the job.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    readReviewStartResponse,
    type ReviewErrorMessageKey,
    type ReviewSubmission,
} from './open-pull-requests-state';

export interface ReviewSubmissionCallbacks {
    /** After a review started: list and scan history show the new job. */
    readonly onReviewStarted: () => void;
    /** A refused or failed click; the component turns the key into a toast. */
    readonly onReviewRefused: (messageKey: ReviewErrorMessageKey) => void;
}

export interface ReviewSubmissionsSync {
    readonly submissions: ReadonlyMap<number, ReviewSubmission>;
    readonly startReview: (prNumber: number) => void;
}

function withSubmission(
    currentSubmissions: ReadonlyMap<number, ReviewSubmission>,
    prNumber: number,
    submission: ReviewSubmission | null,
): ReadonlyMap<number, ReviewSubmission> {
    const nextSubmissions = new Map(currentSubmissions);
    if (submission === null) {
        nextSubmissions.delete(prNumber);
    } else {
        nextSubmissions.set(prNumber, submission);
    }
    return nextSubmissions;
}

async function postReviewRequest(repoId: string, prNumber: number, signal: AbortSignal) {
    const response = await fetch(`/api/repos/${encodeURIComponent(repoId)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prNumber }),
        signal,
    });
    const responseBody: unknown = await response.json().catch(() => null);
    return readReviewStartResponse(response.status, responseBody);
}

export function useReviewSubmissions(repoId: string, callbacks: ReviewSubmissionCallbacks): ReviewSubmissionsSync {
    const { onReviewStarted, onReviewRefused } = callbacks;
    const [submissions, setSubmissions] = useState<ReadonlyMap<number, ReviewSubmission>>(new Map());
    const reviewRequestsRef = useRef(new Set<AbortController>());

    useEffect(() => {
        const pendingReviewRequests = reviewRequestsRef.current;
        return () => pendingReviewRequests.forEach((requestController) => requestController.abort());
    }, []);

    const startReview = useCallback((prNumber: number) => {
        const requestController = new AbortController();
        reviewRequestsRef.current.add(requestController);
        setSubmissions((currentSubmissions) => withSubmission(currentSubmissions, prNumber, { kind: 'submitting' }));

        void postReviewRequest(repoId, prNumber, requestController.signal)
            .then((startResponse) => {
                if (startResponse.kind === 'started') {
                    setSubmissions((currentSubmissions) => withSubmission(currentSubmissions, prNumber, startResponse));
                    onReviewStarted();
                    return;
                }
                setSubmissions((currentSubmissions) => withSubmission(currentSubmissions, prNumber, null));
                onReviewRefused(startResponse.messageKey);
            })
            .catch((reviewError: unknown) => {
                if (reviewError instanceof Error && reviewError.name === 'AbortError') return;
                console.error('[OpenPullRequests] Review request failed:', reviewError);
                setSubmissions((currentSubmissions) => withSubmission(currentSubmissions, prNumber, null));
                onReviewRefused('generic');
            })
            .finally(() => reviewRequestsRef.current.delete(requestController));
    }, [repoId, onReviewStarted, onReviewRefused]);

    return { submissions, startReview };
}
