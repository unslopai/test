/**
 * POST /api/cli/scan — Nimmt einen lokalen Diff von CLI oder MCP-Server
 * entgegen (SPEC.md §3.4, MCP_SPEC.md §4.7).
 *
 * Auth: x-api-key (Machine-Auth).
 * Legt einen review_jobs-Eintrag (source 'cli' | 'mcp') an und startet die
 * Pipeline asynchron via after(); der Client pollt GET /api/cli/scan/[jobId].
 * MCP-Scans laufen in der reservierten Quota-Lane (§4.6) und tragen die
 * Client-konfigurierte Re-roll-Schwelle im Payload (§4.5).
 */
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabase } from '@/lib/supabase';
import { resolveApiKey } from '@/lib/api-keys';
import { resolveEntitlement, consumeScanQuota, quotaRetryAfterSeconds } from '@/lib/billing/entitlements';
import { processReviewJob } from '@/lib/worker';

// 300s: worst case der Router-Cascade sind 3 sequentielle LLM-Calls
// (Draft + Verify + Pro-Re-Verify) bzw. ein Pro-Volldurchlauf.
export const maxDuration = 300;

const MAX_DIFF_BYTES = 300 * 1024;

/** Sanity-Bound für die Client-Re-roll-Schwelle (MCP_SPEC.md §4.5) — kein Security-Control. */
const MAX_REROLL_LIMIT = 50;

interface ScanRequestBody {
    repoFullName?: string;
    baseSha?: string;
    headSha?: string;
    dirty?: boolean;
    diff?: string;
    source?: string;
    rerollLimit?: number;
}

export async function POST(request: Request) {
    // Job-Uhr (DEADLINE_GUARD_SPEC D1): der after()-Callback kennt den
    // Invocation-Start nicht, maxDuration zählt aber ab hier.
    const invocationStartedAtMs = Date.now();
    const apiKey = await resolveApiKey(request);
    if (!apiKey) {
        return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 });
    }

    // Paid-only (STRIPE_SPEC S2): ohne aktives Abo/Trial/Comp-Grant 0 Scans.
    const entitlement = await resolveEntitlement(apiKey.userId);
    if (!entitlement.entitled) {
        return NextResponse.json({ error: entitlement.reason }, { status: 402 });
    }

    const requestBody = await parseRequestBody(request);
    const validationError = validateScanRequest(requestBody);
    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 422 });
    }

    // Per-User-Quota, über alle Keys summiert (S7): Stunden- + Monats-Fenster
    // und im Trial das harte Lifetime-Kontingent. CLI/MCP laufen in der
    // reduzierten Lane — die Webhook-Reserve bleibt unantastbar (§4.6, D10).
    const scanSource = requestBody!.source === 'mcp' ? 'mcp' : 'cli';
    const quotaOutcome = await consumeScanQuota(apiKey.userId, entitlement.plan, scanSource);

    // Ein aufgebrauchtes Trial ist eine Paywall (402 -> CLI/IDE bieten Upgrade an),
    // kein Rate-Limit (429 signalisiert "gleich wieder verfügbar" — das wäre gelogen).
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
            source: scanSource,
            status: 'pending',
            payload: {
                repo_full_name: requestBody!.repoFullName,
                diff: requestBody!.diff,
                base_sha: requestBody!.baseSha ?? null,
                head_sha: requestBody!.headSha ?? null,
                dirty: requestBody!.dirty ?? false,
                reroll_limit: clampRerollLimit(requestBody!.rerollLimit),
            },
        })
        .select('id')
        .single();

    if (insertError || !insertedJob) {
        console.error('[CliScan] Job-Insert fehlgeschlagen:', insertError);
        return NextResponse.json({ error: 'job_creation_failed' }, { status: 500 });
    }

    after(() => processReviewJob(insertedJob.id, repoRow.user_id, invocationStartedAtMs));

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
    if (requestBody.source !== undefined && requestBody.source !== 'cli' && requestBody.source !== 'mcp') {
        return 'invalid_source';
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

/** [0, 50]-Clamp der Client-Schwelle (§4.5); fehlend/ungültig ⇒ null = Server-Default 3. */
function clampRerollLimit(clientRerollLimit: number | undefined): number | null {
    if (typeof clientRerollLimit !== 'number' || !Number.isInteger(clientRerollLimit)) {
        return null;
    }
    return Math.min(Math.max(clientRerollLimit, 0), MAX_REROLL_LIMIT);
}
