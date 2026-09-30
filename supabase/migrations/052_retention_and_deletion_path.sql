-- 052: Speicherfristen (V3) und Löschpfad (V4), LEGAL_PAGES_SPEC §4a.
--
-- NICHT VOR DEM EINTRAGUNGSTAG ANWENDEN. Der 90-Tage-Job löscht Aufträge, deren
-- IDs als Belege in docs/ROADMAP_ARCHIVE.md, Specs und im Benchmark-Log stehen.
-- Reihenfolge (LEGAL_PAGES_SPEC §4a.4): erst scripts/export-receipt-jobs.ts,
-- dann diese Migration per apply_migration.
--
-- Ausgangslage, live geprüft am 2026-09-30:
--   - cron.job kennt genau einen Job, 'cleanup-deactivated-repos' (aus 028):
--     ein einziges DELETE über alle abgelaufenen Repos.
--   - finding_suppressions hängt mit drei Fremdschlüsseln ohne Löschaktion an
--     repositories, auth.users und api_keys; der Append-only-Trigger verbietet
--     jedes DELETE. Ein Dismissal macht damit Repo und Konto unlöschbar und
--     lässt das Sammel-DELETE des Crons für ALLE Repos scheitern.
--   - review_jobs.repository_id ist ON DELETE SET NULL: nach einer Repo-Löschung
--     bleiben die Aufträge mit Code-Zitaten verwaist liegen.
--   - review_jobs und waitlist_signups haben keine Löschroutine.
--
-- In einer zurückgerollten Transaktion gegen die Live-DB geprüft (2026-09-30),
-- Ergebnis in der PR-Beschreibung.

-- Die ALTER TABLE unten brauchen kurz exklusive Sperren. Hängt die Migration
-- hinter einer offenen Transaktion, staut sich sonst jeder Worker-Write auf
-- review_jobs dahinter; lieber scheitert sie und wird wiederholt.
set lock_timeout = '5s';

-- =============================================================================
-- 1. Ledger folgt der Löschung seiner Eltern (V4)
-- =============================================================================

alter table public.finding_suppressions
    drop constraint finding_suppressions_repository_id_fkey,
    add constraint finding_suppressions_repository_id_fkey
        foreign key (repository_id) references public.repositories (id) on delete cascade,
    drop constraint finding_suppressions_user_id_fkey,
    add constraint finding_suppressions_user_id_fkey
        foreign key (user_id) references auth.users (id) on delete cascade,
    drop constraint finding_suppressions_api_key_id_fkey,
    add constraint finding_suppressions_api_key_id_fkey
        foreign key (api_key_id) references public.api_keys (id) on delete set null;

-- Append-only bleibt gegen direkte Eingriffe bestehen. Durchgelassen wird nur,
-- was der Fremdschlüssel-Trigger einer Elterntabelle auslöst: dort läuft dieser
-- Trigger verschachtelt (pg_trigger_depth() = 2), bei einem direkten Statement
-- mit Tiefe 1. Erlaubt sind dann das DELETE der Kaskade und das UPDATE, das
-- ausschließlich api_key_id auf NULL setzt (ON DELETE SET NULL).
create or replace function public.finding_suppressions_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if pg_trigger_depth() > 1 then
        if tg_op = 'DELETE' then
            return old;
        end if;
        if new.api_key_id is null
            and (to_jsonb(new) - 'api_key_id') = (to_jsonb(old) - 'api_key_id') then
            return new;
        end if;
    end if;
    raise exception 'finding_suppressions is append-only (MCP_SPEC D8): % is forbidden', tg_op;
end;
$$;

revoke execute on function public.finding_suppressions_append_only() from public, anon, authenticated;

-- Der Trigger ist ein Row-Trigger und sieht kein TRUNCATE.
revoke truncate on public.finding_suppressions from anon, authenticated, service_role;

-- =============================================================================
-- 2. Aufträge sterben mit ihrem Repository (V4)
-- =============================================================================

alter table public.review_jobs
    drop constraint review_jobs_repository_id_fkey,
    add constraint review_jobs_repository_id_fkey
        foreign key (repository_id) references public.repositories (id) on delete cascade;

-- =============================================================================
-- 3. Launch-Datum für die Waitlist-Frist (V3)
-- =============================================================================

create table public.retention_settings (
    singleton   boolean primary key default true check (singleton),
    launched_on date
);

