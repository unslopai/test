# LLM-Lane-Quality-Epic: Second-Opinion-Eskalation (Draft-Miss-Recovery)

**Status: UMGESETZT 2026-08-26 (gleicher Tag; User zog die Samstags-Session vor und gab die Spec frei).** Alle §5-Akzeptanzkriterien erfüllt: r17 **7/7** (2/2 Läufe + Volllauf; vorher 4/7), Volllauf-A/B **122/126 (96,8%)** vs. 118/126 Referenz, 0 neue CRITICAL-FPs (Trigger feuerte auf keiner Negativ-Kontrolle; der vorbestehende r18/MAINT-001-Flash-FP bleibt Follow-up §8), Kosten pro Trigger ~$0,03–0,04 (geschätzt; exakte Telemetrie erst nach Migration 044 — **die muss der User noch im SQL-Editor ausführen**). Verbleibende 4 Misses (SEC-012/019/021, CONC-008) liegen per Design außerhalb der Trigger (Phase 0 bewies sie als Pro-erreichbar — Hebel wäre ein breiterer Trigger oder pro-direct, bewusst nicht gebaut: Kosten). Messdaten: `results/2026-08-26-phase0-*.json`, `-secop-*.json`; Ergebnis-Sektion in `RULE_RECALL_BENCHMARK.md`.
Interview-Entscheidungen (2026-08-26): Scope = Second-Opinion-Step (FP-Forensik r18 und Draft-Model-A/B sind Follow-ups, §8); Second Opinions **zählen als Pro-Eskalation** (gleiches Budget-Gate, keine neue Buchhaltung); Benchmark-Budget für die Umsetzung **~$5** (verbraucht: ~$2,50 über Phase 0 + Dev + FP-Gate + 2 Volllauf-Hälften).

---

## §1 Ausgangslage (gemessen, nicht vermutet)

Referenzlauf 2026-08-26 (`RULE_RECALL_BENCHMARK.md`, Commit c0e1eb2): kombiniert **118/126 (93,7%)**, Draft allein 110/126, Prescan 46/126 (0 FP), ≈$0,30/Volllauf (ursprünglich $0,18 gemeldet — Preis-Korrektur 2026-08-26, s. `RULE_RECALL_BENCHMARK.md`). Die 8 Misses clustern:

