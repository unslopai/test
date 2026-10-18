# Sprachabdeckung: wie unslop Nicht-JS/TS-Code prüft

**Status: FREIGEGEBEN 2026-09-30 (Luca), Entscheidungen in §8.** E1–E6 wie vorgeschlagen, E7 abweichend: Stufe 0 und 1 sofort, Stufe 2 für Python und Java vor dem Launch, Go erst nach geklärter Latenz. **Stufe 0 ist gebaut (2026-09-30, §4.4 „Stand nach Stufe 0“, §5, §7.1), Stufe 1 ebenfalls (§6.2 „Stand nach Stufe 1“). Stufe 2 ist für Python und Java gebaut (2026-09-30, §6.2 „Stand nach Stufe 2“, Gate-Ergebnisse in §6.5): Python ist Default, Java nur je Repo-Config, Go bleibt draußen (E7). Stufe 3 ist gebaut (2026-10-03, Gate-Ergebnisse in §6.6): der Law-Filter erkennt Sprachen am Pfad; Default der Modell-Review sind JS/TS, Python, Go und PowerShell; Java, C/C++ und Terraform sind nur je Repo-Config an.** Die Abschnitte §2 bis §4 beschreiben den Stand vor dem Bau.

Code-Stand aller Belege und Messungen: `main` bei `17ee7ec` (2026-09-30). Rohdaten: `fixtures/rule-recall/results/2026-09-30-langcov-*.json`. Die Benchmark-Jobs liegen mit `--keep` in `review_jobs` und `review_job_llm_calls`. Modelle laut `src/lib/pipeline/models.ts`: Draft `gemini-3.8-flash`, Verifier `gemini-3.6-flash`, Eskalation `gemini-3.8-flash` (in keiner Messung gerufen).

---

## 1. Die Entscheidung in Kurzform

**Empfehlung: Option C, gestuft.**

1. **Stufe 1 (deterministisch):** Ein PR ohne JS/TS-Datei bekommt einen Pre-Scan statt „Nothing to review“. Vorher müssen drei gemessene Fehlalarm-Quellen des Pre-Scanners behoben sein (§4.4), und das Ergebnis heißt überall „nur deterministische Prüfung“.
2. **Stufe 2 (LLM):** Python, Go und Java kommen in die LLM-Lane. Für diese drei liefert der Law-Filter heute schon die richtigen Regeln (§4.3).
3. **Stufe 3 (LLM, später):** C/C++, Terraform und PowerShell erst, wenn die Ökosystem-Erkennung ihre Regeln nicht mehr wegfiltert. Kubernetes-YAML bleibt deterministisch, weil der Pre-Scanner dort schon 11 von 11 findet.

**Warum nicht nur A:** Der Pre-Scanner findet auf den Nicht-JS/TS-Fixtures 27 von 69 gepflanzten Verstößen, im CLI/MCP-Pfad 7 von 69. Die LLM-Lane findet 69 von 69.

**Warum nicht nur B:** In einem Repo mit erkanntem Ökosystem filtert der Law-Filter 31 Regeln weg. Gemessen fällt der Draft dann auf C, Kubernetes, Terraform und PowerShell von 26/26 auf 1/26. Und ein Config-only-PR bliebe weiter ungeprüft.

**Die wichtigste Zahl:** Der Benchmark meldet 125/126. Auf dem Produktionspfad von heute wären es rechnerisch 59/126 (§4.1).

## 2. Ist-Zustand

### 2.1 Der Filter

- `src/lib/pipeline/helpers.ts:381` definiert `REVIEWABLE_EXTENSIONS` als `.ts .tsx .js .jsx .mjs .cjs`. `isReviewableFile` (`:391-396`) prüft nur die Endung und eine Ignore-Liste (`:383-386`).
- Alles Nachgelagerte liest `reviewableFiles`: Router, Draft, Batching, Verifier, Scope-Filter.

### 2.2 Webhook-Pfad (GitHub App und Legacy-OAuth)

| Schritt | Verhalten | Beleg |
|---|---|---|
| Diff-Loader | filtert `prFiles` mit `isReviewableFile`. Bleibt nichts übrig, setzt er `shouldAbort` mit „No reviewable code files in this pull request.“ | `steps/diff-loader-step.ts:34-52` |
| Pre-Scanner | bricht bei `shouldAbort` sofort ab, schreibt kein `partial_result` | `steps/pre-scanner-step.ts:32` |
| Pre-Scanner im gemischten PR | scannt alle `prFiles` mit Patch, auch `.py`, `.yaml`, `.tf` | `steps/pre-scanner-step.ts:66-69` |
| Alle LLM-Steps | kehren bei `shouldAbort` zurück | `draft-reviewer-step.ts:67`, `claim-verifier-step.ts:52`, weitere |
| Reporter | postet den Kommentar „✅ Anti-Slop Gatekeeper: No reviewable code files in this pull request.“ | `steps/github-reporter-step.ts:33-36, 52-61` |
| Persister | `status: done`, `has_slop: false`, `issues: []`, `nothing_reviewed: true`, `files_reviewed: 0`, `prescan: null` | `steps/result-persister-step.ts:38-62` |
| Check Run | `neutral`, Titel „Nothing to review“ | `worker.ts:466-471` |

**Folge:** Ein PR nur mit Python, Go, Terraform, YAML, Dockerfile oder `package.json` wird gar nicht geprüft. Das grüne Häkchen im Kommentar liest sich trotzdem wie ein Urteil.

**Gemischter PR:** Die LLM-Lane sieht nur die JS/TS-Dateien. Der Pre-Scanner sieht alle. Keine Oberfläche sagt dem Nutzer, dass die übrigen Dateien kein Modell-Review hatten. `omittedFiles` enthält nur Opfer des Größen-Caps (`diff-utils.ts:62-63`), die Check-Summary nennt keine Dateien (`check-run.ts:155-194`).

### 2.3 CLI/MCP-Pfad

| Schritt | Verhalten | Beleg |
|---|---|---|
| Client | kein Endungsfilter vor dem Upload, nur Secret- und Größenprüfung | `packages/shared/src/node/git.ts:215-226`, `diff-upload-guard.ts:37-54` |
| CLI-Diff-Loader | derselbe Filter, Abbruchgrund „No reviewable code files in this diff.“ | `steps/cli-diff-loader-step.ts:38-50` |
| Pre-Scanner | läuft immer im Patch-only-Modus, weil kein GitHub-Token da ist. Nur Regex- und Registry-Regeln, keine AST- und Config-Regeln | `worker.ts:79-83`, `prescan/file-content-loader.ts:59` |
| Poll-Route | liefert `outcome: nothing_reviewed`, `filesReviewed: 0` | `api/cli/scan/[jobId]/route.ts:135-153` |
| CLI | gelbe Zeile „Nothing was reviewed — this is NOT a clean verdict.“, Exit-Code 0 | `packages/cli/src/format.ts:63-76`, `scan.ts:366-374` |
| Extension | Statusleiste „Nothing reviewed“ mit Warnfarbe | `packages/vscode-extension/src/stateMachine.ts:141-162` |
| MCP `unslop_get_result` | liefert `outcome: nothing_reviewed` | `packages/mcp/src/tools/get-result.ts:48-80` |
| MCP `unslop_scan` | **Lücke:** bei leeren Issues nur `phase: complete`, `findings: []`, „The review is complete“. Kein `outcome`, keine Summary | `packages/mcp/src/tools/scan.ts:125-153` |

Ein Agent, der `unslop_scan` auf einem reinen Python-Diff ruft, sieht also ein scheinbar sauberes, abgeschlossenes Review.

### 2.4 Was der Pre-Scanner je Dateityp kann

Sprache aus der Endung (`packages/prescan/src/language.ts:26-59`). Sieben Regeln laufen auf jeder Textdatei: SEC-005, SEC-017, SEC-024, SEC-050, MAINT-005, MAINT-006 (Regex) und SEC-036 (Registry).

| Dateityp | Regel-IDs mit vollem Inhalt | Anmerkung |
|---|---|---|
| JS/TS | 30 | einzige Sprache mit ESLint-Engine |
| Python | 22 | AST-Regeln, SEC-035 auf Importen und Manifesten |
| Kubernetes-YAML | 21 | INFRA-001 bis 011, CloudFormation |
| Java | 20 | kein Maven/Gradle-Check |
| JSON | 13 | CloudFormation, `.claude/settings`, `package.json` |
| C/C++ | 13 | |
| Go | 12 | keine Security-AST-Regeln, kein `go.mod`-Check |
| Terraform | 10 | SEC-032 bis 034 nur mit Lambda/Serverless-Bezug |
| PowerShell | 9 | |
| Dockerfile, Shell, SQL, Kotlin, C#, Ruby, PHP | 7 | nur die universellen Regeln |
| Markdown, Übersetzungskataloge | 2 | seit Stufe 0 nur SEC-005 in Provider-Format und SEC-036 (§4.4) |

Quelle: `packages/prescan/src/rules/registry.ts`, `engines/regex-engine.ts:97-138`, `engines/config/index.ts:39-63`, `engines/tree-sitter-engine.ts:24-34`. Im Patch-only-Modus bleiben 13 Regex-Regeln plus SEC-035/036 (`packages/prescan/src/index.ts:124-145`).

### 2.5 Der Law-Filter nach Ökosystem

- `fetchRenderedLawBlock` filtert die Golden Standards mit `repositories.detected_ecosystems` (`src/lib/law.ts:71-98, 120-133`). `null` oder `[]` heißt: kein Filter.
- Die Erkennung kennt genau sieben Schlüssel: `nextjs, react, typescript, nodejs, python, go, java-spring` (`src/lib/pipeline/ecosystem-detection.ts:27-35`).
- Live tragen 47 der 119 Regeln ein `applies_to`-Tag. **31 davon tragen nur Tags, die die Erkennung nie erzeugt:** `kubernetes` (12), `c,cpp` (10), `aws,terraform` (3), `powershell` (3), `c,cpp,rust` (1), `terraform` (1), `solidity` (1). Beleg: SQL `select applies_to, count(*) from golden_standards group by 1` vom 2026-09-30.
- Folge: Sobald ein Repo irgendein Ökosystem erkannt bekommt, sind diese 31 Regeln nie im Prompt. Beispiel: ein Python-Service mit Kubernetes-Manifesten hat `['python']`, alle INFRA-Regeln fehlen.
- Python, Go und Java funktionieren, wenn das Repo ein Manifest hat (`pyproject.toml`, `go.mod`, Spring in `pom.xml`). Java ohne Spring wird nicht erkannt.

### 2.6 Weitere JS/TS-Annahmen in der LLM-Lane

- Der feste Prompt-Kern nennt „high-scale React/Next.js environments“ (`src/lib/pipeline/prompt-builder.ts:229-231`).
- Die Conditions COND-006 bis 011 sind React/Next-spezifisch und stehen immer im gecachten Prefix. Der Scope-Filter verwirft ihre Findings erst nach der Antwort (`prompt-builder.ts:114-167`).
- Der Skeleton-Index (Evidence) nimmt nur `.ts .tsx .js .jsx .mjs` auf (`src/lib/skeleton.ts:323`). Für andere Sprachen gibt es keinen Repo-Kontext.
- Der Router zählt `reviewableFiles`. Mehr Sprachen heißt mehr Dateien, also öfter `pro-direct` über 15 Dateien oder 12k Tokens (`defaults.ts:50-65`, `complexity-router-step.ts:26-70`).

## 3. Optionen

### Option A: Pre-Scanner läuft auch ohne JS/TS

Der Diff-Loader setzt bei „keine reviewbare Datei, aber scanbare Dateien“ nicht mehr `shouldAbort`, sondern `llmSkipped`. Diesen Schalter gibt es schon für den Short-Circuit, alle LLM-Steps respektieren ihn (`draft-reviewer-step.ts:70`, `integrity-scorer-step.ts:56`).

### Option B: LLM-Filter auf eine Sprachliste erweitern

`REVIEWABLE_EXTENSIONS` wächst um begründete Endungen. Kandidaten nach Messlage: `.py`, `.go`, `.java`. Später `.c .h .cpp`, `.tf`, `.ps1`.

### Option C: Stufung

A zuerst, dann B sprachweise. Jede Sprache muss ein Gate bestehen (§6).

### Vergleich

| | A: Pre-Scan ohne JS/TS | B: LLM-Lane erweitern | C: gestuft |
|---|---|---|---|
| **Kosten pro Scan** | 0 Token | $0,022 bis $0,060 mit Findings, $0,003 bis $0,007 sauber (§4.2) | wie A, ab Stufe 2 wie B für Py/Go/Java |
| **Latenz** | Pre-Scan 83 ms bis 2,9 s je 25 Dateien (§4.4), dazu der Content-Fetch | Draft plus Verify im Mittel 38 bis 89 s, Maximum 170 s (Go) | wie A, ab Stufe 2 wie B |
| **Recall, Nicht-JS/TS (69 gepflanzt)** | 27/69 im Webhook-Pfad, 7/69 im CLI/MCP-Pfad | 69/69 im Benchmark-Pfad. Mit Law-Filter im polyglotten Repo 1/26 auf C, K8s, TF, PS | Stufe 1: 27/69. Stufe 2 rechnerisch 55/69 (§4.1) |
| **FP-Risiko** | hoch ohne Fixes: 50 von 50 SEC-035-CRITICALs auf Flask sind Fehlalarme (§4.4) | 0 Findings auf 3 sauberen Kontrollen in 4 Läufen. Auf echtem Code ungemessen | Stufe 1 erst nach den Fixes, Stufe 2 erst nach Schattenlauf |
| **Check-Summary** | braucht den Zustand „nur deterministisch geprüft“ und den Fix von Befund (b) | keine neue Form, aber Hinweis auf nicht gelesene Dateitypen | beides |
| **CLI, Extension** | `nothing_reviewed` entfällt für diese Diffs. Neues Outcome nötig | unverändert | wie A |
| **MCP** | `unslop_scan` muss Outcome und Summary liefern | unverändert | wie A |
| **Landing-FAQ** | Satz „only reviewed if it contains at least one TypeScript or JavaScript file“ wird falsch | Satz „The model review reads TypeScript and JavaScript files“ wird falsch | beide Sätze, je Stufe |
| **Eskalationsbudget** | kein Verbrauch | mehr Dateien, öfter `pro-direct` | ab Stufe 2 |

