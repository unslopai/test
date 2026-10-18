-- 066_review_jobs_one_running_dashboard_review (GITHUB_APP_SPEC.md §4.10 Bekannte Grenzen)
-- Hoechstens EIN laufender Dashboard-Review je PR. POST /api/repos/[id]/review
-- prueft vor der Quota ohne Sperre, ob ein Review laeuft
-- (findRunningPullRequestReview); zwei gleichzeitige Klicks (zwei Tabs,
-- Skript) passierten beide und legten zwei Jobs samt zwei Check Runs an. Der
-- Index ist die zweite Linie: der zweite Insert scheitert mit 23505, der
-- Einreiche-Pfad (submit-pr-review.ts) antwortet 409 review_in_progress.
--
-- Warum nur source = 'dashboard':
--   - 'webhook': Jobs desselben PRs haelt die Abloesung (supersedeOutdatedJobs,
--     §4.9) in Serie, aber nicht lueckenlos: scheitert sie, kommt eine Delivery
--     verspaetet oder liefert ein Reopen waehrend eines Laufs (§4.9 offene
--     Punkte a, c), ueberlappen zwei Jobs legitim. Ein PR-weiter Index wuerde
--     dann den Job des neuen Heads ablehnen und einen Review verlieren.
--   - 'mcp': ein Agent darf bewusst parallel einreichen (MCP_SPEC §4.7); MCP-
--     Scans mit lokalem Diff tragen ohnehin keine pr_number.
--   - Ein laufender Webhook- oder MCP-Job blockiert den Knopf weiter ueber die
--     Pruefung der Route (quellenunabhaengig), nicht ueber diesen Index.
--
-- Live-Stand vor dieser Migration (2026-10-13, lesend per execute_sql):
--   SELECT repository_id, pr_number, count(*) FROM public.review_jobs
--    WHERE status IN ('pending','processing') AND source = 'dashboard'
--    GROUP BY repository_id, pr_number HAVING count(*) > 1;
--   => 0 Zeilen. Insgesamt 1 Dashboard-Job, 0 offene Jobs (pending/processing)
--      jeder Quelle, 0 pending-Jobs aelter als 6 min. Der CREATE INDEX kann
--      also nicht an Altzeilen scheitern.
--
-- Ohne CONCURRENTLY: apply_migration laeuft in einer Transaktion, und die
-- Tabelle ist klein. Ein nie geclaimter pending-Job wuerde den Index fuer
-- seinen PR dauerhaft belegen; deshalb raeumt der Reaper seit demselben
-- Paket auch pending-Jobs ueber der Schwelle ab (stale-jobs.ts).
--
-- Rollback:
--   DROP INDEX public.review_jobs_one_running_dashboard_review;

CREATE UNIQUE INDEX review_jobs_one_running_dashboard_review
    ON public.review_jobs (repository_id, pr_number)
    WHERE status IN ('pending', 'processing') AND source = 'dashboard';

COMMENT ON INDEX public.review_jobs_one_running_dashboard_review IS
    'Hoechstens ein laufender Dashboard-Review je PR (Doppelklick auf Review now, GITHUB_APP_SPEC 4.10). Nur dashboard: Webhook-Jobs haelt die Abloesung (supersedeOutdatedJobs) in Serie, MCP bleibt aussen vor.';
