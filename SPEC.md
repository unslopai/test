# SPEC: Native CLI/IDE Integration & Token-Optimized Prompt Pipeline

**Status:** Approved for implementation (interview completed 2026-07-11)
**Roadmap items:** §1 (IDE Integration & Terminal Access), §6 (Unit Economics & Prompt Compression)
**Prerequisite reading:** none — this spec is self-contained.

---

## 1. Context (current state of the codebase)

The Anti-AI-Slop Gatekeeper is a Next.js 16 App Router app (Vercel `fra1`), Supabase (`eu-central-1`), Vertex AI Gemini (`europe-west3`, `gemini-2.5-flash`, `@google/genai` SDK). Facts this spec builds on:

- **Trigger flow:** GitHub webhook → `POST /api/webhook` (`src/app/api/webhook/route.ts`) → HMAC verify against per-repo `webhook_secret` → insert `review_jobs` row (`status: pending`, `source: 'webhook'`) → `after()` runs `processReviewJob` (`src/lib/worker.ts:216`) in-process. No queue, no cron, `maxDuration = 60`.
- **Pipeline ("Judge Pattern"):** `runPipeline` (`src/lib/pipeline/runner.ts`) executes steps from `STEP_REGISTRY` (`src/lib/worker.ts:58`) sequentially over an immutable `PipelineContext`. Default order (`src/lib/pipeline/defaults.ts`): `diff-loader → rag-loader → ai-reviewer → github-reporter`.
- **Prompts:** composed at runtime by `src/lib/pipeline/prompt-builder.ts` (`buildPrompt(variant, config)`; variants `reviewer_raw | reviewer_diff | reviewer_rag | fixer`). System prompt ≈ 4.5–5.5 KB. 11 hardcoded conditions (`COND-001…011`) in `src/lib/pipeline/conditions.ts`, filtered per-PR by **Smart Context Detection** (`detectApplicableScopes`, `prompt-builder.ts:64`) based on file extensions.
- **RAG:** dual retrieval in `src/lib/rag.ts` — "THE LAW" (`golden_standards` table, global, via `match_golden_standards` RPC) and "EVIDENCE" (`code_chunks` per repo, via `match_code_chunks` RPC), both embedding-similarity top-k per diff.
- **LLM call:** `generateContent({ model, contents: userPrompt, config: { systemInstruction, responseMimeType: 'application/json' } })` in `src/lib/pipeline/steps/ai-reviewer-step.ts`. **No prompt caching, no `usageMetadata` capture, no token accounting anywhere.**
- **Findings:** `PipelineIssue` (`src/lib/pipeline/types.ts`): `rule`, `severity: 'KRITISCH'|'WARNUNG'`, `path`, `line`, `endLine`, `exactQuote`, `germanCritique`, `fixedCodeSnippet?`, `source`. Posted to GitHub as a PR review (`REQUEST_CHANGES` + inline comments with one-click ```suggestion``` blocks) by `src/lib/pipeline/steps/github-reporter-step.ts`, persisted to `review_jobs.result` JSONB by `persistJobResult` (`github-reporter-step.ts:108`).
- **Auth:** Supabase Auth + GitHub OAuth cookie sessions only. GitHub tokens AES-256-GCM encrypted in `github_tokens`. **There is no machine auth: `POST /api/worker` is currently unauthenticated** (`src/app/api/worker/route.ts`), and `GET /api/worker` / `GET /api/test` are unauthenticated health checks that burn a Gemini call.
- **Known bug:** inline review comments are not validated against diff hunks — an out-of-hunk `line` from the LLM makes GitHub reject the entire review. `DiffHunk` (`src/lib/github.ts:58`) exists but is unused.
- **Language:** prompts, critiques (`germanCritique`), and PR comments are hardcoded German. There are **no existing users**, so no migration burden.
- **UI:** dashboard shows a repo list only; nothing reads `review_jobs.result` back. Per-repo `pipeline_config` JSONB (`enabledStepIds`, `activeConditionIds`, `overrideSmartDetection`) edited via `GET|PUT /api/repos/[id]/settings`.

