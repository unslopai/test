-- Portal-Kündigungen sind standardmäßig "cancel at period end": die Subscription
-- bleibt bis Periodenende trialing/active und trägt nur ein Flag. Ohne Mirror
-- dieses Flags kann die Billing-UI eine geplante Kündigung nicht anzeigen.
alter table billing_customers
    add column if not exists cancel_at_period_end boolean not null default false;
