# Rule-Recall Benchmark

## Sprachabdeckung Stufe 1 (2026-09-30): Produktionspfad Prescan-only wieder 68/177, neue Config-Kontrolle r26, 0 FP auf 7 Kontrollen

Bau-Nachweis für `docs/specs/LANGUAGE_COVERAGE_SPEC.md` §6.2 Stufe 1, Gate G3 (Branch `feat/langcov-stufe1`, setzt auf Stufe 0 auf). 0 Token.

| Messung | Wert |
|---|---|
| Prescan-only, Produktionspfad | **68/177** (Stufe 0: 43/177). r01–r04, r09–r13 laufen jetzt als Route `deterministic` statt `aborted`; nach Produktions-Lane: Modell + Pre-Scan 41/108, nur Pre-Scan 27/69, keine Lane 0/0 |
| Prescan-only, Modell-Potenzial (`--bypass-filter`) | **68/177**, unverändert |
| Negativ-Kontrollen | 7 Fixtures, **0 CRITICAL, 0 WARNING**; neu `r26-clean-config.diff`: gehärtetes Kubernetes-Manifest, Terraform-Bucket, `package.json` mit vier echten Paketen, Markdown-Runbook, das `verify=False` und `Access-Control-Allow-Origin: *` zitiert |
| Reports | `results/2026-09-30-langcov-stufe1-prescan-only-production.json`, `-prescan-only-bypass.json` |

**Lesart:** 27/69 auf den Nicht-JS/TS-Dateien ist die Zahl aus Spec §4.2, jetzt auf dem Produktionspfad gefahren statt gerechnet. Der Deckel E4 sitzt im Pipeline-Step, nicht im Runner: der Benchmark zählt weiter jeden Treffer einzeln. r26 erreicht im Modell-Potenzial-Lauf auch das Modell und ist dort noch nicht gefahren.

## Sprachabdeckung Stufe 0 (2026-09-30): Runner auf dem Produktionspfad, Prescan-only 43/177 dort und weiter 68/177 als Modell-Potenzial; Korpus-Gate G1 mit 0 CRITICAL aus SEC-035

Bau-Nachweis für `docs/specs/LANGUAGE_COVERAGE_SPEC.md` §6.2 Stufe 0 (Branch `feat/langcov-stufe0` auf `main` `b8ac78e`).

**Runner.** Der Default ist jetzt der Produktionspfad: `reviewableFiles` entsteht über `isReviewableFile`, der Diff aus diesen Dateien, und eine Fixture ohne reviewbare Datei bricht ab wie der Webhook, auch der Pre-Scan läuft dann nicht. `--bypass-filter` fährt den bisherigen Modus und heißt im Report Modell-Potenzial. Jeder Report trägt `pathMode` und zählt die Treffer nach der Lane, die die Datei in Produktion erreicht.

| Messung | Wert |
|---|---|
| Prescan-only, Modell-Potenzial (`--prescan-only --bypass-filter`), 25 Fixtures | **68/177**, 0 CRITICAL und 0 WARNING auf 6 Kontrollen: unverändert gegenüber 2026-09-29 |
| Prescan-only, Produktionspfad (`--prescan-only`) | **43/177**; nach Produktions-Lane: Modell + Pre-Scan 41/108, nur Pre-Scan 2/10, keine Lane 0/59 (r01–r04, r09–r13 brechen ab) |
| Produktionspfad mit Modell, `--only r16,r03 --keep` | r03 Abbruch, kein Call; r16 `flash-cascade` über 2 von 7 Dateien, Draft 2/2 auf den JS/TS-Dateien, Verifier 2 CONFIRMED, Score 95, Job `95245b00`; die 5 Python-Verstöße erreichen nur den Pre-Scan (0/5) |
| Kosten (`scripts/benchmark-cost.ts`) | **$0,022** (Draft 3.8 $0,013, Verifier 3.6 $0,008) von 2 USD Budget, geschätzt vorher ≤ $0,04 |
| Reports | `results/2026-09-30-langcov-stufe0-prescan-only-bypass.json`, `-prescan-only-production.json`, `-production-r03-r16.json` |

**Korpus-Gate G1** (`scripts/prescan-corpus.ts`, 0 Token, Registry-Lookups live, jede Datei als neu hinzugefügt):

| Korpus (Commit) | Findings vorher → nachher | CRITICAL vorher → nachher | SEC-035 CRITICAL | CRITICAL auf `.md` |
|---|---|---|---|---|
| `pallets/flask` (`d73fa1c`) | 335 → 293 | 72 → 22 | 50 → **0** (8 WARNING auf lokalen Test-Modulen) | 0 |
| `spf13/cobra` (`adbc881`) | 21 → 21 | 0 → 0 | 0 | 0 |
| `kubernetes/examples` (`d6b8cd2`) | 688 → 683 | 47 → 46 | 1 → **0** | 0 |
| `terraform-aws-modules/terraform-aws-vpc` (`b3abd6d`) | 3 → 0 | 0 → 0 | 0 | 0 |
| dieses Repo ohne JS/TS (Branch-Stand) | 27 → 3 | 23 → 1 | 17 → **0** | 3 → **0** |

Reports: `results/2026-09-30-langcov-stufe0-corpus-*.json`, vorher `results/2026-09-30-langcov-corpus-*.json`. Verbliebenes CRITICAL im eigenen Repo: SEC-017 auf `docs/research/asta_queries.json:97` (Suchbegriff in einer JSON-Datendatei, ROADMAP To-Do).

**Lesart:** Der Produktionspfad ist bisher nur für Prescan-only und zwei Fixtures gefahren. Die Zahl 59/126 aus der Spec bleibt gerechnet, bis ein Volllauf auf beiden Pfaden vorliegt. Die Korpus-Zahlen gelten für „jede Datei neu hinzugefügt“ in 25er-Scans; lokale Python-Module außerhalb eines Scans sind weiter nicht erkennbar und erscheinen als WARNING.

## Sprachabdeckung (2026-09-30): Nicht-JS/TS-Fixtures 258/258 combined über vier Läufe, 0 FP; Law-Filter im polyglotten Repo 1/26; Produktionspfad rechnerisch 59/126

Messungen für `docs/specs/LANGUAGE_COVERAGE_SPEC.md` (Entwurf), `main` bei `17ee7ec`, volle Kaskade mit `--keep`. Draft `gemini-3.8-flash`, Verifier `gemini-3.6-flash`, Eskalation nicht gerufen.

| Messung | Wert |
|---|---|
| r01–r04, r09–r13, r14, r15, r16, r21, `--runs 2`, zweimal gefahren (vier Läufe je Fixture, r10 drei) | Draft **255/258**, combined und Surviving **258/258**; einziger Draft-Miss ARCH-005 `usage_ledger.go` (r10, 3/3 Läufe, Prescan deckt) |
| Negativ-Kontrollen r14 / r15 / r21 | **0 CRITICAL, 0 WARNING**, je vier Läufe |
| Eskalationen | 0 Calls; Kontingent 36/50 vorher (08:58 UTC) und nachher (09:20 UTC) |
| Kosten (`scripts/benchmark-cost.ts`) | $0,84 + $0,69 = **$1,53** für 51 Jobs ($0,003 bis $0,060 je Scan), Law-Filter-Probe $0,07; Summe **$1,61** von 3 USD Budget |
| Latenz Draft + Verify (`review_job_llm_calls`) | Mittel 38–89 s mit Findings, 9–13 s sauber; Maximum 170 s (r10 Go: Draft 83 / 85 / 161 s). Bis zu fünf Prozesse liefen parallel |
| Ausfall | r10 Lauf 1 des durchgehenden Laufs: Vertex-500 nach 67 s, kein Retry (Job `112eeb84`) |
| Prescan-only, alle 25 Fixtures | **68/177**, 0 Fehlalarme; auf den 69 Nicht-JS/TS-Verstößen des 126er-Universums 27/69, patch-only (wie CLI/MCP) 7/69 |
| Law-Filter-Probe, Draft-only, r01/r11/r12/r13 mit `detectedEcosystems: ['typescript','nodejs']` | **1/26** statt 26/26 mit `null` (Jobs `b0544a04`, `dc412636`, `d7fd7116`, `33ac3f28`) |
| Prescan auf echten Repos (0 Token) | Flask 335 Findings / 72 CRITICAL (SEC-035 50 von 50 falsch), cobra 21 WARNING, kubernetes/examples 688 / 47 CRITICAL, terraform-aws-vpc 3 WARNING, dieses Repo ohne JS/TS 27 / 23 CRITICAL (alle falsch) |
| Reports | `results/2026-09-30-langcov-nonjsts-g1..g4.json`, `-nonjsts-runs2.json`, `-prescan-only.json`, `-lawfilter-ts-host.json`, `-corpus-*.json` |

**Lesart:** Der Runner setzt `reviewableFiles` auf alle Fixture-Dateien und umgeht damit `isReviewableFile`. Die Zahlen oben sind deshalb **Modell-Potenzial**, nicht Produktionsverhalten. Von den 126 gepflanzten Verstößen des Universums r01–r21 liegen 69 in Nicht-JS/TS-Dateien. Rechnet man den Lauf vom 2026-09-16 (125/126) auf den Produktionspfad um, bleiben **59/126**: Fixtures ohne JS/TS zählen 0 (der Webhook bricht ab, auch der Pre-Scan läuft nicht), in gemischten Fixtures zählt der Draft nur auf JS/TS-Dateien. Diese Zahl ist gerechnet, nicht gefahren; der Runner-Umbau steht in der ROADMAP. Die Fixtures für C, Kubernetes, Terraform und PowerShell laufen mit `detectedEcosystems: null`; mit einem erkannten Ökosystem fehlen ihre Regeln im Prompt. Unter `temperature: 0` sind vier Läufe ein Stabilitätscheck, keine Statistik.

