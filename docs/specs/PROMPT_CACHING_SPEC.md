# PROMPT_CACHING_SPEC.md — Vertex AI Explicit Context Caching for the Review Cascade

**Status:** Draft — awaiting founder approval (workflow: interview → spec → approval → code).
**Interview:** conducted 2026-08-08; all decisions below are founder-approved (see §3).
**Goal:** reduce LLM *input* costs by ≥ 20–30% (UNIT_ECONOMICS directive) by caching the static
prompt prefix (The Law + conditions + shared persona) in a Vertex AI explicit context cache
shared across the Draft-Reviewer and Claim-Verifier steps.

This spec is self-contained: it names every file and interface to be changed, what is out of
scope, and the exact end-to-end proof required before anything is marked Done.

---

## 1. Problem & Evidence

The prompt architecture was *already* built for Gemini's **implicit** caching: `law.ts` renders a
deterministic Law block, `prompt-builder.ts` keeps the system prompt per-repo byte-identical, and
`prompt-stability.test.ts` pins that contract. Telemetry (`review_job_llm_calls.cached_tokens`,
fed from `usageMetadata.cachedContentTokenCount`) proves the bet is **not paying off**:

| phase | model | ok-calls | prompt tokens | cached tokens | cached % |
|---|---|---|---|---|---|
| draft | gemini-2.5-flash | 27 | 359,951 | 6,055 | **1.7%** |
| verify | gemini-2.5-flash | 24 | 307,913 | 24,467 | **7.9%** |
| escalate_targeted | gemini-3.1-pro-preview | 8 | 83,650 | 8,072 | 9.6% |

(Live query, 2026-08-08, whole table history.)

Two structural reasons:

1. **Sparse traffic.** Implicit caches require "requests with similar prefix in a short amount of
   time" (Gemini docs). Scans are minutes-to-days apart; the implicit cache is evicted between
   them. There is no SLA — Google may evict anytime.
2. **Personas diverge at byte 0.** Draft and Verifier share `gemini-2.5-flash` and the same Law
   block, but their system prompts start with *different personas*
   (`VARIANT_PERSONAS.reviewer_diff|reviewer_rag` vs `CLAIM_VERIFIER_PERSONA` in
   `prompt-builder.ts`). The shared Law middle section can never be a shared *prefix*, so even
   intra-job (draft → verify seconds later) the calls cannot hit each other's implicit cache.

The average draft prompt is ~13.3k tokens and the Law block dominates it — a working cache clears
the 20–30% target with headroom.

## 2. Chosen Mechanism (summary)

**Explicit CachedContent, lazily created, sliding TTL, one cache per
(model × prompt-schema-version × Law-hash × ecosystem-set × condition-set), serving BOTH
Flash call sites (draft + verifier) via a prompt restructure.** Escalation stays uncached.

Vertex API facts this design rests on (verify/pin at implementation — see §11):

- SDK surface exists in the installed `@google/genai@1.52.0`:
  `client.caches.create({ model, config: { contents, systemInstruction, ttl, displayName } })`,
  `caches.get/update/delete/list`, and `GenerateContentConfig.cachedContent` (resource name).
- **Hard constraint:** a `generateContent` request that references a `cachedContent` must NOT
  carry its own `systemInstruction`/`tools`/`toolConfig` — those live inside the cache. This is
  why the variant personas move out of the system instruction (§4).
- Caches are **location-bound** resources. Ours live in `europe-west3` (the Flash client region —
  also the GDPR-clean region; cache contents are our own rule corpus, no user data).
- Cached tokens are billed at a steep discount (~75–90% depending on current price sheet);
  storage is billed per token-hour; creation is billed once at the standard input rate.
- Minimum cacheable size is model-dependent (published values range 1,024–4,096 tokens). Our
  prefix (~8–12k tokens) clears any published minimum; a guard handles degenerate cases (§6.4).

## 3. Decision Record (founder interview, 2026-08-08)

