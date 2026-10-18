# Kampagne „große reale PRs“ (ROADMAP §1)

**Stand 2026-09-30, 16:50 UTC.** Zwölf Läufe auf `unslopai/test` (#26–#37) gegen Produktion, Deploy `dpl_2NR9xL8gZ5c79Z5PdVTamcfaFfRa` (`main` bei `d8f5801`), mit dem Dogfooding-Konto. Ziel: das Produkt vor dem Launch an echten, großen, unordentlichen PRs brechen. Replays per `git show <sha>:<pfad>` als Base-/Head-Branch nach dem Muster von `bench/pr9-*` (unslopai/test#17); unveränderte Manifeste (`package.json`, `tsconfig*.json`, `pyproject.toml` …) wurden in die Base mitgenommen, damit Workspace- und Dependency-Auflösung wie im Quell-Repo läuft. Fremdcode nur als Replay nach `unslopai/test`, Lizenzhinweis im PR-Text (alle drei Quellen MIT).

Kosten sind aus `review_job_llm_calls` gerechnet: Listenpreis `gemini-3.8-flash` / `gemini-3.6-flash` 1,65 / 0,165 / 8,25 USD je Mio. Tokens (Input / Cached / Output) mal Intro-Faktor 0,5 (`scripts/lib/vertex-pricing.ts`, belegt bis 31.12.2026). Output enthält die Thinking-Tokens. Embeddings (RAG) sind nicht mitgerechnet.

## 1. Läufe

| Lauf | PR | Quelle | Dateien | Job | Endstatus / Route | Zeit gesamt | Stufen (LLM-Latenz) | Pre-Scan | Degradation | GitHub | Findings (LLM / Pre-Scan) | FP / FN (gesichtet) | Kosten |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 | #26 | unslopai/unslop#38 (`420c32a`) | 48 (7 A, 41 M), 37 JS/TS | `4276a714` | done, `pro-direct` (~22,8k Tokens) | 79 s | escalate_full 61,2 s | 48 Dateien, 4,4 s, 17 (3 CRIT) | – | Check `failure`, Review 6 inline + 5 ohne Anker | 0 / 17 | **FP 3 CRITICAL** (SEC-017 ×2, SEC-024 auf eingechecktem `.diff`) ⇒ Fix 1; FN keine gefunden | $0,059 |
| R2 | #27 | honojs/hono#5466 (`645ddd6`) | 49 (20 R, 5 D, 7 A, 17 M, 2 `.ico`) | `8fc8a1a7` | done, `pro-direct` (~16,5k) | 54 s | escalate_full 44,0 s | 24 Dateien, 1,2 s, 1 | – | Check `neutral` (nur WARNING) | 1 (TEST-008 `Math.random` im Test) / 1 (TEST-002) | TEST-008 nach Regeltext korrekt, geringer Nutzen; Renames ohne Patch sauber ignoriert, Binärdateien ohne Fehler | $0,037 |
| R3 | #28 | fastapi/full-stack-fastapi-template#2393 (`e80d924`) | 30 (TS, Python, YAML, Shell, nginx, TOML) | `37435f99` | done, `flash-cascade` | 24 s | draft 18,2 s | 26 Dateien, 0,6 s, 0 | – | Check `success`, „No AI slop found“ | 0 / 0 | keine; Platzhalter `SECRET_KEY=changethis` in `.env` richtig still | $0,011 |
| R4 | #29 | trpc/trpc#7591 (`9109554`), pnpm-Monorepo | 56 (32 A, 24 M) | `4729c43d` | done, `flash-cascade`, 2 Batches (19,2k / 8,9k) | 71 s | draft 19,6 + 48,5 s parallel, verify 7,1 s | **HTTP 500: Prescan-Route per OOM gekillt** (RSS ~2 GB bei Datei 45) | **Pre-Scan `degraded`, auf keiner Oberfläche genannt** ⇒ Fix 2 | Check `neutral`, Review ohne Hinweis auf den Ausfall | 4 (Condition 3 Emoji in Kommentaren, alle bestätigt) / 0 | Emojis nach Regeltext korrekt; **FN** `as any` in `next.procedureErrors.test.tsx` (Condition 2) | $0,078 |
| R5 | #30 | honojs/hono#5463 (`b877827`), Workspaces | 101 (71 A, 30 M) | `9260a5cc` | done, `flash-cascade`, 2 Batches | 100 s | draft 24,2 + 73,4 s parallel, verify 5,5 s | 100 Dateien, 4,0 s, 10 (1 CRIT) | – | Check `failure`, Review mit Summary | 3 (TEST-008) / 10 (MAINT-001 leeres `catch {}` TP, TEST-002) | **FN Condition 2 in Nicht-Test-Code:** `@ts-ignore` (`cloudflare-workers/src/serve-static.ts`, `lambda-edge/src/handler.ts`), `any` (`aws-lambda/src/types.ts`, `netlify/src/handler.ts` ×2, `lambda-edge/src/handler.ts`), `as unknown as ReadableStream` (`cloudflare-workers/src/utils.ts`) | $0,110 |
| R6 | #31 | unslopai/unslop#33 (`a7c4182`) | 196 (195 A): 35 PNG, 32 Fonts, 18 LFS-Zeiger, 25 Python, 50 Markdown, 10 HTML, 3 JS/TS | `df20219b` | done, `flash-cascade` | 70 s | draft 54,1 s (3 Dateien, 7,0k Output) | 125 Dateien, 1,3 s, 6 (2 CRIT) | – | Check `failure`, 6 inline | 0 / 6 | **FP** SEC-026 auf `kit.js:20` (Eingabe geht durch `escapeHtml`); SEC-026 `core.js:131` Muster korrekt, kein Nutzer-Input; MAINT-002, ARCH-004 ×2, ARCH-002 nach Regeltext korrekt | $0,036 |
| R7 | #32 | unslopai/unslop `88aa46a^1..d8f5801` (langlebiger Branch, #37–#42) | 112 (38 A, 74 M), 68 JS/TS, ~300 KB TS-Diff | `70ba2bb4` | done, `flash-cascade`, **4 Batches parallel** (am 300-KB-Deckel) | 112 s | draft 73,4 / 80,3 / 88,3 / 89,9 s parallel | 109 Dateien, 3,9 s, 56 (11 CRIT) | – (kein 429, keine ausgelassene Datei) | Check `failure`, 24 Einträge, Sammelfindings | 0 / 56 | **FP 11 CRITICAL:** 3 × `.diff` (Fix 1), 2 × SEC-035 auf Import-String in Testdaten (Fix 3), 5 × SEC-017/024/050/005 auf String-Literalen in `regex-engine.test.ts` (neues To-Do), 1 × SEC-017 auf Ergebnis-JSON (bekanntes To-Do); FN keine gefunden | $0,232 |
| R8 | #33 | unslopai/unslop#42 (`d8f5801`), TS + SQL-Migration | 42 (9 A, 33 M) | `36dfd0a7` | done, `pro-direct` (~26k) | 76 s | escalate_full 60,1 s | 42 Dateien, 3,4 s, 16 (2 CRIT) | – | Check `failure` | 0 / 16 | **FP 2 CRITICAL** SEC-035 `hallucinated-kit` aus einem Test-String ⇒ Fix 3 | $0,062 |
| R9 | #34 | synthetisch: 18 Python-Module je ~235 KB + 1 TS-Modul | 19 | `207ca77c` | done, `flash-cascade` | 18 s | draft 6,3 s | 19 Dateien, **~4,2 MB Body angenommen**, 4,2 s, 0 | – | Check `success` | 0 / 0 | keine | $0,004 |
| R10 | #35 | synthetisch: 22 Python-Module je ~235 KB, kein JS/TS | 22 | `f9297607` | done, `nothing_reviewed` | 5 s | – | **HTTP 413** (~5,2 MB Body) | Pre-Scan `degraded` | Check `neutral` „Not reviewed“, ⚠️-Kommentar | – | ehrlich degradiert; Hinweis „re-run the review to try again“ hilft bei 413 nicht (To-Do) | $0,000 |
| R11 | #36 | unslopai/unslop#30 (`12c734b`) + Force-Push | 14 → 15 | `aa0078bb` (opened, `4ff2964`), `93236c5c` (synchronize, `9143712`) | beide done | 16 s + 32 s, 2 s überlappend | draft 10,6 s / 26,8 s | 14 / 15 Dateien, 0 / 1 (MAINT-001 CRIT) | – | alter Commit: „No AI slop found“, neuer Commit: Check `failure`, 1 CRITICAL | 0 / 1 | **FN Condition 3** (`data`, `e`) und ungeprüftes `response.json()` in der neuen 9-Zeilen-Datei `retry-budget.ts`; Job auf dem überholten Commit lief voll durch | $0,037 |
| R12 | #37 | unslopai/unslop#31 (`88a6e2f`), schließen + wieder öffnen | 6 | `2bb5de2d` (opened), `bd22bcb7` (reopened) | beide done, beide mit Second Opinion | 27 s + 47 s | draft 11,5 / 19,1 s, second_opinion 11,1 / 24,1 s | 6 Dateien, 0 | – | **zwei identische Reviews auf demselben Commit** `dcb7b4c` | 0 / 0 | keine; Reopen kostet einen vollen zweiten Lauf plus Eskalation | $0,041 |

**Summe:** 14 Jobs, **0,71 USD** rabattiert (1,41 USD zum Listenpreis), Budget 8 USD. **Eskalationen:** Zähler des Dogfooding-Kontos 36 → 41 (R1, R2, R8 `pro-direct`; R12 zweimal Second Opinion), alle im September.

Abgedeckte Randfälle: eigene Merges (R1, R6, R7, R8, R11, R12), fremde OSS-PRs mit 30–101 Dateien (R2–R5), gemischte Sprachen (R3, R6), Renames/Deletes/Binärdateien (R2, R6), Monorepo (R4, R5), Payload unter und über 4,5 MB (R9, R10), Force-Push (R11), geschlossen/wieder geöffnet (R12).

## 2. Befunde

### Behoben in diesem PR (je eine Stelle, mit Test)

1. **Eingecheckte Diffs als Code gelesen** (R1, R7): `fixtures/rule-recall/r26-clean-config.diff` zitiert `verify=False`, `rejectUnauthorized: false` und `Access-Control-Allow-Origin: *` als Tabellenzeilen ⇒ drei CRITICAL, Check `failure`. Fix: `.diff`/`.patch` zählen als Prosa (`packages/prescan/src/language.ts: isProseFile`), nur SEC-005 (Provider-Secrets) läuft dort weiter. Test in `regex-engine.test.ts`.
2. **Ausgefallener Pre-Scan neben einer Modell-Review unsichtbar** (R4): Prescan-Route per OOM gekillt, `result.prescan.degraded = true`, aber Review und Check sahen aus wie ein vollständiger Lauf. Fix: `formatPrescanUnavailableNotice` (`packages/shared/src/degradation-notice.ts`), eingebunden in Review-Body (`github-reporter-step.ts`) und Check-Summary (`worker.ts`). Tests in `degradation-notice.test.ts`, `github-reporter-step.test.ts`, `worker-routing.test.ts`.
3. **SEC-035 auf Import-Statements in String-Literalen** (R7, R8): `patch: '… +import hallucinatedKit from "hallucinated-kit" …'` in einer Testdatei ⇒ CRITICAL „Package does not exist“. Fix: `findFirstCodeImport` in `registry-engine.ts` nimmt den ersten Import der Zeile, der nicht in einem auf derselben Zeile geöffneten String steht; ein zitierter Import vor einem echten verdeckt diesen nicht. Test in `registry-engine.test.ts` (schlägt ohne Fix fehl). Bekannte Grenzen, alle fail-open: mehrzeilige Template-Literale, `${…}`-Ausdrücke, ein Anführungszeichen in Kommentar, Regex-Literal oder JSX-Text vor dem Import.

Der Hinweis aus Fix 2 verspricht bewusst keinen Erfolg eines Re-Runs: bei Speicher-Kill und HTTP 413 scheitert derselbe PR wieder.

**Selbst-Review** (Review-Agent über den Diff, vor dem PR): kein blockierender Fehler. Behoben: Re-Run-Satz im neuen Hinweis, verdeckter zweiter Import auf derselben Zeile, veralteter Modulkommentar, fehlender Negativtest im Worker. Als To-Do eingetragen: Check-Conclusion bei Teilabdeckung (bleibt nach D8 `success`, wie bei `draft_partial`) und die Anzeige des Pre-Scan-Ausfalls in CLI, MCP und Extension.

### Neue oder geänderte To-Dos (ROADMAP §1)

| Schwere | Befund | Beleg | Vorschlag |
|---|---|---|---|
| hoch | **Prescan-Route stirbt im Request an Speicher**, nicht mehr nur nach dem 200: RSS wächst je JS/TS-Datei um 10–100 MB (R1: 211 → 1367 MB über 48 Dateien), warme Instanzen starten schon mit 913 / 1186 MB; bei R4 Kill bei ~2 GB nach Datei 45 ⇒ kein Pre-Scan für den ganzen PR. Widerlegt „Produkt unbeeinträchtigt“ im Bullet „Route-Instanz-Leck“. | Job `4729c43d`, Log `Vercel Runtime Error: instance was killed because it ran out of available memory` 16:31:09 UTC | Route in Datei-Batches aufrufen (je Aufruf frische Instanz wahrscheinlicher, Teil-Ergebnis statt Totalausfall) oder ESLint/tree-sitter-Speicher je Datei freigeben; zuerst lokal messen, welche Engine wächst. |
| hoch | **Draft übersieht Condition 2/3 auf realen PRs**: `@ts-ignore`, `any`, `as unknown as` in Nicht-Test-Code von R5 (7 Stellen) und `data`/`e` in einer 9-Zeilen-Datei von R11. Rule-Recall-Benchmark misst gepflanzte, dichte Verstöße; auf echtem Code mit vielen sauberen Zeilen fehlen sie. | Jobs `9260a5cc`, `93236c5c` | Deterministische Regeln für `@ts-ignore`, `: any`, `as any`, `as unknown as` im Pre-Scan (ESLint-Regeln existieren); Condition-3-Namen bleiben Modellfrage ⇒ Fixture aus R11 in den Benchmark. |
| mittel | **Regex-Regeln auf String-Literalen in Testdateien**: 5 CRITICAL (SEC-017/024/050/005) auf Testdaten in `regex-engine.test.ts`. | Job `70ba2bb4` | In Testdateien Treffer innerhalb von String-Literalen verwerfen oder auf WARNING stufen; Abgrenzung zu echten Secrets in Tests klären. |
| mittel | **Reopen und Force-Push fahren volle Läufe ohne Dedupe**: Reopen auf unverändertem Head ⇒ zweiter identischer Review und zweite Eskalation; Force-Push ⇒ Job auf dem überholten Commit läuft zu Ende. | #37 Jobs `2bb5de2d`/`bd22bcb7`, #36 `aa0078bb` | `reopened` überspringen, wenn für `(repo, pr, head_sha)` schon ein `done`-Job existiert; bei `synchronize` laufenden Job des alten SHA vor dem LLM-Schritt abbrechen. |
| niedrig | **Payload-Obergrenze live bestätigt**: ~4,2 MB gehen durch (R9), ~5,2 MB ⇒ 413 und ehrliches „Not reviewed“ (R10). Der Satz „re-run the review to try again“ ist bei 413 falsch, ein Re-Run scheitert gleich. | Jobs `207ca77c`, `f9297607` | Chunking der Prescan-Requests (gleicher Umbau wie beim OOM-Befund); bis dahin eigener Text für 413. |
| niedrig | **Sammelfinding bricht die Markdown-Liste** im Review-Body: der Zusatz „This rule matched N times …“ steht als eigener Absatz hinter dem Bullet einer anderen Regel. | #26, #32 Review-Bodies | Zusatz einrücken oder in dieselbe Zeile ziehen. |
| Hygiene | Replays mit `.github/workflows/*` starten die Workflows des Quell-Repos auf `unslopai/test` (trpc: 11 Check Runs, eigene CI: „Lint, Test, Build“ `failure`). | #29, #32 Check Runs | Bei künftigen Replays `.github/workflows` aus dem Head nehmen oder Actions auf `unslopai/test` abschalten. |

### Bestehende To-Dos, die die Kampagne belegt oder widerlegt

- **„Draft-Batching ohne Obergrenze für die Batch-Anzahl“: für den Webhook-Pfad widerlegt.** `trimReviewableFiles` (`diff-utils.ts`, 300 KB gesamt, 40 KB je Datei) gilt auch im Webhook-Diff-Loader; R7 lag am Deckel und ergab 4 Batches, kein 429, keine ausgelassene Datei. Offen bleibt nur ein sehr kleines `draftBatchMaxTokens` in den Operator-Settings.
- **„Draft-Batching-Reste“ (a)/(d)**: neue Latenzpunkte. 2 Batches 19,6 / 48,5 s (R4) und 24,2 / 73,4 s (R5); 4 Batches 73–90 s (R7), die 90-s-Grenze aus Gate 2 wird am Deckel gerissen. `pro-direct` mit 16–31k Prompt: 44–61 s.
- **„Payload-Obergrenze“**: live bestätigt, Degradation ehrlich (siehe oben).
- **„Route-Instanz-Leck“**: verschärft, siehe erster Befund.
- **Nicht abgedeckt:** Short-Circuit (braucht eine `pipeline_config`-Änderung in der Live-DB, außerhalb des Auftrags), „Reaper verwaist Check“ (kein Job hing), „Re-Run auf gemergtem PR“ (bräuchte einen Merge auf `unslopai/test`).

## 3. Pre-Scan in Datei-Batches (2026-10-03)

Folge der Befunde „Prescan-Route stirbt im Request an Speicher“ (R4) und „Payload-Obergrenze“ (R10): der Pre-Scanner-Step schickt die Dateien seitdem in Batches an `/api/internal/prescan` (`pre_scanner_design.md` §7.7). Dieser Abschnitt hält die Messung vor dem Bau, die gewählten Grenzen, den lokalen Beleg und die Tabelle für den Live-Beleg fest.

### 3.1 Messung: welche Engine baut je Datei Speicher auf?

Gemessen mit den Dateien aus R1 (unslopai/test#26, 48 Dateien, Branches `camp/own38-*`) und R4 (#29, Branches `camp/trpc7591-*`), ohne Registry-Checks. „Ungebündelt“ ruft die Engines aus `packages/prescan/src/engines/` direkt auf (`tsx`), „Route“ ist der gebaute Handler (`next build`, `next start`) mit einem Request je Lauf wie vor dem Batching. Der Linux-Container ist `node:22-bookworm` mit 2 GB Speichergrenze.

| Umgebung | Dateien | RSS Start → Ende, 1. Lauf | weitere Läufe | Vergleich Lambda |
|---|---|---|---|---|
| Windows, ungebündelt, alle Engines | R1 (48) | 186 → 237 MB | 241 / 248 / 225 / 230 / 230 MB nach Lauf 2–6 | 211 → 1367 MB |
| Linux-Container, ungebündelt, alle Engines | R1 (48) | 197 → 261 MB | 263 / 268 MB nach Lauf 2–3 | 211 → 1367 MB |
| Windows, Route | R1 (48) | 194 → 307 MB | 294 / 368 MB, dann R4: 489 / 538 / 534 MB | 211 → 1367 MB |
| Linux-Container, Route | R1 (48) | 217 → 367 MB | 404 / 444 / 445 MB, dann R4: 412 / 440 / 466 / 485 MB | 211 → 1367 MB |
| Windows, ungebündelt, alle Engines | R4 (56 mit `pnpm-lock.yaml`) | 192 → 313 MB | 431 / 551 / 568 / 573 / 567 MB | Kill bei ~2 GB nach Datei 45 |

Je Engine einzeln, ungebündelt, über alle 48 Dateien aus R1 (Windows / Linux-Container): `regex` +2 / +3 MB (unter Windows mit den Dateien aus R4), `config` +13 / +15 MB, `tree-sitter` +40 / +46 MB (davon ~33 MB `external`, das einmalige Laden der Grammatiken; in Lauf 2–4 kein Zuwachs), `eslint` +6 / +5 MB. Größte Einzelschritte im ersten Request der Linux-Route: `packages/cli/src/format.test.ts` +45 MB, `scripts/lib/rule-recall-benchmark.ts` +24 MB, sonst unter 12 MB je Datei.

**Ergebnis:** Das Wachstum von 10–100 MB je JS/TS-Datei ist lokal nicht reproduzierbar, weder ungebündelt noch im gebauten Handler, weder auf Windows noch auf Linux mit derselben Speichergrenze. Lokal kosten dieselben 48 Dateien 50–150 MB, in der Lambda 1156 MB. Was lokal wächst, ist JS-Heap, den V8 später freigibt (Windows-Route: Heap 373 MB → 141 MB nach dem sechsten Request). Der einzige lokale Ausreißer ist `pnpm-lock.yaml` (1,5 MB): der YAML-Parser der Config-Engine erzeugt dafür ~110 MB Heap je Scan. In Produktion läuft er nicht, Lockfiles sind seit Stufe 0 vom Pre-Scan ausgenommen und die Datei läge über `maxFileBytes`.

Damit ist die Ursache keine kleine, lokale: kein Cache ohne Grenze und kein nicht freigegebener Parser, den der lokale Lauf zeigt (`tree-sitter` gibt Baum und Parser je Datei frei). Sie liegt wie bei der Registry-Phase (Archiv To-Do §1, Runs 5–14b) im Verhalten der Vercel-Lambda. Ein Hinweis für die nächste Runde: im gebündelten Build ist `eslint` die einzige Engine, die in jedem Request wächst (+23 bis +29 MB je 12 Dateien, `tree-sitter` nur im ersten Request +16 bis +20 MB). Die Route schreibt deshalb je Request die Zeile `[PrescanRoute] RSS-Zuwachs je Engine: …`; die Zuordnung in der Lambda kommt aus dem Live-Beleg (§3.4). Eintrag in ROADMAP §1 „Route-Instanz-Leck“.

**blocked: tooling** — die Vercel-Logs der Kampagnen-Jobs mit den `[Memory] nach file …`-Zeilen je Datei sind nicht mehr lesbar (Hobby hält Runtime-Logs 1 h, Abfrage am 2026-10-03 leer). Welche Dateien in der Lambda die großen Sprünge machen, ist deshalb nicht nachgeprüft; die Zahlen aus §2 stehen so, wie sie am 2026-09-30 notiert wurden.

### 3.2 Gewählte Grenzen

| Grenze | Wert | Begründung |
|---|---|---|
| `maxBatchFiles` | 12 | Lambda: im Mittel 24 MB je Datei (1156 MB / 48), einzelne JS/TS-Dateien bis 100 MB. Warme Instanz bis 1186 MB, Kill bei ~2048 MB ⇒ ~860 MB Spielraum. 12 Dateien kosten im Mittel ~290 MB, bei 70 MB je Datei 840 MB. Kalte Instanz (211 MB): in jedem Fall. |
| `maxBatchBytes` | 3 000 000 | Vercel-Limit 4,5 MB; live gingen ~4,2 MB durch (R9), ~5,2 MB nicht (R10). Gemessen wird der serialisierte Request-Body, 1,5 MB Abstand. 12 Dateien an `maxFileBytes` (256 KB) sind ~3,1 MB. |
| `batchPhaseBudgetMs` | 60 000 | Alle Batches zusammen. Lokal 0,3–4,2 s je Batch, in Produktion 4,4 s für 48 Dateien (R1). |
| Ablauf | nacheinander | Ein Fan-out spart Sekunden. Ob parallele Requests getrennte Instanzen bekommen oder sich den Speicher einer Instanz teilen, ist ungemessen; im zweiten Fall stürbe sie früher als heute. |

Die Grenzen stehen in `packages/prescan/src/config.ts` und sind je Repo über `pipeline_config.prescan` setzbar.

### 3.3 Lokaler Beleg bis zum Route-Handler (2026-10-03, ohne Vercel)

Gebauter Handler (`next start`), aufgerufen über `runBatchedPrescan` → `requestInternalPrescan`, `registryChecks: false`. Dateien wie im Webhook-Pfad (ohne Lockfiles).

| Lauf | Dateien | Batches (Dateien / `fileBytes` / Laufzeit) | Ergebnis |
|---|---|---|---|
| #29 (trpc) | 55, 0,39 MB | 12 / 31 KB / 584 ms; 12 / 33 KB / 329 ms; 12 / 106 KB / 759 ms; 12 / 152 KB / 991 ms; 7 / 82 KB / 808 ms | `filesScanned` 55, 13 Findings (ungebatcht ebenfalls 13), nicht degradiert, 3,5 s gesamt |
| #29, Batch 2 erzwungen HTTP 500 | 55 | Batch 2 `failed` nach 5 ms, übrige wie oben | `filesScanned` 43, 12 Findings, `degradedReason` „1 of 5 pre-scan batches failed or were skipped (12 files): Prescan-Route antwortete mit HTTP 500.“, Hinweis nennt die 12 Dateien |
| #35 (Payload über der Grenze) | 22, 5,22 MB | 12 / 2917 KB / 4152 ms; 10 / 2431 KB / 3257 ms | `filesScanned` 22, 0 Findings, nicht degradiert (vorher HTTP 413 für den ganzen PR) |
| #35, Batch 1 erzwungen HTTP 500 | 22 | Batch 1 `failed`, Batch 2 `scanned` 2751 ms | `filesScanned` 10, Hinweis nennt `calibration_00.py` bis `calibration_11.py` |

Grenze des Belegs: lokal gibt es weder das 4,5-MB-Limit noch den Speicher-Kill. Der Beleg zeigt Planung, Zusammenführung und Degradation, nicht das Verhalten der Lambda.

### 3.4 Live-Beleg nach dem Merge (2026-10-03, Deploy `dpl_EquMkXee`, `939d1cf`)

Vorbereitete Branches auf `unslopai/test`, ohne PR: `batch/trpc7591-base` / `batch/trpc7591-head` (Replay von R4 ohne `.github/workflows`, 55 geänderte Dateien, 54 scanbar), `batch/payload-over-base` / `batch/payload-over-head` (Replay von R10), `batch/small-head` gegen `main` (eine neue Datei `src/batchProbe.ts` mit leerem `catch {}`).

| Lauf | PR | Job | Batches (`result.prescan.batches`) | Laufzeit je Batch | Peak-RSS (Vercel-Log) | RSS-Zuwachs je Engine | Endstatus / Pre-Scan | Kosten |
|---|---|---|---|---|---|---|---|---|
| R4 neu (`batch/trpc7591-*`) | test#43 | `3cdde416` | 5: 12 / 12 / 12 / 12 / 6 Dateien, 24 / 44 / 100 / 212 / 25 KB; Batch 4 `failed` (HTTP 500) | 4,3 / 4,4 / 1,7 / 2,4 (Kill) / 3,1 s | Batch 1 219 → 831 MB (kalt), 2 215 → 692 MB (kalt), 3 711 → 1071 MB (warm, Instanz von 2), **4 1107 → 1800 MB, dann Kill** (warm, Instanz von 3), 5 215 → 394 MB (kalt) | eslint +144 / +54 / +246 / – / +151 MB; tree-sitter +73 / +27 / +60 / – / +19; regex +2…+19; config +1…+9 | done, Check `failure` (2 CRITICAL), `degraded: true`, 42 Dateien gescannt, 12 in `unscannedFiles` und im Review unter „Reduced coverage“ | $0,074 |
| R10 neu (`batch/payload-over-*`) | test#44 | `41c65c57` | 2: 12 / 10 Dateien, 2,99 / 2,49 MB, beide `scanned` | 5,5 / 5,4 s | 396 MB / 339 MB | Python: tree-sitter +100 MB, regex +20 MB (zweiter Batch); eslint läuft nicht | done, Check `success`, **kein 413**, `degraded: false`; Modell-Review `pro-direct` (Replay-Diff nur 7 KB), Eskalationszähler 3 → 4 | $0,004 |
| Regressionsprobe (`batch/small-head`) | test#45 | `345eae9b` | 1, `result.prescan` ohne `batches` (Schlüssel wie vor dem Batching) | – | – | – | done, MAINT-001 CRITICAL inline auf `src/batchProbe.ts:8` | $0,006 |

Auswertung:
- **Teilausfall statt Totalausfall belegt.** Derselbe PR, der als R4 den Pre-Scan ganz verlor, bekommt 42 von 54 Dateien geprüft. Der Kill trifft die vierte Anfrage, weil die Batches nacheinander auf derselben warmen Instanz landen und ihr RSS mitnehmen (711 → 1071, dann 1107 → 1800 MB). Die Anfrage danach bekommt eine kalte Instanz (215 MB): ein einmaliger Retry nach 5xx hätte Batch 4 sehr wahrscheinlich gerettet (ROADMAP §1 „Datei-Batches: offene Punkte“ (a)).
- **Die Lambda-Zuordnung zeigt `eslint`.** Lokal +23…+29 MB je 12 Dateien, in der Lambda +54…+246 MB je Batch. `tree-sitter` folgt mit +19…+100 MB. Die Registry-Phase wächst in Batch 1 noch einmal um rund +390 MB (442 → 831 MB). Nächster Ansatz steht in ROADMAP §1 „Route-Instanz-Leck“.
- **Payload-Grenze belegt:** 5,2 MB in zwei Batches unter 3 MB, beide HTTP 200.

## 4. Condition 2/3 im Pre-Scan (2026-10-03)

Folge des Befunds „Draft übersieht Condition 2/3 auf realen PRs“ (R5, R11): `COND-002` (Type Capitulation) und `COND-003` (generische Namen) laufen als AST-Regeln der tree-sitter-Engine, Schweregrad WARNING, nur auf hinzugefügten Zeilen. Regeltext und Ausnahmen: `docs/specs/pre_scanner_design.md` §10. Korpus-Gate und Benchmark: `docs/benchmarks/RULE_RECALL_BENCHMARK.md` (2026-10-03).

### 4.1 Treffer auf den Dateien der Kampagne (lokal, Pre-Scanner ohne Registry, Head-Stände der PRs)

| PR | Findings vorher → nachher | CRITICAL | neu COND-002 | neu COND-003 |
|---|---|---|---|---|
| unslopai/test#30 (hono, R5) | 10 → 38 | 1 → 1 | 21 (14 in Nicht-Test-Code, 7 in Testdateien) | 7 |
| unslopai/test#36 (R11) | 1 → 3 | 1 → 1 | 0 | 2 |
| unslopai/test#29 (trpc, R4) | 12 → 21 | 2 → 2 | 4 | 5 |

Die sieben Stellen aus R5 sind alle dabei: `// @ts-ignore` in `cloudflare-workers/src/serve-static.ts:29` und `lambda-edge/src/handler.ts:6`, `any` in `aws-lambda/src/types.ts:11` (dazu `:50`, `:52`), `netlify/src/handler.ts:5`–`:7` und `lambda-edge/src/handler.ts:117`, `as unknown as ReadableStream` in `cloudflare-workers/src/utils.ts:49`. Sechs davon stehen hinter einem `eslint-disable`-Kommentar (alle außer dem Doppel-Cast); `no-explicit-any` und `ban-ts-comment` hätten sie über die `Linter`-API nicht gemeldet. Die 16 `@ts-expect-error` mit Begründung im selben PR bleiben still. COND-003 auf #30: sechsmal `result` in `aws-lambda/src/handler.ts` (eine Variable, fünf Methoden-Parameter) und `catch (e)` in `deno/src/serve-static.ts:20`. Auf #36: `const data` (`retry-budget.ts:4`) und `catch (e)` (`:6`).

In Produktion laufen diese Treffer durch den Deckel (`prescan-hit-cap.ts`): je Regel drei einzelne Findings, der Rest als ein Sammelfinding mit allen Fundstellen.

### 4.2 Speicher der Prescan-Route (gebauter Handler, lokal)

`next build`, `next start`, die 40 JS/TS-Dateien aus unslopai/test#29 in Batches von 12, drei Runden (12 Requests), `registryChecks: false`, einmal auf `main` (`ff07458`), einmal auf dem Branch.

| Engine | 1. Request, `main` → Branch | Summe über 12 Requests, `main` → Branch |
|---|---|---|
| tree-sitter | +35 MB → +39 MB | +26 MB → +12 MB |
| eslint (Code unverändert) | +52 MB → +43 MB | +153 MB → +220 MB |
| regex | +0 MB → +3 MB | −1 MB → +3 MB |

Die neuen Regeln laufen in der tree-sitter-Engine und erhöhen deren Zuwachs nicht messbar. Die ESLint-Engine ist unverändert; ihre Summe schwankt zwischen zwei Server-Prozessen um 67 MB, das ist die Messunschärfe dieser Zeile. Die verworfene Alternative: `@typescript-eslint/eslint-plugin` in der ESLint-Engine kostet ungebündelt 29 und 34 MB RSS schon beim Laden (zwei Läufe, 196 → 213 und 183 → 217 MB), ohne Zuwachs je Runde.
