-- Migration 010: Supabase Realtime für repositories-Tabelle aktivieren
-- Erlaubt dem Dashboard per WebSocket Live-Updates zu empfangen
-- (z.B. syncing → active ohne Page-Refresh).

ALTER PUBLICATION supabase_realtime ADD TABLE repositories;
