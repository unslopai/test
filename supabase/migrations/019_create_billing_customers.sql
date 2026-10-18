-- Billing-Mirror für Stripe (STRIPE_SPEC.md §5).
-- Stripe ist Source of Truth; diese Tabelle ist der lokale, schnelle Cache,
-- den alle Entitlement-Checks lesen (Hot Path berührt nie die Stripe-API).
-- status 'complimentary' = manueller Grant ohne Stripe-Objekte (Dogfooding/Demos).

create table billing_customers (
    user_id                 uuid primary key references auth.users(id) on delete cascade,
    stripe_customer_id      text unique,           -- null nur bei status 'complimentary'
    stripe_subscription_id  text,
    price_id                text,                  -- Stripe price id ODER 'comp'
    status                  text not null check (status in (
        'trialing', 'active', 'past_due', 'canceled', 'unpaid',
        'incomplete', 'incomplete_expired', 'paused', 'complimentary'
    )),
    trial_ends_at           timestamptz,
    current_period_end      timestamptz,
    -- Per-USER Fixed-Window-Quotas (ersetzen die per-Key-Zähler aus 015):
    window_started_at       timestamptz,           -- Stunden-Fenster (Burst-Glättung)
    window_request_count    integer not null default 0,
    month_started_at        timestamptz,           -- Monats-Fenster (Kosten-Schranke)
    month_request_count     integer not null default 0,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

-- Service-Role-Zugriff wie bei api_keys/review_jobs: RLS an, keine Policies.
alter table billing_customers enable row level security;

-- Atomarer per-User-Quota-Verbrauch: prüft Stunden- UND Monats-Fenster in einem
-- UPDATE (zeilenweise gesperrt => race-frei unter Serverless-Parallelität).
-- Ein Request zählt in beiden Fenstern. Keine Zeile = nicht entitled = false.
create or replace function consume_user_scan_quota(
    target_user_id uuid,
    hourly_max integer,
    monthly_max integer
)
returns boolean
language plpgsql
as $$
declare
    request_allowed boolean;
begin
    update billing_customers
    set
        window_request_count = case
            when window_started_at is null or window_started_at < now() - interval '1 hour'
                then 1 else window_request_count + 1 end,
        window_started_at = case
            when window_started_at is null or window_started_at < now() - interval '1 hour'
                then now() else window_started_at end,
        month_request_count = case
            when month_started_at is null or month_started_at < date_trunc('month', now())
                then 1 else month_request_count + 1 end,
        month_started_at = case
            when month_started_at is null or month_started_at < date_trunc('month', now())
                then date_trunc('month', now()) else month_started_at end,
        updated_at = now()
    where user_id = target_user_id
    returning (window_request_count <= hourly_max and month_request_count <= monthly_max)
        into request_allowed;

    return coalesce(request_allowed, false);
end;
$$;

-- Der per-Key-Limiter aus 015 ist ersatzlos ersetzt (Quota ist jetzt per User):
drop function if exists consume_api_key_rate_limit(uuid, integer, integer);
alter table api_keys
    drop column if exists window_started_at,
    drop column if exists window_request_count;
