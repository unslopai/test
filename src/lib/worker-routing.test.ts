/**
 * Pipeline-Routing-Tests für processReviewJob (MCP_SPEC.md §4.7).
 *
 * Seit source 'mcp' BEIDE Job-Formen trägt (Phase-1-Scans mit lokalem Diff,
 * Phase-2-PR-Reviews ohne Diff), entscheidet die PAYLOAD-Form über die
 * Pipeline. Regression für den Phase-1-Befund: source==='cli' als alleiniges
 * Kriterium schickte MCP-Scans in den PR-Pfad und ließ sie mit einem
 * Payload-Fehler sterben.
 *
 * Dazu die Worker-Seite des Deadline Guards (DEADLINE_GUARD_SPEC D1/D9):
 * Job-Uhr ab Invocation-Start, Watchdog vor dem Plattform-Kill, Entschärfung
 * ab der Report-Phase und der Status-Guard im Fehlerpfad.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelUnavailableError } from '@/lib/pipeline/vertex-retry';
import type { PipelineRunHooks } from '@/lib/pipeline/runner';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

const {
    reviewJobsUpdateMock,
    jobClaimSingleMock,
    repoMaybeSingleMock,
    runPipelineMock,
    resolveRepoAccessTokenMock,
    completeCheckRunMock,
    errorPathEqMock,
} = vi.hoisted(() => ({
    reviewJobsUpdateMock: vi.fn(),
    jobClaimSingleMock: vi.fn(),
    repoMaybeSingleMock: vi.fn(),
    runPipelineMock: vi.fn(),
    resolveRepoAccessTokenMock: vi.fn(),
    completeCheckRunMock: vi.fn(() => Promise.resolve()),
    errorPathEqMock: vi.fn<(columnName: string, columnValue: unknown) => void>(),
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
 * awaited update().eq().eq() — das erste eq-Resultat ist deshalb beides:
 * Chain-Glied UND Thenable. Das zweite eq protokolliert seinen Filter.
 */
function buildReviewJobsUpdateChain(): Record<string, unknown> {
    const claimContinuation = {
        eq: (columnName: string, columnValue: unknown) => {
            errorPathEqMock(columnName, columnValue);
            return { select: () => ({ single: jobClaimSingleMock }) };
        },
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

        await processReviewJob('job-under-test', 'user-under-test', Date.now());

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

        await processReviewJob('job-under-test', 'user-under-test', Date.now());

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

        await processReviewJob('job-under-test', 'user-under-test', Date.now());

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

        await processReviewJob('job-under-test', 'user-under-test', Date.now());

        const [errorUpdate] = errorStatusUpdates();
        expect(String(errorUpdate.error_message)).toMatch(/^\[model_unavailable\] .*429 RESOURCE_EXHAUSTED/);
    });

    it('schließt den PR-Check mit ehrlicher Re-run-Copy statt "internal error"', async () => {
        mockClaimedJob('webhook', { repo_full_name: 'acme/widgets', pr_number: 7 }, 99);

        await processReviewJob('job-under-test', 'user-under-test', Date.now());

        expect(completeCheckRunMock).toHaveBeenCalledWith(
            undefined, 'acme/widgets', 99,
            expect.objectContaining({ conclusion: 'failure', title: 'Review failed: AI model temporarily unavailable' }),
        );
        const [, , , checkRunCopy] = completeCheckRunMock.mock.calls[0] as unknown[];
        expect(JSON.stringify(checkRunCopy)).not.toContain('RESOURCE_EXHAUSTED');
    });
});

