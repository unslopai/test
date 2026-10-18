/**
 * Route-Level-Tests für den Head-Lebenszyklus von POST /api/webhook
 * (GITHUB_APP_SPEC.md §4.9): Reopen und erneut zugestelltes `opened` auf einem
 * schon vollständig geprüften Head starten keinen Job und verbrauchen keinen
 * Scan; ein `synchronize` löst laufende Jobs auf seinem Vorgänger-Commit ab
 * und schließt deren Check als `cancelled` mit „Superseded by <kurzer SHA>“.
 *
 * App-Modus mit echter Signaturprüfung (SEC-001) und echtem
 * `pr-head-lifecycle`-Modul; gemockt sind Supabase (mit protokollierten
 * Filtern), Installation-Lookup, Check-Run-API, Worker und after().
 */
import { createHmac } from 'crypto';
import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

const PRICE_PRO_MONTHLY_UNDER_TEST = 'pri_pro_monthly_under_test';
const APP_WEBHOOK_SECRET_UNDER_TEST = 'app-webhook-secret-under-test';
process.env.PADDLE_PRICE_PRO_MONTHLY = PRICE_PRO_MONTHLY_UNDER_TEST;
process.env.GITHUB_APP_ID = '12345';
process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = Buffer.from('placeholder-pem').toString('base64');
process.env.GITHUB_APP_WEBHOOK_SECRET = APP_WEBHOOK_SECRET_UNDER_TEST;

type RecordedFilter = readonly [filterName: string, columnName: string, filterValue: unknown];

const {
    rpcMock,
    membershipMaybeSingleMock,
    repoListEqMock,
    jobInsertMock,
    jobInsertSingleMock,
    latestHeadJobMock,
    supersedeReturningMock,
    reviewJobsUpdateMock,
    recordedJobFilters,
    findInstallationMock,
    getInstallationTokenMock,
    startGatekeeperCheckRunMock,
    completeGatekeeperCheckRunMock,
    processReviewJobMock,
    afterMock,
} = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    membershipMaybeSingleMock: vi.fn(),
    repoListEqMock: vi.fn(),
    jobInsertMock: vi.fn(),
    jobInsertSingleMock: vi.fn(),
    latestHeadJobMock: vi.fn(),
    supersedeReturningMock: vi.fn(),
    reviewJobsUpdateMock: vi.fn<(updatePayload: Record<string, unknown>) => void>(),
    recordedJobFilters: [] as RecordedFilter[],
    findInstallationMock: vi.fn(),
    getInstallationTokenMock: vi.fn(),
    startGatekeeperCheckRunMock: vi.fn(),
    completeGatekeeperCheckRunMock: vi.fn(),
    processReviewJobMock: vi.fn(),
    afterMock: vi.fn(),
}));

/**
 * Eine review_jobs-Query, die jeden Filter protokolliert. Terminal sind
 * `maybeSingle` (Dedupe-Lookup), `select` nach einem Update (Ablösung liefert
 * die umgestellten Zeilen) und das direkte await (Anheften der check_run_id).
 */
function buildRecordingJobQuery(queryKind: 'lookup' | 'update'): Record<string, unknown> {
    const recordFilter = (filterName: string) => (columnName: string, filterValue: unknown) => {
        recordedJobFilters.push([filterName, columnName, filterValue]);
        return jobQuery;
    };
    const jobQuery: Record<string, unknown> = {
        eq: recordFilter('eq'),
        neq: recordFilter('neq'),
        in: recordFilter('in'),
        order: () => jobQuery,
        limit: () => jobQuery,
        maybeSingle: latestHeadJobMock,
        select: () => (queryKind === 'update' ? supersedeReturningMock() : jobQuery),
        then: (onFulfilled: (updateOutcome: { error: null }) => unknown) =>
            Promise.resolve({ error: null }).then(onFulfilled),
    };
    return jobQuery;
}

vi.mock('@/lib/worker', () => ({ processReviewJob: processReviewJobMock }));
vi.mock('@/lib/gate-notice', () => ({ announceGateSkip: vi.fn() }));
vi.mock('@/lib/check-run', () => ({
    startGatekeeperCheckRun: startGatekeeperCheckRunMock,
    completeGatekeeperCheckRun: completeGatekeeperCheckRunMock,
}));
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
            return {
                insert: jobInsertMock,
                select: () => buildRecordingJobQuery('lookup'),
                update: (updatePayload: Record<string, unknown>) => {
                    reviewJobsUpdateMock(updatePayload);
                    return buildRecordingJobQuery('update');
                },
            };
        },
    },
}));
vi.mock('@/lib/lazy-reaper', () => ({ scheduleLazyReap: vi.fn() }));

