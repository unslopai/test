-- Migration 013: Global TTL Cleanup via pg_cron
--
-- Ersetzt das Next.js after() Konstrukt für zuverlässiges Löschen von
-- deaktivierten Repositories nach Ablauf der TTL.

-- pg_cron Extension aktivieren (falls nicht aktiv)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Postgres muss die Extension nutzen dürfen
GRANT USAGE ON SCHEMA cron TO postgres;

-- Cron Job planen
-- Für Testzwecke: Läuft jede Minute und löscht alles was älter als 10 Sekunden ist.
-- Für Produktion später: 
-- SELECT cron.schedule('cleanup-deactivated-repos', '0 0 * * *', $$ DELETE FROM repositories WHERE status = 'deactivated' AND updated_at < NOW() - INTERVAL '30 days'; $$);

SELECT cron.schedule(
    'cleanup-deactivated-repos',
    '* * * * *',
    $$
    DELETE FROM public.repositories 
    WHERE status = 'deactivated' 
    AND updated_at < NOW() - INTERVAL '10 seconds';
    $$
);
