/**
 * Gemeinsamer Einreiche-Pfad für PR-Reviews außerhalb des Webhooks:
 * MCP-Tool `unslop_review_pr` (MCP_SPEC.md §4.7) und der Dashboard-Knopf
 * „Review now“ (GITHUB_APP_SPEC.md §4.10).
 *
 * Reihenfolge: Quota → Installation-Token → Head-SHA → webhook-FÖRMIGER
 * review_jobs-Eintrag → Check Run → after(processReviewJob). Auth,
 * Entitlement und Repo-Lookup bleiben in den Routen, weil sie dort
 * unterschiedlich laufen (API-Key gegen Session, full_name gegen uuid).
 *
 * App-only (§5.4): der Aufrufer reicht nur Repos mit installation_id herein —
 * der OAuth-Reporter-Pfad postet REQUEST_CHANGES und kann keine Check Runs
 * öffnen, was die Blast-Radius-Garantie bräche.
 */
import { after, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { consumeScanQuota, quotaRetryAfterSeconds } from '@/lib/billing/entitlements';
import type { PlanEntitlements } from '@/lib/billing/plan-config';
import { getInstallationToken, GitHubAppAuthError } from '@/lib/github-app';
import { getPullRequestHead, getPullRequestHeadSha } from '@/lib/github';
import { startGatekeeperCheckRun } from '@/lib/check-run';
import { processReviewJob } from '@/lib/worker';

/** Die Oberflächen, die diesen Pfad nutzen; zugleich `review_jobs.source`. */
export type PrReviewSource = 'mcp' | 'dashboard';

/** Das Repo, gegen das eingereicht wird — Besitz und App-Installation sind geprüft. */
export interface PrReviewTarget {
    readonly repositoryId: string;
    readonly ownerUserId: string;
    readonly repoFullName: string;
    readonly installationId: number;
}

export interface PrReviewSubmission {
    readonly target: PrReviewTarget;
    readonly prNumber: number;
    readonly source: PrReviewSource;
    readonly plan: PlanEntitlements;
    /** `Date.now()` am Handler-Einstieg der Route (DEADLINE_GUARD_SPEC D1). */
    readonly invocationStartedAtMs: number;
}

export type PrReviewRejection =
    | 'trial_quota_exhausted'
    | 'rate_limit_exceeded'
    | 'github_app_unavailable'
    | 'pr_not_found'
    | 'pr_not_open'
    | 'job_creation_failed';

export type PrReviewSubmitOutcome =
    | { readonly kind: 'submitted'; readonly jobId: string; readonly checkRunUrl: string | null }
    | { readonly kind: 'rejected'; readonly rejection: PrReviewRejection };

type HeadResolution =
    | { readonly kind: 'resolved'; readonly headSha: string }
    | { readonly kind: 'rejected'; readonly rejection: PrReviewRejection };

const REJECTION_STATUS: Readonly<Record<PrReviewRejection, number>> = {
    trial_quota_exhausted: 402,
    rate_limit_exceeded: 429,
    github_app_unavailable: 502,
    pr_not_found: 404,
    pr_not_open: 409,
    job_creation_failed: 500,
};

/** Die HTTP-Antwort einer Ablehnung — für beide Routen dieselbe Zuordnung. */
export function prReviewRejectionResponse(rejection: PrReviewRejection): NextResponse {
    const retryHeaders: Record<string, string> = rejection === 'rate_limit_exceeded'
        ? { 'Retry-After': String(quotaRetryAfterSeconds()) }
        : {};
    return NextResponse.json({ error: rejection }, { status: REJECTION_STATUS[rejection], headers: retryHeaders });
}

export async function submitPullRequestReview(submission: PrReviewSubmission): Promise<PrReviewSubmitOutcome> {
    const { target, prNumber, source } = submission;

    // Quota VOR den GitHub-Calls, damit ein erschöpftes Kontingent keine
    // Token-Abrufe mehr auslöst. Die Spur hängt an der Quelle (§4.6, D10).
    const quotaOutcome = await consumeScanQuota(target.ownerUserId, submission.plan, source);
    if (quotaOutcome === 'trial_exhausted') {
        return { kind: 'rejected', rejection: 'trial_quota_exhausted' };
    }
    if (quotaOutcome !== 'allowed') {
        return { kind: 'rejected', rejection: 'rate_limit_exceeded' };
    }

    let installationToken: string;
    try {
        installationToken = await getInstallationToken(target.installationId);
    } catch (tokenError: unknown) {
        const failureReason = tokenError instanceof GitHubAppAuthError ? tokenError.reason : 'unknown';
        console.error(`[PrReview] Kein Installation-Token (${failureReason}) für ${target.repoFullName}.`);
        return { kind: 'rejected', rejection: 'github_app_unavailable' };
    }

    const headResolution = await resolvePullRequestHead(installationToken, target.repoFullName, prNumber, source);
    if (headResolution.kind === 'rejected') {
        return headResolution;
    }

    const jobId = await insertPullRequestJob(target, prNumber, source, headResolution.headSha);
    if (jobId === null) {
        return { kind: 'rejected', rejection: 'job_creation_failed' };
    }

    const checkRunUrl = await openCheckRun(installationToken, jobId, target, prNumber, headResolution.headSha);

    after(() => processReviewJob(jobId, target.ownerUserId, submission.invocationStartedAtMs));

    return { kind: 'submitted', jobId, checkRunUrl };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Der MCP-Pfad bleibt beim reinen Head-Lookup (MCP_SPEC §4.7, unverändert).
 * Der Dashboard-Pfad prüft zusätzlich den Zustand: die Liste zeigt nur offene
 * PRs, ein in der Zwischenzeit geschlossener PR bekommt `pr_not_open`.
 */
async function resolvePullRequestHead(
    installationToken: string,
    repoFullName: string,
    prNumber: number,
    source: PrReviewSource,
): Promise<HeadResolution> {
    try {
        if (source === 'mcp') {
            return { kind: 'resolved', headSha: await getPullRequestHeadSha(installationToken, repoFullName, prNumber) };
        }
        const pullRequestHead = await getPullRequestHead(installationToken, repoFullName, prNumber);
        return pullRequestHead.isOpen
            ? { kind: 'resolved', headSha: pullRequestHead.headSha }
            : { kind: 'rejected', rejection: 'pr_not_open' };
    } catch (headLookupError: unknown) {
        console.error(`[PrReview] PR ${repoFullName}#${prNumber} nicht lesbar:`, headLookupError);
        return { kind: 'rejected', rejection: 'pr_not_found' };
    }
}

/** Webhook-förmiger Job OHNE diff — der Worker routet in die PR-Pipeline inkl. github-reporter. */
async function insertPullRequestJob(
    target: PrReviewTarget,
    prNumber: number,
    source: PrReviewSource,
    prHeadSha: string,
): Promise<string | null> {
    const prUrl = `https://github.com/${target.repoFullName}/pull/${prNumber}`;
    const { data: insertedJob, error: insertError } = await supabase
        .from('review_jobs')
        .insert({
            repository_id: target.repositoryId,
            source,
            status: 'pending',
            pr_number: prNumber,
            pr_url: prUrl,
            payload: {
                repo_full_name: target.repoFullName,
                pr_number: prNumber,
                pr_url: prUrl,
                pr_head_sha: prHeadSha,
                action: `${source}_review`,
            },
        })
        .select('id')
        .single();

    if (insertError || !insertedJob) {
        console.error('[PrReview] Job-Insert fehlgeschlagen:', insertError);
        return null;
    }
    return insertedJob.id;
}

/**
 * Eröffnet den Check Run und heftet ihn an den Job — identisch zum Webhook-
 * Pfad best effort: ohne Check läuft das Review trotzdem, der Fehler ist
 * bereits in startGatekeeperCheckRun laut geloggt.
 */
async function openCheckRun(
    installationToken: string,
    jobId: string,
    target: PrReviewTarget,
    prNumber: number,
    prHeadSha: string,
): Promise<string | null> {
    const checkRunId = await startGatekeeperCheckRun(installationToken, target.repoFullName, prHeadSha);
    if (checkRunId === null) {
        return null;
    }

    const { error: attachError } = await supabase
        .from('review_jobs')
        .update({ check_run_id: checkRunId })
        .eq('id', jobId)
        .eq('repository_id', target.repositoryId);

    if (attachError) {
        console.error(`[PrReview] check_run_id ${checkRunId} nicht an Job ${jobId} anheftbar:`, attachError);
    }

    return `https://github.com/${target.repoFullName}/pull/${prNumber}/checks?check_run_id=${checkRunId}`;
}