const { POST } = await import('./route');

afterAll(() => {
    delete process.env.PADDLE_PRICE_PRO_MONTHLY;
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
    delete process.env.GITHUB_APP_WEBHOOK_SECRET;
});

const INSTALLATION_ID_UNDER_TEST = 31337;
const HEAD_SHA_UNDER_TEST = 'b7e23ec29af22b0b4e41da31e868d57226121c84';
const PREVIOUS_HEAD_SHA_UNDER_TEST = '4ff29640d126e080fa8f4424034d4e449190226f';

/** GitHub setzt `before`/`after` nur an `synchronize`-Deliveries. */
function buildPullRequestDelivery(prAction: string, previousHeadSha: string | null = null): Request {
    const rawBody = JSON.stringify({
        action: prAction,
        ...(previousHeadSha ? { before: previousHeadSha, after: HEAD_SHA_UNDER_TEST } : {}),
        repository: { id: 4242, full_name: 'acme/widgets' },
        pull_request: {
            number: 7,
            html_url: 'https://github.com/acme/widgets/pull/7',
            head: { sha: HEAD_SHA_UNDER_TEST },
        },
        installation: { id: INSTALLATION_ID_UNDER_TEST },
    });
    const hmacSignature = 'sha256='
        + createHmac('sha256', APP_WEBHOOK_SECRET_UNDER_TEST).update(rawBody).digest('hex');

    return new Request('http://localhost/api/webhook', {
        method: 'POST',
        headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': hmacSignature },
        body: rawBody,
    });
}

/** Die Zeile, die der Dedupe-Lookup als jüngsten abgeschlossenen Job des Heads liefert. */
function latestHeadJob(jobFields: Record<string, unknown>): { data: Record<string, unknown>; error: null } {
    return {
        data: { id: 'earlier-job-under-test', status: 'done', degradations: [], prescan_degraded: false, ...jobFields },
        error: null,
    };
}

async function flushAfterCallbacks(): Promise<void> {
    for (const [scheduledCallback] of afterMock.mock.calls) {
        await scheduledCallback();
    }
}