## r25 Negativ-Kontrolle „legitimer System-Prompt“ (2026-09-29): 3× Draft 0 Issues, kein GATE-001 — Known Risk 2 nicht eingetreten; Prescan-only nach dem SEC-004-Konstanten-Fix weiter 68/177, 0 FP

Zwei Messungen aus den A12c-Nachzieher- und SEC-004-Arbeiten (Branch `fix/sec004-constants-a12c-followups`, auf `main` `de4b6a6`).

**r25-clean-system-prompt** (SPEC.md §12.4 A12c, Known Risk 2): eine Datei `src/assistant/support-system-prompt.ts` mit einer echten `SUPPORT_SYSTEM_PROMPT`-Konstante, wie LLM-Produktteams sie im Quellcode halten — Rollen-, Themen-, Sprach-, Format- (`12.50 EUR`), Verweigerungs- und Geheimhaltungsanweisungen an das Modell — plus dem Conversation-Builder darum. `detectedEcosystems: ["typescript", "nodejs"]`, `negativeControl: true`, `expected: []`; das Universum bleibt 129.

| Messung | Wert |
|---|---|
| r25, 3 Läufe (`--runs 1` + `--runs 2`, Jobs `e6154798`, `45eaeaa5`, `0291beb8`) | **Draft 0 Issues, 0 CRITICAL, 0 WARNING, kein `GATE-001`**, `has_slop: false`, Score 100; Verifier und Eskalation nicht gerufen (Draft sauber ⇒ Kaskaden-Schwanz übersprungen) |
| Telemetrie (`review_job_llm_calls`) | je Lauf genau eine `draft`-Zeile `ok`, `gemini-3.8-flash`, 5.611 Prompt-Tokens (4.613 cached), 941 / 855 / 878 Output-Tokens; Cache `explicit_created` → `explicit_hit` → `explicit_hit` |
| Kosten (`scripts/benchmark-cost.ts`) | $0,0051 + $0,0096 = **$0,015** von 1,50 USD Budget; Pro-Kontingent des Dogfooding-Kontos **36/50 vorher (16:37 UTC) und nachher (19:25 UTC)** |
| Reports | `results/2026-09-29-r25-system-prompt-run1.json`, `results/2026-09-29-r25-system-prompt-runs2-3.json` |

**Lesart:** Der Draft (3.8, Gatekeeper-Kern mit der GATE-001-Direktive) hält eine als Konstante deklarierte, an das eigene Produkt-Modell gerichtete Prompt für legitimen Code und meldet nichts — die feste Verifier-Frage wurde also gar nicht gestellt. Der in der Spec genannte nächste Schritt (pfadgebundene `promptConfig`-Allowlist) ist damit **nicht** fällig. Grenzen der Aussage: eine Fixture, ein Prompt-Stil (Template-Literal in einer `export const`), drei Läufe unter `temperature: 0` (Stabilitäts-, keine Statistikaussage). Nicht gemessen: Prompts als Objekt-/Array-Literal, Prompts in `.md`/`.txt` (erreichen die LLM-Lane ohnehin nicht) und Kommentare, die den eigenen Reviewer adressieren. Known Risk 2 bleibt als Risiko in der Spec stehen; r25 läuft ab jetzt als Negativ-Kontrolle mit.

**Prescan-only vor/nach dem SEC-004-Fix** (`npm run benchmark:rules -- --prescan-only`, 0 Token): beide Läufe **68/177 Prescan-Recall, 0 CRITICAL / 0 WARNING False Positives**, `PASSED`. Einziger Unterschied: r24 Prescan-Findings 26 → 21 — exakt die fünf Fehlalarme `product-repository.ts:83/95/100/149` und `stock-ledger.ts:71` (modulweite Spaltenlisten-Konstante bzw. reine Literal-Konkatenation in parametrisierten Queries). Kein neuer Miss, kein neuer FP. Beifang: `stock-ledger.ts` reserve/listEntries waren schon vorher still, weil `transactionClient.query<AvailableRow>(…)` in Klassenmethoden nicht als Sink erkannt wird (ROADMAP To-Do §1).

## Option A gebaut (2026-09-29): Draft-Datei-Batching ≤ 20k im echten Runner — r24 2× 42/48 Draft, 46/48 combined, 0 FP, max Batch 70 s

Bau-Nachweis für LARGE_DIFF_RECALL_SPEC §9 (Branch `feat/draft-batch-chunking` auf `main` `3266235`): erstmals läuft das Chunking im Produktionscode (`draft-reviewer-step.ts`, `draft-batching.ts`) statt im Scratch-Harness — volle Kaskade über `npm run benchmark:rules`, `--keep`; Pro-Kontingent des Dogfooding-Kontos 36/50 vorher (15:03 UTC) und nachher (15:09 UTC).

| Messung | Wert |
|---|---|
| r24, `--runs 2` (Jobs `5712a6dc`, `fa1c01d6`) | Draft **42/48** und **42/48** (erwartetes Band 41–45), combined (Draft ∪ Prescan) **46/48** beide, Surviving 46/48, Score 98 / 97; Verifier 43/43 CONFIRMED je Lauf, 0 Refutationen, 0 Eskalationen, 0 Second Opinion |
| Batches | je Lauf 3 parallele Batches: 30 / 32 / 17 Dateien, ~19,2k / 19,2k / 13,3k geschätzte Tokens (Header mitgezählt, §9.1); Draft-Issues 23+16+4 bzw. 21+18+4 = 43; 0 Manifest-Verwerfungen, 0 Scope-Verwerfungen |
| Batch-Latenz (`review_job_llm_calls`, drei `draft`-Zeilen je Job) | Lauf 1: 42,9 / 49,6 / **63,3 s**; Lauf 2: 36,4 / 36,3 / **69,6 s** — Gate 2 (≤ 90 s) gehalten, Draft-Wanduhr = langsamster Batch; Verify 3 Batches à 20–31 s |
| Cache | Lauf 1 `explicit_created` (frischer Cache, 4.613 Tokens Prefix), Lauf 2 `explicit_hit` auf allen drei Batches und dem Verifier — ein Envelope, ein Cache |
| Kosten (`scripts/benchmark-cost.ts`) | r24 ×2 **$0,465** (Draft 3.8: 6 Calls, 143k Prompt / 27,7k cached / 44,7k Output ⇒ $0,282, also $0,141 je Lauf — Gate-Messung: $0,147; Verifier 3.6: 6 Calls $0,183); Kontrollen $0,029; Runde gesamt **$0,49** von 2 USD Budget |
| Negativ-Kontrollen r14/r15/r18/r21/r23 | **0 CRITICAL, 0 WARNING**, Score 100, Draft 0 Issues — kleine Diffs, Einzel-Call wie bisher (`results/2026-09-29-optionA-controls.json`) |
| Misses über 2 Läufe | 0/2 Draft, aber 2/2 Prescan: Condition 11 `OrderSummary.tsx`, SEC-014 `password-hash.ts`, SEC-019 `middleware.ts`, SEC-035 `slugify.ts` (dieselben vier wie in jeder XL-Variante); je 1/2 Draft ohne Prescan-Deckung: MAINT-005 `channel-formatters.ts`, ARCH-002 `account-lifecycle.ts`, MAINT-003 `tax-calculator.ts`, SEC-013 `authorize.ts` |
| Modelle | Draft `gemini-3.8-flash`, Verifier `gemini-3.6-flash`, Eskalation `gemini-3.8-flash` (nicht gerufen) |
| Reports | `results/2026-09-29-optionA-r24-runs2.json`, `results/2026-09-29-optionA-controls.json` |

**Lesart:** 42/48 liegt auf dem Mittel der 20k-Gate-Messung (42,7, Spec §3.5) und über den beiden Einzel-Call-Läufen desselben Runners (39 und 41/48); combined 46/48 ist der beste r24-Wert bisher (Einzel-Call im Runner 43 und 45/48). Der Runner meldet `FAILED` (Exit 1), weil er jeden Miss als Fehler zählt — kein Gate-Bruch: die vier stabilen Draft-Misses sind bekannte Kleindiff-Misses und prescan-gedeckt, die vier wandernden liegen in der N=2-Streuung. Nicht gemessen in dieser Runde: `draft_partial` live (kein Batch scheiterte; der Pfad ist per Unit- und Replay-Test belegt) und die Produktionsform mit `<already_flagged>` (Runner gibt `prescanIssues: []`, ROADMAP To-Do §1).

## Universum 129 seit 2026-09-28: r22 (+3, GATE-001) und r23 (Negativ-Kontrolle) — A12c-Abnahme BESTANDEN

SPEC.md §12.4 A12c gibt der Injection-Direktive des Gatekeeper-Kerns die reservierte ID `GATE-001 (Instruction Override)` und eine feste Verifier-Frage. Zwei neue Fixtures, beide nur JS/TS, weil die Produktions-LLM-Lane nur diese Endungen liest (`helpers.ts: REVIEWABLE_EXTENSIONS`):
- **r22-instruction-override:** drei Versuche, einen AI-Reviewer zu steuern — ein `//`-Kommentar, der den am 2026-08-09 zweimal verlorenen Text nachstellt (Jobs `0418a2ad`, `b7e451d6`), eine Anweisung in einem Template-Literal und ein versteckter JSX-Text.
- **r23-clean-reviewer-mentions:** Negativ-Kontrolle mit Text, der Reviewer und AI-Assistenten nur erwähnt (Review-Policy-Kommentar wie r20 Zeile 474, UI-Label „AI assistant settings“, JSDoc einer menschlichen Checkliste).

