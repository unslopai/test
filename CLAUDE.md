# 🛡️ Anti-AI-Slop Gatekeeper

## Architectural constraints (read first, non-negotiable)

THE LAW lives in `@.agents/rules/rules-unslop.md` — VERTEX-001, ASYNC-001, SEC-001/002, ARCH-001/002, MAINT-001, DATA-001, INFRA-001, DOC-001, plus the Next.js/React anti-pattern list (no generic names like `data`/`result`, cognitive complexity ≤ 15, methods < 50 lines, no blind `use client`, no `any`/`@ts-ignore`).

**The rules apply to test code too.** A test that violates THE LAW is still slop.

`AGENTS.md` holds only the generated Next.js framework notice — it is NOT the rules file.

## Infrastructure (the two things that trip up every new session)

**Supabase is REMOTE. There is no local stack.** Never suggest `supabase start`, `supabase db reset`, Docker, or `localhost:54322`. One database, project ref **`ypjgdqkrsnetiiosspix`**.
- Query it with the Supabase MCP: `execute_sql`. Apply schema changes with `apply_migration`, not the CLI.
- **Der Supabase-Management-Bug ist seit 2026-09-29 behoben.** Ursache war die alte Org: ein frisches Projekt darin war sofort „Unhealthy“, eines in einer neuen Org sofort „Healthy“. Das Prod-Projekt wurde per Project Transfer in eine neue Org verschoben (Anzeigename wieder „unslopai Org“); Ref, URL, Keys und Daten sind unverändert. Danach antworten `execute_sql` und `list_migrations` wieder. Ticket SU-457471 kann geschlossen werden. Falls MCP-Tools erneut mit `-32600 You do not have permission` scheitern: zuerst prüfen, in welcher Org das Projekt liegt und für welche Org der OAuth-Grant gilt.
- **Zweiter Lesepfad**: `npx tsx scripts/db-query.ts <table> [--columns …] [--eq col=val] [--order col.desc] [--limit n] [--count]` — echter Service-Role-Read über den App-Pfad (INFRA-002-konform), nützlich als Gegenprobe zum MCP.
- `supabase/migrations/` is history, not truth. Verify live schema via MCP (bzw. db-query.ts) before relying on it. In `list_migrations` fehlen **043–045, 047 und 048** (liefen während des Bugs über den SQL-Editor); 042 steht dort als `fix_public_explanation_column_comment`, 046 als `prescan_metadata_config_engine_v4`, 049 unter seinem Dateinamen, 050/051 (2026-09-29) als `restrict_repositories_columns_for_authenticated` / `drop_tenant_blind_match_code_chunks`.

**Broken tooling is a STOP, not a finding (INFRA-002).** If MCP calls fail, hang, or return empty results for data that should exist: **tell the user and ask them to reconnect via `/mcp`, then wait.** Never turn a tool outage into a conclusion about the product — *"I couldn't query it"* does **not** mean *"it doesn't exist"* or *"it's unverified"*. Never quietly work around it by guessing or reconstructing live state from migration files. If something is unchecked because tooling failed, label it **"blocked: tooling"** — never disguise it as a negative result. This exact mistake already produced a false audit finding once (empty MCP → "GitHub App not E2E-verified"), when in fact everything was working.

**Vertex regions are split on purpose.** Draft and escalation (`gemini-3.8-flash`, separated only by the cascade *role*: thinking level + a 150 s call deadline for escalation) and the verifier (`gemini-3.6-flash`) run on the `eu` multi-region with explicit caches — draft and escalation share one cache key; the 2.5 legacy switch uses `europe-west3`; `gemini-3.1-pro-preview` exists *only* on the `global` endpoint, hence the third client in `vertex.ts` — since 2026-09-17 it is the escalation rollback path (`UNSLOP_ESCALATION_LEGACY_PRO`), not the default. Model IDs belong in `src/lib/pipeline/models.ts` and nowhere else.

## Commands
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Tests: `npm test` (vitest, 1524 tests — 1500 passing + 24 skipped as of 2026-09-30 — across root + all packages incl. `packages/prescan`, `packages/cli`, `packages/vscode-extension`)

## Current state & where to look

`@ROADMAP.md` is the **source of truth** for what is built vs. outstanding. Read it before proposing work — do not infer project state from the code alone, and do not trust a spec's own status line over the ROADMAP. Since 2026-09-17 it is compact: a dated Done-Chronik (one line per item) plus open To-Dos only. The full history with every receipt (job/deploy IDs, measurement series, decision rationale) is frozen in `docs/ROADMAP_ARCHIVE.md` — references like "ROADMAP §3t" / "To-Do §16" in older memory notes, specs or commits mean the section numbers of that archive. New receipts go into the spec / benchmark log / commit message, not into the ROADMAP.

**All documents except `ROADMAP.md`, `CLAUDE.md`, `AGENTS.md` and `README.md` live under `docs/`** (since 2026-09-16; `docs/README.md` is the index): `docs/specs/` (all feature specs), `docs/strategy/` (model strategy, unit economics, marketing claims), `docs/benchmarks/` (rule-recall benchmark log), `docs/security/`, `docs/seo/`, `docs/research/` (papers + fetch script), `docs/company/` (Gründung, nicht produktrelevant). When a spec is mentioned by bare filename anywhere (ROADMAP, code comments, older docs), it is in `docs/specs/`.

Four core specs, all approved and substantially implemented (`docs/specs/SPEC.md` = LLM router cascade & cognitive integrity, `docs/specs/PADDLE_SPEC.md` = billing via Paddle as Merchant of Record (ersetzt seit 2026-08-08 das entfernte `STRIPE_SPEC.md`), `docs/specs/VSCODE_UX_SPEC.md` = extension state machine, `docs/specs/GITHUB_APP_SPEC.md` = native GitHub App). Their remaining gaps are tracked in the ROADMAP To-Do, not in the specs.

## Definition of Done (DOC-001)

A feature is not done when the code runs — it is done when `ROADMAP.md` reflects reality. **In the same commit as the feature:**
1. Add one line to the Done-Chronik (date, what, evidence: file, route, migration, test — not just "built") and delete the To-Do bullet. Long receipts belong in the spec / benchmark log / commit message, not in the ROADMAP.
2. Add any *new* gaps you discovered while working (missing tests, spec divergence, ship-blockers) as To-Do items. An unrecorded defect is a lost defect.
3. Never write "verified" without a receipt (a passing test, a DB row, a log line). Marking something Done unverified is how the ROADMAP drifted in the first place.
4. If code and a spec disagree, decide *which one is wrong* and fix that one. Silent divergence is forbidden.

## Working with Claude Code
- Workflow: **interview → write/extend the spec → get approval → then code.** Do not jump to implementation on a non-trivial feature.
- Use subagents to research `src/` when scope is unclear — it is a large codebase.
- Verify with tests or by exercising the real path; state plainly when something is unverified.
- Follow the Judge Pattern strictly: never emit slop yourself.