## 4. Messungen

### 4.1 Benchmark-Pfad gegen Produktionspfad

Der Runner setzt `reviewableFiles: fixtureFiles` (`scripts/lib/rule-recall-benchmark.ts:233`). Der Filter greift also nie.

Von den 126 gepflanzten Verstößen des Universums r01 bis r21 liegen **69 in Nicht-JS/TS-Dateien**. 59 davon in Fixtures ganz ohne JS/TS (r01 bis r04, r09 bis r13), 10 in gemischten (r06, r16, r20).

| Pfad | Treffer | Herleitung |
|---|---|---|
| Benchmark, wie berichtet | 125/126 | Lauf 2026-09-16, `results/2026-09-16-flash38-full-run2.json` |
| Produktion heute | **59/126** | gerechnet: Fixtures ohne JS/TS zählen 0, in gemischten zählt der Draft nur auf JS/TS-Dateien, der Pre-Scan überall |
| mit Option A | 84/126 | gerechnet: zusätzlich Pre-Scan auf Fixtures ohne JS/TS |
| mit Option C Stufe 2 | 112/126 | gerechnet: zusätzlich Draft auf `.py`, `.go`, `.java` |

Die drei unteren Zeilen sind **gerechnet, nicht gefahren**. Eingang: Draft-Treffer je Datei aus dem Lauf vom 2026-09-16, Pre-Scan-Treffer aus `results/2026-09-30-langcov-prescan-only.json`. Ein echter Lauf auf dem Produktionspfad braucht den Runner-Umbau aus §7. Offene Messung.

### 4.2 LLM-Lane auf den Nicht-JS/TS-Fixtures

Volle Kaskade über `npm run benchmark:rules -- --only r01,r02,r03,r04,r09,r10,r11,r12,r13,r14,r15,r16,r21 --runs 2 --keep`, zweimal gefahren. Also vier Läufe je Fixture, r10 drei (ein Lauf starb an einem Vertex-500).

| Messung | Wert | Beleg |
|---|---|---|
| Draft-Recall | 255/258 | `results/2026-09-30-langcov-nonjsts-g1..g4.json`, `-runs2.json` |
| Combined (Draft oder Pre-Scan), nach Verifier | **258/258** | dieselben Reports |
| Einziger Draft-Miss | ARCH-005 in `usage_ledger.go` (r10), in allen drei Läufen, vom Pre-Scan gedeckt | dieselben Reports |
| Negativ-Kontrollen r14 (Python), r15 (C), r21 (Go) | 0 CRITICAL, 0 WARNING, je 4 Läufe | dieselben Reports |
| Eskalationen | **0 Calls**, Kontingent 36/50 vorher (08:58 UTC) und nachher (09:20 UTC) | `billing_accounts.escalation_month_count` |
| Kosten | **$1,53** für 51 Jobs, im Mittel $0,030 je Scan | `scripts/benchmark-cost.ts` |

Je Fixture, Mittel über die Läufe (`review_job_llm_calls`, `scripts/benchmark-cost.ts`):

| Fixture | Sprache | Draft-Prompt (davon cached) | Draft-Output | Draft + Verify Mittel / Max | Kosten je Scan |
|---|---|---|---|---|---|
| r01 | C | 8.719 (6.946) | 6.745 | 63,6 s / 87,5 s | $0,045 |
| r02 | C | 8.107 (6.946) | 4.287 | 43,3 s / 58,9 s | $0,029 |
| r03 | Python | 6.920 (4.810) | 5.240 | 44,0 s / 49,2 s | $0,042 |
| r04 | Python | 6.619 (4.810) | 5.402 | 46,8 s / 65,5 s | $0,037 |
| r09 | Java | 6.898 (4.774) | 3.788 | 58,1 s / 79,7 s | $0,032 |
| r10 | Go | 6.170 (4.415) | 11.257 | 89,2 s / 170,0 s | $0,060 |
| r11 | Kubernetes | 10.549 (6.946) | 5.405 | 44,2 s / 53,5 s | $0,044 |
| r12 | Terraform | 8.533 (6.946) | 4.597 | 53,9 s / 66,8 s | $0,034 |
| r13 | PowerShell | 7.957 (6.946) | 3.223 | 37,7 s / 47,6 s | $0,022 |
| r16 | Python + TS | 8.493 (6.946) | 4.624 | 47,9 s / 71,4 s | $0,035 |
| r14 | Python, sauber | 6.010 (4.810) | 1.347 | 13,0 s / 16,6 s | $0,007 |
| r15 | C, sauber | 8.253 (6.946) | 1.402 | 13,2 s / 16,3 s | $0,007 |
| r21 | Go, sauber | 5.473 (4.415) | 496 | 8,6 s / 19,0 s | $0,003 |

**Lesart und Grenzen:**

- Die Fixtures sind klein (1 bis 7 KB). Kosten und Latenz skalieren mit der Diff-Größe wie bei JS/TS. Ein Sprachaufschlag ist nicht zu sehen: der Volllauf über alle 21 Fixtures kostete im August $0,46, also $0,022 je Scan.
- Die Latenzen entstanden unter Last: bis zu fünf Benchmark-Prozesse liefen parallel. Sie sind eine Obergrenze, kein Normalwert.
- **Go fällt auf:** Der Draft brauchte 83, 85 und 161 s für einen 3,3-KB-Diff, bei 8 bis 14k Output-Tokens (Jobs `2de60b44`, `9bdc06e5`, `8054133a`). Ein Draft-Call hat keine eigene Deadline, nur das Job-Budget von 300 s. N=3, Ursache nicht untersucht.
- Ein Draft-Call auf r10 endete nach 67 s mit Vertex-500 (Job `112eeb84`). Der Runner meldete „nach 1 Versuchen nicht verfügbar“. Das bekannte To-Do „Vertex-500-Retry“ gilt also auch hier.
- Temperatur 0: vier Läufe sind ein Stabilitätscheck, keine Statistik.
- Der Runner fährt ohne RAG, ohne Reference Practices, ohne Job-Budget und mit `prescanIssues: []`.

**Pre-Scan allein** (`--prescan-only`, 0 Token, `results/2026-09-30-langcov-prescan-only.json`): 68/177 gesamt, 0 Fehlalarme auf 6 Kontrollen. Auf den 69 Nicht-JS/TS-Verstößen:

| Modus | Treffer | Verteilung |
|---|---|---|
| voller Dateiinhalt (Webhook) | **27/69** | r11 11/11, r01 2/8, r03 2/10, r09 2/7, r10 2/6, r12 2/4, r13 2/3, r02 1/4, r04 1/6, r20 2/4, r16 0/5, r06 0/1 |
| Patch-only (CLI/MCP) | **7/69** | r01 2, r13 2, r09 1, r10 1, r20 1; Kubernetes 0/11, Terraform 0/4, Python 0/21 |

Beleg Patch-only: Scratch-Lauf `runPrescan` mit `content: null` über dieselben Fixtures, 2026-09-30. Skript nicht eingecheckt.

### 4.3 Der Law-Filter im polyglotten Repo

Frage: Liefert der Filter für Python, Go und Terraform die richtigen Regeln?

**Rechnung ohne Token.** Für jede Fixture die gepflanzten Regel-IDs gegen den gefilterten Law-Block eines TypeScript-Repos geprüft, das die Fremdsprache zusätzlich enthält:

| Fixture | angenommene `detected_ecosystems` | gepflanzt | Regel fehlt im Prompt |
|---|---|---|---|
| r03, r04, r16 (Python) | `typescript, nodejs, python` | 23 | 0 |
| r09 (Java/Spring) | `typescript, nodejs, java-spring` | 7 | 0 |
| r10 (Go) | `typescript, nodejs, go` | 6 | 0 |
| r01 (C) | `typescript, nodejs` | 8 | 7 |
| r02 (C) | `typescript, nodejs` | 4 | 1 |
| r11 (Kubernetes) | `typescript, nodejs` | 11 | 11 |
| r12 (Terraform) | `typescript, nodejs` | 4 | 4 |
| r13 (PowerShell) | `typescript, nodejs` | 3 | 3 |

**Gegenprobe mit dem Modell.** Draft-only, r01, r11, r12, r13 mit `detectedEcosystems: ['typescript','nodejs']` statt `null`:

| Fixture | Benchmark (`null`) | TS-Host-Repo | Job |
|---|---|---|---|
| r01 C | 8/8 | 1/8 | `b0544a04` |
| r11 Kubernetes | 11/11 | 0/11 | `dc412636` |
| r12 Terraform | 4/4 | 0/4 | `d7fd7116` |
| r13 PowerShell | 3/3 | 0/3 | `33ac3f28` |
| **Summe** | **26/26** | **1/26** | `results/2026-09-30-langcov-lawfilter-ts-host.json` |

Der Law-Prefix schrumpft dabei von 6.946 auf 4.613 gecachte Tokens. Das Modell meldet ohne die Regel fast nichts: nur in einer der 26 Dateien überhaupt ein Finding. Kosten $0,07, ein Lauf.

**Antwort:** Für Python, Go und Java/Spring ja. Für C/C++, Kubernetes, Terraform und PowerShell nein, sobald das Repo irgendein erkanntes Ökosystem hat. Der Benchmark misst diese vier mit `detectedEcosystems: null` (Manifest r01, r02, r11, r12, r13), also den Fall „Repo ohne jedes erkannte Ökosystem“.

### 4.4 Fehlalarme des Pre-Scanners auf echtem Nicht-JS/TS-Code

Die Negativ-Kontrollen decken nur 8 synthetische Dateien (Python, C, Go) und keine Config. Deshalb ein Lauf über echte Repos, 0 Token. Jede Datei als neu hinzugefügt, Standard-Config, Registry-Lookups live. Das entspricht einem PR, der diese Dateien neu anlegt.

| Korpus (Commit) | Dateien | Findings | CRITICAL | Befund |
|---|---|---|---|---|
| `pallets/flask` (`d73fa1c`) | 130, davon 83 `.py` | 335 | 72 | SEC-035: **50 von 50 Fehlalarme** (s. u.). TEST-002 WARNING 227 in 25 Testdateien |
| `spf13/cobra` (`adbc881`) | 59, davon 36 `.go` | 21 | 0 | nur ARCH-001/002 WARNING |
| `kubernetes/examples` (`d6b8cd2`) | 400, davon 242 `.yaml` | 688 | 47 in 17 Dateien | 641 WARNINGs. INFRA-002, -007, -010 je 127-mal |
| `terraform-aws-modules/terraform-aws-vpc` (`b3abd6d`) | 108, davon 77 `.tf` | 3 | 0 | kein Finding auf `.tf` |
| dieses Repo, ohne JS/TS (`17ee7ec`) | 310 | 27 | 23 | **alle 23 Fehlalarme** nach Durchsicht (s. u.) |

Rohdaten: `results/2026-09-30-langcov-corpus-*.json`. Latenz: 83 ms bis 2,9 s je 25 Dateien, Flask gesamt 3,7 s.

**Drei gemessene Fehlalarm-Quellen, alle CRITICAL:**

1. **SEC-035 auf Python-Importen.** Die Stdlib-Liste hat rund 85 Einträge (`packages/prescan/src/engines/registry-engine.ts:41-52`). Es fehlen unter anderem `__future__` (27 Treffer in Flask), `socketserver` (6 Treffer in diesem Repo), `codecs`, `code`, `rlcompleter`, `_typeshed`. Dazu lokale Module (`from blueprintapp import app`, 9 Treffer) und Fließtext in Docstrings, der mit „import“ beginnt (3 Treffer).
2. **SEC-035 auf `package.json`.** Jede Zeile der Form `"schlüssel": "text"` gilt als Dependency (`registry-engine.ts:213-218`). Getroffen: `"displayName"`, `"markdownDescription"`, ein `bin`-Eintrag, drei `exports`-Pfade, fünfmal das private Workspace-Paket `@unslop/*`.
3. **Universelle Regex-Regeln auf Prosa.** SEC-017, SEC-024 und SEC-050 feuern auf `docs/specs/pre_scanner_design.md`, weil das Dokument die Muster zitiert. SEC-005 feuert auf einen UI-Text in `messages/en.json:294`.

**Einordnung:**

- Quelle 1 bis 3 treffen heute schon jeden gemischten PR, der solche Zeilen hinzufügt. Option A macht sie zum Normalfall: ein Docs-only-PR oder ein Dependabot-PR bekäme einen Check `failure`.
- In den Live-Daten ist das noch nicht aufgefallen: 0 von 25 Webhook-Jobs mit Pre-Scan-Finding hatten eines auf einer Nicht-JS/TS-Datei (§4.5). Die Dogfooding-PRs fügten solche Zeilen nicht hinzu.
- Die Kubernetes-Findings sind nach Regeltext korrekt. Die Menge ist das Problem: 128 von 242 Manifesten mit Finding, im Mittel fünf je betroffener Datei.
- Go und Terraform sind deterministisch ruhig, finden aber auch wenig (12 und 10 Regel-IDs).

