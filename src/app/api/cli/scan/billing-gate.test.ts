/**
 * Route-Level-Tests für das Billing-Gate von POST /api/cli/scan
 * (PADDLE_SPEC.md §11: 402 no_subscription | subscription_inactive |
 * unknown_plan | trial_quota_exhausted; 429 rate_limit_exceeded + Retry-After).
 *
 * Gemockt wird ausschließlich die Systemgrenze (Supabase, Worker, after()) —
 * resolveEntitlement und consumeScanQuota laufen echt gegen den Mock, damit
 * die Quota-Logik und die Fehlercode-Zuordnung mitgeprüft sind.
 */
import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

const PRICE_PRO_MONTHLY_UNDER_TEST = 'pri_pro_monthly_under_test';
const PRICE_PRO_TRIAL_UNDER_TEST = 'pri_pro_trial_under_test';
process.env.PADDLE_PRICE_PRO_MONTHLY = PRICE_PRO_MONTHLY_UNDER_TEST;
process.env.PADDLE_PRICE_PRO_MONTHLY_TRIAL = PRICE_PRO_TRIAL_UNDER_TEST;

const {
    resolveApiKeyMock,
    rpcMock,
    membershipMaybeSingleMock,
    repoSingleMock,
    jobInsertMock,
    jobInsertSingleMock,
    processReviewJobMock,
    afterMock,
} = vi.hoisted(() => ({
    resolveApiKeyMock: vi.fn(),
    rpcMock: vi.fn(),
    membershipMaybeSingleMock: vi.fn(),
    repoSingleMock: vi.fn(),
    jobInsertMock: vi.fn(),
    jobInsertSingleMock: vi.fn(),
    processReviewJobMock: vi.fn(),
    afterMock: vi.fn(),
}));

vi.mock('@/lib/api-keys', () => ({ resolveApiKey: resolveApiKeyMock }));
vi.mock('@/lib/worker', () => ({ processReviewJob: processReviewJobMock }));
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
            // review_jobs
            return { insert: jobInsertMock };
        },
    },
}));

const { POST } = await import('./route');

afterAll(() => {
    delete process.env.PADDLE_PRICE_PRO_MONTHLY;
    delete process.env.PADDLE_PRICE_PRO_MONTHLY_TRIAL;
});

const VALID_UNIFIED_DIFF = 'diff --git a/src/index.ts b/src/index.ts\n+const answer = 42;\n';

function buildScanRequest(scanBody: Record<string, unknown>): Request {
    return new Request('http://localhost/api/cli/scan', {
        method: 'POST',
        body: JSON.stringify(scanBody),
    });
}

function buildValidScanBody(): Record<string, unknown> {
    return { repoFullName: 'acme/widgets', diff: VALID_UNIFIED_DIFF };
}

/** Membership-Zeile, wie der Embed-Join sie liefert (unwrapAccountEmbed-Form). */
function membershipWith(status: string, paddlePriceId: string | null) {
    return {
        data: { billing_accounts: { status, paddle_price_id: paddlePriceId } },
        error: null,
    };
}

async function flushAfterCallbacks(): Promise<void> {
    for (const [scheduledCallback] of afterMock.mock.calls) {
        await scheduledCallback();
    }
}

