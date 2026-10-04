/**
 * Pipeline-Routing-Tests für processReviewJob (MCP_SPEC.md §4.7).
 *
 * Seit source 'mcp' BEIDE Job-Formen trägt (Phase-1-Scans mit lokalem Diff,
 * Phase-2-PR-Reviews ohne Diff), entscheidet die PAYLOAD-Form über die
 * Pipeline. Regression für den Phase-1-Befund: source==='cli' als alleiniges
 * Kriterium schickte MCP-Scans in den PR-Pfad und ließ sie mit einem
 * Payload-Fehler sterben.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelUnavailableError } from '@/lib/pipeline/vertex-retry';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

const {
    reviewJobsUpdateMock,
    jobClaimSingleMock,
    repoMaybeSingleMock,
    runPipelineMock,
    resolveRepoAccessTokenMock,
    completeCheckRunMock,
} = vi.hoisted(() => ({
    reviewJobsUpdateMock: vi.fn(),
    jobClaimSingleMock: vi.fn(),
    repoMaybeSingleMock: vi.fn(),
    runPipelineMock: vi.fn(),
    resolveRepoAccessTokenMock: vi.fn(),
    completeCheckRunMock: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: (tableName: string) => {
            if (tableName === 'review_jobs') {
                return { update: reviewJobsUpdateMock };
            }
            // repositories (loadRepoRow): select().eq('user_id')…
            return {
                select: () => ({
                    eq: () => ({
                        eq: () => ({ maybeSingle: repoMaybeSingleMock }),
                        limit: () => ({ maybeSingle: repoMaybeSingleMock }),
                    }),
                }),
            };
        },
    },
}));
vi.mock('@/lib/repo-auth', () => ({ resolveRepoAccessToken: resolveRepoAccessTokenMock }));
vi.mock('@/lib/github-app', () => ({ getInstallationToken: vi.fn() }));
vi.mock('@/lib/pipeline/runner', () => ({ runPipeline: runPipelineMock }));
vi.mock('@/lib/check-run', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/check-run')>(),
    completeGatekeeperCheckRun: completeCheckRunMock,
}));

const { processReviewJob } = await import('@/lib/worker');

/**
 * Der Claim-Pfad chained update().eq().eq().select().single(); markJobError
 * awaited update().eq() direkt — das erste eq-Resultat ist deshalb beides:
 * Chain-Glied UND Thenable.
 */
function buildReviewJobsUpdateChain(): Record<string, unknown> {
    const claimContinuation = {
        eq: () => ({ select: () => ({ single: jobClaimSingleMock }) }),
        then: (onFulfilled: (updateOutcome: { error: null }) => unknown) =>
            Promise.resolve({ error: null }).then(onFulfilled),
    };
    return { eq: () => claimContinuation };
}

function mockClaimedJob(source: string, payload: Record<string, unknown>, checkRunId: number | null = null): void {
    jobClaimSingleMock.mockResolvedValue({
        data: {
            id: 'job-under-test',
            payload,
            source,
            repository_id: 'repo-under-test',
            check_run_id: checkRunId,
        },
        error: null,
    });
}

function executedStepIds(): string[] {
    const [, executedSteps] = runPipelineMock.mock.calls[0] as [PipelineContext, PipelineStep[]];
    return executedSteps.map((pipelineStep) => pipelineStep.id);
}

function errorStatusUpdates(): Record<string, unknown>[] {
    return reviewJobsUpdateMock.mock.calls
        .map(([updatePayload]) => updatePayload as Record<string, unknown>)
        .filter((updatePayload) => updatePayload.status === 'error');
}

