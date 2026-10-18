/**
 * POST /api/repos/[id]/review — „Review now“ der Repo-Detailseite
 * (GITHUB_APP_SPEC.md §4.10). Body `{ prNumber }`.
 *
 * Reihenfolge der Prüfungen, jede vor der nächsten und alle bis auf die
 * letzte ohne Scan-Verbrauch: 401 → 404 → 409 github_app_required → 422 →
 * 409 repository_not_active → 402 Entitlement → 409 review_in_progress →
 * gemeinsamer Einreiche-Pfad mit dem MCP-Tool (Quota-Spur 'dashboard' = volle
 * Fenster wie der Webhook, dann Token, Head, Job, Check Run, after()).
 *
 * Bewusst Opt-in per Klick: kein Review nach dem `installation`-Event, kein
 * ungefragter Check Run auf fremden PRs. Ein Fork-PR, den das Fork-Gate beim
 * Push überspringt, darf trotzdem per Klick geprüft werden — der Klick ist die
 * ausdrückliche Zustimmung des Besitzers, der die Quota zahlt.
 */
import { NextResponse } from 'next/server';
import { resolveEntitlement } from '@/lib/billing/entitlements';
import { findRunningPullRequestReview } from '@/lib/pr-head-lifecycle';
import { prReviewRejectionResponse, submitPullRequestReview } from '@/lib/pr-review/submit-pr-review';
import { resolveOwnedAppRepository } from '../owned-app-repository';

// 300s: after() führt die volle Cascade in derselben Invocation aus.
export const maxDuration = 300;

interface RouteParams {
    params: Promise<{ id: string }>;
}

/** Nur `{ "prNumber": <positive Ganzzahl> }`; null = ungültiger Body. */
function readPrNumber(requestBody: unknown): number | null {
    if (typeof requestBody !== 'object' || requestBody === null || Array.isArray(requestBody)) {
        return null;
    }
    const prNumber: unknown = Reflect.get(requestBody, 'prNumber');
    return typeof prNumber === 'number' && Number.isInteger(prNumber) && prNumber > 0 ? prNumber : null;
}

export async function POST(request: Request, { params }: RouteParams) {
    // Job-Uhr (DEADLINE_GUARD_SPEC D1): maxDuration zählt ab dem Handler-Einstieg.
    const invocationStartedAtMs = Date.now();
    const { id: repositoryId } = await params;

    const repositoryAccess = await resolveOwnedAppRepository(repositoryId);
    if (repositoryAccess.kind === 'denied') {
        return repositoryAccess.response;
    }
    const { repository } = repositoryAccess;

    const prNumber = readPrNumber(await request.json().catch(() => null));
    if (prNumber === null) {
        return NextResponse.json({ error: 'invalid_pr_number' }, { status: 422 });
    }
    if (repository.status !== 'active') {
        return NextResponse.json({ error: 'repository_not_active' }, { status: 409 });
    }

    const entitlement = await resolveEntitlement(repository.ownerUserId);
    if (!entitlement.entitled) {
        return NextResponse.json({ error: entitlement.reason }, { status: 402 });
    }

    // Vor der Quota: ein zweiter Klick auf einen laufenden Review kostet nichts.
    const runningJobId = await findRunningPullRequestReview(repository.id, prNumber);
    if (runningJobId !== null) {
        return NextResponse.json({ error: 'review_in_progress', jobId: runningJobId }, { status: 409 });
    }

    const submitOutcome = await submitPullRequestReview({
        target: {
            repositoryId: repository.id,
            ownerUserId: repository.ownerUserId,
            repoFullName: repository.fullName,
            installationId: repository.installationId,
        },
        prNumber,
        source: 'dashboard',
        plan: entitlement.plan,
        invocationStartedAtMs,
    });

    if (submitOutcome.kind === 'rejected') {
        return prReviewRejectionResponse(submitOutcome.rejection);
    }
    return NextResponse.json({ jobId: submitOutcome.jobId, checkRunUrl: submitOutcome.checkRunUrl }, { status: 202 });
}
