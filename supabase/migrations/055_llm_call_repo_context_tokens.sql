-- 055: Tokens des Repo-Kontextpakets je LLM-Call in review_job_llm_calls.
--
-- Anlass: REPO_CONTEXT_SPEC §12 (Freigabe 2026-10-05, Auflage zur
-- Wirtschaftlichkeit): die Mehrkosten des Kontextpakets müssen je PR
-- nachrechenbar sein, nicht geschätzt. Das Paket steht im dynamischen Teil des
-- Prompts; seine Tokens sind deshalb Teil von `prompt_tokens`, aber nicht Teil
-- von `cached_tokens`. Die Spalte nennt den Anteil:
--   repo_context_tokens  geschätzte Tokens (Zeichen / 4) des Paket-Abschnitts
--                        im Draft-Prompt bzw. der Kontextausschnitte im
--                        Verifier-Prompt dieses Calls; null = Call ohne Paket
--
-- Mehrkosten des Pakets je Job = Summe über die Calls aus
-- repo_context_tokens × Input-Preis des Modells. Pfadliste und Größe des
-- ganzen Pakets stehen in review_jobs.result->'repo_context'.
--
-- Die Tabelle ist privat (038), die neue Spalte erbt den Entzug der
-- Client-Grants.
--
-- Reihenfolge: vor oder kurz nach dem Deploy. Ohne die Spalte schreibt
-- llm-call-log.ts die Zeile ohne sie (PGRST204-Fallback, Warnung im Log); bis
-- dahin fehlt die Zahl je Call, die Paketgröße je Job steht trotzdem im Ergebnis.

alter table public.review_job_llm_calls
    add column if not exists repo_context_tokens integer;

comment on column public.review_job_llm_calls.repo_context_tokens is
    'Geschätzte Tokens des Repo-Kontextpakets in diesem Call (Teil von prompt_tokens); null = Call ohne Paket.';
