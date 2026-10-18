-- Token-Telemetrie pro Review-Job (Baseline für Unit Economics / Prompt Caching).
-- Werte stammen aus dem Gemini usageMetadata der Reviewer-/Fixer-Calls.
alter table review_jobs
    add column if not exists prompt_tokens integer,
    add column if not exists cached_tokens integer,
    add column if not exists output_tokens integer,
    add column if not exists model text;

comment on column review_jobs.prompt_tokens is 'Gemini usageMetadata.promptTokenCount (Summe aller LLM-Calls des Jobs)';
comment on column review_jobs.cached_tokens is 'Gemini usageMetadata.cachedContentTokenCount (Summe; > 0 wenn Implicit Caching greift)';
comment on column review_jobs.output_tokens is 'Gemini usageMetadata.candidatesTokenCount (Summe)';
comment on column review_jobs.model is 'Modell-ID, mit der der Job reviewt wurde';
