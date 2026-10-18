/**
 * GET /api/repos/[id]/pulls — offene Pull Requests eines Repos für die Karte
 * „Open pull requests“ der Repo-Detailseite (GITHUB_APP_SPEC.md §4.10).
 *
 * Über das Installation-Token der App, nie über das User-OAuth-Token: ein
 * Legacy-Repo bekommt 409 github_app_required (owned-app-repository.ts). Je PR
 * steht der jüngste Review-Job dabei, damit der Knopf vor dem Klick „läuft“
 * oder „zuletzt geprüft“ zeigen kann.
 */
import { NextResponse } from 'next/server';
import { getInstallationToken, GitHubAppAuthError } from '@/lib/github-app';
import { listOpenPullRequests } from '@/lib/github';
import type { OpenPullRequest } from '@/lib/github-webhook-payload';
import {
    loadPullRequestJobs,
    mapOpenPullRequestView,
    pickLatestJobPerPullRequest,
} from '@/lib/pr-review/open-pull-request-view';
import { resolveOwnedAppRepository } from '../owned-app-repository';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
    const { id: repositoryId } = await params;
    const repositoryAccess = await resolveOwnedAppRepository(repositoryId);
    if (repositoryAccess.kind === 'denied') {
        return repositoryAccess.response;
    }
    const { repository } = repositoryAccess;

    let installationToken: string;
    try {
        installationToken = await getInstallationToken(repository.installationId);
    } catch (tokenError: unknown) {
        const failureReason = tokenError instanceof GitHubAppAuthError ? tokenError.reason : 'unknown';
        console.error(`[OpenPulls] Kein Installation-Token (${failureReason}) für ${repository.fullName}.`);
        return NextResponse.json({ error: 'github_app_unavailable' }, { status: 502 });
    }

    let openPullRequests: OpenPullRequest[];
    try {
        openPullRequests = await listOpenPullRequests(installationToken, repository.fullName);
    } catch (listError: unknown) {
        console.error(`[OpenPulls] Offene PRs von ${repository.fullName} nicht lesbar:`, listError);
        return NextResponse.json({ error: 'github_unavailable' }, { status: 502 });
    }

    try {
        const pullRequestJobs = await loadPullRequestJobs(
            repository.id,
            openPullRequests.map((openPullRequest) => openPullRequest.prNumber),
        );
        const latestJobByPrNumber = pickLatestJobPerPullRequest(pullRequestJobs);
        const nowMs = Date.now();
        const pullRequests = openPullRequests.map((openPullRequest) => mapOpenPullRequestView(
            openPullRequest,
            repository.reviewForkPrs,
            latestJobByPrNumber.get(openPullRequest.prNumber),
            nowMs,
        ));
        return NextResponse.json({ pullRequests });
    } catch (jobsError: unknown) {
        console.error(`[OpenPulls] Review-Status für ${repository.fullName} nicht ladbar:`, jobsError);
        return NextResponse.json({ error: 'review_status_unavailable' }, { status: 500 });
    }
}