describe('POST /api/webhook — Head-Lebenszyklus (GITHUB_APP_SPEC §4.9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        recordedJobFilters.length = 0;
        repoListEqMock.mockResolvedValue({
            data: [{
                id: 'repo-row-under-test',
                user_id: 'user-under-test',
                webhook_secret: null,
                installation_id: INSTALLATION_ID_UNDER_TEST,
                status: 'active',
            }],
            error: null,
        });
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
        latestHeadJobMock.mockResolvedValue({ data: null, error: null });
        supersedeReturningMock.mockResolvedValue({ data: [], error: null });
        getInstallationTokenMock.mockResolvedValue('installation-token-under-test');
        startGatekeeperCheckRunMock.mockResolvedValue(999);
        completeGatekeeperCheckRunMock.mockResolvedValue(undefined);
    });

    it.each(['reopened', 'opened'])(
        "skips '%s' on a head a clean done job already reviewed: no job, no scan consumed, no check run",
        async (prAction) => {
            latestHeadJobMock.mockResolvedValue(latestHeadJob({}));

            const response = await POST(buildPullRequestDelivery(prAction));

            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({ success: true, jobId: 'earlier-job-under-test' });
            // Der Lookup ist auf Tenant-Zeile, PR und genau diesen Head begrenzt.
            expect(recordedJobFilters).toEqual([
                ['eq', 'repository_id', 'repo-row-under-test'],
                ['eq', 'pr_number', 7],
                ['eq', 'source', 'webhook'],
                ['eq', 'payload->>pr_head_sha', HEAD_SHA_UNDER_TEST],
                ['in', 'status', ['done', 'error']],
            ]);
            // Scan-Kontingent: consume_scan_quota läuft im Billing-Gate, das nie erreicht wird.
            expect(rpcMock).not.toHaveBeenCalled();
            expect(jobInsertMock).not.toHaveBeenCalled();
            expect(startGatekeeperCheckRunMock).not.toHaveBeenCalled();

            await flushAfterCallbacks();
            expect(processReviewJobMock).not.toHaveBeenCalled();
        },
    );

    it.each([
        ['a failed or reaped job', { status: 'error', degradations: null }],
        ['a time-degraded job', { degradations: ['time_budget_exhausted'] }],
        ['a job whose pre-scan failed', { prescan_degraded: true }],
        ['a job from before degradations were persisted', { degradations: null }],
    ])('reviews a reopened head again when its latest finished job is %s', async (_jobKind, jobFields) => {
        latestHeadJobMock.mockResolvedValue(latestHeadJob(jobFields));

        const response = await POST(buildPullRequestDelivery('reopened'));

        expect(await response.json()).toMatchObject({ success: true, jobId: 'job-under-test' });
        expect(rpcMock).toHaveBeenCalledWith('consume_scan_quota', expect.any(Object));
        expect(jobInsertMock).toHaveBeenCalledTimes(1);
    });

    it('reviews a reopened head when the dedupe lookup itself fails', async () => {
        latestHeadJobMock.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

        const response = await POST(buildPullRequestDelivery('reopened'));

        expect(await response.json()).toMatchObject({ jobId: 'job-under-test' });
        expect(jobInsertMock).toHaveBeenCalledTimes(1);
    });

    it('supersedes running jobs of the previous head on synchronize and closes their checks as cancelled', async () => {
        supersedeReturningMock.mockResolvedValue({
            data: [
                { id: 'outdated-job-with-check', check_run_id: 4711 },
                { id: 'outdated-job-without-check', check_run_id: null },
            ],
            error: null,
        });

        const response = await POST(buildPullRequestDelivery('synchronize', PREVIOUS_HEAD_SHA_UNDER_TEST));

        const [supersedeUpdate] = reviewJobsUpdateMock.mock.calls[0];
        expect(supersedeUpdate).toMatchObject({
            status: 'error',
            error_message: '[superseded] Superseded by b7e23ec',
        });
        // Nur unfertige Webhook-Jobs desselben PRs auf dem VORGÄNGER-Head: fertige Jobs bleiben
        // unangetastet, und eine verspätete Delivery eines älteren Commits trifft nie den Job des neueren.
        expect(recordedJobFilters.slice(0, 5)).toEqual([
            ['eq', 'repository_id', 'repo-row-under-test'],
            ['eq', 'pr_number', 7],
            ['eq', 'source', 'webhook'],
            ['in', 'status', ['pending', 'processing']],
            ['eq', 'payload->>pr_head_sha', PREVIOUS_HEAD_SHA_UNDER_TEST],
        ]);
        // Der neue Head bekommt seinen eigenen Job; synchronize wird nie dedupliziert.
        expect(await response.json()).toMatchObject({ jobId: 'job-under-test' });
        expect(latestHeadJobMock).not.toHaveBeenCalled();

        await flushAfterCallbacks();
        expect(completeGatekeeperCheckRunMock).toHaveBeenCalledTimes(1);
        expect(completeGatekeeperCheckRunMock).toHaveBeenCalledWith(
            'installation-token-under-test',
            'acme/widgets',
            4711,
            expect.objectContaining({
                conclusion: 'cancelled',
                summary: expect.stringContaining('Superseded by b7e23ec'),
            }),
        );
        expect(processReviewJobMock).toHaveBeenCalledWith('job-under-test', 'user-under-test', expect.any(Number));
    });

    it('starts the review of the new head even when superseding the previous one fails', async () => {
        supersedeReturningMock.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

        const response = await POST(buildPullRequestDelivery('synchronize', PREVIOUS_HEAD_SHA_UNDER_TEST));

        expect(await response.json()).toMatchObject({ jobId: 'job-under-test' });
        await flushAfterCallbacks();
        expect(completeGatekeeperCheckRunMock).not.toHaveBeenCalled();
    });

    it('supersedes nothing when a synchronize delivery names no previous head', async () => {
        await POST(buildPullRequestDelivery('synchronize'));

        expect(reviewJobsUpdateMock.mock.calls.filter(([updatePayload]) => updatePayload.status === 'error')).toEqual([]);
        expect(jobInsertMock).toHaveBeenCalledTimes(1);
    });

    it('closes no check when synchronize finds no running job on the previous head', async () => {
        await POST(buildPullRequestDelivery('synchronize', PREVIOUS_HEAD_SHA_UNDER_TEST));

        await flushAfterCallbacks();
        expect(completeGatekeeperCheckRunMock).not.toHaveBeenCalled();
        expect(jobInsertMock).toHaveBeenCalledTimes(1);
    });

    it('never supersedes on reopened or opened: only a new head overtakes a running job', async () => {
        await POST(buildPullRequestDelivery('reopened', PREVIOUS_HEAD_SHA_UNDER_TEST));
        await POST(buildPullRequestDelivery('opened', PREVIOUS_HEAD_SHA_UNDER_TEST));

        const supersedeUpdates = reviewJobsUpdateMock.mock.calls
            .filter(([updatePayload]) => updatePayload.status === 'error');
        expect(supersedeUpdates).toEqual([]);
    });
});
