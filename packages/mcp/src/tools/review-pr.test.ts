/**
 * unslop_review_pr-Tests (MCP_SPEC.md §3.5, Phase 2): 202-Ergebnis mit
 * jobId + checkRunUrl, App-only-Refusal, pr_not_found, Identity-Failure.
 */
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@unslop/shared/node';
import { runReviewPrTool } from './review-pr.js';
import type { ToolDeps } from '../tool-deps.js';

function buildDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
    return {
        api: {
            submitScan: vi.fn(),
            fetchScanStatus: vi.fn(),
            connectRepo: vi.fn(),
            fetchRepoStatus: vi.fn(),
            submitPrReview: vi.fn().mockResolvedValue({
                jobId: 'job-under-test',
                checkRunUrl: 'https://github.com/acme/widgets/pull/7/checks?check_run_id=90210',
            }),
            resolveFinding: vi.fn(),
        },
        resolveRepoContext: vi.fn() as unknown as ToolDeps['resolveRepoContext'],
        resolveRepoIdentity: () => ({
            ok: true,
            gitRoot: 'C:/fixtures/widgets',
            repoFullName: 'acme/widgets',
            headSha: 'b'.repeat(40),
        }),
        buildDiff: vi.fn() as unknown as ToolDeps['buildDiff'],
        buildContextPackage: vi.fn().mockResolvedValue(null),
        baseUrl: 'https://unslop.codes',
        rerollLimit: 3,
        waitMs: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function parseResultBody(toolResultText: string): Record<string, unknown> {
    return JSON.parse(toolResultText) as Record<string, unknown>;
}

describe('unslop_review_pr', () => {
    it('submits the review and returns jobId, prNumber, and checkRunUrl', async () => {
        const deps = buildDeps();

        const toolResult = await runReviewPrTool(deps, { prNumber: 7 });

        expect(toolResult.isError).toBeUndefined();
        const reviewOutcome = parseResultBody(toolResult.content[0].text);
        expect(reviewOutcome.jobId).toBe('job-under-test');
        expect(reviewOutcome.prNumber).toBe(7);
        expect(reviewOutcome.checkRunUrl).toContain('check_run_id=90210');
        expect(reviewOutcome.nextStep).toContain('unslop_get_result');
        expect(deps.api.submitPrReview).toHaveBeenCalledWith('acme/widgets', 7);
    });

    it('surfaces the App-only refusal as github_app_required', async () => {
        const deps = buildDeps();
        const depsWithOauthRepo = {
            ...deps,
            api: {
                ...deps.api,
                submitPrReview: vi.fn().mockRejectedValue(new ApiError('github_app_required', 409)),
            },
        };

        const toolResult = await runReviewPrTool(depsWithOauthRepo, { prNumber: 7 });

        expect(toolResult.isError).toBe(true);
        const errorBody = parseResultBody(toolResult.content[0].text) as { error?: { code: string } };
        expect(errorBody.error?.code).toBe('github_app_required');
    });

    it('maps an unknown PR onto pr_not_found', async () => {
        const deps = buildDeps();
        const depsWithMissingPr = {
            ...deps,
            api: {
                ...deps.api,
                submitPrReview: vi.fn().mockRejectedValue(new ApiError('pr_not_found', 404)),
            },
        };

        const toolResult = await runReviewPrTool(depsWithMissingPr, { prNumber: 999 });

        const errorBody = parseResultBody(toolResult.content[0].text) as { error?: { code: string } };
        expect(errorBody.error?.code).toBe('pr_not_found');
    });

    it('maps an unconnected repository onto the connect instruction', async () => {
        const deps = buildDeps();
        const depsWithUnconnectedRepo = {
            ...deps,
            api: {
                ...deps.api,
                submitPrReview: vi.fn().mockRejectedValue(new ApiError('repository_not_connected', 404)),
            },
        };

        const toolResult = await runReviewPrTool(depsWithUnconnectedRepo, { prNumber: 7 });

        const errorBody = parseResultBody(toolResult.content[0].text) as { error?: { code: string; message: string } };
        expect(errorBody.error?.code).toBe('repository_not_connected');
        expect(errorBody.error?.message).toContain('unslop_connect_repo');
    });

    it('maps an identity failure onto the typed error contract', async () => {
        const deps = buildDeps({
            resolveRepoIdentity: () => ({ ok: false, failureKind: 'not_a_git_repo', detail: 'not a repo' }),
        });

        const toolResult = await runReviewPrTool(deps, { prNumber: 7 });

        const errorBody = parseResultBody(toolResult.content[0].text) as { error?: { code: string } };
        expect(errorBody.error?.code).toBe('not_a_git_repo');
    });
});
