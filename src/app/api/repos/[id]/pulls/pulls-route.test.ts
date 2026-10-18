/**
 * Route-Level-Tests für GET /api/repos/[id]/pulls — Liste „Open pull
 * requests“ der Repo-Detailseite (GITHUB_APP_SPEC.md §4.10).
 *
 * `listOpenPullRequests` läuft echt gegen einen gemockten `fetch`, damit
 * Endpunkt, Parser und Fork-Markierung mitgeprüft sind; gemockt sind Session,
 * Supabase und das Installation-Token.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    getUserMock,
    repoSingleMock,
    jobsResponseMock,
    recordedJobFilters,
    getInstallationTokenMock,
    fetchMock,
} = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    repoSingleMock: vi.fn(),
    jobsResponseMock: vi.fn(),
    recordedJobFilters: [] as Array<readonly [string, string, unknown]>,
    getInstallationTokenMock: vi.fn(),
    fetchMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));
vi.mock('@/lib/github-app', async (importOriginal) => {
    const actualGithubApp = await importOriginal<typeof import('@/lib/github-app')>();
    return { ...actualGithubApp, getInstallationToken: getInstallationTokenMock };
});

/** review_jobs: chainbar und thenable, protokolliert die Filter. */
function buildJobsQuery(): Record<string, unknown> {
    const recordFilter = (filterName: string) => (columnName: string, filterValue: unknown) => {
        recordedJobFilters.push([filterName, columnName, filterValue]);
        return jobsQuery;
    };
    const jobsQuery: Record<string, unknown> = {
        eq: recordFilter('eq'),
        in: recordFilter('in'),
        order: () => jobsQuery,
        limit: () => jobsQuery,
        then: (onFulfilled: (queryOutcome: unknown) => unknown) =>
            Promise.resolve(jobsResponseMock()).then(onFulfilled),
    };
    return jobsQuery;
}

vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: (tableName: string) => {
            if (tableName === 'repositories') {
                return { select: () => ({ eq: () => ({ eq: () => ({ single: repoSingleMock }) }) }) };
            }
            return { select: buildJobsQuery };
        },
    },
}));

const { GET } = await import('./route');

const ROUTE_PARAMS = { params: Promise.resolve({ id: 'repo-under-test' }) };
const BASE_REPO_ID = 1001;
const CURRENT_HEAD_SHA = 'd'.repeat(40);

function buildRequest(): Request {
    return new Request('http://localhost/api/repos/repo-under-test/pulls');
}

function githubPull(prNumber: number, headRepoId: number | null, authorAssociation: string) {
    return {
        number: prNumber,
        title: `Change ${prNumber}`,
        html_url: `https://github.com/unslopai/test/pull/${prNumber}`,
        updated_at: '2026-10-13T08:00:00Z',
        author_association: authorAssociation,
        user: { login: 'octocat' },
        head: { sha: CURRENT_HEAD_SHA, ref: `feature-${prNumber}`, repo: headRepoId === null ? null : { id: headRepoId } },
        base: { repo: { id: BASE_REPO_ID } },
    };
}

function respondWithPulls(pullList: unknown): void {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(pullList), { status: 200 }));
}

