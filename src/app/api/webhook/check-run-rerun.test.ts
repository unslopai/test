/**
 * Route-Level-Tests für Check-Run Re-Runs (GITHUB_APP_SPEC.md §4.8):
 * POST /api/webhook mit Event check_run / Action 'rerequested' (App-Modus).
 *
 * Kern-Invariante: Ein Re-Run ist ein NEUER Scan und durchläuft dieselbe
 * Gate-Kette wie pull_request — insbesondere zählt er gegen die Scan-Quota,
 * sonst wäre der Re-run-Button ein kostenloser LLM-Bypass. Die Signatur läuft
 * echt gegen das App-Secret (crypto.timingSafeEqual, SEC-001); gemockt sind
 * Supabase, Installation-Lookup, Check-Run-API, Gate-Notice, Worker, after().
 */
import { createHmac } from 'crypto';
import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

const PRICE_PRO_MONTHLY_UNDER_TEST = 'pri_pro_monthly_under_test';
const APP_WEBHOOK_SECRET_UNDER_TEST = 'app-webhook-secret-under-test';
process.env.PADDLE_PRICE_PRO_MONTHLY = PRICE_PRO_MONTHLY_UNDER_TEST;
// App-Modus: isGitHubAppConfigured() und getAppWebhookSecret() laufen echt
// gegen diese Env; der private Key wird nie benutzt (getInstallationToken ist gemockt).
process.env.GITHUB_APP_ID = '12345';
process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = Buffer.from('placeholder-pem').toString('base64');
process.env.GITHUB_APP_WEBHOOK_SECRET = APP_WEBHOOK_SECRET_UNDER_TEST;

const {
    rpcMock,
    membershipMaybeSingleMock,
    repoListEqMock,
    jobInsertMock,
    jobInsertSingleMock,
    jobUpdateMock,
    findInstallationMock,
    getInstallationTokenMock,
    startGatekeeperCheckRunMock,
    announceGateSkipMock,
    processReviewJobMock,
    afterMock,
} = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    membershipMaybeSingleMock: vi.fn(),
    repoListEqMock: vi.fn(),
    jobInsertMock: vi.fn(),
    jobInsertSingleMock: vi.fn(),
    jobUpdateMock: vi.fn(),
    findInstallationMock: vi.fn(),
    getInstallationTokenMock: vi.fn(),
    startGatekeeperCheckRunMock: vi.fn(),
    announceGateSkipMock: vi.fn(),
    processReviewJobMock: vi.fn(),
    afterMock: vi.fn(),
}));

vi.mock('@/lib/worker', () => ({ processReviewJob: processReviewJobMock }));
vi.mock('@/lib/gate-notice', () => ({ announceGateSkip: announceGateSkipMock }));
vi.mock('@/lib/check-run', () => ({ startGatekeeperCheckRun: startGatekeeperCheckRunMock }));
vi.mock('@/lib/app-installation', () => ({
    findInstallation: findInstallationMock,
    handleInstallationEvent: vi.fn(),
    handleInstallationReposEvent: vi.fn(),
}));
vi.mock('@/lib/github-app', async (importOriginal) => {
    const actualGithubAppModule = await importOriginal<typeof import('@/lib/github-app')>();
    return { ...actualGithubAppModule, getInstallationToken: getInstallationTokenMock };
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
                return { select: () => ({ eq: repoListEqMock }) };
            }
            // review_jobs: Insert des Jobs + Update fürs Anheften der check_run_id.
            return { insert: jobInsertMock, update: jobUpdateMock };
        },
    },
}));

const scheduleLazyReapMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/lazy-reaper', () => ({ scheduleLazyReap: scheduleLazyReapMock }));

const { POST } = await import('./route');

afterAll(() => {
    delete process.env.PADDLE_PRICE_PRO_MONTHLY;
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
    delete process.env.GITHUB_APP_WEBHOOK_SECRET;
});

const INSTALLATION_ID_UNDER_TEST = 31337;

function buildAppRepoRow(): Record<string, unknown> {
    return {
        id: 'repo-row-under-test',
        user_id: 'user-under-test',
        webhook_secret: null,
        installation_id: INSTALLATION_ID_UNDER_TEST,
        status: 'active',
    };
}

interface RerunDeliveryOverrides {
    readonly checkRunAction?: string;
    readonly pullRequests?: readonly Record<string, unknown>[];
    readonly signingSecret?: string;
    readonly stripRepository?: boolean;
}

function buildRerunDelivery(overrides: RerunDeliveryOverrides = {}): Request {
    const deliveryPayload: Record<string, unknown> = {
        action: overrides.checkRunAction ?? 'rerequested',
        check_run: {
            id: 555,
            head_sha: 'head-sha-under-test',
            pull_requests: overrides.pullRequests ?? [
                { id: 991, number: 7, url: 'https://api.github.com/repos/acme/widgets/pulls/7', head: { ref: 'feat/x', sha: 'head-sha-under-test' } },
            ],
        },
        repository: { id: 4242, full_name: 'acme/widgets' },
        installation: { id: INSTALLATION_ID_UNDER_TEST },
    };
    if (overrides.stripRepository) {
        delete deliveryPayload.repository;
    }

    const rawBody = JSON.stringify(deliveryPayload);
    const hmacSignature = 'sha256='
        + createHmac('sha256', overrides.signingSecret ?? APP_WEBHOOK_SECRET_UNDER_TEST).update(rawBody).digest('hex');

    return new Request('http://localhost/api/webhook', {
        method: 'POST',
        headers: { 'x-github-event': 'check_run', 'x-hub-signature-256': hmacSignature },
        body: rawBody,
    });
}

