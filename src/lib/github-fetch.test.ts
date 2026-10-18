/**
 * githubFetch übersteht genau einen Verbindungsabbruch (Job 0d913d83,
 * unslopai/test#16, 2026-10-13: `TypeError: terminated`, cause
 * `UND_ERR_SOCKET other side closed`). HTTP-Fehler und POSTs bekommen keinen
 * Wiederholungsversuch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubApiError, githubFetch, isGitHubConnectionFailure } from '@/lib/github';

const fetchMock = vi.fn<typeof fetch>();

function socketClosedFailure(): TypeError {
    return new TypeError('terminated', { cause: { code: 'UND_ERR_SOCKET', message: 'other side closed' } });
}

function jsonResponse(responseStatus: number, responseBody: unknown): Response {
    return new Response(JSON.stringify(responseBody), { status: responseStatus });
}

/** Startet den Call und lässt die Pause vor dem Wiederholungsversuch verstreichen. */
async function settleWithRetryDelay<T>(pendingCall: Promise<T>): Promise<PromiseSettledResult<T>> {
    const settledCall = Promise.allSettled([pendingCall]);
    await vi.advanceTimersByTimeAsync(1_000);
    const [callOutcome] = await settledCall;
    return callOutcome;
}

describe('githubFetch — Verbindungsabbruch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('wiederholt einen GET nach UND_ERR_SOCKET genau einmal und liefert dessen Antwort', async () => {
        fetchMock
            .mockRejectedValueOnce(socketClosedFailure())
            .mockResolvedValueOnce(jsonResponse(200, [{ id: 777001 }]));

        const callOutcome = await settleWithRetryDelay(githubFetch<{ id: number }[]>('/repos/unslopai/test/pulls/16/reviews/1/comments', 'token-under-test'));

        expect(callOutcome).toEqual({ status: 'fulfilled', value: [{ id: 777001 }] });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('wiederholt auch, wenn erst das Lesen des Bodys abbricht', async () => {
        const truncatedResponse = jsonResponse(200, {});
        vi.spyOn(truncatedResponse, 'json').mockRejectedValue(socketClosedFailure());
        fetchMock
            .mockResolvedValueOnce(truncatedResponse)
            .mockResolvedValueOnce(jsonResponse(200, { id: 4711 }));

        const callOutcome = await settleWithRetryDelay(githubFetch<{ id: number }>('/repos/unslopai/test/pulls/16', 'token-under-test'));

        expect(callOutcome).toEqual({ status: 'fulfilled', value: { id: 4711 } });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gibt nach dem zweiten Abbruch auf und reicht den Fehler durch', async () => {
        fetchMock.mockRejectedValue(socketClosedFailure());

        const callOutcome = await settleWithRetryDelay(githubFetch('/repos/unslopai/test', 'token-under-test'));

        expect(callOutcome.status).toBe('rejected');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('wiederholt einen HTTP-Fehler (500) nie', async () => {
        fetchMock.mockResolvedValue(jsonResponse(500, { message: 'Server Error' }));

        const callOutcome = await settleWithRetryDelay(githubFetch('/repos/unslopai/test', 'token-under-test'));

        expect(callOutcome.status).toBe('rejected');
        expect((callOutcome as PromiseRejectedResult).reason).toBeInstanceOf(GitHubApiError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('wiederholt einen POST nie: ein zweiter Review oder Check Run wäre ein Duplikat', async () => {
        fetchMock.mockRejectedValueOnce(socketClosedFailure()).mockResolvedValueOnce(jsonResponse(201, { id: 1 }));

        const callOutcome = await settleWithRetryDelay(
            githubFetch('/repos/unslopai/test/check-runs', 'token-under-test', { method: 'POST', body: '{}' }),
        );

        expect(callOutcome.status).toBe('rejected');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('wiederholt den PATCH des Check-Abschlusses: er setzt einen vollständigen Zielzustand', async () => {
        fetchMock.mockRejectedValueOnce(socketClosedFailure()).mockResolvedValueOnce(jsonResponse(200, { id: 99 }));

        const callOutcome = await settleWithRetryDelay(
            githubFetch('/repos/unslopai/test/check-runs/99', 'token-under-test', { method: 'PATCH', body: '{}' }),
        );

        expect(callOutcome.status).toBe('fulfilled');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

describe('isGitHubConnectionFailure', () => {
    it.each([
        ['terminated', new TypeError('terminated')],
        ['fetch failed', new TypeError('fetch failed')],
        ['ECONNRESET im cause', new TypeError('network error', { cause: { code: 'ECONNRESET' } })],
        ['ETIMEDOUT im cause', new TypeError('network error', { cause: { code: 'ETIMEDOUT' } })],
        ['EAI_AGAIN im cause', new TypeError('network error', { cause: { code: 'EAI_AGAIN' } })],
    ])('erkennt %s', (_failureKind, requestFailure) => {
        expect(isGitHubConnectionFailure(requestFailure)).toBe(true);
    });

    it.each([
        ['einen HTTP-Fehler', new GitHubApiError(502, '/repos/unslopai/test', 'Bad Gateway')],
        ['einen anderen TypeError', new TypeError('Cannot read properties of undefined')],
        ['einen fremden cause-Code', new TypeError('network error', { cause: { code: 'ERR_INVALID_URL' } })],
    ])('erkennt %s nicht', (_failureKind, requestFailure) => {
        expect(isGitHubConnectionFailure(requestFailure)).toBe(false);
    });
});
