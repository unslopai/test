/**
 * Route-Level-Tests für POST /api/repos/[id]/review — „Review now“ der
 * Repo-Detailseite (GITHUB_APP_SPEC.md §4.10).
 *
 * Gemockt wird nur die Systemgrenze (Session, Supabase, GitHub, Worker,
 * after()); Entitlement, Quota-Spur, Laufend-Prüfung und Einreiche-Pfad laufen
 * echt gegen den Mock. Geprüft: Reihenfolge der Ablehnungen, dass keine davon
 * einen Scan kostet, und der Insert mit source 'dashboard'.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const PRICE_PRO_MONTHLY_UNDER_TEST = 'pri_pro_monthly_under_test';
process.env.PADDLE_PRICE_PRO_MONTHLY = PRICE_PRO_MONTHLY_UNDER_TEST;

type RecordedFilter = readonly [string, string, unknown];

const {
    getUserMock,
    rpcMock,
    membershipMaybeSingleMock,
    repoSingleMock,
    runningJobMaybeSingleMock,
    recordedRunningFilters,
    jobInsertMock,
    jobInsertSingleMock,
    checkRunAttachEqMock,
    getInstallationTokenMock,
    getPullRequestHeadMock,
    startGatekeeperCheckRunMock,
    processReviewJobMock,
    afterMock,
} = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    rpcMock: vi.fn(),
    membershipMaybeSingleMock: vi.fn(),
    repoSingleMock: vi.fn(),
    runningJobMaybeSingleMock: vi.fn(),
    recordedRunningFilters: [] as RecordedFilter[],
    jobInsertMock: vi.fn(),
    jobInsertSingleMock: vi.fn(),
    checkRunAttachEqMock: vi.fn(),
    getInstallationTokenMock: vi.fn(),
    getPullRequestHeadMock: vi.fn(),
    startGatekeeperCheckRunMock: vi.fn(),
    processReviewJobMock: vi.fn(),
    afterMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));
vi.mock('@/lib/worker', () => ({ processReviewJob: processReviewJobMock }));
vi.mock('@/lib/github', () => ({ getPullRequestHead: getPullRequestHeadMock }));
vi.mock('@/lib/check-run', () => ({ startGatekeeperCheckRun: startGatekeeperCheckRunMock }));
vi.mock('@/lib/github-app', async (importOriginal) => {
    const actualGithubApp = await importOriginal<typeof import('@/lib/github-app')>();
    return { ...actualGithubApp, getInstallationToken: getInstallationTokenMock };
});
vi.mock('next/server', async (importOriginal) => {
    const actualNextServer = await importOriginal<typeof import('next/server')>();
    return { ...actualNextServer, after: afterMock };
});

/** review_jobs-Lookup des laufenden Reviews: protokolliert jeden Filter. */
function buildRunningLookupQuery(): Record<string, unknown> {
    const recordFilter = (filterName: string) => (columnName: string, filterValue: unknown) => {
        recordedRunningFilters.push([filterName, columnName, filterValue]);
        return runningLookupQuery;
    };
    const runningLookupQuery: Record<string, unknown> = {
        eq: recordFilter('eq'),
        in: recordFilter('in'),
        gt: recordFilter('gt'),
        order: () => runningLookupQuery,
        limit: () => runningLookupQuery,
        maybeSingle: runningJobMaybeSingleMock,
    };
    return runningLookupQuery;
}

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
            return {
                select: buildRunningLookupQuery,
                insert: jobInsertMock,
                update: () => ({ eq: () => ({ eq: checkRunAttachEqMock }) }),
            };
        },
    },
}));

const { POST } = await import('./route');

afterAll(() => {
    delete process.env.PADDLE_PRICE_PRO_MONTHLY;
});

const PR_HEAD_SHA_UNDER_TEST = 'c'.repeat(40);
const ROUTE_PARAMS = { params: Promise.resolve({ id: 'repo-under-test' }) };

function buildReviewRequest(reviewBody: unknown): Request {
    return new Request('http://localhost/api/repos/repo-under-test/review', {
        method: 'POST',
        body: typeof reviewBody === 'string' ? reviewBody : JSON.stringify(reviewBody),
    });
}

function repoRowWith(overrides: Record<string, unknown>) {
    return {
        data: {
            id: 'repo-under-test',
            user_id: 'user-under-test',
            full_name: 'unslopai/test',
            status: 'active',
            installation_id: 4711,
            review_fork_prs: false,
            ...overrides,
        },
        error: null,
    };
}

