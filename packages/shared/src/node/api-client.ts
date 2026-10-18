/**
 * HTTP client for the Gatekeeper API (POST /api/cli/scan + polling).
 * Uses native fetch (Node >= 20).
 *
 * Verschoben aus packages/cli/src/api.ts (MCP_SPEC.md §3.1). Additiv für den
 * MCP-Server: `source`/`rerollLimit` beim Submit, Einzel-Poll `fetchScanStatus`
 * (der MCP-Scan-Tool-Loop pollt selbst, §3.5) und `retryAfterSeconds` am
 * ApiError (Grundlage der quota_exceeded-Message, §6).
 */
import type { ScanPollResponse, ScanSubmitResponse } from '@unslop/shared';
import { SecretUploadBlockedError, findWirePayloadSecret } from './diff-upload-guard.js';
import { containsSecretLine } from './secret-filter.js';
import type { RepoContextPackage } from '../repo-context.js';

export class ApiError extends Error {
    constructor(
        message: string,
        readonly httpStatus: number | null,
        readonly retryAfterSeconds: number | null = null,
    ) {
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
    /** Metering-Lane (§4.7): fehlt = 'cli' (Server-Default). */
    readonly source?: 'cli' | 'mcp';
    /** Client-konfigurierte Re-roll-Schwelle (§4.5); Server clamped [0, 50]. */
    readonly rerollLimit?: number;
    /**
     * Lokal gebautes Repo-Kontextpaket (REPO_CONTEXT_SPEC §9 1b). Fehlt es,
     * prüft der Server nur den Diff, wie vor Stufe 1.
     */
    readonly contextPackage?: RepoContextPackage;
}

/**
 * Dieselbe letzte Verteidigungslinie wie für die Skalar-Felder, für das
 * Paket: `buildLocalRepoContext` hat Abschnitte mit Treffer schon entfernt;
 * ein Paket aus anderer Quelle wird hier trotzdem geprüft, bevor fetch startet.
 */
function assertContextPackageHasNoSecret(contextPackage: RepoContextPackage | undefined): void {
    const secretSection = contextPackage?.sections.find(
        (contextSection) => containsSecretLine(contextSection.content),
    );
    if (secretSection) {
        throw new SecretUploadBlockedError({
            path: `(context:${secretSection.path})`, line: 0, patternClass: 'secret in repository context',
        });
    }
}

export async function submitScan(params: SubmitScanParams): Promise<string> {
    const wirePayload = {
        repoFullName: params.repoFullName,
        diff: params.diff,
        baseSha: params.baseSha,
        headSha: params.headSha,
        dirty: params.dirty,
        ...(params.source ? { source: params.source } : {}),
        ...(params.rerollLimit !== undefined ? { rerollLimit: params.rerollLimit } : {}),
    };

    // Letzte Verteidigungslinie (ROADMAP §13): der KOMPLETTE Payload wird vor
    // dem fetch geprüft — auch Metadaten-Felder, nicht nur der Diff. Wirft
    // statt zu senden; die Message enthält nie das Material selbst.
    const payloadSecret = findWirePayloadSecret(wirePayload);
    if (payloadSecret) {
        throw new SecretUploadBlockedError(payloadSecret);
    }
    assertContextPackageHasNoSecret(params.contextPackage);

    const response = await fetchOrThrow(`${params.baseUrl}/api/cli/scan`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': params.apiKey,
        },
        body: JSON.stringify(
            params.contextPackage ? { ...wirePayload, contextPackage: params.contextPackage } : wirePayload,
        ),
    });

    if (response.status !== 202) {
        throw await toApiError(response);
    }

    const submitBody = await response.json() as ScanSubmitResponse;
    return submitBody.jobId;
}

/** Ein einzelner Poll von GET /api/cli/scan/[jobId] — ohne Warte-Loop. */
export async function fetchScanStatus(
    params: { readonly baseUrl: string; readonly apiKey: string; readonly jobId: string },
): Promise<ScanPollResponse> {
    const response = await fetchOrThrow(`${params.baseUrl}/api/cli/scan/${params.jobId}`, {
        headers: { 'x-api-key': params.apiKey },
    });

    if (!response.ok) {
        throw await toApiError(response);
    }

    return await response.json() as ScanPollResponse;
}

interface PollParams {
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly jobId: string;
    readonly timeoutMs: number;
}

const INITIAL_POLL_DELAY_MS = 2000;
const MAX_POLL_DELAY_MS = 5000;

