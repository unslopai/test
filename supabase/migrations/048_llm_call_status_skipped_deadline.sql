-- 048_llm_call_status_skipped_deadline — DEADLINE_GUARD_SPEC.md D12.
-- Erweitert den status-CHECK-Constraint von review_job_llm_calls um
-- 'skipped_deadline': ein LLM-Call, den der Deadline Guard mangels Job-Budget
-- gar nicht erst startet (Second Opinion < 80 s, Eskalation < 60 s,
-- Verify-Batch < 40 s Rest), bekommt eine eigene Telemetrie-Zeile — analog zu
-- 'skipped_budget' für das erschöpfte Pro-Kontingent.
--
-- ANWENDUNG: Management-API weiterhin down (CLAUDE.md) — dieses SQL läuft
-- über den Dashboard-SQL-Editor durch den User. Erst NACH dem Receipt darf
-- Code 'skipped_deadline' schreiben (Lehre aus Migration 047: ein Wert, den
-- der Constraint nicht kennt, kostet sonst Daten).
-- Receipt:
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'review_job_llm_calls_status_check';
-- muss 'skipped_deadline' enthalten.

alter table public.review_job_llm_calls
    drop constraint review_job_llm_calls_status_check;

alter table public.review_job_llm_calls
    add constraint review_job_llm_calls_status_check check (status in (
        'ok', 'parse_error', 'api_error', 'skipped_budget', 'skipped_deadline'
    ));
