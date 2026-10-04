/**
 * Unit Tests: Backoff-Retry für transiente Vertex-Fehler (ROADMAP §6,
 * F5-Befund 2026-09-16 — ein Kapazitäts-429 auf dem Draft-Call killte den Job).
 *
 * Die Fehler sind ECHTE SDK-ApiErrors, damit die strukturelle Erkennung gegen
 * die Form geprüft wird, die @google/genai tatsächlich wirft.
 */
import { ApiError } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import {
    ModelUnavailableError,
    findTransientVertexFailure,
    resolveRetryDelayMs,
    runWithTransientRetry,
} from '@/lib/pipeline/vertex-retry';
import type { TransientRetryPolicy } from '@/lib/pipeline/vertex-retry';

const RESOURCE_EXHAUSTED_BODY =
    '{"error":{"code":429,"message":"Resource exhausted. Please try again later.","status":"RESOURCE_EXHAUSTED"}}';

function buildCapacityError(): ApiError {
    return new ApiError({ message: RESOURCE_EXHAUSTED_BODY, status: 429 });
}

function buildInstantPolicy(): TransientRetryPolicy & { waitMs: ReturnType<typeof vi.fn> } {
    return {
        retryDelaysMs: [2_000, 6_000],
        waitMs: vi.fn(() => Promise.resolve()),
        jitterMs: () => 0,
    };
}

describe('findTransientVertexFailure', () => {
    it.each([429, 500, 502, 503, 504])('erkennt HTTP %i als transient', (httpStatus) => {
        const sdkFailure = new ApiError({ message: 'upstream', status: httpStatus });

        expect(findTransientVertexFailure(sdkFailure)).toBe(sdkFailure);
    });

    it('400/403/404 sind keine Kapazitätsfrage — kein Retry', () => {
        for (const httpStatus of [400, 403, 404]) {
            expect(findTransientVertexFailure(new ApiError({ message: 'client', status: httpStatus }))).toBeNull();
        }
    });

    it('ein Verbindungsabbruch (undici "fetch failed", kein HTTP-Status) zaehlt als transient — Status 0', () => {
        const connectionFailure = findTransientVertexFailure(new TypeError('fetch failed'));

        expect(connectionFailure?.status).toBe(0);
        // Auch hinter einem typisierten Wrapper (VerdictCallError → cause).
        expect(findTransientVertexFailure(new Error('api_error', { cause: new TypeError('fetch failed') }))?.status).toBe(0);
    });

    it('andere TypeErrors (Programmierfehler) sind nicht transient', () => {
        expect(findTransientVertexFailure(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBeNull();
    });

    it('findet den SDK-Fehler eine Ebene tiefer als cause (typisierte Wrapper)', () => {
        const sdkFailure = buildCapacityError();
        const wrappedFailure = new Error('VerdictCall api_error', { cause: sdkFailure });

        expect(findTransientVertexFailure(wrappedFailure)).toBe(sdkFailure);
    });
});

describe('resolveRetryDelayMs', () => {
    it('nutzt den Backoff plus Jitter, wenn der Fehler keinen retryDelay nennt', () => {
        expect(resolveRetryDelayMs(buildCapacityError(), 2_000, 300)).toBe(2_300);
    });

    it('ein längerer server-seitiger retryDelay gewinnt, gedeckelt auf 15 s', () => {
        const hintedFailure = new ApiError({ message: '{"retryDelay": "9s"}', status: 429 });
        const excessiveHintFailure = new ApiError({ message: '{"retryDelay": "120s"}', status: 429 });

        expect(resolveRetryDelayMs(hintedFailure, 2_000, 0)).toBe(9_000);
        expect(resolveRetryDelayMs(excessiveHintFailure, 2_000, 0)).toBe(15_000);
    });
});

describe('runWithTransientRetry', () => {
    it('heilt einen einmaligen 429 nach dem ersten Backoff', async () => {
        const retryPolicy = buildInstantPolicy();
        const modelCall = vi.fn()
            .mockRejectedValueOnce(buildCapacityError())
            .mockResolvedValueOnce('review');

        const callOutcome = await runWithTransientRetry(modelCall, 'draft', retryPolicy);

        expect(callOutcome).toBe('review');
        expect(modelCall).toHaveBeenCalledTimes(2);
        expect(retryPolicy.waitMs).toHaveBeenCalledWith(2_000);
    });

    it('wirft nach drei transienten Fehlschlägen einen ModelUnavailableError mit Versuchszahl', async () => {
        const retryPolicy = buildInstantPolicy();
        const modelCall = vi.fn().mockRejectedValue(buildCapacityError());

        const retryOutcome = runWithTransientRetry(modelCall, 'draft', retryPolicy);

        await expect(retryOutcome).rejects.toBeInstanceOf(ModelUnavailableError);
        await expect(retryOutcome).rejects.toMatchObject({ attemptCount: 3, callLabel: 'draft' });
        expect(modelCall).toHaveBeenCalledTimes(3);
        expect(retryPolicy.waitMs.mock.calls).toEqual([[2_000], [6_000]]);
    });

    it('propagiert nicht-transiente Fehler sofort und unverändert', async () => {
        const retryPolicy = buildInstantPolicy();
        const permissionFailure = new ApiError({ message: 'permission denied', status: 403 });
        const modelCall = vi.fn().mockRejectedValue(permissionFailure);

        await expect(runWithTransientRetry(modelCall, 'draft', retryPolicy)).rejects.toBe(permissionFailure);
        expect(modelCall).toHaveBeenCalledTimes(1);
        expect(retryPolicy.waitMs).not.toHaveBeenCalled();
    });

    it('ein "fetch failed" nach dem 300-s-Header-Timeout wird NICHT wiederholt (60-s-Guard)', async () => {
        vi.useFakeTimers();
        try {
            const retryPolicy = buildInstantPolicy();
            const timedOutCall = vi.fn(() => {
                vi.advanceTimersByTime(306_000);
                return Promise.reject(new TypeError('fetch failed'));
            });

            await expect(runWithTransientRetry(timedOutCall, 'second_opinion', retryPolicy)).rejects.toBeInstanceOf(ModelUnavailableError);
            expect(timedOutCall).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('wiederholt keinen Versuch, der selbst schon länger als 60 s lief (300-s-Routenbudget)', async () => {
        vi.useFakeTimers();
        try {
            const retryPolicy = buildInstantPolicy();
            const slowModelCall = vi.fn(() => {
                vi.advanceTimersByTime(61_000);
                return Promise.reject(buildCapacityError());
            });

            const retryOutcome = runWithTransientRetry(slowModelCall, 'escalate_full', retryPolicy);

            await expect(retryOutcome).rejects.toMatchObject({ attemptCount: 1 });
            expect(retryPolicy.waitMs).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});
