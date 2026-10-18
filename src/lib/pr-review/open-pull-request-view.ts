/**
 * DTO der Dashboard-Liste „Open pull requests“ (GITHUB_APP_SPEC.md §4.10):
 * offene PRs von GitHub, angereichert um den jüngsten Review-Job je PR aus
 * `review_jobs`, damit der Knopf „läuft“, „zuletzt geprüft“ oder „noch nie
 * geprüft“ zeigen kann, bevor jemand klickt.
 */
import { supabase } from '@/lib/supabase';
import { isUntrustedForkPullRequest, shouldSkipForkPullRequest } from '@/lib/fork-pr-gate';
import { isLiveReviewJob } from '@/lib/pr-head-lifecycle';
import type { OpenPullRequest } from '@/lib/github-webhook-payload';

/** Der jüngste Review-Job eines PRs, wie die Liste ihn zeigt. */
export interface PullRequestLatestReview {
    readonly jobId: string;
    readonly status: string;
    readonly createdAt: string;
    /** true = der Job lief auf dem aktuellen Head des PRs. */
    readonly onCurrentHead: boolean;
    /**
     * true = der Job kann noch laufen; dieselbe Regel wie die 409
     * `review_in_progress` der Route (Status und Reaper-Schwelle), damit ein
     * nie gestarteter `pending`-Job den Knopf nicht für immer sperrt.
     */
    readonly isRunning: boolean;
}

export interface OpenPullRequestView {
    readonly prNumber: number;
    readonly title: string;
    readonly authorLogin: string | null;
    readonly headBranch: string | null;
    readonly headSha: string;
    readonly updatedAt: string | null;
    readonly htmlUrl: string;
    /** Head liegt in einem anderen Repo als die Basis. */
    readonly isFork: boolean;
    /** Fork eines Autors ohne Schreibrecht: der Webhook prüft ihn nur mit `review_fork_prs`. */
    readonly isUntrustedFork: boolean;
    /** true = der nächste Push bekommt KEINEN automatischen Review (Fork-PR-Gate). */
    readonly skippedByForkGate: boolean;
    readonly latestReview: PullRequestLatestReview | null;
}

/** Die Spalten, die die Liste aus review_jobs liest [DATA-001]. */
export interface PullRequestJobRow {
    readonly id: string;
    readonly prNumber: number;
    readonly status: string;
    readonly createdAt: string;
    readonly headSha: string | null;
}

/** Obergrenze der Job-Zeilen je Liste; die jüngsten zuerst, ältere sind für „zuletzt“ belanglos. */
const LATEST_JOBS_ROW_LIMIT = 500;

export function parsePullRequestJobRow(rawJobRow: unknown): PullRequestJobRow | null {
    if (typeof rawJobRow !== 'object' || rawJobRow === null) return null;
    const id: unknown = Reflect.get(rawJobRow, 'id');
    const prNumber: unknown = Reflect.get(rawJobRow, 'pr_number');
    const status: unknown = Reflect.get(rawJobRow, 'status');
    const createdAt: unknown = Reflect.get(rawJobRow, 'created_at');
    const headSha: unknown = Reflect.get(rawJobRow, 'head_sha');
    if (typeof id !== 'string' || typeof prNumber !== 'number'
        || typeof status !== 'string' || typeof createdAt !== 'string') {
        return null;
    }
    return { id, prNumber, status, createdAt, headSha: typeof headSha === 'string' ? headSha : null };
}

/** Erste Zeile je PR gewinnt — die Zeilen kommen nach created_at absteigend. */
export function pickLatestJobPerPullRequest(jobRows: readonly PullRequestJobRow[]): ReadonlyMap<number, PullRequestJobRow> {
    const latestJobByPrNumber = new Map<number, PullRequestJobRow>();
    for (const jobRow of jobRows) {
        if (!latestJobByPrNumber.has(jobRow.prNumber)) {
            latestJobByPrNumber.set(jobRow.prNumber, jobRow);
        }
    }
    return latestJobByPrNumber;
}

export function mapOpenPullRequestView(
    openPullRequest: OpenPullRequest,
    reviewForkPrs: boolean,
    latestJob: PullRequestJobRow | undefined,
    nowMs: number,
): OpenPullRequestView {
    return {
        prNumber: openPullRequest.prNumber,
        title: openPullRequest.title,
        authorLogin: openPullRequest.authorLogin,
        headBranch: openPullRequest.headBranch,
        headSha: openPullRequest.headSha,
        updatedAt: openPullRequest.updatedAt,
        htmlUrl: openPullRequest.htmlUrl,
        isFork: openPullRequest.isCrossRepository,
        isUntrustedFork: isUntrustedForkPullRequest(openPullRequest),
        skippedByForkGate: shouldSkipForkPullRequest(openPullRequest, reviewForkPrs),
        latestReview: latestJob
            ? {
                jobId: latestJob.id,
                status: latestJob.status,
                createdAt: latestJob.createdAt,
                onCurrentHead: latestJob.headSha === openPullRequest.headSha,
                isRunning: isLiveReviewJob(latestJob.status, latestJob.createdAt, nowMs),
            }
            : null,
    };
}

/**
 * Die Review-Jobs der gelisteten PRs, jüngste zuerst. Wirft bei einem
 * DB-Fehler: die Route antwortet dann 500, statt einen laufenden Review als
 * „nie geprüft“ zu zeigen.
 */
export async function loadPullRequestJobs(
    repositoryId: string,
    prNumbers: readonly number[],
): Promise<PullRequestJobRow[]> {
    if (prNumbers.length === 0) {
        return [];
    }

    const { data: jobRows, error: jobsError } = await supabase
        .from('review_jobs')
        .select('id, pr_number, status, created_at, head_sha:payload->>pr_head_sha')
        .eq('repository_id', repositoryId)
        .in('pr_number', prNumbers)
        .order('created_at', { ascending: false })
        .limit(LATEST_JOBS_ROW_LIMIT);

    if (jobsError) {
        throw new Error(`review_jobs der offenen PRs nicht lesbar: ${jobsError.message}`);
    }

    return (jobRows ?? [])
        .map(parsePullRequestJobRow)
        .filter((jobRow): jobRow is PullRequestJobRow => jobRow !== null);
}
