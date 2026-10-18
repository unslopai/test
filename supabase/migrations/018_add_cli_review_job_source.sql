-- Erlaubt 'cli' als review_jobs.source (Scans aus CLI/IDE, SPEC.md Phase 2).
-- Der Check stammt aus 004 (inline, auto-benannt review_jobs_source_check).
alter table review_jobs drop constraint review_jobs_source_check;
alter table review_jobs add constraint review_jobs_source_check
    check (source in ('manual', 'webhook', 'cli'));
