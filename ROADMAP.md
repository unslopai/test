# 🚀 Roadmap

Quelle der Wahrheit für den Projektstand: **was gebaut ist, was offen ist, was blockiert.** Kompakt seit 2026-09-17 — die vollständige Historie mit allen Receipts (Job-/Deploy-IDs, Messreihen, Entscheidungsbegründungen) liegt eingefroren in **`docs/ROADMAP_ARCHIVE.md`**. Verweise wie „Archiv §3t“ oder „Archiv To-Do §16“ meinen die Abschnittsnummern dort; ältere Memory-Notizen, Specs und Commits, die „ROADMAP §3t“ sagen, ebenfalls.

**Pflegeregeln (DOC-001, unverändert):** Ein Feature ist fertig, wenn es hier steht — im selben Commit. Neu ist nur die Form:
- **Done** = eine Zeile in der Chronik (Datum, was, Beleg). Ausführliche Receipts gehören in die Spec, ins Benchmark-Log oder in die Commit-Message — nicht hierher.
- **To-Do** = nur offene Punkte. Erledigtes wird gelöscht (mit Chronik-Zeile), nicht durchgestrichen. Entscheidungen, die künftige Arbeit gaten, bleiben als ein Satz stehen.
- Niemals „verifiziert“ ohne Beleg. Was wegen kaputtem Tooling ungeprüft ist, heißt **blocked: tooling**, nie „nicht vorhanden“.

---

## 📍 Stand 2026-09-17 in fünf Zeilen

- **Produkt live auf unslop.codes**: GitHub App (Check Runs, PR-Review-Kommentare), CLI `unslop scan` (`@unslopcodes/cli`, `--fix`/`--dry-run`), VS-Code-Extension (Statusbar-State-Machine, Apply-Fix), MCP-Server (5 Tools). Alle vier Flächen teilen Secret-Filter, Apply-Contract A10 und den gehosteten Pipeline-Pfad. npm/Marketplace **bewusst unpubliziert** bis Launch.
- **Pipeline**: Pre-Scanner (deterministisch, eigene Invocation, 0 Token) → Draft `gemini-3.8-flash` (eu, Explicit Cache) → Blind-Verifier `gemini-3.6-flash` (eu, Cache) → Eskalation `gemini-3.8-flash` in der Rolle `escalation` (eu, teilt den Draft-Cache, 150-s-Call-Deadline; Rollback `UNSLOP_ESCALATION_LEGACY_PRO` → `gemini-3.1-pro-preview` global) → Second-Opinion-Reviewer → Integrity-Score. Finding-Aggregation, Manifest-Validierung modell-authored Felder, Backoff-Retry auf allen Vertex-Calls.
- **Qualität gemessen**: Rule-Recall-Benchmark 125/126 combined, 0 FP (Cutover-Lauf 2026-09-16); Draft-Latenz Ø 27 s; ~$0,84/Volllauf. 119 Golden-Regeln live, 316 Reference Practices live, 100 Regeln mit kundensicherer `public_explanation` (kein Regel-Content mehr im Prompt).
- **Billing**: Paddle (MoR) implementiert + Sandbox-E2E; Pro-Cap 500 Scans / 50 Pro-Eskalationen; Operator-Gate für Pipeline-Settings. **Prod-Cutover offen** (Rechtsseiten, Live-Katalog).
- **Tests**: `npm test` 1110 passed / 21 skipped (85 Dateien) — Root + `packages/{prescan,cli,mcp,shared,vscode-extension}`.

---

## ✅ Chronik: was wann gebaut wurde

Beleg-Spalte = Test, Job-ID, Migration oder Live-Receipt. „Archiv §x“ = Abschnitt in `docs/ROADMAP_ARCHIVE.md` mit dem vollen Protokoll.

### Fundament (vor 2026-07-14, undatiert)

| Was | Beleg | Archiv |
|---|---|---|
| VS-Code-Extension + CLI im Monorepo; Apply-Fix-Quick-Action in der Extension | `packages/vscode-extension`, `packages/cli` | Impl §1, §4 |
| GitHub-PR-Auto-Fixing: 1-Klick-`suggestion`-Blöcke in PR-Kommentaren | `github-reporter-step` | Impl §1 |
| Native GitHub App: Dual-Auth, Check Runs, Installation-Lifecycle, Ownership-Proof | live unslopai/test PR #13, `source='webhook'`, Score 95 | Impl §4 |
| Cascade: Hybrid Router (Flash/Pro-Heuristik), Blind Claim Verification, Integrity-Score 0–100, Telemetrie `review_job_llm_calls` | `SPEC.md` | Impl §2 |
| RAG: pgvector, Chunking, Golden Standards, Skeleton-Ingestion | `src/lib/rag.ts` | Impl §4 |
| Billing-Grundgerüst: Quota-Gates auf `/api/cli/scan` + `/api/webhook`, Trial-Skeleton-Leak-Fix (`pending_activation`), API-Keys + CLI-Browser-Login | `entitlements.ts`, `api-keys.ts` | Impl §3 |
| Webhook-Health-Endpoints, Dashboard-Realtime (`useDashboardSync.ts`) | — | Impl §4 |

### Datierte Meilensteine

