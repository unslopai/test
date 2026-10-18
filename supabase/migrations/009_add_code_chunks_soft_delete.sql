-- Migration 009: Soft-Delete + Delta-Ingest für code_chunks
--
-- Statt code_chunks beim Deaktivieren eines Repos zu löschen,
-- werden sie "eingefroren" (deactivated_at gesetzt).
-- Beim Reaktivieren werden nur geänderte Dateien neu vektorisiert.
-- Chunks älter als 30 Tage können via Cleanup-Query bereinigt werden.

ALTER TABLE public.code_chunks
    ADD COLUMN IF NOT EXISTS deactivated_at  TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS last_synced_at  TIMESTAMPTZ NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS content_hash    TEXT NULL;     -- SHA-256 des Skeleton-Inhalts für Delta-Erkennung

-- Index für die Cleanup-Query (deaktivierte Chunks, > 30 Tage alt)
CREATE INDEX IF NOT EXISTS idx_code_chunks_deactivated
    ON public.code_chunks (deactivated_at)
    WHERE deactivated_at IS NOT NULL;

-- Backfill: last_synced_at für bestehende Einträge auf created_at setzen
UPDATE public.code_chunks
SET last_synced_at = created_at
WHERE last_synced_at IS NULL;