**Stand nach Stufe 0 (2026-09-30).** Derselbe Lauf mit `scripts/prescan-corpus.ts`, Rohdaten `results/2026-09-30-langcov-stufe0-corpus-*.json`:

| Korpus | Findings vorher → nachher | CRITICAL vorher → nachher | SEC-035 CRITICAL | CRITICAL auf `.md` |
|---|---|---|---|---|
| `pallets/flask` | 335 → 293 | 72 → 22 | 50 → 0 | 0 |
| `spf13/cobra` | 21 → 21 | 0 → 0 | 0 | 0 |
| `kubernetes/examples` | 688 → 683 | 47 → 46 | 1 → 0 | 0 |
| `terraform-aws-modules/terraform-aws-vpc` | 3 → 0 | 0 → 0 | 0 | 0 |
| dieses Repo, ohne JS/TS | 27 → 3 | 23 → 1 | 17 → 0 | 3 → 0 |

Die Entscheidungen dahinter:

- **Python-Importe.** Standardbibliothek (CPython 3.13, dazu entfernte Module und Python-2-Namen), Namen mit führendem Unterstrich, Fließtext und Zeilen in dreifach gequoteten Strings sind keine Kandidaten. Ein 404 auf einen verbleibenden Import-Namen ist **WARNING**, nicht CRITICAL. Grund: Ein Import-Name ist kein Distributionsname (`import yaml` kommt aus `PyYAML`), und ein lokales Modul außerhalb des Diffs ist für den Pre-Scanner unsichtbar. Das Urteil „existiert nicht“ ist für Importe deshalb kein Fakt. Deklarationen in `requirements.txt` und `pyproject.toml` bleiben CRITICAL. Auf Flask bleiben 8 WARNINGs, alle auf lokalen Test-Modulen.
- **`package.json`.** Eine Zeile ist nur in `dependencies`, `devDependencies`, `peerDependencies` oder `optionalDependencies` ein Kandidat. Zeigt ein Patch den Abschnittskopf nicht (CLI/MCP), entscheidet die Form des Werts: nur eine Versionsangabe macht die Zeile zum Kandidaten. Specs mit `workspace:`, `file:`, `link:`, `npm:` oder Git-Quelle werden nicht über den Namen aufgelöst und sind keine Kandidaten.
- **Workspace-Pakete.** Der Webhook-Pfad lädt die Manifeste der npm-Workspaces als Begleitdateien, sobald der Diff eine `package.json` ändert (`src/lib/prescan/companion-loader.ts`). Deren `name` ist kein Registry-Kandidat. Im CLI/MCP-Pfad gibt es diese Manifeste nicht (ROADMAP To-Do).
- **Prosa-Dateien.** Auf Markdown (`.md .mdx .markdown .rst .adoc`) und Übersetzungskatalogen (`messages/`, `locales/`, `i18n/`, `l10n/`, `lang/`, `translations/`, `_locales/` mit `.json .yaml .yml .properties`, dazu `.po .pot .arb .xlf`) läuft von den Regex-Regeln nur SEC-005 in Provider-Format. Gewählt wurde „nicht prüfen“ statt „nur WARNING“: SEC-017, SEC-024, SEC-050 und MAINT-006 beschreiben Code-Verhalten, in Prosa treffen sie Zitate und UI-Sätze, und eine WARNING je zitiertem Muster wäre auf jeder Sicherheits-Doku Rauschen. Ein Schlüssel in Provider-Format (`AKIA…`, `ghp_…`, PEM) ist dagegen auch in einer README ein Leck und bleibt CRITICAL. Die Entropie-Heuristik entfällt dort, sie traf den UI-Satz in `messages/en.json:294`.
- **Rest.** Ein CRITICAL bleibt im eigenen Repo: SEC-017 auf `docs/research/asta_queries.json:97`, ein Suchbegriff in einer JSON-Datendatei. Die 22 CRITICALs auf Flask stammen aus MAINT-001, SEC-014 und TEST-001 und sind nicht gesichtet.

### 4.5 Live-Daten aus `review_jobs`

Stand 2026-09-30, 09:00 UTC, 179 Jobs mit `status = done`.

| Frage | Wert | Beleg |
|---|---|---|
| Abbrüche „No reviewable code files“ | **0** in allen Quellen | SQL auf `result->'review'->>'summary'` und `result::text ilike '%No reviewable%'` |
| Abbrüche überhaupt | 7, alle CLI, alle „exceed the review size cap“ | `files_reviewed = 0` |
| Jobs, in denen der Pre-Scan mehr Dateien sah als die LLM-Lane | Webhook 25 von 30, CLI 17 von 35, MCP 1 von 15 | `prescan.filesScanned > files_reviewed` |
| Dateitypen in hochgeladenen CLI/MCP-Diffs | `.ts` 92, `.svg` 88, `.json` 69, `.tsx` 57, `.css` 26, `.html` 26, `.png` 22, `.js` 4, `.py` 2, `.c` 2 | Regex über `payload->>'diff'`, 69 Jobs |
| Pre-Scan-Finding auf Nicht-JS/TS-Datei | 1 Job (CLI, SEC-029 in `path_join.c`) | `issues[].source = 'pre-scanner'` |

**Grenze dieser Daten:** Alle Webhook-Jobs stammen aus zwei eigenen Repos (`unslopai/test`, `unslopai/unslop`), beide TypeScript. Es gibt keine Kundendaten. Wie oft Kunden-PRs ohne JS/TS vorkommen, ist **eine offene Messung**. Grund: Das Produkt hat vor dem Launch keine externen Nutzer. Für Webhook-Jobs speichert `review_jobs` zudem keine Dateiliste. Eine Auswertung nach Launch braucht ein Feld mit den Endungen der PR-Dateien (To-Do).

### 4.6 Vertex-Verbrauch dieser Session

| Lauf | Kosten | Beleg |
|---|---|---|
| Nicht-JS/TS-Fixtures, 4 Gruppen × 2 Läufe | $0,84 | `benchmark-cost.ts` auf `-g1..g4.json` |
| dieselben Fixtures, durchgehender Lauf × 2 | $0,69 | `benchmark-cost.ts` auf `-runs2.json` |
| Law-Filter-Gegenprobe, 4 Draft-Calls | $0,07 | `benchmark-cost.ts` auf `-lawfilter-ts-host.json` |
| **Summe** | **$1,61 von $3,00** | |

Schätzung vorher: rund $0,20 für 13 Fixtures × 2, abgeleitet aus $0,46 für den 21-Fixture-Volllauf. Tatsächlich das Vierfache je Lauf, weil der Draft auf den gepflanzten Fixtures 3 bis 14k Output-Tokens schreibt. Der zweite durchgehende Lauf war nicht geplant: ein gestoppter Hintergrundprozess lief unter Windows weiter. Seine Ergebnisse sind als Läufe 3 und 4 verwertet. Ein Draft-Call mit Vertex-500 (Job `112eeb84`) hat keine Token-Telemetrie und fehlt in der Summe. Eskalationskontingent unverändert 36/50.

## 5. Befund (b) und Option A

Befund (b) aus dem Landing-Faktencheck: Job `3f26b2da` speichert `summary: "No AI slop found."` neben einem CRITICAL aus dem Pre-Scanner.

- **Ursache:** `result-persister-step.ts:47` schreibt `context.reviewSummary || 'No AI slop found.'`. Die Summary kommt vom Draft, der die Pre-Scan-Findings nicht kennt. Meldet der Draft nichts, bleibt sie leer.
- **Verbreitung live:** 30 Jobs tragen diese Summary bei mindestens einem Finding (Webhook 20, MCP 10). 11 davon mit CRITICAL (Webhook 1, MCP 10). Beleg: SQL vom 2026-09-30.
- **Zusammenhang mit A:** Unter Option A gibt es bei Nicht-JS/TS-PRs nie einen Draft. Jeder Pre-Scan-only-Job mit Findings trüge den Widerspruch. Ohne Findings käme der Kommentar „No AI slop found. This code meets the quality standards.“ (`github-reporter-step.ts:252-264`) und ein Check `success` mit „No AI slop found“ (`check-run.ts:190-194`), obwohl kein Modell die Dateien gelesen hat.
- **Folge für die Spec:** Der Fix von (b) ist Voraussetzung für Stufe 1, nicht Beifang.
- **Gebaut in Stufe 0:** `resolvePublishedSummary` (`src/lib/pipeline/final-summary.ts`) ist die einzige Quelle der Summary für Persister und Reporter. Ohne Findings bleibt der Modell-Text. Mit deterministischen Findings kommt ein eigener Satz dazu („The deterministic pre-scanner found 1 critical and 0 warning findings.“); hat das Modell nichts gemeldet, ersetzt er den Clean-Text. Die Short-Circuit-Summary und die Template-Summary aus A12a zählen beide Lanes schon und bleiben unverändert. Beleg: `result-persister-step.test.ts` „Replay Job 3f26b2da“. Gespeicherte Alt-Jobs werden nicht umgeschrieben.

## 6. Empfehlung

### 6.1 Entscheidungsregel

Eine Sprache oder ein Dateityp kommt in eine Lane, wenn alle Punkte der Lane erfüllt sind.

**Deterministische Lane (Pre-Scan-only-Review):**

1. Der Dateityp hat mindestens eine sprachspezifische Regel (§2.4). Dateien mit nur den sieben universellen Regeln lösen keinen Pre-Scan-only-Review aus.
2. 0 CRITICAL-Fehlalarme auf dem Korpus aus §4.4 für diesen Dateityp.

**LLM-Lane:**

1. Der Law-Filter liefert im polyglotten Repo alle getaggten Regeln der Sprache (Test wie §4.3, ohne Token).
2. Benchmark auf dem Produktionspfad: Combined-Recall der Sprach-Fixtures mindestens so hoch wie im Referenzlauf, über 3 Läufe.
3. 0 CRITICAL auf den Negativ-Kontrollen der Sprache, über 3 Läufe.
4. Schattenlauf auf echtem Code der Sprache mit gesichteten Findings (offene Messung, §9).
5. Draft plus Verify im Maximum unter 210 s. Das sind 300 s Job-Budget minus 30 s Reserve minus 60 s Mindestzeit für eine gezielte Eskalation (`src/lib/pipeline/deadline.ts:22, 31, 41`).

Stand nach den Messungen dieser Session, alle auf dem Benchmark-Pfad: Python und Java erfüllen 1 und 3, Punkt 2 mit der Einschränkung, dass der Produktionspfad-Lauf noch fehlt. Go ebenso, bei Punkt 5 mit 170 s auffällig. Punkt 4 ist für keine Sprache gemessen. C/C++, Terraform, PowerShell scheitern an 1. Kubernetes braucht die LLM-Lane nicht.

### 6.2 Rollout

**Stufe 0, Voraussetzungen (kein Verhalten für Nutzer ändert sich):**

- SEC-035-Fixes: vollständige Python-Stdlib-Liste, `package.json` nur in Dependency-Abschnitten, Workspace-Pakete.
- Universelle Regex-Regeln nicht auf Markdown und nicht auf Übersetzungsdateien, oder dort nur WARNING.
- Befund (b): Summary aus den tatsächlichen Findings bilden.
- Benchmark-Runner auf den Produktionsfilter (§7).

**Stufe 1, Pre-Scan ohne JS/TS:**

- Diff-Loader: keine reviewbare Datei, aber mindestens eine Datei nach Regel „deterministische Lane“ ⇒ `llmSkipped` statt `shouldAbort`. Sonst wie heute „Nothing to review“.
- Neues Outcome `deterministic_only` in `ScanOutcome` (`packages/shared/src/index.ts`), in Persister, Poll-Route, CLI, Extension, MCP.
- Check Run: `failure` bei CRITICAL wie heute. Ohne Findings `neutral` mit Titel „Deterministic checks only“, nicht `success`.
- PR-Kommentar nennt, dass kein Modell-Review lief und warum.
- CLI/MCP: gleicher Zustand, mit dem Hinweis, dass lokal nur Regex- und Registry-Regeln laufen (7/69).

**Stand nach Stufe 1 (2026-09-30), mit den Entscheidungen beim Bau:**

