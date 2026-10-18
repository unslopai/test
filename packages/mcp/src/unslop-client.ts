/**
 * UnslopApiClient — the injected seam of MCP_SPEC.md §3.2 (D2).
 *
 * Tool handlers receive this client and never read credentials, cwd, or the
 * filesystem directly. A future remote transport replaces only this factory
 * (and the repo-context resolver); tool schemas, error contract, and envelope
 * stay unchanged. Missing credentials surface lazily as a 401 ApiError per
 * call — startup stays non-fatal.
 */
import {
    ApiError,
    connectRepo,
    fetchRepoStatus,
    fetchScanStatus,
    submitFindingResolution,
    submitPrReview,
    submitScan,
} from '@unslop/shared/node';
import type { CliConfig, FindingResolutionResponse, PrReviewSubmitResponse } from '@unslop/shared/node';
import type { ScanPollResponse } from '@unslop/shared';
import type { RepoContextPackage } from '@unslop/shared/node';

export interface SubmitScanRequest {
    readonly repoFullName: string;
    readonly diff: string;
    readonly baseSha: string;
    readonly headSha: string;
    readonly dirty: boolean;
    readonly rerollLimit: number;
    /** Repository context built from the work tree (REPO_CONTEXT_SPEC §9 1b); null = scan the diff only. */
    readonly contextPackage: RepoContextPackage | null;
}

export interface ResolveFindingRequest {
    readonly repoFullName: string;
    readonly findingId: string;
    readonly rationale: string;
    readonly prNumber?: number;
    readonly commitSha?: string;
}

export interface UnslopApiClient {
    submitScan(request: SubmitScanRequest): Promise<string>;
    fetchScanStatus(jobId: string): Promise<ScanPollResponse>;
    connectRepo(repoFullName: string): Promise<void>;
    fetchRepoStatus(repoFullName: string): Promise<string>;
    submitPrReview(repoFullName: string, prNumber: number): Promise<PrReviewSubmitResponse>;
    resolveFinding(request: ResolveFindingRequest): Promise<FindingResolutionResponse>;
}

export function createUnslopApiClient(clientConfig: CliConfig): UnslopApiClient {
    const requireApiKey = (): string => {
        if (!clientConfig.apiKey) {
            // Same wire shape a revoked key produces — maps to not_authenticated (§6).
            throw new ApiError('invalid_api_key', 401);
        }
        return clientConfig.apiKey;
    };

    return {
        submitScan: (request: SubmitScanRequest) => submitScan({
            baseUrl: clientConfig.baseUrl,
            apiKey: requireApiKey(),
            repoFullName: request.repoFullName,
            diff: request.diff,
            baseSha: request.baseSha,
            headSha: request.headSha,
            dirty: request.dirty,
            source: 'mcp',
            rerollLimit: request.rerollLimit,
            ...(request.contextPackage ? { contextPackage: request.contextPackage } : {}),
        }),
        fetchScanStatus: (jobId: string) => fetchScanStatus({
            baseUrl: clientConfig.baseUrl,
            apiKey: requireApiKey(),
            jobId,
        }),
        connectRepo: (repoFullName: string) => connectRepo({
            baseUrl: clientConfig.baseUrl,
            apiKey: requireApiKey(),
            repoFullName,
        }),
        fetchRepoStatus: (repoFullName: string) => fetchRepoStatus({
            baseUrl: clientConfig.baseUrl,
            apiKey: requireApiKey(),
            repoFullName,
        }),
        submitPrReview: (repoFullName: string, prNumber: number) => submitPrReview({
            baseUrl: clientConfig.baseUrl,
            apiKey: requireApiKey(),
            repoFullName,
            prNumber,
        }),
        resolveFinding: (request: ResolveFindingRequest) => submitFindingResolution({
            baseUrl: clientConfig.baseUrl,
            apiKey: requireApiKey(),
            repoFullName: request.repoFullName,
            findingId: request.findingId,
            rationale: request.rationale,
            ...(request.prNumber !== undefined ? { prNumber: request.prNumber } : {}),
            ...(request.commitSha !== undefined ? { commitSha: request.commitSha } : {}),
        }),
    };
}
