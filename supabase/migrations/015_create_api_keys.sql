-- API Keys für Machine-Auth (CLI, IDE-Extension, CI).
-- Der Klartext-Key (Format: usk_<43 base64url-Zeichen>) wird NIE gespeichert —
-- nur sein SHA-256-Hex-Hash. key_prefix dient der Wiedererkennung im Dashboard.
-- Rate-Limiting: Fixed-Window-Zähler direkt auf der Zeile (serverless-sicher,
-- atomar via consume_api_key_rate_limit).

create table api_keys (
    id                   uuid primary key default gen_random_uuid(),
    user_id              uuid not null references auth.users(id) on delete cascade,
    key_hash             text not null unique,
    key_prefix           text not null,
    label                text not null,
    last_used_at         timestamptz,
    window_started_at    timestamptz,
    window_request_count integer not null default 0,
    revoked_at           timestamptz,
    created_at           timestamptz not null default now()
);

create index idx_api_keys_user_id on api_keys(user_id);

-- Service-Role-Zugriff wie bei review_jobs: RLS an, keine Policies.
alter table api_keys enable row level security;

-- Atomarer Fixed-Window-Verbrauch: setzt das Fenster zurück wenn abgelaufen,
-- inkrementiert den Zähler und meldet ob der Request noch im Limit liegt.
-- Ein einzelnes UPDATE => zeilenweise gesperrt => race-frei unter Serverless-Parallelität.
create or replace function consume_api_key_rate_limit(
    target_key_id uuid,
    window_seconds integer,
    max_requests integer
)
returns boolean
language plpgsql
as $$
declare
    request_allowed boolean;
begin
    update api_keys
    set
        window_request_count = case
            when window_started_at is null or window_started_at < now() - make_interval(secs => window_seconds)
                then 1
            else window_request_count + 1
        end,
        window_started_at = case
            when window_started_at is null or window_started_at < now() - make_interval(secs => window_seconds)
                then now()
            else window_started_at
        end
    where id = target_key_id
    returning window_request_count <= max_requests into request_allowed;

    return coalesce(request_allowed, false);
end;
$$;
