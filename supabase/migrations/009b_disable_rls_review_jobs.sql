-- Mirror einer remote-only Migration (Remote-Version: 20260518150824).
-- Wurde seinerzeit direkt am Remote-Projekt angewendet, ohne lokale Datei.
-- HINWEIS: Historisch — der Zustand wurde später durch
-- 017_reconcile_reenable_rls_review_jobs wieder umgekehrt (RLS ist heute AKTIV).
ALTER TABLE public.review_jobs DISABLE ROW LEVEL SECURITY;
