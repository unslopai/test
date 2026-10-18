/**
 * GET /api/cli/scan/[jobId] — Polling-Endpoint für CLI-Scans (SPEC.md §3.4).
 *
 * Auth: x-api-key; der Job muss zu einem Repository des Key-Owners gehören.
 * Meldet 'processing'-Jobs älter als 5 Minuten als 'error' (job_stalled),
 * damit das CLI nicht endlos pollt, wenn die Serverless-Invocation starb.
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { resolveApiKey } from '@/lib/api-keys';

const STALLED_JOB_THRESHOLD_MS = 5 * 60 * 1000;

interface RouteParams {
    params: Promise<{ jobId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
    const apiKey = await resolveApiKey(request);
    if (!apiKey) {
        return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 });
    }

    const { jobId } = await params;

    const { data: jobRow, error: jobError } = await supabase
        .from('review_jobs')
        .select('id, status, result, error_message, repository_id, updated_at')
        .eq('id', jobId)
        .eq('source', 'cli')
        .single();

    if (jobError || !jobRow || !jobRow.repository_id) {
        return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
    }

    // Ownership: das Repository des Jobs muss dem Key-Owner gehören.
    const { data: repoRow, error: repoError } = await supabase
        .from('repositories')
        .select('id')
        .eq('id', jobRow.repository_id)
        .eq('user_id', apiKey.userId)
        .single();

    if (repoError || !repoRow) {
        return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
    }

    if (jobRow.status === 'processing' && isStalled(jobRow.updated_at)) {
        return NextResponse.json({ status: 'error', error: 'job_stalled' });
    }

    if (jobRow.status === 'error') {
        return NextResponse.json({ status: 'error', error: jobRow.error_message ?? 'unknown_error' });
    }

    if (jobRow.status !== 'done') {
        return NextResponse.json({ status: jobRow.status });
    }

    return NextResponse.json({ status: 'done', result: toScanResult(jobRow.result) });
}

// =============================================================================
// Helpers
// =============================================================================

function isStalled(updatedAt: string | null): boolean {
    if (!updatedAt) return false;
    return Date.now() - new Date(updatedAt).getTime() > STALLED_JOB_THRESHOLD_MS;
}

/** Mappt das persistierte review_jobs.result auf den Shared ScanResult-Contract. */
function toScanResult(persistedResult: unknown): Record<string, unknown> {
    const resultBlob = (persistedResult ?? {}) as {
        review?: { has_slop?: boolean; issues?: unknown[]; summary?: string };
        files_reviewed?: number;
    };

    return {
        hasSlop: resultBlob.review?.has_slop ?? false,
        issues: resultBlob.review?.issues ?? [],
        summary: resultBlob.review?.summary ?? '',
        filesReviewed: resultBlob.files_reviewed ?? 0,
    };
}
