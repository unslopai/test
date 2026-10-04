-- ENTWURF — NICHT ANGEWENDET (blocked: tooling, Supabase-Management-Ebene SU-457471).
-- Ausführung: SQL-Editor des Dashboards durch den User, zusammen mit dem
-- v2/v3-Backfill aus ROADMAP To-Do §7 (eine Migration, konsistent mit 030).
--
-- Pre-Scanner v4 (2026-09-24, pre_scanner_design.md §9): die Config-Engine-
-- Checks sind datei-lokal und fail-safe gebaut, also PARTIAL statt FULL:
--   SEC-032/033: Serverless-Gate, keine Condition-/Principal-Statements,
--                Rollen mit Policies in anderen Dateien bleiben unbekannt.
--   SEC-042/043: nur Claude-Code-Settings (.claude/settings*.json).
--   SEC-019/034: bleiben partial (unverändert zu 030).
--   MAINT-009:   deterministische Variante verworfen (Peer-/implizite Deps,
--                Nutzung außerhalb des Diffs) → none, Engine NULL.
WITH prescan_metadata_v4 (rule_id, coverage, engine) AS (
    VALUES
        ('SEC-032', 'partial', 'config'),
        ('SEC-033', 'partial', 'config'),
        ('SEC-042', 'partial', 'config'),
        ('SEC-043', 'partial', 'config'),
        ('MAINT-009', 'none', NULL)
)
UPDATE golden_standards
SET deterministic_coverage = prescan_metadata_v4.coverage,
    prescan_engine = prescan_metadata_v4.engine
FROM prescan_metadata_v4
WHERE golden_standards.rule_id = prescan_metadata_v4.rule_id;