## 2. Decisions (from the interview, with rationale)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **CLI transport is async**: `POST /api/cli/scan` inserts a `review_jobs` row (`source: 'cli'`), kicks the pipeline via `after()`, returns `jobId`; CLI polls. | Synchronous connections die on Vercel `maxDuration`; the `review_jobs` table + `after()` dispatch already exist. |
| D2 | **Auth = per-user API keys** (new `api_keys` table, dashboard management UI, `x-api-key` header). Same mechanism locks down the open `/api/worker` hole and anchors per-key rate limiting. | Works in CI/CD out of the box; revocable; the natural rate-limit unit; precursor to Roadmap §4 (Accounts). |
| D3 | **CLI scans the local git diff vs the merge-base with the default branch, connected repos only.** Repo resolved via `git remote origin` → must match an active `repositories` row. Diff is uploaded in the job payload; a new `cli-diff-loader` step replaces `diff-loader`; everything downstream is untouched. | The product's value is Law + Evidence; unconnected repos would degrade it to a generic LLM wrapper and force nullable `repository_id` through the pipeline. Connected-only also drives SaaS adoption. |
| D4 | **Auto-fix reuses the existing `fixedCodeSnippet`**; the IDE applies it locally only when the human clicks Approve. No second "Fixer" LLM stage. | UX parity with the GitHub one-click suggestion block; a multi-stage fixer would double LLM calls, against Roadmap §6. The Judge Pattern's human-in-the-loop gate is the approval click. |
| D5 | **Apply contract: exact match or refuse.** Before applying, the extension verifies `exactQuote` still matches at `[line, endLine]`. Mismatch → finding marked stale, greyed out, re-scan offered. Never fuzzy-apply. | Developer trust: no silent code corruption. Simplest to implement; no extra tokens. |
| D6 | **Compression is layered: measure → cache → trim.** No runtime LLM compressor and no pseudo-language rewriting of dynamic content. | A runtime compressor risks corrupting the `exactQuote` string-matching contract and adds latency + its own token cost. |
| D7 | **Cache shape: stable per-repo prefix.** All of a repo's enabled conditions are always in the system prompt (Smart Context Detection moves to a post-filter on findings). Per-diff variance (Evidence, diff) goes last. | Gemini implicit caching needs a byte-identical prefix above a minimum token count (~1K); the current prompt is both too small and deliberately variable. Cached tokens are heavily discounted, so a larger stable prefix wins economically. Zero cache-lifecycle infrastructure. |
| D8 | **The full Law moves into the static prefix.** `rag-loader` stops retrieving golden standards and retrieves only per-diff Evidence (`code_chunks`). | 100% rule recall (similarity search misses subtle anti-patterns), and the Law is global — rendered deterministically it is byte-identical across scans, feeding the implicit cache. |
| D9 | **English pivot.** `germanCritique` → `critique` (JSON: `german_critique` → `critique`), prompts and PR/CLI output switch to English, severities `KRITISCH|WARNUNG` → `CRITICAL|WARNING`. No `outputLanguage` config this iteration. | No existing users; international B2B tool; keeps new public surfaces (CLI output, IDE diagnostics) clean from day one. |
| D10 | **CI gating: configurable threshold**, `--fail-on` default `critical`. Exit codes: `0` clean/below threshold, `1` findings at/above threshold, `2` infrastructure/auth error. | Matches how eslint/tsc gates are operated; CI can distinguish "slop found" from "scan broke". |
| D11 | **Packaging: npm workspaces monorepo** — Next.js app stays at repo root; add `packages/cli`, `packages/vscode-extension`, `packages/shared` (finding types, severity enum, API client). **Extension shells out to the CLI** (`unslop scan --json`); apply-fix is the only extension-native logic. | One implementation of git/merge-base/repo-resolution/polling; one atomic PR can change the contract for server + both clients. |
| D12 | **Telemetry: token columns on `review_jobs`** (`prompt_tokens`, `cached_tokens`, `output_tokens`, `model`) captured from `usageMetadata` on every call. **Verification: golden replay set** (~10 real diffs) asserting findings parity AND cost delta before/after. | Proves the 70% goal and catches quality regression in the same script. |

## 3. Architecture

