/**
 * POST /api/cli/scan — Nimmt einen lokalen Diff vom CLI entgegen (SPEC.md §3.4).
 *
 * Auth: x-api-key (Machine-Auth). Rate-Limit: Fixed Window pro Key.
 * Legt einen review_jobs-Eintrag (source 'cli') an und startet die Pipeline
 * asynchron via after(); der Client pollt GET /api/cli/scan/[jobId].
 */
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabase } from '@/lib/supabase';
import { resolveApiKey } from '@/lib/api-keys';
import { resolveEntitlement, consumeScanQuota, quotaRetryAfterSeconds } from '@/lib/billing/entitlements';
import { processReviewJob } from '@/lib/worker';

export const maxDuration = 60;

const MAX_DIFF_BYTES = 300 * 1024;

interface ScanRequestBody {
    repoFullName?: string;
    baseSha?: string;
    headSha?: string;
    dirty?: boolean;
    diff?: string;
}

export async function POST(request: Request) {
    const apiKey = await resolveApiKey(request);
    if (!apiKey) {
        return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 });
    }

    // Paid-only (STRIPE_SPEC S2): ohne aktives Abo/Trial/Comp-Grant 0 Scans.
    const entitlement = await resolveEntitlement(apiKey.userId);
    if (!entitlement.entitled) {
        return NextResponse.json({ error: entitlement.reason }, { status: 402 });
    }

    // Per-User-Quota, über alle Keys summiert (S7): Stunden- + Monats-Fenster.
    const requestAllowed = await consumeScanQuota(apiKey.userId, entitlement.plan);
    if (!requestAllowed) {
        return NextResponse.json(
            { error: 'rate_limit_exceeded' },
            { status: 429, headers: { 'Retry-After': String(quotaRetryAfterSeconds()) } },
        );
    }

    const requestBody = await parseRequestBody(request);
    const validationError = validateScanRequest(requestBody);
    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 422 });
    }

    const { data: repoRow, error: repoError } = await supabase
        .from('repositories')
        .select('id, user_id, status')
        .eq('full_name', requestBody!.repoFullName!)
        .eq('user_id', apiKey.userId)
        .single();

    if (repoError || !repoRow || repoRow.status !== 'active') {
        return NextResponse.json({ error: 'repository_not_connected' }, { status: 404 });
    }

    const { data: insertedJob, error: insertError } = await supabase
        .from('review_jobs')
        .insert({
            repository_id: repoRow.id,
            source: 'cli',
            status: 'pending',
            payload: {
                repo_full_name: requestBody!.repoFullName,
                diff: requestBody!.diff,
                base_sha: requestBody!.baseSha ?? null,
                head_sha: requestBody!.headSha ?? null,
                dirty: requestBody!.dirty ?? false,
            },
        })
        .select('id')
        .single();

    if (insertError || !insertedJob) {
        console.error('[CliScan] Job-Insert fehlgeschlagen:', insertError);
        return NextResponse.json({ error: 'job_creation_failed' }, { status: 500 });
    }

    after(() => processReviewJob(insertedJob.id, repoRow.user_id));

    return NextResponse.json({ jobId: insertedJob.id }, { status: 202 });
}

// =============================================================================
// Validation
// =============================================================================

async function parseRequestBody(request: Request): Promise<ScanRequestBody | null> {
    try {
        return await request.json() as ScanRequestBody;
    } catch {
        return null;
    }
}

function validateScanRequest(requestBody: ScanRequestBody | null): string | null {
    if (!requestBody) return 'invalid_json';
    if (!requestBody.repoFullName || !/^[\w.-]+\/[\w.-]+$/.test(requestBody.repoFullName)) {
        return 'invalid_repo_full_name';
    }
    if (!requestBody.diff || typeof requestBody.diff !== 'string') {
        return 'missing_diff';
    }
    if (Buffer.byteLength(requestBody.diff, 'utf-8') > MAX_DIFF_BYTES) {
        return 'diff_too_large';
    }
    if (!requestBody.diff.includes('diff --git')) {
        return 'diff_not_unified_format';
    }
    return null;
}
