/**
 * Route-Level-Tests für das Billing-Gate von POST /api/webhook
 * (PADDLE_SPEC.md §11: der PR-Webhook-Pfad antwortet bei fehlendem Anspruch
 * bewusst 200 + Skip-Message — GitHub darf nie retrien — und meldet den Grund
 * als Gate-Notice billing_paused | quota_exceeded | trial_exhausted).
 *
 * Der Legacy-Repo-Hook-Pfad läuft mit ECHTER HMAC-Signaturprüfung
 * (crypto.timingSafeEqual, SEC-001) und echter Payload-Validierung [ARCH-002];
 * gemockt sind nur Supabase, Gate-Notice, Worker und after().
 */
import { createHmac } from 'crypto';
import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

const PRICE_PRO_MONTHLY_UNDER_TEST = 'pri_pro_monthly_under_test';
process.env.PADDLE_PRICE_PRO_MONTHLY = PRICE_PRO_MONTHLY_UNDER_TEST;
// Erzwingt den Legacy-Pfad: ohne App-Env ist isGitHubAppConfigured() false.
delete process.env.GITHUB_APP_ID;
delete process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
delete process.env.GITHUB_APP_WEBHOOK_SECRET;

const {
    rpcMock,
    membershipMaybeSingleMock,
    repoListEqMock,
    jobInsertMock,
    jobInsertSingleMock,
    announceGateSkipMock,
    processReviewJobMock,
    afterMock,
} = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    membershipMaybeSingleMock: vi.fn(),
    repoListEqMock: vi.fn(),
    jobInsertMock: vi.fn(),
    jobInsertSingleMock: vi.fn(),
    announceGateSkipMock: vi.fn(),
    processReviewJobMock: vi.fn(),
    afterMock: vi.fn(),
}));

vi.mock('@/lib/worker', () => ({ processReviewJob: processReviewJobMock }));
vi.mock('@/lib/gate-notice', () => ({ announceGateSkip: announceGateSkipMock }));
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
                return { select: () => ({ eq: repoListEqMock }) };
            }
            // review_jobs
            return { insert: jobInsertMock };
        },
    },
}));

const scheduleLazyReapMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/lazy-reaper', () => ({ scheduleLazyReap: scheduleLazyReapMock }));

const { POST } = await import('./route');

afterAll(() => {
    delete process.env.PADDLE_PRICE_PRO_MONTHLY;
});

const WEBHOOK_SECRET_UNDER_TEST = 'legacy-hook-secret-under-test';

function buildRepoRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
    return {
        id: 'repo-row-under-test',
        user_id: 'user-under-test',
        webhook_secret: WEBHOOK_SECRET_UNDER_TEST,
        installation_id: null,
        status: 'active',
        ...overrides,
    };
}

function buildPullRequestDelivery(
    prAction: string,
    signingSecret: string = WEBHOOK_SECRET_UNDER_TEST,
): Request {
    const deliveryPayload = {
        action: prAction,
        repository: { id: 4242, full_name: 'acme/widgets' },
        pull_request: { number: 7, html_url: 'https://github.com/acme/widgets/pull/7', head: { sha: 'head-sha-under-test' } },
    };
    const rawBody = JSON.stringify(deliveryPayload);
    const hmacSignature = 'sha256=' + createHmac('sha256', signingSecret).update(rawBody).digest('hex');

    return new Request('http://localhost/api/webhook', {
        method: 'POST',
        headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': hmacSignature },
        body: rawBody,
    });
}

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

/** Der GateKind, mit dem announceGateSkip nach dem Flush aufgerufen wurde. */
function announcedGateKind(): string {
    const [firstAnnounceCall] = announceGateSkipMock.mock.calls;
    if (!firstAnnounceCall) {
        throw new Error('Es wurde keine Gate-Notice angekündigt.');
    }
    return firstAnnounceCall[2] as string;
}