### 3.1 New request flow (CLI/IDE)

```
VS Code ext ──spawn──> unslop CLI ──HTTPS──> POST /api/cli/scan ──insert──> review_jobs (source: 'cli')
                        │                        └─ after() ──> processReviewJob
                        └──poll──> GET /api/cli/scan/[jobId] <──read── review_jobs.status/result
```

Pipelines per source (worker selects by `review_jobs.source`):

- `webhook`: `diff-loader → rag-loader → ai-reviewer → github-reporter → result-persister`
- `cli`:     `cli-diff-loader → rag-loader → ai-reviewer → result-persister`

`persistJobResult` moves out of `github-reporter-step.ts` into a new `result-persister-step.ts` so CLI jobs persist without touching GitHub. `VALID_STEP_IDS` in `src/app/api/repos/[id]/settings/route.ts` gains the new ids; `cli-diff-loader` and `result-persister` are not user-toggleable (required, like `diff-loader`/`ai-reviewer` today).

### 3.2 Database migrations

**`015_api_keys.sql`**

```sql
create table api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  key_hash      text not null unique,          -- sha256 hex of the full key
  key_prefix    text not null,                 -- first 12 chars, display only
  label         text not null,
  last_used_at  timestamptz,
  window_started_at     timestamptz,           -- fixed-window rate limiting
  window_request_count  integer not null default 0,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index api_keys_user_id_idx on api_keys(user_id);
alter table api_keys enable row level security;  -- service-role access only, like review_jobs
```

**`016_review_jobs_token_telemetry.sql`**

```sql
alter table review_jobs
  add column prompt_tokens  integer,
  add column cached_tokens  integer,
  add column output_tokens  integer,
  add column model          text;
```

No back-compat concern for the severity rename: nothing reads old `review_jobs.result` blobs (the dashboard has no results UI).

### 3.3 API key mechanics

- **Format:** `usk_` + 43 chars base64url (32 random bytes). Shown once at creation.
- **Storage:** SHA-256 hex in `key_hash`; `key_prefix` = first 12 chars for the dashboard list.
- **Verification helper** `src/lib/api-keys.ts` → `resolveApiKey(request): Promise<{ userId, keyId } | null>`: reads `x-api-key` header, hashes, selects **explicit columns** (`id, user_id, revoked_at, window_started_at, window_request_count`) from `api_keys`, rejects revoked. Updates `last_used_at` fire-and-forget.
- **Rate limiting** (fixed window, in Postgres, serverless-safe): limit `CLI_SCAN_RATE_LIMIT` (env, default 30 scans/hour/key). On each `POST /api/cli/scan`: if `window_started_at` older than 1h, reset window via conditional `UPDATE … SET window_started_at = now(), window_request_count = 1 WHERE id = … AND window_started_at < now() - interval '1 hour'`; else increment. Over limit → `429` with `Retry-After`. Polling `GET` is not rate-limited (cheap read).
- **Management UI:** new section in the dashboard (new route `/dashboard/settings/keys`, English strings) — create (modal shows full key once), list (`key_prefix`, `label`, `last_used_at`), revoke. Backed by cookie-session routes `GET|POST /api/keys` and `DELETE /api/keys/[id]`, both filtering `.eq('user_id', user.id)`.
- **Lockdown of existing holes (same change):** `POST /api/worker` requires header `x-internal-secret === process.env.WORKER_INTERNAL_SECRET` (401 otherwise). `GET /api/worker` and `GET /api/test` drop their live Gemini calls (Supabase check only) and require the same secret.

### 3.4 New API routes

**`POST /api/cli/scan`** (`src/app/api/cli/scan/route.ts`, `maxDuration = 60`)

Request:
```jsonc
{
  "repoFullName": "acme/webapp",      // from git remote origin
  "baseSha": "<merge-base sha>",
  "headSha": "<HEAD sha>",            // informational
  "dirty": true,                      // uncommitted changes included
  "diff": "<unified diff, LF-normalized, max 300 KB>"
}
```

