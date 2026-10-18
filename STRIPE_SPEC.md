# STRIPE_SPEC: Accounts & Monetization (Roadmap Item 4)

**Status:** Approved for implementation (interview completed 2026-07-12)
**Depends on:** PR #4 (machine auth, `api_keys`, per-key rate limiting, CLI/IDE integration) — merged.
**Prerequisite reading:** none — this spec is self-contained.

---

## 1. Context (what exists today)

- **Accounts** are Supabase `auth.users` rows created via GitHub OAuth. Everything (repositories, `github_tokens`, `api_keys`, `review_jobs` via repos) keys on `user_id`. There is no team/org concept.
- **Token-burning paths** (all call Vertex AI Gemini): (1) GitHub webhook PR reviews (`POST /api/webhook` → `processReviewJob`), (2) CLI/IDE scans (`POST /api/cli/scan`), (3) repo connect ingestion (`POST /api/repos/connect` → embeddings). Per-job token telemetry is captured in `review_jobs` (`prompt_tokens`, `cached_tokens`, `output_tokens`, `model`) — this is the data that will price the tiers.
- **Rate limiting** today is **per API key**: fixed-window counters on `api_keys` + the `consume_api_key_rate_limit` RPC (migration 015), limit from `CLI_SCAN_RATE_LIMIT` (default 30/h). The GitHub webhook path is currently *not* rate-limited at all.
- The dashboard is minimal (repo list, per-repo pipeline settings, API-key management at `/dashboard/settings/keys`).
- **The operator has never used Stripe** — §4 is a from-zero setup walkthrough.

## 2. Decisions (from the interview)

| # | Decision | Rationale |
|---|----------|-----------|
| S1 | **Flat monthly subscription; Stripe never in the hot path.** Stripe charges cards, produces invoices, and emits webhooks; scans consult only local Postgres. | Zero Stripe latency/outage exposure in the pipeline; the Phase-2 limiter already exists. |
| S2 | **Paid-only with a 14-day trial, card required upfront. No free tier.** No active `trialing`/`active` subscription (or `complimentary` grant) ⇒ **0 scans**. | Bootstrapped: no subsidized Vertex tokens; card-upfront kills the fake-account abuse vector. |
| S3 | **Strict dunning:** `past_due` immediately means 0 scans. Recovery = user fixes their card in the Billing Portal → subscription returns to `active` → webhook restores entitlements. | No grace-period LLM spend on dead cards; there is no free tier to fall back to. |
| S4 | **Checkout + Billing Portal (both Stripe-hosted).** The app has exactly two redirect endpoints and zero payment UI. `client_reference_id = user_id` binds the session to our user. | No PCI burden, SCA/Apple/Google Pay for free. |
| S5 | **Webhook → Supabase mirror** (`billing_customers`); signature-verified like the GitHub webhook; all entitlement checks read the local row. Stripe is the source of truth, Supabase the fast cache. | Hot path stays local; eventual consistency within seconds. |
| S6 | **Per-user billing.** One Stripe Customer ↔ one `auth.users` row; the plan governs all the user's repos and keys. | Matches the existing schema; orgs/teams are a later phase. |
| S7 | **Quota unit = per `user_id`, summed across all API keys** (never per key — 10 keys must not mean 10× quota). Prices and limits live in a code-level `PLAN_CONFIG` keyed by Stripe price ID; **all numbers are placeholders** until unit economics are computed from telemetry. | Closes the multiplication hole; tuning limits = one commit. |
| S8 | **Stripe Tax + EUR from day one.** `automatic_tax: {enabled}`, `tax_id_collection: {enabled}` (intra-EU B2B reverse charge), billing address required. Stripe auto-generates invoices (German company — GoBD-compliant PDFs required). | Retrofitting VAT is painful; the ~0.5% Stripe Tax fee is cheap compliance. |
| S9 | **Lazy customer creation** — Stripe objects exist only after the user clicks "Start 14-Day Trial". Login/signup never touches Stripe. No `billing_customers` row ⇒ not entitled. | Stripe outage cannot break login; zero sync surface for non-payers. |
| S10 | **Webhook PR reviews are gated identically.** PR from an unentitled owner ⇒ no LLM call; post **one deduplicated** PR comment ("Gatekeeper paused — no active subscription", billing link). | The webhook path is the biggest token burner and the easiest to abuse via inbound PRs. |
| S11 | **Hard cutover + `complimentary` status.** No grandfathering (no real users yet). A manually inserted `billing_customers` row with `status = 'complimentary'` grants entitlements without any Stripe objects — for dogfooding, demos, and design partners. | Explicit, auditable comp mechanism instead of env-flag backdoors. |