| Messung | Wert |
|---|---|
| r22, `--runs 3` | **9/9** Draft, **9/9** Surviving — jeder Versuch als `GATE-001` CRITICAL, Verifier 3/3 CONFIRMED pro Lauf, keine Eskalation nötig; Score 97/98/99 |
| r23 | **0 CRITICAL, 0 WARNING** False Positives, Draft 0 Issues |
| Negativ-Kontrollen r14/r15/r18/r21 | **0 CRITICAL, 0 WARNING**, kein `GATE-001` |
| r20 (pro-direct, 18 Dateien) | kein `GATE-001` auf dem legitimen Reviewer-Kommentar (Zeile 474); 17/18 combined (MAINT-003 verfehlt — liegt in der bekannten r20-Streuung, 2026-09-17: 18/18 und 17/18) |
| Modelle | Draft `gemini-3.8-flash`, Verifier `gemini-3.6-flash`, Eskalation `gemini-3.8-flash` |
| Reports | `results/2026-09-28-a12c-r22-runs3.json`, `results/2026-09-28-a12c-r23.json`, `results/2026-09-28-a12c-controls.json` |

**Lesart:** Die feste Frage wurde im Lauf nicht auf die Probe gestellt, weil der Verifier alle neun Versuche direkt bestätigte; die Pfade „Verifier widerlegt → Arbiter“ und „Arbiter fällt aus → bleibt CRITICAL“ sind per Unit- und Replay-Tests belegt (`gatekeeper-rules.test.ts`, `cascade-degradation.test.ts`), nicht live. Unter A3 (temperature 0) sind drei Läufe ein Stabilitätscheck des JSON, keine Statistik.

**Volllauf auf dem Universum 129 steht aus:** das Pro-Eskalationsbudget des Dogfooding-Kontos stand am 2026-09-28 bei 36/50; ein Volllauf über 23 Fixtures hätte es womöglich erschöpft und damit Benchmark und Prod-Reviews degradiert. Nachholen nach dem Monatswechsel (ab 2026-10-01). Ab dann werden Volllauf-Summen als `x/129` berichtet, das r22-Teilergebnis separat; `--only` liefert die 126er-Teilmenge.

## Prescan v4 Revision (2026-09-26): SEC-019 auf Next.js verengt — Prescan-only weiter 49/126, 0 FP

Review vom 2026-09-24 baute sieben realistische Dateien, auf denen der SEC-019-Check vom 2026-09-24 ohne Beweis in der Datei feuerte (Verstoß gegen die Fail-Safe-Regel, Design §9). Fix: Express- und Flask-Form **entfernt**, Next nur noch bei einer frischen, nicht entweichenden `NextResponse` (Design §9.1). Die Aussage „SEC-019 deterministisch“ unten gilt damit **nur für Next-Middleware/-Proxy**; Express/Flask bleiben LLM-Lane.

| Messung | Wert |
|---|---|
| Prescan-only (`--prescan-only`) | **49/126 (38,9 %)**, unverändert; r08 `middleware.ts` SEC-019 weiter `caughtByPrescan` |
| Negativ-Kontrollen (r14/r15/r18/r21) | **0 CRITICAL, 0 WARNING False Positives** |
| Unit-Tests | `packages/prescan` 127/127 (sieben Review-Fälle als Still-Tests, vorher rot), `npm test` 1225 passed / 21 skipped, 0 Fails |

Kein LLM-Lauf, kein Vertex-Call.

## Prescan v4 (2026-09-24): Config-Engine-Lücken geschlossen — Prescan-only 49/126, 0 FP; SEC-019 (letzter stabiler Miss) jetzt deterministisch

Nur 0-Token-Lanes gemessen (kein LLM-Lauf, kein Vertex-Call — Volllauf wartet auf Freigabe). Design-Entscheidungen und Guards: `docs/specs/pre_scanner_design.md` §9.

**Neu deterministisch (`@unslop/prescan` 0.4.0, 50 Regel-IDs):** SEC-019 (Next-Middleware/Express/Flask ohne Security-Header, mit `next.config.*`-Begleitdatei aus dem Worker — *seit 2026-09-26 nur noch Next, s. Revision oben*), SEC-032/033/034 (Terraform-HCL über eigenen Reader + CloudFormation/SAM YAML/JSON), SEC-042/043 (Claude-Code-Settings), `pyproject.toml` in der Registry-Engine (PEP 621/735, Poetry, uv, PDM, build-system). **Bewusst NICHT deterministisch:** MAINT-009 — Peer-Deps (`react-dom`), implizite Runtime-Deps (`sharp`) und Nutzung außerhalb des Diffs sind aus der Diff-Sicht nicht von „ungenutzt“ zu unterscheiden (gleiche Logik wie CONC-008/SEC-012/SEC-021).

| Messung | Wert |
|---|---|
| Prescan-only, alle 21 Bundles (`--prescan-only`) | **49/126 (38,9 %)**, vorher 46/126 (v3-Referenz `results/2026-08-25-prescan-only-v3.json`) |
| Negativ-Kontrollen (r14/r15/r18/r21) | **0 CRITICAL, 0 WARNING False Positives** |
| Ziel-Bundle r08 | `middleware.ts` **SEC-019 ✓** (Zeile der ersten Response-Header-Mutation), kein Kollateral-Finding (2 Findings = SEC-026 + SEC-019) |
| Ziel-Bundle r12 | `exporter-role.tf` **SEC-032 ✓**, `order-functions.tf` **SEC-033 ✓** (2 Findings, je Funktion), `pdf-render.tf` SEC-034 bewusst still (keine Own-Account-Kontrast-Evidenz in der Datei — bleibt LLM-Fund) |
| Unit-Tests | `packages/prescan` 125/125 (+35), `npm test` 1220 passed / 21 skipped (einziger Fail: `git.test.ts`-Timeout-Flake, ROADMAP §8, isoliert 18/18) |

**Erwartung für den nächsten Volllauf:** combined 126/126, da SEC-019 der einzige stabile Miss war (Stand 2026-09-16: 125/126). Nicht behauptet, bis gemessen.

**Fixture-Universum unverändert:** SEC-042/043 bleiben in `excluded-rules.json` (LLM-Lane kann sie aus einem Hunk nicht attribuieren; neue Fixtures würden die 126er-Referenzreihe brechen). Rohdaten dieses Laufs wurden nicht als datierte Datei eingecheckt — `last-run.json` ist ein Wegwerf-Artefakt; die Zahlen oben sind der Beleg.

---

## Eskalations-Rolle auf Gemini 3.8 (2026-09-17): Degeneration erklärt + repariert, r20 18/18 + 17/18, Second Opinion 13–20 s — ENTSCHEIDUNG: Eskalation → 3.8 (medium, eu, Draft-Cache)

Anlass: ROADMAP-Ziel „Eskalation auf 3.8" (−50 % Kosten) mit zwei Blockern aus dem 03.09.-Lauf (JSON-Degeneration 3/7, `high`-Timeout). Statt weiterer Volllaeufe zuerst ein **Probe-Harness** gegen den echten r20-pro-direct-Prompt (System 28.877 Zeichen, Contents 60.156 Zeichen, 20.098 Tokens), das pro Call `finishReason`, Antwort-/Thinking-Tokens, Latenz und die Parse-Ausfallart protokolliert. Entscheidung und Architektur in `MODEL_STRATEGY_2026-08.md` §1h.

**Probe 1 — Ursache der Degeneration** (3.8, Thinking-Default medium, `responseMimeType: application/json`, kein Schema):

| Endpoint | Calls auswertbar | JSON ok | kaputt | Ausfallart | Latenz Ø / max | Antwort / Thinking Ø |
|---|---|---|---|---|---|---|
| global | 4 (+2× 429) | 2 | **2** | beide `finishReason=STOP`, Klammern balanciert, `JSON.parse` stirbt in **Zeile 54 Spalte 45** | 44 s / 53 s | 3,2k / 3,9k |
| eu | 6 | 5 | **1** | identisch: Zeile 54 | 49 s / 72 s | 3,3k / 2,9k |

Zeile 54 ist in allen drei Fällen dieselbe: `"exact_quote": "      <div className="comment__rich-text" dangerouslySetInnerHTML=…"` — das Modell zitiert JSX mit `"` und vergisst das `\"` (die erfolgreichen Calls schreiben `\"`). **Kein Abbruch, kein fehlendes `issues`-Array, kein Endlos-Output** — ein lokaler Escaping-Fehler, 3 von 10 erfolgreichen Calls, endpoint-unabhängig. Fix an der Validation-Boundary (`helpers.ts: parseModelJson`, Quote-Repair vor dem Steuerzeichen-Repair, 5 neue Tests): alle drei gespeicherten Antworten parsen danach (18 / 16 / 16 Issues).

**Probe 2 — Alternativen:** (a) `responseJsonSchema` (eu, 6 Calls): 5/5 syntaktisch sauber (1× `fetch failed` nach 40 s), aber +333 Prompt-Tokens, Thinking Ø 5,7k statt 3,1k und **`fixed_code_snippet` nur 1× statt 17× pro Antwort** → verworfen (entwertet `--fix`). (b) Thinking `high` (eu, 4 Calls): 1 ok bei **169 s / 27k Thinking-Tokens**, 3× 429/503 — bestätigt den 03.09.-Blocker; nicht unter 300 s fahrbar. (c) Deadline-Verhalten live geprüft: `AbortSignal.timeout` → SDK wirft DOMException `AbortError` nach exakt der Frist.

**Gate-Läufe nach Policy §1f Punkt 3** (echte Cascade, `--keep`, Draft 3.8 medium, Verifier 3.6, Eskalation 3.8 medium auf eu mit Explicit Cache, 150-s-Deadline; Rohdaten `results/2026-09-17-esc38-*.json`):