Behavior:
1. `resolveApiKey` → 401 if invalid/revoked; rate-limit check → 429.
2. Resolve repository: select `id, user_id, status, pipeline_config` from `repositories` where `full_name = repoFullName` **and** `user_id = keyUserId`; require `status = 'active'` → else `404 { error: "repository_not_connected" }`.
3. Validate diff: non-empty, ≤ 300 KB, parses as unified diff → else `422`.
4. Insert `review_jobs`: `repository_id`, `source: 'cli'`, `status: 'pending'`, `payload: { diff, baseSha, headSha, dirty }`.
5. `after(() => processReviewJob(job.id, repo.user_id))`; respond `202 { jobId }`.

**`GET /api/cli/scan/[jobId]`** (`src/app/api/cli/scan/[jobId]/route.ts`)

1. `resolveApiKey`; select `id, status, result, error_message, repository_id, updated_at` from `review_jobs`; verify the job's repository belongs to the key's user (explicit second select on `repositories` by `id` + `user_id`) → else 404.
2. **Stale-job detection:** if `status = 'processing'` and `updated_at` older than 5 minutes, respond `status: 'error'`, `error: 'job_stalled'` (the serverless invocation died; there is no retry infrastructure — surfacing beats hanging).
3. Respond `{ status, result?, error? }` where `result` is the shared `ScanResult` type (§3.7).

### 3.5 Pipeline changes