describe('processReviewJob — Deadline Guard (DEADLINE_GUARD_SPEC D1/D9)', () => {
    const invocationStartedAtMs = Date.UTC(2026, 8, 26, 12, 0, 0);
    const watchdogFireDelayMs = 285_000;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ now: invocationStartedAtMs });
        reviewJobsUpdateMock.mockImplementation(() => buildReviewJobsUpdateChain());
        repoMaybeSingleMock.mockResolvedValue({
            data: { id: 'repo-under-test', pipeline_config: null, installation_id: 4711, detected_ecosystems: null },
            error: null,
        });
        resolveRepoAccessTokenMock.mockResolvedValue({ token: 'installation-token', mode: 'app' });
        mockClaimedJob('webhook', { repo_full_name: 'acme/widgets', pr_number: 7 }, 99);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function capturedRunHooks(): PipelineRunHooks {
        const [, , runHooks] = runPipelineMock.mock.calls[0] as [PipelineContext, PipelineStep[], PipelineRunHooks];
        return runHooks;
    }

    it('startet die Job-Uhr am Invocation-Start: LLM-Deadline = Start + 300 s − 30 s Reserve', async () => {
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext) => initialContext);

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        const [initialContext] = runPipelineMock.mock.calls[0] as [PipelineContext];
        expect(initialContext.jobStartedAtMs).toBe(invocationStartedAtMs);
        expect(initialContext.deadlineAtMs).toBe(invocationStartedAtMs + 270_000);
    });

    it('Watchdog feuert 15 s vor dem Kill: Job error mit [review_timeout], Check rot mit Re-run-Copy', async () => {
        runPipelineMock.mockImplementation(() => new Promise<never>(() => undefined));

        const jobRun = processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);
        await vi.advanceTimersByTimeAsync(watchdogFireDelayMs);
        await jobRun;

        const [errorUpdate] = errorStatusUpdates();
        expect(String(errorUpdate.error_message)).toMatch(/^\[review_timeout\] /);
        expect(errorPathEqMock).toHaveBeenCalledWith('status', 'processing');
        expect(completeCheckRunMock).toHaveBeenCalledWith(
            undefined, 'acme/widgets', 99,
            expect.objectContaining({ conclusion: 'failure', title: 'Review timed out' }),
        );
    });

    it('signalisiert der weiterlaufenden Pipeline den Abbruch, damit sie den Reporter nie erreicht', async () => {
        runPipelineMock.mockImplementation(() => new Promise<never>(() => undefined));

        const jobRun = processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);
        await vi.advanceTimersByTimeAsync(watchdogFireDelayMs);
        await jobRun;

        expect(capturedRunHooks().isCancelled()).toBe(true);
    });

    it('ist ab der Report-Phase entschärft: ein bereits geposteter Review kippt nie auf error', async () => {
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext, _steps: unknown, runHooks: PipelineRunHooks) => {
            runHooks.onPostLlmPhase();
            await new Promise((resolveAfterDelay) => setTimeout(resolveAfterDelay, watchdogFireDelayMs + 10_000));
            return initialContext;
        });

        const jobRun = processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);
        await vi.advanceTimersByTimeAsync(watchdogFireDelayMs + 10_000);
        await jobRun;

        expect(errorStatusUpdates()).toHaveLength(0);
        expect(capturedRunHooks().isCancelled()).toBe(false);
    });

    it('nennt übersprungene Stufen in der Check-Summary, die Conclusion-Regeln bleiben (§3.4, D8)', async () => {
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext) => ({
            ...initialContext,
            cascade: {
                ...initialContext.cascade,
                degradations: ['time_budget_exhausted'],
                skippedStages: ['second_opinion'],
            },
        }));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        const [, , , checkRunResult] = completeCheckRunMock.mock.calls[0] as unknown[];
        expect(checkRunResult).toMatchObject({
            conclusion: 'success',
            summary: expect.stringContaining('Reduced confidence: time budget exhausted — skipped: second opinion.'),
        });
    });

    it('nennt die Dateien eines gescheiterten Draft-Batches in der Check-Summary (draft_partial, LARGE_DIFF_RECALL_SPEC §9)', async () => {
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext) => ({
            ...initialContext,
            cascade: {
                ...initialContext.cascade,
                integrityScore: null,
                degradations: ['draft_partial'],
                draftUnreviewedFiles: ['src/lib/alpha.ts', 'src/lib/beta.ts'],
            },
        }));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        const [, , , checkRunResult] = completeCheckRunMock.mock.calls[0] as unknown[];
        expect(checkRunResult).toMatchObject({
            summary: expect.stringContaining(
                'Reduced coverage: the AI review failed on 2 files — not reviewed: src/lib/alpha.ts, src/lib/beta.ts.',
            ),
        });
    });

    it('ein schon finalisierter Job (Reaper war schneller) behält Status und roten Check', async () => {
        const { JobAlreadyFinalizedError } = await import('@/lib/pipeline/steps/result-persister-step');
        runPipelineMock.mockRejectedValue(new JobAlreadyFinalizedError('job-under-test'));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        expect(errorStatusUpdates()).toHaveLength(0);
        expect(completeCheckRunMock).not.toHaveBeenCalled();
    });

    it('eine fertige Pipeline vor der Watchdog-Zeit bleibt unberührt', async () => {
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext) => initialContext);

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);
        await vi.advanceTimersByTimeAsync(watchdogFireDelayMs);

        expect(errorStatusUpdates()).toHaveLength(0);
    });
});