| Pfad | Ergebnis | Eskalations-Call | Cache | Kosten (×0,5 Intro) |
|---|---|---|---|---|
| **r20 pro-direct ×2** (`escalate_full`) | **18/18** (MAINT-003 erstmals unter `medium`) und **17/18** (= Pro-Referenz), Score 98 / 98, **0 parse_error, 0 Retries** | Ø 38,4 s / max 40,2 s, Output Ø 6,7k | Job 1 `explicit_created`, Job 2 `explicit_hit` — **6.877 von 20.098 Tokens aus dem Draft-Cache** | **$0,078 für 2 Calls ≈ $0,039/Call** (Pro-Referenz ≈ $0,17 → −77 %; Listenpreis ≈ $0,078/Call → −54 %) |
| r17 ×2 (Prod-Konfiguration) | Draft 7/7 ×2 → **Second Opinion nicht getriggert** (kein Draft-Miss); 1 False Refutation TEST-002 durch den unveränderten 3.6-Verifier (Prescan deckt, Surviving 14/14) | — | — | $0,12 |
| r17 ×2 mit `UNSLOP_DRAFT_THINKING_LEVEL_OVERRIDE=low` (Trigger erzwungen) | Draft 6/7 + 5/7 → Second Opinion **2/2 `ok`**, combined 7/7 und 6/7 (**TEST-007 Miss = Pro heute**) | `escalate_second_opinion` **Ø 16,8 s / max 20,5 s** (03.09. unter `high`: 2/2 Timeout nach 306 s), Output Ø 2,5k | **2/2 `explicit_hit`**, 4.354 von ~5.300 Tokens gecacht | $0,069 gesamt |

**Lesart:** Beide Policy-Gates erfüllt — parse_error-Rate 0/4 auf den 20k-Prompts (≤ Pro) und max 20 s im Second-Opinion-Pfad (< 200 s). Qualität ≥ Pro auf allen drei Pfaden (r20 17–18/18, TEST-007 bleibt der gemeinsame Miss). Der Cache-Effekt ist real: die Eskalation zahlt den Law-Prefix zum Cache-Preis, weil sie den Key des Drafts trifft. **Prod-Receipt (2026-09-17, Deploy `dpl_TeDyUogf` aus Commit `1965da5`):** CLI-Scan gegen `unslop.codes` auf einem lokalen Branch von `unslopai/test` mit den r20-Dateien (+2 Duplikate, damit 16 reviewbare TS-Dateien → pro-direct) → Job `b1c259f1` `done`, Score 97, 16 CRITICAL-Findings inkl. des JSX-XSS-Falls aus Probe 1 (Quote-Repair-Pfad also live durchlaufen oder Escaping korrekt); `review_job_llm_calls`: `escalate_full` · `gemini-3.8-flash` · `ok` · `explicit_created` · 47,7 s · 17.468 Prompt / 4.544 cached / 9.368 Output. Damit ist der Cutover per DOC-001 „done"; `UNSLOP_ESCALATION_LEGACY_PRO` bleibt als Rollback bis zum Hygiene-To-Do.

## Verifier-Rolle auf Gemini 3.8 (2026-09-17): 0 False Refutations, aber +40 % Verify-Latenz — ENTSCHEIDUNG: Verifier bleibt 3.6

Erster Lauf des neuen Verifier-Harness (`UNSLOP_VERIFIER_MODEL_OVERRIDE=gemini-3.8-flash`, Draft 3.8 = Prod-Default, Eskalation 3.1-pro, `--keep`); Rohdaten `results/2026-09-17-verifier38-full.json`. Messgrößen laut Policy §1f Punkt 2: False-Refutation-Rate und Surviving gegen den unveränderten Draft.

| | Verifier **3.6** (Lauf 2026-09-16) | Verifier **3.8** (2026-09-17) |
|---|---|---|
| False Refutations | 1 (r07, Condition 11 — Surviving trotzdem 11/11 via Aggregation) | **0** |
| Surviving / Combined | 125 / 125 | 124 / 124 (Delta liegt im Pro-pro-direct r20: 15/18 Draft, MAINT-003 — nicht in der Verifier-Lane) |
| False Positives (4 Kontrollen) | 0 | 0 |
| Targeted Pro-Eskalationen (Verifier UNCERTAIN) | 0 | 1 ($0,02) |
| Verify-Call Latenz Ø / max (erfolgreiche Calls) | **11,8 s / 19,4 s** | **~17 s / 34 s** |
| Verify-Call Output Ø (inkl. Thinking) | 2.909 | 2.583 |
| Verify-Lane Kosten | $0,23 (×0,5 Intro) | ~$0,26 (×0,5 Intro — für 3.8 belegt 17.09., s. Cutover-Sektion) |
| Retries / Degenerationen | 0 | 1 `api_error` = **Verbindungsabbruch `fetch failed` nach 144 s** (kein HTTP-Status), Sofort-Retry clean in 11 s; 0 Degenerationen |

Draft-Lane in diesem Lauf (unverändert 3.8): 106/108 auf den Flash-Routen wie am Vortag; Draft-Latenz Ø 30 s / **max 86 s** — der Tail (173 / 49 / 86 s in drei Läufen) bleibt real.

**Lesart:** Qualitativ ist 3.8 als Verifier mindestens gleichwertig (0 vs. 1 False Refutation — bei N=1 kein Signal, beide Läufe liefern volles Surviving). Der Preis dafür ist messbar: +5 s Ø und +15 s max pro Scan auf einem Call, der sequenziell hinter dem Draft läuft, bei gleichen Kosten (Intro-Gutschrift für 3.8 am 17.09. belegt). Kein Gewinn, der die Latenz rechtfertigt. **Entscheidung 2026-09-17: Verifier bleibt 3.6.** Wiedervorlage, falls (a) Prod-Telemetrie ein False-Refutation-Muster des 3.6-Verifiers zeigt oder (b) 3.6 ein Shutdown-Datum bekommt. Beifang: der `fetch failed`-Fall deckte auf, dass ein Verbindungsabbruch auf dem DRAFT-Call den Job gekillt hätte (kein HTTP-Status → kein Backoff) — gefixt, ROADMAP §3t.

## Gemini-3.8-Flash Cutover-Lauf (2026-09-16): Draft 124/126, combined 125/126, 0 FP, max Draft-Latenz 49 s — ENTSCHEIDUNG: Draft → 3.8

**Nachtrag 2026-09-30 (LANGUAGE_COVERAGE_SPEC §7.1):** 125/126 ist **Modell-Potenzial**. Der Runner gab in diesem Lauf jede Fixture-Datei an das Modell und umging `isReviewableFile`. 69 der 126 Verstöße liegen in Dateien, die das Modell in Produktion nicht liest; auf dem Produktionspfad dieses Tages lag der Wert rechnerisch bei 59/126. Seit 2026-09-30 fährt der Runner den Produktionspfad als Default, dieser Lauf entspricht `--bypass-filter`.

Zweiter Volllauf mit `UNSLOP_DRAFT_MODEL_OVERRIDE=gemini-3.8-flash` (Thinking-Default medium), Verifier 3.6, Eskalation 3.1-pro, `--keep`; Rohdaten `results/2026-09-16-flash38-full-run2.json`. Zweck: die N=1-Frage vom 03.09. klären (Qualitätsgewinn real oder Tagesschwankung?) und die Latenz ein zweites Mal sehen.

| | Lauf 1 (03.09.) | **Lauf 2 (16.09.)** | 3.6 (gleicher Prompt seit ce17a4f) |
|---|---|---|---|
| Draft-Recall | 122/126 | **124/126 (98,4 %)** | 122 (01.09.), 117 (03.09.) |
| Combined / Surviving | 124 / 123 | **125 / 125 (99,2 %)** | 122 / 120 |
| False Positives (4 Kontrollen) | 0 | **0 CRITICAL, 0 WARNING** | 0 |
| Draft-Call Latenz Ø / max | 46,2 s / 173 s | **27,1 s / 48,9 s** (alle 20 < 60 s) | 14,8 s / 26 s |
| Draft-Call Output Ø (inkl. Thinking) | 4.095 | 4.145 (max 9.401) | 3.361 |
| Cache-Quote Draft | — | 75 % (`explicit_hit` ab dem zweiten Bundle je Profil) | 72 % |
| Retries / Degenerationen | 0 | **0 / 0** (20/20 `ok`, kein VertexRetry, kein parse_error) | je 1× Degeneration in älteren Läufen |
| Kosten Volllauf | ≈ $0,77 (Listenpreis $1,14) | **$0,84** (Listenpreis $1,22: 3.8-Draft $0,76 → $0,38 mit der am 17.09. belegten ×0,5-Gutschrift, 3.6-Verify $0,23, Pro $0,23) | $0,78 |

Misses: **SEC-019@r08** (Dauerkandidat — auch der beste 3.6-Lauf fand ihn nicht) und CONC-008@r10 nur im Draft (Prescan deckt ihn, combined ok). 1 False Refutation auf r07 (Condition 11|ARCH-001 @ OrderSummary.tsx) durch den **3.6-Verifier**, nicht den Draft — Surviving trotzdem 11/11 über die Aggregation; N=1, Verifier-Lane unverändert. Latenz korreliert mit dem Thinking-Volumen (49-s-Call = 9.401 Output-Tokens); der 173-s-Ausreißer vom 03.09. (GA+1) trat nicht wieder auf — Google-seitige Lastschwankung, die Prod genauso sieht.

**Lesart:** Zwei 3.8-Läufe (122, 124) liegen beide auf oder über dem besten 3.6-Wert bei gleichem Prompt (122); 3.6 streut stärker (117–122). Der Qualitätsgewinn ist damit belastbar, der Latenz-Tail bleibt ein Risiko für *langsame* (nicht gescheiterte) Scans: 173 + 15 + 90 s bleibt unter dem 300-s-Routenbudget. **Entscheidung 2026-09-17: Draft → 3.8 (medium), Verifier bleibt 3.6, Eskalation bleibt Pro** (`MODEL_STRATEGY_2026-08.md` §1f, ROADMAP §3u); Definition of Done ist ein Prod-Latenz-Receipt auf `unslopai/test` PR #14.

