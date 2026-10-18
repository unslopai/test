# Deadline Guard — review jobs finish honestly inside the function time limit

**Status: APPROVED 2026-09-26** — plan approved by the founder after strategic review by Fable 5.1; spec text reviewed by Fable 5.1 (12 fixes) and by the implementer against `main` (9 corrections, §9); the founder delegated the remaining decisions to the implementer. **Implemented 2026-09-26** (phases 1–3 on branch `feat/deadline-guard`, zero-token receipts in ROADMAP). Receipt §6.4 done 2026-09-26 (first lazy reap after the deploy: 11 stale jobs incl. `e409926e` → `error` `[review_timeout]`, 4 checks closed). Migration 048 applied by the founder 2026-09-26 (stated explicitly in the session); the `skipped_deadline` write followed as its own commit. Open: live receipt §6.3 and the first real `skipped_deadline` row.
Code references are as of commit `bc58f4a` (`main`); re-check line numbers before editing.

---

## 1. Problem

Every review job runs inside the route that received it: `src/app/api/webhook/route.ts`, `src/app/api/cli/scan/route.ts` and `src/app/api/cli/pr/review/route.ts` all call `processReviewJob` (`src/lib/worker.ts:119`) via `after()` and declare `export const maxDuration = 300` — the Vercel Hobby maximum. Vercel Pro would raise the ceiling but is *blocked: incorporation* (ROADMAP §0).

The cascade runs strictly sequentially (prescan → draft → claim verifier → targeted escalation → second opinion → scorer → reporter → persister; `defaults.ts:11-27`, CLI steps `worker.ts:76-89`). Only the escalation role has a call deadline (`ESCALATION_CALL_DEADLINE_MS = 150_000`, `src/lib/pipeline/context-cache.ts:100-104`); draft and verifier deliberately have none (`context-cache.ts:97-98`: "ohne sie gibt es keinen Review"). Nothing in the pipeline knows how much of the 300 s is left: `PipelineContext` (`src/lib/pipeline/types.ts`, built by `buildInitialContext` in `worker.ts:256`) has no start time, `runPipeline` (`src/lib/pipeline/runner.ts`) is a plain loop.

