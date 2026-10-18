# SPEC: LLM Router Cascade & Cognitive Integrity Pipeline

**Status:** Approved for implementation (architecture interview completed 2026-07-12)
**Roadmap items:** §5 (RAG & LLM Pipeline Enhancements), §6 (Unit Economics)
**Scientific basis:** `NEW_METHODS_ON_AI_CREDIBILITY.md` (Hallucination Self-Detection, 4-step algorithm)
**Supersedes:** the CLI/IDE spec previously in this file (shipped; see git history).

---

## 1. Context (current state of the codebase)

- **Job flow:** GitHub webhook / CLI scan → insert `review_jobs` row (`status: 'pending'`) → `after()` runs `processReviewJob` (`src/lib/worker.ts`) in-process on Vercel (`maxDuration = 60` on all API routes). No queue consumer, no cron — `after()` is the only dispatch mechanism.
- **Pipeline:** `runPipeline` (`src/lib/pipeline/runner.ts`) executes stateless `PipelineStep`s sequentially over an immutable `PipelineContext` (`src/lib/pipeline/types.ts`). Steps come from `STEP_REGISTRY` (`src/lib/worker.ts`), assembled per repo from `repositories.pipeline_config` (JSONB) or `DEFAULT_PIPELINE_CONFIG` (`src/lib/pipeline/defaults.ts`): `diff-loader → rag-loader → ai-reviewer → github-reporter` (+ always-terminal `result-persister`). CLI jobs use the fixed `CLI_PIPELINE_STEPS`.
- **LLM call:** exactly one, hardcoded `gemini-2.5-flash`, in `ai-reviewer-step.ts` via `getVertexClient()` (`@google/genai`, Vertex, `europe-west3`), `responseMimeType: 'application/json'`, parsed by `parseModelJson`. Output: `{ has_slop, issues[], summary }`.
- **Telemetry:** aggregate token columns on `review_jobs` (`prompt_tokens`, `cached_tokens`, `output_tokens`, `model`) from migration 016. No per-call granularity.
- **Billing guardrails:** `resolveEntitlement` + `consumeScanQuota` (`src/lib/billing/entitlements.ts`) gate every job via the `consume_user_scan_quota` RPC (fixed-window, fail-closed). `PLAN_CONFIG` (`src/lib/billing/plan-config.ts`) holds per-plan limits.
- **Platform status:** pre-launch, zero external customers. No backward-compatibility burden.