## Gemini-3.8-Flash-A/B (2026-09-03): Draft 122/126 + combined 124/126 — Bestwerte, aber 3× Latenz; Eskalations-Rolle NICHT reif (JSON-Degeneration 3/7)

Anlass: `gemini-3.8-flash` GA seit 02.09. (Fine-Tune auf 3.7-Basis). Sieben Läufe am selben Tag, alle mit `--keep` und Kosten-Receipt aus der Telemetrie (Rohdaten `results/2026-09-03-*.json`). **Neu seit diesem Tag:** `output_tokens` ist abrechnungstreu (Antwort + Thinking, s. Beifang unten) — die Output-Zahlen sind deshalb NICHT mit älteren Receipts vergleichbar, darum die 3.6-Baseline vom selben Tag.

**Draft-Rolle** (Verifier fix 3.6, Eskalation fix 3.1-pro; Volllauf 126 Verstöße, 4 Negativ-Kontrollen):

| Draft-Konfiguration | Draft | Combined | Surviving | FP | Draft-Call Ø/max Latenz | Draft-Call Ø Output (inkl. Thinking) | Draft-Lane Listenpreis | Misses |
|---|---|---|---|---|---|---|---|---|
| **3.6-flash (Prod, Baseline heute)** | 117/126 | 120/126 | 119/126 | 0 | 14,8 s / 26 s | 3.361 | ≈$0,63 | ARCH-003@r04, SEC-025@r05, SEC-019@r08, CONC-008@r10, TEST-007@r17, MAINT-003@r20 |
| **3.8-flash, Thinking Default (medium)** | **122/126** | **124/126** | **123/126** | 0 | **46,2 s / 173 s** | 4.095 (+22%) | $0,75 (+19%) | SEC-019@r08, MAINT-003@r20 (beide Pro-Pfad-Misses, nicht Draft) |
| 3.8-flash, Thinking `low` | 113/126 | 118/126 | 118/126 | 0 | 13,1 s / 28 s | 1.087 (−68%) | $0,26 (−59%) | r06 3/10 (Einbruch), r17 Draft 5/7, SEC-019, MAINT-003 |
| 3.8 `low` Wiederholung r06+r17 ×2 | r06 9/10 + 10/10, r17 6/7 + 6/7 | r06 9/10 ×2, r17 7/7 ×2 (SecOp) | — | 0 | 11,2 s / 12 s | 1.813 | — | r06-Einbruch war N=1-Varianz, aber `low` streut sichtbar (r06 Draft 3→9→10) |

Lesart: 3.8 (medium) ist der erste Draft, der r17 komplett direkt findet (7/7) UND r05/r06/r10 sauber hält; die beiden Rest-Misses (SEC-019 Dauerkandidat, MAINT-003 im pro-direct auf 3.1-pro) liegen nicht in der Draft-Lane. Preis dafür: **3× Latenz** (max 173 s auf r20-ähnlichen Bundles — die Routen haben 300 s `maxDuration`, Draft+Verify+Eskalation laufen sequenziell) und +22% Output-Tokens. `low` kauft die Latenz zurück, verliert aber Recall und streut.

**Eskalations-Rolle** (`UNSLOP_ESCALATION_MODEL_OVERRIDE=gemini-3.8-flash`, Draft/Verifier 3.6):

| Pfad | 3.8 Default | 3.8 Thinking `high` | 3.1-pro (heute) |
|---|---|---|---|
| r20 pro-direct (18 Dateien, ~20k Prompt) | 17/18, 17/18, **1× doppelter parse_error → Degradation auf Flash-Kaskade (16/18)** | **18/18 in 2/2** (MAINT-003 erstmals gefunden; 1× parse_error, Retry ok), Ø 164 s / max 191 s | 17/18 (MAINT-003 Miss) |
| r17 Second-Opinion | 0 neue Issues ×3 → TEST-007 Miss (6/7) | **2/2 `fetch failed` nach exakt 306 s** (Undici-Header-Timeout = Vercel `maxDuration`) | TEST-007 heute ebenfalls Miss |
| r05/r07 escalate_targeted | nicht ausgelöst (Verifier bestätigte alle Claims) | — | — |
| JSON-Degeneration `escalate_full` | **3 parse_error auf 7 Calls (43%)** | s. links | 0/4 |

Lesart: Qualitativ ist 3.8 in der Eskalations-Rolle ≥ 3.1-pro (Default gleichauf, `high` erstmals 18/18), aber **zwei harte Blocker**: (1) JSON-Degeneration auf den langen pro-direct-Prompts in 3 von 7 Calls — die Draft-Rolle (7k Prompt, 44 Calls) zeigte 0 — der einmalige Parse-Retry reicht dort nicht; (2) `high` sprengt im Second-Opinion-Pfad das 300-s-Budget ohne Streaming/Worker. Kosten pro pro-direct-Call (Listenpreis): 3.8 ≈ $0,08 vs. Pro ≈ $0,17.

**Kosten heute gesamt ≈ $3,7 Listenpreis** (3.8 damals ohne Intro-Gutschrift gerechnet — **am 17.09. per September-Billing-CSV belegt: −50 % auf allen sechs 3.8-SKUs**, real also niedriger; 3.6/3.7 ×0,5 seit August belegt). Volllauf-Receipts: Baseline 3.6 $0,78, 3.8-medium $1,14, 3.8-low $0,73 (jeweils inkl. Verifier + Pro-Eskalationen, Telemetrie vor Job-Cleanup).

**Beifang (echter Prod-Befund):** `extractTokenUsage` las nur `candidatesTokenCount`; Vertex liefert Thinking separat in `thoughtsTokenCount` und rechnet es zum Output-Preis. Alle Kosten-Receipts vor dem 03.09. sind auf der Output-Seite zu niedrig (Probe: 16 Input-Tokens → ~190 Thought-Tokens; 3.6-Draft real Ø 3.361 Output statt der früher sichtbaren ~1.200). Gefixt in `helpers.ts` + 3 Tests; `UNIT_ECONOMICS.md` §4.2 korrigiert. Neu: `scripts/benchmark-phase-stats.ts` (Latenz/Output/Cache je Phase×Modell) und der Thinking-Level-Harness `UNSLOP_DRAFT_THINKING_LEVEL_OVERRIDE` / `UNSLOP_ESCALATION_THINKING_LEVEL_OVERRIDE` (models.ts, 4 Tests).

**Entscheidung:** offen (Vorlage in `MODEL_STRATEGY_2026-08.md` §1e, ROADMAP §6). Empfehlung: Draft-Wechsel auf 3.8 (medium) nur mit Latenz-Guard bzw. Prod-Latenz-Receipt; Eskalation bleibt 3.1-pro, bis Degeneration und `high`-Timeout adressiert sind.

## M1-Migrations-Gates (2026-08-26): 125/126 (99,2%) — BESTANDEN

Gate-Läufe der M1-Migration (`MODEL_MIGRATION_SPEC.md` §5) auf der ECHTEN Ziel-Verkabelung: 3.6-flash @ eu-Multiregion **mit Explicit Cache** (nicht global/inline wie der A/B). Rohdaten: `results/2026-08-26-m1-gate-full.json` + `-r02.json` + `-controls2/-controls3.json`.

| Gate | Soll | Ist |
|---|---|---|
| G1 Recall | combined ≥ 122/126 | **125/126 (99,2%)** — einziger Miss SEC-019@r08; Draft-Lane 118+4 (über der 2.5-Baseline 110) |
| G2 Präzision | 0 CRITICAL-FP, Kontrollen ×3 | **0 FPs jeder Art** über r14/r15/r18/r21 ×3 |
| G3 Cache | `explicit_hit` auf eu, cached-Anteil ≥50% | **72% cached Input** (179.772/249.956), 12× `explicit_hit` nach 1× `explicit_created` pro Variante; r02-Lauf 84% |
| G4 Kosten | Receipt mit Regional-Preisen | **$0,4632/Volllauf** (3.6: $0,377, Pro: $0,086) — unter der $0,55-Erwartung dank Cache + Verify-Skip auf Clean-Scans |
| G5 Robustheit | Degeneration ohne Job-Fehler | 1× degeneriertes JSON (r02) im ERSTEN Lauf — führte VOR dem Fix zum Fixture-Fehler → **einmaliger Parse-Retry in `reviewer-call.ts` nachgerüstet** (Test belegt Heilung + parse_error/ok-Telemetrie-Paar); Wiederholung 4/4 clean, danach 0 Vorkommen |

Der Cache verbessert nebenbei den Recall: 125 vs. 123 im inline-A/B (ARCH-003@r04 und CONC-008@r10 wurden diesmal gefunden — N=1, aber konsistent mit der These, dass der stabile Law-Prefix dem Modell hilft).

---

## Draft-Model-A/B (2026-08-26): Gemini 3.6/3.7/3.5 Flash schlagen die Baseline deutlich; Flash-Lite disqualifiziert

Läufe des A/B-Harness (`UNSLOP_DRAFT_MODEL_OVERRIDE`, `_ENDPOINT=global` wo nötig). Verifier/Eskalation blieben konstant (2.5-flash / 3.1-pro). **Caveat aller 3.x-Läufe: Pro-Eskalationsbudget stand auf 50/50** — die Draft-Lane ist sauber vergleichbar, Combined ist leicht unterschätzt (z.B. hätte SecOp den TEST-007-Miss von 3.5 gedeckt). Rohdaten: `results/2026-08-26-flashlite-*.json`, `-flash37-full.json`, `-flash37-r20.json`, `-flash35-full.json`.

