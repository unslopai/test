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
import { buildPrescanStats, buildPullRequestFile } from '@/lib/pipeline/testing/context-fixture';
import { formatUnreadFileTypesNotice, listDegradationNotices } from '@unslop/shared/degradation-notice';
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
    erroredRowsMock,
} = vi.hoisted(() => ({
    reviewJobsUpdateMock: vi.fn(),
    jobClaimSingleMock: vi.fn(),
    repoMaybeSingleMock: vi.fn(),
    runPipelineMock: vi.fn(),
    resolveRepoAccessTokenMock: vi.fn(),
    completeCheckRunMock: vi.fn(() => Promise.resolve()),
    errorPathEqMock: vi.fn<(columnName: string, columnValue: unknown) => void>(),
    erroredRowsMock: vi.fn<() => { id: string }[] | undefined>(),
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
vi.mock('@/lib/pipeline/runner', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/pipeline/runner')>(),
    runPipeline: runPipelineMock,
}));
vi.mock('@/lib/check-run', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/check-run')>(),
    completeGatekeeperCheckRun: completeCheckRunMock,
}));

const { processReviewJob } = await import('@/lib/worker');

/**
 * Der Claim-Pfad chained update().eq().eq().select().single(); markJobError
 * awaited update().eq().eq().select() — das select-Resultat ist deshalb
 * beides: Chain-Glied UND Thenable mit den umgestellten Zeilen
 * (`erroredRowsMock`, Default: eine Zeile; leer = ein anderer hat den Job schon beendet). Das
 * zweite eq protokolliert seinen Filter.
 */