## 2. Decisions (from the interview, with rationale)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Issues are the Claims.** The paper's "fact triples" map onto the draft reviewer's issues: each issue is an atomic claim (`location – violates – rule`) that must survive independent verification. No separate code-triple extraction phase. | Minimal-invasive; the issue contract is already the atomic unit across backend/CLI/extension. Primary product win: kill false positives ("zero noise"). |
| D2 | **One new PipelineStep per paper phase** (`complexity-router → draft-reviewer → claim-verifier → escalation-reviewer → integrity-scorer`). No monolith cascade step, no nested sub-pipeline. | Fits the existing registry/context architecture; each step individually testable and within the complexity-15 limit. |
| D3 | **Hybrid router with all three triggers.** (a) Pre-LLM complexity heuristic → Pro **full run**, Flash never sees the diff (avoids false *negatives* on complex diffs). (b) Post-verification: `UNCERTAIN` verdicts OR (`CRITICAL` AND confidence < threshold) → Pro **targeted re-verification** of only those claims ("laser", avoids false *positives* cheaply). | Sweet spot of quality and unit economics: full Pro tokens only when Flash would structurally fail; otherwise minimal Pro tokens. |
| D4 | **Single job, single `after()` callback**, `maxDuration` raised to 300. New table `review_job_llm_calls` for per-call telemetry; aggregate columns on `review_jobs`. No re-enqueue mechanism. | No queue consumer exists; re-enqueue would require cron infrastructure. Per-call table is the foundation for unit-economics dashboards (Roadmap §6). |
| D5 | **Models: `gemini-2.5-flash` for draft AND verifier, `gemini-3.1-pro` for escalation.** The verifier call is strictly **blind**: it receives the claims (rule, location, quoted code, diff hunk) but never the draft's critique text or reasoning. | Prompt/JSON stability of Flash is proven; B2B quality before extreme cost-cutting. Blindness simulates the paper's Consortium Consistency as far as a single-vendor stack allows. Flash-Lite/Gemma drafting is a later data-driven A/B test on top of the telemetry table (see §10). |
| D6 | **`<uncertain>` becomes a structured enum.** Verifier returns strict JSON per claim: `{ claim_id, verification_question, blind_answer, verdict: CONFIRMED\|REFUTED\|UNCERTAIN, confidence: 0-100 }`. No free-text tag parsing. | Deterministically parseable with existing `parseModelJson`; preserves the paper's semantics (self-questioning + blind answer + verbalized confidence), only the signal encoding changes. |
| D7 | **Verification is batched**: all claims of a job in one verifier call, capped at 15 claims per call (chunked above the cap). | 1 call instead of N; implicit prompt caching applies. The cap mitigates the paper's "model chokes on long blocks" failure mode. |
| D8 | **Refuted issues are discarded** (audit-logged in `review_job_llm_calls`), never shown. Issues still `UNCERTAIN` after Pro re-verification are downgraded to `WARNING`, annotated, and carry a fixed finding confidence of 50 (§6). Every surviving issue carries a `verification` status (`confirmed` / `uncertain` / `self_reported` / `unverified` / `deterministic`) that drives the score tagline. The **Cognitive Integrity Score is displayed in the PR summary** as a customer-facing USP. | Core promise is "zero noise"; the visible score proves scientific depth and builds B2B trust. |
| D9 | **Score is informational, never gates the GitHub check** (unless a repo opts into Slop Score Gating via `minIntegrityScore`). Weighted average (CRITICAL ×2) of surviving-claim confidences; an `UNCERTAIN` claim contributes 50, never the verifier's confidence in its own verdict; clean diff = 100. | The score measures *review confidence*, not *code quality*. Blocking merges on our own uncertainty would punish customers for our doubt. |
| D10 | **Graceful degradation everywhere.** The customer always receives a review; internal cascade failures never surface as a failed PR check. Every fallback is recorded as a phase status in `review_job_llm_calls`. | B2B trust: a broken verifier JSON must not blow up a customer's PR. |
| D11 | **Thresholds live in `pipeline_config` (JSONB, per repo) with code defaults; Pro escalations have a hard per-plan monthly budget** enforced by a fixed-window RPC (same pattern as `consume_user_scan_quota`). Over budget → job completes Flash-only with a summary notice. | Multi-tenant SaaS needs per-repo tuning (future "Friction Slider", Roadmap §7) and protection against runaway Pro costs (Pro is ~10–20× Flash per token). |
| D12 | **Complexity heuristic = estimated diff tokens + reviewable file count.** `estimatedDiffTokens = combinedDiff.length / 4`; thresholds (defaults 12 000 tokens / 15 files) in `pipeline_config`. Either threshold exceeded → Pro full run. | Deterministic, zero-cost, computable from the existing `PipelineContext`, explainable in telemetry. Multi-signal scores are pseudo-precision without data. |
| D13 | **V1 scope: webhook + CLI pipelines only.** The procedural raw-code path (`processJob` / `runReviewer` / `runFixer`) stays on plain Flash; migrating it is a separate follow-up ticket. | Iterative de-risking; one shared code path gets the cascade first. |
| D14 | **Hard cutover, no alias layer.** `ai-reviewer-step.ts` is deleted; registry, defaults, `CLI_PIPELINE_STEPS`, `VALID_STEP_IDS`, and existing dev-DB `pipeline_config` rows are rewritten. | Pre-launch, zero customers: compatibility shims would be technical debt for users who don't exist. |

## 3. Mapping the paper's 4 steps onto the pipeline

| Paper step | Pipeline realization |
|---|---|
| 1. Knowledge Graph Construction (fact triples) | `draft-reviewer`: the Flash draft's issue list *is* the deconstruction — each issue an atomic claim `(path:line – violates – rule)` with `exact_quote` as evidence anchor. |
| 2. Self-Questioning + `<uncertain>` marker | `claim-verifier`: blind Flash batch call; per claim a self-generated `verification_question`, a `blind_answer` from internal knowledge only, and `verdict`/`confidence` (D6). `UNCERTAIN` is the enum form of the `<uncertain>` tag. |
| 3. Self-Consistency Check | Deterministic post-processing inside `claim-verifier`: the blind verdict is compared against the draft claim. `REFUTED` → discard (logged). Consistency needs no extra LLM call — the verdict *is* the comparison. |
| 4. Cognitive Integrity Score (verbalized confidence) | `integrity-scorer`: deterministic aggregation (§6). Escalation to Pro (`escalation-reviewer`) happens between steps 3 and 4 for claims that failed to reach consistent confidence. |

## 4. New pipeline architecture

### 4.1 Step chain (webhook)

```
diff-loader → rag-loader → complexity-router → draft-reviewer → claim-verifier
            → escalation-reviewer → integrity-scorer → github-reporter → result-persister
```

CLI (`CLI_PIPELINE_STEPS`): `cli-diff-loader → rag-loader → complexity-router → draft-reviewer → claim-verifier → escalation-reviewer → integrity-scorer → result-persister`.

Every cascade step self-skips based on `context.cascade.route` and `shouldAbort` (existing pattern). The five cascade steps are **required** (not user-toggleable) — `VALID_STEP_IDS` in `src/app/api/repos/[id]/settings/route.ts` treats them like `diff-loader`.

### 4.2 Step responsibilities