describe('POST /api/cli/scan — Billing-Gate (PADDLE_SPEC §11)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveApiKeyMock.mockResolvedValue({ id: 'api-key-under-test', userId: 'user-under-test' });
        membershipMaybeSingleMock.mockResolvedValue(membershipWith('active', PRICE_PRO_MONTHLY_UNDER_TEST));
        rpcMock.mockResolvedValue({ data: 'allowed', error: null });
        repoSingleMock.mockResolvedValue({
            data: { id: 'repo-under-test', user_id: 'user-under-test', status: 'active' },
            error: null,
        });
        jobInsertMock.mockImplementation(() => ({ select: () => ({ single: jobInsertSingleMock }) }));
        jobInsertSingleMock.mockResolvedValue({ data: { id: 'job-under-test' }, error: null });
    });

    it('answers 401 invalid_api_key without touching entitlements or quota', async () => {
        resolveApiKeyMock.mockResolvedValue(null);

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'invalid_api_key' });
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('fails closed with 402 no_subscription when the entitlement lookup itself errors', async () => {
        membershipMaybeSingleMock.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(402);
        expect(await response.json()).toEqual({ error: 'no_subscription' });
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('answers 402 no_subscription when the user has no billing account', async () => {
        membershipMaybeSingleMock.mockResolvedValue({ data: null, error: null });

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(402);
        expect(await response.json()).toEqual({ error: 'no_subscription' });
        // Kein Anspruch darf auch keine Quota verbrauchen und keinen Job anlegen.
        expect(rpcMock).not.toHaveBeenCalled();
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('answers 402 no_subscription for an account that never started a subscription (status none)', async () => {
        membershipMaybeSingleMock.mockResolvedValue(membershipWith('none', null));

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(402);
        expect(await response.json()).toEqual({ error: 'no_subscription' });
    });

    it('answers 402 subscription_inactive for a canceled subscription', async () => {
        membershipMaybeSingleMock.mockResolvedValue(membershipWith('canceled', PRICE_PRO_MONTHLY_UNDER_TEST));

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(402);
        expect(await response.json()).toEqual({ error: 'subscription_inactive' });
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('answers 402 unknown_plan for an entitled status with an unknown price id (fail-closed)', async () => {
        membershipMaybeSingleMock.mockResolvedValue(membershipWith('active', 'pri_not_in_plan_config'));

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(402);
        expect(await response.json()).toEqual({ error: 'unknown_plan' });
    });

    it('answers 402 trial_quota_exhausted when the RPC reports the trial lifetime cap', async () => {
        membershipMaybeSingleMock.mockResolvedValue(membershipWith('trialing', PRICE_PRO_TRIAL_UNDER_TEST));
        rpcMock.mockResolvedValue({ data: 'trial_exhausted', error: null });

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(402);
        expect(await response.json()).toEqual({ error: 'trial_quota_exhausted' });
        // Die Quota MUSS atomar über die RPC laufen — mit den um die Webhook-
        // Reserve reduzierten Fenster-Limits (MCP_SPEC.md §4.6: CLI sieht 80%),
        // aber dem UNreduzierten Trial-Lifetime-Kontingent.
        expect(rpcMock).toHaveBeenCalledWith('consume_scan_quota', {
            target_user_id: 'user-under-test',
            hourly_max: 48,
            monthly_max: 400,
            trial_max: 100,
        });
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('answers 429 rate_limit_exceeded with Retry-After when a quota window is exhausted', async () => {
        rpcMock.mockResolvedValue({ data: 'quota_exceeded', error: null });

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(429);
        expect(await response.json()).toEqual({ error: 'rate_limit_exceeded' });
        expect(response.headers.get('Retry-After')).toBe('3600');
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('fails closed with 429 when the quota RPC itself errors', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(429);
        expect(await response.json()).toEqual({ error: 'rate_limit_exceeded' });
    });

    it('answers 422 invalid_json for a non-JSON body', async () => {
        const malformedRequest = new Request('http://localhost/api/cli/scan', {
            method: 'POST',
            body: 'not json at all',
        });

        const response = await POST(malformedRequest);

        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({ error: 'invalid_json' });
    });

    it('answers 422 invalid_repo_full_name for a name without owner/repo shape', async () => {
        const response = await POST(buildScanRequest({ repoFullName: 'no-slash-here', diff: VALID_UNIFIED_DIFF }));

        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({ error: 'invalid_repo_full_name' });
    });

    it('answers 422 missing_diff when the diff is absent', async () => {
        const response = await POST(buildScanRequest({ repoFullName: 'acme/widgets' }));

        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({ error: 'missing_diff' });
    });

    it('answers 422 diff_not_unified_format for a diff without a diff --git header', async () => {
        const response = await POST(buildScanRequest({ repoFullName: 'acme/widgets', diff: 'just some text' }));

        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({ error: 'diff_not_unified_format' });
    });

    it('answers 422 diff_too_large for a diff above the 300 KiB cap', async () => {
        const oversizedDiff = 'diff --git ' + 'a'.repeat(300 * 1024);

        const response = await POST(buildScanRequest({ repoFullName: 'acme/widgets', diff: oversizedDiff }));

        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({ error: 'diff_too_large' });
    });

    it('consumes no scan quota for a request that fails validation with 422', async () => {
        const response = await POST(buildScanRequest({ repoFullName: 'acme/widgets', diff: 'just some text' }));

        expect(response.status).toBe(422);
        // Ein abgelehnter Request darf den User keinen Scan kosten: die
        // Quota-RPC läuft erst NACH validateScanRequest (ROADMAP-§8-Befund).
        expect(rpcMock).not.toHaveBeenCalled();
        // Das Entitlement-Gate bleibt bewusst VOR der Validierung (Fail-Fast).
        expect(membershipMaybeSingleMock).toHaveBeenCalledTimes(1);
    });

    it('answers 404 repository_not_connected when no repo row matches user and name', async () => {
        repoSingleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'repository_not_connected' });
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('answers 404 repository_not_connected for a repo that is not active yet', async () => {
        repoSingleMock.mockResolvedValue({
            data: { id: 'repo-under-test', user_id: 'user-under-test', status: 'syncing' },
            error: null,
        });

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'repository_not_connected' });
    });

    it('answers 500 job_creation_failed and never schedules the worker when the job insert errors', async () => {
        jobInsertSingleMock.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

        const response = await POST(buildScanRequest(buildValidScanBody()));

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'job_creation_failed' });
        await flushAfterCallbacks();
        expect(processReviewJobMock).not.toHaveBeenCalled();
    });

    it("persists source 'mcp' and the clamped reroll limit for an MCP scan (MCP_SPEC §4.5/§4.7)", async () => {
        const response = await POST(buildScanRequest({
            ...buildValidScanBody(),
            source: 'mcp',
            rerollLimit: 999,
        }));

        expect(response.status).toBe(202);
        // MCP läuft in derselben reservierten Lane wie das CLI (48/400).
        expect(rpcMock).toHaveBeenCalledWith('consume_scan_quota', {
            target_user_id: 'user-under-test',
            hourly_max: 48,
            monthly_max: 400,
            trial_max: 100,
        });
        const [persistedJobRow] = jobInsertMock.mock.calls[0] as [Record<string, unknown>];
        expect(persistedJobRow).toMatchObject({
            source: 'mcp',
            payload: { reroll_limit: 50 },
        });
    });

    it('answers 422 invalid_source for a source outside cli|mcp (webhook darf sich nicht einschleichen)', async () => {
        const response = await POST(buildScanRequest({ ...buildValidScanBody(), source: 'webhook' }));

        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({ error: 'invalid_source' });
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('answers 202 with the job id and schedules the worker when entitled and within quota', async () => {
        const response = await POST(buildScanRequest({
            repoFullName: 'acme/widgets',
            diff: VALID_UNIFIED_DIFF,
            baseSha: 'base-sha',
            headSha: 'head-sha',
            dirty: true,
        }));

        expect(response.status).toBe(202);
        expect(await response.json()).toEqual({ jobId: 'job-under-test' });

        const [persistedJobRow] = jobInsertMock.mock.calls[0] as [Record<string, unknown>];
        expect(persistedJobRow).toMatchObject({
            repository_id: 'repo-under-test',
            source: 'cli',
            status: 'pending',
            payload: {
                repo_full_name: 'acme/widgets',
                diff: VALID_UNIFIED_DIFF,
                base_sha: 'base-sha',
                head_sha: 'head-sha',
                dirty: true,
            },
        });

        expect(processReviewJobMock).not.toHaveBeenCalled();
        await flushAfterCallbacks();
        expect(processReviewJobMock).toHaveBeenCalledWith('job-under-test', 'user-under-test');
    });
});