comment on table public.retention_settings is
    'Genau eine Zeile. launched_on = Tag des öffentlichen Starts; NULL = noch nicht gestartet, der Waitlist-Job löscht nichts (LEGAL_PAGES_SPEC §4a.1).';

insert into public.retention_settings default values;

alter table public.retention_settings enable row level security;

revoke all on public.retention_settings from anon, authenticated;

-- =============================================================================
-- 4. Löschfunktionen
-- =============================================================================

-- Abgelaufene Repos einzeln löschen: scheitert eines, bleiben die übrigen nicht
-- stehen (Gegenprüfung P2-06). Das gescheiterte Repo wird mit ID und Fehlertext
-- protokolliert, in failed_count gezählt und im nächsten Lauf erneut versucht.
-- Das DELETE wiederholt die Bedingung: wird ein Repo zwischen Auswahl und
-- Löschung reaktiviert, bleibt es stehen.
create or replace function public.purge_expired_repositories()
returns table (purged_count integer, failed_count integer)
language plpgsql
set search_path = ''
as $$
declare
    expired_repository_id uuid;
begin
    purged_count := 0;
    failed_count := 0;

    for expired_repository_id in
        select repositories.id
        from public.repositories
        where repositories.status = 'deactivated'
            and repositories.updated_at < now() - interval '30 days'
    loop
        begin
            delete from public.repositories
            where repositories.id = expired_repository_id
                and repositories.status = 'deactivated'
                and repositories.updated_at < now() - interval '30 days';
            if found then
                purged_count := purged_count + 1;
            end if;
        exception when others then
            failed_count := failed_count + 1;
            raise warning 'purge_expired_repositories: repository % not deleted (%): %',
                expired_repository_id, sqlstate, sqlerrm;
        end;
    end loop;

    return next;
end;
$$;

-- Review-Daten 90 Tage; der hochgeladene Diff-Text aus CLI und MCP 30 Tage (E6).
-- review_job_llm_calls und finding_comments hängen per ON DELETE CASCADE an
-- review_jobs. Die übrigen Payload-Felder bleiben bis Tag 90, weil
-- /api/cli/findings/resolve den Commit-SHA daraus liest.
create or replace function public.purge_expired_review_data()
returns table (deleted_job_count integer, cleared_diff_count integer)
language plpgsql
set search_path = ''
as $$
begin
    delete from public.review_jobs
    where review_jobs.created_at < now() - interval '90 days';
    get diagnostics deleted_job_count = row_count;

    update public.review_jobs
    set payload = (review_jobs.payload - 'diff') || jsonb_build_object('diff_purged_at', now())
    where review_jobs.source in ('cli', 'mcp')
        and review_jobs.created_at < now() - interval '30 days'
        and review_jobs.payload ? 'diff';
    get diagnostics cleared_diff_count = row_count;

    return next;
end;
$$;

-- Waitlist: bis sechs Monate nach dem Launch (E6). Ohne Launch-Datum passiert
-- nichts. Danach wird die Tabelle bei jedem Lauf geleert.
create or replace function public.purge_waitlist_after_launch()
returns integer
language plpgsql
set search_path = ''
as $$
declare
    deleted_signup_count integer;
begin
    delete from public.waitlist_signups
    where exists (
        select 1
        from public.retention_settings
        where retention_settings.launched_on is not null
            and retention_settings.launched_on + interval '6 months' <= now()
    );
    get diagnostics deleted_signup_count = row_count;
    return deleted_signup_count;
end;
$$;

-- Nur der Cron (Rolle postgres) ruft die Funktionen. Ohne den Entzug wären sie
-- über PostgREST als RPC erreichbar.
revoke execute on function public.purge_expired_repositories() from public, anon, authenticated, service_role;
revoke execute on function public.purge_expired_review_data() from public, anon, authenticated, service_role;
revoke execute on function public.purge_waitlist_after_launch() from public, anon, authenticated, service_role;

-- =============================================================================
-- 5. Cron
-- =============================================================================

select cron.unschedule('cleanup-deactivated-repos');

select cron.schedule(
    'cleanup-deactivated-repos',
    '0 3 * * *',
    $$select purged_count, failed_count from public.purge_expired_repositories();$$
);

select cron.schedule(
    'purge-expired-review-data',
    '15 3 * * *',
    $$select deleted_job_count, cleared_diff_count from public.purge_expired_review_data();$$
);

select cron.schedule(
    'purge-waitlist-after-launch',
    '30 3 * * *',
    $$select public.purge_waitlist_after_launch();$$
);