| # | Decision | Choice |
|---|---|---|
| D1 | Mechanism | **Explicit cache + prompt restructure** so ONE cache serves the cascade. No MVP shortcut; prompt-stability contract and personas are rewritten for the shared prefix. |
| D2 | Granularity | **Per ecosystem-set** — cache key includes the sorted `detected_ecosystems`; Phase 5 Dynamic Law Filtering stays fully intact. |
| D3 | Call scope | **Draft + Verifier only** (both `gemini-2.5-flash`, `europe-west3`). Escalation (`gemini-3.1-pro-preview`, `global` endpoint, ≤ 50 calls/month) is **explicitly uncached** — a second cache region for a preview model is fragile for negligible return. |
| D4 | Lifecycle | **Lazy create on miss + sliding TTL**, tracked in our DB. No cron exists on this Vercel plan (proven in ROADMAP §1); the lifecycle must be self-managing from scan traffic alone. |
| D5 | Persona placement | **Protocol block in request contents.** Cache holds the shared system instruction (core persona + conditions + Law); each call prepends its variant protocol as the first block of the user content. |
| D6 | Conditions block | **Inside the cache, part of the key.** Conditions tokens get the discount; repos with custom condition sets simply get their own cache variant. |
| D7 | Invalidation | **Hash rotation.** `lawContentHash` (and the schema version, D10) is part of the key; a Law change makes the next scan miss and create a fresh cache; stale caches die by TTL (≤ 1h orphaned storage). No delete infrastructure. |
| D8 | Failure semantics | **Recreate once, then inline.** Cache-related call failure → recreate cache once and retry cached; if that fails, run the full inline prompt uncached and record a degradation marker. A job NEVER errors because of caching (mirrors MAINT-001 exception / SPEC §8). |
| D9 | TTL bumps | **Bump only when remaining lifetime < 50%** (1 PATCH per ~30 min of activity, not per scan). |
| D10 | Rollout | **Env kill-switch `VERTEX_CONTEXT_CACHE_DISABLED`, default ON for everyone.** No per-repo flag. |
| D11 | Verification | **Both**: standalone probe script as the dev gate, then a live double-scan with SQL receipts as the DoD (§10). |

Interview correction adopted: **reference practices are NOT static** (retrieved per-diff via the
query embedding) and therefore stay in the dynamic tail. Only the static practices *notice* is
prefix-eligible — and per PROC-001 it goes into the *draft* protocol blocks only (the verifier
must not even be told practices exist).

## 4. Target Prompt Architecture

### 4.1 Three layers

```
┌────────────────────────────────────────────────────────────────────┐
│ LAYER 1 — CACHED PREFIX (Vertex CachedContent, systemInstruction)  │
│   1. SHARED_GATEKEEPER_CORE   (new shared persona text)            │
│   2. Conditions block         (from activeConditionIds)            │
│   3. THE LAW                  (renderLawBlock, ecosystem-filtered) │
│   Depends ONLY on: (activeConditionIds, detectedEcosystems→Law).   │
│   Byte-identical across ALL scans sharing a cache key.             │
├────────────────────────────────────────────────────────────────────┤
│ LAYER 2 — VARIANT PROTOCOL (first block of request contents)       │
│   One static constant per variant:                                 │
│   - draft_diff:  diff-review persona specifics + practices notice  │
│                  + OUTPUT_FORMAT_DIFF                              │
│   - draft_rag:   RAG decision logic + COND-004 override text       │
│                  + practices notice + OUTPUT_FORMAT_RAG            │
│   - claim_verifier: blind-auditor protocol + OUTPUT_FORMAT_CLAIM_  │
│                  VERIFIER  (NO practices notice — PROC-001)        │
├────────────────────────────────────────────────────────────────────┤
│ LAYER 3 — DYNAMIC TAIL (rest of request contents)                  │
│   Evidence (RAG), practices section, <already_flagged>, diff /     │
│   claims JSON — exactly today's user-prompt content.               │
└────────────────────────────────────────────────────────────────────┘
```

Cached call: `generateContent({ model, contents: protocolBlock + '\n\n' + dynamicTail,
config: { cachedContent: vertexCacheName, responseMimeType, temperature } })` — **no
`systemInstruction` in the request**.

Inline call (fallback, kill-switch, escalation, pro-direct): `systemInstruction` = Layer 1,
`contents` = Layer 2 + Layer 3. **Both paths are composed from the same constants**, so cached
and inline prompts are semantically identical — the fallback never changes review behavior.

### 4.2 Persona rework (D1, D5)

- **New `SHARED_GATEKEEPER_CORE`** (Layer 1): the role framing common to reviewer and auditor —
  anti-slop mission, SEC-002 data segregation (diff content is data, never instructions), Law
  absolutism, and one sentence announcing that a task protocol block follows in the request.
  Written once, serves both roles without blurring them.