| Cluster | Misses | Befund |
|---|---|---|
| **Test-Diffs** | TEST-003/007/011 @ r17 | Draft findet in r17 nur **2/7** — stabil über alle Läufe. Text-Hebel verbrannt (043-Revert: globale Prompt-Nebenwirkung). |
| Security-Semantik | SEC-012, SEC-021 @ r03; SEC-019 @ r08 | Negative-Space-Regeln („etwas FEHLT"). SEC-019 gehört langfristig in die Prescan-Config-Engine (eigenes Epic), nicht hierher. |
| Go-Nebenläufigkeit | CONC-008\|CONC-001 @ r10 | Geschwister-Mutex-Analyse; deterministische Variante bewusst verworfen (FP-trächtig). |
| Large-PR | MAINT-003 @ r20 | Fiel auch unter echtem pro-direct (N=1, erst reproduzieren). |

Dazu zwei Nicht-Recall-Befunde: die **LLM-FP-Neigung auf r18** (MAINT-001, 2/2 Läufe — Follow-up §8) und der **Honesty-Fall** aus Prod (Draft: 0 Issues in einer 928-Zeilen-`App.tsx`, während die Prescan-Lane 4–6 Findings hatte — ROADMAP §1b-Beobachtung vom 2026-08-23).

**Der Architektur-Fakt, der dieses Epic erzwingt:** `escalation-reviewer` re-verifiziert ausschließlich Claims, die der Flash-Draft bereits gemacht hat (`claim-verification.ts`, Verdict-Contract). **Ein Draft-Miss ist heute unrettbar** — kein Tuning der bestehenden Eskalation kann TEST-003 zurückholen. Die einzige Route, auf der Pro selbst *findet*, ist `pro-direct` (Router-Heuristik, ganzer Diff). Das Epic baut deshalb einen dritten Pro-Einsatzweg: die **Second Opinion** — Pro reviewt gezielt einen Datei-Teilbereich, wenn deterministische Signale Draft-Under-Reporting anzeigen.

## §2 Nicht-Ziele (bewusst)

1. **Keine Law-/`public_explanation`-Textänderungen** — der Hebel ist seit 043 nachweislich netto-negativ.
2. **Kein Draft-Modellwechsel** in diesem Epic (A/B-Harness ist Follow-up §8; anderer Cache-Key!).
3. **Keine Verifier-Härtung** (r18-FP-Forensik ist Follow-up §8 — Präzision nicht nebenbei „mitfixen").
4. **Kein SEC-019-Detektor** — das ist deterministische Config-Engine-Arbeit (ROADMAP §1).
5. **Kein neues Kontingent/keine neue RPC** — Second Opinion läuft über `consumeProEscalationBudget` (Interview-Entscheidung).
6. **Kein Consortium/Zweitvendor** — eigenes späteres Epic (ROADMAP §6).

## §3 Phase 0 — Messkampagne (GATE für alles Weitere)

**Kernfrage: Findet Pro die Misses überhaupt?** Wenn `gemini-3.1-pro-preview` TEST-003/007/011 auf r17 ebenfalls verpasst, ist der Second-Opinion-Hebel für diesen Cluster tot und das Epic endet ehrlich nach Phase 0 (Ergebnis: „Hebel ist Modellwahl, nicht Eskalation" → §8-Backlog).

### §3.1 Rig-Erweiterung (kleiner Code-Eingriff, zuerst)
`scripts/lib/rule-recall-benchmark.ts` baut den `PipelineContext` direkt mit `DEFAULT_CASCADE_CONFIG` (Z. ~240). Neu:
- `--cascade key=value,key=value` — überschreibt einzelne `CascadeConfig`-Felder für den Lauf. `--cascade heuristicMaxDiffTokens=1,heuristicMaxFiles=1` erzwingt pro-direct für jede Fixture („Force-Pro").
- `--runs N` — wiederholt die selektierten Fixtures N-mal und rendert die Stabilität pro planted Rule (`caughtByDraft` x/N). Spart das manuelle Mehrfach-Aufrufen und macht N=2/N=3-Aussagen billig.
- Beide Flags landen im Report-JSON (`cascadeOverrides`, `runsPerFixture`) — ein Force-Pro-Ergebnis darf nie als Normal-Lauf lesbar sein.

### §3.2 Experimente (Kosten je ~$0,03–0,08; Phase 0 gesamt ≤ $0,60)

| # | Lauf | Frage | Erfolgskriterium |
|---|---|---|---|
| E1 | `--only r17 --cascade <force-pro> --runs 2` | Findet Pro TEST-003/007/011? | Regel gilt als „Pro-erreichbar" bei 2/2 (bei 1/2: dritter Lauf entscheidet) |
| E2 | `--only r03 --cascade <force-pro> --runs 2` | SEC-012, SEC-021? | dito |
| E3 | `--only r10 --cascade <force-pro> --runs 2` | CONC-008? | dito |
| E4 | `--only r20 --runs 2` (normal, pro-direct greift eh) | Ist MAINT-003 ein stabiler Miss oder N=1-Flake? | 0/2 oder 1/2 ⇒ stabiler Miss, in §16 als solcher notieren |
| E5 | `--only r14,r15,r18,r21 --cascade <force-pro> --runs 3` | **FP-Verhalten von Pro auf sauberem Code** — das Risiko-Profil des ganzen Features | 0 CRITICAL-FP über 3 Läufe; jede FP-Beobachtung wird dokumentiert und fließt in die Trigger-Schwellen (§4.3) |

**Entscheidungsmatrix nach Phase 0:** Der Second-Opinion-Step (Phase 1) wird NUR für die Cluster gebaut, die E1–E3 als Pro-erreichbar beweisen. Erwartung (ehrlich): der Test-Cluster ist der wahrscheinlichste Gewinner (Pro-direct auf r20 hat schon Attention-stabile 17/18 gezeigt); die Negative-Space-SEC-Regeln sind auch für Pro schwer. Wenn NUR der Test-Cluster besteht, ist das Epic trotzdem tragfähig: +3 Regeln ⇒ 121/126 (96,0%).

## §4 Phase 1 — Design des Second-Opinion-Steps

### §4.1 Einordnung in die Cascade
Neuer Step `second-opinion-reviewer` **nach** `escalation-reviewer`, **vor** `integrity-scorer` (in `DEFAULT_PIPELINE_CONFIG.enabledStepIds`; Worker filtert unbekannte IDs — Repos mit persistierter Alt-Config bekommen den Step erst bei Config-Update, gleiches Verhalten wie beim `pre-scanner`, dokumentiert in ROADMAP §1b).

Skip-Bedingungen (Reihenfolge wie in allen Steps): `shouldAbort`, `llmSkipped`, `route === 'pro-direct'` (Pro hat schon alles gesehen), kein Trigger gefeuert.

### §4.2 Trigger (deterministisch, unit-getestet, Code-Konstanten)
Konstanten im Stil von `REFERENCE_PRACTICE_GATES` (`defaults.ts`) — bewusst KEINE `pipeline_config`-Felder in v1 (Tuning via Telemetrie + Deploy, Interview-Muster aus BEST_PRACTICES §9.1):

```ts
export const SECOND_OPINION_GATES = {
    /** T1: Anteil Test-Dateien an den reviewable Files, ab dem der Diff als test-lastig gilt. */
    testFileShareThreshold: 0.5,
    /** T2: Prescan-Findings, ab denen ein 0-Findings-Draft als Divergenz gilt. */
    divergenceMinPrescanFindings: 3,
    /** Obergrenze des Subset-Prompts (Schutz vor Kostenexplosion). */
    maxSubsetTokens: 12000,
} as const;
```

- **T1 „Test-Gap"** *(Amendment nach Phase 0, 2026-08-26)*: `testFileShare ≥ 0.5` → Pro reviewt **die Test-Dateien, in denen KEINE Lane ein Finding hat** (per Datei, nicht ganz-oder-gar-nicht). Die ursprüngliche „0 Findings in Test-Dateien insgesamt"-Fassung hätte den Zielfall r17 verfehlt: dort finden Draft/Prescan ~5 Findings in Test-Dateien, und die Misses (TEST-003/007/011) liegen in den drei finding-losen Dateien daneben. Kosten-Trade-off dokumentiert: test-lastige PRs mit sauberen Tests zahlen einen Subset-Pro-Call. Test-Datei-Klassifikator als pure Funktion (`second-opinion.ts: isTestFilePath`): `.test.`/`.spec.`-Infix, `_test.go`/`_test.py`, `test_*.py`, `/__tests__/`, `/tests?/`, `/test/`-Segment — mit Unit-Tests für jede Sprache und Gegenbeispiele (`contest.ts`, `attest.go`, `src/testing/` dürfen NICHT matchen).
- **T2 „Prescan-Divergenz"** (der echte Prod-Fall vom 2026-08-23): Prescan-Lane hat `≥ 3` Findings UND der Draft hat **0** Issues → Pro reviewt den vollen Diff (gedeckelt auf `maxSubsetTokens`, sonst die N größten Dateien bis zum Deckel). Bewusst NICHT „0 Findings auf großem Diff" allein — das würde auf jedem sauberen großen PR feuern (Kosten + FP-Risiko genau auf Clean-PRs, siehe E5). Die Divergenz ist das belastbare Signal: zwei unabhängige Lanes widersprechen sich.
- T1 und T2 können beide feuern ⇒ EIN Call auf der Vereinigungsmenge der Dateien.

### §4.3 Budget, Fehler, Degradation (D10/D11-konform)
- `consumeProEscalationBudget(ownerUserId)` genau EINMAL unmittelbar vor dem Call — **dieselbe Semantik wie `escalation-reviewer`** (Interview-Entscheidung: zählt als Pro-Eskalation). Verweigert ⇒ Degradation `pro_budget_exhausted` + Telemetrie `skipped_budget`, nie ein Job-Fehler.
- Wichtig: `escalation-reviewer` und `second-opinion-reviewer` können im selben Job beide Budget ziehen (2 Verbräuche). Das ist konsistent mit heute (pro-direct + nichts weiter = 1; cascade + targeted = 1) und akzeptiert — im Grenzfall kostet ein Job 2 Eskalationen. In `UNIT_ECONOMICS.md` als Notiz nachziehen.
- Pro-API-Fehler ⇒ Degradation `pro_api_error`, Draft-Ergebnis bleibt unverändert bestehen (Second Opinion ist additiv, nie destruktiv).

### §4.4 Finding-Verarbeitung (Wiederverwendung des Draft-Pfads)
Der Call nutzt exakt die pro-direct-Mechanik aus `draft-reviewer-step.ts`: `buildInlineEnvelope` (Pro ist uncached, global-Endpoint), gleicher Reviewer-Prompt-Contract, dann `validateIssuesAgainstManifest` → `filterIssuesByScope` → `aggregateIssuesByRuleAndFile`. Dafür wird `runDraftOnModel` NICHT dupliziert, sondern der gemeinsame Kern (Call + Parse + Validierungskette) in eine von beiden Steps genutzte Funktion extrahiert (MAINT-001-Gefahr sonst vorprogrammiert).
- **Verdicts**: Second-Opinion-Findings übernehmen die self-reported Confidence (wie pro-direct, `clampConfidence`) und werden NICHT vom Flash-Verifier re-verifiziert — Flash über Pro wäre invertierte Autorität (D3-Logik). Design-Entscheidung im Code-Kommentar festhalten.
- **Dedupe**: Findings, deren `rule`+`path` bereits ein bestehendes (aggregiertes) Issue trifft, werden verworfen — Second Opinion darf keine Duplikate zu Draft/Prescan erzeugen (gleiches Muster wie die Prescan-Merge-Dedupe).
- **Source-Kennzeichnung**: `PipelineIssue.source: 'second-opinion'` (Typ-Erweiterung in `types.ts`; Konsumenten prüfen: `github-reporter`, `result-persister`, CLI-Rendering — Source wird bisher wie behandelt? Beim Implementieren verifizieren, Erwartung: transparent, da `source` schon `draft-reviewer`/Prescan unterscheidet).
- **Summary-Honesty**: Wenn T2 gefeuert hat und Second Opinion Findings liefert, obwohl der Draft „No slop" sagte, wird `reviewSummary` ersetzt/ergänzt (kein „No AI slop found." neben CRITICAL-Findings — die Lehre aus dem §1g-Honesty-Fix).

### §4.5 Telemetrie
Neue Phase `escalate_second_opinion` in `review_job_llm_calls`. **Achtung: die Spalte hat einen CHECK-Constraint** (`021_create_review_job_llm_calls.sql`: `phase in ('draft','verify','escalate_targeted','escalate_full')`). Nötig ist eine Mini-Migration (Constraint drop + neu mit 5 Werten). **Management-API ist down** ⇒ Migration als Datei ins Repo (`migrations/044_...`) UND am Samstag vom User im Dashboard-SQL-Editor ausführen (etabliertes Verfahren, vgl. §16-Backfill-Notiz). Ohne die Migration schlägt jeder `recordLlmCall` der neuen Phase fehl — der Step darf deshalb erst NACH bestätigter Migration deployt/gemerged werden (Reihenfolge im Samstag-Plan §7).

## §5 Phase 2 — Auswertung & Abnahme

Alle Messungen mit dem Rig; Reihenfolge und Gates:

1. **Dev-Iterationen** auf den Trigger-Bundles: `--only r17` (T1) und ein synthetischer T2-Fall (r-Fixture mit Prescan-Findings + draft-missbaren Regeln — der 928-Zeilen-Prod-Fall als neue Fixture wäre ideal, sonst r05 mit hohem Prescan-Anteil prüfen).
2. **FP-Gate**: `--only r14,r15,r18,r21 --runs 3` MIT aktivem Step — die Trigger dürfen auf den Kontrollen entweder gar nicht feuern (erwartet: T1 nein — keine Test-Dateien-Fixtures unter den Kontrollen; T2 nein — Prescan hat dort 0 Findings) oder, falls doch, 0 CRITICAL-FPs erzeugen. Jedes Feuern auf einer Kontrolle wird im Report sichtbar gemacht (`secondOpinionTriggered`-Feld).
3. **Referenz-A/B**: 1 Volllauf vorher (existiert: 118/126) vs. 1–2 Volläufe nachher.

**Akzeptanzkriterien (hart):**
- r17 kombiniert ≥ 6/7 (wenn E1 die Pro-Erreichbarkeit bewiesen hat) — sonst ist das Feature auf dem Zielcluster wirkungslos und wird nicht gemerged.
- Volllauf-Recall ≥ 118/126 (keine Regression irgendwo; die 043-Lehre: globale Nebenwirkungen aktiv suchen, nicht annehmen).
- 0 neue CRITICAL-FPs auf den 4 Negativ-Kontrollen über 3 Läufe.
- Kosten pro getriggertem Job ≤ ~$0,10 (Telemetrie-Receipt via `review_job_llm_calls`).
- Vor jedem Volllauf: `billing_accounts.escalation_month_count` des Benchmark-Owners prüfen/resetten (Betriebs-Lehre aus dem Referenzlauf; Reset braucht User-Freigabe — Classifier blockt billing-Writes).
- Code: ARCH-001 ≤ 15, Methoden < 50 Zeilen, keine generischen Namen; Unit-Tests für Trigger-Klassifikator, Skip-Pfade, Budget-Gate, Dedupe, Summary-Ersatz; `npm test`/`tsc`/`lint` grün.

**Budget-Rechnung Samstag (~$5-Rahmen):** Phase 0 ≤ $0,60 · Dev-Iterationen ~$1,00 · FP-Gate (3× Kontrollen) ~$0,30 · 2 Abschluss-Volläufe ~$0,40 · Reserve für Wiederholungen/Flakes ~$1,50 ⇒ ~$3,80 Plansumme.

## §6 Produkt-/Unit-Economics-Notiz
Second Opinion zieht das bestehende 50/Monat-Eskalationsbudget (Pro-Tier). Kostenprofil pro Trigger: Subset ~2–6k Input-Tokens ⇒ ~$0,004–0,012 Input + typ. $0,01–0,03 Output. Trigger-Rate in Prod ist unbekannt — nach Launch über die neue Telemetrie-Phase messen und `UNIT_ECONOMICS.md` nachziehen; die Deckelung über das existierende Budget-Gate macht das Feature margensicher by construction.

## §7 Samstag-Arbeitsplan (Reihenfolge verbindlich)

1. **Freigabe dieser Spec** (oder Amendments) — 10 min.
2. **Migration 044** (phase-Constraint) schreiben + im SQL-Editor ausführen + per `db-query.ts`-Insert-Probe verifizieren — 20 min.
3. **Rig-Erweiterung** `--cascade`/`--runs` + Unit-Test für das Override-Parsing — 45 min.
4. **Phase 0 (E1–E5)** fahren, Ergebnisse in `RULE_RECALL_BENCHMARK.md` als „Phase-0-Messkampagne" notieren — 60 min (Netzwerk-Wartezeit). **GATE: Entscheidungsmatrix auswerten.**
5. **Step bauen** (Trigger-Klassifikator → Extraktion des gemeinsamen Reviewer-Call-Kerns → Step + Tests) — 2–3 h.
6. **Phase 2 Messkette** (Dev-Iterationen → FP-Gate → Referenz-A/B) — 60–90 min.
7. **DOC-001**: ROADMAP §6/§16 + `RULE_RECALL_BENCHMARK.md` + diese Spec (Status-Zeile) im selben Commit wie der Code; Benchmark-Jobs aufräumen (Kosten VORHER rechnen).

Fallbacks: Scheitert das Phase-0-Gate für alle Cluster ⇒ Schritt 5/6 entfallen, stattdessen Befund dokumentieren + §8-Backlog schärfen (der Samstag liefert dann Messwissen statt Feature — das ist ein gültiges Ergebnis). Scheitert nur T2-seitig die Fixture-Frage ⇒ T2 hinter Code-Konstante deaktiviert lassen (`divergenceMinPrescanFindings: Infinity`) und nur T1 shippen.

## §8 Follow-ups (explizit NICHT Samstag)
- ~~**FP-Forensik r18 + Verifier-Härtung**~~ — **erledigt 2026-08-26, gleiche Session**: Specimen gezogen (Verdict-Telemetrie), Befund: KEIN Verifier-Problem — Flash refutete, Pro bestätigte, beide vertretbar, weil die Fixture den Fehler tatsächlich ohne Logging verwarf (MAINT-001 verlangt wörtlich „at least log it with context"). Fixture gefixt, 3/3 Läufe clean; Lehre in `AUTHORING.md`. Verifier-Härtung damit gegenstandslos.
- **Verifier-Model-A/B-Harness** — **gebaut 2026-09-17** (Nachtrag zum Draft-Harness unten; Policy `MODEL_STRATEGY_2026-08.md` §1f Punkt 2): `UNSLOP_VERIFIER_MODEL_OVERRIDE` + `UNSLOP_VERIFIER_THINKING_LEVEL_OVERRIDE` in `models.ts` übersteuern NUR den Verifier (Draft bleibt Vergleichskonstante); nur eu-fähige Flash-Kandidaten (kein global-Pfad — der Verifier läuft immer über den location-gebundenen Explicit Cache); eigener Cache-Key je Modell. Messgrößen: False-Refutation-Rate und Surviving im Volllauf. 3 Tests in `models.test.ts`. Noch nicht gemessen: 3.8 als Verifier.
- ~~**Draft-Model-A/B-Harness**~~ — **erledigt 2026-08-26, gleiche Session**: `UNSLOP_DRAFT_MODEL_OVERRIDE`(+`_ENDPOINT=global`) in models.ts, `isGlobalEndpointModel` steuert Client-Wahl UND Inline-Envelope. Drei Kandidaten gemessen: Flash-Lite disqualifiziert (55/126); **gemini-3.5-flash 119/126** (EU + Cache); **gemini-3.7-flash ~121/126** (global-only, Intro-Preis, 1 JSON-Ausfall). Modellwechsel = offene Produktentscheidung, Optionen in ROADMAP §6; Vergleichstabelle in `RULE_RECALL_BENCHMARK.md`.
- **Consortium Consistency** (Zweitvendor-Verifier) — ROADMAP §6.
- **SEC-019** deterministisch (Config-Engine, ROADMAP §1) — würde den Miss zero-token erledigen.
- **MAINT-003/Attention-Decay-Analyse** auf r20, falls E4 den Miss als stabil bestätigt.
