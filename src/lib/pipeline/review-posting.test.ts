/**
 * Idempotentes Review-Posten (Live-Befund 2026-09-26, Job ecb4937c): GitHub
 * antwortete 502 und legte den Review trotzdem an — kein Doppel-Post, kein
 * verlorener Review.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubApiError } from '@/lib/github';
import { buildPipelineContext } from '@/lib/pipeline/testing/context-fixture';

const { createPullRequestReviewMock, listPullRequestReviewsMock } = vi.hoisted(() => ({
    createPullRequestReviewMock: vi.fn(),
    listPullRequestReviewsMock: vi.fn(),
}));

vi.mock('@/lib/github', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/github')>(),
    createPullRequestReview: createPullRequestReviewMock,
    listPullRequestReviews: listPullRequestReviewsMock,
}));

const { postReviewIdempotently } = await import('@/lib/pipeline/review-posting');

const JOB_STARTED_AT_MS = Date.UTC(2026, 8, 26, 13, 48, 41);
const REVIEW_BODY = '## 🛡️ Anti-Slop Gatekeeper Review\n\n**Result:** 44 issue(s) found';
const instantWait = { waitMs: vi.fn(() => Promise.resolve()) };

function buildReviewContext() {
    return buildPipelineContext({ headSha: 'af28c0b', jobStartedAtMs: JOB_STARTED_AT_MS, prNumber: 16 });
}

function badGateway(): GitHubApiError {
    return new GitHubApiError(502, '/repos/unslopai/test/pulls/16/reviews', '{"message":"Server Error"}');
}

describe('postReviewIdempotently', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('übernimmt einen trotz 502 angelegten Review statt doppelt zu posten', async () => {
        createPullRequestReviewMock.mockRejectedValueOnce(badGateway());
        listPullRequestReviewsMock.mockResolvedValue([
            { id: 5326099607, body: REVIEW_BODY, commitId: 'af28c0b', submittedAtMs: JOB_STARTED_AT_MS + 162_000 },
        ]);

        const postedReviewId = await postReviewIdempotently(buildReviewContext(), REVIEW_BODY, [], 'COMMENT', instantWait);

        expect(postedReviewId).toBe(5326099607);
        expect(createPullRequestReviewMock).toHaveBeenCalledTimes(1);
    });

    it('postet genau einmal neu, wenn der 502 wirklich nichts angelegt hat', async () => {
        createPullRequestReviewMock.mockRejectedValueOnce(badGateway()).mockResolvedValueOnce(777);
        listPullRequestReviewsMock.mockResolvedValue([]);

        const postedReviewId = await postReviewIdempotently(buildReviewContext(), REVIEW_BODY, [], 'COMMENT', instantWait);

        expect(postedReviewId).toBe(777);
        expect(createPullRequestReviewMock).toHaveBeenCalledTimes(2);
    });

    it('ignoriert Reviews eines früheren Jobs auf demselben Commit (Re-Run)', async () => {
        createPullRequestReviewMock.mockRejectedValueOnce(badGateway()).mockResolvedValueOnce(778);
        listPullRequestReviewsMock.mockResolvedValue([
            { id: 1, body: REVIEW_BODY, commitId: 'af28c0b', submittedAtMs: JOB_STARTED_AT_MS - 60_000 },
        ]);

        await expect(postReviewIdempotently(buildReviewContext(), REVIEW_BODY, [], 'COMMENT', instantWait))
            .resolves.toBe(778);
    });

    it('übernimmt einen Review, dessen Antwort mit `terminated` abbrach (Job 0d913d83, unslopai/test#16)', async () => {
        const socketClosed = new TypeError('terminated', { cause: { code: 'UND_ERR_SOCKET', message: 'other side closed' } });
        createPullRequestReviewMock.mockRejectedValueOnce(socketClosed);
        listPullRequestReviewsMock.mockResolvedValue([
            { id: 5400000001, body: REVIEW_BODY, commitId: 'af28c0b', submittedAtMs: JOB_STARTED_AT_MS + 195_000 },
        ]);

        const postedReviewId = await postReviewIdempotently(buildReviewContext(), REVIEW_BODY, [], 'COMMENT', instantWait);

        expect(postedReviewId).toBe(5400000001);
        expect(createPullRequestReviewMock).toHaveBeenCalledTimes(1);
    });

    it('ein eindeutiger Fehler (422) wird ohne Abgleich durchgereicht', async () => {
        const selfAuthored = new GitHubApiError(422, '/reviews', 'Can not request changes on your own pull request');
        createPullRequestReviewMock.mockRejectedValueOnce(selfAuthored);

        await expect(postReviewIdempotently(buildReviewContext(), REVIEW_BODY, [], 'REQUEST_CHANGES', instantWait))
            .rejects.toBe(selfAuthored);
        expect(listPullRequestReviewsMock).not.toHaveBeenCalled();
    });
});
