/**
 * HTTP-Client für die Gatekeeper-API (POST /api/cli/scan + Polling).
 * Nutzt natives fetch (Node >= 20).
 */
import type { ScanPollResponse, ScanSubmitResponse } from '@unslop/shared';

export class ApiError extends Error {
    constructor(message: string, readonly httpStatus: number | null) {
        super(message);
    }
}

interface SubmitScanParams {
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly repoFullName: string;
    readonly diff: string;
    readonly baseSha: string;
    readonly headSha: string;
    readonly dirty: boolean;
}

export async function submitScan(params: SubmitScanParams): Promise<string> {
    const response = await fetchOrThrow(`${params.baseUrl}/api/cli/scan`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': params.apiKey,
        },
        body: JSON.stringify({
            repoFullName: params.repoFullName,
            diff: params.diff,
            baseSha: params.baseSha,
            headSha: params.headSha,
            dirty: params.dirty,
        }),
    });

    if (response.status !== 202) {
        throw new ApiError(await readErrorCode(response), response.status);
    }

    const submitBody = await response.json() as ScanSubmitResponse;
    return submitBody.jobId;
}

interface PollParams {
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly jobId: string;
    readonly timeoutMs: number;
}

const INITIAL_POLL_DELAY_MS = 2000;
const MAX_POLL_DELAY_MS = 5000;

/** Pollt bis done/error oder Timeout. Gibt die finale Antwort zurück. */
export async function pollUntilDone(params: PollParams): Promise<ScanPollResponse> {
    const deadline = Date.now() + params.timeoutMs;
    let pollDelayMs = INITIAL_POLL_DELAY_MS;

    while (Date.now() < deadline) {
        await sleep(Math.min(pollDelayMs, Math.max(0, deadline - Date.now())));
        pollDelayMs = Math.min(pollDelayMs + 1000, MAX_POLL_DELAY_MS);

        const response = await fetchOrThrow(`${params.baseUrl}/api/cli/scan/${params.jobId}`, {
            headers: { 'x-api-key': params.apiKey },
        });

        if (!response.ok) {
            throw new ApiError(await readErrorCode(response), response.status);
        }

        const pollBody = await response.json() as ScanPollResponse;
        if (pollBody.status === 'done' || pollBody.status === 'error') {
            return pollBody;
        }
    }

    throw new ApiError(`Scan timed out after ${Math.round(params.timeoutMs / 1000)}s.`, null);
}

// =============================================================================
// Helpers
// =============================================================================

async function fetchOrThrow(url: string, init: RequestInit): Promise<Response> {
    try {
        return await fetch(url, init);
    } catch (networkError: unknown) {
        throw new ApiError(
            `Cannot reach the Gatekeeper backend at ${url}: ${(networkError as Error).message}`,
            null,
        );
    }
}

async function readErrorCode(response: Response): Promise<string> {
    try {
        const errorBody = await response.json() as { error?: string };
        return errorBody.error ?? `http_${response.status}`;
    } catch {
        return `http_${response.status}`;
    }
}

function sleep(durationMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
}
