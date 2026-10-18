/**
 * POST /api/cli/pr/review — Agent-getriggertes PR-Review (MCP_SPEC.md §4.7).
 *
 * Auth: x-api-key (Machine-Auth). Legt einen webhook-FÖRMIGEN review_jobs-
 * Eintrag mit source 'mcp' an (github-reporter läuft, Findings landen als
 * COMMENT-Review auf GitHub), eröffnet den Check Run und dispatcht via after().
 * Der Kern ab der Quota liegt in `@/lib/pr-review/submit-pr-review` und wird
 * mit dem Dashboard-Knopf „Review now“ geteilt (GITHUB_APP_SPEC §4.10).
 *
 * App-only (§5.4): Legacy-OAuth-Repos werden mit 409 github_app_required
 * abgelehnt — der OAuth-Reporter-Pfad postet REQUEST_CHANGES und kann keine
 * Check Runs öffnen, was die Blast-Radius-Garantie bräche.
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { resolveApiKey } from '@/lib/api-keys';
import { resolveEntitlement } from '@/lib/billing/entitlements';
import { prReviewRejectionResponse, submitPullRequestReview } from '@/lib/pr-review/submit-pr-review';

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

    // Quota NACH Validierung und Repo-Lookup (ein 422/404/409 kostet keinen
    // Scan, SERVER_AUDIT_2026-09 L1); Lane 'mcp' (§4.6).
    const submitOutcome = await submitPullRequestReview({
        target: {
            repositoryId: repoRow.id,
            ownerUserId: repoRow.user_id,
            repoFullName,
            installationId: repoRow.installation_id,
        },
        prNumber,
        source: 'mcp',
        plan: entitlement.plan,
        invocationStartedAtMs,
    });

    if (submitOutcome.kind === 'rejected') {
        return prReviewRejectionResponse(submitOutcome.rejection);
    }
    return NextResponse.json({ jobId: submitOutcome.jobId, checkRunUrl: submitOutcome.checkRunUrl }, { status: 202 });
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