- **Wer entscheidet.** `planUnreviewableDiff` (`src/lib/pipeline/review-scope.ts`) für beide Diff-Loader. `resolveReviewOutcome` liefert das Urteil für Persister, Reporter, Check Run und Summary.
- **Deterministische Lane.** `isDeterministicLaneFile` (`packages/prescan/src/language.ts`): Python, Java, Go, C/C++, PowerShell, Terraform, YAML, JSON, dazu `requirements.txt` und `pyproject.toml`. Nicht dabei: Prosa-Dateien (§4.4), generierte Pfade und Lockfiles (die zwölf gängigen Namen von `package-lock.json` bis `Gemfile.lock`, `review-scope.ts: LOCKFILE_NAMES`; sie fallen auch aus dem Pre-Scan-Pfadfilter), entfernte Dateien, Dateien mit nur den universellen Regeln. **Abweichung von §6.1:** Rust hat Regeln, ist aber nicht in der Lane, weil es keinen Korpus gibt (Kriterium 2 ungemessen). JSON ist in der Lane trotz eines bekannten CRITICAL-Fehlalarms auf einer Datendatei (§4.4 „Rest“), weil `package.json`, CloudFormation und Agent-Settings der Zweck der Lane sind.
- **Pre-Scanner läuft nicht oder scheitert.** Ist der Step für das Repo abgeschaltet, endet er degradiert oder prüft er keine Datei (`filesScanned` 0, z. B. einzige Lane-Datei über `maxFileBytes`), heißt das Ergebnis `nothing_reviewed`. `deterministic_only` gibt es nur nach einem tatsächlich gelaufenen Pre-Scan mit mindestens einer geprüften Datei. Den Grund liefert `describeNothingReviewed` für Kommentar, Check und Summary: abgeschaltet ⇒ „No reviewable code files …“ wie vor Stufe 1; degradiert ⇒ ⚠️ „Not reviewed: the deterministic pre-scanner failed …“ (`formatPrescanFailedNotice`), Check-Titel „Not reviewed“; keine Datei geprüft ⇒ „Nothing to review“ mit den übersprungenen Dateien und ihrem Grund (Nachtrag 2026-09-30, Review-Befunde (e)/(f)).
- **Persistenz.** `result.deterministic_only: true`, `nothing_reviewed: false`, `files_reviewed: 0`. Kein Schema-Wechsel. Die Poll-Route liefert `outcome: deterministic_only` und `filesScanned`.
- **Check Run (E2).** CRITICAL ⇒ `failure` mit dem üblichen Titel. Nur WARNINGs ⇒ `neutral`. Keine Findings ⇒ `neutral`, Titel „Deterministic checks only“. Die Summary nennt in allen drei Fällen, dass kein Modell gelesen hat. Das Score-Gate greift nicht, es gibt keinen Score.
- **PR-Kommentar.** Ohne Findings: „ℹ️ Anti-Slop Gatekeeper: Deterministic checks only: this pull request changes no TypeScript or JavaScript file, so no model reviewed it. The pre-scanner checked N files and found nothing.“ Mit Findings steht derselbe Satz in der Summary des Reviews. Der Integrity-Score-Block entfällt.
- **CLI, Extension, MCP.** CLI: gelbe Zeile „Deterministic checks only — no model reviewed this diff.“, Findings wie sonst, nie der grüne Haken. Extension: Statusleiste „Deterministic only“ mit Warnfarbe. MCP: `unslop_scan` liefert bei einem fertigen Scan `outcome`, `filesReviewed` und einen `nextStep`, der „NOT a clean verdict“ sagt. Das war nötig, weil ein solcher Scan in unter 10 s fertig ist und sonst wie ein sauberes Review aussähe; es schließt auch den größten Teil der Lücke aus §2.3. Der Text für lokale Diffs nennt, dass ohne Dateiinhalt nur Regex- und Registry-Regeln laufen.
- **Dashboard.** Ein Lauf ohne Modell-Review ohne Findings ist „neutral“, nicht „clean“.
- **Deckel E4.** `capRepeatedRuleHits` (`src/lib/pipeline/prescan-hit-cap.ts`): je Regel und Severity bleiben die ersten drei Treffer einzelne Findings, ab dem vierten steht ein Sammelfinding am vierten Treffer und nennt jede weitere Fundstelle. Das gilt für jeden Review, auch den gemischten PR. `prescan.findingsCount` und `criticalCount` zählen weiter jeden Treffer. Das Sammelfinding trägt seine Fundstellen als `cappedHits`: die Dedupe gegen die LLM-Lane vergleicht mit jeder Fundstelle, Summary, Check-Run-Titel und Review-Body zählen Treffer statt Einträge (Nachtrag 2026-09-30, Review-Befunde (a)/(b)).
- **Belege.** G3: `--prescan-only` 68/177 auf beiden Pfaden, 0 Fehlalarme auf 7 Kontrollen, neu `r26-clean-config.diff` (Kubernetes, Terraform, `package.json`, Markdown). G4: `review-scope.test.ts`. G5: Tests je Oberfläche; die Sicht-Belege an einem echten PR und G10 stehen aus (ROADMAP).

**Stufe 2, Python, Go, Java in der LLM-Lane:**

- `REVIEWABLE_EXTENSIONS` um `.py`, `.go`, `.java`. Zuerst nur für `unslopai/test` per Repo-Config, dann als Default.
- Prompt-Kern sprachneutral formulieren. Das rotiert den Cache einmal.
- Gemischte PRs: Summary nennt Dateitypen, die kein Modell gelesen hat.

**Stand nach Stufe 2 (2026-09-30), mit den Entscheidungen beim Bau:**

