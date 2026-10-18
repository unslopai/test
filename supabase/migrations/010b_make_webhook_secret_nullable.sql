-- Mirror einer remote-only Migration (Remote-Version: 20260520101242).
-- Wurde seinerzeit direkt am Remote-Projekt angewendet, ohne lokale Datei.
-- Verifiziert am 2026-07-11: repositories.webhook_secret ist nullable.
ALTER TABLE public.repositories ALTER COLUMN webhook_secret DROP NOT NULL;