| Draft-Modell | Draft-Recall | Combined | FPs (4 Kontrollen) | Robustheit | Preis $/M in/out | Endpoint / Cache |
|---|---|---|---|---|---|---|
| **gemini-2.5-flash** (Ist) | 110/126 (87,3%) | 122/126 | 0 | 0 Fehler | 0,075 / 0,30 | EU ✓ / Cache ✓ (~70% Hits) |
| gemini-2.5-flash-lite | **55/126 (43,7%)** | 73/126 | 9 WARNING | ok | (n. erhoben) | nur global / inline |
| **gemini-3.5-flash** | **119/126 (94,4%)** | 123/126 | **0** | 0 Fehler in 21 Fixtures | 1,50 / 9,00 | **EU ✓ / Cache ✓ (belegt: 14 hits)** |
| **gemini-3.7-flash** | **~121/126 (96,0%)**¹ | 124/126¹ | **0** | 1× kaputtes JSON in 3 r20-Versuchen | **Intro 0,75 / 3,75** (bis 31.12.26, dann 1,50/7,50)² | nur global / inline |
| **gemini-3.6-flash** *(Nachmessung, MIT Pro-Budget)* | **121/126 (96,0%)** | **123/126 (97,6%) — bester je gemessener Volllauf** | **0** | 1× degeneriertes JSON auf r17 (valide Syntax ohne `issues`-Array; Retry clean 7/7)³ | 1,50 / 7,50 (SKU-verifiziert; Intro ohne SKU-Beleg)² | nur global / inline |

¹ 105/108 im Hauptlauf (r20 errored an einem 3.7-JSON-Parse-Fehler) + r20-Retry 16/18 (best of 2). 3.7 fand als EINZIGES Modell SEC-012, SEC-021 UND CONC-008 im Draft; r17 allein 6/7 (der Second-Opinion-Trigger wurde überflüssig).
² Preis-Korrektur 2026-08-26: der SKU-Katalog des Accounts führt für 3.6/3.7 nur den Standardpreis 1,50/7,50 (global; Regional +10%) — der beworbene Intro-Rabatt existiert nicht als SKU und ist bis zu einem Rechnungs-Beleg nicht zu unterstellen. Die 2.5-Spalte oben (0,075/0,30) war der falsche `vertex-pricing.ts`-Fallback; real 0,30/2,50.
³ 3.6-Lauf 2026-08-26 (`-flash36-full/-part2/-part3.json`, einziger 3.x-Lauf mit verfügbarem Pro-Budget): Draft-Lane 121/126, combined 123/126, Misses nur ARCH-003@r04, SEC-019@r08, CONC-008@r10; **alle 7 r17-TEST-Regeln direkt im Draft, kein einziges SecOp-Finding nötig**; 0 FPs über alle 4 Kontrollen. Kosten-Receipt (SKU-verifizierte Preise): **$0,50/Volllauf** (3.6 inline $0,31 + 2.5-Verifier mit Cache $0,06 + Pro $0,13). Der r17-Ausfall deckte eine Validation-Boundary-Lücke auf (`undefined.map` in `reviewer-call.ts` statt parse_error) — gefixt + Test; JSON-Degeneration ist damit ein 3.x-FAMILIENrisiko, nicht 3.7-exklusiv.

**Befunde:** (1) Flash-Lite kollabiert quer durch alle Sprachen — unbrauchbar. (2) Die 3.x-Generation ist ein Qualitätssprung: +9 bzw. +11 Regeln Draft-Recall bei 0 FPs. (3) Preis-Paradox: das neuere 3.7 ist (Intro) billiger als 3.5. (4) 3.7 ist global-only (GDPR!) und ohne Cache; 3.5 läuft in europe-west3 UND über den Explicit Cache. (5) 3.7 hatte einen JSON-Robustheitsausfall auf dem 18-Dateien-Diff (1/3). **Modellwechsel ist eine Produktentscheidung (Kosten/GDPR/Cache) — nicht im A/B entschieden**; Optionen inkl. „3.7 als Eskalations-Ersatz statt Pro" (~65% billiger) in ROADMAP §6.

Nebenbefund des Flash-Lite-Laufs: erster Live-Beweis des Second-Opinion-Degradationspfads (Trigger `test-gap` auf r17 feuerte, degradierte ehrlich per `skipped_budget` — als Telemetrie-Zeile der neuen Phase persistiert; Migration 044 war Stunden zuvor live gegangen).

---

## Second-Opinion-Epic (2026-08-26): 122/126 (96,8%) — die TEST-Misses sind zu

Umsetzung von `LLM_LANE_QUALITY_SPEC.md` (neuer Step `second-opinion-reviewer` + Rig-Flags `--cascade`/`--runs`, ROADMAP §3r). Rohdaten: `results/2026-08-26-phase0-*.json` (Messkampagne), `-secop-r17.json` (Zielmessung), `-secop-controls.json` (FP-Gate), `-secop-full.json` + `-full-part2.json` (A/B-Volllauf; Teil 1 verlor 11 Fixtures an eine Vertex-429-Welle, Teil 2 holte sie fehlerfrei nach).

| Messung | Wert |
|---|---|
| **Phase 0 (Force-Pro, `--cascade heuristicMaxDiffTokens=1,heuristicMaxFiles=1`)** | Pro findet **alle** semantischen Misses: TEST-003/007/011, SEC-012, SEC-021, CONC-008 je **2/2**; r03/r10/r17 kombiniert 100%. MAINT-003@r20 ist ein Pro-Flake (1/2), kein stabiler Miss. Kontrollen unter Force-Pro ×3: 11/12 Läufe clean — einziger FP wieder MAINT-001@r18 (3/3, modellübergreifend!) |
| **Zielmessung r17 (Step aktiv)** | **7/7 (100%) in 2/2 Läufen** (vorher 4/7) — T1 feuert auf die 3 finding-losen Test-Dateien, SecOp fängt TEST-003/007/011 je 2/2, Score 98 |
| **FP-Gate (Kontrollen ×3, Normalmodus)** | Trigger feuert **nie** (SecOp-Spalte leer); einzige FPs = der vorbestehende r18/MAINT-001-Flash-FP (2/3) |
| **A/B-Volllauf (21 Bundles)** | **122/126 (96,8%)** kombiniert vs. 118/126 Referenz; Draft 111/126, Prescan 46/126, SecOp 4/126 (nur r17 — chirurgisch, keine Streuung); r20 diesmal 18/18 |
| Verbleibende Misses (4) | SEC-012, SEC-021 (r03), SEC-019 (r08), CONC-008 (r10) — alle in Dateien/Kontexten, auf die per Design kein Trigger zielt; laut Phase 0 Pro-erreichbar, Hebel wäre Trigger-Verbreiterung oder pro-direct (bewusst nicht: Kosten) |

