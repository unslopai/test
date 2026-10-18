-- pgvector Extension aktivieren
-- Muss einmalig ausgeführt werden, bevor vector-Spalten erstellt werden können.
-- Falls bereits aktiviert, ist dieses Statement ein No-Op (IF NOT EXISTS).
-- Dieses SQL im Supabase Dashboard unter "SQL Editor" ausführen.

CREATE EXTENSION IF NOT EXISTS vector;