function buildReviewJobsUpdateChain(): Record<string, unknown> {
    const returningRows = {
        single: jobClaimSingleMock,
        then: (onFulfilled: (updateOutcome: { data: { id: string }[]; error: null }) => unknown) =>
            Promise.resolve({ data: erroredRowsMock() ?? [{ id: 'job-under-test' }], error: null }).then(onFulfilled),
    };
    const claimContinuation = {
        eq: (columnName: string, columnValue: unknown) => {
            errorPathEqMock(columnName, columnValue);
            return { select: () => returningRows };
        },
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

    it('hands the status checkpoint to PR jobs only (GITHUB_APP_SPEC §4.9): local diff jobs have no PR lifecycle', async () => {
        mockClaimedJob('webhook', { repo_full_name: 'acme/widgets', pr_number: 7, pr_head_sha: 'b'.repeat(40) });
        await processReviewJob('job-under-test', 'user-under-test', Date.now());
        mockClaimedJob('cli', { repo_full_name: 'acme/widgets', diff: 'diff --git a/a.ts b/a.ts\n+const beta = 2;\n' });
        await processReviewJob('job-under-test', 'user-under-test', Date.now());

        const [prJobHooks, localDiffJobHooks] = runPipelineMock.mock.calls
            .map((runPipelineCall) => (runPipelineCall as [PipelineContext, PipelineStep[], PipelineRunHooks])[2]);
        expect(prJobHooks.isJobStillActive).toBeTypeOf('function');
        expect(localDiffJobHooks.isJobStillActive).toBeUndefined();
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

    it('hängt den Join des tiefen Passes direkt vor den Integrity-Scorer, in PR- und lokaler Pipeline (REPO_CONTEXT_SPEC §14.1)', async () => {
        mockClaimedJob('webhook', { repo_full_name: 'acme/widgets', pr_number: 7, pr_head_sha: 'b'.repeat(40) });
        await processReviewJob('job-under-test', 'user-under-test', Date.now());
        const prStepIds = executedStepIds();
        expect(prStepIds.indexOf('deep-lane-join')).toBe(prStepIds.indexOf('integrity-scorer') - 1);
        expect(prStepIds.indexOf('deep-lane-join')).toBeGreaterThan(prStepIds.indexOf('second-opinion-reviewer'));

        runPipelineMock.mockClear();
        mockClaimedJob('cli', { repo_full_name: 'acme/widgets', diff: 'diff --git a/a.ts b/a.ts\n+const beta = 2;\n' });
        await processReviewJob('job-under-test', 'user-under-test', Date.now());
        const localStepIds = executedStepIds();
        expect(localStepIds.indexOf('deep-lane-join')).toBe(localStepIds.indexOf('integrity-scorer') - 1);
    });

    it('startet mit tiefem Pass AUS ohne Repo-Config und mit an, wenn die Repo-Config ihn einschaltet (§14.8)', async () => {
        mockClaimedJob('webhook', { repo_full_name: 'acme/widgets', pr_number: 7, pr_head_sha: 'b'.repeat(40) });
        await processReviewJob('job-under-test', 'user-under-test', Date.now());
        const [defaultContext] = runPipelineMock.mock.calls[0] as [PipelineContext];
        expect(defaultContext.deepLaneConfig.enabled).toBe(false);
        expect(defaultContext.deepLane.status).toBe('disabled');

        runPipelineMock.mockClear();
        repoMaybeSingleMock.mockResolvedValue({
            data: {
                id: 'repo-under-test',
                pipeline_config: {
                    enabledStepIds: ['diff-loader', 'draft-reviewer', 'integrity-scorer', 'github-reporter'],
                    activeConditionIds: [],
                    overrideSmartDetection: false,
                    deepLane: { enabled: true, maxCostUsd: 0.1 },
                },
                installation_id: 4711,
                detected_ecosystems: null,
            },
            error: null,
        });
        mockClaimedJob('webhook', { repo_full_name: 'acme/widgets', pr_number: 7, pr_head_sha: 'b'.repeat(40) });
        await processReviewJob('job-under-test', 'user-under-test', Date.now());
        const [enabledContext] = runPipelineMock.mock.calls[0] as [PipelineContext];
        expect(enabledContext.deepLaneConfig).toEqual({ enabled: true, maxCostUsd: 0.1, deadlineMs: 150_000 });
        expect(enabledContext.deepLane.status).toBe('not_run');
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
            conclusion: 'neutral',
            title: 'No findings, review incomplete',
            summary: expect.stringContaining(
                'Reduced coverage: the AI review failed on 2 files — not reviewed: src/lib/alpha.ts, src/lib/beta.ts.',
            ),
        });
    });

    it('nennt einen nicht ganz gelaufenen tiefen Pass mit Grund und Dateien in der Check-Summary (§14.9)', async () => {
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext) => ({
            ...initialContext,
            cascade: { ...initialContext.cascade, integrityScore: 100, degradations: ['deep_lane_partial'] },
            deepLane: {
                ...initialContext.deepLane,
                status: 'degraded',
                degradations: ['deep_lane_partial'],
                unreviewedFiles: ['src/lib/gamma.ts'],
            },
        }));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        const [, , , checkRunResult] = completeCheckRunMock.mock.calls[0] as unknown[];
        expect(checkRunResult).toMatchObject({
            summary: expect.stringContaining(
                'Reduced coverage: the deep review pass did not check 1 file because part of the change was over its cost cap — '
                + 'not checked by it: src/lib/gamma.ts.',
            ),
        });
    });

    it('reiht die Hinweise der Check-Summary wie listDegradationNotices, mit der zweiten Draft-Runde (SPEC.md §8)', async () => {
        const reviewedFile = buildPullRequestFile({ filename: 'src/lib/alpha.ts' });
        const unreadGoFile = buildPullRequestFile({ filename: 'cmd/server/main.go' });
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext) => ({
            ...initialContext,
            cascade: {
                ...initialContext.cascade,
                integrityScore: null,
                degradations: ['draft_partial', 'time_budget_exhausted', 'repo_context_unavailable', 'draft_round2_failed', 'deep_lane_failed'],
                skippedStages: ['verifier'],
                draftUnreviewedFiles: ['src/lib/alpha.ts'],
            },
            prescanStats: buildPrescanStats({ degraded: true, unscannedFiles: ['infra/main.tf'] }),
            repoContext: { ...initialContext.repoContext, status: 'unavailable' },
            deepLane: { ...initialContext.deepLane, status: 'degraded', degradations: ['deep_lane_failed'], unreviewedFiles: ['src/lib/gamma.ts'] },
            // Eine geänderte Go-Datei ohne Modell-Review: ihr Satz steht nach allen sechs am Ende.
            prFiles: [reviewedFile, unreadGoFile],
            reviewableFiles: [reviewedFile],
        }));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        const sharedNotices = listDegradationNotices({
            skippedStages: ['verifier'],
            draftUnreviewedFiles: ['src/lib/alpha.ts'],
            prescan: { degraded: true, unscannedFiles: ['infra/main.tf'] },
            repoContext: { status: 'unavailable', paths: [], estimatedTokens: 0, omittedPaths: [] },
            degradations: ['draft_round2_failed'],
            deepLane: { status: 'degraded', degradations: ['deep_lane_failed'], unreviewedFiles: ['src/lib/gamma.ts'] },
        });
        const [, , , checkRunResult] = completeCheckRunMock.mock.calls[0] as unknown[];
        const checkSummary = (checkRunResult as { summary: string }).summary;
        const noticePositions = [...sharedNotices, formatUnreadFileTypesNotice(1, ['.go'])]
            .map((expectedNotice) => checkSummary.indexOf(expectedNotice));

        expect(sharedNotices).toHaveLength(6);
        expect(noticePositions).not.toContain(-1);
        expect(noticePositions).toEqual([...noticePositions].sort((left, right) => left - right));
    });

    it('nennt einen ausgefallenen Pre-Scan neben der Modell-Review in der Check-Summary (unslopai/test#29)', async () => {
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext) => ({
            ...initialContext,
            prescanStats: buildPrescanStats({ degraded: true, degradedReason: 'Prescan-Route antwortete mit HTTP 500.' }),
        }));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        const [, , , checkRunResult] = completeCheckRunMock.mock.calls[0] as unknown[];
        expect(checkRunResult).toMatchObject({
            conclusion: 'neutral',
            title: 'No findings, review incomplete',
            summary: expect.stringContaining(
                'Reduced coverage: the deterministic pre-scanner failed on this change — only the model review ran',
            ),
        });
    });

    it('nennt bei einem Teilausfall des Pre-Scans die Dateien ohne Pre-Scan in der Check-Summary', async () => {
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext) => ({
            ...initialContext,
            prescanStats: buildPrescanStats({
                degraded: true,
                degradedReason: '1 of 3 pre-scan batches did not run (1 files): HTTP 500',
                unscannedFiles: ['infra/main.tf'],
            }),
        }));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        const [, , , checkRunResult] = completeCheckRunMock.mock.calls[0] as unknown[];
        expect(checkRunResult).toMatchObject({
            conclusion: 'neutral',
            summary: expect.stringContaining(
                'Reduced coverage: the deterministic pre-scanner failed on 1 file — not checked by it: infra/main.tf.',
            ),
        });
    });

    it('nennt keinen Pre-Scan-Ausfall, wenn der Pre-Scan gelaufen ist', async () => {
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext) => ({
            ...initialContext,
            prescanStats: buildPrescanStats(),
        }));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        const [, , , checkRunResult] = completeCheckRunMock.mock.calls[0] as unknown[];
        expect(checkRunResult).toMatchObject({
            summary: expect.not.stringContaining('deterministic pre-scanner failed'),
        });
    });

    it('kennzeichnet die Check-Summary eines Modell-Reviews als KI-generiert (LEGAL_PAGES_SPEC §4a.3)', async () => {
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext) => initialContext);

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        const [, , , checkRunResult] = completeCheckRunMock.mock.calls[0] as unknown[];
        expect(checkRunResult).toMatchObject({
            conclusion: 'success',
            summary: expect.stringMatching(/_AI-generated\. Check it before you rely on it\._\n<!-- unslop:ai-generated -->$/),
        });
    });

    it('kennzeichnet die Check-Summary ohne Modell-Review nicht: deterministic_only, nothing_reviewed, Short-Circuit', async () => {
        runPipelineMock.mockImplementationOnce(async (initialContext: PipelineContext) => ({
            ...initialContext,
            llmSkipped: true,
            deterministicOnlyReason: 'Deterministic checks only: no model reviewed it.',
            prescanStats: buildPrescanStats({ llmSkipped: true }),
        }));
        runPipelineMock.mockImplementationOnce(async (initialContext: PipelineContext) => ({
            ...initialContext,
            shouldAbort: true,
            abortReason: 'No reviewable code files in this pull request.',
        }));
        // Short-Circuit des Pre-Scanners: Outcome 'reviewed', aber kein Modell lief.
        runPipelineMock.mockImplementationOnce(async (initialContext: PipelineContext) => ({
            ...initialContext,
            llmSkipped: true,
            prescanStats: buildPrescanStats({ llmSkipped: true }),
        }));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);
        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);
        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        const [deterministicOnlyResult, nothingReviewedResult, shortCircuitResult] = completeCheckRunMock.mock.calls
            .map((completeCall) => (completeCall as unknown[])[3]);
        expect(deterministicOnlyResult).toMatchObject({
            title: 'Deterministic checks only',
            summary: expect.not.stringContaining('AI-generated'),
        });
        expect(nothingReviewedResult).toMatchObject({
            title: 'Nothing to review',
            summary: expect.not.stringContaining('AI-generated'),
        });
        expect(shortCircuitResult).toMatchObject({
            conclusion: 'success',
            summary: expect.not.stringContaining('AI-generated'),
        });
    });

    it('ein schon finalisierter Job (Reaper war schneller) behält Status und roten Check', async () => {
        const { JobAlreadyFinalizedError } = await import('@/lib/pipeline/steps/result-persister-step');
        runPipelineMock.mockRejectedValue(new JobAlreadyFinalizedError('job-under-test'));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        expect(errorStatusUpdates()).toHaveLength(0);
        expect(completeCheckRunMock).not.toHaveBeenCalled();
    });

    it('ein von einem neueren Commit abgelöster Job schreibt weder Status noch Check (GITHUB_APP_SPEC §4.9)', async () => {
        const { JobNoLongerActiveError } = await import('@/lib/pipeline/runner');
        runPipelineMock.mockRejectedValue(new JobNoLongerActiveError('job-under-test', 'draft-reviewer'));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        // Der ablösende Webhook hat den Job auf 'error' [superseded] gestellt und den Check geschlossen.
        expect(errorStatusUpdates()).toHaveLength(0);
        expect(completeCheckRunMock).not.toHaveBeenCalled();
    });

    it('ein Step, der nach der Ablösung scheitert, überschreibt den Superseded-Check nicht', async () => {
        // Der Webhook hat die Zeile schon auf 'error' [superseded] gestellt: markJobError stellt nichts mehr um.
        erroredRowsMock.mockReturnValue([]);
        runPipelineMock.mockRejectedValue(new Error('Vertex 500 INTERNAL nach der Ablösung'));

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);

        expect(completeCheckRunMock).not.toHaveBeenCalled();
    });

    it('eine fertige Pipeline vor der Watchdog-Zeit bleibt unberührt', async () => {
        runPipelineMock.mockImplementation(async (initialContext: PipelineContext) => initialContext);

        await processReviewJob('job-under-test', 'user-under-test', invocationStartedAtMs);
        await vi.advanceTimersByTimeAsync(watchdogFireDelayMs);

        expect(errorStatusUpdates()).toHaveLength(0);
    });
});