describe('processReviewJob — pipeline routing by payload shape', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        reviewJobsUpdateMock.mockImplementation(() => buildReviewJobsUpdateChain());
        repoMaybeSingleMock.mockResolvedValue({
            data: {
                id: 'repo-under-test',
                pipeline_config: null,
                installation_id: 4711,
                detected_ecosystems: null,
            },
            error: null,
        });
        runPipelineMock.mockImplementation(
            async (initialContext: PipelineContext) => initialContext,
        );
        resolveRepoAccessTokenMock.mockResolvedValue({ token: 'installation-token', mode: 'app' });
    });

    it("routes an MCP SCAN job (source 'mcp' + diff payload) into the local-diff pipeline", async () => {
        mockClaimedJob('mcp', {
            repo_full_name: 'acme/widgets',
            diff: 'diff --git a/src/index.ts b/src/index.ts\n+const beta = 2;\n',
        });

        await processReviewJob('job-under-test', 'user-under-test');

        expect(runPipelineMock).toHaveBeenCalledTimes(1);
        expect(executedStepIds()[0]).toBe('cli-diff-loader');
        expect(executedStepIds()).not.toContain('github-reporter');
        // Lokale Diff-Jobs sprechen nie mit der GitHub API.
        expect(resolveRepoAccessTokenMock).not.toHaveBeenCalled();
        expect(errorStatusUpdates()).toHaveLength(0);
    });

    it("routes an MCP PR-REVIEW job (source 'mcp' + pr payload, no diff) into the PR pipeline", async () => {
        mockClaimedJob('mcp', {
            repo_full_name: 'acme/widgets',
            pr_number: 7,
            pr_head_sha: 'b'.repeat(40),
        });

        await processReviewJob('job-under-test', 'user-under-test');

        expect(runPipelineMock).toHaveBeenCalledTimes(1);
        expect(executedStepIds()[0]).toBe('diff-loader');
        // §4.7: die webhook-förmige Pipeline inkl. github-reporter läuft.
        expect(executedStepIds()).toContain('github-reporter');
        expect(resolveRepoAccessTokenMock).toHaveBeenCalledTimes(1);
        expect(errorStatusUpdates()).toHaveLength(0);
    });

    it("keeps routing CLI jobs (source 'cli') into the local-diff pipeline", async () => {
        mockClaimedJob('cli', {
            repo_full_name: 'acme/widgets',
            diff: 'diff --git a/src/index.ts b/src/index.ts\n+const beta = 2;\n',
        });

        await processReviewJob('job-under-test', 'user-under-test');

        expect(executedStepIds()[0]).toBe('cli-diff-loader');
        expect(resolveRepoAccessTokenMock).not.toHaveBeenCalled();
    });
});

describe('processReviewJob — Modell-Kapazität nach erschöpften Retries (ROADMAP §6)', () => {
    const capacityFailure = new ModelUnavailableError('ReviewerPass/draft/gemini-3.6-flash', 3, '429 RESOURCE_EXHAUSTED');

    beforeEach(() => {
        vi.clearAllMocks();
        reviewJobsUpdateMock.mockImplementation(() => buildReviewJobsUpdateChain());
        repoMaybeSingleMock.mockResolvedValue({
            data: { id: 'repo-under-test', pipeline_config: null, installation_id: 4711, detected_ecosystems: null },
            error: null,
        });
        resolveRepoAccessTokenMock.mockResolvedValue({ token: 'installation-token', mode: 'app' });
        runPipelineMock.mockRejectedValue(capacityFailure);
    });

    it('persistiert den Job-Fehler mit dem stabilen model_unavailable-Präfix', async () => {
        mockClaimedJob('cli', { repo_full_name: 'acme/widgets', diff: '+const beta = 2;\n' });

        await processReviewJob('job-under-test', 'user-under-test');

        const [errorUpdate] = errorStatusUpdates();
        expect(String(errorUpdate.error_message)).toMatch(/^\[model_unavailable\] .*429 RESOURCE_EXHAUSTED/);
    });

    it('schließt den PR-Check mit ehrlicher Re-run-Copy statt "internal error"', async () => {
        mockClaimedJob('webhook', { repo_full_name: 'acme/widgets', pr_number: 7 }, 99);

        await processReviewJob('job-under-test', 'user-under-test');

        expect(completeCheckRunMock).toHaveBeenCalledWith(
            undefined, 'acme/widgets', 99,
            expect.objectContaining({ conclusion: 'failure', title: 'Review failed: AI model temporarily unavailable' }),
        );
        const [, , , checkRunCopy] = completeCheckRunMock.mock.calls[0] as unknown[];
        expect(JSON.stringify(checkRunCopy)).not.toContain('RESOURCE_EXHAUSTED');
    });
});