**Live incident (2026-09-26, job `e409926e`, PR unslopai/unslop#9, ~35 files):** the `gemini-3.8-flash` draft took **146 s** (`explicit_hit`); afterwards no further LLM call was recorded; Vercel killed the invocation at 300 s. The job stays `status = processing` forever, the GitHub check run stays "in progress" (it is not a required check, so merging was not blocked — but it is visibly broken). The reaper that should clean this up (`reapStaleJobs`, `src/lib/stale-jobs.ts:27`, 15-min threshold `src/lib/stale-jobs-selection.ts:13`) is never triggered on Hobby (cron not deployable, `CRON_SECRET` unset — ROADMAP §1).

Which call consumed the remaining ~150 s is **not proven**: the verifier writes its telemetry row only after a batch completes, and an escalation call started around t≈150 s would hit its own 150 s deadline at t≈300 s. Both are plausible; the design below covers both. Known 3.8 draft latency on large bundles: up to ~173 s (`docs/benchmarks/RULE_RECALL_BENCHMARK.md`).

Second gap found while analysing: **`CascadeDegradation` values are never persisted.** The persister writes `integrity_score / escalated / escalation_reason / cascade_route` and the `result` JSON (`src/lib/pipeline/steps/result-persister-step.ts:39-70`); degradations only surface as a generic sentence in the GitHub review body (`github-reporter-step.ts`). A time-based skip would be invisible in the DB.

## 2. Decisions (approved 2026-09-26)

| # | Decision | Rationale |
|---|---|---|
| D1 | **One job clock**, not per-step fixed deadlines: every route records `invocationStartedAtMs = Date.now()` at handler entry and passes it to `processReviewJob` (the `after()` callback cannot see the invocation start); `deadlineAtMs` is derived from it and carried in the pipeline context. **Every LLM call** (draft, verifier, second opinion, escalation) gets an `AbortSignal` derived from the remaining budget. | A guard that only checks *before* a step cannot stop a single hanging call. |
| D2 | `deadlineAtMs = invocationStartedAtMs + UNSLOP_JOB_BUDGET_MS` (default **300 000**) `− 30 s` reserve (scorer, reporter incl. comment fetch/upsert, persister incl. reroll lookup, check-run close) ⇒ LLM calls must end by **t = 270 s after invocation start**. Measured from the real invocation start, so no pre-worker allowance is needed. `maxDuration` stays a literal in each route (Next.js reads it statically); a unit test asserts `UNSLOP_JOB_BUDGET_MS ≤ 1000 × maxDuration` of all three routes. | Moving to Vercel Pro = raise env + three literals in one commit. |
| D3 | The escalation deadline becomes `min(150 s, remaining)` (remaining already excludes the reserve). This includes the **pro-direct draft**, which already runs under role `escalation` (`draft-reviewer-step.ts:88`). | Keeps the measured latency guard, adds the job-level cap. |
| D4 | **Skip order when time runs short:** (1) second opinion, (2) targeted escalation, (3) verifier **partially** (batches run while ≥ 40 s remain), (4) the draft is never skipped (it starts whenever `remaining > 0`). Start thresholds from measurements: second opinion ≥ 80 s remaining (measured max 72 s, `context-cache.ts:92-94`), targeted escalation ≥ 60 s, each verifier batch ≥ 40 s. Thresholds are constants next to `ESCALATION_CALL_DEADLINE_MS`, not config. | All three already have degraded paths (second-opinion, escalation-reviewer, claim-verifier steps); we reuse them. |
| D5 | **Draft deadline is a deliberate reversal** of the "draft has no deadline" rule (`context-cache.ts:97-98`, SPEC.md §8): the draft call gets `remaining` (which already excludes the reserve, D2). A draft abort ends the job as `error` with a new stable client code **`review_timeout`** ("Review timed out — re-run"). Pro-direct: on abort the existing fallback to a second, Flash draft (`draft-reviewer-step.ts:42-55`) only runs if `remaining ≥ DRAFT_FALLBACK_MIN_MS` (90 s; Flash draft Ø 27–46 s), otherwise `review_timeout`. | An honest red check with a re-run hint beats a check stuck "in progress" forever. Same pattern as A11's `model_unavailable`. |
| D6 | **Representation: `status = 'done'` + degradation, no new job status.** New `CascadeDegradation` value `'time_budget_exhausted'` and `skippedStages: ('second_opinion' \| 'escalation' \| 'verifier')[]` on the cascade state; both — and the full `degradations` list — are written into the `result` JSON as `result.degradations` / `result.skipped_stages` (snake_case like the other result keys; JSONB ⇒ **no migration**); the poll route maps them to `ScanResult.degradations` / `skippedStages`. | The job status CHECK only allows `pending \| processing \| done \| error`; SPEC §8 invariant: cascade-internal failures end `done`. Also closes the "degradations never persisted" gap. |
| D7 | **Score rules unchanged, one addition:** second opinion skipped → score normal; escalation skipped → score from verdicts (escalation-marked claims downgraded as today on budget exhaustion); verifier skipped entirely → `integrityScore = null` (as `verifier_api_error`); **verifier partially run → `integrityScore = null`** — otherwise `computeIntegrityScore` would count only the verified claims and the number would lie. The fixed 50 for UNCERTAIN is a per-claim rule and is not used for time skips. Known consequence: an opted-in score gate (`minIntegrityScore`, `check-run.ts:146-148`) does not fire on `null` — same as today's `verifier_api_error`; the summary line names the skip. | Honest score > pretty score. |
| D8 | Unverified draft CRITICALs still close the check as `failure` (same as today's `verifier_api_error`); the summary names the skip. | Accepted consistency; possible false-positive merge block is named, not hidden. |
| D9 | **Watchdog:** `processReviewJob` races `runPipeline` against a timer at `invocationStartedAtMs + budget − 15 s` (LLM calls end at −30 s; 15 s leave room for `markJobError` + token fetch + `failCheckRun` before the platform kill) that is **disarmed as soon as the reporter/persister phase starts** (flag set by the runner) — otherwise it could mark a job `error` whose review was already posted; on expiry it throws `JobTimeoutError` into the existing catch (`worker.ts:195-209` → `markJobError` + `failCheckRun`) with code `review_timeout`. A race does not stop the losing promise: the watchdog therefore also sets a **cancel flag** that `runPipeline` checks before every step, so a pipeline that outlives its watchdog never reaches the reporter (no review posted on a job already marked `error`); the timer is cleared when the pipeline settles. `ReviewTimeoutError` and `JobTimeoutError` both map to the single marker `[review_timeout]` in `job-failure.ts`. Race protection: the persister's final update and `markJobError` both add `.eq('status', 'processing')`, so whichever finishes first wins and the other is a no-op. | Covers hangs outside LLM calls (GitHub, DB). |
| D10 | **Lazy reaping instead of cron:** call `reapStaleJobs()` fire-and-forget via `after()` from the webhook route, the dashboard repo page load and the CLI poll route (`src/app/api/cli/scan/[jobId]/route.ts`). | Hobby-compatible, no `CRON_SECRET`; closes the ROADMAP §1 reaper gap without Pro. Latency = until the next webhook/dashboard/poll. **Concurrency:** the reaper's update (`stale-jobs.ts:55-65`) gets `.select('id')`; the check run is closed only if a row came back (two parallel reapers must not close it twice). **Tenancy:** `reapStaleJobs` reads all tenants with the service role — a documented exception to DATA-001 (background path, nothing returned to the triggering user). **Threshold:** `STALE_JOB_THRESHOLD_MS` (`stale-jobs-selection.ts:13`) is derived from the budget — `UNSLOP_JOB_BUDGET_MS + 60 s` (6 min on Hobby) instead of a literal, so raising the budget for Pro can never reap a live job; the CLI poll's `job_stalled` at 5 min (`[jobId]/route.ts:18`) stays. **Throttle:** the poll route is hit every 2 s per MCP client (`packages/mcp/src/tools/get-result.ts:17`), so lazy reaping runs at most once per 60 s per instance (injected clock). **Message:** the reaper writes `[review_timeout]` + its detail text and closes the check with `FAILED_CHECK_RUN_COPY.review_timeout` (today: German text without a code ⇒ clients see `server_error`, public check title "Review abgebrochen"). |
| D11 | **Scope: the worker**, therefore webhook and both CLI routes at once. | All three share `processReviewJob`. |
| D12 | Telemetry: a skipped call writes a `review_job_llm_calls` row with status **`skipped_deadline`** — requires **migration 048** (status CHECK in `021_create_review_job_llm_calls.sql:16-18` only allows `ok \| parse_error \| api_error \| skipped_budget`). **No code writes `skipped_deadline` until 048 is confirmed live** (SQL editor, management API down — ROADMAP §0); the write lands as its own follow-up commit after the constraint receipt (§6.5). Until then skips are logged and stored in `result` only; never write a row with a wrong status. An aborted call keeps writing `api_error` as today's escalation deadline does. | Honest telemetry, no constraint violation (lesson from migration 047). |
| D13 | **Budget check before side effects:** escalation and second opinion check their start threshold **before** `consumeProEscalationBudget` and before loading law block / envelope. | A time skip must never burn one of the 50 paid Pro escalations. |
| D14 | **Degradation attribution:** decided at the abort by `isTimeBudgetFailure` (`deadline.ts`): a retry refused by the budget (`CallBudgetExhaustedError`) or a deadline abort with ≤ 1 s budget left ⇒ `time_budget_exhausted` + `skippedStages`; a deadline abort with budget to spare can only be the escalation role's own 150 s bound ⇒ `pro_api_error` as today. The verifier has no own bound, so every deadline abort there is the budget. | The two causes need different fixes (Pro upgrade vs. model latency); conflating them hides both. |
| D15 | **`review_timeout` on every client surface:** CLI message, MCP error mapping (`packages/mcp/src/errors.ts`) and the VS Code extension (`stateMachine.ts`, `extension.ts`) — same treatment as `model_unavailable`. | Four surfaces share the contract; a code only the CLI knows becomes a generic error everywhere else. |

## 3. Behaviour

### 3.1 Job clock
- Each route passes `invocationStartedAtMs` (captured at handler entry) to `processReviewJob`, which computes `deadlineAtMs = invocationStartedAtMs + budget − 30 000` and puts both into the initial context (`types.ts` context + `defaults.ts`).
- Helper `remainingLlmMs(context)` (pure, injectable clock for tests) — the only place that reads the clock.
- `runPipeline` logs remaining ms before each step (one line, `[Pipeline]` prefix).

### 3.2 Call signals
- `resolveCallAbortSignal` in `context-cache.ts` becomes budget-aware: `AbortSignal.timeout(remaining)` for draft and verifier, `AbortSignal.timeout(min(ESCALATION_CALL_DEADLINE_MS, remaining))` for escalation. It has no context today, so `deadlineAtMs` travels on the envelope request (`resolvePromptEnvelope({…, deadlineAtMs})`); the signal is created per attempt at call time (`runCachedCall`/`runInlineCall`, also the recreate call in `retryAfterCacheFailure`), so a retry can never outlive the budget. Remaining ≤ 0 ⇒ verifier, second opinion and escalation are not started; the draft throws `ReviewTimeoutError` directly.
- Retry interplay: a deadline abort is already non-retryable (`isCallDeadlineFailure`, `vertex-retry.ts:118-122`, used in `claim-verification.ts:329`; `reviewer-call.ts` only retries `ReviewerParseError`). The backoff wait itself (up to 15 s server hint + 1 s jitter, `vertex-retry.ts:139-161`) is not abortable, so `runWithTransientRetry` gets a budget predicate: no retry when `delay + start threshold > remaining`. **Both** retry kinds — the A11 backoff retry and the parse retry (`reviewer-call.ts:137-150`, `claim-verification.ts:318-339`) — rerun the full call and are only started if `remaining ≥` the step's start threshold (plus the backoff delay); otherwise the call counts as aborted.

### 3.3 Stage behaviour when time runs out

| Stage | Before start | During the call | Result |
|---|---|---|---|
| Draft | always starts | abort ⇒ throw `ReviewTimeoutError` | job `error`, code `review_timeout`, check `failure` with re-run copy |
| Verifier | per batch: needs ≥ 40 s | **Today a throw from any batch escapes `verifyAllBatches` into the step catch → `degradeToUnfilteredDraft` (`claim-verifier-step.ts:71-74`) and discards all collected verdicts.** New: `verifyAllBatches` catches a deadline abort per batch, stops the loop and returns the verdicts collected so far; non-deadline errors keep today's behaviour | missing verdicts are `unverified` (existing scorer path, `integrity-scorer-step.ts:111-113`); any skipped/aborted batch ⇒ `integrityScore = null`, degradation `time_budget_exhausted`, `skippedStages += 'verifier'` |
| Second opinion | needs ≥ 80 s (checked before the Pro quota, D13) | budget abort ⇒ time skip (D14); other failures ⇒ existing api_error degradation | results as without second opinion, `skippedStages += 'second_opinion'` |
| Escalation (targeted) | needs ≥ 60 s (checked before the Pro quota, D13) | budget abort ⇒ time skip (D14); other failures ⇒ existing degradation | escalation-marked claims downgraded + annotated (as `pro_budget_exhausted`), `skippedStages += 'escalation'`. The annotation copy `DOWNGRADE_PRESENTATION.escalation_skipped` (`integrity-scorer-step.ts:173-176`, "budget or API degradation") becomes "budget, API or time-limit degradation"; SPEC.md §6 wording follows |
| Pro-direct draft | starts if `remaining > 0`; signal `min(150 s, remaining)` (role `escalation`) | abort ⇒ existing fallback to the Flash cascade (second draft) only if `remaining ≥ DRAFT_FALLBACK_MIN_MS` (90 s) | otherwise job `error` `review_timeout` |

### 3.4 Check run, review body, CLI
- `closeCheckRun` (`worker.ts:367ff`) receives the degradations; the summary gets one line: *"Reduced confidence: time budget exhausted — skipped: second opinion, escalation."* Conclusion rules (`check-run.ts`) unchanged.
- `FAILED_CHECK_RUN_COPY` (`worker.ts:409ff`) and `JobFailureCode` (`src/lib/job-failure.ts`) gain `review_timeout` (marker prefix in `error_message`, no migration): title "Review timed out", text "The review exceeded the time limit for this plan. Push a new commit or re-run to try again."
- CLI: `ScanResult` in the shared package gains `degradations`; the poll route maps them; the CLI prints the same one-line notice. `review_timeout` gets a CLI message next to `model_unavailable`, and the same mapping in MCP and the extension (D15).

## 4. File plan (implementation order)

**Phase 1 — clock, signals, timeout path, watchdog** (alone would have turned `e409926e` into an honest red check)
- `src/lib/pipeline/types.ts`, `defaults.ts` (`INITIAL_CASCADE_STATE`), `worker.ts` (`buildInitialContext`): `jobStartedAtMs`, `deadlineAtMs`; `CascadeDegradation += 'time_budget_exhausted'`; `skippedStages`.
- `src/lib/pipeline/deadline.ts` (new): budget constants, `remainingLlmMs`, thresholds incl. `DRAFT_FALLBACK_MIN_MS`, `ReviewTimeoutError`, `JobTimeoutError`.
- The three routes (`webhook`, `cli/scan`, `cli/pr/review`): capture `invocationStartedAtMs` at handler entry, pass it to `processReviewJob`.
- `src/lib/pipeline/steps/draft-reviewer-step.ts`: pro-direct fallback gated by `DRAFT_FALLBACK_MIN_MS`.
- `src/lib/pipeline/context-cache.ts`: budget-aware `resolveCallAbortSignal` (deadline via envelope request); update the comment at `:88-99`.
- `src/lib/pipeline/vertex-retry.ts`: budget predicate before a backoff retry.
- `src/lib/pipeline/runner.ts`: remaining-ms log line, cancel-flag check before each step, reporter-phase hook for the watchdog.
- `src/lib/job-failure.ts`: `review_timeout` code + marker.
- `src/lib/worker.ts`: set the clock, watchdog race, `review_timeout` copy, status guard in `markJobError`.
- `src/lib/pipeline/steps/result-persister-step.ts`: status guard `.eq('status','processing')`.

**Phase 2 — skip logic and representation**
- claim-verifier (`verifyAllBatches` returns partial verdicts on a deadline abort), second-opinion-reviewer, escalation-reviewer steps: start thresholds + `skippedStages`; parse-retry gating in `reviewer-call.ts` and `claim-verification.ts`.
- integrity-scorer step: partial verification ⇒ `null`; `escalation_skipped` copy.
- result-persister: `degradations` + `skippedStages` into `result`.
- worker `closeCheckRun` + check-run summary; github-reporter summary line.
- shared `ScanResult`, CLI poll route mapping, CLI output; `review_timeout` in MCP + extension (D15).

**Phase 3 — reaping, telemetry, docs**
- `after(() => reapStaleJobs())` in webhook route, dashboard repo page (`src/app/dashboard/repos/[id]/page.tsx` is a server component; `after()` is allowed there and does not block rendering — scans load client-side via `useScanHistory.ts`, so a reap becomes visible on the next poll), CLI poll route.
- `src/lib/stale-jobs.ts`: `.select('id')`, close the check run only for an affected row, `[review_timeout]` message + English copy; `stale-jobs-selection.ts`: threshold derived from the budget; 60-s per-instance throttle for the lazy trigger.
- `supabase/migrations/048_llm_call_status_skipped_deadline.sql` (draft, applied by the founder in the SQL editor) — the `skipped_deadline` write is a separate follow-up commit after the 048 receipt (D12).
- SPEC.md §8: new rows (deadline skip per stage, draft timeout, watchdog), invariant amended for `review_timeout`; `context-cache.ts` comment; ROADMAP: Done-Chronik line, reaper To-Do in §1 rewritten (lazy reaping), migration 048 in §0 blocked list (DOC-001).

## 5. Tests (THE LAW applies to tests)

Zero-token only (`npm test`, injected clocks and fake model ports; no Vertex calls):
- `deadline.test.ts`: remaining-time math, thresholds, budget ≤ `maxDuration` of all three routes (reads the route files' literal).
- Signal tests: draft/verifier get a budget signal; escalation gets `min(150 s, remaining)`; remaining ≤ 0 ⇒ call not started.
- Cascade degradation tests (`cascade-degradation.test.ts`): each row of §3.3 with a fake clock — second opinion skipped at 79 s remaining, escalation skipped at 59 s, verifier batch 2 of 3 skipped ⇒ score `null`, draft abort ⇒ `ReviewTimeoutError`.
- Worker tests: watchdog fires ⇒ `markJobError` with `[review_timeout]` + `failCheckRun`; watchdog disarmed once the reporter phase starts; persister-vs-watchdog race: only one final state is written.
- Verifier test: deadline abort in batch 2 of 3 keeps batch 1's verdicts (no `degradeToUnfilteredDraft`); a non-deadline error still degrades as today.
- Pro-direct test: draft abort with 100 s left ⇒ Flash fallback runs; with 60 s left ⇒ `review_timeout`.
- Reaper test: two concurrent reaps close a check run once.
- Persister test: `result.degradations` and `result.skipped_stages` present.
- Reaper trigger tests: routes schedule `reapStaleJobs` via `after()` without awaiting it.
- Regression: existing `cascade-degradation`, `models`, `worker` suites stay green.

## 6. Verification plan (receipts before "done")

1. `npm test` green, `npm run build` green (Turbopack lesson from the 3.6 migration).
2. `npm run benchmark:rules -- --prescan-only` unchanged (49/126, 0 FP) — sanity only.
3. **Live receipt (paid, founder approval required):** one PR large enough to exceed the budget (PR #9-sized diff on unslopai/test). Expected: job `done` with `result.degradations` containing `time_budget_exhausted` and non-empty `result.skipped_stages`, check run closed with the notice line — or `error` with `[review_timeout]` and a closed red check. Never `processing`.
4. Reaping receipt: a job left in `processing` > 15 min is set to `error` after the next webhook or dashboard load (`scripts/db-query.ts review_jobs`).
5. Migration 048: `select pg_get_constraintdef(oid) from pg_constraint where conname = 'review_job_llm_calls_status_check';` shows `skipped_deadline` before any code writes it.

## 7. Out of scope
- Vercel Pro / higher `maxDuration` (blocked: incorporation) — the env knob is the only preparation.
- Parallelising cascade stages or splitting a job across invocations (queue/continuation).
- Automatic re-run of timed-out jobs.
- Reducing draft latency itself (thinking level, diff chunking) — model strategy, not this spec.

## 8. Open points (resolved 2026-09-26 by the implementer)
- **Retry-delay interplay:** resolved in §3.2 — signals are created per attempt from `deadlineAtMs`; the non-abortable backoff wait is gated by a budget predicate in `runWithTransientRetry`.
- **30 s reserve:** not provable without runtime logs. The worker logs how long the post-LLM phase (reporter, persister, check close) took; the reserve is revisited with the live receipt (§6.3). If that phase alone exceeds a few seconds, raise the reserve rather than lowering thresholds.

## 9. Implementer review against `main` (2026-09-26)
Nine corrections before implementation: (1) step order in §1 (escalation runs before second opinion); (2) stale line references in `vertex-retry.ts` and `integrity-scorer-step.ts`; (3) D5 subtracted the reserve twice; (4) the watchdog race did not stop the losing pipeline — cancel flag (D9); (5) watchdog slack 5 s → 15 s (D9); (6) budget check before the Pro quota is consumed (D13); (7) degradation attribution between the job budget and the escalation's own deadline (D14); (8) `review_timeout` on MCP and the extension (D15); (9) reaper threshold derived from the budget, poll-trigger throttle, reaper message with code (D10).

Post-implementation review (independent subagent, 2026-09-26), fixed before the PR: pro-direct failures with < 90 s left keep their real code unless they were a deadline abort; a persister that finds the job no longer `processing` throws `JobAlreadyFinalizedError` and the worker leaves status and check untouched; `UNSLOP_JOB_BUDGET_MS` is clamped to `JOB_ROUTE_MAX_DURATION_MS` (test pins it to the three route literals — raising for Pro means changing the constant, the literals and the env together); every targeted-escalation batch is gated and Pro verdicts of finished batches are kept (only unreviewed claims stay marked and are downgraded); the verifier skip label no longer claims "partial". Known, not fixed here: a reaper run that flips a row to `error` but fails to close the check (GitHub error or killed invocation) leaves the check `in_progress` — ROADMAP To-Do §1.
