/**
 * Route-Level-Tests für POST /api/cli/pr/review (MCP_SPEC.md §4.7/§10).
 *
 * Gemockt wird ausschließlich die Systemgrenze (Supabase, GitHub, Worker,
 * after()) — resolveEntitlement und consumeScanQuota laufen echt gegen den
 * Mock, damit die reservierte MCP-Quota-Lane und die Fehlercode-Zuordnung
 * mitgeprüft sind. App-only-Garantie (§5.4): OAuth-Repos ⇒ 409.
 */
import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

const PRICE_PRO_MONTHLY_UNDER_TEST = 'pri_pro_monthly_under_test';
process.env.PADDLE_PRICE_PRO_MONTHLY = PRICE_PRO_MONTHLY_UNDER_TEST;

const {
    resolveApiKeyMock,
    rpcMock,
    membershipMaybeSingleMock,
    repoSingleMock,
    jobInsertMock,
    jobInsertSingleMock,
    checkRunAttachEqMock,
    getInstallationTokenMock,
    getPullRequestHeadShaMock,
    startGatekeeperCheckRunMock,
    processReviewJobMock,
    afterMock,
} = vi.hoisted(() => ({
    resolveApiKeyMock: vi.fn(),
    rpcMock: vi.fn(),
    membershipMaybeSingleMock: vi.fn(),
    repoSingleMock: vi.fn(),
    jobInsertMock: vi.fn(),
    jobInsertSingleMock: vi.fn(),
    checkRunAttachEqMock: vi.fn(),
    getInstallationTokenMock: vi.fn(),
    getPullRequestHeadShaMock: vi.fn(),
    startGatekeeperCheckRunMock: vi.fn(),
    processReviewJobMock: vi.fn(),
    afterMock: vi.fn(),
}));

vi.mock('@/lib/api-keys', () => ({ resolveApiKey: resolveApiKeyMock }));
vi.mock('@/lib/worker', () => ({ processReviewJob: processReviewJobMock }));
vi.mock('@/lib/github', () => ({ getPullRequestHeadSha: getPullRequestHeadShaMock }));
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
        from: (tableName: string) => {
            if (tableName === 'billing_account_members') {
                return { select: () => ({ eq: () => ({ maybeSingle: membershipMaybeSingleMock }) }) };
            }
            if (tableName === 'repositories') {
                return { select: () => ({ eq: () => ({ eq: () => ({ single: repoSingleMock }) }) }) };
            }
            // review_jobs: insert (Job) + update (check_run_id anheften)
            return {
                insert: jobInsertMock,
                update: () => ({ eq: () => ({ eq: checkRunAttachEqMock }) }),
            };
        },
    },
}));

const { POST } = await import('./route');
const { GitHubAppAuthError } = await import('@/lib/github-app');

afterAll(() => {
    delete process.env.PADDLE_PRICE_PRO_MONTHLY;
});

const PR_HEAD_SHA_UNDER_TEST = 'f'.repeat(40);

function buildReviewRequest(reviewBody: Record<string, unknown> | string): Request {
    return new Request('http://localhost/api/cli/pr/review', {
        method: 'POST',
        body: typeof reviewBody === 'string' ? reviewBody : JSON.stringify(reviewBody),
    });
}

function buildValidReviewBody(): Record<string, unknown> {
    return { repoFullName: 'acme/widgets', prNumber: 7 };
}

async function flushAfterCallbacks(): Promise<void> {
    for (const [scheduledCallback] of afterMock.mock.calls) {
        await scheduledCallback();
    }
}

