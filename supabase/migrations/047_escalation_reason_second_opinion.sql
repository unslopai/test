-- 047_escalation_reason_second_opinion — LLM_LANE_QUALITY_SPEC.md §4.2.
-- Der second-opinion-reviewer-Step setzt review_jobs.escalation_reason =
-- 'second_opinion' (EscalationReason in src/lib/pipeline/types.ts), der
-- CHECK-Constraint aus 022 kennt den Wert nicht: 044 hat nur den phase-Check
-- von review_job_llm_calls erweitert. Folge: jeder Job, in dem der
-- Second-Opinion-Trigger als erster eskaliert, verliert beim Persistieren sein
-- fertiges Ergebnis ("violates check constraint review_jobs_escalation_reason_check").
-- Erster und bisher einziger Live-Fall: Job 82a5781a (unslopai/unslop#9, 2026-09-26).
--
-- ANWENDUNG: Management-API weiterhin down (CLAUDE.md) — dieses SQL läuft
-- über den Dashboard-SQL-Editor durch den User. Verifikation danach: der
-- nächste Job mit Second-Opinion-Eskalation endet als done mit
-- escalation_reason = 'second_opinion' (scripts/db-query.ts review_jobs).

alter table public.review_jobs
    drop constraint review_jobs_escalation_reason_check;

alter table public.review_jobs
    add constraint review_jobs_escalation_reason_check check (escalation_reason in (
        'complexity_heuristic', 'uncertain_claims', 'critical_low_confidence', 'second_opinion'
    ));
