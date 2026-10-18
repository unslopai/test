/**
 * Tests des gemeinsamen Einreiche-Pfads (GITHUB_APP_SPEC.md §4.10) für die
 * Quelle 'dashboard'. Der MCP-Weg ist über die unveränderte Route-Suite
 * `src/app/api/cli/pr/review/billing-gate.test.ts` abgedeckt.
 *
 * Gemockt wird nur die Systemgrenze (Supabase, GitHub, Worker, after());
 * consumeScanQuota läuft echt, damit die Quota-Spur mitgeprüft ist.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanEntitlements } from '@/lib/billing/plan-config';

const {
    rpcMock,
    jobInsertMock,
    jobInsertSingleMock,
    checkRunAttachEqMock,
    getInstallationTokenMock,
    getPullRequestHeadMock,
    getPullRequestHeadShaMock,
    startGatekeeperCheckRunMock,
    processReviewJobMock,
    afterMock,
} = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    jobInsertMock: vi.fn(),
    jobInsertSingleMock: vi.fn(),
    checkRunAttachEqMock: vi.fn(),
    getInstallationTokenMock: vi.fn(),
    getPullRequestHeadMock: vi.fn(),
    getPullRequestHeadShaMock: vi.fn(),
    startGatekeeperCheckRunMock: vi.fn(),
    processReviewJobMock: vi.fn(),
    afterMock: vi.fn(),
}));

vi.mock('@/lib/worker', () => ({ processReviewJob: processReviewJobMock }));
vi.mock('@/lib/github', () => ({
    getPullRequestHead: getPullRequestHeadMock,
    getPullRequestHeadSha: getPullRequestHeadShaMock,
}));
vi.mock('@/lib/check-run', () => ({ startGatekeeperCheckRun: startGatekeeperCheckRunMock }));
vi.mock('@/lib/github-app', async (importOriginal) => {
    const actualGithubApp = await importOriginal<typeof import('@/lib/github-app')>();
    return { ...actualGithubApp, getInstallationToken: getInstallationTokenMock };
});
vi.mock('next/server', async (importOriginal) => {
    const actualNextServer = await importOriginal<typeof import('next/server')>();
    return { ...actualNextServer, after: afterMock };
});
vi.mock('@/lib/supabase', () => ({
    supabase: {
        rpc: rpcMock,
        from: () => ({
            insert: jobInsertMock,
            update: () => ({ eq: () => ({ eq: checkRunAttachEqMock }) }),
        }),
    },
}));

const { submitPullRequestReview, prReviewRejectionResponse } = await import('./submit-pr-review');
type PrReviewSubmission = Parameters<typeof submitPullRequestReview>[0];

const PR_HEAD_SHA_UNDER_TEST = 'a'.repeat(40);

const PLAN_UNDER_TEST: PlanEntitlements = {
    displayName: 'Pro',
    scansPerHour: 60,
    scansPerMonth: 500,
    maxActiveRepos: 10,
    maxApiKeys: 10,
    proEscalationsPerMonth: 50,
    trialScans: 100,
    trialProEscalations: 5,
};

function buildDashboardSubmission(): PrReviewSubmission {
    return {
        target: {
            repositoryId: 'repo-under-test',
            ownerUserId: 'owner-under-test',
            repoFullName: 'acme/widgets',
            installationId: 4711,
        },
        prNumber: 16,
        source: 'dashboard',
        plan: PLAN_UNDER_TEST,
        invocationStartedAtMs: 1_000,
    };
}

describe('submitPullRequestReview (source dashboard)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rpcMock.mockResolvedValue({ data: 'allowed', error: null });
        getInstallationTokenMock.mockResolvedValue('installation-token-under-test');
        getPullRequestHeadMock.mockResolvedValue({ headSha: PR_HEAD_SHA_UNDER_TEST, isOpen: true });
        startGatekeeperCheckRunMock.mockResolvedValue(90210);
        checkRunAttachEqMock.mockResolvedValue({ error: null });
        jobInsertMock.mockImplementation(() => ({ select: () => ({ single: jobInsertSingleMock }) }));
        jobInsertSingleMock.mockResolvedValue({ data: { id: 'job-under-test' }, error: null });
    });

    it('consumes quota in the full-window lane like a webhook review (60/500)', async () => {
        await submitPullRequestReview(buildDashboardSubmission());

        expect(rpcMock).toHaveBeenCalledWith('consume_scan_quota', {
            target_user_id: 'owner-under-test',
            hourly_max: 60,
            monthly_max: 500,
            trial_max: 100,
        });
    });

    it("inserts a webhook-shaped job with source 'dashboard' and schedules the worker", async () => {
        const submitOutcome = await submitPullRequestReview(buildDashboardSubmission());

        expect(submitOutcome).toEqual({
            kind: 'submitted',
            jobId: 'job-under-test',
            checkRunUrl: 'https://github.com/acme/widgets/pull/16/checks?check_run_id=90210',
        });
        const [persistedJobRow] = jobInsertMock.mock.calls[0] as [Record<string, unknown>];
        expect(persistedJobRow).toEqual({
            repository_id: 'repo-under-test',
            source: 'dashboard',
            status: 'pending',
            pr_number: 16,
            pr_url: 'https://github.com/acme/widgets/pull/16',
            payload: {
                repo_full_name: 'acme/widgets',
                pr_number: 16,
                pr_url: 'https://github.com/acme/widgets/pull/16',
                pr_head_sha: PR_HEAD_SHA_UNDER_TEST,
                action: 'dashboard_review',
            },
        });
        // Der Dashboard-Weg liest den Zustand mit; der reine SHA-Lookup bleibt dem MCP-Weg.
        expect(getPullRequestHeadShaMock).not.toHaveBeenCalled();

        for (const [scheduledCallback] of afterMock.mock.calls) {
            await scheduledCallback();
        }
        expect(processReviewJobMock).toHaveBeenCalledWith('job-under-test', 'owner-under-test', 1_000);
    });

    it('rejects a pull request closed between listing and click as pr_not_open, without a job', async () => {
        getPullRequestHeadMock.mockResolvedValue({ headSha: PR_HEAD_SHA_UNDER_TEST, isOpen: false });

        const submitOutcome = await submitPullRequestReview(buildDashboardSubmission());

        expect(submitOutcome).toEqual({ kind: 'rejected', rejection: 'pr_not_open' });
        expect(jobInsertMock).not.toHaveBeenCalled();
        expect(startGatekeeperCheckRunMock).not.toHaveBeenCalled();
    });

    it('rejects an unreadable pull request as pr_not_found', async () => {
        getPullRequestHeadMock.mockRejectedValue(new Error('GitHub 404'));

        const submitOutcome = await submitPullRequestReview(buildDashboardSubmission());

        expect(submitOutcome).toEqual({ kind: 'rejected', rejection: 'pr_not_found' });
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it.each([
        ['trial_exhausted', 'trial_quota_exhausted'],
        ['quota_exceeded', 'rate_limit_exceeded'],
    ] as const)('maps the quota outcome %s to %s before any GitHub call', async (quotaOutcome, expectedRejection) => {
        rpcMock.mockResolvedValue({ data: quotaOutcome, error: null });

        const submitOutcome = await submitPullRequestReview(buildDashboardSubmission());

        expect(submitOutcome).toEqual({ kind: 'rejected', rejection: expectedRejection });
        expect(getInstallationTokenMock).not.toHaveBeenCalled();
    });
});

describe('prReviewRejectionResponse', () => {
    it.each([
        ['trial_quota_exhausted', 402],
        ['github_app_unavailable', 502],
        ['pr_not_found', 404],
        ['pr_not_open', 409],
        ['job_creation_failed', 500],
    ] as const)('answers %s with HTTP %i and no Retry-After', async (rejection, expectedStatus) => {
        const rejectionResponse = prReviewRejectionResponse(rejection);

        expect(rejectionResponse.status).toBe(expectedStatus);
        expect(await rejectionResponse.json()).toEqual({ error: rejection });
        expect(rejectionResponse.headers.get('Retry-After')).toBeNull();
    });

    it('answers rate_limit_exceeded with 429 and Retry-After', () => {
        const rejectionResponse = prReviewRejectionResponse('rate_limit_exceeded');

        expect(rejectionResponse.status).toBe(429);
        expect(rejectionResponse.headers.get('Retry-After')).toBe('3600');
    });
});
