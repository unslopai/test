-- 064_review_jobs_source_dashboard (GITHUB_APP_SPEC.md §4.10, MCP_SPEC.md §4.6 D10)
-- Erweitert den CHECK auf review_jobs.source um 'dashboard': den Job-Ursprung
-- des Knopfs „Review now“ auf der Repo-Detailseite (POST /api/repos/[id]/review).
--
-- Live-Stand vor dieser Migration (pg_constraint, 2026-10-13):
--   CHECK (source = ANY (ARRAY['manual','webhook','cli','mcp']))  -- seit 034
-- Keine Funktion, Policy oder View liest review_jobs.source (geprueft
-- 2026-10-13 ueber pg_proc/pg_policies/pg_views). Der Index
-- review_jobs_repo_pr_created_idx (repository_id, pr_number, created_at DESC)
-- deckt die neuen Lookups der Route bereits ab; kein neuer Index.
--
-- Rein erweiternd: jede bestehende Zeile erfuellt den neuen CHECK, die
-- Pruefung beim ADD CONSTRAINT kann also nicht scheitern.
--
-- Rollback (erst wenn keine Zeile mehr source = 'dashboard' traegt, sonst
-- scheitert das ADD CONSTRAINT; vorher den Knopf per Deploy entfernen und
-- die Zeilen pruefen: SELECT count(*) FROM public.review_jobs WHERE source = 'dashboard'):
--   ALTER TABLE public.review_jobs DROP CONSTRAINT review_jobs_source_check;
--   ALTER TABLE public.review_jobs ADD CONSTRAINT review_jobs_source_check
--       CHECK (source = ANY (ARRAY['manual'::text, 'webhook'::text, 'cli'::text, 'mcp'::text]));

BEGIN;

ALTER TABLE public.review_jobs
    DROP CONSTRAINT review_jobs_source_check;

ALTER TABLE public.review_jobs
    ADD CONSTRAINT review_jobs_source_check
    CHECK (source = ANY (ARRAY['manual'::text, 'webhook'::text, 'cli'::text, 'mcp'::text, 'dashboard'::text]));

COMMIT;