describe('POST /api/webhook — Billing-Gate auf dem Legacy-PR-Pfad', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        repoListEqMock.mockResolvedValue({ data: [buildRepoRow()], error: null });
        membershipMaybeSingleMock.mockResolvedValue(membershipWith('active', PRICE_PRO_MONTHLY_UNDER_TEST));
        rpcMock.mockResolvedValue({ data: 'allowed', error: null });
        jobInsertMock.mockImplementation(() => ({ select: () => ({ single: jobInsertSingleMock }) }));
        jobInsertSingleMock.mockResolvedValue({ data: { id: 'job-under-test' }, error: null });
    });

    it('answers 400 for a delivery without an X-GitHub-Event header', async () => {
        const headerlessRequest = new Request('http://localhost/api/webhook', { method: 'POST', body: '{}' });

        const response = await POST(headerlessRequest);

        expect(response.status).toBe(400);
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
    });

    it('answers 400 for a body that is not valid JSON', async () => {
        const malformedRequest = new Request('http://localhost/api/webhook', {
            method: 'POST',
            headers: { 'x-github-event': 'pull_request' },
            body: 'not json at all',
        });

        const response = await POST(malformedRequest);

        expect(response.status).toBe(400);
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
    });

    it('answers 400 for a structurally incomplete pull_request payload', async () => {
        const incompleteRequest = new Request('http://localhost/api/webhook', {
            method: 'POST',
            headers: { 'x-github-event': 'pull_request' },
            body: JSON.stringify({ action: 'opened', repository: { id: 4242 } }),
        });

        const response = await POST(incompleteRequest);

        expect(response.status).toBe(400);
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
    });

    it('answers 404 for a repository that is not registered', async () => {
        repoListEqMock.mockResolvedValue({ data: [], error: null });

        const response = await POST(buildPullRequestDelivery('opened'));

        expect(response.status).toBe(404);
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
    });

    it('answers 401 for a delivery signed with the wrong secret and never reads billing state', async () => {
        const response = await POST(buildPullRequestDelivery('opened', 'attacker-guessed-secret'));

        expect(response.status).toBe(401);
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('ignores non-reviewable PR actions before any billing lookup', async () => {
        const response = await POST(buildPullRequestDelivery('closed'));

        expect(response.status).toBe(200);
        expect((await response.json() as { message: string }).message).toContain('ignoriert');
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
    });

    it('answers 500 via the top-level catch when the repository lookup errors', async () => {
        repoListEqMock.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

        const response = await POST(buildPullRequestDelivery('opened'));

        expect(response.status).toBe(500);
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('skips the review with a reviews_disabled notice for a deactivated repo before any billing lookup', async () => {
        repoListEqMock.mockResolvedValue({ data: [buildRepoRow({ status: 'deactivated' })], error: null });

        const response = await POST(buildPullRequestDelivery('opened'));

        expect(response.status).toBe(200);
        // Status-Gate liegt VOR dem Billing-Gate: kein Entitlement-Read, keine Quota.
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
        expect(rpcMock).not.toHaveBeenCalled();

        await flushAfterCallbacks();
        expect(announcedGateKind()).toBe('reviews_disabled');
    });

    it('skips the review with an activation_required notice for a pending_activation repo (Denial-of-Wallet guard)', async () => {
        repoListEqMock.mockResolvedValue({ data: [buildRepoRow({ status: 'pending_activation' })], error: null });

        const response = await POST(buildPullRequestDelivery('opened'));

        expect(response.status).toBe(200);
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();

        await flushAfterCallbacks();
        expect(announcedGateKind()).toBe('activation_required');
    });

    it('skips the review with 200 and a billing_paused notice when the user is not entitled', async () => {
        membershipMaybeSingleMock.mockResolvedValue({ data: null, error: null });

        const response = await POST(buildPullRequestDelivery('opened'));

        expect(response.status).toBe(200);
        expect((await response.json() as { message: string }).message).toContain('no_subscription');
        // Kein Anspruch: keine Quota verbrauchen, keinen Job anlegen, keinen Worker starten.
        expect(rpcMock).not.toHaveBeenCalled();
        expect(jobInsertMock).not.toHaveBeenCalled();

        await flushAfterCallbacks();
        expect(announcedGateKind()).toBe('billing_paused');
        expect(processReviewJobMock).not.toHaveBeenCalled();
    });

    it('skips the review with 200 and a quota_exceeded notice when a quota window is exhausted', async () => {
        rpcMock.mockResolvedValue({ data: 'quota_exceeded', error: null });

        const response = await POST(buildPullRequestDelivery('synchronize'));

        expect(response.status).toBe(200);
        expect(jobInsertMock).not.toHaveBeenCalled();

        await flushAfterCallbacks();
        expect(announcedGateKind()).toBe('quota_exceeded');
    });

    it('skips the review with 200 and a trial_exhausted notice when the trial lifetime cap is hit', async () => {
        membershipMaybeSingleMock.mockResolvedValue(membershipWith('trialing', PRICE_PRO_MONTHLY_UNDER_TEST));
        rpcMock.mockResolvedValue({ data: 'trial_exhausted', error: null });

        const response = await POST(buildPullRequestDelivery('opened'));

        expect(response.status).toBe(200);
        expect((await response.json() as { message: string }).message).toContain('Trial');
        expect(jobInsertMock).not.toHaveBeenCalled();

        await flushAfterCallbacks();
        expect(announcedGateKind()).toBe('trial_exhausted');
    });

    it('answers 500 and never schedules the worker when the job insert errors after the gates passed', async () => {
        jobInsertSingleMock.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

        const response = await POST(buildPullRequestDelivery('opened'));

        expect(response.status).toBe(500);
        await flushAfterCallbacks();
        expect(processReviewJobMock).not.toHaveBeenCalled();
    });

    it('creates the review job and schedules the worker when entitled and within quota', async () => {
        const response = await POST(buildPullRequestDelivery('opened'));

        expect(response.status).toBe(200);
        // Lazy Reaping (DEADLINE_GUARD_SPEC D10) läuft bei jeder Delivery mit.
        expect(scheduleLazyReapMock).toHaveBeenCalledWith('webhook');
        expect((await response.json() as { jobId: string }).jobId).toBe('job-under-test');

        expect(rpcMock).toHaveBeenCalledWith('consume_scan_quota', {
            target_user_id: 'user-under-test',
            hourly_max: 60,
            monthly_max: 500,
            trial_max: 100,
        });

        const [persistedJobRow] = jobInsertMock.mock.calls[0] as [Record<string, unknown>];
        expect(persistedJobRow).toMatchObject({
            repository_id: 'repo-row-under-test',
            source: 'webhook',
            status: 'pending',
            pr_number: 7,
        });

        await flushAfterCallbacks();
        // Job-Uhr ab Handler-Einstieg (DEADLINE_GUARD_SPEC D1).
        expect(processReviewJobMock).toHaveBeenCalledWith('job-under-test', 'user-under-test', expect.any(Number));
        expect(announceGateSkipMock).not.toHaveBeenCalled();
    });
});
