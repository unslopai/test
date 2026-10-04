/**
 * POST /api/cli/pr/review — Agent-getriggertes PR-Review (MCP_SPEC.md §4.7).
 *
 * Auth: x-api-key (Machine-Auth). Legt einen webhook-FÖRMIGEN review_jobs-
 * Eintrag mit source 'mcp' an (github-reporter läuft, Findings landen als
 * COMMENT-Review auf GitHub), eröffnet den Check Run und dispatcht via after().
 *
 * App-only (§5.4): Legacy-OAuth-Repos werden mit 409 github_app_required
 * abgelehnt — der OAuth-Reporter-Pfad postet REQUEST_CHANGES und kann keine
 * Check Runs öffnen, was die Blast-Radius-Garantie bräche.
 */
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabase } from '@/lib/supabase';
import { resolveApiKey } from '@/lib/api-keys';
import { resolveEntitlement, consumeScanQuota, quotaRetryAfterSeconds } from '@/lib/billing/entitlements';
import { getInstallationToken, GitHubAppAuthError } from '@/lib/github-app';
import { getPullRequestHeadSha } from '@/lib/github';
import { startGatekeeperCheckRun } from '@/lib/check-run';
import { processReviewJob } from '@/lib/worker';

// 300s: after() führt die volle Cascade in derselben Invocation aus.
export const maxDuration = 300;

interface PrReviewRequestBody {
    repoFullName?: string;
    prNumber?: number;
}

export async function POST(request: Request) {
    // Job-Uhr (DEADLINE_GUARD_SPEC D1): der after()-Callback kennt den
    // Invocation-Start nicht, maxDuration zählt aber ab hier.
    const invocationStartedAtMs = Date.now();
    const apiKey = await resolveApiKey(request);
    if (!apiKey) {
        return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 });
    }

    const entitlement = await resolveEntitlement(apiKey.userId);
    if (!entitlement.entitled) {
        return NextResponse.json({ error: entitlement.reason }, { status: 402 });
    }

    const requestBody = await request.json().catch(() => null) as PrReviewRequestBody | null;
    const validationError = validatePrReviewRequest(requestBody);
    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 422 });
    }
    const repoFullName = requestBody!.repoFullName!;
    const prNumber = requestBody!.prNumber!;

    // Quota NACH der Validierung (ein 422 kostet keinen Scan), Lane 'mcp' (§4.6).
    const quotaOutcome = await consumeScanQuota(apiKey.userId, entitlement.plan, 'mcp');
    if (quotaOutcome === 'trial_exhausted') {
        return NextResponse.json({ error: 'trial_quota_exhausted' }, { status: 402 });
    }
    if (quotaOutcome !== 'allowed') {
        return NextResponse.json(
            { error: 'rate_limit_exceeded' },
            { status: 429, headers: { 'Retry-After': String(quotaRetryAfterSeconds()) } },
        );
    }

    const { data: repoRow, error: repoError } = await supabase
        .from('repositories')
        .select('id, user_id, status, installation_id')
        .eq('full_name', repoFullName)
        .eq('user_id', apiKey.userId)
        .single();

    if (repoError || !repoRow || repoRow.status !== 'active') {
        return NextResponse.json({ error: 'repository_not_connected' }, { status: 404 });
    }
    if (repoRow.installation_id === null) {
        return NextResponse.json({ error: 'github_app_required' }, { status: 409 });
    }

    let installationToken: string;
    try {
        installationToken = await getInstallationToken(repoRow.installation_id);
    } catch (tokenError: unknown) {
        const failureReason = tokenError instanceof GitHubAppAuthError ? tokenError.reason : 'unknown';
        console.error(`[PrReview] Kein Installation-Token (${failureReason}) für ${repoFullName}.`);
        return NextResponse.json({ error: 'github_app_unavailable' }, { status: 502 });
    }

    let prHeadSha: string;
    try {
        prHeadSha = await getPullRequestHeadSha(installationToken, repoFullName, prNumber);
    } catch {
        return NextResponse.json({ error: 'pr_not_found' }, { status: 404 });
    }

    const prUrl = `https://github.com/${repoFullName}/pull/${prNumber}`;
    const { data: insertedJob, error: insertError } = await supabase
        .from('review_jobs')
        .insert({
            repository_id: repoRow.id,
            source: 'mcp',
            status: 'pending',
            pr_number: prNumber,
            pr_url: prUrl,
            // Webhook-förmiger Payload OHNE diff — der Worker routet danach in
            // die PR-Pipeline inkl. github-reporter (§4.7).
            payload: {
                repo_full_name: repoFullName,
                pr_number: prNumber,
                pr_url: prUrl,
                pr_head_sha: prHeadSha,
                action: 'mcp_review',
            },
        })
        .select('id')
        .single();

    if (insertError || !insertedJob) {
        console.error('[PrReview] Job-Insert fehlgeschlagen:', insertError);
        return NextResponse.json({ error: 'job_creation_failed' }, { status: 500 });
    }

    const checkRunUrl = await openCheckRun(
        installationToken, insertedJob.id, repoRow.id, repoFullName, prNumber, prHeadSha,
    );

    after(() => processReviewJob(insertedJob.id, repoRow.user_id, invocationStartedAtMs));

    return NextResponse.json({ jobId: insertedJob.id, checkRunUrl }, { status: 202 });
}

// =============================================================================
// Helpers
// =============================================================================

function validatePrReviewRequest(requestBody: PrReviewRequestBody | null): string | null {
    if (!requestBody) return 'invalid_json';
    if (!requestBody.repoFullName || !/^[\w.-]+\/[\w.-]+$/.test(requestBody.repoFullName)) {
        return 'invalid_repo_full_name';
    }
    if (!Number.isInteger(requestBody.prNumber) || requestBody.prNumber! <= 0) {
        return 'invalid_pr_number';
    }
    return null;
}

/**
 * Eröffnet den Check Run und heftet ihn an den Job — identisch zum Webhook-
 * Pfad best effort: ohne Check läuft das Review trotzdem, der Fehler ist
 * bereits in startGatekeeperCheckRun laut geloggt.
 */
async function openCheckRun(
    installationToken: string,
    jobId: string,
    repositoryId: string,
    repoFullName: string,
    prNumber: number,
    prHeadSha: string,
): Promise<string | null> {
    const checkRunId = await startGatekeeperCheckRun(installationToken, repoFullName, prHeadSha);
    if (checkRunId === null) {
        return null;
    }

    const { error: attachError } = await supabase
        .from('review_jobs')
        .update({ check_run_id: checkRunId })
        .eq('id', jobId)
        .eq('repository_id', repositoryId);

    if (attachError) {
        console.error(`[PrReview] check_run_id ${checkRunId} nicht an Job ${jobId} anheftbar:`, attachError);
    }

    return `https://github.com/${repoFullName}/pull/${prNumber}/checks?check_run_id=${checkRunId}`;
}