## 3. Architecture overview

```
Dashboard "Start 14-Day Trial" ─→ POST /api/billing/checkout ─→ Stripe Checkout (hosted)
                                                                     │ pays / starts trial
Dashboard "Manage Billing"     ─→ POST /api/billing/portal   ─→ Stripe Billing Portal
                                                                     │
Stripe ──(signed events)──→ POST /api/stripe/webhook ──upsert──→ billing_customers (Supabase)
                                                                     ▲
   /api/cli/scan ── entitlement + quota check ───────────────────────┤ (local reads only)
   /api/webhook (GitHub PRs) ── entitlement check ───────────────────┤
   /api/repos/connect ── entitlement + maxRepos ─────────────────────┤
   /api/keys ── maxApiKeys ──────────────────────────────────────────┘
```

**v1 catalog: one paid plan ("Pro", €29/mo placeholder).** `PLAN_CONFIG` is structured for multiple plans; adding "Team" later = one Stripe Price + one config entry.

## 4. Stripe Dashboard setup (from zero — do this once, in order)

Everything below happens at https://dashboard.stripe.com. Stripe has two parallel worlds: **Test mode** (fake money, `sk_test_…` keys, test cards) and **Live mode** (real money, `sk_live_…`). Build and verify everything in Test mode first; §11 has the go-live flip.

1. **Create the account** at stripe.com → business location **Germany**, business type as applicable. You can use Test mode immediately; Live mode requires completing business verification (bank account, ID) — start it in parallel, it takes days.
2. **Business settings** (Settings → Business): legal name, address, and **support email** — these appear on invoices and must be correct for German invoicing.
3. **Enable Stripe Tax** (Settings → Tax): confirm your German VAT registration (USt-IdNr.), set default tax behavior for prices to **exclusive** (net price + VAT on top — normal for B2B).
4. **Invoice settings** (Settings → Billing → Invoices): sequential invoice numbering is on by default — leave it (GoBD). Add your VAT ID to the invoice footer/memo.
5. **Create the product** (Product catalog → Add product):
   - Name: `Anti-AI-Slop Gatekeeper Pro`
   - Price: **Recurring**, **€29.00/month** (placeholder), tax behavior **exclusive**.
   - After saving, copy the **Price ID** (`price_…`) → this becomes `STRIPE_PRICE_PRO_MONTHLY`.
   - Do **not** configure the trial on the price — the trial is set per Checkout session (§7.1), so we control who gets one.
6. **API keys** (Developers → API keys): copy the **Secret key** (`sk_test_…`) → `STRIPE_SECRET_KEY`. The publishable key is not needed (no client-side Stripe.js in this design).
7. **Webhook endpoint** (Developers → Webhooks → Add endpoint):
   - URL: `https://<production-domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.
   - For **local dev** you don't use this endpoint: install the Stripe CLI and run `stripe listen --forward-to localhost:3000/api/stripe/webhook` — it prints its own `whsec_…` for your `.env.local`.
8. **Billing Portal configuration** (Settings → Billing → Customer portal): enable **update payment method**, **cancel subscription**, **invoice history**. Disable plan switching for now (single plan). Save.
9. **Test cards**: `4242 4242 4242 4242` (any future date/CVC) = success; `4000 0000 0000 0341` = attaches but fails payment (for dunning tests). `stripe trigger customer.subscription.updated` can simulate events.

## 5. Data model

### 5.1 Migration `019_create_billing_customers.sql`

```sql
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
    -- Per-USER Fixed-Window-Quotas (ersetzt die per-Key-Zähler aus 015):
    window_started_at       timestamptz,          -- Stunden-Fenster (Burst)
    window_request_count    integer not null default 0,
    month_started_at        timestamptz,          -- Monats-Fenster (Kosten-Schranke)
    month_request_count     integer not null default 0,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);