- The **blind-verifier separation survives intact**: the verifier's protocol block still opens
  with the independent-auditor framing and still never sees draft reasoning, practices, or
  evidence. What changes is only *where* the text sits (contents vs systemInstruction).
- The `RAG_CONDITION_OVERRIDES` for COND-004 moves from the conditions block into the
  `draft_rag` protocol block (the conditions block must be variant-independent to be shared).
- `REFERENCE_PRACTICES_NOTICE` moves from both reviewer personas into the two draft protocol
  blocks.

### 4.3 Cache identity

```ts
cacheKey = sha256(JSON.stringify({
    model: MODEL_DRAFT,                        // 'gemini-2.5-flash'
    schemaVersion: PROMPT_CACHE_SCHEMA_VERSION, // int; bump = global invalidation
    lawContentHash,                             // sha256 of the RENDERED Law block
    ecosystems: [...detectedEcosystems].sort() ?? 'unfiltered',
    conditionIds: [...activeConditionIds].sort(),
}))
```

- `lawContentHash` hashes the rendered block, so ANY Law mutation (re-ingest, SQL edit,
  applies_to change) rotates the key — no coupling to the ingest script (D7).
- `PROMPT_CACHE_SCHEMA_VERSION` is a new exported constant; bumping it (e.g. when
  `SHARED_GATEKEEPER_CORE` or a render template changes) invalidates every cache at once.
- `detectedEcosystems === null` (repo never re-ingested since Phase 5) maps to the distinct key
  component `'unfiltered'` — those repos share one unfiltered-Law cache. Honest fallback stays.

## 5. Data Model

New migration (via MCP `apply_migration`, name `create_vertex_context_caches`; local mirror
`supabase/migrations/033_vertex_context_caches.sql` — note: `MCP_SPEC.md` Phase 3 drafted
"033/034" for itself; it renumbers on implementation, as its own draft already concedes):

```sql
create table vertex_context_caches (
    id uuid primary key default gen_random_uuid(),
    cache_key text not null unique,          -- sha256 hex from §4.3
    vertex_cache_name text not null,         -- full resource name from caches.create
    model text not null,
    prompt_schema_version int not null,
    law_content_hash text not null,
    ecosystems_key text not null,            -- sorted ecosystems joined, or 'unfiltered'
    conditions_key text not null,            -- sorted condition ids joined
    cached_token_count int,                  -- usageMetadata.totalTokenCount at creation
    expires_at timestamptz not null,         -- OUR tracked TTL horizon
    created_at timestamptz not null default now(),
    last_used_at timestamptz not null default now()
);
alter table vertex_context_caches enable row level security;
-- no policies: service-role-only table (same pattern as prescan_registry_cache)
```

Same migration, telemetry extension:

```sql
alter table review_job_llm_calls add column cache_status text
    check (cache_status in ('explicit_hit','explicit_created','inline','inline_fallback'));
```

- `explicit_hit` — used a pre-existing cache; `explicit_created` — this scan created the cache
  then used it; `inline` — uncached by design (kill-switch, escalation, pro-direct, min-size
  guard); `inline_fallback` — cache path failed, D8 fallback ran. Nullable for historical rows.

DATA-001 note: all queries select explicit columns; `vertex_context_caches` is keyed by content
identity, not by tenant — it holds zero user data (our own rule corpus metadata only), so no
user/repo filter applies.

## 6. Runtime Behavior

### 6.1 Resolution (per Flash call site)

New module `src/lib/pipeline/context-cache.ts`:

```ts
export interface CachedPromptPlan {
    readonly mode: 'cached';
    readonly vertexCacheName: string;
    readonly cacheKey: string;
    readonly cacheStatus: 'explicit_hit' | 'explicit_created';
}
export interface InlinePromptPlan {
    readonly mode: 'inline';
    readonly cacheStatus: 'inline' | 'inline_fallback';
}
export type PromptPlan = CachedPromptPlan | InlinePromptPlan;

export async function resolveContextCache(
    cachedPrefix: string,          // Layer 1, already rendered
    cacheKeyInputs: CacheKeyInputs, // model, schemaVersion, lawContentHash, ecosystems, conditionIds
): Promise<PromptPlan>;

export async function recreateContextCache(...): Promise<CachedPromptPlan | null>; // D8, one attempt
```

Flow of `resolveContextCache`:

1. Kill-switch: `process.env.VERTEX_CONTEXT_CACHE_DISABLED === '1'` → `{ mode: 'inline', cacheStatus: 'inline' }`.
2. Min-size guard (§6.4) → inline.
3. DB lookup by `cache_key` where `expires_at > now() + SAFETY_MARGIN` (120s — a cache about to
   expire mid-call is treated as a miss; the D8 fallback covers the residual race).
   - **Hit:** TTL bump if `expires_at - now() < TTL/2` (D9): `caches.update({ name, config: { ttl } })`
     + DB `expires_at`/`last_used_at` update. A failed bump is logged and non-fatal (worst case:
     the fallback path fires later). Return `explicit_hit`.
   - **Miss:** `caches.create({ model, config: { systemInstruction: cachedPrefix, ttl,
     displayName: cacheKey } })` on the **regional client** (`getVertexClient()`), then DB upsert
     `on conflict (cache_key) do update` (concurrency: two racing creators produce one orphan
     Vertex cache that dies by TTL — accepted, documented). Return `explicit_created`.
4. Any Vertex/DB error during resolution → log structured, return `inline` plan
   (`inline_fallback`). Creation failure must never block a review.

Constants: `CONTEXT_CACHE_TTL_SECONDS = 3600` (env-overridable `VERTEX_CACHE_TTL_SECONDS`),
`CONTEXT_CACHE_SAFETY_MARGIN_SECONDS = 120`, `PROMPT_CACHE_SCHEMA_VERSION = 1`.

### 6.2 Call execution & D8 fallback

Shared helper (in `context-cache.ts` or `helpers.ts`):

```ts
runFlashCallWithCachePlan(plan, protocolBlock, dynamicTail, generateConfig)
```

- `cached`: request with `config.cachedContent`, contents = protocol + tail.
- On a **cache-shaped error** (404 / NOT_FOUND / "expired" / permission-denied on the cache
  resource): delete the DB row, `recreateContextCache` (ONE attempt), retry cached; if recreation
  or retry fails → compose the inline prompt from the same parts and run uncached with
  `cache_status = 'inline_fallback'`, and append the new cascade degradation marker (§6.3).
- Non-cache errors keep today's semantics exactly (draft failure fatal → `markJobError`;
  verifier failure → degrade per existing paths).

### 6.3 Degradation marker

`CascadeDegradation` union (`types.ts`) gains `'cache_fallback'`. It is appended when the D8
inline fallback actually runs. Like all cascade degradations it NEVER causes `'error'`
(MAINT-001 exception) — it only makes the fallback observable in `review_jobs.result` and logs.

### 6.4 Min-size guard