describe('POST /api/cli/pr/review (MCP_SPEC §4.7)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveApiKeyMock.mockResolvedValue({ id: 'api-key-under-test', userId: 'user-under-test' });
        membershipMaybeSingleMock.mockResolvedValue({
            data: { billing_accounts: { status: 'active', paddle_price_id: PRICE_PRO_MONTHLY_UNDER_TEST } },
            error: null,
        });
        rpcMock.mockResolvedValue({ data: 'allowed', error: null });
        repoSingleMock.mockResolvedValue({
            data: { id: 'repo-under-test', user_id: 'user-under-test', status: 'active', installation_id: 4711 },
            error: null,
        });
        getInstallationTokenMock.mockResolvedValue('installation-token-under-test');
        getPullRequestHeadShaMock.mockResolvedValue(PR_HEAD_SHA_UNDER_TEST);
        startGatekeeperCheckRunMock.mockResolvedValue(90210);
        checkRunAttachEqMock.mockResolvedValue({ error: null });
        jobInsertMock.mockImplementation(() => ({ select: () => ({ single: jobInsertSingleMock }) }));
        jobInsertSingleMock.mockResolvedValue({ data: { id: 'job-under-test' }, error: null });
    });

    it('answers 401 invalid_api_key without touching entitlements', async () => {
        resolveApiKeyMock.mockResolvedValue(null);

        const response = await POST(buildReviewRequest(buildValidReviewBody()));

        expect(response.status).toBe(401);
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
    });

    it('answers 402 for a missing subscription before any quota is consumed', async () => {
        membershipMaybeSingleMock.mockResolvedValue({ data: null, error: null });

        const response = await POST(buildReviewRequest(buildValidReviewBody()));

        expect(response.status).toBe(402);
        expect(await response.json()).toEqual({ error: 'no_subscription' });
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it.each([
        ['invalid_json', 'not json at all'],
        ['invalid_repo_full_name', { repoFullName: 'no-slash', prNumber: 7 }],
        ['invalid_pr_number', { repoFullName: 'acme/widgets', prNumber: 0 }],
        ['invalid_pr_number', { repoFullName: 'acme/widgets', prNumber: 7.5 }],
    ] as const)('answers 422 %s and consumes NO quota', async (expectedErrorCode, malformedBody) => {
        const response = await POST(buildReviewRequest(malformedBody as Record<string, unknown> | string));

        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({ error: expectedErrorCode });
        expect(rpcMock).not.toHaveBeenCalled();
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it("consumes quota in the reserved 'mcp' lane (48/400, unreduced trial cap)", async () => {
        await POST(buildReviewRequest(buildValidReviewBody()));

        expect(rpcMock).toHaveBeenCalledWith('consume_scan_quota', {
            target_user_id: 'user-under-test',
            hourly_max: 48,
            monthly_max: 400,
            trial_max: 100,
        });
    });

    it('answers 429 with Retry-After when the quota window is spent', async () => {
        rpcMock.mockResolvedValue({ data: 'quota_exceeded', error: null });

        const response = await POST(buildReviewRequest(buildValidReviewBody()));

        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('3600');
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('answers 404 repository_not_connected for a repo that is not active', async () => {
        repoSingleMock.mockResolvedValue({
            data: { id: 'repo-under-test', user_id: 'user-under-test', status: 'syncing', installation_id: 4711 },
            error: null,
        });

        const response = await POST(buildReviewRequest(buildValidReviewBody()));

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'repository_not_connected' });
    });

    it('refuses a legacy OAuth repo with 409 github_app_required (§5.4 blast radius)', async () => {
        repoSingleMock.mockResolvedValue({
            data: { id: 'repo-under-test', user_id: 'user-under-test', status: 'active', installation_id: null },
            error: null,
        });

        const response = await POST(buildReviewRequest(buildValidReviewBody()));

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'github_app_required' });
        expect(getInstallationTokenMock).not.toHaveBeenCalled();
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('answers 502 github_app_unavailable when the installation token is unobtainable', async () => {
        getInstallationTokenMock.mockRejectedValue(
            new GitHubAppAuthError('installation_invalid', 'installation suspended or gone'),
        );

        const response = await POST(buildReviewRequest(buildValidReviewBody()));

        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({ error: 'github_app_unavailable' });
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('answers 404 pr_not_found when GitHub does not know the PR', async () => {
        getPullRequestHeadShaMock.mockRejectedValue(new Error('GitHub 404'));

        const response = await POST(buildReviewRequest(buildValidReviewBody()));

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'pr_not_found' });
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('answers 500 job_creation_failed and never schedules the worker on insert failure', async () => {
        jobInsertSingleMock.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

        const response = await POST(buildReviewRequest(buildValidReviewBody()));

        expect(response.status).toBe(500);
        await flushAfterCallbacks();
        expect(processReviewJobMock).not.toHaveBeenCalled();
    });

    it('creates a webhook-shaped mcp job, opens the check run, and schedules the worker (202)', async () => {
        const response = await POST(buildReviewRequest(buildValidReviewBody()));

        expect(response.status).toBe(202);
        expect(await response.json()).toEqual({
            jobId: 'job-under-test',
            checkRunUrl: 'https://github.com/acme/widgets/pull/7/checks?check_run_id=90210',
        });

        const [persistedJobRow] = jobInsertMock.mock.calls[0] as [Record<string, unknown>];
        expect(persistedJobRow).toMatchObject({
            repository_id: 'repo-under-test',
            source: 'mcp',
            status: 'pending',
            pr_number: 7,
            payload: {
                repo_full_name: 'acme/widgets',
                pr_number: 7,
                pr_head_sha: PR_HEAD_SHA_UNDER_TEST,
                action: 'mcp_review',
            },
        });
        // Webhook-förmig heißt: KEIN diff — der Worker routet in die PR-Pipeline.
        expect((persistedJobRow.payload as Record<string, unknown>).diff).toBeUndefined();

        expect(startGatekeeperCheckRunMock).toHaveBeenCalledWith(
            'installation-token-under-test', 'acme/widgets', PR_HEAD_SHA_UNDER_TEST,
        );

        expect(processReviewJobMock).not.toHaveBeenCalled();
        await flushAfterCallbacks();
        // Job-Uhr ab Handler-Einstieg (DEADLINE_GUARD_SPEC D1).
        expect(processReviewJobMock).toHaveBeenCalledWith('job-under-test', 'user-under-test', expect.any(Number));
    });

    it('still answers 202 with a null checkRunUrl when the check run cannot be opened', async () => {
        startGatekeeperCheckRunMock.mockResolvedValue(null);

        const response = await POST(buildReviewRequest(buildValidReviewBody()));

        expect(response.status).toBe(202);
        expect(await response.json()).toEqual({ jobId: 'job-under-test', checkRunUrl: null });
    });
});