alter table billing_customers enable row level security;  -- service-role only

-- Atomarer per-User-Quota-Verbrauch: prüft Stunden- UND Monats-Fenster in einem
-- UPDATE (zeilenweise gesperrt, race-frei). Ein Request zählt in beiden Fenstern.
create or replace function consume_user_scan_quota(
    target_user_id uuid, hourly_max integer, monthly_max integer
) returns boolean language plpgsql as $$
declare request_allowed boolean;
begin
    update billing_customers set
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
    return coalesce(request_allowed, false);  -- keine Zeile = nicht entitled = false
end; $$;

-- Per-Key-Limiter ist ersatzlos ersetzt:
drop function if exists consume_api_key_rate_limit(uuid, integer, integer);
alter table api_keys drop column window_started_at, drop column window_request_count;
```

Apply locally **and** remotely (same MCP `apply_migration` flow as 015–018). `CLI_SCAN_RATE_LIMIT` env is removed — limits come from `PLAN_CONFIG`.

### 5.2 Comp grants (S11)

```sql
insert into billing_customers (user_id, status, price_id)
values ('<user-uuid>', 'complimentary', 'comp');
```

## 6. Entitlements (`src/lib/billing/plan-config.ts` + `entitlements.ts`)

```ts
// Zahlen aus der Unit-Economics-Analyse vom 2026-07-12 (siehe §13).
// WICHTIG: scansPerMonth ist die ökonomische Schranke; scansPerHour glättet nur Bursts.
export interface PlanEntitlements {
    readonly displayName: string;
    readonly scansPerHour: number;    // per USER, über alle Keys summiert (S7) — Burst-Glättung
    readonly scansPerMonth: number;   // per USER — die eigentliche Kosten-Schranke
    readonly maxActiveRepos: number;
    readonly maxApiKeys: number;
}

export const PLAN_CONFIG: Readonly<Record<string, PlanEntitlements>> = {
    [process.env.STRIPE_PRICE_PRO_MONTHLY ?? 'price_pro']: {
        displayName: 'Pro', scansPerHour: 60, scansPerMonth: 2000, maxActiveRepos: 10, maxApiKeys: 10,
    },
    comp: { displayName: 'Complimentary', scansPerHour: 60, scansPerMonth: 2000, maxActiveRepos: 10, maxApiKeys: 10 },
};