async function flushAfterCallbacks(): Promise<void> {
    for (const [scheduledCallback] of afterMock.mock.calls) {
        await scheduledCallback();
    }
}

function announcedGateKind(): string {
    const [firstAnnounceCall] = announceGateSkipMock.mock.calls;
    if (!firstAnnounceCall) {
        throw new Error('Es wurde keine Gate-Notice angekündigt.');
    }
    return firstAnnounceCall[2] as string;
}

describe('POST /api/webhook — check_run.rerequested (GITHUB_APP_SPEC §4.8)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        repoListEqMock.mockResolvedValue({ data: [buildAppRepoRow()], error: null });
        findInstallationMock.mockResolvedValue({
            installationId: INSTALLATION_ID_UNDER_TEST,
            userId: 'user-under-test',
            status: 'active',
        });
        membershipMaybeSingleMock.mockResolvedValue({
            data: { billing_accounts: { status: 'active', paddle_price_id: PRICE_PRO_MONTHLY_UNDER_TEST } },
            error: null,
        });
        rpcMock.mockResolvedValue({ data: 'allowed', error: null });
        jobInsertMock.mockImplementation(() => ({ select: () => ({ single: jobInsertSingleMock }) }));
        jobInsertSingleMock.mockResolvedValue({ data: { id: 'job-under-test' }, error: null });
        jobUpdateMock.mockImplementation(() => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }));
        getInstallationTokenMock.mockResolvedValue('installation-token-under-test');
        startGatekeeperCheckRunMock.mockResolvedValue(999);
    });

    it('answers 400 for a structurally incomplete check_run payload', async () => {
        const response = await POST(buildRerunDelivery({ stripRepository: true }));

        expect(response.status).toBe(400);
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
    });

    it('ignores non-rerequested check_run actions before any billing lookup', async () => {
        const response = await POST(buildRerunDelivery({ checkRunAction: 'created' }));

        expect(response.status).toBe(200);
        expect((await response.json() as { message: string }).message).toContain('ignoriert');
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('answers 200 without a review when pull_requests is empty (fork PR / plain push)', async () => {
        const response = await POST(buildRerunDelivery({ pullRequests: [] }));

        expect(response.status).toBe(200);
        expect((await response.json() as { message: string }).message).toContain('kein Review');
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('answers 401 for a re-run delivery signed with the wrong secret', async () => {
        const response = await POST(buildRerunDelivery({ signingSecret: 'attacker-guessed-secret' }));

        expect(response.status).toBe(401);
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('skips the re-run when the installation is suspended, before any billing lookup', async () => {
        findInstallationMock.mockResolvedValue({
            installationId: INSTALLATION_ID_UNDER_TEST,
            userId: 'user-under-test',
            status: 'suspended',
        });

        const response = await POST(buildRerunDelivery());

        expect(response.status).toBe(200);
        expect(membershipMaybeSingleMock).not.toHaveBeenCalled();
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('enforces the billing gate on re-runs: not entitled means 200 skip + billing_paused notice', async () => {
        membershipMaybeSingleMock.mockResolvedValue({ data: null, error: null });

        const response = await POST(buildRerunDelivery());

        expect(response.status).toBe(200);
        expect(rpcMock).not.toHaveBeenCalled();
        expect(jobInsertMock).not.toHaveBeenCalled();

        await flushAfterCallbacks();
        expect(announcedGateKind()).toBe('billing_paused');
        expect(processReviewJobMock).not.toHaveBeenCalled();
    });

    it('enforces the quota on re-runs: exhausted window means 200 skip + quota_exceeded notice', async () => {
        rpcMock.mockResolvedValue({ data: 'quota_exceeded', error: null });

        const response = await POST(buildRerunDelivery());

        expect(response.status).toBe(200);
        expect(jobInsertMock).not.toHaveBeenCalled();

        await flushAfterCallbacks();
        expect(announcedGateKind()).toBe('quota_exceeded');
    });

    it('runs a fresh scan for a valid re-run: quota consumed, job created, check run opened, worker scheduled', async () => {
        const response = await POST(buildRerunDelivery());

        expect(response.status).toBe(200);
        expect((await response.json() as { jobId: string }).jobId).toBe('job-under-test');

        // Produktentscheidung §4.8: der Re-Run verbraucht einen Scan.
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
            payload: {
                repo_full_name: 'acme/widgets',
                pr_number: 7,
                pr_head_sha: 'head-sha-under-test',
                action: 'rerequested',
            },
        });

        expect(startGatekeeperCheckRunMock).toHaveBeenCalledWith(
            'installation-token-under-test', 'acme/widgets', 'head-sha-under-test',
        );
        const [checkRunIdAttachUpdate] = jobUpdateMock.mock.calls[0] as [Record<string, unknown>];
        expect(checkRunIdAttachUpdate).toEqual({ check_run_id: 999 });

        await flushAfterCallbacks();
        // Job-Uhr ab Handler-Einstieg (DEADLINE_GUARD_SPEC D1).
        expect(processReviewJobMock).toHaveBeenCalledWith('job-under-test', 'user-under-test', expect.any(Number));
        expect(announceGateSkipMock).not.toHaveBeenCalled();
    });
});