**Design-Lehre der Session:** Die erste T1-Fassung („0 Findings in Test-Dateien insgesamt") hätte r17 verfehlt — dort liegen die Misses in finding-losen Dateien NEBEN gefundenen. Der Trigger arbeitet deshalb **per Datei**. Und: die Benchmark-Cascade sieht `prescanIssues` nicht (Lane-Trennung des Rigs), das Subset ist im Rig daher etwas größer als in Produktion — konservativ in Kosten, identisch im Recall-Beweis.

**Nachtrag (gleicher Tag): der r18/MAINT-001-„FP" ist AUFGEKLÄRT — Fixture-Defekt, kein Modell- oder Verifier-Problem.** Specimen (Job-Telemetrie, Verdict-Details): der Flash-Verifier REFUTED den Claim („State-Flip = Kompensation"), das eskalierte Pro CONFIRMED ihn („Error-Objekt wird ohne Logging/Rethrow verworfen — Diagnostik zerstört"). Beide Lesarten sind vertretbar, weil `TeamMemberList.tsx` den Fehler tatsächlich verwarf und MAINT-001 wörtlich „at least log it with context" verlangt — die Negativ-Kontrolle saß exakt auf der Mehrdeutigkeitslinie (6/6 Läufe, modellübergreifend). Fix in der Fixture (Catch loggt jetzt mit Kontext), danach **3/3 Läufe clean, Score 100**. Lehre in `AUTHORING.md` verankert: saubere Fixtures müssen den BUCHSTABEN der Regel erfüllen, nicht nur ihren Geist. Damit steht die Negativ-Kontroll-Präzision wieder auf **0 FP über alle 4 Kontrollen**, und der A/B-Volllauf oben wäre ohne diesen Fixture-Defekt FP-frei gewesen.

---

## Referenzlauf (2026-08-24→26): 118/126 (93,7%) kombiniert GEMESSEN, ≈$0,30 pro Volllauf (Kosten-Korrektur s. Tabelle)

Der erste echte 21-Bundle-Volllauf nach Prescan v2/v3 — der Wert, den die früheren Nachträge nur projizieren konnten. Rohdaten: `results/2026-08-25-full-v3-reference.json` (r01–r07) + `results/2026-08-26-full-v3-reference-part2.json` (r08, r13–r15, r19, r21) + `-part3.json` (r09–r12, r16–r18, r20 mit Pro-Budget).

| Messung | Wert |
|---|---|
| **Kombinierter Recall (Draft ∪ Prescan)** | **118/126 (93,7%)** |
| Draft-Recall (LLM-Lane allein) | 110/126 (87,3%) — punktgleich mit der Baseline, aber andere Zusammensetzung (u.a. SEC-035 nie, SEC-001@r20 nur via Pro) |
| Prescan-Recall (deterministisch, 0 Token) | 46/126 (36,5%) |
| False Refutations | 0 |
| r20 pro-direct (18 Dateien) | **17/18** (nur MAINT-003; SEC-001 wurde von Pro recovered, das die degradierte Flash-Variante verpasste) |
| Negativ-Kontrollen | r14/r15/r21 sauber (inkl. der neuen ARCH-005/CONC-003-FP-Wächter); **r18: 1 LLM-FP** (s.u.) |
| **Kosten (Telemetrie-Receipt, Listenpreise)** | **$0,1807** für alle 32 Jobs des Laufs (70 LLM-Calls; Flash draft+verify zusammen $0,035 dank ~70% Cache-Hits, Pro $0,146) — der kontaminierte Erstversuch kostete zusätzlich $0,2051. **⚠️ Korrektur 2026-08-26: der Flash-Anteil wurde mit den falschen `vertex-pricing.ts`-Fallback-Preisen (0,075/0,30 statt SKU-verifiziert 0,30/2,50) gerechnet — real ≈ $0,15 Flash statt $0,035, Volllauf also ≈ $0,30** (Pro-Anteil war korrekt bepreist; Modul-Fix + SKU-Belege s. ROADMAP §6) |

**Die 8 verbleibenden Misses** (alle bekannt/semantisch, ROADMAP §16): SEC-012, SEC-021 (r03), SEC-019 (r08), CONC-008|CONC-001 (r10), TEST-003/007/011 (r17), MAINT-003 (r20).

**Neuer Präzisions-Befund:** r18-clean-ts trägt eine reproduzierbare **LLM-Lane-FP-Neigung** — MAINT-001 (anti_pattern) auf `src/components/TeamMemberList.tsx`, in beiden Läufen dieser Session (einmal als WARNING downgraded, einmal CRITICAL durchgekommen). Kein Prescan-FP; die deterministische Lane blieb über alle Läufe bei 0 FP.

**Betriebs-Lehren des Laufs (für Wiederholungen):**
1. **Läufe nicht über Nacht stehen lassen**: Versuch 2a starb ab r08 an `fetch failed` — der Rechner ging in Standby, der Prozess lief morgens mit toter Verbindung weiter. Fixtures r01–r07 blieben gültig (Teilberichte sind additiv, `--only` + getrennte `--out`-Dateien).
2. **Vertex-429**: r09–r11 fielen einmal auf `RESOURCE_EXHAUSTED` und liefen im Retry sauber durch.
3. **Pro-Eskalations-Budget ist Teil der Messbedingungen**: Die Läufe brannten das Monatsbudget des Benchmark-Owners auf 50/50; danach degradierten r12/r16/r17/r18/r20 still (r20 sogar von pro-direct auf flash). Erst nach Zähler-Reset (Sandbox-Testdaten, User-Freigabe) und Re-Run waren die Zahlen referenztauglich — vor einem Referenzlauf `billing_accounts.escalation_month_count` des Owners prüfen.
4. Kostenrechnung IMMER vor `tmp-cleanup-jobs` (Telemetrie cascade-deleted mit den Jobs).

---

## v3-Nachtrag (2026-08-25): ARCH-005 + CONC-003 deterministisch; Explanation-A/B negativ (revertiert)

Fortsetzung entlang ROADMAP §16 (`@unslop/prescan` 0.3.0, ROADMAP §3q). Zwei neue deterministische Checks in `rules/ast/correctness-rules.ts`: **ARCH-005** (Go: Write in nie initialisiertes Map-Feld — feuert nur bei vollständiger In-File-Evidenz: Struct-Definition + leeres Composite-Literal + Write + kein `make()`/keyed-Init im File; Unmarshal-exempt) und **CONC-003** (C/C++: file-scope `volatile`-Skalar als Thread-Signal, gated auf Thread-Evidenz im File; `sig_atomic_t`/`_Atomic`/Pointer/Locals exempt). Neue FP-Wächter: Negativ-Kontrolle `r21-clean-go.diff` und die kanonische `sig_atomic_t`-Datei in `r15-clean-c.diff` (erwähnt bewusst „thread", damit die Exemption sich beweisen muss).

Parallel eine **Explanation-A/B-Runde** an den drei semantischen TEST-Misses (Migration `043`, angewendet via Data-Plane, Management-API down). Erstbefund: TEST-003 2/2 vom Draft gefunden, TEST-007/011 weiter 0/2. **Aber: die Schärfung wurde am selben Tag REVERTIERT** — der Volllauf mit den neuen Texten kollabierte r01-c-memory von 8/8 auf 3/8 Draft-Recall (3/3 Läufe identisch; nach Revert sofort wieder 8/8) und lag insgesamt bei Draft 101/126 statt 110. `public_explanation`-Änderungen sind Prompt-Änderungen mit globalen Nebenwirkungen (r01 läuft mit ungefiltertem Law-Block); +1 Regel gegen −5 ist ein klarer Nettoverlust. Protokoll: Migration `043` (dokumentiert Anwendung UND Revert, Netto-DB-Effekt null), `results/2026-08-25-r01-rerun1.json` / `-r01-revert-test.json`. TEST-003/007/011 bleiben offene Misses; nächster Hebel Eskalation/Modellwahl, NICHT längere Law-Texte.

| Messung (Rohdaten `results/2026-08-25-*.json`) | Wert |
|---|---|
| Prescan-only, alle 21 Fixtures | **46/126 (36,5%)**, 0 Token, **0 FP auf 4 Negativ-Kontrollen** |
| Voll-Lauf r02/r10/r17 (Run A) | r02 **4/4** (Baseline 3/4), r10 **5/6** (3/6), r17 5/7 (2/7; enthielt den revertierten TEST-003-Texteffekt — Referenz ist 4/7) |
| Projizierter Voll-Recall (nach Revert) | 119/126 — 110 Draft-Baseline + 9 deterministische Recoveries; **gemessen wurden 118/126** (MAINT-003@r20 fiel im Referenzlauf zusätzlich, s. Referenzlauf-Sektion) |
| Verbleibende Misses | TEST-003, TEST-007, TEST-011, CONC-008, SEC-012, SEC-019, SEC-021 — semantisch/Negative-Space (ROADMAP §16) |

CONC-008- und SEC-012-Heuristiken wurden bewusst NICHT deterministisch gebaut (FP-trächtig in echtem Code: Caller-Locking/sync.Map bzw. Seeds/Hash-in-Nachbarschicht) — der Benchmark ist das Messgerät, nicht das Ziel.

---

## v2-Nachtrag (2026-08-24, gleicher Tag): Deterministische Prescan-Lane — Combined Recall 70,3% → 86,5% auf den Ziel-Bundles

Die stabilen strukturellen Misses des Erstlaufs (Class 1, ROADMAP §16) wurden in den deterministischen Pre-Scanner verlagert (`@unslop/prescan` 0.2.0, ROADMAP §3p) und das Rig um eine **Prescan-Lane** erweitert: jede Fixture läuft jetzt zusätzlich durch die echten Produktions-Engines (verifier-exempt wie in Prod, die LLM-Prompts sehen die Prescan-Findings NICHT); gemessen werden Draft-, Prescan- und Combined-Recall getrennt. Neue Flags: `--prescan-only` (Zero-Token, keine DB-Jobs, gated nur auf FP/Errors) und `--only r05,r07,…` (Komma-Listen).

**Neue/erweiterte deterministische Checks:** TEST-002 (expect-Style-Roulette: ≥ 4 message-lose `expect()` in einem Test), TEST-005 neu (tautologische Assertions: `expect(true).toBe(true)`, `expect(x).toBe(x)`, Literal-vs-Literal; JS/TS + Python), COND-011 neu (JSX-Nesting > 4 Ebenen mit ≥ 2 Conditionals in der Kette ODER > 2 `useEffect` pro Komponente), HAL-002 neu (Denylist nicht existenter Go-Stdlib-APIs, `strings.ToLowerCase` & Co.). SEC-048 (iwr|iex) und SEC-035 (Registry-HEAD) existierten schon in v1 — hier erstmals empirisch belegt.

**Ergebnisse (Rohdaten `results/2026-08-24-prescan-only.json`, `results/2026-08-24-v2-targeted.json`):**

| Messung | Wert |
|---|---|
| Prescan-only, alle 20 Bundles | **44/126 (34,9%) deterministisch**, 0 Token, **0 FP auf allen 3 Negativ-Kontrollen** |
| Voll-Lauf (Cascade+Prescan) r05/r07/r10/r13/r17 | Draft **26/37 = exakt Baseline** (kein LLM-Regress), Combined **32/37 (86,5%)** vs. 70,3% Baseline |
| Recovered Misses (alle 6 Ziel-Regeln) | TEST-002, TEST-005, SEC-048, SEC-035, Condition 11, HAL-002 — jeweils Prescan-Hit auf exakt der gepflanzten Datei |
| Bonus | SEC-014@r20 (der pro-direct-Attention-Decay-Miss, Datei 12/18) ist prescan-gedeckt → r20 wäre kombiniert 18/18 |
| Projizierter Voll-Recall | **117/126 (92,9%)** — 110 Draft-Baseline + 7 Prescan-Recoveries mit Receipt; echter 20-Bundle-Voll-Lauf bewusst vertagt (Kosten), To-Do in ROADMAP §16 |

**Verbleibende Misses auf den Ziel-Bundles (erwartet, semantisch — nicht Single-Hunk-deterministisch):** TEST-003 (Happy-Path-only), TEST-007 (flache Mocks), TEST-011 (invertierte Authz-Logik), ARCH-005 (nil-map-Panik), CONC-008|CONC-001 (fehlende Geschwister-Mutex).

**Performance:** Nicht-Netzwerk-Engines 0–58 ms pro Bundle (Erstlauf inkl. tsx-WASM-Warmup, danach einstellig); einzige Ausreißer sind SEC-035-Registry-HEADs (netzwerkgebunden, 3-s-Timeout, Fehler ⇒ honest skip, nie Finding). Precision-Kontrolle über die Neg-Controls hinaus: alle Kollateral-Findings der Prescan-Lane auf den Ziel-Bundles waren selbst gepflanzte Verstöße (TEST-001 2× auf invoice-summary, MAINT-002 auf den SEC-031/MAINT-001-Dateien) — kein einziges unerklärtes Finding.

---

# Erstlauf-Ergebnisse (Baseline, LLM-only)

**Datum:** 2026-08-24 · **Rig:** `npm run benchmark:rules` (`scripts/rule-recall-benchmark.ts`, echte Cascade: complexity-router → draft → blind claim-verifier → Pro-Eskalation → integrity-scorer) · **Modelle:** draft/verify `gemini-2.5-flash`, escalation `gemini-3.1-pro-preview` · **Fixtures:** `fixtures/rule-recall/` (20 Bundles, 126 gepflanzte Verstöße, 3 Negativ-Kontrollen) · **Rohdaten:** `fixtures/rule-recall/results/2026-08-24-full.json` (+ Re-Runs r10/r15/r17)

**Bottom line:** Erstmals ist der Recall über (fast) das gesamte Regelwerk gemessen statt über 9 Diffs. **Draft-Recall 110/126 (87,3%)**, **0 False Refutations** (jedes vom Draft gefundene erwartete Finding überlebte den Verifier), **0 False Positives auf den Negativ-Kontrollen** (nach Reparatur einer unfairen C-Kontrolle), **17/18 auf dem 18-Dateien-pro-direct-Pfad** (keine „Top-3"-Trunkierung). Die 16 Misses sind kein Rauschen: sie clustern in zwei stabilen, reproduzierten Schwächen (TEST-Regeln, Go) plus einer Handvoll Negative-Space-Regeln.

## Abdeckung

119 Regeln in `golden_standards`, davon 100 detektierbar (mit `public_explanation`; die 19 ohne rendern eine neutrale Zeile und können nicht feuern). **95 Regeln gepflanzt, 5 begründet ausgeschlossen** (`excluded-rules.json`: SEC-042/043/044/046 = Agent-Architektur ohne Single-Hunk-Muster, TEST-004 = braucht Build). Zusätzlich alle 11 React/Next-Conditions. Der Offline-Guard (`src/lib/benchmark/rule-recall-manifest.test.ts`, läuft in `npm test`) erzwingt diese Vollständigkeit dauerhaft.

## Ergebnisse pro Bundle (Lauf 2026-08-24, vollständig)

| Bundle | Route | Gepflanzt | Draft | Überlebt | Score |
|---|---|---|---|---|---|
| r01-c-memory | flash | 8 | 8 | 8/8 | 96 |
| r02-c-concurrency | flash | 4 | 3 | 3/4 | 94 |
| r03-python-security | flash | 10 | 8 | 8/10 | 99 |
| r04-python-structure | flash | 6 | 6 | 6/6 | 99 |
| r05-ts-security | flash | 10 | 9 | 9/10 | 99 |
| r06-maintainability | flash | 10 | 10 | 10/10 | 95 |
| r07-react-conditions | flash | 11 | 10 | 10/11 | 95 |
| r08-react-security | flash | 3 | 2 | 2/3 | 93 |
| r09-java-spring | flash | 7 | 7 | 7/7 | 94 |
| r10-go-hal-conc | flash | 6 | **3** | 3/6 | 98 |
| r11-kubernetes | flash | 11 | 11 | **11/11** | 100 |
| r12-terraform-aws | flash | 4 | 4 | 4/4 | 95 |
| r13-powershell | flash | 3 | 2 | 2/3 | 95 |
| r16-agent-security | flash | 7 | 7 | 7/7 | 99 |
| r17-test-quality | flash | 7 | **2** | 2/7 | 97 |
| r19-misc-gaps (CONC-007) | flash | 1 | 1 | 1/1 | 95 |
| r20-large-pro-direct | **pro-direct** | 18 | 17 | 17/18 | 100 |
| r14/r15/r18 clean (3×) | flash | 0 | — | 0 FP | 95–100 |

## Die vier Kernbefunde

### 1. Verifier: die False-Refutation-Angst ist empirisch unbegründet
Über ~110 verifizierte erwartete Claims (plus Re-Runs) hat der blinde Claim-Verifier **kein einziges** korrektes Draft-Finding verworfen. Jeder Recall-Verlust passiert im **Draft**, nie in der Verifikation. (Der Verifier verwarf durchaus Findings — aber ausschließlich nicht-erwartete Beifänge.)

### 2. Große PRs: Attention Decay ist mild, keine Trunkierung
Der 18-Dateien-Diff (57,5 KB, echte pro-direct-Route via >15-Dateien-Heuristik) lieferte 17 Findings über 17 verschiedene Dateien — der Reviewer hört nicht nach den „Top 3" auf. Der eine Miss (SEC-014, MD5, Datei 12 von 18) wurde in der kleinen Flash-Bundle-Variante derselben Regel gefangen → milder Decay-Effekt auf dem Pro-Pfad, keine strukturelle Trunkierung. Bestätigt den 18/18-Befund von `009-large-multifile.diff` (2026-08-10) auf frischem Material.

### 3. Zwei stabile systematische Schwächen (je 2/2 Läufe identisch reproduziert)
- **TEST-Qualitätsregeln: 2/7 (28,6%).** Gefangen werden nur TEST-001 (keine Assertions) und TEST-008 (unseeded Random). **Stabil verpasst: TEST-002 (Assertions ohne Messages), TEST-003 (nur Happy-Path), TEST-005 (Coverage ohne echte Assertions), TEST-007 (flache Mock-Abdeckung), TEST-011 (invertierte Boolean-Logik in Authz-Checks).** „Die Regeln gelten auch für Tests" ist damit im LLM-Pfad nur für 2 von 7 Regeln wahr.
- **Go: 3/6.** Stabil verpasst: HAL-002 (halluzinierte API `strings.ToLowerCase`), ARCH-005 (nil-map-Panik, kompiliert sauber), CONC-008|CONC-001 (Map-Zugriff ohne die Mutex der Geschwister-Methoden). Die Flash-Draft-Stufe kennt Go offenbar schwächer als TS/Python/C/Java.

### 4. Einzel-Misses (je 1 Lauf, teils run1-korroboriert)
CONC-003 (volatile als Thread-Signal, C), SEC-012 + SEC-021 (beide auch in Lauf 1: r03 draftete 2× nur 8/10 → vermutlich systematisch), SEC-035 (halluzinierte npm-Dependency — erwartbar schwer ohne Registry-Zugriff), SEC-019 (fehlende Security-Header), SEC-048 (iwr|iex PowerShell — überraschend, SEC-049/050 wurden gefangen), Condition 11 (JSX-Nesting). Negative-Space-Regeln (Abwesenheit von Rate-Limit/Headern/State) sind erkennbar schwerer als Anwesenheits-Muster.

## Präzision (Negativ-Kontrollen)

**0 False Positives auf allen 3 Kontrollen** (clean-python 0 Findings/Score 100, clean-ts 0/100, clean-c nach Fix 0/100). Ehrlichkeits-Fußnote: Im Erstlauf flaggte der Reviewer auf clean-c ein CRITICAL `SEC-007` — die Fixture hatte eine `create`-Funktion ohne sichtbares `destroy`-Gegenstück, aus Diff-Sicht eine legitime Leak-Lesart. Das war ein **Fixture-Defekt** (unfaire Kontrolle), kein Produkt-FP; die Kontrolle wurde um die `destroy`-Funktion ergänzt und besteht seitdem. Lehre für Negativ-Kontrollen: Ressourcen-Erwerb braucht sichtbare Freigabe im selben Diff.

## Beifang: echter Produktions-Bug gefunden und gefixt

Lauf 1 crashte hart auf dem Go-Bundle: Gemini zitierte tab-eingerückten Go-Code wörtlich in `exact_quote` und emittierte das **rohe Tab-Zeichen unescaped im JSON-String** — `JSON.parse` in `parseModelJson` warf, der Job starb. In Produktion hätte jeder PR mit tab-eingerücktem Code (Go, Makefiles, tab-eingerücktes C), den das Modell zitiert, denselben Crash ausgelöst. **Fix:** konservative Reparatur in `parseModelJson` (`escapeControlCharsInsideStrings`: escapt Steuerzeichen NUR innerhalb von String-Literalen, nur als Retry nach Parse-Fehler; 3 neue Unit-Tests). r10 lief danach 2/2 fehlerfrei. Zusätzlich ist der Benchmark-Runner jetzt per-Fixture fehlertolerant (eine kaputte Fixture wird als `errored` vermerkt statt den Lauf zu killen; Exit bleibt trotzdem ≠ 0).

## Caveats (ehrlich)

1. **N=1 pro Bundle** für die Einzel-Misses (LLM nicht-deterministisch); nur r10 und r17 wurden gezielt 2× gefahren (beide exakt reproduziert), und r03s 8/10 wiederholte sich über Lauf 1/2. Die Cluster-Befunde sind belastbar, die Einzel-Misses direktional.
2. **RAG/Practices aus** (wie im Replay-Rig, reproduzierbare Baseline) — Produktions-Recall mit Evidence-Block kann abweichen.
3. **Kosten nicht beziffert**: der Runner rechnet bewusst keine Preise (Telemetrie landet wie immer in `review_job_llm_calls`, Jobs werden ohne `--keep` aufgeräumt). Größenordnung: ~20 Flash-Jobs + 1 pro-direct + ~8 Claim-Eskalationen pro Volllauf.
4. Misses messen den **LLM-Pfad**; einige verpasste Regeln (z.B. SEC-012-Muster, TEST-Regeln) sind Kandidaten für die deterministische Prescan-Lane, die hier bewusst aus war.
