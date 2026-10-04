/**
 * Unit Tests: Aufbewahrung der Code-Skelette (LEGAL_PAGES_SPEC §4a.2).
 *
 * Kern-Invarianten: die Frist ist 30 Tage (kein Testwert), bereits
 * deaktivierte Chunks behalten ihren Zeitpunkt, und ein Datenbankfehler wird
 * nicht verschluckt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findStep, hasStep } from '@/lib/testing/supabase-recorder';

const supabaseRecorder = await vi.hoisted(async () => {
    const { createSupabaseRecorder } = await import('@/lib/testing/supabase-recorder');
    return createSupabaseRecorder();
});

vi.mock('@/lib/supabase', () => ({ supabase: supabaseRecorder.client }));

const { CHUNK_RETENTION_MS, deactivateRepositoryChunks, resolveChunkExpiryThreshold } = await import('@/lib/chunk-retention');

const DEACTIVATED_AT_UNDER_TEST = '2026-09-30T12:00:00.000Z';

describe('resolveChunkExpiryThreshold', () => {
    it('liegt genau 30 Tage vor dem Bezugszeitpunkt', () => {
        const nowMs = Date.parse('2026-09-30T12:00:00.000Z');

        expect(CHUNK_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
        expect(resolveChunkExpiryThreshold(nowMs)).toBe('2026-08-31T12:00:00.000Z');
    });
});

describe('deactivateRepositoryChunks', () => {
    beforeEach(() => {
        supabaseRecorder.reset();
    });

    it('setzt deactivated_at nur auf noch aktive Chunks der genannten Repositories', async () => {
        await deactivateRepositoryChunks(['repo-a', 'repo-b'], DEACTIVATED_AT_UNDER_TEST);

        expect(supabaseRecorder.queries).toHaveLength(1);
        const [chunkUpdate] = supabaseRecorder.queries;
        expect(chunkUpdate.table).toBe('code_chunks');
        expect(findStep(chunkUpdate, 'update')?.args).toEqual([{ deactivated_at: DEACTIVATED_AT_UNDER_TEST }]);
        expect(hasStep(chunkUpdate, 'in', ['repository_id', ['repo-a', 'repo-b']])).toBe(true);
        // Ohne diesen Filter startete ein zweites Trennen die 30-Tage-Frist neu.
        expect(hasStep(chunkUpdate, 'is', ['deactivated_at', null])).toBe(true);
    });

    it('fragt ohne Repositories gar nicht erst an', async () => {
        await deactivateRepositoryChunks([], DEACTIVATED_AT_UNDER_TEST);

        expect(supabaseRecorder.queries).toEqual([]);
    });

    it('teilt große Installationen in Batches von 200 Repositories', async () => {
        const repositoryIds = Array.from({ length: 450 }, (_unused, repositoryIndex) => `repo-${repositoryIndex}`);

        await deactivateRepositoryChunks(repositoryIds, DEACTIVATED_AT_UNDER_TEST);

        const batchSizes = supabaseRecorder.queries.map((chunkUpdate) => {
            const [, repositoryIdBatch] = findStep(chunkUpdate, 'in')?.args ?? [];
            return Array.isArray(repositoryIdBatch) ? repositoryIdBatch.length : 0;
        });
        expect(batchSizes).toEqual([200, 200, 50]);
    });

    it('wirft bei einem Datenbankfehler statt ihn zu verschlucken', async () => {
        supabaseRecorder.respond = () => ({ data: null, error: { message: 'connection reset' } });

        await expect(deactivateRepositoryChunks(['repo-a'], DEACTIVATED_AT_UNDER_TEST))
            .rejects.toThrow('Code-Chunks konnten nicht deaktiviert werden: connection reset');
    });
});