describe('GET /api/repos/[id]/pulls (GITHUB_APP_SPEC §4.10)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        recordedJobFilters.length = 0;
        vi.stubGlobal('fetch', fetchMock);
        getUserMock.mockResolvedValue({ data: { user: { id: 'user-under-test' } }, error: null });
        repoSingleMock.mockResolvedValue({
            data: {
                id: 'repo-under-test',
                user_id: 'user-under-test',
                full_name: 'unslopai/test',
                status: 'active',
                installation_id: 4711,
                review_fork_prs: false,
            },
            error: null,
        });
        getInstallationTokenMock.mockResolvedValue('installation-token-under-test');
        jobsResponseMock.mockReturnValue({ data: [], error: null });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('answers 401 without a session', async () => {
        getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });

        const response = await GET(buildRequest(), ROUTE_PARAMS);

        expect(response.status).toBe(401);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers 404 for a repository of another tenant', async () => {
        repoSingleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } });

        const response = await GET(buildRequest(), ROUTE_PARAMS);

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'repository_not_found' });
    });

    it('answers 409 github_app_required for a legacy repository, never falling back to the user token', async () => {
        repoSingleMock.mockResolvedValue({
            data: { id: 'repo-under-test', user_id: 'user-under-test', full_name: 'unslopai/test', status: 'active', installation_id: null },
            error: null,
        });

        const response = await GET(buildRequest(), ROUTE_PARAMS);

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'github_app_required' });
        expect(getInstallationTokenMock).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers 502 github_unavailable when GitHub refuses the list', async () => {
        fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

        const response = await GET(buildRequest(), ROUTE_PARAMS);

        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({ error: 'github_unavailable' });
    });

    it('lists open pull requests with fork markers and the latest review per PR', async () => {
        // Zwei Minuten nach dem jüngsten Job: er läuft noch, fern der Reaper-Schwelle (6 min).
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-13T09:02:00Z'));
        respondWithPulls([
            githubPull(16, BASE_REPO_ID, 'OWNER'),
            githubPull(17, 2002, 'CONTRIBUTOR'),
            githubPull(18, null, 'NONE'),
            { number: 'broken' },
        ]);
        jobsResponseMock.mockReturnValue({
            data: [
                { id: 'job-newest-16', pr_number: 16, status: 'processing', created_at: '2026-10-13T09:00:00Z', head_sha: CURRENT_HEAD_SHA },
                { id: 'job-older-16', pr_number: 16, status: 'done', created_at: '2026-10-12T09:00:00Z', head_sha: 'e'.repeat(40) },
                { id: 'job-17', pr_number: 17, status: 'done', created_at: '2026-10-11T09:00:00Z', head_sha: 'e'.repeat(40) },
            ],
            error: null,
        });

        const response = await GET(buildRequest(), ROUTE_PARAMS);

        expect(response.status).toBe(200);
        const [requestedUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(requestedUrl).toBe(
            'https://api.github.com/repos/unslopai/test/pulls?state=open&sort=updated&direction=desc&per_page=50',
        );
        expect(requestInit.headers).toMatchObject({ Authorization: 'Bearer installation-token-under-test' });
        expect(recordedJobFilters).toEqual([
            ['eq', 'repository_id', 'repo-under-test'],
            ['in', 'pr_number', [16, 17, 18]],
        ]);

        const { pullRequests } = await response.json() as { pullRequests: Array<Record<string, unknown>> };
        expect(pullRequests.map((pullRequest) => pullRequest.prNumber)).toEqual([16, 17, 18]);
        expect(pullRequests[0]).toEqual({
            prNumber: 16,
            title: 'Change 16',
            authorLogin: 'octocat',
            headBranch: 'feature-16',
            headSha: CURRENT_HEAD_SHA,
            updatedAt: '2026-10-13T08:00:00Z',
            htmlUrl: 'https://github.com/unslopai/test/pull/16',
            isFork: false,
            isUntrustedFork: false,
            skippedByForkGate: false,
            latestReview: {
                jobId: 'job-newest-16',
                status: 'processing',
                createdAt: '2026-10-13T09:00:00Z',
                onCurrentHead: true,
                isRunning: true,
            },
        });
        expect(pullRequests[1]).toMatchObject({
            isFork: true,
            isUntrustedFork: true,
            skippedByForkGate: true,
            latestReview: { jobId: 'job-17', onCurrentHead: false, isRunning: false },
        });
        // Ein gelöschter Fork (head.repo null) zählt wie beim Webhook-Gate als fremd.
        expect(pullRequests[2]).toMatchObject({ isFork: true, latestReview: null });
    });

    it('does not show a pending job older than the reaper threshold as running', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-13T09:07:00Z'));
        respondWithPulls([githubPull(16, BASE_REPO_ID, 'OWNER')]);
        jobsResponseMock.mockReturnValue({
            data: [{ id: 'job-stuck', pr_number: 16, status: 'pending', created_at: '2026-10-13T09:00:00Z', head_sha: CURRENT_HEAD_SHA }],
            error: null,
        });

        const response = await GET(buildRequest(), ROUTE_PARAMS);

        const { pullRequests } = await response.json() as { pullRequests: Array<Record<string, unknown>> };
        expect(pullRequests[0]).toMatchObject({ latestReview: { jobId: 'job-stuck', isRunning: false } });
    });

    it('skips the job lookup when no pull request is open', async () => {
        respondWithPulls([]);

        const response = await GET(buildRequest(), ROUTE_PARAMS);

        expect(await response.json()).toEqual({ pullRequests: [] });
        expect(jobsResponseMock).not.toHaveBeenCalled();
    });

    it('answers 500 instead of showing a running review as never reviewed when the job lookup fails', async () => {
        respondWithPulls([githubPull(16, BASE_REPO_ID, 'OWNER')]);
        jobsResponseMock.mockReturnValue({ data: null, error: { message: 'connection reset' } });

        const response = await GET(buildRequest(), ROUTE_PARAMS);

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'review_status_unavailable' });
    });
});