**`src/lib/pipeline/diff-utils.ts` (new, shared):** a deterministic unified-diff parser producing `ParsedDiffFile { path, status, hunks: DiffHunk[] }` with per-hunk new-file line ranges. Consumed by:
- `cli-diff-loader` (parse the uploaded diff),
- `github-reporter` (**bug fix**: validate every inline comment's `line`/`start_line` falls inside a hunk of that file; out-of-hunk findings are dropped from inline comments but kept in the summary body — the whole review no longer gets rejected by GitHub),
- the trimmer (§4.3).

**`src/lib/pipeline/steps/cli-diff-loader-step.ts` (new):** reads `payload.diff`, parses via `diff-utils`, applies the existing `isReviewableFile` filter (`helpers.ts:54`), rebuilds `combinedDiff` in the exact `=== FILE: <name> (<status>) ===` format the prompts expect, populates `promptConfig.filePaths`, aborts with a clear message if nothing reviewable remains. No GitHub calls.

**`src/lib/pipeline/steps/result-persister-step.ts` (new):** the relocated `persistJobResult` plus token telemetry — writes `status='done'`, `result`, `prompt_tokens`, `cached_tokens`, `output_tokens`, `model` (values placed on `PipelineContext` by `ai-reviewer`).

**`src/lib/pipeline/steps/ai-reviewer-step.ts`:** after `generateContent`, read `response.usageMetadata` (`promptTokenCount`, `cachedContentTokenCount`, `candidatesTokenCount`) into the context. Prompt variant selection unchanged (`reviewer_rag` when Evidence was retrieved).

**Smart Context Detection → post-filter:** `detectApplicableScopes`/`filterConditionsByScope` no longer shape the prompt. New `filterIssuesByScope(issues, conditionRegistry)` runs in `ai-reviewer` after `convertToPipelineIssues`: for issues whose `rule` matches `COND-\d+`, drop the issue if the condition's `scopes` don't overlap the scopes detected from the issue's `path` extension. Issues with non-`COND` rules (Law rules) pass through. `overrideSmartDetection: true` disables the post-filter (same semantics as today). The output-format prompt block instructs the model to cite the condition id (e.g. `COND-007`) in `rule` — it already receives ids in the conditions block.

### 3.6 Prompt & cache restructure (see §4)

### 3.7 Shared contract (`packages/shared`)

```ts
export type Severity = 'CRITICAL' | 'WARNING';

export interface ScanIssue {
  rule: string;            // 'COND-007' | 'GS-012' | free-form
  severity: Severity;
  path: string;
  line: number;
  endLine: number;
  exactQuote: string;      // verbatim added-line content, LF-normalized
  critique: string;        // English (renamed from germanCritique)
  fixedCodeSnippet?: string;
}

export interface ScanResult {
  hasSlop: boolean;
  issues: ScanIssue[];
  summary: string;
  filesReviewed: string[];
}

export type JobStatus = 'pending' | 'processing' | 'done' | 'error';
```

Plus `createGatekeeperClient({ baseUrl, apiKey })` wrapping `POST /api/cli/scan` + polling with backoff. `src/lib/pipeline/types.ts` re-exports these so server and clients share one source of truth. The English pivot renames flow through `prompt-builder.ts` (all four variants + `OUTPUT_FORMAT_*`), `ai-reviewer-step.ts` (`LlmDiffIssue.german_critique` → `critique`), `helpers.ts` (`formatReviewSummary`, `buildInlineComments`), and `github-reporter-step.ts` (English review bodies).

### 3.8 CLI (`packages/cli`, binary name `unslop`)

TypeScript, Node ≥ 20, published to npm, `npx @unslop/cli`-able.

- **`unslop login`** — prompts for API key (+ optional backend URL), stores in `~/.config/unslop/config.json` (0600). Env `UNSLOP_API_KEY` / `UNSLOP_BASE_URL` override the file (CI path — no login step needed).
- **`unslop scan [--json] [--fail-on critical|warning|none] [--base <ref>] [--timeout <seconds>]`**
  1. Verify cwd is a git work tree; read `origin` remote URL → normalize to `owner/name` (SSH and HTTPS forms).
  2. Determine base: `--base` if given, else merge-base of `HEAD` and `origin/<default branch>` (default branch via `git symbolic-ref refs/remotes/origin/HEAD`, falling back to `main`).
  3. `git diff <merge-base>` — tracked changes including uncommitted edits. **Untracked files are not scanned** (documented limitation; `git add -N` is the workaround).
  4. Normalize CRLF → LF; enforce the 300 KB cap client-side with a clear error.
  5. `POST /api/cli/scan`; poll every 2 s (backoff to 5 s) until `done`/`error` or `--timeout` (default 120 s).
  6. Output: human format (findings grouped by file, severity-colored, critique + fix snippet) or `--json` (verbatim `ScanResult` — the stable contract the extension and CI consume).
  7. Exit codes per D10: `0` / `1` (any issue with severity ≥ `--fail-on`, default `critical`) / `2` (auth failure, network, timeout, unconnected repo, git errors).

### 3.9 VS Code extension (`packages/vscode-extension`)

Minimal surface per D11; **no scan-on-save**.

- **Command `Unslop: Scan Current Changes`** — locates the CLI (setting `unslop.cliPath`, else `PATH`; if missing, offers `npm i -g @unslop/cli`), spawns `unslop scan --json` with `UNSLOP_API_KEY`/`UNSLOP_BASE_URL` from extension settings, parses `ScanResult`.
- **Diagnostics:** one `DiagnosticCollection`; per issue → range `[line, endLine]`, `CRITICAL` → Error, `WARNING` → Warning, message = `critique`, code = `rule`, source = `unslop`.
- **Code action `Apply Gatekeeper Fix (Approved)`** on findings that carry `fixedCodeSnippet` — this click *is* the human-in-the-loop approval (D4). Apply contract (D5):
  1. Read the current buffer text at `[line, endLine]`.
  2. Compare to `exactQuote` after LF-normalizing both. **Exact string equality only.**
  3. Match → `WorkspaceEdit` replacing that range with `fixedCodeSnippet`; remove the diagnostic.
  4. Mismatch → mark the diagnostic stale (append `[stale — code changed since scan]`, downgrade to Hint), show a notification with a **Re-scan** button. Never search, never fuzzy-match, never apply.
- The extension never talks HTTP itself and contains no git logic.

## 4. Prompt compression & unit economics

### 4.1 Layer 1 — Measure (ships first, before any optimization)

Capture `usageMetadata` on every Gemini call into the new `review_jobs` columns (§3.2, §3.5). This creates the baseline; the 70% claim is measured against it, not against guesses.

### 4.2 Layer 2 — Cache-optimal payload shape

Gemini implicit caching discounts tokens when a request shares a **byte-identical prefix** with a recent request, above a minimum prefix size (~1K tokens for flash-class models). Restructure so everything static-per-repo forms the prefix:

**System instruction (static per repo — the cacheable prefix):**
1. Persona block (English).
2. **All** enabled conditions for the repo (`pipeline_config.activeConditionIds`), categorized, always included (D7 — no per-PR scope filtering).
3. **The full Law** (D8): every `golden_standards` row rendered by a new `renderLawBlock()` in `prompt-builder.ts` — select explicit columns (`rule_id, category, title, content, code_example_bad, code_example_good`), **order by `rule_id`**, fixed template. Determinism is the contract: same table state ⇒ same bytes. Loaded once per job (single query); rendering must not include timestamps or any per-job value.
4. Output-format block (English, includes the `rule`-id citation instruction from §3.5).

**User contents (dynamic tail):** per-diff Evidence from `match_code_chunks` (Law retrieval in `src/lib/rag.ts` is deleted; `match_golden_standards` RPC becomes unused — drop in a later migration once the replay rig confirms), then the combined diff, in that order (most-volatile last).

**Cache-busting to watch for (documented in code):** changing repo settings, editing `golden_standards`, or editing condition/prompt text invalidates the prefix — expected and fine (one full-price scan re-warms it). The size guard: `renderLawBlock` logs a warning above 50K rendered characters; if the standards table grows past a few hundred rules, revisit with a curation pass (explicitly out of scope now).

**Empirical finding (2026-07-11, Phase 1):** Vertex implicit caching on this project/region requires a prefix of roughly ≥ 2,048 tokens and 1–2 warm-up requests before hits appear. A synthetic probe with a 2,730-token identical prefix reached 74% cached tokens on the third request; the current production prefix (~1,750 tokens with the dev `golden_standards` table at only 2.5 KB) stays below the threshold and gets 0% — expected to cross it as the Law grows. If the Law stays small long-term, revisit explicit `cachedContent` (D7's rejected alternative) instead of padding the prompt.

### 4.3 Layer 3 — Deterministic diff trimming (no LLM in the loop)

Applied identically in `diff-loader` and `cli-diff-loader` via `diff-utils`:

- Keep the existing non-reviewable-file filter (lockfiles, node_modules, non-JS/TS).
- Strip diff metadata noise (`index …`, `similarity …` lines).
- Cap context lines at ±3 per hunk (GitHub patches already comply; CLI diffs are generated with `-U3`).
- Per-file patch cap 40 KB, whole-diff cap 300 KB — oversized files are replaced by a `[file omitted: too large]` marker and listed in the summary as unreviewed.
- **Invariant: added (`+`) line content is never altered.** `exactQuote` must match both what the model saw and what sits in the user's file — trimming may only drop whole lines/files, never rewrite them. This is why there is no runtime LLM compressor (D6).

### 4.4 Success criteria

Measured by the golden replay rig (§6.3) on the same 10 diffs, same repo, sequential runs:

- Run 2..n show `cached_tokens > 0` and effective input cost (uncached tokens at full rate + cached at the discounted rate) reduced **≥ 60%** vs the pre-change baseline; stretch 70%.
- Findings parity: same set of (rule, path) pairs ± documented deltas; no expected finding lost.

## 5. Constraints (apply to all code in this spec)

- Architectural rules from `AGENTS.md`/`CLAUDE.md`: no generic variable names, cyclomatic complexity ≤ 15, no blind `use client`, explicit column selects, every `review_jobs`/`code_chunks` query filtered by `repository_id` (and user-facing queries by `user_id`).
- Judge Pattern intact: the judge's only code output remains `fixedCodeSnippet` (already the case today via GitHub suggestion blocks); application is always human-gated (GitHub click or IDE Approve).
- New user-facing strings are English (D9). Existing German dashboard strings are out of scope for this change (tracked separately).
- Steps stay pure per the runner contract: spread-copy the context, never mutate; abort via `shouldAbort`.

## 6. End-to-end verification

### 6.1 Static & build
1. `npm run lint` and `npm run build` pass at the root; `npm run build --workspaces` builds `shared`, `cli`, and the extension (`vsce package` dry-run).
2. Both new migrations apply cleanly to a fresh Supabase instance (`supabase db reset`).

### 6.2 Security & rate limiting
3. `POST /api/worker` and `GET /api/test` without `x-internal-secret` → 401; with it → 200 and **no Gemini call** in the health path.
4. `POST /api/cli/scan` with no/invalid/revoked key → 401. With a valid key on a repo owned by a *different* user → 404. `GET /api/cli/scan/[jobId]` for another user's job → 404.
5. Issue 31 scans in an hour with `CLI_SCAN_RATE_LIMIT=30` → the 31st returns 429 with `Retry-After`.

### 6.3 Golden replay rig (`scripts/replay-golden-diffs.ts`, run via `npx tsx`)
6. Fixtures: `fixtures/golden-diffs/*.diff` (~10 real diffs incl. at least: empty-catch slop, `any`-capitulation, a clean diff, a React-scoped violation in a non-React file — to prove the post-filter, and one > 40 KB file — to prove trimming) plus `expected.json` (rule+path pairs per diff).
7. **Baseline capture:** run the rig on the pre-change commit; record per-diff `prompt_tokens`/`output_tokens` and findings.
8. **Post-change run:** assert (a) findings parity vs `expected.json`, (b) `cached_tokens > 0` from the second diff onward, (c) effective-cost reduction ≥ 60% (script prints a per-diff and aggregate cost table using current gemini-2.5-flash pricing constants).

### 6.4 CLI end-to-end (against a connected test repo)
9. `unslop login` with a fresh key from the new dashboard UI; key file created with 0600.
10. Introduce a critical slop change (empty `catch {}`), run `unslop scan` → CRITICAL finding with English critique and `fixedCodeSnippet`, **exit 1**; `--fail-on none` → exit 0; `--json` output validates against the `ScanResult` type.
11. Clean working tree vs merge-base → "no reviewable changes"/no findings, **exit 0**.
12. Wrong API key → exit 2; repo without a `repositories` row → exit 2 with `repository_not_connected`; kill the backend mid-poll → timeout → exit 2. On Windows: repeat step 10 in a CRLF checkout — `exactQuote` values still match the LF-normalized buffer.

### 6.5 Webhook regression (must not regress while sharing code)
13. Open a real PR with slop on the test repo → `REQUEST_CHANGES` review posted, inline comments render as ```suggestion``` blocks, all in English.
14. Force an out-of-hunk finding (fixture prompt or stub) → review still posts; the finding appears in the summary body only (bug-fix path from §3.5).

### 6.6 Extension
15. F5 extension dev host → run *Scan Current Changes* on the slop change → diagnostics appear in Problems at the right lines, CRITICAL as Error.
16. Trigger *Apply Gatekeeper Fix* → buffer updated with `fixedCodeSnippet`, diagnostic cleared.
17. Edit the flagged line first, then Apply → refused, diagnostic marked stale, Re-scan notification shown. **No edit applied.**
18. Remove the CLI from PATH → extension offers the install prompt instead of erroring opaquely.

### 6.7 Telemetry
19. After 6.4/6.5, every `review_jobs` row from those runs has non-null `prompt_tokens`, `output_tokens`, `model`; CLI rows have `source='cli'`.

## 7. Implementation order

1. **Phase 0 — Baseline & pivot:** migration 016, `usageMetadata` capture, `result-persister` split, English pivot (renames, prompts, reporter), replay rig + baseline capture. *(Baseline must exist before Phase 1 changes the prompts.)*
2. **Phase 1 — Compression:** prompt-builder restructure (stable prefix, `renderLawBlock`), rag-loader Law removal, scope post-filter, diff trimming + `diff-utils` (incl. the out-of-hunk reporter fix). Verify via 6.3, 6.5.
3. **Phase 2 — Machine auth:** migration 015, `api-keys` lib, dashboard key UI, `/api/cli/scan` + polling route, rate limiting, `/api/worker` & `/api/test` lockdown. Verify via 6.2.
4. **Phase 3 — CLI:** workspace conversion, `packages/shared`, `packages/cli`, `cli-diff-loader`. Verify via 6.4.
5. **Phase 4 — Extension:** `packages/vscode-extension`. Verify via 6.6.

Each phase lands as its own PR through the gatekeeper itself.