If the rendered cached prefix falls below `MIN_CACHEABLE_PREFIX_CHARS` (constant ≈ 4 × the
model's minimum token count, pinned at implementation from the current Vertex docs — see §11),
skip explicit caching for that key (`inline`). This only triggers for degenerate Law subsets;
today's smallest realistic prefix (72 universal rules + conditions) is far above any minimum.

### 6.5 What stays uncached (on purpose)

- **Escalation reviewer** (`escalation-reviewer-step.ts`): inline composition, `global` client —
  unchanged behavior, now expressed via the shared Layer-1/2 builders (content parity, D3).
- **pro-direct draft** (`draft-reviewer-step.ts` on `MODEL_ESCALATION`): inline, `global` client.
- Both record `cache_status: 'inline'`.

## 7. Files & Interfaces to Modify (exhaustive)

| File | Change |
|---|---|
| `supabase/migrations/033_vertex_context_caches.sql` (+ MCP apply) | New table + `review_job_llm_calls.cache_status` (§5). |
| `src/lib/law.ts` | `fetchRenderedLawBlock` → returns `{ lawBlock: string; lawContentHash: string }` (sha256 of rendered block). All three call sites updated. Rendering itself unchanged. |
| `src/lib/pipeline/prompt-builder.ts` | Restructure: new exports `buildCachedPrefix(config: PromptConfig, lawBlock: string): string` (Layer 1) and `buildProtocolBlock(variant: PromptVariant): string` (Layer 2, static constants); `buildPrompt(variant, config, lawBlock)` reimplemented as `buildCachedPrefix + '\n\n' + buildProtocolBlock` (inline path, keeps escalation/pro-direct call sites source-compatible). New `SHARED_GATEKEEPER_CORE`; personas/output formats redistributed per §4.2; `PROMPT_CACHE_SCHEMA_VERSION` exported here (it versions the prompt text). |
| `src/lib/pipeline/context-cache.ts` (new) | §6.1/§6.2: key computation, DB registry access, lazy create, sliding TTL, kill-switch, min-size guard, D8 recreate-once helper. |
| `src/lib/pipeline/steps/draft-reviewer-step.ts` | `runDraftOnModel`: for `MODEL_DRAFT` resolve a `PromptPlan` and run via the cache-plan helper; `MODEL_ESCALATION` (pro-direct + degraded retry) stays inline. `runReviewerCall` signature takes the plan; telemetry rows carry `cache_status`. |
| `src/lib/pipeline/claim-verification.ts` | `runVerdictCallWithRetry` accepts a `PromptPlan`-based envelope instead of a bare `systemPrompt` string (flash-verify passes cached plan; pro-verify passes inline). |
| `src/lib/pipeline/steps/claim-verifier-step.ts` | Resolve plan once per job (not per batch), pass through to batches. |
| `src/lib/pipeline/steps/escalation-reviewer-step.ts` | Inline plan; adjusted to the new `fetchRenderedLawBlock` return shape and envelope. |
| `src/lib/pipeline/types.ts` | `CascadeDegradation` + `'cache_fallback'`. |
| `src/lib/telemetry/llm-call-log.ts` | `LlmCallRecord` + `readonly cacheStatus?: CacheStatus`; insert maps to `cache_status`. |
| `src/lib/pipeline/prompt-stability.test.ts` | **Contract v2** (see §9). |
| `src/lib/pipeline/context-cache.test.ts` (new) | §9. |
| Step tests (`draft-reviewer-step.test.ts`, `cascade-degradation.test.ts`, `llm-skip-guards.test.ts`, `helpers.test.ts`) | Updated mocks (law return shape, plan envelope); llm-skip-guards additionally assert **zero `caches.*` calls** on short-circuited jobs. |
| `scripts/verify-context-cache.ts` (new) | D11 probe (§10 Phase A). |
| `.env.example` | `VERTEX_CONTEXT_CACHE_DISABLED`, `VERTEX_CACHE_TTL_SECONDS` documented. |
| `ROADMAP.md` | Same commit: feature moved to Implemented with receipts; new gaps recorded (DOC-001). |

Explicitly untouched: `vertex.ts` (clients unchanged), `models.ts` (no new model ids),
`rag.ts`, prescan lane, `runner.ts` step order, GitHub reporter/persister.

## 8. Economics (order of magnitude — pin prices in the Phase-B receipt)

Per Flash call today: ~13k prompt tokens, of which ~9–11k (Law + conditions + core persona)
become cached. Per scan (draft + ≥1 verify): ~18–22k tokens/scan move to the discounted rate.

- **Savings when hot:** at a 75–90% cached-token discount, input cost per scan drops ~50–65% on
  the Flash calls — comfortably above the 20–30% target even at partial hit rates.
- **Storage:** a ~10k-token cache at published token-hour rates costs on the order of **$0.01/h**
  per active variant; sliding 1h TTL bounds this strictly to activity windows (D4). Idle
  nights/weekends cost zero.
- **Worst case (isolated single scan):** one creation at standard input rate + ≤1h storage —
  break-even vs today, since draft + verify of the *same* job already reuse the fresh cache.

## 9. Test Plan (THE LAW applies to tests too)

**Prompt-stability contract v2** (rewrite of `prompt-stability.test.ts`):
1. `buildCachedPrefix` is byte-identical across differing diffs/RAG/practices/prescan inputs for
   fixed `(activeConditionIds, lawBlock)` — the cache-key promise.
2. Layer-2 protocol blocks are static constants: byte-identical across calls, and the
   `claim_verifier` protocol contains no practices notice and no draft-persona text (PROC-001).
3. Dynamic content (evidence, practices, `<already_flagged>`, diff) never appears in Layer 1 or
   Layer 2.
4. Inline composition equals `prefix + '\n\n' + protocol` for every variant (fallback parity).
5. Key stability: same inputs → same `cacheKey`; changed Law content / conditions / ecosystems /
   schema version → different key; ecosystem ORDER does not change the key.

**`context-cache.test.ts`** (mocked Vertex client + mocked supabase):
kill-switch short-circuit; DB hit without bump (young cache); hit with bump (old cache, PATCH +
expires_at update); bump failure non-fatal; miss → create + upsert; create failure → inline_fallback
plan; min-size guard; safety-margin expiry treated as miss; D8 helper: cache-shaped error →
recreate once → retry, second failure → inline with `cache_fallback` degradation appended;
non-cache errors re-thrown untouched.

**Step tests:** cached plan reaches `generateContent` as `config.cachedContent` with NO
`systemInstruction`; inline paths (escalation, pro-direct) send `systemInstruction` and never
touch `caches.*`; `cache_status` lands in telemetry rows; existing degradation semantics
unchanged; llm-skip-guards prove short-circuited jobs make zero cache API calls.

## 10. End-to-End Verification (DOC-001 — Done requires ALL of this)

**Phase A — probe script (dev gate, before pipeline integration):**
`npx tsx scripts/verify-context-cache.ts` against the real `europe-west3` endpoint:
1. Creates a cache with a representative Layer-1 prefix (real rendered Law block), TTL 300s.
2. Fires two `generateContent` calls referencing it; prints `usageMetadata` for both.
3. **Gate:** both calls report `cachedContentTokenCount` ≈ prefix size (> 0 is not enough —
   partial caching would indicate a structural mistake).
4. Empirically confirms the §11 open facts: request-level `systemInstruction` alongside
   `cachedContent` (expected: rejected), `caches.update` TTL semantics, minimum size behavior.
5. Deletes the cache (leaves no storage running).
Findings are written into §11 of this spec before the pipeline code is built.

**Phase B — live pipeline receipt (the DoD):**
1. Two production scans of the same repo within the TTL window, ~2 minutes apart:
   `npx tsx scripts/simulate-webhook.ts --repo unslopai/test --pr 13 --action synchronize
   --head-sha <sha> --target https://unslop.codes` (the prescan A/B rig — prescan stays off for
   that repo per ROADMAP).
2. Receipt SQL (job ids recorded in ROADMAP):

```sql
select job_id, phase, model, cache_status, prompt_tokens, cached_tokens,
       round(100.0 * cached_tokens / nullif(prompt_tokens, 0), 1) as cached_pct
from review_job_llm_calls
where job_id in ('<job1>', '<job2>') and phase in ('draft', 'verify')
order by created_at;
```

   **Pass criteria:** scan #1 rows show `explicit_created`/`explicit_hit`; scan #2 draft AND
   verify rows show `cache_status = 'explicit_hit'` with `cached_pct ≥ 50`; a
   `vertex_context_caches` row exists with matching `cache_key` and a bumped `last_used_at`.
3. Cost proof: computed comparison of blended input cost per scan (current price sheet, pinned
   in the ROADMAP entry with source link) for the two receipt jobs vs. the pre-caching baseline
   window (the §1 table). **Pass:** ≥ 20% input-cost reduction at observed hit rates.
4. Behavioral non-regression: both jobs end `'done'` with plausible integrity scores and inline
   comments; full test suite green; `npx tsc --noEmit` clean; `npm run build` green.
5. Kill-switch receipt: one scan with `VERTEX_CONTEXT_CACHE_DISABLED=1` on Vercel →
   `cache_status = 'inline'`, job completes normally. (Env var removed afterwards.)

## 11. Open Facts — PINNED (Phase A probe run 2026-08-08, exit 0)

Probe receipts (`npx tsx scripts/verify-context-cache.ts`, cache
`projects/509399427086/locations/europe-west3/cachedContents/6372140473938608128`, deleted after):

| # | Fact | Result |
|---|---|---|
| F1 | Request `systemInstruction` with `cachedContent` | **REJECTED**: `400 INVALID_ARGUMENT — "Tool config, tools and system instruction should not be set in the request when using cached content."` Layer-2 protocol blocks are mandatory. |
| F2 | Minimum cacheable tokens (`gemini-2.5-flash`) | **1,024** (verbatim API error: "The minimum token count to start explicit caching is 1024."). `MIN_CACHEABLE_PREFIX_CHARS = 4096` (≈ 1,024 tokens × 4 chars). |
| F3 | Current cached-token discount + storage price | **Pinned 2026-08-26 from the account's real SKU catalog** (after fixing `scripts/lib/vertex-pricing.ts`): `gemini-2.5-flash` cached input **$0.03/1M** vs. $0.30 uncached (90% discount, SKU `A1C1-77CC-6FAE`); cache storage **$1.00/1M token-hours** (SKU `1712-36BA-F206`; same rate for the 3.x flash family, Pro $4.50). |
| F4 | `caches.update` TTL semantics | **Extends from now** — after ~4.7s wall time, updated `expireTime` shifted +4,686ms vs creation, i.e. new expiry = now + TTL. Sliding TTL works as designed. |
| F5 | Quotas on `caches.*` | No limit encountered during the probe; treated as non-binding at our volume. Re-check only if production errors say otherwise. |

Gate receipt: cache = 19,562 tokens (real unfiltered Law block + probe header); call 1 AND call 2
each reported `cachedContentTokenCount = 19,562` — **100.0%** of the cache, `promptTokens = 19,568`
(only the 6-token user prompt uncached). Full-prefix caching confirmed, no partial-hit anomaly.

Sizing note discovered by the probe: the unfiltered Law block is 61,436 chars but **19,562 real
tokens** — the 4-chars/token estimate undershoots by ~27% on this corpus. Economics in §8 scale
UP accordingly (more cacheable tokens per call than estimated).

## 12. Out of Scope (explicit)

- Caching the **escalation** step or **pro-direct** route (D3; revisit when `gemini-3.1-pro`
  reaches GA in `europe-west3` — see the existing "GDPR Vertex AI Cutover" roadmap item).
- Implicit-caching tuning beyond what the restructure delivers for free.
- Per-repo cache config (`pipeline_config` surface), dashboard UI, cache metrics UI.
- Law-block content slimming (separate roadmap item, "Law-block slimming behind cache-hit
  telemetry" — this spec *provides* that telemetry).
- `detected_ecosystems` backfill for pre-Phase-5 repos (tracked in ROADMAP §1; those repos
  transparently share the `'unfiltered'` cache variant meanwhile).
- Embeddings, prescan, CLI/extension, and any billing/pricing change.
- A cleanup job for orphaned Vertex caches (TTL is the cleanup; no cron exists — D4/D7).

## 13. Risks & Mitigations

- **Quality drift from persona relocation** (system → user turn): mitigated by keeping all
  instruction text verbatim where possible, temperature 0, and the Phase-B non-regression check
  on a known PR whose expected findings are documented (integrity 93–95 band on `unslopai/test`
  #13 control runs). If findings visibly degrade, the layout (not the mechanism) is iterated.
- **Preview-adjacent API instability**: caching is only used on GA Flash in a GA region; the
  preview Pro model is deliberately excluded (D3).
- **Stale cache after Law change**: bounded to one TTL (≤ 1h) of *storage*, zero correctness
  impact — the key rotates immediately, so no scan ever runs on an old Law (D7).
- **Thundering-herd creation race**: last-writer-wins upsert; orphaned caches expire by TTL;
  cost impact ≤ one duplicate creation per race.
- **Vercel OOM ceiling**: `context-cache.ts` adds no heavy modules (pure SDK calls on the
  existing client) — no interaction with the known prescan/rag-loader memory budget.

## 14. Amendment 2026-10-05: repository context package (REPO_CONTEXT_SPEC §6.3)

- The repository context package is per-request data and lives only in the dynamic tail of the draft contents (after Evidence and Practices, before `<already_flagged>` and the diff). It is never part of the cached prefix, and it is no input of `computeCacheKey`. Proof: `prompt-stability.test.ts`, "Repo-Kontextpaket": the `systemInstruction` (the cached prefix) is byte-identical with and without a package. The key has no package input by construction: `CacheKeyInputs` carries model, law hash, ecosystems and condition ids only.
- Condition 12 (Repository Mismatch) is a registry condition and therefore part of the prefix whenever it is active. It is active exactly when `pipeline_config.repoContext.enabled` holds (`resolveActiveConditionIds`), so a repository with the context switched off gets a different conditions key than one with it on.
- `PROMPT_CACHE_SCHEMA_VERSION` 3 → 4: both draft protocol blocks and the verifier protocol block changed (repository context notice, Priority 3 of the RAG protocol, output fields of a Condition 12 finding, "REPOSITORY CONTEXT CLAIMS" for the verifier). Consequence after the deploy: one `explicit_created` per key.
- The verifier receives the cited context excerpt in its dynamic contents as well ("REPOSITORY CONTEXT EXCERPTS"), once per cited file and only for claims that carry a `context_path`.
