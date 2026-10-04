/**
 * Unit Test: TTL-Cleanup der Skeleton-Ingestion (LEGAL_PAGES_SPEC §4a.2).
 *
 * Bis 2026-09-30 stand hier ein 10-Sekunden-Testwert: jede Re-Ingestion löschte
 * alle deaktivierten Chunks sofort und machte den 30-Tage-Cache wertlos. Die
 * Frist ist jetzt dieselbe wie im Cron (Migration 052).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findStep, hasStep } from '@/lib/testing/supabase-recorder';
import type { RecordedQuery } from '@/lib/testing/supabase-recorder';

const supabaseRecorder = await vi.hoisted(async () => {
    const { createSupabaseRecorder } = await import('@/lib/testing/supabase-recorder');
    return createSupabaseRecorder();
});

vi.mock('@/lib/supabase', () => ({ supabase: supabaseRecorder.client }));
vi.mock('@/lib/embeddings', () => ({ generateEmbeddings: vi.fn() }));
vi.mock('@/lib/github', () => ({
    fetchRepoTree: vi.fn(() => Promise.resolve([])),
    fetchFileContent: vi.fn(),
}));
vi.mock('@/lib/pipeline/ecosystem-detection', () => ({
    detectRepoEcosystems: vi.fn(() => Promise.resolve([])),
}));

const { ingestRepository } = await import('@/lib/skeleton');

function chunkDeletes(): RecordedQuery[] {
    return supabaseRecorder.queries.filter((recordedQuery) =>
        recordedQuery.table === 'code_chunks' && findStep(recordedQuery, 'delete') !== undefined);
}

describe('ingestRepository — TTL-Cleanup und veraltete Chunks', () => {
    beforeEach(() => {
        supabaseRecorder.reset();
        vi.useFakeTimers({ now: Date.parse('2026-09-30T12:00:00.000Z') });
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('löscht nur Chunks, die seit mehr als 30 Tagen deaktiviert sind', async () => {
        await ingestRepository('repo-under-test', 'token-under-test', 'acme/widgets');

        const [ttlCleanup] = chunkDeletes();
        expect(ttlCleanup).toBeDefined();
        expect(hasStep(ttlCleanup, 'eq', ['repository_id', 'repo-under-test'])).toBe(true);
        expect(hasStep(ttlCleanup, 'lt', ['deactivated_at', '2026-08-31T12:00:00.000Z'])).toBe(true);
    });

    it('löscht nach der Ingestion alle noch deaktivierten Chunks: sie waren kein Cache-Treffer', async () => {
        await ingestRepository('repo-under-test', 'token-under-test', 'acme/widgets');

        // match_code_chunks filtert deactivated_at nicht; ein veraltetes Skelett
        // stünde sonst neben dem neuen im Reviewer-Prompt.
        const [, unmatchedPurge] = chunkDeletes();
        expect(unmatchedPurge).toBeDefined();
        expect(hasStep(unmatchedPurge, 'eq', ['repository_id', 'repo-under-test'])).toBe(true);
        expect(hasStep(unmatchedPurge, 'not', ['deactivated_at', 'is', null])).toBe(true);
        expect(findStep(unmatchedPurge, 'lt')).toBeUndefined();
    });

    it('scheitert die Ingestion, wenn veraltete Chunks nicht gelöscht werden können', async () => {
        supabaseRecorder.respond = (recordedQuery) => {
            const isUnmatchedPurge = recordedQuery.table === 'code_chunks'
                && findStep(recordedQuery, 'delete') !== undefined
                && findStep(recordedQuery, 'lt') === undefined;
            return isUnmatchedPurge
                ? { data: null, error: { message: 'statement timeout' } }
                : { data: [], error: null };
        };

        await expect(ingestRepository('repo-under-test', 'token-under-test', 'acme/widgets'))
            .rejects.toThrow('Veraltete Skeleton-Chunks konnten nicht gelöscht werden: statement timeout');
    });
});