| Datum | Was | Beleg | Archiv |
|---|---|---|---|
| 2026-07-14 | Extension-Aktivierung gefixt (`onStartupFinished`) — vorher lief `activate()` nie in frischen Fenstern | F5 kalter Dev-Host | Impl §1 |
| 2026-07-14 | Webhook-Dupe-Guard D7: kein Code-Change nötig, Spec ergänzt | `webhook-delivery.test.ts` | To-Do §8 |
| 2026-07-18 | Reference Practices Phase 0–1: Migration `reference_practices`, 24/24 Quellen validiert, 13 Lizenzen belegt | Migration live, Manifest | To-Do §1 |
| 2026-07-19 | Golden Database live: 119 Regeln re-ingested (vorher lief Prod einen Monat auf 7 Seed-Regeln!) | MCP-Count 119/119 embedded | Impl §2 |
| 2026-07-19 | Phase 5: Ecosystem-Detection, gated Practice-Retrieval, Dynamic Law Filtering (`applies_to`) | 153 Tests, `prompt-stability.test.ts` | Impl §2 |
| 2026-07-19 | Reference Practices Phase 2–4: 400 extrahiert → Quality-Gate → 316 verbatim-verifiziert + embedded; RPC `match_reference_practices` | 316/316 upserted | To-Do §1 |
| 2026-07-19 | Pre-Scanner v1 (`@unslop/prescan`): regex/tree-sitter/ESLint/config/registry-Engines, Fail-Safe-Gate, eigene Lane | 230 Tests, Migrations 029–031 | Impl §1b |
| 2026-07-19 | `MODEL_EMBEDDINGS` nach `models.ts` (Model-ID-Guardrail) | 125 Tests | To-Do §1 |
| 2026-07-20 | Pre-Scanner v1.1: Short-Circuit (default off), `<already_flagged>`, Merge-Dedupe, Bypass-Guards | 247 Tests, `llm-skip-guards.test.ts` | Impl §1b |
| 2026-07-20 | Pre-Scanner-OOM A/B-bewiesen (+274 MB Modul-Load im Worker) → geparkt; Bucketing-Fix (−97 % Nodes); Runner-Memory-Log; Job-Reaper gebaut | Jobs 4e5f05f9/768c4720, `stale-jobs.test.ts` | To-Do §1 |
| 2026-07-22 | i18n EN/DE Dashboard (next-intl Cookie-Mode), CLI/Extension englisch | `catalog-parity.test.ts` | Impl §4 |
| 2026-07-22 | Landing Page `/en` + `/de` (Server Components, SEO/GEO, JSON-LD) + Copy v2 (IP-de-leaked) + Login-Restyle | 271 Tests, Chrome-Pass | Impl §4, To-Do §2 |
| 2026-08-08 | **Paddle-Billing (MoR)**: Migration `paddle_billing_accounts`, Webhook-HMAC, Cancel/Resume, Rechnungen; Stripe entfernt; Sandbox-E2E V3–V11 gegen Prod | `paddle-webhook.test.ts`, 402 `trial_quota_exhausted` live | Impl §3 |
| 2026-08-08 | Operator-Gate für Pipeline-Settings (`OPERATOR_USER_IDS`, fail-closed), De-Leak des Step-Vokabulars, Webhook-Panel-Umzug; fand live einen toten ngrok-Webhook | `operator-gate.test.ts`, V5–V8 Receipts | Impl §3 |
| 2026-08-08 | **Prompt-Caching**: Vertex Explicit Context Cache für Draft + Verifier, Migration 033, Kill-Switch; Phase B: 70 % cached, −52,3 % Input-Kosten, Integrity 98 stabil | Jobs cfe9bce9/897db0ae/83efc83a | Impl §2 |
| 2026-08-08 | Pricing-Entscheidung: Cap 500 Scans / 50 Pro-Eskalationen (Marge 72 % worst) | `plan-config.ts`, UNIT_ECONOMICS | To-Do §4 |
| 2026-08-08 | Check-Run Re-Runs (`rerequested`, zählt gegen Quota) | 8 Route-Tests, Job 9a804044 | To-Do §5 |
| 2026-08-08 | Billing-Gate-Route-Tests (51) inkl. Mutations-Receipt; Quota erst nach Validierung; Lint grün; `.env.example` | 369 Tests | To-Do §8 |
| 2026-08-08 | Ecosystem-Backfill-Fleet (`backfill-ecosystems.ts`); MCP-Spec mit 12 Amendments freigegeben | MCP-verifiziert | To-Do §1, §7 |
| 2026-08-09 | **MCP-Server Phase 1–3**: `unslop_scan/get_result/connect_repo/review_pr/resolve_finding`, Migrations 034/036/037, Comment-Map, Suppression-Ledger (append-only), `packages/shared/node`-Extraktion; V3–V7 live | 553 Tests, Pack-Receipts | Impl §1c–§1e |
| 2026-08-09 | Quota-RPCs zählen abgelehnte Versuche nicht mehr (Migration 035) | Live: Counter bleibt 48 | To-Do §7 (i) |
| 2026-08-09 | **Security-Audit** CLI/Extension/MCP + Migration 038 (Client-Grants auf 14 Tabellen + 6 RPCs entzogen); Grant-Guard- und Tenant-Scope-Tests | anon-Key: 200 `[]` → 401 | Impl §3b |
| 2026-08-09 | Extension-Settings `scope: machine` (Repo-Inhalt kann keinen Credential mehr setzen); Hook-Timeout-Fix für volle Suite | `manifest-scope.test.ts` | Impl §3c |
| 2026-08-09 | Secret-Filter für ALLE Clients (`diff-upload-guard.ts`); erste CLI-Tests | Live: exit 2, kein `review_jobs`-Row | Impl §3d |
| 2026-08-09 | Fehlermeldungen kein Leak-Kanal mehr (Poll-Route `server_error`, Check-Run-Summary generisch) | `poll-route.test.ts` Canary | Impl §3e |
| 2026-08-09 | Law-Block content-frei: `public_explanation` (Migration 039/040, 100/119 Regeln), `title`/`content` nie mehr im Prompt; modell-authored `path`/`severity` eingedämmt | 0 Leaks über 119 Regeln | Impl §3f–§3h |
| 2026-08-09 | npm-Scope `@unslopcodes` gesichert (`unslop` unscoped gehört Dritten); Publish wartet auf Launch | Pack + Clean-Install | To-Do §7 |
| 2026-08-10 | Manifest-Validierung (`rule`-Enum, `line`-Hunk-Bounds), ANSI/OSC-Sanitization CLI+Extension, Senior-Review-Nacharbeiten (9 Findings), **Slop Score Gating** (`minIntegrityScore`) | 623 Tests | Impl §3i–§3m |
| 2026-08-10 | Clean-Scan-Anomalie: `detected_ecosystems=[]` filterte auf 72 Regeln → Draft-Recall kollabierte; `[]` jetzt fail-open | Prod Job 3dd4a1df: 3 CRITICAL zurück | Impl §3k |
| 2026-08-10 | Public-Text-Deploy prod-verifiziert; A/B-Replay OLD/NEW: keine Recall-Regression, −60 % Prompt-Tokens, 18/18 auf 18-Dateien-PR | `REPLAY_AB_LAW_PROMPT.md` | Impl §3g |
| 2026-08-10 | Extension: Multi-Root-Reset, `[Initialize Git Repository]`, `[Publish to GitHub]`, `[Fetch Remote]`, Unborn-HEAD-Diagnose + `[Create Initial Commit]`, Masked-404-Explainer; 3 Extension-Test-Suiten (39 Tests); Build-Fix | F5-Pass | Impl §1f, To-Do §3, §8 |
| 2026-08-10 | Keys-UX (Aktiv/Widerrufen, Rotation beim CLI-Login); Dashboard-Connect meldet leeres Repo statt still zu failen | 675 Tests | To-Do §7 (k)(l) |
| 2026-08-23 | **Pre-Scanner entparkt**: eigene Invocation `POST /api/internal/prescan` (Worker-Peak 108 statt 785 MB); Registry-Engine HEAD statt GET (6,9-MB-Packuments); 2 FPs gefixt (else-if-Nesting, Catch-Param) | Job 12732e23, Modulgraph-grep | To-Do §1 |
| 2026-08-24 | Route-Instanz-Leck isoliert (Runs 5–14b): rein nativ, nur in der Vercel-Lambda, unabhängig von HTTP-Stack/Arenen/WASM — **Entscheidung: Pro-Upgrade + 2 GB, blocked: incorporation**; Lookup-Memo (13 statt 19 Reads) | Job 93bb692e, `prescan`-Block persistiert | To-Do §1 |
| 2026-08-24 | Nothing-Reviewed-Ehrlichkeit (`outcome: 'nothing_reviewed'` in CLI/Extension/MCP) | 75 Tests | Impl §1g |
| 2026-08-24 | **Finding-Aggregation** pro Rule+File (ein Claim, ein Verdict, ein Kommentar) | 752 Tests | Impl §1h |
| 2026-08-24 | **CLI `unslop scan --fix` / `--dry-run` / `--allow-dirty`** (atomarer Write, Exact-Match) | 785 Tests | Impl §1i |
| 2026-08-24 | Secret-Filter-Hardening: alle übertragenen Bytes + Entropie-Heuristik + Netzwerkgrenze in `submitScan` | 811 Tests, ~20 ms/276 KB | Impl §3n |
| 2026-08-24 | **Rule-Recall-Benchmark** (`npm run benchmark:rules`): 95/100 Regeln + 11 Conditions gepflanzt, 20 Bundles; Draft 110/126, 0 False Refutations; `parseModelJson`-Steuerzeichen-Bug gefixt | `RULE_RECALL_BENCHMARK.md` | Impl §3o |
| 2026-08-24 | Pre-Scanner v2 (TEST-002/005, COND-011, HAL-002) + Benchmark-Prescan-Lane + `--prescan-only` | 44/126 deterministisch, 0 FP | Impl §3p |
| 2026-08-25 | Pre-Scanner v3 (ARCH-005 Go, CONC-003 C); TEST-Explanation-Schärfung **revertiert** (Migration 043: −5 Regeln Kollateralschaden — `public_explanation` ist globaler Prompt!) | 834 Tests | Impl §3q |
| 2026-08-26 | **Second-Opinion-Eskalation** (Step `second-opinion-reviewer`, Trigger T1 Test-Gap / T2 Prescan-Divergenz), gemeinsamer `reviewer-call.ts`, Migration 044 | r17 7/7, A/B 122/126 | Impl §3r |
| 2026-08-26 | **Modell-Migration M1**: Draft+Verifier 2.5 → `gemini-3.6-flash` auf eu-Multiregion (dritter Vertex-Client, Cache zieht mit), Rollback `UNSLOP_FLASH_LEGACY_25`; Gates G1–G5 bestanden; Turbopack-Build-Bruch nebenbei gefixt | Job 21ff236e explicit_hit | To-Do §6 |
| 2026-08-26 | `vertex-pricing.ts` gegen echten SKU-Katalog gefixt (Service-Match + Modell-Familien — alle früheren Script-Kosten-Receipts waren zu niedrig); Storage-Preis verifiziert; Draft-Model-Override-Harness (3.5/3.6/3.7/Lite gemessen) | `benchmark-cost.ts` | To-Do §6 |
| 2026-08-26 | Referenzlauf 118/126; r18-Fixture-Defekt aufgeklärt; OG-Image; Marketplace-Listing-Metadaten (README, Icon) | `results/2026-08-25-full-v3-reference.json` | To-Do §16, §2, §3 |
| 2026-08-28 | Verifier-Shape-Guard: degenerierte `verdicts` werfen `parse_error` → Batch-Retry statt stiller Voll-Eskalation | `cascade-degradation.test.ts` | To-Do §6 |
| 2026-08-29 | Dashboard-Dark-Mode-Redesign (10 Tokens, Drift-Guard `token-adoption.test.ts`) | 899 Tests, Chrome EN+DE | To-Do §2 |
| 2026-08-29 | Phase-5-E2E live belegt: 3 Reference Practices im Draft-Prompt (unslopai/test#15) | Job 82339ee5, `[RagLoader]`-Log | To-Do §1 |
| 2026-08-29 | Intro-Rabatt 3.6/3.7 als 50 %-Gutschrift belegt (August-CSV) → `INTRO_DISCOUNT`; `APP_BASE_URL` live verifiziert; Landing-Render-Tests; Benchmark-Scripts eingecheckt; `pathSafety`-Parity-Test | 898 Tests | To-Do §6, §2, §3 |
| 2026-08-30 | Dashboard UX v2: Scans-Read-API, Repo-Detailseite mit Historie, `PageShell`/`ModalDialog`/`ConfirmDialog`/`Toast`, Danger Zone | 935 Tests, Prod dc8689a | To-Do §2 |
| 2026-08-31 | **Onboarding**: Checkliste auf `/dashboard` + `/dashboard/get-started`, DB-abgeleitete Häkchen, Terminal-Weg fail-closed hinter `NEXT_PUBLIC_CLI_DISTRIBUTION_LIVE` | 972 Tests, Prod ee05544 | To-Do §3 |
| 2026-08-31 | Merge-Base-Diagnose Z1–Z5 (`diagnoseMergeBaseFailure`) + `[Push Branch]`; editor-neutraler Explainer + `[Copy fix command]`; `GCM_INTERACTIVE=never` (GUI-Popup-Fix) | 13 Tests, alle 4 Zustände F5-gesichtet | To-Do §3 |
| 2026-08-31 | F5-/CLI-Pass: Multi-Root, Connect-404, Publish-Kette, Unborn-HEAD-Button, Nothing-Reviewed, Entropie-Secret-Refusal, i18n-Toggle — alle Sicht-Receipts | Extension + Binary | To-Do §3, §8, §13 |
| 2026-08-31 | „Reduced confidence (100/100)“-Paradox gefixt (zwei Downgrade-Gründe, UNCERTAIN-Copy ohne Zahl); Entscheidungen B3 (Occurrence-Nichtdeterminismus akzeptiert) + B4 (keine Statusbar/Terminal-Kopplung) | `integrity-scorer-step.test.ts` | To-Do §3 |
| 2026-09-01 | `reviewer_diff`-Prompt kannte `fixed_code_snippet` nicht — `--fix` konnte auf CLI-Pfad strukturell nie applyen; gefixt mit Benchmark-Gate 122/126, 0 FP | ce17a4f, `results/2026-09-01-*.json` | To-Do §3 |
| 2026-09-03 | Gemini-3.8-Flash-A/B (7 Läufe), Thinking-Level-Harness, **`thoughtsTokenCount` in Telemetrie** (alle Output-Kosten vorher zu niedrig) | 993 Tests, `benchmark-phase-stats.ts` | Impl §3s |
| 2026-09-16 | **Apply-Contract A10 Prefix-Verify** in beiden Engines (Quote < Range applybar); erster echter Apply live: CLI Job 0f6dbfac, Extension Job 53eb7042 | 1081 Tests, `matching.test.ts` neu | Impl §1j |
| 2026-09-16 | **Vertex-Backoff-Retry** (429/5xx, alle Cascade-Calls) + Client-Code `model_unavailable`; Entscheidung: kein Kapazitäts-Fallback, Wiedervorlage 2026-10-16 | 29 Tests, Mutations-Receipt | Impl §3t |
| 2026-09-17 | **Draft-Cutover auf `gemini-3.8-flash` (medium)**, Verifier bleibt 3.6 (gemessen), Eskalation bleibt Pro; Re-Benchmark-Policy §1f; Intro-Gutschrift 3.8 per September-CSV belegt; `fetch failed` gilt als transient | Job e9690fd0 (35,9 s), 1110 Tests | Impl §3u |
| 2026-09-17 | **Eskalations-Cutover auf `gemini-3.8-flash` (medium, eu, teilt den Draft-Cache)** — Degeneration erklärt (unescaptes `"` in zitiertem Code, `finishReason=STOP`) und per Quote-Repair in `parseModelJson` geheilt (3/3 reale Ausfälle); Request-Policy hängt an `CascadeRole` statt Modell-ID; 150-s-Call-Deadline für die Eskalations-Rolle (Abbruch nie retryt); `responseJsonSchema` gemessen und verworfen (killt `fixed_code_snippet`); Rollback `UNSLOP_ESCALATION_LEGACY_PRO` | Benchmark r20 ×2 18/18 + 17/18 (0 parse_error, Ø 38 s, `explicit_hit`, $0,039/Call ≈ −77 % vs Pro), Second Opinion 2/2 ok Ø 17 s; MODEL_STRATEGY §1h, SPEC §8, 1124 Tests. **Prod-Receipt:** Deploy `dpl_TeDyUogf` (Commit `1965da5`), CLI-Scan auf `unslopai/test` (20 Dateien, pro-direct) → Job `b1c259f1` `done`, Score 97, 16 Findings; `review_job_llm_calls`: `escalate_full` `gemini-3.8-flash` `ok`, `explicit_created`, 47,7 s, 17.468 Prompt / 4.544 cached / 9.368 Output | Impl §3v |
| 2026-09-22 | **Waitlist + E-Mail-Fundament gebaut** (`WAITLIST_SPEC.md`): Brevo statt Resend (Resend speichert alle Daten in den USA ohne EU-Option, Brevo EU-gehostet mit DOI-Endpoint); `POST /api/waitlist` (struktureller Parse, Honeypot, tagesrotierender IP-Hash-Rate-Limit 5/h, 202 auch für Duplikate = keine Enumeration), Migration `045_waitlist_signups.sql`, `WaitlistForm` (Client) + `WaitlistCta` (Server) ersetzen bei `NEXT_PUBLIC_WAITLIST_LIVE=true` die Login-CTAs in Hero und Closing-CTA, Seite `/{locale}/waitlist/confirmed`, Copy EN/DE. Brevo-Setup live: Domain `unslop.codes` authentifiziert (DKIM/DMARC/Branding bei Porkbun), Absender `noreply@unslop.codes`, Liste 4, DOI-Templates 1 (EN) / 2 (DE). **Flag bleibt aus bis HR-Eintrag** (Entscheidung Luca) | `route.test.ts` (11), `brevo.test.ts` (6), `signup-boundary.test.ts`, `landing-render.test.ts` beide Flag-Zustände; 1179 Tests, Build grün; Live-Receipt Brevo-DOI s. Spec §7 | — |
| 2026-09-24 | **Pre-Scanner v4 — Config-Engine-Lücken geschlossen** (Design §9): SEC-019 deterministisch **nur für Next-Middleware/Proxy** (frische, nicht entweichende `NextResponse`; Express/Flask nach Review 2026-09-24 in der Revision 2026-09-26 wegen FP-Fällen entfernt, Design §9.1; `next.config.*`-Begleitdatei via Worker-`companion-loader` mit 10-s-Timeout, unlesbar/unbekannt ⇒ skippedCheck), SEC-032/033/034 (eigener HCL-Reader ohne WASM-Parser + CFN/SAM YAML/JSON; Serverless-Gate, keine Condition/Principal-Statements, SEC-034 nur mit Own-Account-Kontrast), SEC-042/043 (Claude-Code-Settings: bypass+deny, bare `Bash`), `pyproject.toml` in der Registry-Engine; **MAINT-009 bewusst nicht deterministisch** (Peer-/implizite Deps, s. §7). Draft-Migration `046` für `golden_standards`-Metadaten (blocked: tooling) | `npm test` 1225/21 skipped (nach Review-Fixes 2026-09-26), `packages/prescan` 127/127 inkl. der sieben Review-FP-Fälle als Still-Tests; `--prescan-only` **49/126, 0 FP** (vorher 46); r08 SEC-019 + r12 SEC-032/033 prescan-hit; Benchmark-Log 2026-09-24 + Revision 2026-09-26 | To-Do §1, §7 |
| 2026-09-17 | **Score-Semantik bei UNCERTAIN + ehrliche Score-Tagline** (Interview-Entscheid: beides) — UNCERTAIN-Claim zählt fest 50 in Finding-`confidence` und Score (Verifier-Zahl = Konfidenz ins Verdikt, nicht in den Befund); neues Shared-Feld `verification` pro Finding (`confirmed`/`uncertain`/`self_reported`/`unverified`/`deterministic`, Pre-Scanner setzt `deterministic`); Tagline in CLI, Extension-Tooltip und GitHub-Block zählt den Status statt pauschal „every finding survived“ (auch pro-direct sagt jetzt „self-reported, no blind re-verification“); fehlender Status = `unverified` | `integrity-scorer-step.test.ts` (UNCERTAIN/100 ⇒ 83 statt 100), `verification-format.test.ts`, Extension-Parity-Test `verificationSummary.test.ts`, `format.test.ts`, `github-reporter-step.test.ts`; SPEC §6/D8/D9. **Prod-Receipt:** Deploy `dpl_29LZRibh` (Commit `4405f53`), 3 CLI-Scans aus dem Clone `fix-apply` auf `unslopai/test` (flash-cascade, 1–3 Probe-Dateien): Jobs `f9ddf009` (Score 98, 3 Claims 3× confirmed), `b36ae950` (98, 1/1), `0cf82b14` (95, 3/3) — `result.review.issues[].verification = 'confirmed'` persistiert, CLI-Tagline `Cognitive Integrity Score: 98/100 — every finding survived independent blind re-verification.` jetzt datengedeckt statt hart verdrahtet. Der UNCERTAIN-Zweig selbst blieb ohne Live-Sichtung (siehe To-Do) | SPEC §6 |

### Test-Suite über die Zeit

| Datum | Tests |
|---|---|
| 2026-07-19 | 125 (Backend) → 230 mit Pre-Scanner |
| 2026-07-22 | 271 |
| 2026-08-08 | 392 |
| 2026-08-10 | 623 / 64 Dateien |
| 2026-08-24 | 785 → 829 |
| 2026-08-26 | 894 |
| 2026-08-31 | 972 |
| 2026-09-16 | 1081 / 85 Dateien |
| 2026-09-17 | **1110 passed / 21 skipped** (der Grant-Guard gegen das Remote-Projekt skippt ohne Credentials) |
| 2026-09-17 | **1143 passed / 21 skipped** (Score-Semantik UNCERTAIN + Verifikations-Tagline: +19 Tests) |
| 2026-09-24 | **1220 passed / 21 skipped / 98 Dateien** (Pre-Scanner v4: +35 Prescan-Tests, Companion-Loader, Route/Step-Contract) |

---

## 🚀 To-Do

### 0. Blocker & Wiedervorlagen (zuerst lesen)

- **blocked: incorporation** — UG noch nicht eingetragen, kein Geschäftskonto ⇒ kein Vercel-Pro (Function-Memory, Sub-Daily-Cron), kein Paddle-Live. Betrifft: Route-Instanz-Leck (§1), Job-Reaper-Trigger (§1), Production-Cutover (§4). **Nicht „einfach upgraden“ vorschlagen.**
- **blocked: tooling** — Supabase-Management-Ebene für diesen Account kaputt seit ~2026-08-14 (Ticket **SU-457471**, Stand 2026-08-31 unbeantwortet; Eskalationspfad: GitHub Discussion). Datenebene läuft. Lesen via `scripts/db-query.ts`, Migrationen via SQL-Editor des Users. Betrifft: `golden_standards`-Backfill (§7), **Migration 047** (§5, Prod-Datenverlust).
- **Wiedervorlage 2026-10-16**: Kapazitäts-Fallback für den Flash-Draft (§5, Messregel dort).
- **Wiedervorlage nach 2026-10-20**: `gemini-2.5-flash` EOL — Rollback-Switch `UNSLOP_FLASH_LEGACY_25` + 2.5-Client/-Preise ausbauen.
- **Ship-Blocker DE-Markt**: Rechtsseiten (§2) — auch Voraussetzung für Paddle-Domain-Approval.

### 1. Pre-Scanner & Pipeline-Architektur

- **Route-Instanz-Leck** (`/api/internal/prescan`): Registry-Phase kostet +219…+530 MB native RSS nur in der Vercel-Lambda (lokal +8 MB); Vercel killt die Instanz in ~3/4 Läufen **nach** dem 200 — Produkt unbeeinträchtigt, Route aber immer kalt. Alle App-Hypothesen widerlegt (Archiv To-Do §1, Runs 5–14b). Plan: Pro-Upgrade → Standard 2 GB → Run 15 als Receipt → nur bei weiterem Kill 4 GB. Not-Aus: `registryChecks: false`. *blocked: incorporation.*
- **Job-Reaper nicht getriggert**: `/api/cron/reap-stale-jobs` ist deployed, aber der `crons`-Block ist auf Hobby nicht deploybar und `CRON_SECRET` nicht gesetzt — OOM-gekillte Jobs bleiben `processing`. Optionen: Pro-Plan, Daily-Cron, externer Scheduler. *blocked: incorporation.*
- **Payload-Obergrenze**: Vercel kappt Request-Bodies bei ~4,5 MB; `maxFileBytes` 256 KB × viele Dateien ⇒ 413 ⇒ Step degradiert sauber, Scan findet aber nicht statt. Chunking pro Datei-Batch, sobald es real auftritt.
- **Short-Circuit ohne Live-Receipt und ohne UI-Schalter**: unit-bewiesen, nie live gefeuert; nur per `pipeline_config`-JSON setzbar. Bleibt `off`, bis ein echter Short-Circuit-Job end-to-end gesehen wurde (inkl. Check-Rendering mit `integrityScore: null`).
- **`<already_flagged>`-Wirkung ungemessen**: ob der Draft deterministische Findings wirklich nicht mehr doppelt meldet, ist eine Modellfrage — Duplikatrate aus Telemetrie messen, bevor ein Token-Saving behauptet wird. Merge-Dedupe ist das Sicherheitsnetz.
- **Pre-Scanner-v4-Reste** (Design §9): *(a)* SEC-019-Companion live sehen — ein PR-Job mit Next-Middleware im Diff, `review_jobs.result.prescan.skippedChecks` ohne `companion-unavailable` und ein SEC-019-Finding bzw. dessen Unterdrückung durch `next.config.*`; *(b)* SEC-042/043 haben keine Benchmark-Fixture (bewusst, Universum 126) — Sicht-Receipt über einen Scan mit `.claude/settings.json` im Diff; *(c)* Agent-Config-Formate jenseits Claude Code (Codex `config.toml`, Gemini CLI) erst mit belegter Semantik.
- **SEC-019 für Express/Flask** (Design §9.1): 2026-09-26 entfernt, weil die Datei allein nichts beweist (Header in anderen Modulen, `lusca`, Inline-`require`, Hosting-Layer wie `vercel.json`/`_headers`/`netlify.toml`, gunicorn statt `app.run`). Zurück nur nach Test gegen echte Repositories (FP-Rate auf einem Korpus realer Express-/Flask-Apps, nicht nur Fixtures).
- **Pre-Scanner-v4-Review-Reste (LOW, Review 2026-09-24)**: *(a)* SEC-033 zählt jede High-Risk-Action als „high privilege“ — auch `iam:PassRole` auf eine einzelne Rollen-ARN mit `Condition`; die Condition-/Resource-Filter von SEC-032 auf das SEC-033-Prädikat übertragen (`iam-model.ts`). *(b)* HCL-Reader: ein unbalancierter Schließer (`foo(]`) treibt die Klammertiefe negativ und verschluckt den Rest der Datei (versteckt z. B. ein Wildcard-Statement darunter) — nur bei malformed HCL, das Terraform selbst ablehnt; Tiefe bei 0 klemmen (`hcl-reader.ts`). Stille Misses (indizierte Rollen-Refs, `templatefile()`, Heredocs mit `${}`) sind fail-safe und bleiben.
- **v2 (Design §8)**: CLI-lokaler Prescan (`StaticAnalysisAdapter`: semgrep/gitleaks/checkov), CLI-Payload für Full-File-Cloud-AST-Modus.
- **Law-Block-Slimming hinter Cache-Telemetrie**: Datenbasis (`cache_status`, `cached_tokens`) liegt seit Prompt-Caching vor, nie ausgewertet.
- **PROC-009 volle Heuristik**: 0,45-Similarity-Floor ist der v1-Proxy für den „well-known API“-Skip; telemetriegetriebene Version (`review_job_llm_calls`) ist Backlog.
- **Reference Practices, 84 gedroppte Einträge**: in `data/reference/repair_report.json` gelistet, per curl-basiertem Verbatim-Pass nachholbar. Optional, Korpus ist kohärent.
- **Scope-Filter dokumentieren**: DiffLoader lädt nur `.ts/.tsx/.js/.jsx/.mjs/.cjs` für die LLM-Lane, der Pre-Scanner alle Dateien mit Patch — erwartbar, aber nirgends erklärt (siehe auch §3 Explainability).

### 2. Dashboard & Landing

- **Rechtsseiten fehlen** (Impressum, Datenschutz, Terms, Refund-Policy): Footer verlinkt bewusst nichts. **Ship-Blocker** für DE-Markt und Paddle-Domain-Approval. `(marketing)/[locale]/` kann `/de/impressum` etc. hosten.
- **Redesign-Reste**: Sichtprüfung WebhookHealthPanel (braucht Legacy-OAuth-Repo) und Operator-Settings-Seite (lokal 404) beim nächsten Operator-/Prod-Durchlauf; `LocaleSwitcher` behält bewusst gray-Literale (außerhalb des Dashboard-Guards) — migrieren, falls `/login` je restyled wird.
- **Scans-API** liefert `issues[]` voll pro Seite (20 Jobs, spec-konform) — bei extrem findingreichen Historien Kandidat für Lazy-Detail.
- **Landing Page v2, Docs-Site, Help Center, Changelog, Vergleichsseiten**: siehe §10.

### 3. IDE-Integration (CLI, Extension, MCP-Clients)

- **CI/CD-Publishing**: GitHub Actions für `@unslopcodes/cli` (npm) und Extension (Marketplace) — es gibt kein `.github/`. Cutover-Schritt beim Publish: `NEXT_PUBLIC_CLI_DISTRIBUTION_LIVE=true` in Vercel setzen (macht den Terminal-Weg des Onboardings scharf). Publish selbst wartet auf Launch (§6).
- **Aggregation-Reste** (aus Impl §1h): *(a)* Live-E2E-Receipt für den 32-Emoji-Fall (Dauer + Ein-Kommentar-Rendering); *(b)* **Apply nur am Anker** — `consolidateGroup` erbt nur den Snippet des Anker-Vorkommens, Nicht-Anker-Snippets gehen verloren; per-occurrence Snippets bzw. „ersten Snippet mit Re-Ankerung“ = Mini-Interview; *(c)* Verifier antwortet bei teilweise zutreffendem Aggregat UNCERTAIN statt per-Vorkommen; *(d)* Problems-Panel zeigt ein Diagnostic am Anker, kein Click-Through pro Vorkommen.
- **Occurrence-Determinismus** (Entscheidung B3: bekanntes Verhalten, Verdict ist stabil): Backlog-Kandidat = Occurrences deterministisch aus `exact_quote` im Diff nachberechnen (eliminiert auch Duplikate wie „2, 2, 14-16“); Zwischenschritt wäre Client-Dedupe+Sort im Rendering.
- **Nothing-reviewed CI-Gating**: `nothing_reviewed` exit-codet 0 (konsistent mit `neutral`-Check). CI-Hardliner könnten `--fail-on nothing-reviewed` wollen — Mini-Interview.
- **Guided Repo-Setup (Rest)**: Auto-Connect zum Gatekeeper direkt nach `github.publish`; erwarteten Account in Fehlermeldungen nennen (Server kennt die Installation-Identität); Publish-Kette den Push zu Ende bringen lassen. O3-Epic, eigenes Interview. Offene Kleinentscheidung: Warnung, wenn der Ordner beim Publish gar keine Dateien hat.
- **Multi-Account-GitHub-Troubleshooting als Doku**: drei Credential-Flächen (VS-Code-Session, GCM, App) + Masked-404-Erklärung — Erstinhalt für die Docs-Site (§10), bewusst nicht in der Onboarding-UI (ONBOARDING_SPEC Entscheidung 7).
- **Explainability**: „not a reviewable file type“ wird in CLI/Extension nirgends gesagt (Dashboard-Onboarding hat den Einzeiler). Connect-Fehler 401/422-Varianten nie gesichtet (gleiche Code-Stelle wie der gesichtete 404).
- **Aktivierungskosten beim Fensteröffnen**: `probeCliAvailable()` führt `unslop --help` via `shell: true` bei jedem Fenster aus; 1–2-s-Spike einmal beobachtet (2026-07-14), nie gemessen. Kandidaten: Probe-Cache pro Session, `PATH`-Auflösung statt Ausführung. **Erst messen.**
- **Extension dupliziert die CLI-Credential-Kette** (`cliConfig.ts`) mit abweichender Präzedenz; Extension-tsconfig ignoriert `exports`-Subpaths. Jede Änderung an `packages/shared/src/node/credentials.ts` muss im Lockstep nachgezogen werden (MAINT-001-Gefahr).
- **Billing-402-Sicht-Receipts**: API-seitig belegt; fehlt der Sichtbeweis, dass das CLI-Binary die Billing-Hinweise rendert (exit 2) und die Extension in `PAUSED_BILLING` geht. Beim nächsten F5-Pass mitnehmen.

### 4. Billing & Paddle Go-Live

- **Production-Cutover**: Paddle-Live-Account verifizieren, Domain-Approval (braucht Rechtsseiten §2), Live-Katalog + Notification-Destination, **Default Payment Link setzen** (sonst `transaction_default_checkout_url_not_set`), Live-Env-Vars in Vercel, `APP_BASE_URL`. *blocked: incorporation* (Paddle-Account-Adresse muss zudem auf die Firmenadresse der Ein-Personen-UG umgestellt werden).
- **Teams & Orgs**: `billing_accounts.kind = 'team'` + Members sind im Schema vorbereitet; UI/Auth/Seats fehlen.
- **Tier-Entscheidungen offen**: €79-„Pro Max” (2.000 Scans) für Heavy User; Enterprise-Tier (UNIT_ECONOMICS §9: Voll-SOTA-Seat braucht ~€1.600 für 70 % Marge; Optionen €299/350-Scan-Seat, €249-Team-Tier, metered Overage €0,89/Scan).
- **Pricing-Page mit drei Spalten (Interview-Kandidat, angestoßen 2026-09-22 durch Luca am Brevo-Beispiel)**: ein einzelner Plan lässt nur Ja/Nein; drei Optionen verschieben die Wahl zur mittleren (Compromise Effect, Simonson 1989). Vorschlag: Pro €29 / **Pro Max €79 in der Mitte** (2.000 Scans + Frontier-Eskalation, technisch nur zweiter Paddle-Preis + `plan-config.ts`) / Enterprise auf Anfrage; Jahresumschalter „2 Monate geschenkt”; Label ehrlich („Empfohlen”/„Für Teams mit täglichen PRs”), **nicht „Am beliebtesten”** ohne Kunden (MARKETING_CLAIMS §0). Team-Tier mit Seats erst, wenn Orgs gebaut sind. Braucht Mini-Spec (PADDLE_SPEC-Amendment) nach der Waitlist.

### 5. Modelle, Cascade & Unit Economics

- **🔴 Second-Opinion-Jobs verlieren ihr Ergebnis** (entdeckt 2026-09-26): `second-opinion-reviewer-step.ts` setzt `escalation_reason = 'second_opinion'`, der Check-Constraint aus Migration 022 kennt den Wert nicht (044 erweiterte nur den `phase`-Check der Telemetrie). Der fertige, bezahlte Review scheitert beim Persistieren ⇒ Job `error`, GitHub-Check zeigt nur das deterministische Teilergebnis. Receipt: Job `82a5781a` (unslopai/unslop#9, `error_message` … `review_jobs_escalation_reason_check`), bisher einziger Fall unter den letzten 50 Error-Jobs — zugleich der erste Live-Lauf des Second-Opinion-Pfads. Fix: `supabase/migrations/047_escalation_reason_second_opinion.sql` im SQL-Editor ausführen, dann Receipt = nächster Second-Opinion-Job endet `done`. *blocked: tooling.*
- **Eskalations-Rollback-Pfad entfernen (Hygiene, ab ~2026-10-01)**: `UNSLOP_ESCALATION_LEGACY_PRO` + global-Client-Pfad in `models.ts`/`vertex.ts` ausbauen, sobald zwei Wochen Prod-Betrieb der 3.8-Eskalation ohne Deadline-Abbruch-Muster (`escalate_*` mit `api_error`, Latenz ≈ 150 s, kein HTTP-Status) vorliegen; Beobachtungsquelle `review_job_llm_calls`.
- **Eskalation `high` (18/18 ×2 auf r20) erst mit >300-s-Route**: gemessen 169 s pro Call bei 27k Thinking-Tokens — unter der 150-s-Deadline nicht fahrbar. Hebel: Vercel Pro (Fluid Compute 800 s; Account ist Hobby, MCP-Receipt 2026-09-17) → dann `UNSLOP_ESCALATION_THINKING_LEVEL_OVERRIDE=high` als A/B mit angehobener Deadline messen. Kein Streaming/Worker nötig, solange `medium` Pro-Parität liefert.
- **ENTSCHIEDEN 2026-09-16: kein Kapazitäts-Fallback für den Flash-Draft** (weder Pro noch zweiter Endpoint). Messregel zur Wiedervorlage 2026-10-16: Anteil Jobs mit `error_message` beginnend `[model_unavailable]` seit Deploy (`npx tsx scripts/db-query.ts review_jobs --eq status=error --order created_at.desc --limit 200` + `--count`); über ~1 % ⇒ Kandidat ist dasselbe Modell auf einem zweiten EU-Pool, nicht Pro.
- **Live-Receipt UNCERTAIN-Tagline** (SPEC §6): vier Provokationsversuche 2026-09-17 (borderline Catch-/Naming-Cluster, dokumentiertes `any`, Aggregat mit teilweise zutreffenden Vorkommen) lieferten 0 UNCERTAIN — der 3.8-Draft flaggt präzise, der 3.6-Verifier bestätigt (3/3, 1/1, 3/3). Historische Quote: 17/236 Flash-Verdicts, 4/49 nach Eskalation. Natürliches Vorkommen abwarten: `npx tsx scripts/db-query.ts review_job_llm_calls --columns job_id,phase,claims_uncertain --order created_at.desc --limit 100` auf `claims_uncertain > 0` ab 2026-09-17 12:30 UTC filtern, dann im Job-Result `verification = 'uncertain'` + `confidence = 50` und die Tagline „N findings: … remained uncertain“ in CLI/GitHub-Block sichten.
- **Live-Receipt Vertex-429-Backoff** (Impl §3t): ein 429 lässt sich nicht bestellen. Teil-Receipt 2026-09-17 (Job f52aea36, `fetch failed` → Retry `ok`) war der Verifier-Sofort-Retry. Prüfen bei jedem Kapazitätsereignis: `review_job_llm_calls` zeigt `api_error` gefolgt von `ok` im selben Job, oder 3× `api_error` + `[model_unavailable]`-Präfix + neue Client-Copy. Instanz 2026-09-17 (Job `840a21b9`): Draft-429 erst nach 172 s → `[model_unavailable] … nach 1 Versuchen` — der 60-s-Guard hat den Retry wie vorgesehen verweigert, Job `error`; zählt für die Messregel vom 16.10.
- **Second-Opinion-Prod-Receipt**: Trigger T1/T2 sind im Benchmark belegt (r17 7/7), aber noch nie in einem echten Prod-Job beobachtet; erste Prod-Zeile mit Phase `escalate_second_opinion` und Status `ok` einsammeln (bisher nur `skipped_budget`).
- **UNIT_ECONOMICS §4.3/4.4 mit abrechnungstreuen Output-Zahlen nachziehen** (Thinking fehlte in allen Szenarien; Baseline 03.09.: 3.6 Draft Ø 3.361, Verify Ø 2.958 Output-Tokens/Call; 3.8-Draft real ~+20 % zu 3.6). Cache-Storage mit echter Traffic-Dichte nachrechnen, sobald es Traffic gibt. Rechnungsbelege: August-PDF ist nur Summen-Auszug, Positionen nur im Console-Kostenbericht.
- **2.5-EOL-Cleanup nach 2026-10-20**: `UNSLOP_FLASH_LEGACY_25`, `europe-west3`-Client und 2.5-Preise entfernen.
- **Consortium Consistency**: zweiter Anbieter (z. B. Claude) als unabhängiger Verifier für `claim-verifier` inkl. Consortium-Entropie-Metrik. Braucht Spec.
- **GDPR-Stand** (kein To-Do, Gate-Wissen): die komplette Standard-Cascade (Draft, Verifier, Eskalation auf 3.8) läuft seit 2026-09-17 mit garantierter EU-ML-Verarbeitung auf `eu`-Multiregion; nur der Pro-Rollback-Pfad (`UNSLOP_ESCALATION_LEGACY_PRO`) ist `global` (Google bietet für Pro keine EU-Option). Kein Weg zurück nach `europe-west3` für 3.x.

### 6. Plattform & Sicherheit

- **npm-/Marketplace-Publish beim Launch**: `@unslopcodes/cli` + `@unslopcodes/mcp` publizieren (bewusst nicht vorher — Security-/Leak-Testing zuerst). Name `unslop` (unscoped) gehört einem verwaisten Drittpaket: freundliche Transfer-Mail, nach ~4 Wochen npm-Dispute. Nice-to-have, kein Blocker.
- **Scoped / ablaufende API-Keys**: `usk_`-Keys gewähren alles ohne Scope und Ablauf (`src/lib/api-keys.ts`); ein Agent mit Key *ist* der User. Betrifft CLI, Extension, MCP gleichermaßen.
- **IP-Vertraulichkeit der Review-Ausgabe** (Archiv To-Do §12): The Law liegt im System-Prompt, `critique`/`summary` sind angreiferbeeinflussbarer Modelltext. Regel-Content und Titel sind seit 2026-08-10 strukturell aus dem Prompt raus (Impl §3f/§3g). **Nicht nachbauen**: ein Substring-Egress-Filter ist kein Fix (Paraphrase, Encoding, Aufteilung; wird selbst zum Membership-Oracle). Offen: *(a)* Envelope-Tests — literale `</unslop-findings>`-Terminatoren, doppelte Trust-Tags, Zero-Width-/Bidi-Zeichen, über mehrere Findings verteilte Instruktionen; *(b)* Prod-Beleg, dass Findings Law-Regeln nur noch als `SEC-xxx (category)` ohne Titel zitieren (im Replay belegt, in Prod bisher nur Condition-Findings gesehen).
- **Suppression-Ledger vs. DSGVO-Löschpfad**: FKs auf `repositories`/`auth.users` bewusst ohne CASCADE (Kaskade liefe in den Append-only-Trigger) — eine User-Löschung scheitert am FK, solange Ledger-Zeilen existieren. Braucht definierte Wartungsroutine (Trigger-Disable in Prozedur oder Anonymisierung). Dokumentiert, nicht gelöst: Findings älter als der Job-TTL sind nicht mehr ledgerbar; der Finding-Marker steht sichtbar im Comment-Quelltext.
- **Supabase-MCP read-only für DML** (Entscheidung offen, derzeit moot): Test-Mutationen brauchen den SQL-Editor des Users. Bewusst read-only lassen oder Write-Profil für Verifikationssessions.
- **`@unslop/mcp` Lockstep**: zod ^4 + SDK ^1.30 — zod 3.25 lässt `registerTool` mit TS2589 scheitern; bei SDK-Bumps mitprüfen.
- **GitLab & Bitbucket**, **Enterprise EU Hosting**: Vision, nicht geplant.

### 7. Recall-Gaps aus dem Benchmark

Stand 2026-09-16: **125/126 combined** (Cutover-Lauf), Band der letzten Läufe 122–125. Kein Fix ohne A/B über `npm run benchmark:rules` vorher/nachher — `public_explanation`-Änderungen sind globale Prompt-Änderungen (Lehre aus Migration 043).
- **SEC-019** (fehlende Security-Header): seit 2026-09-24 deterministisch **für Next-Middleware/Proxy** (Prescan-Lane r08 ✓, Design §9.1; Express/Flask bleiben LLM, s. §1) — combined 126/126 erwartet, **erst beim nächsten Volllauf messen**, nicht behaupten.
- **MAINT-009** (ungenutzte neue Dependency): deterministische Variante 2026-09-24 verworfen (Design §9.5) — Peer-Deps (`react-dom`), implizite Runtime-Deps (`sharp`) und Nutzung außerhalb des Diffs sind aus der Diff-Sicht nicht von „ungenutzt“ unterscheidbar; bleibt LLM (r06 fängt es).
- **CONC-008|CONC-001** (Go: Map-Zugriff ohne Geschwister-Mutex): bewusst nicht deterministisch (FP-trächtig: Locking über Caller, sync.Map, Single-Goroutine-Ownership). Pro findet es 2/2 unter Force-Pro, aber außerhalb der Second-Opinion-Trigger. Hebel: Trigger-Verbreiterung (Kosten) oder Go-`reference_practices` (Tier 2).
- **SEC-012** (Klartext-Passwort-INSERT), **SEC-021** (Auth ohne Rate-Limit): deterministische Varianten verworfen (FP bei Seeds/Fixtures); unter Force-Pro 2/2, außerhalb der Trigger. Seit 3.8 nur noch sporadisch Miss.
- **MAINT-003@r20**: Einzel-Miss im Referenzlauf (auch pro-direct); vor einem Fix per `--only r20` 2–3× reproduzieren.
- **r07 False Refutation** (Condition 11/ARCH-001, N=1 am 2026-09-01): beobachten.
- **`golden_standards`-Metadaten-Backfill** für Prescan v2/v3/v4: `deterministic_coverage`/`prescan_engine` für TEST-005 (ast), HAL-002 (regex, partial), ARCH-005 (ast, partial), CONC-003 (ast statt regex), TEST-002 ggf. `full`; **v4 als Entwurf bereits geschrieben: `supabase/migrations/046_prescan_metadata_config_engine_v4.sql`** (SEC-032/033/042/043 `full`→`partial`, MAINT-009 → `none`; nicht angewendet). Soll als EINE Migration konsistent mit 030 laufen — v2/v3-Zeilen in 046 ergänzen, dann im SQL-Editor ausführen. *blocked: tooling.*
- **Benchmark-Hygiene**: Einzel-Misses sind N=1 — vor jedem „Fix“ 2–3 Wiederholungsläufe des Bundles (`--only rXX`). Pro-Monatsbudget vor Volllauf prüfen. Negativ-Kontrollen: Ressourcen-Erwerb braucht sichtbare Freigabe (`fixtures/rule-recall/AUTHORING.md`).

### 8. Tests & Hygiene

- **Git-Fixture-Flake unter voller Parallelität**: `gitFacts.test.ts` (`originRefsPresent … once a push has created refs`) und die 7 Git-Fixture-Timeouts im Volllauf — echte Wegwerf-Repos brauchen isoliert ~4 s und reißen das 5-s-Test-Timeout. Fix: Test-Timeout für diese Dateien analog zum `hookTimeout` anheben.
- **`models.test.ts`-Flake**: „Default: Eskalation = gemini-3.8-flash auf dem eu-Client“ fiel 2026-09-26 einmal im vollen `npm test`, isoliert 13/13 und im Wiederholungslauf grün — N=1, beobachten (Verdacht: Env-/Modul-State unter Parallelität).
- **Quota-RPC-Logik ohne automatisierten Test**: Deny-no-consume (Migration 035) ist nur Live-Receipt; die Unit-Suite mockt die RPC.
- **Restliche deutsche Kommentare** in Server-Component-Shells und ~20 API-Routen (out of scope per i18n_Spec §6). Echte Caveat: einige Routen liefern deutsche *Fehlerstrings* (`api/repos/[id]/settings/route.ts`, `api/webhook/route.ts`) — auf Codes + Katalog umstellen, falls der Pfad je erreichbar wird.
- **Slop-Score-Gate ohne Live-Receipt**: Default aus; beim ersten Opt-in eines Repos den ersten gefailten Check hier nachtragen.
- **Vor-034-Jobs ohne Finding-IDs**: alte `review_jobs` ohne `id` auf Issues verjähren mit dem Job-TTL. Keine Aktion.

### 9. Ideen-Backlog (braucht Marktvalidierung)

Aus Developer-Interviews, ohne Feasibility-Check: Rule-Generator (`.cursorrules`/ADR aus dem Repo), Intent-Interpreter (PR vs. Jira/Issue), Assert-Void-Detector für tautologische Tests, Vendor-Lock-In/FinOps-Guard im Pre-Scanner, API-Hallucination-Finder (OpenAPI-Match), Suppression-/Bypass-Audit-Ledger für Enterprise, CTO-„18-Month-Wall“-Dashboard (Score longitudinal).

### 10. Web-Präsenz & DX (Growth)

- **Waitlist Go-Live-Rest** (`WAITLIST_SPEC.md` §7; Code + Brevo-Setup fertig, Chronik 2026-09-22): *(a)* Migration 045 im SQL-Editor ausführen — *blocked: tooling*; *(b)* Brevo-Env-Werte in Vercel (ohne Flag); *(c)* Route-Live-Receipt lokal gegen die echte Tabelle (`scripts/db-query.ts waitlist_signups`), sobald 045 liegt; *(d)* am HR-Eintragungstag `NEXT_PUBLIC_WAITLIST_LIVE=true` **zusammen mit Impressum + Datenschutzerklärung (§2, Brevo als Auftragsverarbeiter, Link `/{locale}/privacy` ist im Consent-Text bereits verdrahtet)**; *(e)* Phase 2: Brevo-Webhook `listAddition` → `status='confirmed'`. Spätere Lifecycle-Phasen (Trial-Drips, Monatsreport, Win-back ≥ 30 Tage nach Ablauf, kein Rabatt direkt nach Kündigung) in Spec §8 als Entscheidungsgrundlage.
- **Docs-Site** (`/docs` oder Subdomain, Interview nötig: Framework, i18n): Quick Start, API-Referenz, SDK-Guides, Security-Portal, Status. Wartende Erstinhalte: Multi-Account-Troubleshooting (§3), Ablöse der Interim-Seite `/dashboard/get-started` (ONBOARDING_SPEC §8).
- Landing Page v2 (Sektions-Redesign, Mega-Menü, Solution-Pages), Help Center/Support-Portal, Public Changelog + Engineering-Blog, Fat Footer + Vergleichsseiten („Unslop vs. SonarQube/CodeQL/Copilot/Snyk“).

### 11. Vision (Post-Launch)

- **LLM Router API** (`@unslop/router`): die Cascade (Draft → Verifier → Eskalation) als eigenständiges Routing-Produkt für AI-Startups, bezahlt per Call.
- **Enterprise Audit & Certification**: signierte Zero-Slop-Zertifikate pro Commit-SHA aus einem Multi-Agent-Konsens (3× Pro, 100 % PASS), vertrieben über Supply-Chain-Enforcement (CISOs, Banken, VCs verlangen das Zertifikat von Lieferanten).
- LangChain bleibt bewusst ausgeschlossen (Validierungsgrenze des nativen 3-Step-Verifiers).

---

> **Note to Claude Code / Fable 5**: When picking up one of these features, use plan mode, verify architecture rules (no generic variable names, max complexity of 15, explicit DB queries) and iterate cleanly without breaking the existing Judge Pattern pipeline. When closing an item: one Chronik line with date + evidence, delete the To-Do bullet, keep receipts in the spec/benchmark doc.