| Step id | LLM | Responsibility |
|---|---|---|
| `complexity-router` | none | Compute `estimatedDiffTokens` + file count. Over threshold → `route = 'pro-direct'` **after** successfully consuming the Pro escalation budget (§7); budget denied → `route = 'flash-cascade'` + degradation flag `pro_budget_exhausted`. Otherwise `route = 'flash-cascade'`. |
| `draft-reviewer` | Flash (or Pro on `pro-direct`) | On `flash-cascade`: identical behavior to today's `ai-reviewer` (prompt variants `reviewer_diff`/`reviewer_rag`, RAG section, scope post-filter). On `pro-direct`: same prompt on the escalation model (`MODEL_ESCALATION`, since 2026-09-17 `gemini-3.8-flash` in the `escalation` role — same explicit cache as the draft, 150 s call deadline; `gemini-3.1-pro-preview` only via the rollback switch), with the response schema extended by a per-issue `confidence: 0-100` (full runs are not re-verified — the escalation model self-reports verbalized confidence). |
| `claim-verifier` | Flash | Skipped on `pro-direct` or when 0 issues. Builds blind claims (D5: `claim_id`, `rule`, `path`, `line`, `exact_quote`, surrounding diff hunk — **no critique text, no fix snippet**), new prompt variant `claim_verifier`, batch call (≤15 claims/call, chunked). Applies verdicts: `REFUTED` → drop + log; `CONFIRMED` → attach confidence; `UNCERTAIN` or (`CRITICAL` ∧ confidence < `confidenceThreshold`) → mark for escalation. |
| `escalation-reviewer` | Pro | Skipped when no claims are marked. Consumes the Pro budget (once per job), then re-verifies **only the marked claims** with the same `claim_verifier` contract on the escalation model (`MODEL_ESCALATION`, `escalation` role: explicit cache shared with the draft, 150 s call deadline). Escalation verdict overrides Flash: `REFUTED` → drop; `CONFIRMED` → keep with Pro confidence; still `UNCERTAIN` → downgrade issue to `WARNING`, keep annotated. Budget denied / API error → degradation path (§8). |
| `integrity-scorer` | none | Compute the score (§6), attach per-issue confidences to `PipelineIssue.confidence`, append degradation notices to `reviewSummary`. |

### 4.3 `PipelineContext` extensions (`src/lib/pipeline/types.ts`)

```ts
interface ClaimVerdict {
    readonly claimId: string;            // stable per-job issue reference
    readonly verificationQuestion: string;
    readonly blindAnswer: string;
    readonly verdict: 'CONFIRMED' | 'REFUTED' | 'UNCERTAIN';
    readonly confidence: number;         // 0-100
    readonly phase: 'flash-verify' | 'pro-verify';
}

type CascadeRoute = 'flash-cascade' | 'pro-direct';
type CascadeDegradation =
    | 'pro_budget_exhausted' | 'pro_api_error'
    | 'verifier_parse_error' | 'verifier_api_error';

interface CascadeState {
    readonly route: CascadeRoute;
    readonly estimatedDiffTokens: number;
    readonly verdicts: readonly ClaimVerdict[];
    readonly escalationClaimIds: readonly string[];
    readonly escalated: boolean;
    readonly escalationReason: 'complexity_heuristic' | 'uncertain_claims' | 'critical_low_confidence' | null;
    readonly integrityScore: number | null;   // null = degraded, no honest score possible
    readonly degradations: readonly CascadeDegradation[];
}
```

`PipelineContext` gains `readonly cascade: CascadeState` and `readonly ownerUserId: string` (needed for budget RPC; `processReviewJob` already receives `userId`). `PipelineIssue` gains `readonly confidence?: number`. `tokenUsage` stays as the job-level aggregate (summed across calls); per-call detail goes to the DB (§5).

Model ids move to a new `src/lib/pipeline/models.ts`: `MODEL_DRAFT = 'gemini-2.5-flash'`, `MODEL_VERIFIER = 'gemini-2.5-flash'`, `MODEL_ESCALATION = 'gemini-3.1-pro'`. No hardcoded model strings in steps.

### 4.4 Verifier contract (prompt variant `claim_verifier`)

System prompt (new, in `prompt-builder.ts`): the verifier is an independent auditor; for each claim it must formulate a verification question, answer it purely from internal knowledge **without assuming the claim is true**, then emit a verdict and a calibrated 0–100 confidence. Response schema:

```json
{ "verdicts": [ {
    "claim_id": "c1",
    "verification_question": "Does the identifier 'data' at src/lib/foo.ts:42 violate the no-generic-names rule?",
    "blind_answer": "…reasoning from internal knowledge only…",
    "verdict": "CONFIRMED",
    "confidence": 91
} ] }
```

Post-parse validation (deterministic, in the step): every input `claim_id` must appear exactly once; `confidence` clamped to `[0,100]`; unknown/missing verdict → treat that claim as `UNCERTAIN` (fail-safe toward escalation, not toward silent trust).

## 5. Database migrations

### `021_create_review_job_llm_calls.sql`

