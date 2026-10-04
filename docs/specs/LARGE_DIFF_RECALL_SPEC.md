# Draft-Recall auf sehr großen Diffs — Diagnose, Optionen und Bau von Option A

**Status: FREIGEGEBEN und IMPLEMENTIERT (Option A, 20k-Batches).** Entscheidung des Gründers 2026-09-29: Option A mit 20k-Batches, 12k verworfen (Gate 4), Gate 5 durch Abschaltung von T2 entschieden. Bau am selben Tag auf `main` `3266235` durch Fable 5.1 — Umsetzung, Entscheidungen und Nachweise in **§9**; §1–§8 sind die unveränderte Diagnose- und Messhistorie (Diagnose-Runde PR #24, Gate-Messung PR #25). Vertex-Kosten der Messkampagne: Diagnose 1,15 USD (Budget 5), Gate-Messung 1,81 USD (Budget 3) — §7; Bau-Nachweis-Benchmark §9.6.

Code-Stand der Messungen: `main` bei `6f80d1b` bzw. `3e51396`. Rohdaten: `fixtures/rule-recall/results/2026-09-29-*.json` (Jobs mit `--keep` in `review_jobs` / `review_job_llm_calls` belassen), Replay-Jobs siehe §2.2.

---

## 1. Ausgangslage

ROADMAP §1 (Stand 2026-09-26): Live-Lauf unslopai/test#16 (31 Dateien, ~72k geschätzte Tokens) ⇒ Draft **0 Issues**, Pre-Scanner 43 (20 CRITICAL), Second Opinion sah 7 von 31 Dateien und fand 1. Replay unslopai/test#17 (~37k Tokens): Draft wieder 0, im zweiten Lauf 1 halluzinierter Claim. Kleine Diffs erreichen im Rule-Recall-Benchmark 125/126. Vermutung damals: der 3.8-Draft kollabiert auf großen Diffs; Kandidaten Diff-Chunking oder Second-Opinion-Deckel koppeln; „erst messen: Benchmark-Bundle mit > 50k Tokens bauen“.

**Kernfrage dieser Runde:** War das ein Recall-Kollaps, ein Filter in der Pipeline, oder gab es auf diesen Diffs schlicht nichts zu finden?

## 2. Befund ohne Ground Truth: Telemetrie und Replays

### 2.1 Telemetrie der Live-Jobs (`review_job_llm_calls`)

| Job | PR | Phase | prompt (cached) | output | Latenz | Status | Ergebnis |
|---|---|---|---|---|---|---|---|
| `ecb4937c` | test#16 | draft | 91.546 (4.544) | 11.198 | 59,7 s | ok | 0 Issues |
| `ecb4937c` | test#16 | escalate_second_opinion | 20.494 (4.544) | 9.971 | 89,3 s | ok | 1 Issue (7 von 31 Dateien) |
| `c9e154ef` | test#17 | draft | 49.453 (4.544) | 9.206 | 51,6 s | ok | 0 Issues |
| `c9e154ef` | test#17 | escalate_second_opinion | 19.739 (4.544) | 8.889 | 49,3 s | ok | 0 neue |
| `f2c676ba` | test#17 | draft | 49.453 (4.544) | 8.542 | 49,6 s | ok | 1 Claim (MAINT-007), vom Verifier widerlegt |
| `a0589491` | test#12 | draft | 15.490 (4.544) | 23.428 | 131,6 s | ok | 1 Claim, widerlegt (Verifier + Eskalation) |

Fakten daraus: jeder Draft-Call endete `ok` (kein `parse_error`, kein `api_error`); der Cache-Prefix hat **4.544 Tokens**, nicht die im Code-Kommentar von `context-cache.ts` genannten „~19k“ (seit dem Wechsel auf `public_explanation`-only rendert der Law-Block deutlich kleiner; gefiltert 19.285 Zeichen); `output_tokens` enthält die Thinking-Tokens (`thoughtsTokenCount`), ein 0-Issue-Draft mit 9–11k Output-Tokens ist also ein Draft, der lange nachgedacht und dann „No AI slop found.“ ausgegeben hat.

### 2.2 Replays mit Roh-Ausgabe (Scratch-Harness, nicht committet)

Der Harness fährt nur den Draft-Call mit exakt dem Produktions-Input (GitHub-Patches der PRs, Law-Filter `react,typescript,nodejs` wie `repositories.detected_ecosystems` von unslopai/test, die persistierten Prescan-Tupel als `<already_flagged>`) und protokolliert die Modell-Issues **vor** Manifest-Validierung, Scope-Filter und Aggregation, inklusive Ablehnungsgrund.

| Job | Input | prompt (cached) | output | Latenz | finishReason | roh | verworfen | Ergebnis |
|---|---|---|---|---|---|---|---|---|
| `90e49049` | test#17, 31 Dateien, 9 Prescan-Tupel | 48.601 (4.613) | 20.862 | 140,2 s | STOP | 1 | 0 | HAL-002 @ `companion-loader.ts:131` („incorrect argument signature“ — im Patch nicht belegbar) |
| `5fa03e90` | test#17, dito | 48.601 (4.613) | 9.613 | 88,3 s | STOP | 0 | 0 | „No AI slop found.“ |
| `5731d409` | test#16, 31 Dateien, 41 lokal berechnete Prescan-Tupel | 90.841 (4.613) | 23.230 | 220,6 s | STOP | 0 | 0 | „No AI slop found.“ |

Damit sind drei Hypothesen tot: die Manifest-Validierung (`issue-validation.ts`) verwirft nichts, weil das Modell nichts liefert; der Parser repariert/verwirft nichts (`finishReason=STOP`, valides JSON); eine Output-Trunkierung gibt es nicht. Der Prod-Claim aus `f2c676ba` („catch fängt `readError`, Bedingung prüft `listError`“) ist gegen den Patch geprüft eine Halluzination (Zeilen 135–138 fangen und prüfen `readError`); `companion-loader.ts` zieht in 2 von 4 Läufen auf #17 (Prod `f2c676ba`, Replay `90e49049`) einen unhaltbaren Claim an; die anderen beiden Läufe meldeten 0.

### 2.3 Was in den PRs steckte

PR unslopai/test#16 ist laut seiner Beschreibung „the Pre-Scanner v4 code at the state of `bc58f4a`“ — 31 reine Additions-Dateien des **eigenen, unter THE LAW geschriebenen Produktcodes**; #17 ist der Replay von unslopai/unslop#9, ebenfalls eigener Code. Die 43 bzw. 9 Prescan-Findings sind deterministische Regeln (TEST-002 Assertion Roulette, ARCH-002 Methodenlänge, SEC-019 Header …), die der Draft per `<already_flagged>` ausdrücklich **nicht** erneut melden soll. Eine Ground Truth für „der Draft hätte X finden müssen“ gab es nie.

### 2.4 Law-Block unter dem Produktionsfilter

`golden_standards`: 119 Regeln. Der Filter `react,typescript,nodejs` behält **76** (72 universelle + 4 getaggte) und lässt 43 weg (C/C++, Python, Java-Spring, Kubernetes, Terraform/AWS, PowerShell, Go-Familie, Solidity). Das ist beabsichtigt und für TS-Diffs korrekt; es erklärt den 4,5k-Prefix, nicht die 0 Issues.

### 2.5 Hypothesen und Urteil

| # | Hypothese | Urteil | Beleg |
|---|---|---|---|
| H1 | Manifest-Validierung/Scope-Filter verwerfen die Findings | **widerlegt** | §2.2: roh 0–1, verworfen 0 |
| H2 | JSON-Degeneration/Parse-Retry verschluckt Issues | **widerlegt** | alle Calls `ok`, `finishReason=STOP` |
| H3 | Output-Deckel trunkiert | **widerlegt** | 9–23k Output-Tokens, kein MAX_TOKENS |
| H4 | Law-Filter zu eng | **kein Faktor** | 76 Regeln, alle TS-relevanten drin (§2.4) |
| H5 | `<already_flagged>` unterdrückt mehr als die Prescan-Tupel | **nicht bestätigt** | §3.3 Variante B: Draft meldet 0 der 19 Prescan-Regeln (Compliance) und 23 von 29 übrigen (ohne Sektion: 24 von 29) |
| H6 | Recall kollabiert bei > 50k Tokens auf 0 | **widerlegt** | §3.3: 39–40 von 48 gepflanzten auf 52k Tokens |
| H7 | Recall sinkt messbar mit der Diff-Größe | **bestätigt, moderat** | §3.3/§3.4: 81–85 % (2 Läufe) statt 94–98 % Kleindiff-Baseline derselben Dateien, Misses im mittleren Drittel |
| H8 | Die Live-„0“ waren inhaltlich korrekt (eigener Code, Prescan-Regeln ausgeklammert) | **plausibel, nicht beweisbar** | §2.2/§2.3; das Modell liefert auf diesem Code reproduzierbar 0–1 Claims, die Second Opinion (Eskalations-Modell) fand 1 bzw. 0 |
| H9 | Große Diffs reißen die Draft-Latenz | **bestätigt, neu** | 294 s und 98 s (XL-Läufe 1/2, gleicher Prompt, ohne Budget), 220 s (#16-Replay), 140 s / 88 s (#17-Replays) gegen 270 s LLM-Budget des Jobs (DEADLINE_GUARD D2) |

## 3. Messung mit Ground Truth: Fixture `r24-xl-flash-cascade.diff`

### 3.1 Aufbau

`fixtures/rule-recall/r24-xl-flash-cascade.diff` (206.804 Zeichen, **51.701 geschätzte Tokens**, 79 Dateien, nur `.ts/.tsx`): die **48 gepflanzten TS-Dateien** aus r05, r06, r07, r08, r19 und r20 unverändert unter `xl/`-Pfaden (ihr Kleindiff-Recall ist aus den Volläufen bekannt), alphabetisch (GitHub-Reihenfolge) verschränkt mit **31 sauberen Filler-Modulen** einer fiktiven Fulfillment-Plattform (Katalog, Inventar, Orders, Plattform, Versand, Support, UI, Worker, Zonen; 121.641 Zeichen). Law-Filter `react,typescript,nodejs` wie unslopai/test, deshalb teilt das Bundle den Produktions-Cache-Key. Über `proDirectMaxDiffTokens` (25k) ⇒ Route **flash-cascade** wie ein echter großer PR. Manifest-Eintrag in `manifest.json`, Offline-Guard (`rule-recall-manifest.test.ts`) grün. Findings auf Filler-Dateien zählen weder als Treffer noch als FP.

Kleindiff-Baseline derselben 48 Dateien (Volläufe, Draft `gemini-3.8-flash`): 2026-09-16 **47/48** (nur SEC-019 `middleware.ts` verpasst), 2026-09-03 45/48 (zusätzlich MAINT-003, SEC-035 aus r20). Stabile Kleindiff-Misses: SEC-019 (r08), MAINT-003 `tax-calculator.ts`, SEC-035 `slugify.ts`, SEC-014 `password-hash.ts` (r20-Trio, auch in den Eskalations-Rollen-Läufen 2026-09-17: 17/18 und 15/18).

### 3.2 Läufe

| Lauf | Job(s) | Draft prompt (cached) | Draft output | Draft-Latenz | Draft-Issues | Draft-Recall | kombiniert (Draft ∪ Prescan) | überlebt | Kosten |
|---|---|---|---|---|---|---|---|---|---|
| Kontrolle r20 auf flash-cascade (`--cascade proDirectMaxDiffTokens=1`, 18 Dateien, 14k Tokens, ungefilterter Law) | `aa328bdb` | 20.167 (6.946) | 6.878 | 46,5 s | 16 | **15/18** | 17/18 | 17/18, 0 Refutationen, Score 98 | $0,071 |
| **XL Lauf 1** (Benchmark-Runner, volle Kaskade) | `6e5c38a7` | 61.063 (4.613) | 11.066 | **293,5 s** | 40 (39 nach Rule-ID, 40 nach Datei: `password-hash.ts` als SEC-012 statt SEC-014) | **39/48 (81,3 %)** | **43/48** | 41/48; Verifier 3 Batches, 37 confirmed / 3 refuted, Score 99 | $0,206 |
| XL Variante B: `<already_flagged>` mit 26 lokal berechneten Prescan-Tupeln (Produktionsform) | `84ce9e3f` | 61.781 (4.613) | 16.219 | 103,4 s | 23 | 23/48 (0 der 19 Prescan-gedeckten erneut gemeldet, **23 von 29** übrigen) | **42/48** | — (nur Draft) | $0,115 |
| XL Variante C: Chunking in 5 Datei-Batches ≤ 12k Tokens (16/17/14/28/4 Dateien), sequenziell gefahren | `b4834c7a`, `045dd8d0`, `dbd16931`, `a9611992`, `bc065939` | 82.095 gesamt (23.065) | 30.817 gesamt | 78,8 / 34,0 / 34,1 / 52,3 / 27,2 s (Summe 226 s, **max 79 s**) | 13 + 9 + 2 + 19 + 0 = 43 | **42/48 (87,5 %)** | 45/48 (rechnerisch: die 3 Prescan-gedeckten Misses) | — (nur Draft) | $0,178 |
| **XL Lauf 2** (Wiederholung von Lauf 1, Runner) | `e2b1206d` | 61.063 (4.613) | 14.906 | **98,2 s** | 42 | **41/48 (85,4 %)** | **45/48** | 44/48; Verifier 40 confirmed / 2 refuted, Score 97 | $0,213 |

Kosten je Lauf aus `scripts/benchmark-cost.ts` (Regional-SKUs, Intro-Gutschrift ×0,5).

### 3.3 Interpretation von Lauf 1

- **Kein Kollaps, aber ein Größeneffekt von ~12–15 Punkten.** Die 9 Rule-ID-Misses zerfallen in 4 stabile (SEC-019, MAINT-003, SEC-035 `slugify`, SEC-014 als SEC-012 — alle auch im Kleindiff) und **5 größenbedingte**: SEC-013 `workspace-role-gate.ts` (Position 74 von 79), SEC-031 `unsubscribe-route.ts` (54), SEC-035 `accounts-csv.ts` (49, Prescan hat es), MAINT-005 `channel-formatters.ts` (47), ARCH-001 `finding-router.ts` (58). Vier der fünf liegen im r05/r06-Block in der Mitte des Bundles; die frühen Blöcke (r20 an 1–16, r07 an 21–29) wurden bis auf die stabilen Misses vollständig gefunden. Das ist das bekannte Positionsmuster langer Kontexte, bei N=1 aber nur ein Hinweis.
- **Nichts wird gefiltert**: 0 von 40 Issues an der Manifest-Validierung verworfen, 0 am Scope-Filter.
- **Verifier**: 3.6 widerlegt 3 von 40 Claims, alle drei gepflanzt — Condition 11 (`OrderSummary.tsx` nistet **exakt** 4 Ebenen, Regeltext sagt „deeper than 4“), Condition 5 (uncalled function ist nach Regeltext kein Dead Code, MAINT-007 wäre die passende ID), ARCH-002 (22-Zeilen-Klasse). Zwei der drei sind nach dem Regeltext vertretbar; Datenpunkt für das A12b-Gate (SPEC.md §12.4).
- **Latenz ist das eigentliche Produktrisiko**: 293,5 s für den Draft (ohne Job-Budget im Benchmark). In Produktion wäre der Call bei 270 s abgebrochen worden ⇒ Job `error` `review_timeout` (DEADLINE_GUARD D5), also gar kein Review. Die Live-Drafts auf #16/#17 brauchten 50–60 s, die Replays 88–220 s: die Streuung auf großen Prompts ist enorm, und `output_tokens` (Thinking) erklärt sie nur teilweise (Lauf 1: 11k Output in 294 s; Variante B: 16k Output in 103 s).
- **`<already_flagged>` wirkt wie spezifiziert** (Variante B): der Draft meldet keine der Prescan-gedeckten Regeln erneut, der Rest-Recall ist unverändert (23 vs. 24 von 29). Nebenwirkung: der Second-Opinion-Trigger T2 („Prescan ≥ 3 und Draft 0“, LLM_LANE_QUALITY_SPEC §4.2) misst damit auf sauberem Code **Compliance, nicht Divergenz** — er feuert immer dann, wenn der Prescan etwas findet und der Draft sich an die Anweisung hält. Genau das ist auf #16/#17 passiert (2 Pro-Eskalationen für 1 bzw. 0 Findings).

### 3.4 Chunking und Wiederholung

**Variante C (Chunking)**: dieselben 79 Dateien in Diff-Reihenfolge greedy zu 5 Batches ≤ 12k geschätzte Tokens gepackt, jeder Batch ein eigener Draft-Call mit demselben Envelope/Cache (Harness, sequenziell). Draft-Recall **42/48** gegenüber 39/48 am Stück. Misses: die 4 stabilen (SEC-019, MAINT-003, SEC-035 `slugify`, SEC-014 als SEC-012) plus MAINT-005 `channel-formatters.ts` (auch in Lauf 1 und Variante B verpasst — vermutlich kein Größeneffekt, sondern eine Fixture an der Grenze) und SEC-013 `authorize.ts` (in Lauf 1 gefunden; N=1-Streuung). Die drei in Lauf 1 größenbedingt verpassten Dateien in der Bundle-Mitte (SEC-013 `workspace-role-gate.ts`, SEC-031 `unsubscribe-route.ts`, ARCH-001 `finding-router.ts`) wurden im Chunk **alle gefunden**. Keine Findings auf Filler-Dateien (0 FP auf 31 sauberen Modulen in allen Varianten). Latenz pro Batch 27–79 s, also parallel gefahren ≤ 80 s statt 294 s. Kosten: Draft $0,178 statt $0,093 (**+92 %**, getrieben von 30,8k statt 11,1k Output-Tokens — jeder Batch denkt neu); auf den ganzen Job bezogen (Draft + Verifier ≈ $0,29 statt $0,21) rund +40 %. Das Kosten-Gate in §6 (≤ +50 % Draft-Kosten) wäre mit dieser Messung **nicht** erfüllt; ein größerer Batch (z. B. 20k Tokens ⇒ 3 Batches) ist der naheliegende Kompromiss und muss gemessen werden.

**Lauf 2** (Wiederholung von Lauf 1 über den Runner, Job `e2b1206d`): Draft-Recall **41/48**, kombiniert 45/48, überlebt 44/48, Score 97. Misses: die 4 stabilen plus SEC-035 `accounts-csv.ts` (Position 49, Prescan hat es), MAINT-005 `channel-formatters.ts` (47) und ARCH-002 `account-lifecycle.ts` (55) — wieder ausschließlich der mittlere r05/r06-Block; Lauf 1 hatte dort SEC-013/SEC-031/ARCH-001 verpasst und ARCH-002 gefunden. Draft-Latenz **98 s** (Lauf 1: 294 s) bei fast gleichem Output (14,9k vs. 11,1k Tokens): die Latenz-Streuung ist nicht durch die Antwortlänge erklärt. Verifier: 2 Refutationen (Condition 5 `usage-summary.ts`, Condition 11 `OrderSummary.tsx` — dieselben wie in Lauf 1, ARCH-002 diesmal bestätigt).

**Über zwei Läufe**: Einzel-Call im Mittel **40/48 (83 %)** Draft-Recall, 44/48 kombiniert; Chunking (N=1) 42/48. Die Menge der größenbedingten Misses wandert zwischen den Läufen, bleibt aber im mittleren Drittel des Bundles; nur MAINT-005 wurde in allen drei XL-Varianten verpasst.

### 3.5 Gate-Messung nach §6 (zweite Runde 2026-09-29, Harness, Batches parallel)

**Werkzeug** (für alle drei Varianten dasselbe, deshalb vergleichbar; nicht mit §3.2/§3.4 mischen, die über den Runner mit voller Kaskade liefen): Draft-only-Scratch-Harness `scripts/scratch/xl-diagnosis.ts` (nicht committet). Je Lauf ein `review_jobs`-Job pro Batch, Batches per `Promise.all` **parallel** wie in Option A vorgesehen, Wanduhr über den ganzen Draft, Token aus `usageMetadata` mit `thoughtsTokenCount` getrennt, Produktionsparität bei Retries (A11-Backoff, ein Sofort-Retry bei degeneriertem JSON), danach Manifest-Validierung, Scope-Filter und Rule+File-Aggregation wie in `reviewer-call.ts`. Kein Verifier, keine Eskalation; Pro-Kontingent vor und nach der Runde 36/50. Batch-Zuschnitt greedy in Diff-Reihenfolge: 12k ⇒ 5 Batches (16/17/14/28/4 Dateien, ~11,5k/12,2k/12,1k/11,7k/4,1k Tokens), 20k ⇒ 3 Batches (30/33/16 Dateien, ~19,2k/20,3k/12,2k). Reports: `fixtures/rule-recall/results/2026-09-29-xl-r24-gate-{single,chunk12k,chunk20k}.json`.

| Variante | Lauf | Draft-Recall | Wanduhr | max Batch | Batch-Latenzen | prompt (cached) | answer | thoughts | Draft-Kosten |
|---|---|---|---|---|---|---|---|---|---|
| Einzel-Call | 1 (`de2118fe`) | 41/48 | 67,5 s | 67,1 s | — | 61.063 (4.613) | 8.674 | 3.662 | $0,098 |
| Einzel-Call | 2 (`cfac6c74`) | 44/48 | 75,0 s | 74,8 s | — | 61.063 (4.613) | 9.542 | 4.917 | $0,107 |
| Einzel-Call | 3 (`6fa9d1dd`) | 40/48 | 60,9 s | 60,7 s | — | 61.063 (4.613) | 7.836 | 3.873 | $0,095 |
| 12k, 5 Batches | 1 | 43/48 | 43,6 s | 43,2 s | 32,0 / 27,8 / 25,7 / 43,2 / 24,1 s | 82.095 (23.065) | 8.618 | 17.482 | $0,158 |
| 12k, 5 Batches | 2 | 43/48 | 46,0 s | 45,9 s | 40,0 / 37,4 / 45,9 / 42,5 / 29,5 s | 82.095 (23.065) | 9.007 | 19.082 | $0,167 |
| 12k, 5 Batches | 3 | 46/48 | 84,2 s | 83,9 s | 43,0 / 26,9 / 83,9 / 48,1 / 43,0 s | 82.095 (23.065) | 9.232 | 28.099 | $0,205 |
| 20k, 3 Batches | 1 | 45/48 | 54,1 s | 53,9 s | 52,1 / 53,9 / 35,9 s | 71.579 (13.839) | 9.054 | 16.589 | $0,155 |
| 20k, 3 Batches | 2 | 41/48 | 66,4 s | 66,1 s | 66,1 / 42,7 / 29,8 s | 71.579 (13.839) | 8.104 | 17.948 | $0,156 |
| 20k, 3 Batches | 3 | 42/48 | 46,2 s | 45,9 s | 45,9 / 34,6 / 22,5 s | 71.579 (13.839) | 8.307 | 11.270 | $0,130 |

Jobs 12k: `1e2841e0`…`ac49defe` (15), 20k: `2a7d5351`…`f295f25d` (9). Kosten je Lauf aus den Token mit den Preisen von §5 (deckungsgleich mit `scripts/benchmark-cost.ts`: Einzel-Call $0,2997, 12k $0,5293, 20k $0,4403 je drei Läufe).

| Variante | Recall Mittel (Spanne) | Wanduhr Mittel (Spanne) | max Batch (Spanne) | thoughts je Lauf | Draft-Kosten Mittel (Spanne) | Δ Kosten vs. Einzel-Call |
|---|---|---|---|---|---|---|
| Einzel-Call | **41,7** (40–44) | 67,8 s (60,9–75,0) | — | 4,2k | $0,100 ($0,095–0,107) | — |
| 12k | **44,0** (43–46) | 57,9 s (43,6–84,2) | 57,7 s (43,2–83,9) | 21,6k | $0,176 ($0,158–0,205) | **+77 %** |
| 20k | **42,7** (41–45) | 55,5 s (46,2–66,4) | 55,3 s (45,9–66,1) | 15,3k | $0,147 ($0,130–0,156) | **+47 %** |

Misses über die drei Läufe: Einzel-Call SEC-019 3×, SEC-014 (als SEC-012) 3×, MAINT-003 2×, SEC-035 `slugify` 2×, SEC-035 `accounts-csv` 2×, je 1× SEC-013 `authorize`, SEC-013 `workspace-role-gate`, SEC-024 `cors-policy`, MAINT-005, ARCH-002. 12k: SEC-019 3×, SEC-014 3×, MAINT-005 2×, Condition 11 2×, SEC-035 `slugify` 2×. 20k: MAINT-005 3×, SEC-019 3×, SEC-014 3×, MAINT-003 2×, SEC-035 `slugify` 2×, je 1× ARCH-002, Condition 11, SEC-025 `workspace-rename`. In keiner Variante ein Finding auf den 31 Filler-Dateien, in keinem Call eine Manifest-Verwerfung oder ein `parse_error`.

**Zusatzserie 12k** (erste Serie, Jobs `06511f8c`…`633efc1f`): Lauf 1 42/48 (Wanduhr 47,4 s), Lauf 2 46/48 (71,4 s), Lauf 3 abgebrochen — Vertex antwortete auf einem von fünf parallelen Batches nach > 60 s mit `500 INTERNAL`, nach A11 kein Retry ⇒ `ModelUnavailableError`; der Harness schrieb damals den Report erst am Ende (seitdem nach jedem Lauf, gescheiterter Batch = errored-Lauf). Über N=5 liegt 12k damit bei 44,0 (42–46). Kosten der Serie $0,515.

**Beobachtungen.**
- **Recall**: Chunking bringt +2,3 (12k) bzw. +1,0 (20k) von 48 gegenüber dem Einzel-Call, bei einer Streuung von ±2 je Variante (N=3). Die stabilen Misses (SEC-019 `middleware.ts`, SEC-014 als SEC-012) bleiben in jeder Variante; MAINT-005 und Condition 11 (Grenzfixtures, §8) werden auch in Batches meist verpasst. Die Bundle-Mitte-Misses des Einzel-Calls (SEC-013, SEC-024, SEC-025, SEC-035 `accounts-csv`, ARCH-002) verschwinden in den Batches — das ist der Größeneffekt, und er ist klein.
- **Latenz**: der Einzel-Call lief in dieser Runde 61–75 s ohne Ausreißer (Vortag auf demselben Prompt: 98 s und 294 s). Parallel gefahren ist die Wanduhr eines gechunkten Drafts ≈ der langsamste Batch (22–84 s) und damit heute nicht kürzer als der Einzel-Call. Der Nutzen ist der **gedeckelte Worst Case**: über 39 Batch-Calls ≤ 20k Tokens kein Wert über 84 s, während 4 von 9 Einzel-Calls > 49k Tokens (beide Tage, §2.2/§3.2/§3.5) über 88 s lagen (140, 220, 294, 98 s).
- **Kosten**: jeder Batch erzeugt 2–8k Thinking-Tokens unabhängig von seiner Größe (12k: 21,6k je Lauf, 20k: 15,3k, Einzel-Call: 4,2k) — das ist der ganze Aufpreis; Prefix (cached) und Protokoll-Block sind vernachlässigbar. Deshalb 12k +77 %, 20k +47 %.
- **Störfall**: 1 von 44 Batch-Calls der Runde endete mit Vertex `500 INTERNAL` nach > 60 s (kein Retry nach A11). Für Option A heißt das: ein gescheiterter Batch muss als `draft_partial` degradieren, nicht als `model_unavailable` des ganzen Jobs (Option A, Risiko b).
- **Gate 3** (Runner, volle Kaskade): r14, r15, r18, r21, r23 je 0 Issues, Score 100, 0 CRITICAL-FP, 0 Eskalationen (`results/2026-09-29-gate3-negative-controls.json`, $0,028).

## 4. Diagnose

1. **Die Live-Beobachtung „Draft 0, Prescan 43“ ist kein Beleg für einen Recall-Defekt.** Beide PRs enthielten eigenen, regelkonformen Code; die Prescan-Findings waren deterministische Regeln, die der Draft laut Prompt überspringen soll; das Modell liefert roh 0–1 Claims, die Pipeline verwirft nichts. Ob auf diesen Diffs etwas fehlte, ist ohne Ground Truth nicht entscheidbar — die Second Opinion mit dem Eskalations-Modell fand auf den gesehenen Dateien 1 bzw. 0.
2. **Es gibt einen echten, moderaten Größeneffekt**: auf 52k Tokens / 79 Dateien findet der Draft 81–85 % der gepflanzten Verstöße (zwei Läufe) statt 94–98 % im Kleindiff; die Verluste sitzen im mittleren Drittel des Bundles und wandern zwischen den Läufen; kombiniert mit dem Prescan bleiben 90–94 %.
3. **Der gravierendere Effekt ist die Draft-Latenz**: 88–294 s auf 50–90k-Token-Prompts (derselbe XL-Prompt einmal 294 s, einmal 98 s), bei einem LLM-Budget von 270 s. Große PRs enden damit nicht mit wenigen Findings, sondern mit einer nennenswerten Wahrscheinlichkeit mit `review_timeout`.
4. **Die Second Opinion ist für diesen Fall das falsche Werkzeug**: sie sieht 12k von 37–72k Tokens, kostet eine der 50 Pro-Eskalationen und ihr Trigger T2 wird von `<already_flagged>` strukturell ausgelöst.

## 5. Optionen

Preisbasis (`vertex-pricing.ts`, Regional-SKU, Intro-Gutschrift ×0,5 bis 2026-12-31): 3.8-Flash Input $0,825/M, cached $0,0825/M, Output $4,125/M. Ein XL-Draft-Call kostet heute ~$0,09 (Lauf 1), der Verifier für 40 Claims ~$0,11.

### Option A — Datei-Batch-Chunking des Drafts (parallel)

Der Draft-Step zerlegt `reviewableFiles` deterministisch in Batches ≤ `heuristicMaxDiffTokens` (12k geschätzte Tokens; Reihenfolge = Diff-Reihenfolge, greedy, eine überlange Datei allein), fährt **einen `runReviewerPass` pro Batch parallel** (gleicher Envelope, gleicher Explicit Cache, `<already_flagged>`-Tupel auf die Batch-Dateien gefiltert) und konkateniert die aggregierten Issues. Verifier, Eskalation, Scorer bleiben unverändert (Claims-Union → Batches wie heute; Rule+File-Aggregation ist batch-lokal korrekt, weil die Dateien disjunkt sind). Nur aktiv, wenn `estimatedDiffTokens > heuristicMaxDiffTokens`: kleine PRs bleiben byte-identisch zu heute, die Benchmark-Zahlen 125/126 bleiben gültig.

- **Recall** (Gate-Messung §3.5, je 3 Läufe, gleicher Harness): Einzel-Call 41,7/48, 12k-Batches 44,0, 20k-Batches 42,7. Die größenbedingten Misses der Bundle-Mitte verschwinden in den Batches, die stabilen Kleindiff-Misses (SEC-019, SEC-014 als SEC-012) und die Grenzfixtures (MAINT-005, Condition 11) bleiben. Kleindiff-Niveau (94–98 %) ist die Obergrenze, nicht die Erwartung.
- **Latenz**: parallel gefahren ≈ langsamster Batch, 22–84 s bei 12k, 22–66 s bei 20k (§3.5); heute nicht kürzer als der Einzel-Call (61–75 s), aber ein gedeckelter Worst Case gegen die Einzel-Call-Ausreißer von 98–294 s auf demselben Prompt (§3.4). Verifier und Reserve behalten damit planbar Zeit.
- **Kosten**: der Aufpreis ist ausschließlich Thinking je Batch (2–8k Tokens pro Call): **12k +77 %** ($0,176 statt $0,100 je XL-Draft), **20k +47 %** ($0,147). Prefix (cached 4,6k ≈ $0,0004) und Protokoll-Block (~1,2k ≈ $0,001) je Batch sind vernachlässigbar. Kleindiffs +0, weil Chunking nur oberhalb der Batch-Größe greift.
- **Umsetzungshinweis**: Batch-Größe 20k geschätzte Tokens; Chunking nur, wenn der Draft-Prompt darüber liegt — auf der Route flash-cascade also ab > 25k Tokens (pro-direct 12–25k bleibt ein Call, s. §8 Punkt 10). Ein gescheiterter Batch (Vertex 500 nach > 60 s, kein Retry nach A11 — real beobachtet, §3.5) degradiert zu `draft_partial` mit Liste der nicht reviewten Dateien, nie zu `model_unavailable` des ganzen Jobs.
- **Risiken / Entscheidungen**: (a) dateiübergreifende Muster (Ressource in Datei A geholt, in B freigegeben) verlieren Kontext — im Rule-Recall-Universum betrifft das keine gepflanzte Regel, die Evidence-Sektion (RAG) bleibt job-weit; (b) ein fehlgeschlagener Batch darf den Job nicht zu `review_timeout` machen: Vorschlag neue Degradation `draft_partial` + Liste der nicht reviewten Dateien im Review-Body (wie `omitted_files`), Score `null`; (c) Telemetrie: N `draft`-Zeilen pro Job (Aggregation per `job_id` funktioniert, `benchmark-cost.ts` ebenso), optional `chunk_index`; (d) `has_slop`/`summary` je Batch — die finale Summary kommt seit A12a ohnehin aus dem Endzustand; (e) Parallelität: N `fetch`-Calls in einer Vercel-Invocation sind unkritisch, Vertex-429 greift über den bestehenden Backoff.

### Option B — Second Opinion ausweiten oder ihren Deckel an die Draft-Leere koppeln

`maxSubsetTokens` anheben oder bei Draft 0 den ganzen Diff an das Eskalations-Modell geben.

- **Recall-Erwartung**: gering. Seit 2026-09-17 ist das Eskalations-Modell dasselbe `gemini-3.8-flash`; ein Voll-Diff in der Eskalations-Rolle ist derselbe Draft mit 150-s-Deadline — auf 52k Tokens also mit hoher Abbruchwahrscheinlichkeit (§3.3). Auf #16/#17 fand die Second Opinion 1 bzw. 0.
- **Kosten**: eine Pro-Eskalation aus dem 50er-Monatskontingent pro Auslösung plus ~$0,10–0,20 je Voll-Diff-Call.
- **Empfehlung**: nicht als Recall-Hebel. Stattdessen den Trigger T2 reparieren (§6), weil er heute Compliance mit `<already_flagged>` als Divergenz liest.

### Option C — Status quo mit ehrlicher Kennzeichnung

Kein Umbau; ab `estimatedDiffTokens > heuristicMaxDiffTokens` eine Degradation `large_diff` in `result.degradations` und die Zeile „Large diff: reduced recall expected“ im Review-Body/Check; Recall-Sicherheit kommt vom Prescan.

- **Recall-Erwartung**: 81–83 % Draft, 88–90 % kombiniert (gemessen).
- **Latenz/Kosten**: unverändert; das `review_timeout`-Risiko bei 100–300-s-Drafts bleibt.
- **Empfehlung**: nur als Übergang, falls A nicht gebaut wird — die Kennzeichnung ist in jedem Fall ehrlicher als heute.

### Empfehlung

**Option A mit 20k-Batches.** Sie besteht die Gates 1–4 (§6: Recall 42,7 ≥ 41,7, max Batch 66 s ≤ 90 s, 0 FP, Kosten +47 % ≤ +50 %); **12k ist verworfen** (Gate 4: +77 %). Ehrliche Einordnung: der Recall-Gewinn ist klein (+1 bis +2 von 48 bei N=3, Streuung ±2) und die Kosten-Marge dünn (3 Prozentpunkte unter dem Gate); der belastbare Nutzen ist der gedeckelte Latenz-Worst-Case (kein Batch-Call über 84 s in 39 Beobachtungen, gegen 4 von 9 Einzel-Calls über 88 s), also weniger `review_timeout` auf großen PRs. Bau-Entscheid des Gründers: A@20k, wenn +47 % Draft-Kosten auf PRs über 20k Tokens (eine Minderheit der Jobs; Kleindiffs +0) akzeptiert werden; sonst Option C (Degradation `large_diff` + ehrliche Zeile), die in jedem Fall ehrlicher ist als heute. Gate 5 (T2) bleibt offen und ist vor dem Bau zu entscheiden. Option B bleibt verworfen.

## 6. Gates vor der Implementierung (Messregel)

Gemessen 2026-09-29 (zweite Runde), alle Varianten mit demselben Draft-only-Harness und parallelen Batches (§3.5):

| Gate | Regel | 12k (5 Batches) | 20k (3 Batches) |
|---|---|---|---|
| 1 Recall | Mittel gechunkt ≥ Einzel-Call (41,7/48), keine Regel dauerhaft neu verloren | 44,0 (43–46; N=5 mit Zusatzserie 44,0) — **bestanden** | 42,7 (41–45) — **bestanden**, Marge +1,0 |
| 2 Latenz | max. Batch-Latenz ≤ 90 s in allen Läufen | max 83,9 s (Lauf 3) — **bestanden**, 6 s Marge | max 66,1 s — **bestanden** |
| 3 Präzision | r14/r15/r18/r21/r23 im Runner 0 CRITICAL-FP | 0 Issues auf allen fünf, Score 100 — **bestanden** (einmal explizit, gilt für beide) | dito |
| 4 Kosten | Draft-Kosten je XL-Job ≤ +50 % vs. Einzel-Call ($0,100) | $0,176 = **+77 % — verfehlt** | $0,147 = **+47 % — bestanden**, 3 Punkte Marge |

Ergänzende Feststellung zu Gate 1 („keine Regel dauerhaft neu verloren“): jede in den Batch-Varianten verpasste Regel wurde auch vom Einzel-Call in mindestens einem Lauf verpasst — mit einer Ausnahme: SEC-025 `workspace-rename.ts` fehlte 1× bei 20k (Lauf 3) und in keinem Einzel-Call-Lauf beider Runden. Ein einmaliger, kein dauerhafter Verlust (2 von 3 20k-Läufen fanden sie); bei der Bau-Entscheidung als N=3-Rauschen einordnen, in der Messregel für den Bau-Nachweis (3 weitere Läufe) mitführen.
5. **T2 vor dem Bau von A entscheiden**: entweder T2 nur auf Prescan-Findings außerhalb der `<already_flagged>`-Menge (gibt es strukturell nicht) — also T2 streichen oder auf ein anderes Signal (z. B. `omitted_files`, `draft_partial`) umstellen. Sonst kostet jeder große saubere PR weiter eine Pro-Eskalation. **Entschieden 2026-09-29: T2 gestrichen** (§9.4), T1 bleibt.

## 7. Kosten der Messkampagne und Receipts

| Lauf | Jobs | Kosten (USD) |
|---|---|---|
| Replay test#17 ×2 (Draft only) | `90e49049`, `5fa03e90` | 0,199 |
| Replay test#16 ×1 (Draft only) | `5731d409` | 0,167 |
| Kontrolle r20 flash-cascade | `aa328bdb` | 0,071 |
| XL Lauf 1 (volle Kaskade) | `6e5c38a7` | 0,206 |
| XL Variante B (`<already_flagged>`) | `84ce9e3f` | 0,115 |
| XL Variante C (Chunking, 5 Draft-Calls) | `b4834c7a`, `045dd8d0`, `dbd16931`, `a9611992`, `bc065939` | 0,178 |
| XL Lauf 2 (volle Kaskade) | `e2b1206d` | 0,213 |
| **Summe Diagnose-Runde** | 13 Jobs | **1,149** (Budget 5 USD) |
| Gate 3: r14/r15/r18/r21/r23 im Runner | 5 Jobs | 0,028 |
| Gate-Messung Einzel-Call ×3 (Harness) | `de2118fe`, `cfac6c74`, `6fa9d1dd` | 0,300 |
| Gate-Messung 12k ×3 (Harness) | 15 Jobs `1e2841e0`…`ac49defe` | 0,529 |
| Gate-Messung 20k ×3 (Harness) | 9 Jobs `2a7d5351`…`f295f25d` | 0,440 |
| Abgebrochene 12k-Serie (2 volle Läufe + 4 Batches, §3.5) | 14 Jobs `06511f8c`…`633efc1f` | 0,515 |
| **Summe Gate-Runde** | 46 Jobs | **1,812** (Budget 3 USD) |

Pro-Eskalationskontingent des Dogfooding-Kontos: 36/50 vor und nach beiden Runden (Diagnose: kein Claim zur Eskalation markiert; Gate-Runde: Harness ohne Verifier/Eskalation, die Negativ-Kontrollen im Runner erzeugten 0 Claims). Alle Preise aus `scripts/benchmark-cost.ts` gegen die Telemetrie der behaltenen Jobs.

## 8. Nebenbefunde (Follow-ups, nicht in dieser Runde behoben)

1. **Draft-Latenz-Streuung auf großen Prompts** (50–294 s bei 50–90k Tokens) — vor jedem Chunking-Entscheid eine Latenzserie über `review_job_llm_calls` (`phase = 'draft'`, nach `prompt_tokens` gebuckelt) erheben; hängt mit DEADLINE_GUARD D5 zusammen (`review_timeout`).
2. **Verifier-Refutationen als A12b-Daten**: 3 von 40 auf r24, alle gepflanzt, 2 vertretbar; die r07-Fixture `OrderSummary.tsx` liegt mit exakt 4 Ebenen auf der Grenze von Condition 11 („deeper than 4“) — Fixture oder Regeltext präzisieren (AUTHORING „Regel nach dem Buchstaben“).
3. **Prescan SEC-004 False Positive**: `${PRODUCT_COLUMNS}`-Interpolation einer modulweiten Konstante in parametrisierte Queries (r24 Filler `product-repository.ts`, `stock-ledger.ts`) wird 5× als CRITICAL gemeldet; in Produktion ein roter Check auf korrektem Code.
4. **T2-Trigger der Second Opinion** misst Compliance mit `<already_flagged>` (§3.3) — Design-Entscheidung nötig.
5. **Manifest-Alias**: der Draft meldet `password-hash.ts` (MD5 für Passwörter) als SEC-012 statt SEC-014 (2 Läufe); Alias `SEC-014|SEC-012` für Passwort-Kontexte in `AUTHORING.md` erwägen.
6. **Veralteter Kommentar** in `context-cache.ts` (`MIN_CACHEABLE_PREFIX_CHARS`): „echter Law-Prefix ~19k Tokens“ — tatsächlich 4,6k (gefiltert) bzw. 6,9k (ungefiltert).
7. **Benchmark-Nenner**: r24 hebt die gepflanzte Summe des Volllaufs von 129 auf 177. Bis der Runner ein `--skip` kennt, lautet das Rezept für den 129er-Volllauf `--only r0,r1,r20,r21,r22,r23`.
8. **Benchmark-Prompt ≠ Produktions-Prompt**: der Runner gibt dem Draft keine `<already_flagged>`-Tupel (`prescanIssues: []`); eine Option `--with-prescan-tuples` würde die Produktionsform messbar machen.
9. **Halluzinationsmagnet `src/lib/prescan/companion-loader.ts`**: 2 von 4 Läufen auf #17 erzeugen dort einen unhaltbaren Claim (MAINT-007 „listError“, HAL-002 „argument signature“), die anderen beiden 0 — Kandidat für die A12b-Live-Labels.
10. **Router-Frage** (außerhalb dieser Runde): seit Draft und Eskalation dasselbe Modell fahren, ist `pro-direct` derselbe Call unter 150-s-Deadline; der Nutzen der Route für 12–25k-Diffs ist ungemessen.
11. **Vertex `500 INTERNAL` nach > 60 s wird nicht wiederholt** (A11: kein Retry, wenn der gescheiterte Versuch selbst > 60 s lief; `vertex-retry.ts`): 1 von 44 Batch-Calls der Gate-Runde (§3.5). Für einen Einzel-Draft heißt das `model_unavailable` und ein roter Check; für Option A ist `draft_partial` Pflicht (gebaut, §9.3). Ob die 60-s-Regel bei einem echten Server-500 (kein Timeout) einen einzelnen Retry erlauben sollte, ist eine eigene Entscheidung — bewusst NICHT Teil des Baus (ROADMAP To-Do §5).

## 9. Bau von Option A (2026-09-29, Entscheidungen und Umsetzung)

Freigabe des Gründers: **Option A mit 20k-Batches**, 12k verworfen (Gate 4: +77 %), Option B verworfen, Option C nicht nötig. Umsetzung auf `main` `3266235` (Branch `feat/draft-batch-chunking`), Code-Stellen: `src/lib/pipeline/draft-batching.ts` (pure: Schätzung, Packen, Tupel-Filter), `src/lib/pipeline/steps/draft-reviewer-step.ts` (Orchestrierung), `defaults.ts`/`types.ts` (Config und Zustand), `second-opinion.ts` (T2), `integrity-scorer-step.ts` (Score), Flächen `result-persister-step.ts` → Poll-Route → `@unslop/shared/degradation-notice` → CLI, `github-reporter-step.ts`, `worker.ts` (Check-Summary). Tests: `draft-batching.test.ts`, Batching-Block in `draft-reviewer-step.test.ts`, `draft_partial`-Replay in `cascade-degradation.test.ts`, je ein Fall in `integrity-scorer-step`, `result-persister-step`, `poll-route`, `degradation-notice`, `github-reporter-step`, `worker-routing`, `format` (CLI), `defaults`, T2-Abschaltung in `second-opinion.test.ts` und `second-opinion-reviewer-step.test.ts`.

### 9.1 Batch-Grenze und Zuschnitt

- **Eigener Config-Wert `cascadeConfig.draftBatchMaxTokens`** (Default 20000, per Repo über `pipeline_config.cascade` übersteuerbar wie jede andere Cascade-Schraube, Operator-Allowlist der Settings-Route ergänzt). `heuristicMaxDiffTokens` (12k, Routing-Frage) bleibt unangetastet — zwei Fragen, zwei Schrauben. Der Benchmark-Runner nimmt ihn per `--cascade draftBatchMaxTokens=…` entgegen.
- **Auslöser**: `ceil(combinedDiff.length / 4) > draftBatchMaxTokens` — dieselbe Schätzung wie der Router. Auf der Route flash-cascade greift das damit erst über 25k (12–25k ist pro-direct, §5); ein Repo mit abgesenktem `proDirectMaxDiffTokens` chunkt entsprechend früher.
- **Packen**: `reviewableFiles` in Diff-Reihenfolge greedy in Batches ≤ `draftBatchMaxTokens`; eine Datei über der Grenze steht allein, Dateien werden nie zerschnitten (exactQuote-Anker, Zeilennummern). Gezählt wird der Diff-Text **inklusive `=== FILE: … ===`-Header**, also das, was der Prompt trägt — die Gate-Messung (§3.5) zählte nur die Patches; auf r24 ergibt beides drei Batches, die Bau-Nachweis-Läufe (§9.6) sind die Referenz.
- **Ein Batch = kein Chunking**: liegt der Diff über der Grenze, ergibt das Packen aber nur einen Batch (eine überlange Datei), läuft der heutige Einzel-Call. Unter der Grenze bleibt der Draft-Request **byte-identisch** zu vorher — bewiesen durch `draft-reviewer-step.test.ts` („byte-identisch zum Einzel-Call“: Protokoll, Evidence, Practices, alle Prescan-Tupel, NEW-CODE-Marker, ganzer `combinedDiff` als eine Zeichenkette verglichen).
- **pro-direct chunkt nicht** (§5 Umsetzungshinweis): ein Call in der Eskalations-Rolle wie bisher. Scheitert er und fällt der Job auf die Flash-Kaskade zurück (D10), chunkt der Flash-Draft dann selbst.

### 9.2 Der Batch-Pass

- Ein `runReviewerPass` pro Batch, **alle parallel** (`Promise.allSettled`), mit demselben Prompt-Envelope (gleicher Layer-1-Prefix, gleicher Explicit Cache, gleiche Rolle) — der Envelope wird einmal pro Job aufgelöst.
- User-Prompt je Batch: Evidence- und Practices-Sektion **job-weit** (wie bisher, Risiko a in §5), `<already_flagged>` **auf die Dateien des Batches gefiltert**, dann der Batch-Diff im Produktionsformat. Manifest der Validation-Boundary = nur die Batch-Dateien; ein Issue auf einem fremden Pfad ist halluziniert und fällt.
- **Deadline Guard**: jeder Batch-Versuch löst sein Budget-Signal selbst aus dem Envelope auf (`resolveCallDeadlineMs` je Call, `deadline.ts`); Backoff- und Parse-Retries fragen wie bisher `hasBudgetForCall`. Test: „jeder Batch-Call trägt das Budget-Signal“.
- **Vereinigung**: Issues in Diff-Reihenfolge konkateniert (die Batch-Dateien sind disjunkt, die Rule+File-Aggregation je Batch deshalb job-weit korrekt); Token-Verbrauch summiert; `cache_fallback`, sobald ein Batch inline zurückfiel. **Summary**: nur die Summaries der Batches mit Findings, in Diff-Reihenfolge mit Leerzeichen verbunden; ohne Findings der Standardtext „No AI slop found.“ — ein Batch-„No AI slop found.“ neben Findings anderer Batches wäre falsch. Verändert der Scorer später ein Draft-Finding, ersetzt A12a den Text ohnehin.
- **Telemetrie**: eine `draft`-Zeile in `review_job_llm_calls` pro Batch-Versuch, wie heute pro Call. Keine Migration; ein `chunk_index` wäre nur für Per-Batch-Auswertungen nötig (ROADMAP To-Do §5).

### 9.3 Degradation `draft_partial`

- **Ein oder mehrere Batches scheitern, mindestens einer gelingt** (jeder Fehler: Vertex-500 ohne Retry nach A11, `ModelUnavailableError`, Parse-Doppelfehler, Abbruch am Job-Budget): Degradation `draft_partial` in `cascade.degradations`, die Dateien der gescheiterten Batches in Diff-Reihenfolge in `cascade.draftUnreviewedFiles`; die Issues der übrigen Batches laufen normal durch Verifier, Eskalation und Scorer; der Job endet `done`. Fehler werden geloggt (`[DraftReviewer] Batch i/N gescheitert … draft_partial`), die Telemetrie-Zeile (`api_error`/`parse_error`) ist geschrieben — kein Swallowing (MAINT-001).
- **Score null** (`integrity-scorer-step.ts`): dieselbe Regel wie beim teilweise gelaufenen Verifier (D7) — ein Score über gesehene Claims behauptete eine Vollständigkeit, die es nicht gab. Gilt auch, wenn die gesehenen Batches nichts fanden (kein 100).
- **Persistenz und Flächen**: `result.draft_unreviewed_files` (Persister), `ScanResult.draftUnreviewedFiles` (Shared-Contract, additiv), Poll-Route mappt strukturell validiert (Nicht-Liste ⇒ `[]`). Kanonischer Text `formatDraftPartialNotice` in `@unslop/shared/degradation-notice`: *„Reduced coverage: the AI review failed on N files — not reviewed: a, b, c.“* — **alle** Dateien, keine gekürzte Liste. Gerendert in Check-Summary (`worker.ts`), Review-Body und Approval-Comment (Score-Block, ohne Kursiv-Markup wegen Unterstrichen in Pfaden), CLI (sanitisiert). Zeit-Skip- und Partial-Hinweis koexistieren; der generische Satz „Reduced confidence mode“ erscheint nur, wenn keiner der beiden greift. **VS-Code-Extension nicht angefasst** (ROADMAP To-Do §3, zusammen mit dem offenen Zeit-Skip-Hinweis); **MCP `get-result`** reicht wie schon `degradations`/`skippedStages` auch dieses Feld nicht durch (To-Do §3).
- **Alle Batches scheitern** ⇒ Verhalten des Einzel-Drafts: der Fehler propagiert in den `markJobError`-Pfad (`model_unavailable`/`server_error`). **Vorrang eines Deadline-Abbruchs**: hat mindestens ein Batch das Job-Budget gerissen, endet der Draft als `ReviewTimeoutError` (`review_timeout`, D5), denn dann ist die Restzeit weg; sonst zählt der erste Fehler in Diff-Reihenfolge. Ein Deadline-Abbruch nur **eines** Batches neben erfolgreichen ist dagegen `draft_partial`, kein Job-Timeout — Verifier und Folgestufen sehen dann ihre eigenen Schwellen.

### 9.4 Second-Opinion-Trigger T2 gestrichen (Gate 5)

T2 „prescan-divergence“ (Prescan ≥ 3, Draft 0; LLM_LANE_QUALITY_SPEC §4.2) ist entfernt: `SECOND_OPINION_GATES.divergenceMinPrescanFindings` und `hasPrescanDivergence` gelöscht, `SecondOpinionReason` nur noch `'test-gap'`. Begründung §3.3/§4: seit `<already_flagged>` misst T2 auf sauberem Code Compliance, nicht Divergenz, und kostete pro großem sauberen PR eine Pro-Eskalation (unslopai/test#16/#17: zwei Eskalationen für 1 bzw. 0 Findings). T1 bleibt unverändert (per Datei). Kein Ersatzsignal in dieser Runde — Kandidaten (`omitted_files`, `draft_partial`) sind ohne Messung nicht belegt.

### 9.5 Nicht Teil dieses Baus

Retry-Verhalten bei Vertex-500 nach > 60 s (§8.11, eigene Entscheidung), Verifier, Eskalation, Scorer-Logik jenseits des Null-Falls, `chunk_index`-Migration, Extension-Anzeige, MCP-Feld, Live-Receipt auf unslopai/test (folgt nach dem Merge als Chronik-Zeile).

### 9.6 Bau-Nachweis (Benchmark über den Runner, echter Pipeline-Code, 2026-09-29)

Erwartung: r24 im Band 41–45/48 Draft-Recall, Negativ-Kontrollen 0 CRITICAL, Budget ≤ 2 USD, Pro-Kontingent unverändert. Details im Benchmark-Log (`docs/benchmarks/RULE_RECALL_BENCHMARK.md`, Eintrag 2026-09-29 „Option A gebaut“).

| Lauf | Job | Batches (Dateien / ~Tokens) | Batch-Latenzen | Draft | combined | Score | Cache |
|---|---|---|---|---|---|---|---|
| r24 #1 | `5712a6dc` | 30 / 32 / 17 — 19,2k / 19,2k / 13,3k | 42,9 / 49,6 / **63,3 s** | **42/48** | 46/48 | 98 | `explicit_created` |
| r24 #2 | `fa1c01d6` | dito | 36,4 / 36,3 / **69,6 s** | **42/48** | 46/48 | 97 | `explicit_hit` |
| r14/r15/r18/r21/r23 | 5 Jobs | Einzel-Call (unter der Grenze) | — | 0 Issues | — | 100 | — |

Verifier 43/43 CONFIRMED je Lauf, 0 Refutationen, 0 Eskalationen. Kosten r24 ×2 $0,465 (Draft $0,141 je Lauf, Gate-Messung $0,147), Kontrollen $0,029, gesamt **$0,49**. Pro-Kontingent 36/50 vor (15:03 UTC) und nach (15:09 UTC) der Runde. Gate 1 (≥ 41,7): 42 ✓; Gate 2 (max Batch ≤ 90 s): 70 s ✓; Gate 3 (0 CRITICAL-FP): ✓; Gate 4 (Draft-Kosten ≤ +50 % vs. $0,100): $0,141 = +41 % ✓. `draft_partial` trat im Nachweis nicht auf (kein Batch scheiterte) und ist per Unit- und Replay-Test belegt; der Live-Receipt auf unslopai/test folgt nach dem Merge (ROADMAP To-Do §1).