/** Polls until done/error or timeout. Returns the final response. */
export async function pollUntilDone(params: PollParams): Promise<ScanPollResponse> {
    const deadline = Date.now() + params.timeoutMs;
    let pollDelayMs = INITIAL_POLL_DELAY_MS;

    while (Date.now() < deadline) {
        await sleep(Math.min(pollDelayMs, Math.max(0, deadline - Date.now())));
        pollDelayMs = Math.min(pollDelayMs + 1000, MAX_POLL_DELAY_MS);

        const pollBody = await fetchScanStatus(params);
        if (pollBody.status === 'done' || pollBody.status === 'error') {
            return pollBody;
        }
    }

    throw new ApiError(`Scan timed out after ${Math.round(params.timeoutMs / 1000)}s.`, null);
}

// =============================================================================
// Repo connect (auto-connect from the scan flow)
// =============================================================================

interface RepoApiParams {
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly repoFullName: string;
}

export async function connectRepo(params: RepoApiParams): Promise<void> {
    const response = await fetchOrThrow(`${params.baseUrl}/api/cli/repos/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': params.apiKey },
        body: JSON.stringify({ repoFullName: params.repoFullName }),
    });

    if (response.status !== 202) {
        throw await toApiError(response);
    }
}

/** Ein einzelner Status-Poll von GET /api/cli/repos/status (MCP-Connect-Loop, §3.5). */
export async function fetchRepoStatus(params: RepoApiParams): Promise<string> {
    const response = await fetchOrThrow(
        `${params.baseUrl}/api/cli/repos/status?repo=${encodeURIComponent(params.repoFullName)}`,
        { headers: { 'x-api-key': params.apiKey } },
    );
    if (!response.ok) {
        throw await toApiError(response);
    }
    const statusBody = await response.json() as { status: string };
    return statusBody.status;
}

// =============================================================================
// PR review (MCP_SPEC.md §4.7)
// =============================================================================

interface SubmitPrReviewParams {
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly repoFullName: string;
    readonly prNumber: number;
}

export interface PrReviewSubmitResponse {
    readonly jobId: string;
    readonly checkRunUrl: string | null;
}

export async function submitPrReview(params: SubmitPrReviewParams): Promise<PrReviewSubmitResponse> {
    const response = await fetchOrThrow(`${params.baseUrl}/api/cli/pr/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': params.apiKey },
        body: JSON.stringify({ repoFullName: params.repoFullName, prNumber: params.prNumber }),
    });

    if (response.status !== 202) {
        throw await toApiError(response);
    }

    return await response.json() as PrReviewSubmitResponse;
}

// =============================================================================
// Finding resolution (MCP_SPEC.md §4.7, Phase 3)
// =============================================================================

interface ResolveFindingParams {
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly repoFullName: string;
    readonly findingId: string;
    readonly rationale: string;
    readonly prNumber?: number;
    readonly commitSha?: string;
}

export interface FindingResolutionResponse {
    readonly ledgerId: string;
    readonly githubResolved: boolean;
    readonly githubSkippedReason?: string;
}

export async function submitFindingResolution(
    params: ResolveFindingParams,
): Promise<FindingResolutionResponse> {
    const response = await fetchOrThrow(`${params.baseUrl}/api/cli/findings/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': params.apiKey },
        body: JSON.stringify({
            repoFullName: params.repoFullName,
            findingId: params.findingId,
            rationale: params.rationale,
            ...(params.prNumber !== undefined ? { prNumber: params.prNumber } : {}),
            ...(params.commitSha !== undefined ? { commitSha: params.commitSha } : {}),
        }),
    });

    if (!response.ok) {
        throw await toApiError(response);
    }

    return await response.json() as FindingResolutionResponse;
}

/** Polls the repo status until 'active'/'error' or timeout. */
export async function waitForRepoActive(params: RepoApiParams, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    let lastStatus = 'syncing';

    while (Date.now() < deadline) {
        await sleep(3000);
        const response = await fetchOrThrow(
            `${params.baseUrl}/api/cli/repos/status?repo=${encodeURIComponent(params.repoFullName)}`,
            { headers: { 'x-api-key': params.apiKey } },
        );
        if (!response.ok) {
            throw await toApiError(response);
        }
        const statusBody = await response.json() as { status: string };
        lastStatus = statusBody.status;
        if (lastStatus === 'active' || lastStatus === 'error') return lastStatus;
    }

    return lastStatus;
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

async function toApiError(response: Response): Promise<ApiError> {
    return new ApiError(
        await readErrorCode(response),
        response.status,
        readRetryAfterSeconds(response),
    );
}

async function readErrorCode(response: Response): Promise<string> {
    try {
        const errorBody = await response.json() as { error?: string };
        return errorBody.error ?? `http_${response.status}`;
    } catch {
        return `http_${response.status}`;
    }
}

function readRetryAfterSeconds(response: Response): number | null {
    const retryAfterHeader = response.headers.get('Retry-After');
    if (!retryAfterHeader) return null;
    const parsedSeconds = Number.parseInt(retryAfterHeader, 10);
    return Number.isFinite(parsedSeconds) && parsedSeconds >= 0 ? parsedSeconds : null;
}

function sleep(durationMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
}
