/**
 * Aufbewahrung der Code-Skelette nach dem Trennen eines Repositorys
 * (LEGAL_PAGES_SPEC §4a.2, Datenschutz §6.1/§12).
 *
 * Getrennt heißt: `code_chunks.deactivated_at` gesetzt. Die Chunks bleiben
 * 30 Tage als Embedding-Cache liegen (GITHUB_APP_SPEC D8) und werden danach
 * gelöscht: bei der nächsten Ingestion des Repos (`skeleton.ts`) oder mit dem
 * Repository durch den Cron `cleanup-deactivated-repos` (Migration 052).
 * Beide Wege und beide Trenn-Pfade (Dashboard, GitHub App) lesen die Frist
 * und die Deaktivierung von hier.
 */
import { supabase } from '@/lib/supabase';

const CHUNK_RETENTION_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Identisch zum Intervall des Crons in Migration 052. */
export const CHUNK_RETENTION_MS = CHUNK_RETENTION_DAYS * MILLISECONDS_PER_DAY;

/**
 * PostgREST reicht `.in()` als Query-String durch; eine Installation mit
 * tausenden Repos sprengte sonst die URL-Längengrenze.
 */
const REPOSITORY_BATCH_SIZE = 200;

/** Chunks, die vor diesem Zeitpunkt deaktiviert wurden, sind abgelaufen. */
export function resolveChunkExpiryThreshold(nowMs: number): string {
    return new Date(nowMs - CHUNK_RETENTION_MS).toISOString();
}

/**
 * Markiert die aktiven Chunks der Repositories als deaktiviert. Bereits
 * deaktivierte Chunks behalten ihren Zeitpunkt, damit ein zweites Trennen die
 * 30-Tage-Frist nicht neu startet.
 *
 * Wirft bei einem Datenbankfehler: ein Repository, das als getrennt gilt,
 * dessen Skelette aber aktiv bleiben, widerspräche der Datenschutzerklärung.
 */
export async function deactivateRepositoryChunks(
    repositoryIds: readonly string[],
    deactivatedAtIso: string,
): Promise<void> {
    for (let batchStart = 0; batchStart < repositoryIds.length; batchStart += REPOSITORY_BATCH_SIZE) {
        const repositoryIdBatch = repositoryIds.slice(batchStart, batchStart + REPOSITORY_BATCH_SIZE);
        const { error: deactivateError } = await supabase
            .from('code_chunks')
            .update({ deactivated_at: deactivatedAtIso })
            .in('repository_id', repositoryIdBatch)
            .is('deactivated_at', null);

        if (deactivateError) {
            throw new Error(`Code-Chunks konnten nicht deaktiviert werden: ${deactivateError.message}`);
        }
    }
}