```sql
CREATE TABLE review_job_llm_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    job_id UUID NOT NULL REFERENCES review_jobs(id) ON DELETE CASCADE,
    repo_id UUID REFERENCES repositories(id) ON DELETE SET NULL,
    phase TEXT NOT NULL CHECK (phase IN ('draft', 'verify', 'escalate_targeted', 'escalate_full')),
    model TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ok', 'parse_error', 'api_error', 'skipped_budget')),
    prompt_tokens INTEGER,
    cached_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    claims_total INTEGER,
    claims_confirmed INTEGER,
    claims_refuted INTEGER,
    claims_uncertain INTEGER
);

CREATE INDEX idx_llm_calls_job ON review_job_llm_calls(job_id);
CREATE INDEX idx_llm_calls_econ ON review_job_llm_calls(model, phase, created_at);
```

Design rules honored: explicit columns for everything a unit-economics dashboard aggregates (cost per model × phase × time = `SUM(tokens) GROUP BY model, phase, date_trunc(...)` — no JSONB unpacking); `repo_id` present so every query can filter by repo. Cost-per-token stays a code-side price map (prices change; raw tokens don't). **Each LLM-calling step inserts its row immediately after the call returns/fails** — telemetry survives later-step crashes.

### `022_add_cascade_columns_review_jobs.sql`

```sql
ALTER TABLE review_jobs
    ADD COLUMN IF NOT EXISTS integrity_score INTEGER CHECK (integrity_score BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS escalated BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
    ADD COLUMN IF NOT EXISTS cascade_route TEXT;
```

Existing `review_jobs.model` keeps meaning "primary model of the final result" (Pro if escalated, else Flash); token columns stay as job aggregates.

### `023_create_pro_escalation_quota.sql` + `024_cutover_pipeline_config.sql`

- `023`: the existing scan quota lives as fixed-window columns on `billing_customers` (`month_started_at` / `month_request_count`, verified against the live DB). The Pro budget follows the same pattern: add `escalation_month_started_at TIMESTAMPTZ` + `escalation_month_count INTEGER NOT NULL DEFAULT 0` to `billing_customers`, plus RPC `consume_pro_escalation_quota(target_user_id UUID, monthly_max INT) RETURNS BOOLEAN` with the same locking semantics as `consume_user_scan_quota` (monthly window only; Pro bursts are already smoothed by the scan quota).
- `024` (hard cutover, D14): rewrite every existing `repositories.pipeline_config` — replace `"ai-reviewer"` in `enabledStepIds` with the five cascade step ids and seed the `cascade` config block with defaults.

RLS: every existing table has RLS enabled (verified live). `021` must enable RLS on `review_job_llm_calls` with no client policies — only the service-role worker writes it; dashboard reads go through server routes.

## 6. Cognitive Integrity Score

```
weight(issue)   = 2 if severity == CRITICAL else 1
confidence_i    = verifier confidence for CONFIRMED claims
                = 50 for UNCERTAIN claims (fixed — see below)
                = the model's self-reported confidence for pro-direct / second-opinion issues
score           = round( Σ(confidence_i × weight_i) / Σ(weight_i) )
no surviving issues (clean diff or all refuted) → score = 100
any degradation that skipped verification      → score = null (rendered "n/a")
```

**UNCERTAIN = 50, not the verifier's number** (decided 2026-09-17, ROADMAP To-Do §3). The verifier's `confidence` measures its confidence *in the verdict* — "100 % sure this is undecidable" — while the score aggregates confidence *in the findings*. Feeding the verdict number through produced "Cognitive Integrity Score: 100/100 — every finding survived independent blind re-verification" next to a finding annotated as *not conclusively confirmed*. An undecided verdict is a coin flip for the finding, so the issue's `confidence` and its score contribution are a fixed 50 (`UNCERTAIN_CLAIM_CONFIDENCE` in `integrity-scorer-step.ts`); the verifier's own number stays in the verdict log (`review_job_llm_calls`).

**Per-finding `verification` status** (Shared contract `IssueVerification`, persisted in `review_jobs.result.review.issues[]`): `confirmed` (blind re-verified), `uncertain` (verdict stayed UNCERTAIN), `self_reported` (no blind verification — pro-direct and second-opinion issues carry the reviewing model's own confidence), `unverified` (verification never completed: escalation skipped, verifier degraded, or a result persisted before 2026-09-17), `deterministic` (pre-scanner rule, no LLM claim). Clients treat a missing status as `unverified` — the tagline never claims more confirmation than the data proves.

Rendering (`github-reporter-step` summary, CLI output, extension tooltip — all via `describeFindingVerification`, canonical copy in `packages/shared/src/verification-format.ts`, documented duplicate in the extension with a parity test):

```
🧠 Cognitive Integrity Score: 83/100
   3 findings: 2 survived independent blind re-verification, 1 remained uncertain;
   low-confidence findings were escalated to a stronger model.
```

The sentence "every finding survived independent blind re-verification" is rendered only when every finding is `confirmed`; zero findings render "no findings to verify"; pro-direct renders "… carry only the reviewing model's self-reported confidence (no blind re-verification)".

Downgraded issues (post-Pro `UNCERTAIN`) get an inline annotation: `⚠️ Reduced confidence — independent verification remained uncertain, so this finding could not be conclusively confirmed.` Issues downgraded because their marked Pro escalation never ran (budget, API or time-limit degradation) get a different annotation naming that reason: `⚠️ Downgraded to WARNING — this finding was flagged for Pro escalation, but the escalation was skipped (budget, API or time-limit degradation), so it could not be conclusively verified.` Both deliberately omit the verifier's numeric confidence: it measures confidence in the VERDICT but reads as confidence in the finding — the old copy produced the self-contradictory "Reduced confidence (100/100)" on both paths (F5 findings 2026-08-31; a live UNCERTAIN/100 verdict reproduced it after the first fix). The numeric confidence still lives in the issue's `confidence` field. The score never changes the GitHub check conclusion (D9).

## 7. Router config & cost guardrails

`pipeline_config` JSONB gains a `cascade` block (defaults in `defaults.ts`, validated in `parsePipelineConfig` with per-field fallback to defaults — invalid partial configs must not kill jobs):

```jsonc
"cascade": {
    "confidenceThreshold": 70,        // CRITICAL below this → escalate
    "heuristicMaxDiffTokens": 12000,  // over → pro-direct
    "heuristicMaxFiles": 15,          // over → pro-direct
    "proDirectMaxDiffTokens": 25000,  // over → NEVER pro-direct (cost ceiling, A8)
    "verifierBatchCap": 15            // claims per verifier call
}
```

`PlanEntitlements` gains `proEscalationsPerMonth` (Pro plan: **200**). The budget is consumed **at most once per job**, immediately before the first Pro call (`complexity-router` for `pro-direct`, `escalation-reviewer` for targeted). Denied budget = degradation, never job failure. This bounds worst-case monthly Pro spend per user deterministically: `200 × avg-Pro-job-tokens`, independent of how hostile the diffs are.

`maxDuration` on `src/app/api/webhook/route.ts` and `src/app/api/cli/scan/route.ts` rises from 60 → **300** (worst case is heuristic-routed Pro full run or draft + verify + Pro re-verify, ~3 sequential LLM calls plus GitHub I/O).

## 8. Degradation matrix (D10)

| Failure | Behavior | Telemetry |
|---|---|---|
| Verifier returns unparseable JSON | 1 retry; on second failure pass draft issues through **unfiltered**, `integrityScore = null`, summary notice "confidence verification unavailable for this review" | `verify` row, `status: 'parse_error'` |
| Verifier API error | same as above (1 retry, then unfiltered pass-through) | `verify` row, `status: 'api_error'` |
| Pro budget exhausted (targeted) | Keep Flash-verified results; escalation-marked issues downgraded to `WARNING` + annotated; summary notice "reduced confidence mode" | `escalate_targeted` row, `status: 'skipped_budget'` |
| Pro budget exhausted (`pro-direct`) | Fall back to `flash-cascade` (Flash draft + verify still runs) + summary notice | `draft` row proceeds normally; router degradation recorded on job |
| Pro API error | 1 retry; then same fallback as budget-exhausted for the respective route | `status: 'api_error'` |
| Escalation call exceeds its **150 s deadline** (role `escalation`, `deadline.ts: ESCALATION_CALL_DEADLINE_MS`, 2026-09-17) | The call is aborted (`AbortSignal`, SDK surfaces DOMException `AbortError`) and **never retried**; then the same fallback as an API error for the respective route (`pro-direct` → Flash cascade, targeted / second opinion → degradation). Since the Deadline Guard (2026-09-26) the deadline is `min(150 s, remaining job budget)`. | `status: 'api_error'` (one row) |
| **Job budget** (DEADLINE_GUARD_SPEC, 2026-09-26): every LLM call carries an `AbortSignal` from the remaining budget (`invocation start + UNSLOP_JOB_BUDGET_MS − 30 s`) — reversal of the former "draft and verifier have no deadline" rule | **Draft** aborted at the budget (or no budget left before it starts) ⇒ job `error` with client code `review_timeout`, red check "Review timed out". **Pro-direct draft** fails ⇒ Flash fallback only with ≥ 90 s left, otherwise `review_timeout`. A verifier / escalation call aborted at the budget degrades like an API error (per-stage skip thresholds: DEADLINE_GUARD_SPEC D4). | `status: 'api_error'` (one row) |
| **Stage skipped for time** (DEADLINE_GUARD_SPEC D4/D6/D13/D14): remaining LLM budget below the stage's start threshold (second opinion 80 s, targeted escalation 60 s, each verifier batch 40 s — thresholds also gate every retry), or the call aborted at the job budget | Job ends `done`. Degradation `time_budget_exhausted` + `skippedStages`, both persisted in `result` (`degradations`, `skipped_stages`) and named in check summary, review body and CLI ("Reduced confidence: time budget exhausted — skipped: …"). Second opinion: results as without it. Escalation: marked claims downgraded like `pro_budget_exhausted`. Verifier: verdicts of finished batches are KEPT (no `degradeToUnfilteredDraft`), the rest stays `unverified`, `integrityScore = null`. The time check runs before the Pro quota is consumed. An abort at the escalation's own 150 s bound with budget to spare stays `pro_api_error`. | skipped before start: none until migration 048 (`skipped_deadline`, DEADLINE_GUARD_SPEC D12); aborted: `api_error` |
| **Invocation killed by the platform** (OOM, `maxDuration`) — no catch runs, job stays `processing` | Lazy reaping (DEADLINE_GUARD_SPEC D10): webhook, CLI poll and dashboard repo page schedule `reapStaleJobs` via `after()` (at most once per minute and instance). A job without a sign of life for job budget + 60 s (6 min on Hobby) is set to `error` with `[review_timeout]`, its check closed "Review timed out" — only by the reaper run whose status-guarded update actually changed the row. | none |
| **Watchdog** (DEADLINE_GUARD_SPEC D9): the pipeline has not reached the reporter 15 s before the platform kill | `JobTimeoutError` into the worker catch ⇒ job `error` `review_timeout` + red check; the surviving pipeline is cancelled before its next step. Disarmed once the reporter/persister phase starts. Terminal writes (`markJobError`, persister) only apply to a job still in `processing`. | none (no LLM call) |
| Model JSON with unescaped `"` inside a string (3.x family, observed on `gemini-3.8-flash` 3/10 calls with JSX quotes) | Repaired at the validation boundary (`helpers.ts: parseModelJson`, quote repair chained with the control-char repair) — no retry consumed; only an unrepairable response counts as `parse_error` | none (successful parse) |
| Zero draft issues | `claim-verifier`/`escalation-reviewer` self-skip; score = 100 | no extra rows |
| Transient model API error (HTTP 429/500/502/503/504) on ANY cascade call — A11 | Backoff retry first (2 s, 6 s + jitter; a `retryDelay` hint in the error body extends it, capped at 15 s; no retry when the failed attempt itself ran > 60 s), THEN the row above/below for that call applies. After the retries: verifier/escalation/second opinion degrade as before; the Pro draft on `pro-direct` falls back to Flash (A7); the **Flash draft** has no model left → job `error` with the stable client code `model_unavailable` | one row per attempt: `api_error` … `api_error`/`ok` |

Invariant: **`markJobError` is reserved for infrastructure failures outside the cascade** (missing payload, GitHub token, diff loading). A cascade-internal failure always ends in `status: 'done'` with a degraded-but-honest result. **Sole exception (A11):** the Flash draft on the `flash-cascade` route is the one call without a degraded alternative — when model capacity stays exhausted through its retries, the job ends in `error` with `model_unavailable`, never as a silent empty review. **Second exception (Deadline Guard, 2026-09-26):** a draft that cannot finish inside the job budget, or a pipeline the watchdog stops before the reporter, ends in `error` with `review_timeout` — an honest red check instead of a job stuck in `processing` after the platform kill (job `e409926e`).

## 9. File-level implementation plan

| File | Change |
|---|---|
| `src/lib/pipeline/models.ts` | **new** — model tier constants (§4.3) |
| `src/lib/pipeline/types.ts` | `CascadeState`, `ClaimVerdict`, `ownerUserId`, `PipelineIssue.confidence` |
| `src/lib/pipeline/steps/complexity-router-step.ts` | **new** (no LLM) |
| `src/lib/pipeline/steps/draft-reviewer-step.ts` | **new** — today's `ai-reviewer-step.ts` logic + route awareness + telemetry insert |
| `src/lib/pipeline/steps/claim-verifier-step.ts` | **new** — blind batch verification (§4.4) |
| `src/lib/pipeline/steps/escalation-reviewer-step.ts` | **new** — budget consumption + targeted Pro re-verify |
| `src/lib/pipeline/steps/integrity-scorer-step.ts` | **new** (no LLM) — score, downgrades, summary notices |
| `src/lib/pipeline/steps/ai-reviewer-step.ts` | **deleted** (D14) |
| `src/lib/pipeline/prompt-builder.ts` | new variant `claim_verifier`; per-issue `confidence` field in the Pro full-run reviewer schema |
| `src/lib/pipeline/defaults.ts` | new step ids + `cascade` defaults |
| `src/lib/worker.ts` | registry update, `CLI_PIPELINE_STEPS` update, `ownerUserId` into context, `parsePipelineConfig` cascade-block validation |
| `src/lib/billing/plan-config.ts` / `entitlements.ts` | `proEscalationsPerMonth` + `consumeProEscalationQuota()` |
| `src/lib/telemetry/llm-call-log.ts` | **new** — typed insert helper for `review_job_llm_calls` |
| `src/lib/pipeline/steps/github-reporter-step.ts` | score block + confidence annotations in summary |
| `src/lib/pipeline/steps/result-persister-step.ts` | persist `integrity_score`, `escalated`, `escalation_reason`, `cascade_route` |
| `src/app/api/repos/[id]/settings/route.ts` | `VALID_STEP_IDS` update (cascade steps required) |
| `src/app/api/webhook/route.ts`, `src/app/api/cli/scan/route.ts` | `maxDuration = 300` |
| `supabase/migrations/021–024_*.sql` | §5 |

Architecture rules apply throughout: no generic variable names, cyclomatic complexity ≤ 15 per function (extract router/verdict helpers), explicit DB columns, `repo_id` filters on all queries.

## 10. Out of scope (follow-up tickets)

1. ~~`processJob` raw-code path onto the cascade (D13)~~ — **resolved by deletion (2026-07-13)**: the path was reachable only through an internal-secret endpoint and no product flow ever created such jobs. `processJob`, `runReviewer`, `runFixer`, the `reviewer_raw` and `fixer` prompt variants, `src/lib/prompts.ts`, and `POST /api/worker` are gone. Dead code is not migrated.
2. **Draft-model A/B test** (Flash-Lite / Gemma) driven by `review_job_llm_calls` data (D5).
3. ~~Friction Slider UI~~ — **dropped (2026-07-12)**: the dashboard stays clean; cascade thresholds remain per-repo `pipeline_config` values, to be surfaced via CLI tooling instead of a dashboard slider.
4. **True Consortium Consistency** (second vendor/architecture as verifier) + Consortium Entropy metric.
5. **Slop Score as a separate gating metric** (score that *does* fail the check run, distinct from review confidence).

## 11. Verification plan

> **Status (2026-07-14):** implemented and verified. Vitest suite is at **125 tests / 13 files** (`npm test`): router boundaries, score formula, verdict validation, plus the mocked degradation harness (`src/lib/pipeline/cascade-degradation.test.ts`) covering every §8 branch reachable without live LLM calls.
> The two items previously listed as pending are both done: the **golden replay now runs the real cascade** against real diffs (commit `9ca35ba`, which surfaced amendments A6/A8 below), and the **live E2E webhook run is proven** — `unslopai/test` PR #13, `source='webhook'` → `check_run_id` persisted → job `done`, `integrity_score: 95`, `escalated: true` on `gemini-3.1-pro-preview`.
> Remaining test gap is outside the cascade: `packages/cli` and `packages/vscode-extension` have no tests at all (see ROADMAP §7).

- **Unit tests:** router heuristic boundaries; score formula (weights, clean diff, degraded null); verdict post-parse validation (missing/duplicate `claim_id`, clamping, unknown verdict → `UNCERTAIN`); every degradation branch in §8.
- **Golden replay set** (existing ~10-diff harness): extend with (a) seeded false-positive diffs asserting refuted claims are suppressed, (b) an oversized diff asserting `pro-direct` routing, (c) cost assertion: median Flash-route job ≤ 1.5× baseline Flash tokens and escalation rate on the set ≤ 25%.
- **Unit-economics smoke query:** `SELECT model, phase, SUM(prompt_tokens), SUM(output_tokens) FROM review_job_llm_calls GROUP BY model, phase` returns sane per-phase rows after a replay run.
- **End-to-end:** one real PR through the webhook path (score block renders, no check-status change) and one CLI scan (score in CLI output); `npm run lint` + `npm run build` clean.

Implementation starts only after this spec is reviewed and approved.

## 12. Amendments (2026-07-12, post-E2E incident PR #13)

A live incident (draft finding silently killed by a false refutation → "No AI slop found, 100/100") led to five approved changes:

| # | Change | Amends |
|---|--------|--------|
| A1 | **Verdict audit:** every verify/escalate call persists its full `ClaimVerdict[]` in `review_job_llm_calls.verdicts` (JSONB, migration 025) — false refutations are now reviewable. | §5 |
| A2 | **REFUTED-CRITICAL escalation:** a flash `REFUTED` on a CRITICAL draft claim no longer dies silently; it is escalated to Pro. Only a Pro `REFUTED` may conclusively drop a CRITICAL. If Pro is unavailable (budget/API), the claim survives downgraded to WARNING with a confidence annotation. | D3, D8, §8 |
| A3 | **Determinism:** all cascade LLM calls (draft, verify, escalate) run with `temperature: 0` (`CASCADE_TEMPERATURE`). Identical diffs must yield identical reviews. | §4.2 |
| A4 | **Escalation model fix:** `gemini-3.1-pro` does not exist on Vertex; the working model is `gemini-3.1-pro-preview`, served only on the `global` endpoint (verified 2026-07-12: 404 in europe-west3/us-central1). A second Vertex client (`getVertexGlobalClient`) carries ONLY escalation traffic; Flash stays in `europe-west3`. TODO in `vertex.ts`: return to the EU region as soon as the Pro model is GA there (GDPR). | D5, §4.3 |
| A5 | **Summary consistency:** when every draft finding is dismissed, the integrity-scorer replaces the stale draft summary ("AI slop detected: …") with an accurate all-refuted summary. | §6 |

### 12.1 Amendments from the cascade replay rig (2026-07-13)

Rewriting the golden replay to run the real cascade (§11) surfaced two production defects before any customer hit them:

| # | Change | Amends |
|---|--------|--------|
| A6 | **Hardened JSON boundary:** `gemini-3.1-pro-preview` appends a stray closing brace to an otherwise valid object (`finishReason: STOP`, single part, `responseMimeType: application/json` set). `parseModelJson` now extracts the first balanced JSON value (string- and escape-aware) instead of parsing the whole text, so trailing braces, markdown fences, and trailing prose no longer kill a review. | ARCH-002, §4.4 |
| A8 | **Pro cost ceiling:** a new `cascade.proDirectMaxDiffTokens` (default 25 000) forbids the Pro full run above that size — such diffs go through the Flash cascade with targeted escalation instead. Pro cost per job scales linearly with diff size, so without this the 300 KB diff cap alone defined the worst case: 200 escalations × ~$0.20 ≈ $40/month against $49 revenue. The ceiling bounds cost **per job**, not just the number of jobs. | §7, D11 |
| A9 | **Cognitive Integrity Score in CLI and IDE:** `ScanResult.cognitiveIntegrityScore` carries the score to both clients (CLI prints it with every result; the extension shows it in the status-bar tooltip, deliberately not in the text — a second number next to the finding counts reads like a grade for the code, but the score measures review confidence). | §6 |
| A7 | **pro-direct is no longer fatal:** on the `pro-direct` route the Pro draft *is* the entire review, so any Pro failure killed the job. The draft-reviewer now falls back to the Flash cascade (draft + blind verification) and records `pro_api_error`. A complexity-routed diff degrades to a verified Flash review instead of a failed PR check. | D10, §8 |

### 12.2 Apply-contract amendment (2026-09-16)

The local auto-fix apply contract was originally decision **D5 of the CLI/IDE spec** that this file superseded on 2026-07-12 ("exact match or refuse": `exactQuote` had to equal the **entire** anchored range `[line, endLine]`). Code comments and the ROADMAP kept pointing at "SPEC.md D5" although today's D5 is the model decision above — this section is the contract's home from now on. The live run of 2026-09-02 (ROADMAP §3, CLI Auto-Fixing (a)) showed the old rule to be structurally unsatisfiable: the reviewer prompt caps `exact_quote` at 2 lines while findings may span more, so every finding with a range longer than its quote was skipped as "anchor mismatch".

| # | Change | Amends |
|---|--------|--------|
| A10 | **Apply contract = Prefix-Verify (option (a) of the ROADMAP mini-interview).** Both apply engines — CLI `packages/shared/src/node/fix-apply.ts: verifyAnchor` (canonical) and the extension's documented duplicate `packages/vscode-extension/src/matching.ts: verifyAnchor` — accept a fix iff **(1)** the full range `[line, endLine]` lies inside the file (otherwise `out-of-range`), **(2)** the LF-normalized `exactQuote` is non-empty (an empty quote verifies nothing → `drifted`), and **(3)** the quote matches **character-exact the first N lines of the range**, N = the quote's line count (a quote with more lines than the range cannot be its prefix → `drifted`). On `match` the `fixedCodeSnippet` still replaces the **full** range `[line, endLine]`. Still no fuzzy matching, no relocation, no whitespace tolerance. **Accepted residual risk:** range lines beyond the quoted prefix are replaced unverified — drift there is invisible to the engines (pinned by a test so a later tightening is a deliberate contract change). Rejected alternative (b): keep strict equality and require the quote to cover the whole range at prompt level — that loosens the 2-line quote cap and changes finding ids (sha over `exactQuote`, MCP_SPEC §4.2). A parity test (`matching.test.ts`) forces both copies to answer identically; it also aligned a pre-existing difference (the extension counted a phantom empty line after a trailing newline — file semantics now, like the shared engine). | former CLI/IDE-spec D5, ROADMAP §1i/§1j |

### 12.3 Model-capacity amendment (2026-09-16)

F5 pass, job `e49caffe`: one Vertex `429 RESOURCE_EXHAUSTED` on the Flash draft call killed the job. No layer retried (the SDK only retries when `httpOptions.retryOptions` is set, and then its final error loses the HTTP status), and every job error reached clients as `server_error` — the user read it as a broken repository connection.

| # | Change | Amends |
|---|--------|--------|
| A11 | **Transient model errors are retried with backoff, and exhausted capacity has its own client code.** `src/lib/pipeline/vertex-retry.ts: runWithTransientRetry` wraps every cascade LLM call (the shared reviewer pass for draft/pro-direct/second opinion in `reviewer-call.ts`, and the verdict calls in `claim-verification.ts: runVerdictCallWithRetry`). Detection is structural (`name === 'ApiError'` + status 429/500/502/503/504, directly or one level down as `cause`, because `VerdictCallError` wraps it) — not `instanceof`, which a CJS/ESM double bundle would silently break. The retries are independent of the existing parse retry, so a 429 never uses up the degeneration retry, and once the backoff is exhausted the verifier's immediate retry does not fire. The final failure is a `ModelUnavailableError`; the worker persists it as `error_message = '[model_unavailable] <detail>'` (`src/lib/job-failure.ts`), the poll route returns only the code (`model_unavailable` vs `server_error`, prefix check at string start), and the GitHub check says "AI model temporarily unavailable — re-run this check" instead of "internal error". Rejected for now: a Flash→Pro fallback for the draft (a second capacity pool, but spends Pro budget and cost on every capacity dip; product decision, ROADMAP §6). | §8, D10, A7 |
