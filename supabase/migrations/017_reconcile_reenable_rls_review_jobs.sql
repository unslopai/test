-- Reconciliation: review_jobs RLS ist aktuell AKTIV, aber die Remote-History
-- endete mit 'disable_rls_review_jobs' (20260518150824) — das Re-Enable geschah
-- out-of-band. Dieses Statement dokumentiert den Ist-Zustand explizit
-- (No-Op, da RLS bereits aktiv). Es existieren keine Policies; Backend-Zugriffe
-- laufen über den Service-Role-Key (RLS-Bypass).
ALTER TABLE public.review_jobs ENABLE ROW LEVEL SECURITY;