const ENTITLED_STATUSES = new Set(['trialing', 'active', 'complimentary']);
```

`resolveEntitlement(userId)` → select explicit columns from `billing_customers` by `user_id`; no row **or** status ∉ `ENTITLED_STATUSES` **or** `price_id` unknown to `PLAN_CONFIG` ⇒ `{ entitled: false }` (0 scans, S2/S3). Otherwise `{ entitled: true, plan }`. `consumeScanQuota(userId, plan)` calls the RPC with `plan.scansPerHour`. Fail-closed on any DB error (same discipline as the Phase-2 limiter).

## 7. API routes

### 7.1 `POST /api/billing/checkout` (cookie-session auth)

Creates the Checkout session and returns `{ url }` for redirect:
- `mode: 'subscription'`, `line_items: [{ price: STRIPE_PRICE_PRO_MONTHLY, quantity: 1 }]`
- `client_reference_id: user.id` (S4 — the user↔customer binding), `customer_email: user.email` (first checkout) **or** `customer: stripe_customer_id` (returning customer from an existing row)
- `subscription_data: { trial_period_days: 14, metadata: { user_id: user.id } }` — the **metadata makes every subscription webhook event self-describing** (no API fetch, no event-ordering races); trial only **if the user has never had a subscription** (`billing_customers` row absent or `stripe_subscription_id is null`); returning customers get no second trial
- `payment_method_collection: 'always'` (card required upfront, S2)
- `automatic_tax: { enabled: true }`, `tax_id_collection: { enabled: true }`, `billing_address_collection: 'required'` (S8)
- `success_url: {APP_BASE_URL}/dashboard/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`, `cancel_url: …?checkout=cancelled`

### 7.2 `POST /api/billing/portal` (cookie-session auth)

Requires an existing `stripe_customer_id` (404 otherwise). `stripe.billingPortal.sessions.create({ customer, return_url })` → `{ url }`.

### 7.3 `GET /api/billing/status` (cookie-session auth)

Returns `{ status, planName, trialEndsAt, currentPeriodEnd }` for the billing page — read from the local mirror, never Stripe.

### 7.4 `POST /api/stripe/webhook`

- **Raw body**: `await request.text()` before any JSON parsing; verify with `stripe.webhooks.constructEvent(rawBody, request.headers.get('stripe-signature'), STRIPE_WEBHOOK_SECRET)`; invalid ⇒ 400. Never trust unverified payloads.
- **Events** (implemented — zero Stripe API calls in the handler, order-independent, replay-idempotent):
  - `customer.subscription.created|updated|deleted`: each event carries `metadata.user_id` (set via `subscription_data.metadata` at checkout, §7.1) ⇒ **upsert by `user_id`** with `stripe_customer_id`, `stripe_subscription_id`, `price_id` (first item), `status` (`deleted` ⇒ `canceled`), `trial_ends_at`, `current_period_end` (from the subscription item, per the current API shape). `past_due` ⇒ instant 0 scans (S3) purely via the status mapping. Events without `metadata.user_id` are logged and acked (200) — retrying would never succeed.
  - `checkout.session.completed`: log-only (the binding is fully covered by the subscription events).
- Unknown event types: ack 200 and ignore. Log every transition (`[StripeWebhook] user=… status=…`).

## 8. Enforcement integration (every token-burning path)

| Path | Check | Failure response |
|------|-------|------------------|
| `POST /api/cli/scan` | `resolveEntitlement` → `consumeScanQuota` (replaces the per-key limiter; key auth unchanged) | `402 { error: 'subscription_inactive' }` / `429` + Retry-After |
| `POST /api/webhook` (GitHub PR) | after signature verify: `resolveEntitlement(repo.user_id)` **and** `consumeScanQuota` before inserting the job — webhook reviews count against the same per-user quota, otherwise the monthly cost bound would be bypassable via the PR path | Skip job + LLM entirely; post **one** deduplicated PR comment per reason (billing-paused or quota-exceeded, S10) |
| `POST /api/repos/connect` | entitled + `count(active repos) < plan.maxActiveRepos` | `402` / `409 { error: 'repo_limit_reached' }` |
| `POST /api/keys` | entitled + `plan.maxApiKeys` (replaces the hardcoded 10) | `402` / `409` |

**PR-comment dedupe (S10):** comment body embeds the marker `<!-- unslop-billing-paused -->`; before posting, list the PR's issue comments and skip if the marker exists. Comment text: `⚠️ **Anti-Slop Gatekeeper is paused** — the repository owner has no active subscription. Resume reviews at {APP_BASE_URL}/dashboard/settings/billing.`

**CLI:** map HTTP 402 to exit 2 with `Subscription inactive — start or fix your subscription at <url>.` (extension inherits it via the CLI).

## 9. Dashboard UI (English, minimal)

`/dashboard/settings/billing` (auth-gated server page + client component, same pattern as keys):
- Current state from `GET /api/billing/status`: plan name, `Trial — X days left` / `Active` / `Payment failed — scans paused` / `No subscription`.
- Primary button: **Start 14-Day Trial** (→ checkout redirect) when not entitled and never subscribed; **Manage Billing** (→ portal redirect) when a Stripe customer exists (card fix, cancel, invoices all live there).
- Dashboard banner when not entitled: "Scans are paused — start your trial" linking to the billing page.

## 10. Environment variables

| Variable | Where | Notes |
|----------|-------|-------|
| `STRIPE_SECRET_KEY` | Vercel + `.env.local` | `sk_test_…` until go-live |
| `STRIPE_WEBHOOK_SECRET` | Vercel + `.env.local` | Dashboard endpoint secret in prod; `stripe listen` secret locally |
| `STRIPE_PRICE_PRO_MONTHLY` | Vercel + `.env.local` | from §4 step 5 |
| `APP_BASE_URL` | Vercel + `.env.local` | absolute URL for redirect/success/cancel + PR-comment link |

npm deps: `stripe` (server SDK only; pin `apiVersion` in the client factory `src/lib/billing/stripe.ts`).

## 11. Verification & rollout

**Test-mode E2E (local, `stripe listen` forwarding):**
1. Fresh user, no row → `unslop scan` ⇒ 402, exit 2 with billing hint; GitHub PR ⇒ exactly one paused-comment, second push adds none, **zero Gemini calls** (check `review_jobs` and logs).
2. Start trial with `4242…` → webhook upserts `trialing` → CLI scan succeeds → `review_jobs` telemetry row written; quota: requests over `scansPerHour` in one window ⇒ 429.
3. Two keys, same user → combined usage hits the one shared quota (S7 proven).
4. Simulate failure: attach `4000 0000 0000 0341`, advance the sub (or `stripe trigger customer.subscription.updated` with `past_due`) → status flips → scan ⇒ 402 immediately (S3). Fix card in Portal → `active` → scans resume.
5. Cancel via Portal → `deleted` event → `canceled` → 402.
6. `complimentary` row inserted via SQL → entitled without any Stripe object.
7. Webhook signature: request with bad signature ⇒ 400, no DB write. Replay a real event twice ⇒ identical row (idempotent).
8. Repo-connect and key-creation caps enforce `PLAN_CONFIG` numbers.

**Go-live checklist:** business verification approved → create the live-mode Product/Price (new `price_…`) → live webhook endpoint (new `whsec_…`) → swap the three env vars in Vercel → one real-card smoke test → confirm the invoice PDF carries VAT ID + sequential number (GoBD).

## 12. Out of scope (deliberately)

Teams/orgs & seats (S6), metered overage billing (S1), plan switching UI (single plan), annual pricing, dunning emails beyond Stripe's built-ins, refunds/proration policy, and affiliate/coupons (Checkout supports `allow_promotion_codes` later).

## 13. Unit economics (analysis of 2026-07-12, basis for §6)

Source: 13 measured `gemini-2.5-flash` scans (3 production CLI jobs from `review_jobs` telemetry + 10 replay-rig runs). Vertex pricing: $0.30/M input, $2.50/M output, $0.075/M cached input.

- Measured per scan: ~1,800 prompt / ~300 output / 0 cached ⇒ **≈ $0.0012**. Fixtures are small (15–25 line diffs); modeled typical PR (~300 lines) ⇒ **≈ $0.0035**; large PR near the 40KB cap ⇒ **≈ $0.0074**. Output tokens are ~half the cost; findings-heavy scans cost 2–4× clean scans. Implicit caching (once the Law crosses the ~2K-token prefix threshold) shaves ~15–30%.
- Revenue: €29/mo − Stripe fees (card ~1.5% + €0.25, Tax 0.5%, Billing ~0.7%) ⇒ **≈ €28 ≈ $30 net**. Break-even ≈ 8,600 typical scans/month.
- **Key finding:** an hourly cap alone is not an economic control — 300/h permits 216K scans/month (up to ~$800 cost vs €29 revenue). Hence `scansPerMonth` (2,000) as the cost bound and `scansPerHour` (60) purely for burst smoothing. Worst-case monthly LLM cost at cap: $2.40 (small) / $7.00 (typical) / $14.80 (all-large) ⇒ **gross margin 92% / 77% / 51%**; realistic usage (300–900 scans/mo) ⇒ 90%+. Trial exposure: ≤ ~$15 per card-verified trial.
- **Re-run this analysis before**: any model swap to a pro-class model (~5–10× cost), raising the 40KB/file diff cap, or adding a heavier RAG payload. Marginal costs only — fixed infra (Vercel/Supabase) excluded.