- **Umfang.** Python (`.py`) und Java (`.java`). Go fehlt (E7). `GATED_LLM_EXTENSIONS` in `src/lib/pipeline/defaults.ts` nennt die Endungen, die überhaupt in die Modell-Review dürfen; jede andere Endung fällt aus einer Repo-Config heraus.
- **Config.** `pipeline_config.reviewScope.llmExtensions` nennt, was die Modell-Review **zusätzlich** zu JS/TS liest. Der Wert wird wie `prescan` strukturell durchgereicht, `resolveReviewScopeConfig` löst ihn beim Job-Start auf: Block fehlt oder ist kaputt ⇒ Default; gültige Liste ⇒ ersetzt den Default, die leere Liste heißt „nur JS/TS“. `isReviewableFile(filename, llmExtensions)` hat bewusst keinen Default-Parameter, damit kein Aufrufer still auf JS/TS zurückfällt. Beide Diff-Loader und der Benchmark-Runner lesen den aufgelösten Wert.
- **Default.** `DEFAULT_REVIEW_SCOPE_CONFIG.llmExtensions = ['.py']`. Begründung in §6.5: Python besteht G6 bis G9, Java reißt G8.
- **Operator-Allowlist.** Der Settings-PUT (`/api/repos/[id]/settings`, operator-only) übernimmt `reviewScope` und speichert nur Endungen aus `GATED_LLM_EXTENSIONS`. Die Operator-Seite rendert kein Feld dafür; sie reicht den Block bei Save und Reset unverändert durch. Gesetzt wird er per PUT oder per SQL.
- **Rollback.** `UNSLOP_LLM_LANE_JSTS_ONLY=1` übersteuert Default und jede Repo-Config, zur Laufzeit gelesen (`isLlmLaneRestrictedToJsTs`). Solange der Schalter gesetzt ist, sind die Texte aus §7.2 falsch: er ist ein Notfall-Schalter, kein Dauerzustand.
- **Prompt.** Der Kern sagt „production codebases in any programming language“ statt „high-scale React/Next.js environments“, die Überschrift der React-Conditions trägt den Zusatz „apply ONLY to React and Next.js files“. `PROMPT_CACHE_SCHEMA_VERSION` steigt von 2 auf 3. Das rotiert jeden expliziten Cache einmal: der erste Job je Cache-Key nach dem Deploy meldet `explicit_created` statt `explicit_hit` und zahlt den Prefix einmal zum vollen Input-Preis (rund 4.800 bis 7.000 Tokens, unter einem Cent je Key); die alten Caches laufen nach höchstens einer Stunde TTL aus.
- **Gemischter PR.** `describeFilesWithoutModelReview` (`review-scope.ts`) liefert den Satz „No model read N changed files of these types: .go, .rs.“ Er steht in der gespeicherten Summary (`resolvePublishedSummary`, also auch in CLI, Extension und MCP), im Review-Body, im Kommentar ohne Findings und in der Check-Summary. Hat kein Modell gelesen, entfällt der Satz, weil die Summary das dann schon sagt.
- **Nur Quellcode-Dateien im Hinweis** (Nachtrag 2026-09-30, Review-Befunde an PR #40). Der Satz nennt nur Dateien, die ein Leser von einer Code-Review erwartet: `isSourceCodeFile` mit der Liste `SOURCE_CODE_LANGUAGES` neben der Lane-Definition in `packages/prescan/src/language.ts` (TypeScript, JavaScript, Python, Java, Go, Rust, C/C++, PowerShell, Terraform `.tf`), sofern nicht im aktiven Review-Umfang. Config, Daten, Styles, Markup, YAML, JSON, TOML, Terraform-Variablen, Workflows, Dockerfiles und Binärdateien lösen ihn nicht aus; sonst trüge fast jeder JS/TS-PR mit `package.json` oder `.css` den Satz. Gezählt werden nur Dateien mit Hunk: ohne Hunk (Binärdatei, reine Modus-Änderung) hat eine Datei auch im CLI/MCP-Pfad keinen Patch (`parseUnifiedDiff`) und zählt weder für den Pre-Scan noch für den Hinweis. Prosa, Lockfiles, generierte Pfade, entfernte Dateien und Opfer des Größen-Caps zählen weiter nicht.
- **Eine Liste generierter Pfade.** `isGeneratedPath` (`src/lib/pipeline/helpers.ts`) gilt für Modell-Review und Pre-Scanner und vergleicht per Pfadsegment (`node_modules/`, `dist/`, `build/`, `.next/`, `.git/`, dazu `*.min.js`/`*.min.css`): `src/rebuild/x.ts` wird reviewt. `.env`-Dateien (`.env`, `.env.local` …) erreichen nie ein Modell, verglichen am Dateinamen, sodass `app.env.ts` Code bleibt; der Pre-Scanner liest sie weiter, damit seine Secret-Regeln einen eingecheckten Schlüssel finden. Endungen vergleicht `isReviewableFile` ohne Groß-/Kleinschreibung (`Foo.PY` ist Python).
- **Hinweistexte.** Die Sätze zu „nur deterministisch geprüft“ (`degradation-notice.ts`, MCP `unslop_scan`, `describeNothingReviewed`) sagen „no file of a type the model review reads“ statt „no TypeScript or JavaScript file“. So stimmen sie für jeden Review-Umfang.
- **Runner.** `--llm-extensions .py,.java` setzt den Review-Umfang des Produktionspfads wie eine Repo-Config (Default: der Code-Default). `--no-escalation` verbraucht kein Eskalations-Kontingent: der Router bleibt auf `flash-cascade`, Eskalation und Zweitmeinung laufen nicht, und der Report nennt je Fixture in `suppressedEscalations`, was sonst gelaufen wäre. Neue Negativ-Kontrolle `r27-clean-java.diff` (drei saubere Spring-Dateien), weil es für Java keine gab.
- **Nicht gebaut.** Die Distribution-Entwürfe unter `distribution/channels/` sagen weiter „JS/TS only“ (ROADMAP To-Do). Die Skeleton-Evidence bleibt JS/TS (§2.6).

**Stufe 3, C/C++, Terraform, PowerShell:**

- Erst die Repo-Erkennung um Pfadsignale erweitern (`.tf`, `.c/.h/.cpp`, `.ps1`, Kubernetes-Manifeste). Der Cache-Contract bleibt, weil der Filter weiter nur vom Repo abhängt (`law.ts:65-66`).
- Dann dieselben Gates wie Stufe 2.

**Stand nach Stufe 3 (2026-10-03):** gebaut, Ergebnisse und Bau-Entscheidungen in §6.6. Die Repo-Erkennung liest Pfadsignale für jede Sprache mit getaggten Regeln; Go und PowerShell sind Default, Java, C/C++ und Terraform je Repo einschaltbar; HAL-002 auf Import-Zeilen endet als WARNING.

### 6.3 Kill-Switch

| Stufe | Schalter | Wirkung |
|---|---|---|
| 1 | Env `UNSLOP_PRESCAN_ONLY_REVIEW=off` | Diff-Loader setzt wieder `shouldAbort` wie heute. Gebaut: `isPrescanOnlyReviewEnabled`, zur Laufzeit gelesen, greift mit dem nächsten Job |
| 1, je Repo | `pipeline_config.enabledStepIds` ohne `pre-scanner` | besteht schon (`worker.ts:100-107`) |
| 2 und 3 | Config-Wert `reviewScope.llmExtensions` mit Default in `defaults.ts`, je Repo über die Operator-Allowlist | Liste leer ⇒ nur JS/TS. Gebaut: `resolveReviewScopeConfig`, Default seit Stufe 3 `['.py', '.go', '.ps1', '.psm1']` |
| 2 und 3, global | Env `UNSLOP_LLM_LANE_JSTS_ONLY=1` | übersteuert die Config, Rollback ohne Deploy. Gebaut: `isLlmLaneRestrictedToJsTs`, zur Laufzeit gelesen |

Die Env-Schalter folgen dem Muster von `UNSLOP_ESCALATION_LEGACY_PRO`.

### 6.4 Test- und Benchmark-Gates

| Gate | Stufe | Kriterium |
|---|---|---|
| G1 Korpus | 0 | Pre-Scan über die fünf Korpora aus §4.4: 0 CRITICAL aus SEC-035 auf Stdlib, lokalen Modulen und Nicht-Dependency-Zeilen. 0 CRITICAL auf `.md` |
| G2 Summary | 0 | Replay von Job `3f26b2da`: Summary nennt das CRITICAL. Unit-Test im Persister |
| G3 Pre-Scan-only | 1 | `--prescan-only` unverändert 68/177, 0 Fehlalarme. Neue Negativ-Kontrollen für Config (YAML, Terraform, `package.json`, Markdown) |
| G4 Abbruchpfade | 1 | Tests: nur `.md` ⇒ weiter „Nothing to review“. Nur `.py` ⇒ `deterministic_only`. Größen-Cap-Abbruch unverändert |
| G5 Oberflächen | 1 | je ein Sicht-Beleg für Check Run, PR-Kommentar, CLI, Extension, `unslop_scan` |
| G6 Law-Filter | 2, 3 | Unit-Test: für jede Sprache der Liste stehen alle getaggten Regeln im gefilterten Block eines polyglotten Repos |
| G7 Recall | 2, 3 | Produktionspfad-Benchmark, 3 Läufe: Combined auf r03, r04, r09, r10, r16 wie in §4.2. 0 CRITICAL auf r14, r21 |
| G8 Schattenlauf | 2, 3 | 10 echte PR-Diffs je Sprache, alle CRITICALs gesichtet, Fehlalarmquote im Log |
| G9 Latenz | 2, 3 | Maximum Draft plus Verify unter 210 s über die G7-Läufe |
| G10 Live-Receipt | 1, 2 | je ein Job auf `unslopai/test` mit Job-ID in der Chronik |

### 6.5 Gate-Ergebnisse Stufe 2 (2026-09-30)

Code-Stand: Branch `feat/langcov-stufe2` auf `main` `b9f01b2`. Modelle laut `models.ts`: Draft `gemini-3.8-flash`, Verifier `gemini-3.6-flash`. Alle Läufe mit dem sprachneutralen Prompt-Kern, ohne RAG, ohne Reference Practices, ohne Job-Budget, **ohne Eskalation** (`--no-escalation`, Auftrag: das Kontingent steht bei 36/50 und blieb dort).

| Gate | Python | Java | Beleg |
|---|---|---|---|
| G6 Law-Filter | grün: alle 8 getaggten Regeln im Block | grün für Spring: alle 7 getaggten Regeln im Block | `src/lib/law.test.ts` „Gate G6 — Law-Filter im polyglotten Repo“: echte `detectRepoEcosystems` auf einem TypeScript-Host mit `pyproject.toml` und Spring-`pom.xml`, Regeln aus `rules-inventory.json` (deckt sich mit der Live-Tabelle, SQL vom 2026-09-30) |
| G7 Recall, 3 Läufe | r03 10/10, r04 6/6, r16 7/7 (davon 5 Python) je Lauf; r14 0 Findings ×3 | r09 7/7 je Lauf; r27 0 Findings ×3 | `results/2026-09-30-langcov-stufe2-g7-production.json`: Draft 90/90, Combined 90/90, nach Verifier 90/90, 0 CRITICAL und 0 WARNING auf 6 Kontroll-Läufen. §4.2 hatte für dieselben Fixtures Combined 100 % im Modell-Potenzial-Pfad |
| G8 Schattenlauf | grün: 10 PRs, 0 Findings | **gerissen**: 10 PRs, 1 CRITICAL, gesichtet als Fehlalarm | `results/2026-09-30-langcov-stufe2-g8-shadow.json`, Methode und Liste unten |
| G9 Latenz | Maximum Draft plus Verify **83,1 s** (r16, Job `ceee592a`), Grenze 210 s | Maximum 59,8 s (r09) | SQL auf `review_job_llm_calls` der 18 G7-Jobs; je Fixture Mittel / Max: r03 48,4 / 50,7 s, r04 43,3 / 53,7 s, r09 51,4 / 59,8 s, r16 58,3 / 83,1 s, r14 9,1 / 10,7 s, r27 17,2 / 38,0 s |

**G8, Methode.** `scripts/shadow-run.ts` lädt je PR `https://github.com/<repo>/pull/<n>.diff`, parst ihn mit dem Parser des CLI-Pfads (`parseUnifiedDiff`), filtert wie der Diff-Loader (`isReviewableFile` mit `.py`, `.java`, dann `trimReviewableFiles`) und fährt Router, Draft, Verifier und Scorer. Der Law-Filter bekommt die Ökosysteme, die `detectRepoEcosystems` am 2026-09-30 auf dem Default-Branch des Repos erkennt (`--detect`). Jedes überlebende Finding steht mit Zitat und Kritik im Report; das Urteil „Fehlalarm“ fällt beim Sichten. Auswahl vor dem ersten Modell-Call: je Sprache drei bekannte öffentliche Repos, gemergte PRs mit Code-Änderung, je Repo die größten Diffs der Kandidatenliste (`--plan`, 0 Token), alle unter der Router-Heuristik (höchstens 15 Dateien und 12k geschätzte Tokens), damit kein PR in Produktion `pro-direct` gelaufen wäre. Die Liste liegt in `fixtures/shadow-run/langcov-stufe2-prs.json`.

| Sprache | PR | erkannte Ökosysteme | Dateien im Modell / im PR | geschätzte Tokens | Job | CRITICAL / WARNING | Zweitmeinung unterdrückt |
|---|---|---|---|---|---|---|---|
| Python | pallets/flask#5928 | `python` | 8 / 10 | 4.118 | `f8cfd624` | 0 / 0 | ja |
| Python | pallets/flask#5917 | `python` | 5 / 7 | 2.518 | `63cac8c8` | 0 / 0 | ja |
| Python | pallets/flask#5818 | `python` | 5 / 6 | 5.505 | `d4faae48` | 0 / 0 | nein |
| Python | pallets/flask#5736 | `python` | 4 / 6 | 6.550 | `7889c2d1` | 0 / 0 | ja |
| Python | psf/requests#7505 | `python` | 3 / 3 | 782 | `21fac984` | 0 / 0 | nein |
| Python | psf/requests#7502 | `python` | 2 / 2 | 314 | `5b5e134b` | 0 / 0 | ja |
| Python | psf/requests#7496 | `python` | 4 / 5 | 981 | `95e50f6c` | 0 / 0 | nein |
| Python | encode/httpx#3690 | `python` | 4 / 4 | 1.335 | `ea012298` | 0 / 0 | nein |
| Python | encode/httpx#3673 | `python` | 8 / 8 | 2.608 | `ed4977ff` | 0 / 0 | nein |
| Python | encode/httpx#3571 | `python` | 1 / 1 | 111 | `27f0b2e1` | 0 / 0 | nein |
| Java | spring-projects/spring-petclinic#2672 | `java-spring` | 4 / 4 | 1.169 | `0a93272a` | 0 / 0 | ja |
| Java | spring-projects/spring-petclinic#2611 | `java-spring` | 4 / 4 | 813 | `6b9f3bed` | 0 / 0 | ja |
| Java | spring-projects/spring-petclinic#2573 | `java-spring` | 4 / 7 | 2.965 | `9f8dccf4` | **1** / 0 | ja |
| Java | spring-projects/spring-petclinic#2490 | `java-spring` | 3 / 12 | 766 | `5ec7ef39` | 0 / 0 | nein |
| Java | google/guava#8704 | keine (kein Filter) | 4 / 4 | 1.118 | `3f5b270d` | 0 / 0 | ja |
| Java | google/guava#8703 | keine (kein Filter) | 12 / 12 | 3.520 | `84974678` | 0 / 0 | ja |
| Java | google/guava#8685 | keine (kein Filter) | 2 / 2 | 1.628 | `4c3801f1` | 0 / 0 | ja |
| Java | spring-projects/spring-boot#51870 | `nodejs, java-spring` | 6 / 8 | 1.945 | `e29ccb4b` | 0 / 0 | nein |
| Java | spring-projects/spring-boot#51855 | `nodejs, java-spring` | 2 / 6 | 1.482 | `9ffe8eb9` | 0 / 0 | ja |
| Java | spring-projects/spring-boot#51841 | `nodejs, java-spring` | 2 / 2 | 1.528 | `4533a2c7` | 0 / 0 | ja |

**G8, Sichtung.** Ein CRITICAL in 20 PRs, in `spring-petclinic#2573`: HAL-002 auf `import org.springframework.boot.restclient.RestTemplateBuilder;` in `PetClinicConcurrencyTests.java:17`. Der Draft nennt das Paket „non-existent“ und verweist auf `org.springframework.boot.web.client`; der Blind-Verifier bestätigte. **Fehlalarm:** Das Repo steht auf Spring Boot 4.1.0 (`pom.xml`), und dort liegt die Klasse genau in diesem Paket (`module/spring-boot-restclient/.../org/springframework/boot/restclient/RestTemplateBuilder.java` im Spring-Boot-Repo, abgerufen 2026-09-30). Das Wissen beider Modelle endet vor der Modularisierung von Spring Boot 4.

| | Python | Java |
|---|---|---|
| PRs mit falschem CRITICAL | 0 von 10 | **1 von 10** |
| falsche CRITICALs / alle CRITICALs | 0 / 0 | 1 / 1 |
| richtige Findings | 0 | 0 |
| Draft-Latenz Mittel / Max (beide Sprachen) | 14,3 s / 31,6 s | |

**Lesart und Grenzen:**

- Die Ursache des Fehlalarms ist nicht Java-spezifisch: HAL-002 lässt das Modell aus eigenem Wissen über die Existenz einer API urteilen, und der Verifier hat dasselbe Wissen. Auf JS/TS kann dasselbe mit jeder neuen Framework-Version passieren. Gemessen ist es aber auf Java, und ein CRITICAL lässt den Check scheitern.
- Null Findings auf 19 von 20 PRs heißt auch: Der Lauf belegt keine richtigen Treffer auf echtem Code. Die PRs stammen aus gepflegten Projekten mit Review; KI-geschriebene Diffs aus Kunden-Repos sehen anders aus.
- **Die Zweitmeinung ist nicht gemessen.** 12 der 20 PRs hätten in Produktion den Trigger `test-gap` ausgelöst (Testdateien ohne Finding) und einen Pass des Eskalations-Modells bekommen. Er lief nicht, weil er Kontingent verbraucht. Seine Fehlalarmquote auf Python und Java ist offen, und der Trigger feuert auf Python- und Java-Tests künftig in Produktion.
- N = 10 je Sprache, Temperatur 0, ein Lauf.
- Der Pre-Scanner lief im Schattenlauf nicht; seine Korpus-Messung steht in §4.4.

**Entscheidung.** Python ist Default: alle vier Gates grün. Java ist nicht Default: G8 reißt mit 1 falschem CRITICAL auf 10 PRs. Java bleibt über `reviewScope.llmExtensions` je Repo einschaltbar. Für Java als Default bräuchte es eins von beiden, danach denselben Schattenlauf mit 0 falschen CRITICALs: *(a)* HAL-002-Claims über die Existenz eines Imports oder Pakets enden als WARNING statt CRITICAL, so wie SEC-035 für Import-Namen seit Stufe 0 (§4.4); *(b)* der Draft bekommt die Versionen aus dem Build-Manifest (`pom.xml`, `build.gradle`) als Kontext.

**Java ohne Spring.** `detectRepoEcosystems` kennt nur `java-spring`, und nur mit Spring-Bezug im Manifest (§2.5). In einem polyglotten Repo mit Java ohne Spring fehlen deshalb die Java-Regeln HAL-004, HAL-006, HAL-007 und SEC-030 im Prompt; SEC-015 bleibt nur, wenn das Repo `nodejs` hat, SEC-006 und SEC-008 nur mit `python`. Ein reines Java-Repo ohne Spring hat `[]` und bekommt den ungefilterten Block. G6 ist für den Spring-Fall grün; der Fall ohne Spring ist ein To-Do und ein weiterer Grund gegen Java als Default.

**Vertex-Verbrauch.** Schätzung vorher aus §4.2: G7 rund $0,46 (3 × $0,153), G8 höchstens $1,60 (20 PRs zu je $0,03 bis $0,08). Gemessen mit `scripts/benchmark-cost.ts`: G7 **$0,47** (18 Jobs, 30 Calls), G8 **$0,23** (20 Jobs, 21 Calls), zusammen **$0,70 von $5,00**. Eskalationen: 0 Calls, `billing_accounts.escalation_month_count` 36 vorher und nachher. In G7 wäre keine Eskalation gelaufen (`suppressedEscalations` leer in allen 18 Läufen), in G8 zwölfmal die Zweitmeinung.

**Nebenwirkung der Läufe.** G7 lief noch mit `PROMPT_CACHE_SCHEMA_VERSION = 2` und legte die Caches der Keys `python`, `java-spring` und `unfiltered` mit dem neuen Kern neu an (`explicit_created` um 12:00 bis 12:04 UTC, vorher abgelaufen). Ein Produktions-Job mit einem dieser drei Keys hätte bis zum TTL-Ablauf den neuen Kern gelesen. Die Produktions-Repos laufen unter anderen Keys (`unslopai/test`: `nodejs,react,typescript`).

### 6.6 Gate-Ergebnisse Stufe 3 (2026-10-03)

Code-Stand: Branch `feat/langcov-stufe3` auf `main` `94a7b37`. Modelle laut `models.ts`: Draft `gemini-3.8-flash`, Verifier `gemini-3.6-flash`. Alle Läufe ohne RAG, ohne Reference Practices, ohne Job-Budget, **ohne Eskalation** (`--no-escalation`). Kandidaten in dieser Reihenfolge: Go, Java als Default, C/C++, Terraform (`.tf`), PowerShell. Kubernetes-YAML bleibt deterministisch (§1).

**Law-Filter-Fix (Voraussetzung, zuerst gebaut).** `detectRepoEcosystems` liest jetzt Pfadsignale, und `KNOWN_ECOSYSTEMS` kennt dreizehn weitere Keys, die wie die `applies_to`-Tags heißen: `java`, `c`, `cpp`, `terraform`, `powershell`, `kubernetes`, `solidity`, `rust`, `kotlin`, `scala`, `haskell`, `elixir`, `cobol`. Damit hat jedes Tag der Tabelle außer `aws` ein Signal (`aws` steht nur neben `terraform`).

| Signal | Key |
|---|---|
| `.go` (auch ohne `go.mod`) | `go` |
| `.py` (auch ohne `pyproject.toml`, `requirements.txt`, `setup.py`) | `python` |
| `.java` (auch ohne Spring im Manifest) | `java` |
| `.c`, `.h` | `c` |
| `.cpp`, `.cc`, `.cxx`, `.hpp` | `cpp` |
| `.tf` | `terraform` |
| `.ps1`, `.psm1` | `powershell` |
| `.sol` | `solidity` |
| `.rs`, `Cargo.toml` | `rust` |
| `.kt`, `.kts` / `.scala` / `.hs` / `.ex`, `.exs` / `.cbl`, `.cob` | `kotlin` / `scala` / `haskell` / `elixir` / `cobol` |
| `.js`, `.jsx`, `.mjs`, `.cjs` (auch ohne `package.json`) | `nodejs` |
| `Chart.yaml`, `kustomization.yaml`/`.yml`, YAML unter `k8s/`, `kubernetes/`, `manifests/`, `helm/`, `charts/`, `kustomize/` | `kubernetes` |

Entscheidungen beim Bau:

- **Eine Datei genügt**, wie schon bei `.ts`. Ein falsches Signal kostet nur zusätzliche Regeln im Prompt; ein fehlendes nimmt der Sprache ihre Regeln.
- **Java ohne Spring.** Die sieben Java-Regeln der Tabelle (HAL-004, HAL-006, HAL-007, SEC-006, SEC-008, SEC-015, SEC-030) tragen das Tag `java-spring`, ihr Text gilt für jedes Java. Der Filter behandelt den Key `java` deshalb so, als trüge er auch `java-spring` (`law.ts: IMPLIED_LAW_TAGS`). Die Tags in der Tabelle bleiben unverändert. `java-spring` selbst entsteht weiter nur mit Spring im Build-Manifest und bleibt der Key der Spring-Practices; ein Spring-Repo hat beide Keys.
- **Reines Java-, C- oder Terraform-Repo.** Bisher `[]`, also ungefilterter Block mit allen 119 Regeln. Jetzt bekommt es einen gefilterten Block: die 72 universellen Regeln plus die der erkannten Sprachen.
- **Kein Repo verliert Regeln durch ein Nebensignal.** Ein Rust-Repo mit einem `.ps1`-Skript hatte bisher `[]` (ungefilterter Block). Bekäme es nur `powershell`, fielen seine Rust-Regeln weg. Deshalb die Signale für alle Tags, auch für Sprachen, die die Modell-Review nicht liest (Review-Befund, Test „keeps the Rust rules …“).
- **Diff-Ebene.** `detectDiffEcosystems` liest dieselbe Endungs-Tabelle und das Kubernetes-Pfadmuster, aber keine Manifest-Namen (ein Diff nur mit `package.json` bleibt `[]` wie bisher). Für die neuen Keys gibt es keine Reference Practices; die Schnittmenge bleibt dort leer.
- **Bekannte Unschärfen.** YAML unter `charts/` oder `manifests/`, das kein Kubernetes ist, vendorter C-Code unter `third_party/` und Objective-C-Header setzen ein Signal und kosten zusätzliche Regeln im Prompt. `deploy/*.yaml`, `.tfvars`, `.tf.json`, `.hh` und `.psd1` setzen keins.
- **Cache-Contract.** Der Filter hängt weiter nur vom Repo ab (`law.ts`, `fetchRenderedLawBlock`). `PROMPT_CACHE_SCHEMA_VERSION` bleibt 3: der Cache-Key enthält die sortierte Ökosystem-Liste und den Hash des gerenderten Law-Blocks (`context-cache.ts: computeCacheKey`), ein anderer Block hat also immer einen anderen Key. Folge: ein Repo, dessen Erkennung sich durch die neuen Signale ändert, bekommt beim ersten Job nach dem nächsten Ingest einen neuen Key je Modell (`explicit_created` statt `explicit_hit`, einmal der Prefix zum vollen Input-Preis, unter einem Cent). Repos ohne neue Signale behalten Key und Cache.
- **Bestehende Repos.** `repositories.detected_ecosystems` entsteht beim Ingest. Bis zum nächsten Ingest oder einem Lauf von `scripts/backfill-ecosystems.ts` gilt der alte Wert (ROADMAP).

Beleg G6: `src/lib/law.test.ts` „Gate G6“. Ein TypeScript-Host bekommt je Endung aus `GATED_LLM_EXTENSIONS` eine einzelne Datei ohne Manifest; der gefilterte Block enthält jede Regel der Sprache. Die erwarteten Regel-IDs je Endung sind im Test fest verdrahtet (Stand der Live-Tabelle, SQL vom 2026-10-03). Ein zweiter Fall prüft die 31 Regeln aus §2.5 an einem Host mit Kubernetes-Manifest, C, Terraform, PowerShell und Solidity, ein dritter die Manifest-Werte `polyglotEcosystems` gegen die Erkennung.

Law-Filter-Referenzlauf `--bypass-filter --ecosystems polyglot --only r01,r02,r11,r12,r13 --no-escalation --keep`:

| Fixture | vorher (`main`, `polyglotEcosystems: typescript, nodejs`) | nachher (Host plus erkannte Sprache) | Jobs vorher / nachher |
|---|---|---|---|
| r01 C | Draft 1/8 | Draft 8/8 | `5e9bdf25` / `26382b10` |
| r02 C | Draft 3/4 | Draft 4/4 | `12600605` / `85c5a3fb` |
| r11 Kubernetes | Draft 0/11 | Draft 11/11 | `a0b5590e` / `36b864b8` |
| r12 Terraform | Draft 0/4 | Draft 4/4 | `fef1196a` / `9d683ca1` |
| r13 PowerShell | Draft 0/3 | Draft 3/3 | `a8a2797f` / `ba05b1d1` |
| **Summe** | **Draft 4/30**, auf r01, r11, r12, r13 **1/26** wie in §4.3; Combined 21/30 | **Draft 30/30**, Combined 30/30, nach Verifier 30/30 | `results/2026-10-03-langcov-stufe3-lawfilter-before.json`, `-after.json` |

r02 lag schon vorher bei 3/4, weil drei seiner vier Regeln auch ohne C-Tag im Prompt stehen (`CONC-001` als Alternative, MAINT-003). Auf r13 lieferte der Draft in beiden Läufen zuerst eine leere Antwort; der eingebaute Sofort-Retry heilte sie (`parse_error` plus `ok` in `review_job_llm_calls`).

**Go-Latenz (E7).** Frage: Warum brauchte der Draft auf r10 (3,3 KB) am 2026-09-30 83, 85 und 161 s? Messung ohne parallele Last, dreimal r10 nacheinander, je Vertex-Call mit `usageMetadata` (Scratch-Skript, nicht eingecheckt):

| Lauf | Job | Draft-Latenz | Antwort-Tokens | Thinking-Tokens | Tokens je Sekunde | `finishReason` | Draft plus Verify |
|---|---|---|---|---|---|---|---|
| 1 | `e41a96a3` | 64,5 s | 1.258 | 9.609 | 168 | STOP | 75,5 s |
| 2 | `29f6e73c` | 34,6 s | 1.267 | 4.631 | 170 | STOP | 46,3 s |
| 3 | `a4ad9337` | 38,6 s | 1.114 | 5.436 | 170 | STOP | 49,6 s |
| 2026-09-30, unter Last | `2de60b44` | 83,0 s | zusammen 11.652 | | 140 | | 91,8 s |
| 2026-09-30, unter Last | `9bdc06e5` | 84,7 s | zusammen 8.381 | | 99 | | 94,8 s |
| 2026-09-30, unter Last | `8054133a` | 160,6 s | zusammen 13.739 | | 86 | | 170,0 s |

**Ursache:** das Thinking des Draft-Modells, nicht die Antwort. Die sichtbare Antwort ist in allen drei Läufen gleich lang (1,1 bis 1,3k Tokens, 3,4 bis 4,0k Zeichen, fünf Findings, `finishReason` STOP), es gibt also keine Wiederholungsschleife und keine überlange Ausgabe. 79 bis 88 % der abgerechneten Output-Tokens sind Thinking, und dessen Menge schwankt bei Temperatur 0 und identischem Prompt zwischen 4,6k und 9,6k. Die Latenz folgt der Token-Menge fast linear: ohne Last 168 bis 170 Tokens je Sekunde. Am 2026-09-30 liefen bis zu fünf Benchmark-Prozesse parallel; der Durchsatz lag dort bei 86 bis 140 Tokens je Sekunde, und das Thinking war mit 8 bis 14k Tokens am oberen Rand. Beides zusammen ergab die 161 s.

**Folge:** Es gibt nichts Go-Spezifisches zu beheben. Dieselbe Streuung zeigen andere Sprachen (Referenzlauf oben: r13 PowerShell 11.284 Output-Tokens in 58,7 s für eine leere Antwort, r01 C 7.510 in 33,9 s). Das Thinking-Level des Drafts bleibt unverändert, weil es alle Sprachen träfe. Go läuft deshalb durch dieselben Gates wie die anderen Kandidaten; G9 entscheidet über die Latenz.

**HAL-002 auf Import-Zeilen (Variante a aus §6.5, gebaut).** `downgradeImportExistenceClaim` (`src/lib/pipeline/import-existence-claims.ts`) läuft in jedem Reviewer-Pass (Draft, `pro-direct`, Zweitmeinung) hinter der Manifest-Validierung: ein HAL-002-Finding, dessen Zitat nur aus Import-Zeilen besteht, wird WARNING und bekommt den Satz „Reported as a warning: whether an import or package exists depends on the dependency version, which this review cannot see.“ Das gilt für alle Sprachen. Jedes Muster verlangt die ganze Zeile oder, bei mehrzeiligen Imports, das ganze Zitat; `import('x').then(…)` oder ein Einzeiler mit Aufruf bleiben CRITICAL. Import-Claims werden getrennt gebündelt, damit ein HAL-002 auf einem Aufruf derselben Datei sie nicht wieder auf CRITICAL zieht. Kein Prompt-Text ändert sich, also auch kein Cache-Key. Beleg: `import-existence-claims.test.ts`, und im Schattenlauf unten endet derselbe Import-Claim wie am 2026-09-30 als WARNING (Job `b2100cf3`).

**Gates.**

| Gate | Go | Java | C/C++ | Terraform | PowerShell | Beleg |
|---|---|---|---|---|---|---|
| G6 Law-Filter | grün, 1 Regel (ARCH-005) | grün, 7 Regeln, auch ohne Spring | grün, 11 Regeln | grün, 4 Regeln | grün, 4 Regeln | `src/lib/law.test.ts` „Gate G6“ |
| G7 Recall, 3 Läufe | r10 6/6 combined je Lauf (Draft 5/6, ARCH-005 nur vom Pre-Scan, wie in §4.2); r21 0 Findings ×3 | r09 7/7 je Lauf; r27 0 Findings ×3 | r01 8/8, r02 4/4 je Lauf; r15 0 Findings ×3 | r12 4/4 je Lauf; r28 0 Findings ×3 (und ×3 im Nachlauf) | r13 3/3 je Lauf; r29 0 Findings ×3 | `results/2026-10-03-langcov-stufe3-g7-production.json`: Draft 93/96, Combined 96/96, nach Verifier 96/96, 0 CRITICAL und 0 WARNING auf 15 Kontroll-Läufen |
| G8 Schattenlauf | **grün**: 10 PRs, 0 CRITICAL, 1 WARNING | **gerissen**: 1 falsches CRITICAL | **gerissen**: 1 falsches CRITICAL | **gerissen**: 5 falsche CRITICALs in 2 PRs | **grün**: 10 PRs, 0 CRITICAL, 2 WARNINGs | `results/2026-10-03-langcov-stufe3-g8-shadow.json`, Sichtung unten |
| G9 Latenz, Maximum Draft plus Verify | 77,8 s (r10, Job `26c2829d`) | 61,7 s (r09, `fbc05af6`) | 62,7 s (r01, `0cdccc54`) | 47,0 s (r12, `5fea3da5`) | 26,7 s (r13, `948d7a6f`) | SQL auf `review_job_llm_calls` der 33 G7-Jobs, Grenze 210 s. Im Schattenlauf lag das Maximum je Sprache zwischen 28,1 s und 52,0 s |

**G7, Methode.** Ein Lauf, sequenziell, ohne parallele Last: `--only r01,r02,r09,r10,r12,r13,r15,r21,r27,r28,r29 --llm-extensions .java,.go,.c,.h,.cpp,.cc,.cxx,.hpp,.tf,.ps1,.psm1 --ecosystems polyglot --runs 3 --no-escalation --keep`. Produktionspfad: das Modell bekommt nur, was `isReviewableFile` mit diesem Umfang durchlässt. Die C-, Terraform- und PowerShell-Fixtures laufen mit dem Law-Filter eines TypeScript-Hosts plus erkannter Sprache (`polyglotEcosystems`), r09/r27 mit `java-spring`, r10/r21 mit `go`. Neue Negativ-Kontrollen, weil es keine gab: `r28-clean-terraform.diff` (VPC mit zwei Subnetzen, verschlüsselter Bucket, Lambda mit eigener Rolle und eng gefasster Policy) und `r29-clean-powershell.diff` (Log-Archivierung, Plattenplatz-Prüfung, Dienst-Neustart). r28 lag im G7-Lauf noch in drei Verzeichnissen, also in drei Terraform-Modulen mit einer Referenz über die Modulgrenze (Review-Befund); die Dateien liegen jetzt in einem Modul, Nachlauf ×3 mit 0 Findings (`results/2026-10-03-langcov-stufe3-g7-r28-rerun.json`). Eine Eskalation wäre in einem der 33 Läufe gelaufen (r10 Lauf 3, `targeted`). Für C++ gibt es keine Fixture: G7 misst C.

**G8, Methode.** Wie §6.5: `scripts/shadow-run.ts`, je Sprache drei bekannte öffentliche Repos, 10 gemergte PRs, 4/3/3 verteilt. Kandidaten waren je Repo die 15 zuletzt aktualisierten gemergten PRs (GitHub-API, 2026-10-03). Aus ihnen kamen je Repo die größten Diffs, die mindestens eine Datei der Sprache enthalten und unter der Router-Heuristik bleiben (`--plan`, 0 Token). Die Liste `fixtures/shadow-run/langcov-stufe3-prs.json` stand vor dem ersten Modell-Call. Für Java sind es dieselben zehn PRs wie am 2026-09-30. Der Law-Filter bekommt, was die neue Erkennung am 2026-10-03 auf dem Default-Branch liefert (`--detect`). Review-Umfang des Laufs: die elf Endungen aus G7.

| Sprache | PR | erkannte Ökosysteme | Dateien im Modell / im PR | geschätzte Tokens | Job | CRITICAL / WARNING | unterdrückt |
|---|---|---|---|---|---|---|---|
| Java | spring-projects/spring-petclinic#2672 | `java-spring, java, kubernetes` | 4 / 4 | 1.169 | `fbb34592` | 0 / 0 | Zweitmeinung |
| Java | spring-projects/spring-petclinic#2611 | wie oben | 4 / 4 | 813 | `682af506` | 0 / 0 | Zweitmeinung |
| Java | spring-projects/spring-petclinic#2573 | wie oben | 4 / 7 | 2.965 | `b2100cf3` | **1** / 1 | Zweitmeinung |
| Java | spring-projects/spring-petclinic#2490 | wie oben | 3 / 12 | 766 | `9de0b59e` | 0 / 0 | nein |
| Java | google/guava#8704 | `nodejs, java, kotlin` | 4 / 4 | 1.118 | `8ea76a2e` | 0 / 0 | Zweitmeinung |
| Java | google/guava#8703 | wie oben | 12 / 12 | 3.520 | `f7d506a4` | 0 / 0 | Zweitmeinung |
| Java | google/guava#8685 | wie oben | 2 / 2 | 1.628 | `02af0d2c` | 0 / 0 | Zweitmeinung |
| Java | spring-projects/spring-boot#51870 | `nodejs, java-spring, java, kotlin` | 6 / 8 | 1.945 | `7a9ec0a2` | 0 / 0 | nein |
| Java | spring-projects/spring-boot#51855 | wie oben | 2 / 6 | 1.482 | `0e108c07` | 0 / 0 | Zweitmeinung |
| Java | spring-projects/spring-boot#51841 | wie oben | 2 / 2 | 1.528 | `2f790a95` | 0 / 0 | Zweitmeinung |
| Go | spf13/cobra#2356 | `go` | 2 / 2 | 679 | `28190bbd` | 0 / 0 | Zweitmeinung |
| Go | spf13/cobra#2397 | `go` | 2 / 3 | 518 | `2619d96e` | 0 / 0 | Zweitmeinung |
| Go | spf13/cobra#2285 | `go` | 1 / 1 | 201 | `6f8933c5` | 0 / 0 | nein |
| Go | spf13/cobra#2333 | `go` | 1 / 1 | 196 | `14c99ddb` | 0 / 0 | nein |
| Go | gin-gonic/gin#4806 | `go` | 5 / 6 | 1.680 | `a58a0787` | 0 / 1 | gezielte Eskalation, Zweitmeinung |
| Go | gin-gonic/gin#4814 | `go` | 6 / 6 | 1.581 | `8fceb82a` | 0 / 0 | Zweitmeinung |
| Go | gin-gonic/gin#4800 | `go` | 2 / 2 | 1.241 | `11d4aec6` | 0 / 0 | Zweitmeinung |
| Go | go-chi/chi#700 | `go` | 7 / 7 | 1.738 | `86d4ecd6` | 0 / 0 | Zweitmeinung |
| Go | go-chi/chi#1185 | `go` | 2 / 2 | 1.210 | `eb509479` | 0 / 0 | Zweitmeinung |
| Go | go-chi/chi#1167 | `go` | 8 / 8 | 1.179 | `c87efecd` | 0 / 0 | nein |
| C/C++ | redis/redis#15743 | `nodejs, python, c, cpp` | 9 / 9 | 4.419 | `e2dc2723` | 0 / 0 | nein |
| C/C++ | redis/redis#13900 | wie oben | 4 / 7 | 3.326 | `e71f122a` | **1** / 0 | nein |
| C/C++ | redis/redis#15662 | wie oben | 7 / 17 | 3.282 | `c74fa41f` | 0 / 0 | nein |
| C/C++ | redis/redis#15853 | wie oben | 1 / 1 | 1.836 | `88b9e450` | 0 / 0 | nein |
| C/C++ | jqlang/jq#3620 | `nodejs, python, c, cpp` | 1 / 7 | 1.210 | `955f7154` | 0 / 0 | nein |
| C/C++ | jqlang/jq#3607 | wie oben | 2 / 2 | 1.003 | `a7a4d351` | 0 / 0 | nein |
| C/C++ | jqlang/jq#3266 | wie oben | 1 / 2 | 900 | `a6a7f060` | 0 / 0 | nein |
| C/C++ | fmtlib/fmt#4921 | `nodejs, python, c, cpp` | 2 / 2 | 2.313 | `44cb23cc` | 0 / 0 | Zweitmeinung |
| C/C++ | fmtlib/fmt#4942 | wie oben | 2 / 2 | 1.397 | `8164ada2` | 0 / 0 | Zweitmeinung |
| C/C++ | fmtlib/fmt#4959 | wie oben | 3 / 3 | 586 | `949a685f` | 0 / 0 | Zweitmeinung |
| Terraform | terraform-aws-modules/terraform-aws-vpc#1225 | `terraform` | 5 / 10 | 8.440 | `88b8f1a1` | **3** / 0 | nein |
| Terraform | terraform-aws-modules/terraform-aws-vpc#1305 | `terraform` | 3 / 4 | 2.782 | `fd2a7208` | 0 / 0 | nein |
| Terraform | terraform-aws-modules/terraform-aws-vpc#1301 | `terraform` | 1 / 1 | 1.896 | `02ef72d5` | 0 / 0 | nein |
| Terraform | terraform-aws-modules/terraform-aws-vpc#1302 | `terraform` | 4 / 26 | 588 | `64e33fc7` | 0 / 0 | nein |
| Terraform | terraform-aws-modules/terraform-aws-eks#3737 | `terraform, powershell` | 2 / 2 | 1.084 | `0463780e` | 0 / 0 | nein |
| Terraform | terraform-aws-modules/terraform-aws-eks#3746 | wie oben | 2 / 3 | 400 | `a787bece` | 0 / 1 | nein |
| Terraform | terraform-aws-modules/terraform-aws-eks#3690 | wie oben | 2 / 2 | 289 | `da51eb65` | 0 / 0 | nein |
| Terraform | terraform-aws-modules/terraform-aws-s3-bucket#392 | `terraform` | 11 / 16 | 3.562 | `25545a02` | **2** / 0 | nein |
| Terraform | terraform-aws-modules/terraform-aws-s3-bucket#292 | `terraform` | 3 / 3 | 740 | `3f2d87f6` | 0 / 0 | nein |
| Terraform | terraform-aws-modules/terraform-aws-s3-bucket#401 | `terraform` | 1 / 1 | 537 | `344ccd9e` | 0 / 0 | nein |
| PowerShell | pester/Pester#3023 | `powershell` | 2 / 2 | 1.723 | `d17023b7` | 0 / 0 | nein |
| PowerShell | pester/Pester#3022 | `powershell` | 2 / 6 | 1.711 | `4df9f022` | 0 / 0 | nein |
| PowerShell | pester/Pester#3032 | `powershell` | 4 / 4 | 912 | `e13a25ca` | 0 / 0 | nein |
| PowerShell | pester/Pester#3028 | `powershell` | 2 / 4 | 859 | `1912edb6` | 0 / 0 | nein |
| PowerShell | ScoopInstaller/Scoop#6741 | `powershell` | 5 / 6 | 657 | `c7e038f2` | 0 / 0 | nein |
| PowerShell | ScoopInstaller/Scoop#6744 | `powershell` | 2 / 4 | 474 | `0e740f01` | 0 / 0 | nein |
| PowerShell | ScoopInstaller/Scoop#6756 | `powershell` | 1 / 2 | 273 | `03dc2fc3` | 0 / 0 | Zweitmeinung |
| PowerShell | dahlbyk/posh-git#779 | `powershell` | 3 / 3 | 5.662 | `da15d856` | 0 / 0 | nein |
| PowerShell | dahlbyk/posh-git#877 | `powershell` | 3 / 4 | 1.839 | `3fb159c0` | 0 / 1 | nein |
| PowerShell | dahlbyk/posh-git#885 | `powershell` | 2 / 2 | 724 | `b6788705` | 0 / 1 | nein |

**G8, Sichtung.** Sieben CRITICALs in 50 PRs, alle sieben Fehlalarme. Quellen abgerufen am 2026-10-03.

| PR | Finding | Urteil | Beleg |
|---|---|---|---|
| spring-petclinic#2573 | HAL-002 auf `restTemplateBuilder.baseUri("http://localhost:" + port)`: „RestTemplateBuilder does not have a 'baseUri(String)' method“ | **Fehlalarm** | `public RestTemplateBuilder baseUri(String baseUri)` in `module/spring-boot-restclient/…/RestTemplateBuilder.java` auf `main` von spring-boot. Der Import-Claim derselben Datei endet jetzt als WARNING; dieser Claim zitiert einen Aufruf und bleibt nach Variante (a) CRITICAL |
| redis#13900 | CONC-004 auf `ClientsPeakMemInput[CurrentPeakMemUsageSlot] = in_usage` (`src/server.c:964`): mehrere IO-Threads und der Main-Thread schrieben ohne Synchronisation | **Fehlalarm** | `processClientsFromIOThread` läuft im Main-Thread (Kommentar über der Funktion in `src/iothread.c`: „The main thread processes the clients from IO threads“), `clientsCron` ebenfalls. Der Diff zeigt das nicht; der Verifier bestätigte trotzdem |
| terraform-aws-vpc#1225 (3×) | HAL-002 auf `region = var.region` in `aws_vpc`, `aws_vpc_endpoint` und der Data Source `aws_region`: das Argument gebe es nicht | **Fehlalarm** (3) | Provider-Doku auf `main` von `hashicorp/terraform-provider-aws`: `region` ist dokumentiertes Argument in `r/vpc`, `r/vpc_endpoint` und `d/region` |
| terraform-aws-s3-bucket#392 | HAL-002 auf `resource "aws_s3vectors_vector_bucket"`: Ressource und Dienst seien erfunden | **Fehlalarm** | `website/docs/r/s3vectors_vector_bucket.html.markdown` im Provider-Repo |
| terraform-aws-s3-bucket#392 | HAL-002 auf `version = ">= 6.42"`: die Provider-Version gebe es nicht | **Fehlalarm** | Terraform-Registry führt `hashicorp/aws` 6.42.0 |

Die fünf WARNINGs: der abgestufte Import-Claim (petclinic), TEST-004 auf einem `require.NoError` in gin#4806 (Verifier unsicher, ohne Eskalation abgestuft), MAINT-006 auf je einem TODO ohne Ticket (eks#3746, posh-git#885) und Condition 5 auf einer ungenutzten Variablen (posh-git#877). Die beiden MAINT-006 und Condition 5 sind nach Regeltext richtig; TEST-004 ist nicht gesichtet.

| | Go | Java | C/C++ | Terraform | PowerShell |
|---|---|---|---|---|---|
| PRs mit falschem CRITICAL | 0 von 10 | **1 von 10** | **1 von 10** | **2 von 10** | 0 von 10 |
| falsche CRITICALs / alle CRITICALs | 0 / 0 | 1 / 1 | 1 / 1 | 5 / 5 | 0 / 0 |
| WARNINGs | 1 | 1 | 0 | 1 | 2 |
| Latenz Draft plus Verify, Mittel / Max | 13,0 / 39,7 s | 14,5 / 40,3 s | 13,6 / 28,1 s | 15,1 / 52,0 s | 12,3 / 33,6 s |

**Lesart und Grenzen:**

- Sechs der sieben Fehlalarme sind HAL-002 auf einer API, die jünger ist als das Wissen der Modelle: Spring Boot 4, das `region`-Argument und S3 Vectors im AWS-Provider. Variante (a) deckt davon nur Import-Zeilen. Für Terraform gibt es keine Import-Zeile, auf die sie greifen könnte: dort ist jede Ressource und jedes Argument ein „Aufruf“. Der Verifier hilft nicht, er hat dasselbe Wissen.
- Der siebte (Redis) ist ein Nebenläufigkeits-Urteil über Code, dessen Thread-Modell der Diff nicht zeigt.
- Null falsche CRITICALs auf Go und PowerShell heißt auch: der Lauf belegt dort keine richtigen CRITICALs auf echtem Code. Die PRs stammen aus gepflegten Projekten.
- **Die Zweitmeinung ist nicht gemessen.** 19 der 50 PRs hätten in Produktion den Trigger `test-gap` ausgelöst, davon 7 der 10 Go-PRs und 1 der 10 PowerShell-PRs. Go-PRs mit Tests verbrauchen damit künftig Eskalations-Kontingent, und die Fehlalarmquote dieses Passes auf Go ist offen.
- PowerShell: in beiden Referenzläufen oben kam auf r13 zuerst eine leere Draft-Antwort (Retry heilte sie), im G7-Lauf und im Schattenlauf nicht. N = 2, Ursache nicht untersucht.
- C++ ist nur im Schattenlauf gemessen (fmtlib/fmt, 3 PRs, 0 Findings), nicht in G7.
- N = 10 je Sprache, Temperatur 0, ein Lauf. Der Pre-Scanner lief im Schattenlauf nicht.

**Entscheidung nach der Gate-Regel.**

| Sprache | G6 | G7 | G8 | G9 | Ergebnis |
|---|---|---|---|---|---|
| Go (`.go`) | grün | grün | grün | grün | **Default** |
| PowerShell (`.ps1`, `.psm1`) | grün | grün | grün | grün | **Default** |
| Java (`.java`) | grün | grün | gerissen | grün | je Repo |
| C/C++ (`.c`, `.h`, `.cpp`, `.cc`, `.cxx`, `.hpp`) | grün | grün | gerissen | grün | je Repo |
| Terraform (`.tf`) | grün | grün | gerissen | grün | je Repo |

`DEFAULT_REVIEW_SCOPE_CONFIG.llmExtensions = ['.py', '.go', '.ps1', '.psm1']`. Alle elf Endungen stehen in `GATED_LLM_EXTENSIONS` und sind über `reviewScope.llmExtensions` je Repo einschaltbar. Was Java, C/C++ und Terraform für den Default bräuchten, danach denselben Schattenlauf mit 0 falschen CRITICALs: für HAL-002 die Versionen aus dem Build-Manifest als Draft-Kontext (§6.5 Variante b; für Terraform die Provider-Constraints aus `versions.tf`), oder HAL-002 aus der Modell-Lane generell als WARNING; für C/C++ zusätzlich eine Antwort auf Nebenläufigkeits-Claims ohne sichtbares Thread-Modell.

**Vertex-Verbrauch.** Budget $3,00. Schätzung vorher aus §4.2 und §6.5, gemessen mit `scripts/benchmark-cost.ts`:

| Lauf | geschätzt | gemessen | Jobs / Calls |
|---|---|---|---|
| Law-Filter-Referenz vorher | $0,08 | $0,23 | 5 / 10 |
| Law-Filter-Referenz nachher | $0,17 | $0,16 | 5 / 11 |
| Go-Latenz, 3× r10 | $0,18 | $0,14 | 3 / 6 |
| G7, 11 Fixtures × 3 | $0,76 | $0,71 | 33 / 51 |
| G7-Nachlauf r28 × 3 | $0,02 | $0,02 | 3 / 3 |
| G8, 50 PRs | $0,60 | $0,60 | 50 / 58 |
| **Summe** | $1,81 | **$1,85 von $3,00** | 99 / 139 |

Der Referenzlauf „vorher“ kostete das Dreifache der Schätzung: ohne die Regeln im Prompt schrieb der Draft 44.940 Output-Tokens, fast alles Thinking, um wenig zu melden. Eskalationen: 0 Calls (alle 139 Calls dieser Session sind `draft` oder `verify`), `billing_accounts.escalation_month_count` 3 vorher und 3 nachher.

**Abweichung beim Arbeitsort.** Die Läufe liefen im Clone `C:\dev\unslop-f4`, nicht in `C:\dev\unslop-bench`: dort blockierten zwei untracked Ergebnisdateien den Branch-Wechsel. Die Umgebungsvariablen las Node mit `--env-file` direkt aus der `.env.local` des Bench-Clones; die Datei wurde nicht kopiert.

## 7. Folgen für Benchmark und Marketing

### 7.1 Benchmark

- Der Runner baut `reviewableFiles` künftig mit `isReviewableFile` und bildet den Abbruch nach. Das ist der **Produktionspfad**.
- Der bisherige Modus bleibt als `--bypass-filter` und heißt im Report **Modell-Potenzial**.
- Jeder Report nennt seinen Pfad (`pathMode` im JSON) und zählt die Treffer getrennt nach der Lane, die die Datei in Produktion erreicht: Modell und Pre-Scan, nur Pre-Scan, keine Lane. Beide Gesamtzahlen brauchen zwei Läufe, einen je Pfad; ein Lauf rechnet den anderen Pfad nicht hoch.
- Fixtures für C, Kubernetes, Terraform, PowerShell tragen im Manifest zusätzlich `polyglotEcosystems`. `--ecosystems polyglot` fährt sie mit dem Law-Filter eines polyglotten Repos. Die Variante mit `null` bleibt als „Repo ohne erkanntes Ökosystem“.
- **Gebaut in Stufe 0** (`scripts/lib/rule-recall-benchmark.ts`, `src/lib/benchmark/production-path.ts`). Gefahren: Prescan-only Modell-Potenzial 68/177, Produktionspfad 43/177, davon 0 von 59 auf Dateien ohne Lane; Produktionspfad mit Modell auf r03 (Abbruch) und r16 (2/2 auf den JS/TS-Dateien, 0/5 auf den Python-Dateien).
- Der Benchmark-Log bekommt einen Nachtrag zum 2026-09-16-Lauf: 125/126 ist Modell-Potenzial, der Produktionspfad lag rechnerisch bei 59/126.

### 7.2 Welche Aussage nach welcher Option stimmt

Claim-Policy `MARKETING_CLAIMS.md` §00: eigene Messungen nur mit Methode, Datum, Modell und Grenze an derselben Stelle. Mit Stufe 1 geändert (EN und DE): der FAQ-Satz zum PR ohne TypeScript/JavaScript, der Onboarding-Satz `honestyFileTypes` und die Extension-README. Die übrigen Zeilen der Spalte „nach Stufe 1“ stimmen ohne Änderung.

| Aussage | heute | nach Stufe 1 | nach Stufe 2 |
|---|---|---|---|
| FAQ: „The model review reads TypeScript and JavaScript files.“ (`messages/en.json:496`) | stimmt | stimmt | falsch, Sprachliste nennen |
| FAQ: „…only reviewed if it contains at least one TypeScript or JavaScript file; otherwise … ‚Nothing to review‘.“ | stimmt | falsch, neuer Satz zum deterministischen Review | falsch |
| Tabelle „Files“, Modell: „TypeScript and JavaScript only“ (`:395`) | stimmt | stimmt | falsch |
| Messung „125 of 126 planted rule violations found“ (`:348`) | Zahl stimmt, **Grenze fehlt**: 69 der 126 liegen in Dateien, die das Modell in Produktion nicht liest | unverändert | erst mit Produktionspfad-Lauf ohne diese Grenze haltbar |
| Distribution-FAQs: andere Sprachen „get the deterministic pre-scanner only“ (`distribution/channels/01-x/FAQ.md:102-105` und Geschwister) | nur im gemischten PR richtig | stimmt | anpassen |
| Onboarding: „Only .ts, .tsx, .js, .jsx, .mjs and .cjs files are reviewed“ (`messages/en.json:36`) | stimmt für die LLM-Lane | präzisieren | falsch |
| Extension-README Zeile 20, reviewbare Dateitypen | stimmt | präzisieren | falsch |

Die fehlende Grenze bei 125/126 besteht heute schon. Sie ist als eigenes To-Do in der ROADMAP vermerkt.

**Mit Stufe 2 geändert (EN und DE, 2026-09-30):** Der Umfang heißt überall „TypeScript, JavaScript and Python“, weil nur Python Default ist (§6.5): FAQ-Antwort zu den Sprachen (samt neuem Satz zum gemischten PR), Tabelle „Files“, die Definition im Glossar-Block, `honestyFileTypes` und die Extension-README. Die Grenze der Messung nennt jetzt 46 statt 69 Verstöße in Dateitypen, die das Modell in Produktion nicht liest (69 minus 23 in `.py`). Java steht in keinem Text als Modell-Sprache. Die Distribution-Entwürfe sind nicht nachgezogen (ROADMAP To-Do).

**Nach Stufe 3 (2026-10-03):** Richtig ist jetzt „TypeScript, JavaScript, Python, Go and PowerShell“. Java, C/C++ und Terraform dürfen in keinem Text als Modell-Sprache stehen; sie sind nur je Repo-Config an.

| Stelle | Stand | Was stimmt |
|---|---|---|
| Prompt-Kern (`prompt-builder.ts: SHARED_GATEKEEPER_CORE`) | sprachneutral seit Stufe 2 | unverändert richtig |
| `describeFilesWithoutModelReview` | rechnet aus dem aufgelösten Review-Umfang | unverändert richtig: nennt `.go` und `.ps1` nicht mehr, `.java`, `.c`, `.tf` weiter |
| `SOURCE_CODE_LANGUAGES` (`packages/prescan/src/language.ts`) | enthält alle Kandidaten | unverändert richtig |
| Hinweise „no file of a type the model review reads“ | ohne Sprachliste | unverändert richtig |
| FAQ, Tabelle „Files“, Glossar, `honestyFileTypes` (`messages/en.json`, `messages/de.json`), Extension-README | „TypeScript, JavaScript and Python“ | **zu eng**: Go und PowerShell fehlen. In dieser PR nicht geändert (Auftrag: Landing, README und Distribution bleiben), ROADMAP To-Do |
| Grenze der Messung 125/126 auf der Landing: „46 … in Dateitypen, die das Modell in Produktion nicht liest“ | Stand Stufe 2 | **zu hoch**: 46 minus 6 in `.go` (r10) minus 3 in `.ps1` (r13) ergibt 37. In dieser PR nicht geändert, ROADMAP To-Do |

## 8. Offene Entscheidungen für Luca

| Nr. | Frage | Vorschlag | Entscheidung 2026-09-30 |
|---|---|---|---|
| E1 | Option A, B oder C? | C | C |
| E2 | Pre-Scan-only ohne Findings: Check `neutral` oder `success`? | `neutral`, Titel „Deterministic checks only“ | wie vorgeschlagen |
| E3 | Docs-only-PRs (nur Markdown): weiter „Nothing to review“? | ja | ja |
| E4 | Kubernetes: 641 WARNINGs auf 400 Dateien. Deckel je Regel und PR? | ja, ab dem 4. Treffer derselben Regel zusammenfassen | wie vorgeschlagen |
| E5 | Sprachliste Stufe 2: `.py`, `.go`, `.java`? | ja, Go mit Latenz-Beobachtung | ja; Go siehe E7 |
| E6 | Landing-Messung sofort um die Grenze ergänzen, vor jedem Bau? | ja, eigener kleiner PR | ja, Koordinator-Session |
| E7 | Stufe 2 vor oder nach dem Launch? | Stufe 0 und 1 vor dem Launch, Stufe 2 danach mit Schattenlauf | **abweichend:** Stufe 0 und 1 sofort; Stufe 2 für `.py` und `.java` vor dem Launch (Launch liegt wegen HR-Eintrag und Reddit-Vorlauf ohnehin ≥ 4–6 Wochen entfernt); `.go` erst, wenn die Draft-Latenz (§4.2, 83–161 s auf 3,3 KB) erklärt ist |

## 9. Offene Messungen

| Messung | Grund, warum sie fehlt |
|---|---|
| Anteil der Kunden-PRs ohne JS/TS oder mit Nicht-JS/TS-Anteil | keine externen Nutzer vor dem Launch, `review_jobs` speichert für Webhook-Jobs keine Dateiliste |
| Recall auf dem echten Produktionspfad (59/126 ist gerechnet) | Runner umgeht den Filter, Umbau ist Produktions-naher Code und nicht Teil dieser Session |
| Fehlalarmquote der LLM-Lane auf echtem Code | Python und Java gemessen in §6.5, Go, Java, C/C++, Terraform und PowerShell in §6.6 (je 10 PRs, ohne Zweitmeinung). Offen: die Zweitmeinung (in §6.6 hätte sie auf 7 von 10 Go-PRs gefeuert), KI-geschriebene Diffs statt gepflegter Projekte |
| HAL-002 auf APIs, die jünger sind als das Wissen der Modelle | 6 falsche CRITICALs in §6.6 (Spring Boot 4, AWS-Provider). Ungemessen: wie oft dasselbe auf JS/TS, Python, Go und PowerShell passiert, und ob Manifest-Versionen als Draft-Kontext (§6.5 Variante b) es beheben |
| C++ in G7 | keine C++-Fixture; r01, r02, r15 sind C. C++ ist nur im Schattenlauf gemessen (3 PRs) |
| Leere Draft-Antwort auf r13 (PowerShell) | zweimal im Law-Filter-Referenzlauf, nie in G7 und G8; Ursache nicht untersucht |
| Volllauf Universum auf dem Produktionspfad mit dem Default nach Stufe 3 | die 104/129 vom 2026-10-01 gelten für den Default `.py`; mit Go und PowerShell erreichen r10, r13 und r21 das Modell. Nicht gefahren, die Gates messen diese Fixtures einzeln |
| Wirkung von RAG und Reference Practices auf Nicht-JS/TS | Runner fährt beides aus. Der Skeleton-Index enthält nur JS/TS |
| LLM-Lane auf großen Nicht-JS/TS-Diffs (Batching ab 20k, `pro-direct`) | keine große Fixture in diesen Sprachen. r20 hätte Eskalationsbudget verbraucht |
| Rust, Kotlin, C#, Ruby, PHP, Shell, Dockerfile | keine Fixtures, keine getaggten Regeln außer `rust` in zwei Tags und `kotlin` in einem. Der Law-Filter erkennt Rust und Kotlin seit Stufe 3 am Pfad, die Modell-Review liest sie nicht |
| Latenz des Content-Fetchs für Pre-Scan-only-PRs | nur im Webhook-Pfad messbar, Test-PRs waren nicht im Umfang |

Nichts war durch Tooling blockiert. Der Supabase-MCP antwortete auf alle Abfragen. Stufe 3 (2026-10-03): ebenso; die einzige Abweichung war der Arbeitsort der Läufe (§6.6).