describe('POST /api/repos/[id]/review (GITHUB_APP_SPEC §4.10)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        recordedRunningFilters.length = 0;
        getUserMock.mockResolvedValue({ data: { user: { id: 'user-under-test' } }, error: null });
        membershipMaybeSingleMock.mockResolvedValue({
            data: { billing_accounts: { status: 'active', paddle_price_id: PRICE_PRO_MONTHLY_UNDER_TEST } },
            error: null,
        });
        rpcMock.mockResolvedValue({ data: 'allowed', error: null });
        repoSingleMock.mockResolvedValue(repoRowWith({}));
        runningJobMaybeSingleMock.mockResolvedValue({ data: null, error: null });
        getInstallationTokenMock.mockResolvedValue('installation-token-under-test');
        getPullRequestHeadMock.mockResolvedValue({ headSha: PR_HEAD_SHA_UNDER_TEST, isOpen: true });
        startGatekeeperCheckRunMock.mockResolvedValue(90210);
        checkRunAttachEqMock.mockResolvedValue({ error: null });
        jobInsertMock.mockImplementation(() => ({ select: () => ({ single: jobInsertSingleMock }) }));
        jobInsertSingleMock.mockResolvedValue({ data: { id: 'job-under-test' }, error: null });
    });

    it('answers 401 without a session and reads no repository', async () => {
        getUserMock.mockResolvedValue({ data: { user: null }, error: null });

        const response = await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'unauthorized' });
        expect(repoSingleMock).not.toHaveBeenCalled();
    });

    it('answers 404 for a repository of another tenant and consumes no scan', async () => {
        repoSingleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } });

        const response = await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'repository_not_found' });
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('refuses a legacy OAuth repository with 409 github_app_required and no token fetch', async () => {
        repoSingleMock.mockResolvedValue(repoRowWith({ installation_id: null }));

        const response = await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'github_app_required' });
        expect(getInstallationTokenMock).not.toHaveBeenCalled();
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it.each([
        ['not json at all'],
        [{ prNumber: 0 }],
        [{ prNumber: 7.5 }],
        [{ prNumber: '16' }],
        [[16]],
    ])('answers 422 invalid_pr_number for the body %j', async (malformedBody) => {
        const response = await POST(buildReviewRequest(malformedBody), ROUTE_PARAMS);

        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({ error: 'invalid_pr_number' });
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('answers 409 repository_not_active for a deactivated repository', async () => {
        repoSingleMock.mockResolvedValue(repoRowWith({ status: 'deactivated' }));

        const response = await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'repository_not_active' });
    });

    it('answers 402 without a subscription before any quota is consumed', async () => {
        membershipMaybeSingleMock.mockResolvedValue({ data: null, error: null });

        const response = await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        expect(response.status).toBe(402);
        expect(await response.json()).toEqual({ error: 'no_subscription' });
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('answers 409 review_in_progress with the running job and consumes no scan', async () => {
        runningJobMaybeSingleMock.mockResolvedValue({ data: { id: 'running-job-under-test' }, error: null });

        const response = await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'review_in_progress', jobId: 'running-job-under-test' });
        // Jeder laufende Review dieses PRs, gleich aus welcher Quelle und auf welchem Head.
        expect(recordedRunningFilters.slice(0, 3)).toEqual([
            ['eq', 'repository_id', 'repo-under-test'],
            ['eq', 'pr_number', 16],
            ['in', 'status', ['pending', 'processing']],
        ]);
        expect(rpcMock).not.toHaveBeenCalled();
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('ignores running jobs older than the reaper threshold, so a never-claimed pending job cannot lock the button', async () => {
        const requestStartedAtMs = Date.now();

        await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        const [filterName, columnName, createdAtLowerBound] = recordedRunningFilters[3];
        expect([filterName, columnName]).toEqual(['gt', 'created_at']);
        // Job-Budget 300 s plus eine Minute Reaper-Slack (stale-jobs-selection.ts).
        const lookbackMs = requestStartedAtMs - Date.parse(String(createdAtLowerBound));
        expect(lookbackMs).toBeGreaterThanOrEqual(360_000 - 1_000);
        expect(lookbackMs).toBeLessThanOrEqual(360_000 + 1_000);
    });

    it('answers 429 with Retry-After when the quota window is spent', async () => {
        rpcMock.mockResolvedValue({ data: 'quota_exceeded', error: null });

        const response = await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('3600');
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it('answers 402 trial_quota_exhausted when the trial allowance is spent', async () => {
        rpcMock.mockResolvedValue({ data: 'trial_exhausted', error: null });

        const response = await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        expect(response.status).toBe(402);
        expect(await response.json()).toEqual({ error: 'trial_quota_exhausted' });
    });

    it('answers 409 pr_not_open for a pull request closed after listing', async () => {
        getPullRequestHeadMock.mockResolvedValue({ headSha: PR_HEAD_SHA_UNDER_TEST, isOpen: false });

        const response = await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'pr_not_open' });
        expect(jobInsertMock).not.toHaveBeenCalled();
    });

    it("creates a 'dashboard' job in the full-window lane, opens the check run, and schedules the worker (202)", async () => {
        const response = await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        expect(response.status).toBe(202);
        expect(await response.json()).toEqual({
            jobId: 'job-under-test',
            checkRunUrl: 'https://github.com/unslopai/test/pull/16/checks?check_run_id=90210',
        });
        expect(rpcMock).toHaveBeenCalledWith('consume_scan_quota', {
            target_user_id: 'user-under-test',
            hourly_max: 60,
            monthly_max: 500,
            trial_max: 100,
        });
        const [persistedJobRow] = jobInsertMock.mock.calls[0] as [Record<string, unknown>];
        expect(persistedJobRow).toMatchObject({
            repository_id: 'repo-under-test',
            source: 'dashboard',
            status: 'pending',
            pr_number: 16,
            payload: { repo_full_name: 'unslopai/test', pr_head_sha: PR_HEAD_SHA_UNDER_TEST, action: 'dashboard_review' },
        });
        expect(getInstallationTokenMock).toHaveBeenCalledWith(4711);
        expect(startGatekeeperCheckRunMock).toHaveBeenCalledWith(
            'installation-token-under-test', 'unslopai/test', PR_HEAD_SHA_UNDER_TEST,
        );

        expect(processReviewJobMock).not.toHaveBeenCalled();
        for (const [scheduledCallback] of afterMock.mock.calls) {
            await scheduledCallback();
        }
        expect(processReviewJobMock).toHaveBeenCalledWith('job-under-test', 'user-under-test', expect.any(Number));
    });

    it('lets the click through when the running-review lookup fails (a double run beats a refused review)', async () => {
        runningJobMaybeSingleMock.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

        const response = await POST(buildReviewRequest({ prNumber: 16 }), ROUTE_PARAMS);

        expect(response.status).toBe(202);
        expect(jobInsertMock).toHaveBeenCalledTimes(1);
    });
});
