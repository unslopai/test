# Sprachabdeckung: wie unslop Nicht-JS/TS-Code prüft

**Status: FREIGEGEBEN 2026-09-30 (Luca), Entscheidungen in §8.** E1–E6 wie vorgeschlagen, E7 abweichend: Stufe 0 und 1 sofort, Stufe 2 für Python und Java vor dem Launch, Go erst nach geklärter Latenz. **Stufe 0 ist gebaut (2026-09-30, §4.4 „Stand nach Stufe 0“, §5, §7.1), Stufe 1 ebenfalls (§6.2 „Stand nach Stufe 1“).** Die Abschnitte §2 bis §4 beschreiben den Stand vor dem Bau.

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
- **Deterministische Lane.** `isDeterministicLaneFile` (`packages/prescan/src/language.ts`): Python, Java, Go, C/C++, PowerShell, Terraform, YAML, JSON, dazu `requirements.txt` und `pyproject.toml`. Nicht dabei: Prosa-Dateien (§4.4), generierte Pfade und Lockfiles, entfernte Dateien, Dateien mit nur den universellen Regeln. **Abweichung von §6.1:** Rust hat Regeln, ist aber nicht in der Lane, weil es keinen Korpus gibt (Kriterium 2 ungemessen). JSON ist in der Lane trotz eines bekannten CRITICAL-Fehlalarms auf einer Datendatei (§4.4 „Rest“), weil `package.json`, CloudFormation und Agent-Settings der Zweck der Lane sind.
- **Pre-Scanner läuft nicht oder scheitert.** Ist der Step für das Repo abgeschaltet oder endet er degradiert, heißt das Ergebnis weiter „Nothing to review“ (`nothing_reviewed`). `deterministic_only` gibt es nur nach einem tatsächlich gelaufenen Pre-Scan.
- **Persistenz.** `result.deterministic_only: true`, `nothing_reviewed: false`, `files_reviewed: 0`. Kein Schema-Wechsel. Die Poll-Route liefert `outcome: deterministic_only` und `filesScanned`.
- **Check Run (E2).** CRITICAL ⇒ `failure` mit dem üblichen Titel. Nur WARNINGs ⇒ `neutral`. Keine Findings ⇒ `neutral`, Titel „Deterministic checks only“. Die Summary nennt in allen drei Fällen, dass kein Modell gelesen hat. Das Score-Gate greift nicht, es gibt keinen Score.
- **PR-Kommentar.** Ohne Findings: „ℹ️ Anti-Slop Gatekeeper: Deterministic checks only: this pull request changes no TypeScript or JavaScript file, so no model reviewed it. The pre-scanner checked N files and found nothing.“ Mit Findings steht derselbe Satz in der Summary des Reviews. Der Integrity-Score-Block entfällt.
- **CLI, Extension, MCP.** CLI: gelbe Zeile „Deterministic checks only — no model reviewed this diff.“, Findings wie sonst, nie der grüne Haken. Extension: Statusleiste „Deterministic only“ mit Warnfarbe. MCP: `unslop_scan` liefert bei einem fertigen Scan `outcome`, `filesReviewed` und einen `nextStep`, der „NOT a clean verdict“ sagt. Das war nötig, weil ein solcher Scan in unter 10 s fertig ist und sonst wie ein sauberes Review aussähe; es schließt auch den größten Teil der Lücke aus §2.3. Der Text für lokale Diffs nennt, dass ohne Dateiinhalt nur Regex- und Registry-Regeln laufen.
- **Dashboard.** Ein Lauf ohne Modell-Review ohne Findings ist „neutral“, nicht „clean“.
- **Deckel E4.** `capRepeatedRuleHits` (`src/lib/pipeline/prescan-hit-cap.ts`): je Regel und Severity bleiben die ersten drei Treffer einzelne Findings, ab dem vierten steht ein Sammelfinding am vierten Treffer und nennt jede weitere Fundstelle. Das gilt für jeden Review, auch den gemischten PR. `prescan.findingsCount` und `criticalCount` zählen weiter jeden Treffer.
- **Belege.** G3: `--prescan-only` 68/177 auf beiden Pfaden, 0 Fehlalarme auf 7 Kontrollen, neu `r26-clean-config.diff` (Kubernetes, Terraform, `package.json`, Markdown). G4: `review-scope.test.ts`. G5: Tests je Oberfläche; die Sicht-Belege an einem echten PR und G10 stehen aus (ROADMAP).

**Stufe 2, Python, Go, Java in der LLM-Lane:**

- `REVIEWABLE_EXTENSIONS` um `.py`, `.go`, `.java`. Zuerst nur für `unslopai/test` per Repo-Config, dann als Default.
- Prompt-Kern sprachneutral formulieren. Das rotiert den Cache einmal.
- Gemischte PRs: Summary nennt Dateitypen, die kein Modell gelesen hat.

**Stufe 3, C/C++, Terraform, PowerShell:**

- Erst die Repo-Erkennung um Pfadsignale erweitern (`.tf`, `.c/.h/.cpp`, `.ps1`, Kubernetes-Manifeste). Der Cache-Contract bleibt, weil der Filter weiter nur vom Repo abhängt (`law.ts:65-66`).
- Dann dieselben Gates wie Stufe 2.

### 6.3 Kill-Switch

| Stufe | Schalter | Wirkung |
|---|---|---|
| 1 | Env `UNSLOP_PRESCAN_ONLY_REVIEW=off` | Diff-Loader setzt wieder `shouldAbort` wie heute. Gebaut: `isPrescanOnlyReviewEnabled`, zur Laufzeit gelesen, greift mit dem nächsten Job |
| 1, je Repo | `pipeline_config.enabledStepIds` ohne `pre-scanner` | besteht schon (`worker.ts:100-107`) |
| 2 und 3 | Config-Wert `reviewScope.llmExtensions` mit Default in `defaults.ts`, je Repo über die Operator-Allowlist | Liste leer ⇒ nur JS/TS |
| 2 und 3, global | Env `UNSLOP_LLM_LANE_JSTS_ONLY=1` | übersteuert die Config, Rollback ohne Deploy |

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
| Fehlalarmquote der LLM-Lane auf echtem Python/Go/Java-Code | braucht gesichtete reale Diffs. Die Fixtures haben nur 3 Kontrollen mit 8 Dateien |
| Wirkung von RAG und Reference Practices auf Nicht-JS/TS | Runner fährt beides aus. Der Skeleton-Index enthält nur JS/TS |
| LLM-Lane auf großen Nicht-JS/TS-Diffs (Batching ab 20k, `pro-direct`) | keine große Fixture in diesen Sprachen. r20 hätte Eskalationsbudget verbraucht |
| Ursache der Go-Latenz (83 bis 161 s) | N=3, unter paralleler Last gemessen |
| Rust, Kotlin, C#, Ruby, PHP, Shell, Dockerfile | keine Fixtures, keine getaggten Regeln außer `rust` in zwei Tags |
| Latenz des Content-Fetchs für Pre-Scan-only-PRs | nur im Webhook-Pfad messbar, Test-PRs waren nicht im Umfang |

Nichts war durch Tooling blockiert. Der Supabase-MCP antwortete auf alle Abfragen.
