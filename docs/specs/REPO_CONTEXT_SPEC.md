# Repo-Kontext für die Review: Spec mit Empfehlung

**Status: freigegeben am 2026-10-05 (Luca, alle Fragen in §12 wie empfohlen, Auflage zur Wirtschaftlichkeit in §12).** Die Spec selbst enthält keinen Produktcode; gebaut wird in den Stufen aus §9. **Stufe 1a und 1b sind seit 2026-10-05 gebaut** (Nachträge §6.1a, §8.1, §9.3); Live-Beleg und Messung 1 stehen aus. Nur intern: Die Zahlen aus der Mehrwert-Studie und alle Angaben zu anderen Produkten dürfen in keine Marketing-Datei (`docs/strategy/MARKETING_CLAIMS.md` §00).

## 1. Kurzfassung

- unslop sieht heute nur den Diff. Der vorhandene Repo-Kontext (Skeleton-RAG) kann die Fehler aus der Mehrwert-Studie aus vier Gründen nicht liefern: Er indexiert nur JS/TS-Dateien, nur den Default-Branch, sucht per Embedding über die ersten 30 hinzugefügten Zeilen, und der Prompt erlaubt ihn nur für DRY-Verstöße. Auf `unslopai/test` hat er 0 Chunks (§2).
- Von den 41 blockierenden Befunden, die nur Claude Code fand, sind **20 im Diff sichtbar, 18 brauchen eine Datei des Repos, 3 brauchen Laufzeitwissen**. Von den 18 brauchen 15 ein Manifest oder ein Schema (§3).
- Empfehlung: **Option D in Stufen**. Zuerst ein deterministisches Kontextpaket je PR (Manifeste, Schema, Einstiegspunkt, Nachbardateien, ganze geänderte Dateien) zusammen mit einer eng gefassten neuen Regel „passt nicht zum Repo“. Danach die offene Fehlersuche im Diff als eigene, messbar abschaltbare Stufe. Tool-Use erst, wenn die Messung nach Stufe 1 eine Lücke belegt und Vercel Pro verfügbar ist. Den Repo-Index nicht ausbauen (§6, §9).
- Die Machbarkeitsprobe auf drei Studien-PRs zeigt: Das Paket allein reicht nicht. Mit Paket fand der heutige Draft-Request 1 von 6 Repo-Fehlern, mit Paket und einem Auftragssatz 5 von 6, ohne Paket 0 von 6. Kosten der Probe: 0,18 USD (§8).
- Mehrkosten von Stufe 1 je PR: in der Probe 0,003 USD je Draft-Call mit dem laufenden Intro-Rabatt (0,005 USD Listenpreis), als Obergrenze mit vollem Paket-Budget rund 0,03 USD zum Listenpreis. Mehrzeit: 1 bis 2 s für die GitHub-Abrufe, dazu die übliche Streuung des Drafts (§6.1).

## 2. Bestandsaufnahme: Welchen Kontext hat unslop heute?

### 2.1 Was im Draft-Prompt steht

| Quelle | Wie sie entsteht | Was sie liefert |
|---|---|---|
| Diff | `diff-loader-step.ts`: `patch` je Datei aus der Pull-Request-Files-API, im CLI- und MCP-Pfad der hochgeladene `git diff` (`cli-diff-loader-step.ts`) | Nur die Hunks mit drei Zeilen Umgebung. Bei einer geänderten Datei fehlt alles außerhalb der Hunks. |
| THE LAW und Conditions | Statischer Cache-Prefix (`prompt-builder.ts: buildCachedPrefix`), gefiltert nach `detected_ecosystems` plus den Sprachen des Diffs | Regelwerk, kein Wissen über das Repo |
| EVIDENCE (Skeleton-RAG) | `rag.ts: buildRAGContext`: ein Embedding über Dateinamen und die ersten 30 hinzugefügten Zeilen (höchstens 2000 Zeichen), `match_code_chunks` mit Top 8 und Schwelle 0,4 | Signaturen, Interfaces und Typen aus JS/TS-Dateien des Default-Branches |
| REFERENCE PRACTICES | Dasselbe Embedding gegen 316 Auszüge aus Framework-Dokus, nur für die Schnittmenge aus Repo- und Diff-Ökosystemen | Allgemeine Doku, ausdrücklich nur beratend |
| `<already_flagged>` | Treffer des Pre-Scanners | Deduplizierung, kein Kontext |
| `detected_ecosystems` | `ecosystem-detection.ts` beim Ingest: Tree-Pfade und bis zu 3 Manifeste je Familie | Eine Liste wie `[react, typescript, nodejs]`. Die Manifest-Inhalte (Versionen, Abhängigkeiten) erreichen das Modell nicht. |

### 2.2 Warum der Skeleton-RAG so wenig liefert

1. **Nur JS/TS.** `skeleton.ts:324`: `INGESTABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs']`. `db/schema.sql`, `go.mod`, `requirements.txt` und `package.json` werden nie indexiert. Python, Go und PowerShell liest die Modell-Review seit Stufe 2 und 3 der Sprachabdeckung, der Index kennt sie nicht.
2. **Nur der Default-Branch, nur beim Verbinden.** `ingestRepository` hat genau einen Aufrufer (`connect-repository.ts:304`, im `after()` des Verbindens). Die App abonniert `pull_request`, `installation` und `installation_repositories`, kein `push` (`GITHUB_APP_SPEC.md:483`). Der Index altert ab dem Tag des Verbindens und kennt nie den Stand des PR-Heads.
3. **Die Suche passt nicht zur Frage.** Die Query sind Dateinamen plus die ersten 30 hinzugefügten Zeilen. Ob die Tabelle `contact` im Schema existiert, ist keine Ähnlichkeitsfrage. Die Zeile dazu ist schon in ROADMAP §1 notiert („DRY-Pfad nie gemessen“).
4. **Der Prompt verbietet die Nutzung.** `PROTOCOL_RAG` und `formatEvidenceSection`: „Use this ONLY to detect DRY violations (Condition 4)“. Selbst ein passender Treffer dürfte keinen Befund „Spalte existiert nicht“ begründen.
5. **Nur Signaturen.** Der Index speichert Skelette, keine Rümpfe. Für Aufrufer oder Routing reicht das nicht.

### 2.3 Live-Zahlen (Supabase-MCP, 2026-10-05)

| Repo | Status | Chunks gesamt | aktiv | Dateien | letzter Sync | `detected_ecosystems` |
|---|---|---|---|---|---|---|
| `unslopai/unslop` | deactivated | 974 | 0 | 253 | 2026-09-26 | nextjs, react, typescript, nodejs |
| `lucazell/AEL-frontend` | active | 59 | 59 | 27 | 2026-05-31 | react, typescript, nodejs |
| `unslopai/test` | active | **0** | 0 | 0 | nie | react, typescript, nodejs |

- 974 Chunks für `unslopai/unslop` sind 138 481 Zeichen Inhalt aus 253 Dateien, also im Mittel 142 Zeichen je Chunk.
- `unslopai/test` trägt 204 der 212 Jobs, die einem Repo zugeordnet sind (135 Webhook, 53 CLI, 16 MCP). Sein `main` hat 5 Dateien, davon 2 JS/TS. Alle Studien-Jobs liefen dort mit 0 Evidence-Chunks. Dass die Studien-Branches (`av/*`) nie indexiert wurden, folgt aus Punkt 2 oben.
- Weitere 333 Jobs haben keine Repo-Zuordnung (315 `manual`, 13 `webhook`, 4 `cli`, 1 `mcp`) und damit keinen Evidence-Pfad.
- **Trefferquote der Evidence-Search: blocked: tooling.** Die Zahl der Evidence-Chunks steht nur im Log (`[RagLoader] … Evidence-Chunks`), nicht in `review_jobs` und nicht in `review_job_llm_calls`. Die Vercel-Runtime-Logs reichen auf Hobby eine Stunde zurück; die Abfrage über 7 Tage lieferte deshalb nichts. Das ist kein Befund über das Produkt.
- Ersatzweise ein schwacher Indikator aus der DB: Die RAG-Variante des Prompts erzwingt im Befundtext die Zeile „Evidence: According to …“. Sie kommt in **2 von 264** Jobs mit gespeichertem Ergebnis vor, beide am 2026-09-26 auf `unslopai/unslop` (Jobs `83f211d3`, `c25b2be6`). Der Indikator sieht nur Jobs mit Befunden, die Zahl ist also eine Untergrenze. Obergrenze nach Lage der Chunks: 8 Webhook-Jobs auf `unslopai/unslop` am 2026-09-26 plus Jobs auf `AEL-frontend`, zu dem `review_jobs` keinen zugeordneten Job mehr enthält.
- Neues To-Do daraus: Die Zahl der Evidence-Chunks und später die Größe des Kontextpakets gehören ins Job-Ergebnis, sonst bleibt jede Auswertung an der Log-Aufbewahrung hängen (§12, ROADMAP).

### 2.4 Lauf der Draft- und Verifier-Calls seit dem 2026-09-17 (`review_job_llm_calls`)

| Phase | Modell | Calls | Prompt-Tokens (Mittel) | davon Cache | Output-Tokens | Latenz Mittel | Latenz p90 |
|---|---|---|---|---|---|---|---|
| draft | `gemini-3.8-flash` | 422 | 11 442 | 4 920 | 4 337 | 41,8 s | 83,7 s |
| verify | `gemini-3.6-flash` | 179 | 7 717 | 5 134 | 2 503 | 13,8 s | 23,4 s |
| escalate_full | `gemini-3.8-flash` | 17 | 24 304 | 5 018 | 7 887 | 53,8 s | 75,8 s |

Diese Werte sind die Basis für die Kosten- und Latenzrechnung in §6.

## 3. Fehlerklassen aus der Studie (die Messlatte)

Grundlage: `fixtures/added-value/results/findings.json`, Gruppen mit mindestens einem Befund `verdict=echt` und `relevance=blockierend`, in denen kein echter unslop-Befund liegt. Das sind 41 Gruppen: 4 in Segment A, 37 in Segment B. Die Zahl deckt sich mit §9.3 der Studie.

Klassen:
- **D, im Diff sichtbar:** Die geänderten Zeilen reichen, um den Fehler zu begründen.
- **R, braucht eine Datei des Repos.** Art: *Manifest* (`package.json`, `go.mod`, `requirements.txt`), *Schema* (`db/schema.sql`, Migrationen; hierzu zählt auch „Zustand im Speicher, obwohl das Schema die Tabelle hat“), *Routing* (Einstiegspunkt, Einbindung), *ganze Datei* (Code der geänderten Datei außerhalb der Hunks), *Aufrufer* (wie anderer Code das geänderte Symbol benutzt), *Config*, *importierte Datei*.
- **L, braucht Laufzeitwissen:** Der Fehler steht im Diff, aber nur wer das Verhalten der Laufzeit oder einer Version kennt, erkennt ihn.

Jeder Befund hat genau eine Hauptklasse. Wo eine zweite Quelle hilft, steht sie in der letzten Spalte.

| # | PR, Gruppe | Befund in einem Satz | Klasse | Art / zweite Quelle |
|---|---|---|---|---|
| 1 | a-pr15 G12 | Bestätigter GATE-001-Befund mit niedriger Konfidenz wird nach übersprungener Eskalation zur WARNING | R | ganze Datei (`integrity-scorer-step.ts`: `resolveDowngradeReason`, `decorateIssue` außerhalb der Hunks) |
| 2 | a-pr9 G4 | Config-Befund ankert auf einer unveränderten Zeile und fällt durch den Added-Lines-Filter | R | Aufrufer (`filterToAddedLines` in `packages/prescan/src/index.ts`, Definition außerhalb der Hunks) |
| 3 | a-pr9 G8 | Poetry-Pfad-, Git- und URL-Abhängigkeiten werden auf PyPI nachgeschlagen | D | |
| 4 | a-pr9 G13 | `aws_iam_policy.policy` wird gegen eine leere Map aufgelöst | D | |
| 5 | b-gem-t01 G1 | `app.run(debug=True)` | D | |
| 6 | b-gem-t01 G5 | Kein `MAX_CONTENT_LENGTH`, Platte läuft voll | D | |
| 7 | b-gem-t01 G7 | Upload überschreibt gleichnamige Datei | D | |
| 8 | b-gem-t02 G3 | Eigene Express-App auf Port 3000 statt Route auf `server.js` | R | Routing (`services/auth/server.js`, `main` in `package.json`) |
| 9 | b-gem-t02 G9 | Standard-Admin `admin` / `password123` bei jedem Start, Passwort im Log | D | |
| 10 | b-gem-t02 G10 | Jeder Login bekommt `role: 'admin'` | D | |
| 11 | b-gem-t03 G7 | Schreibt in `contact_submissions`, das Schema hat `contact_messages` | R | Schema |
| 12 | b-gem-t05 G7 | `DOMPurify.sanitize` beim Server-Rendern ohne DOM | L | Manifest zeigt Next App Router |
| 13 | b-gem-t05 G8 | `dompurify` fehlt in `web/package.json` | R | Manifest |
| 14 | b-gem-t06 G6 | Query liest `description`, `price`, `stock`; `products` hat `id`, `name`, `price_cents` | R | Schema |
| 15 | b-gem-t07 G1 | Jeder String wird implizit ausgewertet | D | |
| 16 | b-gem-t07 G3 | `ast.Num` ist in Python 3.14 entfernt | L | |
| 17 | b-gem-t08 G7 | Fallback-Secret `whsec_your_webhook_secret_here` | D | |
| 18 | b-gem-t09 G2 | SSRF: beliebige URL wird serverseitig abgerufen | D | |
| 19 | b-gem-t09 G5 | Importiert `fastapi`, `httpx`, `uvicorn`; `requirements.txt` hat `flask`, `requests` | R | Manifest |
| 20 | b-gem-t10 G8 | Reset-Tokens in einer Map im Speicher statt in `users.reset_token` | R | Schema; Config (`web/lib/db.ts`) |
| 21 | b-qwen-t01 G1 | Upload ohne Authentifizierung und CSRF-Schutz | D | |
| 22 | b-qwen-t01 G3 | Pfad-Traversal über den Dateinamen | D | |
| 23 | b-qwen-t02 G1 | Fehler aus `bcrypt.compare` wird im Callback neu geworfen, Prozess stürzt ab | D | |
| 24 | b-qwen-t02 G2 | `require('bcryptjs')`, deklariert ist `bcrypt` | R | Manifest |
| 25 | b-qwen-t02 G6 | Fest verdrahteter Admin im Speicher statt der Tabelle `users` | R | Schema |
| 26 | b-qwen-t03 G4 | INSERT in `contact`, das Schema hat `contact_messages` | R | Schema |
| 27 | b-qwen-t03 G5 | `@vercel/postgres` fehlt in `web/package.json` | R | Manifest; Config (`DATABASE_URL` in `web/lib/db.ts`) |
| 28 | b-qwen-t05 G3 | Datei exportiert nichts | D | |
| 29 | b-qwen-t05 G5 | `ReactDOM.render` mit React 19 | R | Manifest (Version) |
| 30 | b-qwen-t05 G6 | DOM-Mount auf oberster Ebene in einem Next-App-Router-Projekt | L | Manifest zeigt Next |
| 31 | b-qwen-t06 G2 | Lokale SQLite-Datei statt der gemeinsamen Postgres-Datenbank | R | Schema; Config (`web/lib/db.ts`), Manifest (`go.mod` mit `lib/pq`) |
| 32 | b-qwen-t06 G9 | `go-sqlite3` fehlt in `go.mod` | R | Manifest |
| 33 | b-qwen-t06 G10 | Spalte `price` statt `price_cents` | R | Schema |
| 34 | b-qwen-t07 G2 | Regex ohne rechten Operanden zerstört Werte | D | |
| 35 | b-qwen-t07 G8 | `split(': ', 1)` ohne Prüfung, `ValueError` | D | |
| 36 | b-qwen-t08 G2 | `bodyParser.json()` vor `express.raw`, Signaturprüfung scheitert immer | D | |
| 37 | b-qwen-t08 G3 | Bezahlte Bestellungen in einem Objekt im Speicher statt in `orders` | R | Schema |
| 38 | b-qwen-t08 G8 | Bestellungen nach `paymentIntent.customer` verschlüsselt | D | Schema (`payment_intent_id`) |
| 39 | b-qwen-t09 G3 | SSRF | D | |
| 40 | b-qwen-t10 G5 | Reset-Tokens nur im Prozessspeicher | R | Schema; Config (`web/lib/db.ts`) |
| 41 | b-qwen-t10 G7 | Reset-Link zeigt auf `http://example.com` | D | |

**Auszählung:**

| Klasse | Segment A | Segment B | gesamt |
|---|---|---|---|
| D, im Diff sichtbar | 2 | 18 | **20** |
| R, braucht eine Datei des Repos | 2 | 16 | **18** |
| davon Schema | 0 | 9 | 9 |
| davon Manifest | 0 | 6 | 6 |
| davon Routing | 0 | 1 | 1 |
| davon ganze Datei | 1 | 0 | 1 |
| davon Aufrufer | 1 | 0 | 1 |
| L, braucht Laufzeitwissen | 0 | 3 | **3** |
| Summe | 4 | 37 | 41 |

Lesehilfe: 44 % der Befunde brauchen eine Repo-Datei, 49 % stehen im Diff, 7 % brauchen Laufzeitwissen. Die Aussage des Koordinators („etwa die Hälfte ist im Diff nicht sichtbar“) trifft zu. Wichtig für die Wahl der Lösung: 15 der 18 Repo-Befunde hängen an zwei Dateiarten (Schema, Manifest), die sich ohne Index und ohne Modell finden lassen. Die 20 Diff-Befunde teilen sich in 10 klassische Sicherheitsfehler (Nr. 5, 6, 9, 10, 17, 18, 21, 22, 39, 41) und 10 Logikfehler (Nr. 3, 4, 7, 15, 23, 28, 34, 35, 36, 38).

Grenzen der Tabelle: Segment B ist ein kleines Skelett-Repo mit genau einem Schema und je einem Manifest je Dienst. Echte Repos haben mehr Kandidaten je Dateiart; die Trefferquote der Auswahlregeln ist dort ungemessen. Segment A hat nur zwei Repo-Befunde, beide in der Art, die die Regeln am schwersten trifft.

## 4. Wie andere das lösen

Alle Angaben stammen aus öffentlichen Seiten, abgerufen am 2026-10-05. „(Snippet)“ heißt: Die Seite selbst ließ sich nicht laden, die Angabe stammt aus dem Suchtreffer. „Nicht belegt“ heißt: keine Quelle gefunden. Die Seiteninhalte wurden über eine Zusammenfassung gelesen; wörtliche Zitate vor einer Weiterverwendung an der Quelle prüfen.

| Produkt | Wie der Kontext entsteht | Kosten | Latenz | Datenhaltung |
|---|---|---|---|---|
| **Claude Code** (`/code-review`, verwaltetes „Code Review“, GitHub Action) | Agentisch: mehrere Agenten lesen Diff und umliegenden Code über die Leserechte der GitHub App, danach ein Verifikationsschritt, Deduplizierung und Ranking. `CLAUDE.md` und `REVIEW.md` steuern. Ein Index wird in der Doku nicht erwähnt; die Aussage „kein Index, nur Grep/Glob/Read“ ist offiziell nicht belegt. Die Action arbeitet auf einem Checkout im Runner. [Doku](https://code.claude.com/docs/en/code-review), [Action](https://code.claude.com/docs/en/github-actions) | Verwaltetes Produkt: nach Token, laut Doku im Schnitt 15 bis 25 USD je Review. Eigene Messung lokal (Studie §9.3): 1,35 bis 3,58 USD Listenpreis je PR. | Verwaltetes Produkt: laut Doku im Schnitt 20 Minuten. Eigene Messung lokal: 89 bis 252 s je PR. | Nicht verfügbar für Organisationen mit Zero Data Retention; Speicherdauer nicht belegt. |
| **GitHub Copilot Code Review** | Seit 2025-10-28 „agentic tool calling“, das Code, Verzeichnisstruktur und Referenzen selbst holt; läuft auf Actions-Runnern. [Changelog](https://github.blog/changelog/2025-10-28-new-public-preview-features-in-copilot-code-review-ai-reviews-that-see-the-full-picture/), [Doku](https://docs.github.com/en/copilot/concepts/agents/code-review) | AI Credits je Review, laut Doku 0,05 bis 1 USD („Lite“) und 0,25 bis 5 USD („Balanced“), abhängig von der PR-Größe | Absolute Dauer nicht belegt | Fristen speziell für die Review nicht belegt |
| **CodeRabbit** | Je PR ein Klon in einer kurzlebigen Sandbox, ein frisch gebauter Code-Graph über Dateien und Repos, dazu Issues, frühere PRs, „Learnings“ und über 40 Linter und SAST-Werkzeuge; eine Verifikationsschicht vor dem Posten. [Blog 1](https://www.coderabbit.ai/blog/explainable-reviews-coderabbit-review-context-engine), [Blog 2](https://www.coderabbit.ai/blog/coderabbit-review-reads-a-pr-how-author-would-explain-it). Vektor-Store LanceDB: [Fallstudie](https://www.lancedb.com/blog/case-study-coderabbit) (Snippet). | 24, 48 oder 72 USD je Entwickler und Monat ([Preise](https://www.coderabbit.ai/pricing)); Token-Zahlen nicht belegt | Nicht belegt | Laut [FAQ](https://docs.coderabbit.ai/faq) ein Cache verschlüsselter Code- und Dependency-Archive und Vektor-Repräsentationen; „zero data retention“ im Blog bezieht sich auf die Sandbox |
| **Greptile** | Dauerhafter Code-Graph über Funktionen, Klassen, Dateien und Verzeichnisse, dazu Embeddings über Pfade, Doku und KI-erzeugte Docstrings; seit v5 ein Schwarm von Agenten, die je eine Hypothese prüfen. [v2](https://www.greptile.com/blog/greptile-2), [v5](https://www.greptile.com/blog/greptile-v5), [Suche](https://www.greptile.com/blog/semantic-codebase-search). Wie der Index bei Pushes aktualisiert wird: nicht belegt. | 30 USD je Platz und Monat mit 50 Credits; eine Review kostet 1, 3 oder 10 Credits ([Preise](https://www.greptile.com/pricing)) | Median laut v5-Beitrag von 5:04 auf 2:25 gesunken | Code liegt verschlüsselt und bleibt gecacht, bis der Zugriff entzogen wird; Self-Hosting möglich ([Security](https://www.greptile.com/security)) |
| **Graphite Agent** (vormals Diamond) | An das Modell gehen PR-Metadaten, geänderter Code, ähnliche PRs und ähnliche Teile der Codebase; der Mechanismus ist nicht belegt. „Code Indexing“ ist ein eigenes Opt-in, standardmäßig aus. [Privacy](https://graphite.com/docs/ai-privacy-and-security), [Indexing](https://graphite.com/docs/code-indexing-security) | Hobby kostenlos, 20 und 40 USD je Platz ([Blog](https://graphite.com/blog/introducing-graphite-agent-and-pricing)) | Nicht belegt | Ohne Index kein Speichern; Indexdaten werden binnen 30 Tagen nach dem Abschalten gelöscht |
| **Qodo** (PR-Agent, Context Engine) | Heuristik im Open-Source-Kern: Patch-Kontext wird erweitert, große PRs werden nach Sprache und Token-Zahl sortiert und gekürzt ([Compression](https://github.com/qodo-ai/pr-agent/blob/main/docs/docs/core-abilities/compression_strategy.md)). Dazu optional RAG über die ganze Codebase mit statischer Analyse fürs Chunking ([Blog](https://www.qodo.ai/blog/custom-rag-pipeline-for-context-powered-code-reviews/), Snippet) und eine Multi-Repo-Engine ([Doku](https://docs.qodo.ai/core-concepts/context-engine)). | Nicht belegt | Nicht belegt | Nicht belegt |
| **Sourcegraph Cody** | Hat 2024 Embeddings durch die Code-Suche ersetzt (angepasstes BM25 plus Signale). Gründe laut Beitrag: Code musste an einen Dritten, Pflegeaufwand, schlechte Skalierung über 100 000 Repos. [Blog](https://sourcegraph.com/blog/how-cody-understands-your-codebase). Als PR-Review-Produkt nicht belegt. | Nicht belegt | Nicht belegt | Nicht belegt |
| **Cursor Bugbot** | Anfangs feste Pipeline: acht parallele Durchläufe mit zufälliger Diff-Reihenfolge und Mehrheitsvotum. Seit Herbst 2025 agentisch: Das Modell liest den Diff, ruft Werkzeuge und entscheidet selbst, wo es nachgräbt. [Blog](https://cursor.com/blog/building-bugbot), [Doku](https://cursor.com/docs/bugbot) | Nach Verbrauch; Beträge nicht belegt | Nicht belegt | „Same privacy compliance as Cursor“; Fristen nicht belegt |

Was sich daraus ableiten lässt:

1. **Die Richtung geht zum agentischen Lesen.** Copilot, Bugbot, Greptile v5, CodeRabbit und Claude Code lassen das Modell Dateien holen. Die Anbieter mit Index (Greptile, CodeRabbit, Qodo) speichern dafür Kundencode dauerhaft; Graphite macht den Index deshalb zum Opt-in, Cody hat die Embeddings wegen genau dieser Punkte abgeschafft.
2. **Offene Fehlersuche kommt überall mit einer zweiten Stufe**, die Befunde vor dem Posten prüft: Verifikation bei Claude Code und CodeRabbit, früher Mehrheitsvotum bei Bugbot, Konfidenzschwelle bei `/security-review` (dort in der Studie mit dem Preis, dass echte Secrets „unter der Schwelle“ blieben, §9.4).
3. **Die agentischen Produkte kosten je Review ein bis drei Größenordnungen mehr als unslop heute** (0,02 bis 0,05 USD je PR in der Studie, mit Intro-Rabatt) und brauchen eine Laufzeit, die ein Runner oder eine Sandbox trägt. unslop läuft in einer Vercel-Funktion mit 300 s.
4. **Bugbot berichtet, dass sich mit dem agentischen Design das Prompting umkehrte**: weg vom Zurückhalten, hin zum aggressiven Nachforschen, bei steigender Auflösungsrate (laut Beitrag von 52 % auf über 70 %). Das stützt §7, ist aber eine Herstellerangabe auf einem Frontier-Modell.

Forschung (je ein Satz, Ergebnis nur soweit die Zusammenfassung trägt):
- [AACR-Bench](https://arxiv.org/abs/2601.19494) (2026): Granularität des Kontexts und Art des Retrievals verändern die Review-Leistung deutlich, abhängig von Sprache und Modell.
- [Towards Practical Defect-Focused Automated Code Review](https://arxiv.org/abs/2505.17928) (ICML 2025): Code-Slicing für den Kontext plus Filter gegen Fehlalarme verdoppelt die Leistung gegenüber einem einfachen LLM-Aufruf auf echten Merge Requests (C++).
- [CodeFuse-CR-Bench](https://arxiv.org/abs/2509.14856) (2025, Snippet): Ein starkes Modell erreicht mit einer einzigen per BM25 gewählten Datei fast den Wert mit ideal gewähltem Kontext.
- [Benchmarking LLMs for Fine-Grained Code Review with Enriched Context](https://arxiv.org/abs/2511.07017) (2025, Snippet): Textkontext wie Issue und PR-Beschreibung half dort mehr als umliegender Code.

Gemini Function Calling zusammen mit dem Explicit Cache (für Option B): Laut [Gemini-API-Referenz](https://ai.google.dev/api/caching) trägt `CachedContent` die Felder `tools`, `toolConfig` und `systemInstruction`. Laut [Firebase-Doku](https://firebase.google.com/docs/ai-logic/context-caching) müssen Tools und System Instruction im Cache liegen und dürfen nicht zusätzlich im Request stehen. Das deckt sich mit dem eigenen Befund F1 in `PROMPT_CACHING_SPEC.md` (ein Request mit `cachedContent` darf keine `systemInstruction` tragen). Die Vertex-Doku selbst ließ sich nicht laden: für Vertex nicht direkt belegt. Parallele Function Calls werden unterstützt ([Doku](https://ai.google.dev/gemini-api/docs/function-calling)); eine Obergrenze je Turn ist nicht belegt.

## 5. Optionen für unslop

### 5.1 Option A: deterministisches Kontextpaket je PR

Ein neuer Schritt vor dem Draft baut aus dem Stand des PR-Heads ein Paket, ausgewählt nach festen Regeln, ohne Index und ohne Modell:

| Regel | Inhalt | Deckt Art |
|---|---|---|
| A1 Manifeste | Das nächste Manifest aufwärts von jeder geänderten Datei (`package.json`, `go.mod`, `requirements.txt`, `pyproject.toml`, später `pom.xml`, `Cargo.toml`, Terraform-`required_providers`), reduziert auf Name, Einstiegspunkt, Skripte und Abhängigkeiten mit Version | Manifest; hilft bei L |
| A2 Schema | Dateien, die auf ein Schema-Muster passen (`schema.sql`, `schema.prisma`, `migrations/*.sql`, `supabase/migrations/*.sql`), reduziert auf `create table` und `alter table` mit Spalten; bei vielen Migrationen nur die Tabellen, deren Name im Diff vorkommt | Schema |
| A3 Einstiegspunkt | Die Datei aus `main` oder dem Start-Skript des Manifests, bei Next die Routen-Struktur als Pfadliste | Routing |
| A4 Ganze geänderte Datei | Für geänderte (nicht neue) Dateien die umschließenden Funktionen der Hunks, bis zu einem Budget je Datei; kleine Dateien ganz | ganze Datei |
| A5 Importe | Dateien, die der Diff über relative Importe einbindet, reduziert auf exportierte Signaturen | importierte Datei, Config |
| A6 Nachbarn | Dateien im Verzeichnis der geänderten Datei, als Pfadliste; Inhalt nur, wenn klein | Routing, Config |
| A7 Dateibaum | Pfadliste des Repos, gekürzt auf die Verzeichnisse der geänderten Dateien und zwei Ebenen darüber | Routing |

- **Budget:** Das Paket hat eine feste Obergrenze. Vorschlag: 8 000 Tokens je Draft-Call, vergeben in der Reihenfolge A1, A2, A4, A3, A5, A6, A7. Was nicht passt, wird ganz weggelassen und im Ergebnis genannt, nie mitten in einer Datei abgeschnitten (wie bei den Reference Practices).
- **Draft-Batching:** Bei mehreren Batches (`LARGE_DIFF_RECALL_SPEC.md`) bekommt jeder Batch das Paket für seine Dateien, nicht das Paket des ganzen PRs.
- **Aufrufer geänderter Symbole** (die siebte Art aus dem Auftrag) lässt sich ohne Index nur über eine Suche lösen. GitHubs Code-Suche durchsucht nur den Default-Branch und ist auf 10 Anfragen je Minute begrenzt; im CLI- und MCP-Pfad ginge `git grep` lokal. Empfehlung: Aufrufer in Stufe 1 nur im CLI- und MCP-Pfad und nur als Pfadliste mit Trefferzeile; im App-Pfad erst mit Option B.
- **Wo das Paket im Prompt steht:** im dynamischen Teil hinter dem Cache-Prefix, als Daten gekennzeichnet (§6.3).
- **Dazu gehört zwingend eine Regel, die Befunde gegen das Paket erlaubt** (§7.1). Die Probe zeigt, dass das Paket ohne sie fast nichts bewirkt (§8).

Deckt aus §3: Schema 9, Manifest 6, Routing 1, ganze Datei 1, also strukturell 17 von 18. Der Aufrufer-Befund (Nr. 2) nur, wenn Definition und Aufruf im selben Batch landen. Bei den 3 Laufzeit-Befunden liefert das Manifest in 2 Fällen den entscheidenden Hinweis (Next App Router). Die 20 Diff-Befunde deckt Option A nicht.

### 5.2 Option B: Tool-Use

Das Modell bekommt Funktionen (`list_directory`, `read_file` mit Zeilenbereich, `search_code`) und fordert selbst an, was es braucht. Der Server führt sie gegen die GitHub-API (App) oder gegen das mitgelieferte Paket (CLI, MCP) aus.

- Deckt alle 18 Repo-Befunde, sofern das Modell die richtige Datei öffnet, und als einzige Option auch das, was keine Regel vorhersieht.
- Jede Runde ist ein voller Modell-Call mit eigener Thinking-Phase. Der Draft hat heute im Mittel 41,8 s und p90 83,7 s für einen einzigen Call (§2.4).
- Die Tool-Deklarationen müssen in den Explicit Cache (§4, Ende). Draft und Eskalation teilen heute einen Cache-Key; der Verifier bräuchte einen Cache ohne Tools oder dieselben Tools.
- Braucht eine Begrenzung: Rundenzahl, Token-Budget, Deadline je Runde, Abbruch mit dem bis dahin Gefundenen.
- Die Befunde hängen dann davon ab, welche Dateien das Modell gewählt hat. Bei Temperatur 0 ist das in der Praxis stabil, aber nicht zugesichert; die Reproduzierbarkeit („gleicher Diff, gleiches Urteil“, `models.ts`) wird schwächer.

### 5.3 Option C: Repo-Index als Ausbau des RAG

Den bestehenden Index auf alle Sprachen, ganze Symbole mit Rümpfen und einen Aufruf-Graphen erweitern und bei jedem Push aktualisieren.

- Deckt gut: Aufrufer, importierte Symbole, DRY. Das sind 1 bis 2 der 41 Befunde. Schema und Manifest brauchen keinen Index.
- Braucht ein neues Event (`push`), also eine geänderte App-Konfiguration, die jede Installation neu bestätigen muss, und einen Ingest je Push. Der Ingest läuft heute im `after()` einer Vercel-Funktion in Stapeln von 15 Dateien; ein Voll-Index eines mittleren Repos passt nicht sicher in 300 s.
- Der PR-Head ist nie im Index. Für neue Dateien im PR (alle 20 PRs in Segment B) hilft der Index nur für das, was schon auf `main` liegt.
- Speichert Kundencode dauerhaft und mit Rümpfen. Das widerspricht der heutigen Aussage der Landing („built from signatures, interfaces and type definitions rather than implementation logic“) und vergrößert AVV und Löschpflichten.

### 5.4 Option D: Kombination

A als Grundlage auf allen Oberflächen, die offene Suche im Diff als zweite Stufe (§7.2), B später und begrenzt für das, was A nachweislich nicht trifft. C wird nicht gebaut. Das ist die Empfehlung (§9).

## 6. Bewertung der Optionen

### 6.1 Abdeckung, Kosten, Latenz

Preise aus `scripts/lib/vertex-pricing.ts`: `gemini-3.8-flash` Listenpreis 1,65 USD je Million Input-Tokens, 0,165 aus dem Cache, 8,25 Output; bis 2026-12-31 gilt die Hälfte. Als Frontier-Referenz dient `gemini-3.1-pro-preview` mit 2,00 und 12,00 USD (das einzige Frontier-Modell mit belegtem Preis im Repo; für Gemini 4 Argon gibt es keinen öffentlichen Preis). Alle Beträge unten sind Listenpreise.

| | A Kontextpaket | B Tool-Use | C Index |
|---|---|---|---|
| Repo-Befunde aus §3 (18) | 17 strukturell | 18, wenn das Modell die Datei öffnet | 1 bis 2 |
| Diff-Befunde (20) | 0 | 0 (dieselbe Prompt-Frage wie bei A) | 0 |
| Zusätzliche Tokens je Draft | Probe: 380 bis 684 Input. Obergrenze: 8 000 Input, rund 500 Output | Rechnung für 4 Runden mit je 2 Dateien: rund 36 000 Input (davon 19 000 aus dem Cache), 8 000 Output | wie heute, plus Embedding je Push |
| Mehrkosten Draft, Flash | Probe: 0,005 USD (0,003 mit Intro-Rabatt). Obergrenze: 8 000 × 1,65 + 500 × 8,25 = 0,017 USD | rund 0,10 USD (0,028 Input, 0,003 Cache, 0,066 Output) | nicht gemessen |
| Mehrkosten Draft, Frontier-Referenz | Obergrenze: 8 000 × 2,00 + 500 × 12,00 = 0,022 USD | rund 0,17 USD (36 000 × 2,00 + 8 000 × 12,00, ohne Cache auf `global`) | nicht gemessen |
| Verifier | Braucht denselben Ausschnitt für Kontext-Befunde: bis 0,013 USD | wie A | wie heute |
| Summe je PR gegenüber heute (Studie: 0,02 bis 0,05 USD mit Intro-Rabatt, 0,04 bis 0,10 Liste) | plus 0,005 bis 0,03 USD | plus 0,10 bis 0,20 USD | plus Ingest je Push |
| Zusätzliche Latenz | 1 bis 2 s für Tree und bis zu 15 parallele Dateiabrufe; Draft in der Probe 16,6 bis 32,7 s gegenüber 11,8 bis 23,9 s ohne Paket | 3 bis 5 Calls nacheinander: bei 15 bis 40 s je Runde 60 bis 160 s nur für den Draft | keine im Job, aber Ingest je Push |
| Gegen das Job-Budget (LLM-Calls enden bei 270 s, `DEADLINE_GUARD_SPEC.md` D2) | Passt. Der Paket-Schritt bekommt ein eigenes Limit von 10 s. | Eng: Draft p90 liegt schon heute bei 83,7 s für einen Call. Geht nur mit Rundendeckel 2 und Deadline je Runde, oder auf Vercel Pro. | Job unberührt; Ingest stößt an die 300 s |
| Aufwand | mittel: ein Schritt, eine Regeldatei in `packages/shared`, Prompt-Abschnitt, eine Regel, Upload-Feld in CLI und MCP | hoch: Tool-Schleife, Cache-Umbau, Budget- und Deadline-Logik, neue Degradationen | hoch: Parser je Sprache, Graph, Push-Pfad, Migrationen, Löschpfad |

Zwei Messwerte aus der Probe gehören zur Latenz dazu: Ein Call mit Paket brauchte 128,9 s und 18 842 Output-Tokens bei gleichem Prompt-Umfang. Das ist die bekannte Streuung der Thinking-Tokens (ROADMAP-Chronik 2026-10-03, „Go-Draft-Latenz erklärt“), kein Effekt des Pakets, aber sie zeigt, dass jede zusätzliche Runde in Option B dieses Risiko vervielfacht.

### 6.1a Nachtrag 2026-10-05: gemessene Paketgröße und Mehrkosten auf allen 40 Studien-PRs

Auflage aus §12: gemessen statt geschätzt, vor dem Merge. Gebaut wurde das Paket mit den Auswahlregeln aus `packages/shared/src/repo-context.ts` für jeden der 40 Replay-Branches (`av/*` auf `unslopai/test`, Liste in `fixtures/added-value/results/runs.json`), **ohne Modell-Call**: Diff wie im Diff-Loader (Filter `isReviewableFile`, Größen-Cap, Secret-Redaktion), Leser über `git show` am Head des Branches, höchstens 15 Datei-Abrufe wie im App-Pfad, Obergrenze 8 000 Tokens.

- **Tokens** sind die Schätzung Zeichen / 4, mit der Budget, Ergebnis und Telemetrie rechnen; die Zählung des Anbieters weicht davon ab (ungemessen).
- **Mehrkosten** sind nur die Input-Tokens des Pakets: im Draft je Call (bei Datei-Batches die Sicht jedes Batches auf seine Dateien, Spalte „Draft-Calls“) zum Preis von `gemini-3.8-flash`, dazu im Verifier der schlimmste Fall, dass jeder Manifest-, Schema- und Einstiegspunkt-Abschnitt einmal zitiert wird, zum Preis von `gemini-3.6-flash`. Preise aus `scripts/lib/vertex-pricing.ts` (`fetchVertexPricing`): 0,825 USD je Million Input-Tokens mit Intro-Rabatt für beide Modelle, Listenpreis das Doppelte (Rabatt 50 % bis 2026-12-31). Das Paket steht im dynamischen Teil und bekommt keinen Cache-Rabatt.
- **Nicht enthalten:** Output-Tokens für zusätzliche Befunde und zusätzliches Nachdenken. Die stehen nur in der Probe mit Modell (§8.1).

| PR | Dateien im Modell-Diff | Diff-Tokens | Paket ohne Deckel | Paket bei 8 000 | Bytes | Draft-Calls | Paket-Tokens Draft | Verifier (max.) | Auslassungen | Mehrkosten Liste (USD) | mit Rabatt (USD) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a-pr45 (#55) | 8 | 2 974 | 4 596 | 4 596 | 18 459 | 1 | 4 596 | 136 | 2 | 0,0078 | 0,0039 |
| a-pr31 (#56) | 1 | 1 941 | 1 117 | 1 117 | 4 473 | 1 | 1 117 | 136 | 0 | 0,0021 | 0,0010 |
| a-pr23 (#57) | 1 | 1 024 | 181 | 181 | 722 | 1 | 181 | 136 | 0 | 0,0005 | 0,0003 |
| a-pr14 (#58) | 4 | 3 126 | 2 052 | 2 052 | 8 256 | 1 | 2 052 | 136 | 1 | 0,0036 | 0,0018 |
| a-pr44 (#59) | 10 | 5 117 | 12 413 | 6 470 | 26 017 | 1 | 6 470 | 275 | 4 | 0,0111 | 0,0056 |
| a-pr30 (#60) | 7 | 6 441 | 5 300 | 5 300 | 21 234 | 1 | 5 300 | 238 | 1 | 0,0091 | 0,0046 |
| a-pr12 (#61) | 11 | 6 040 | 9 585 | 7 352 | 29 499 | 1 | 7 352 | 136 | 2 | 0,0124 | 0,0062 |
| a-pr43 (#62) | 17 | 9 229 | 8 182 | 7 530 | 30 213 | 1 | 7 530 | 691 | 8 | 0,0136 | 0,0068 |
| a-pr15 (#63) | 10 | 8 147 | 7 582 | 7 484 | 30 057 | 1 | 7 484 | 136 | 1 | 0,0126 | 0,0063 |
| a-pr39 (#64) | 22 | 17 530 | 14 670 | 7 549 | 30 307 | 1 | 7 549 | 409 | 15 | 0,0131 | 0,0066 |
| a-pr11 (#65) | 1 | 699 | 241 | 241 | 961 | 1 | 241 | 136 | 0 | 0,0006 | 0,0003 |
| a-pr26 (#66) | 29 | 21 433 | 8 490 | 7 390 | 29 717 | 2 | 7 742 | 316 | 17 | 0,0133 | 0,0066 |
| a-pr34 (#67) | 21 | 17 696 | 10 754 | 7 458 | 29 865 | 1 | 7 458 | 136 | 3 | 0,0125 | 0,0063 |
| a-pr42 (#68) | 30 | 21 158 | 9 410 | 7 585 | 30 413 | 2 | 8 191 | 802 | 15 | 0,0148 | 0,0074 |
| a-pr9 (#69) | 31 | 36 323 | 7 024 | 7 024 | 28 187 | 2 | 7 988 | 348 | 7 | 0,0138 | 0,0069 |
| a-pr10 (#70) | 65 | 42 601 | 6 751 | 6 751 | 27 093 | 3 | 9 395 | 698 | 46 | 0,0167 | 0,0083 |
| a-pr37 (#71) | 20 | 20 952 | 15 860 | 7 359 | 29 517 | 2 | 7 640 | 238 | 10 | 0,0130 | 0,0065 |
| a-pr38 (#72) | 37 | 22 211 | 10 053 | 6 851 | 27 488 | 2 | 7 808 | 691 | 26 | 0,0140 | 0,0070 |
| a-pr40 (#73) | 36 | 23 250 | 8 114 | 7 539 | 30 265 | 2 | 7 897 | 691 | 25 | 0,0142 | 0,0071 |
| a-pr18 (#74) | 17 | 10 501 | 5 386 | 5 386 | 21 566 | 1 | 5 386 | 617 | 0 | 0,0099 | 0,0050 |
| b-gem-t01 (#75) | 1 | 625 | 351 | 351 | 1 401 | 1 | 351 | 292 | 0 | 0,0011 | 0,0005 |
| b-gem-t02 (#76) | 1 | 779 | 478 | 478 | 1 911 | 1 | 478 | 415 | 0 | 0,0015 | 0,0007 |
| b-gem-t03 (#77) | 1 | 551 | 446 | 446 | 1 781 | 1 | 446 | 412 | 0 | 0,0014 | 0,0007 |
| b-gem-t04 (#78) | 1 | 567 | 323 | 323 | 1 289 | 1 | 323 | 290 | 0 | 0,0010 | 0,0005 |
| b-gem-t05 (#79) | 1 | 388 | 452 | 452 | 1 808 | 1 | 452 | 404 | 0 | 0,0014 | 0,0007 |
| b-gem-t06 (#80) | 1 | 859 | 366 | 366 | 1 462 | 1 | 366 | 309 | 0 | 0,0011 | 0,0006 |
| b-gem-t07 (#81) | 1 | 940 | 324 | 324 | 1 295 | 1 | 324 | 290 | 0 | 0,0010 | 0,0005 |
| b-gem-t08 (#82) | 1 | 781 | 388 | 388 | 1 551 | 1 | 388 | 328 | 0 | 0,0012 | 0,0006 |
| b-gem-t09 (#83) | 1 | 479 | 357 | 357 | 1 425 | 1 | 357 | 296 | 0 | 0,0011 | 0,0005 |
| b-gem-t10 (#84) | 1 | 1 580 | 450 | 450 | 1 800 | 1 | 450 | 404 | 0 | 0,0014 | 0,0007 |
| b-qwen-t01 (#85) | 1 | 395 | 351 | 351 | 1 401 | 1 | 351 | 292 | 0 | 0,0011 | 0,0005 |
| b-qwen-t02 (#86) | 1 | 346 | 478 | 478 | 1 911 | 1 | 478 | 415 | 0 | 0,0015 | 0,0007 |
| b-qwen-t03 (#87) | 1 | 262 | 446 | 446 | 1 781 | 1 | 446 | 412 | 0 | 0,0014 | 0,0007 |
| b-qwen-t04 (#88) | 1 | 342 | 323 | 323 | 1 289 | 1 | 323 | 290 | 0 | 0,0010 | 0,0005 |
| b-qwen-t05 (#89) | 1 | 126 | 452 | 452 | 1 808 | 1 | 452 | 404 | 0 | 0,0014 | 0,0007 |
| b-qwen-t06 (#90) | 1 | 360 | 366 | 366 | 1 462 | 1 | 366 | 309 | 0 | 0,0011 | 0,0006 |
| b-qwen-t07 (#91) | 1 | 434 | 324 | 324 | 1 295 | 1 | 324 | 290 | 0 | 0,0010 | 0,0005 |
| b-qwen-t08 (#92) | 1 | 477 | 388 | 388 | 1 551 | 1 | 388 | 328 | 0 | 0,0012 | 0,0006 |
| b-qwen-t09 (#93) | 1 | 171 | 357 | 357 | 1 425 | 1 | 357 | 296 | 0 | 0,0011 | 0,0005 |
| b-qwen-t10 (#94) | 1 | 550 | 450 | 450 | 1 800 | 1 | 450 | 404 | 0 | 0,0014 | 0,0007 |

| | Paket-Tokens Mittel | Maximum | Bytes Mittel | Maximum | Mehrkosten Liste Mittel | Maximum | mit Rabatt Mittel | Maximum |
|---|---|---|---|---|---|---|---|---|
| Segment A (20 PRs) | 5 661 | 7 585 | 22 715 | 30 413 | 0,0104 USD | 0,0167 USD | 0,0052 USD | 0,0083 USD |
| Segment B (20 PRs) | 394 | 478 | 1 572 | 1 911 | 0,0012 USD | 0,0015 USD | 0,0006 USD | 0,0007 USD |
| **alle 40** | **3 027** | **7 585** | 12 144 | 30 413 | **0,0058 USD** | **0,0167 USD** | 0,0029 USD | 0,0083 USD |

**Gegen die Leitplanke (0,15 USD je PR im Mittel, Listenpreis, §10):** Die Leitplanke meint die Gesamtkosten je PR. Die Studie maß ohne Paket 0,04 bis 0,10 USD (Liste). Das Paket legt im Mittel 0,0058 USD und höchstens 0,0167 USD an Input dazu, also 4 % bzw. 11 % der Leitplanke. Mit den Output-Tokens aus §8.1 lag kein Probe-Lauf über 0,067 USD (Liste) gesamt, der abschließende Lauf bei höchstens 0,059 USD.

**Was die Messung über die Regeln zeigt:**
- Ohne Deckel braucht das Paket 181 bis 15 860 Tokens; 30 der 40 PRs bleiben unter 8 000. Der Default bleibt deshalb bei 8 000 (Vorschlag aus §5.1), begründet an der Konstante `DEFAULT_REPO_CONTEXT_MAX_TOKENS`. Repo-Config: `pipeline_config.repoContext.maxTokens`, höchstens 16 000.
- Am Budget fallen in 11 PRs zusammen 32 Abschnitte weg: 26 Ausschnitte geänderter Dateien (A4) und sechsmal der Dateibaum (A7). Manifeste (das nächste und die seiner Elternverzeichnisse, §9.3) und Schema passten in jedem der 40 PRs.
- Der Abruf-Deckel des App-Pfads (15 Dateien) greift früher als das Budget: in 9 PRs mit 17 bis 65 Dateien bleiben 2 bis 46 geänderte Dateien ohne A4-Abschnitt (`file_limit`). Produktionscode wird vor Testdateien gelesen, höchstens 6 Schema-Dateien. Jede Auslassung steht in `result.repo_context.omissions`.
- 7 Dateien fielen als `too_large` weg (kein Hunk-Fenster unter dem Datei-Budget von 8 000 Zeichen), 4 wegen eines Secret-Treffers (`regex-engine.test.ts` in zwei PRs, `config-engine.ts`, `internal-contract.ts`: Dateien rund um die Secret-Regeln des Pre-Scanners; nicht einzeln gesichtet, ob Muster oder Material).
- Der Secret-Filter ersetzte im Modell-Diff 7 Zeilen in 5 der 40 PRs (4 in Segment A, 3 in Segment B, dort das hartkodierte JWT-Secret der Aufgabe t02). Eine erste Fassung traf 10 Zeilen, darunter gewöhnlichen Code; die Muster sind seitdem enger (§9.3 Nr. 9).
- Segment B ist ein Skelett: 13 Dateien, ein Schema, je ein Manifest je Dienst. Die Zahlen für Segment A sind die belastbareren; sie stammen aus den Replay-Branches des eigenen Repos.

### 6.2 Speicher auf Vercel Hobby (2 GB)

- A: einige hundert Kilobyte Text je Job. Der rekursive Tree-Abruf liefert bei großen Repos bis zu 100 000 Einträge und 7 MB JSON; besser nur die Verzeichnisse der geänderten Dateien und ihre Eltern abrufen. Unkritisch.
- B: wie A, dazu der wachsende Gesprächsverlauf. Unkritisch.
- C: Ingest hält Dateien stapelweise im Speicher. Machbar, aber derselbe Prozess, der schon beim Pre-Scan an der Speichergrenze gemessen wurde (Route-OOM des Pre-Scans, ROADMAP §1).

### 6.3 Prompt-Cache

- Das Paket steht im dynamischen Teil des Requests, nie im Cache-Prefix. Der Vertrag aus `PROMPT_CACHING_SPEC.md` §4 und `LANGUAGE_COVERAGE_SPEC.md` §6.2 bleibt: Der Prefix hängt nur von Conditions, Law-Block und Ökosystemen ab.
- Die neue Regel aus §7.1 ändert den Conditions-Block. Der Cache-Key wechselt dadurch von selbst (Conditions sind Teil des Keys); zusätzlich `PROMPT_CACHE_SCHEMA_VERSION` von 3 auf 4, weil sich der Protokoll-Text ändert. Folge: je Key einmal `explicit_created` nach dem Deploy.
- Der Verifier teilt den Prefix mit dem Draft nicht (anderes Modell), aber denselben Mechanismus: Auch dort steht der Kontextausschnitt im dynamischen Teil.
- B: Tools müssen in den Cache (§4). Das heißt neue Cache-Varianten je Rolle und eine Änderung an `context-cache.ts`. Ein Grund mehr, B nicht zuerst zu bauen.

### 6.4 GitHub-API-Rate-Limits

- Installation-Tokens haben mindestens 5 000 Anfragen je Stunde, bei großen Organisationen bis 12 500 ([GitHub-Doku](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)).
- A braucht je PR höchstens 1 Tree-Abruf und 15 Datei-Abrufe, also 16 Anfragen zusätzlich zu den heutigen. Das sind über 300 PRs je Stunde und Installation, bevor das Limit greift. Die Abrufe laufen parallel, aber mit höchstens 8 gleichzeitig, um das Sekundärlimit nicht zu berühren.
- Abgerufen wird am Head-SHA des PRs (`getPullRequestHeadSha` existiert), nicht am Default-Branch. Bei PRs aus Forks über `refs/pull/<n>/head` im Basis-Repo.
- B: unbestimmt, durch den Rundendeckel begrenzt. Die Code-Suche ist auf 10 Anfragen je Minute begrenzt und durchsucht nur den Default-Branch; `search_code` wäre im App-Pfad deshalb schwach.
- Die App hat bereits `contents: read & write` (`GITHUB_APP_SPEC.md:482`). Für A ist keine neue Berechtigung nötig, also keine erneute Bestätigung durch die Nutzer. Für C wäre das Event `push` neu.

### 6.5 Datenschutz

| | Was verlässt das Repo zusätzlich | Wohin | Wie lange |
|---|---|---|---|
| Heute | Diff; Skelette der JS/TS-Dateien | Vertex (Diff), Supabase (`code_chunks`, im CLI- und MCP-Pfad der Diff in `review_jobs.payload`) | Skelette bis 30 Tage nach dem Trennen; CLI-Diff 30 Tage, sobald Migration 052 läuft |
| A, App-Pfad | Manifeste, Schema, Einstiegspunkt, Ausschnitte geänderter und importierter Dateien | Nur Vertex, im Arbeitsspeicher der Funktion | Keine Speicherung bei unslop. Vorschlag: nur Pfadliste und Größe des Pakets ins Job-Ergebnis, nie der Inhalt. |
| A, CLI- und MCP-Pfad | Dasselbe, vom Client gebaut und hochgeladen | Vertex; Supabase nur, wenn das Paket im Job-Payload liegt | Vorschlag: Paket nach Job-Ende aus dem Payload entfernen (Frage 3) |
| B | Was das Modell anfordert, also nicht vorhersehbar | Vertex | wie A |
| C | Ganze Symbole mit Rümpfen aller Dateien | Supabase, dauerhaft | bis zum Trennen plus 30 Tage |

- **Rechtstexte:** Bei A geht mehr Code an das Modell als der Diff. Das ist dieselbe Verarbeitung beim selben Auftragsverarbeiter, aber die Beschreibung in Datenschutzerklärung, AVV und Landing („nur der Diff“, „Signaturen“) muss vor dem Go-Live von Stufe 1 stimmen. Eintrag in `LEGAL_PAGES_SPEC.md` und Stufe A der ROADMAP nötig (Frage 2).
- **Secrets:** Kontextdateien können Zugangsdaten enthalten. `.env*` und Lockfiles sind ausgeschlossen (wie in `skeleton.ts: IGNORED_PATHS`). Im CLI- und MCP-Pfad läuft der vorhandene Secret-Filter (`packages/shared/src/node/secret-filter.ts`) auch über das Paket; ein Treffer entfernt die Datei aus dem Paket und nennt sie. Im App-Pfad gibt es bis heute keinen serverseitigen Secret-Filter (ROADMAP §2, Punkt f); der Paket-Schritt ist der Anlass, ihn für Diff und Paket nachzuziehen.
- **Prompt Injection:** Repo-Dateien sind fremde Daten wie der Diff. Das Paket wird als Daten gekennzeichnet; GATE-001 gilt weiter nur für hinzugefügte Zeilen, eine Anweisung in einer Kontextdatei ist kein Befund, wird aber nicht befolgt. Das ist ein neuer Eingang und braucht eine eigene Kontroll-Fixture im Rule-Recall-Benchmark (Injection in `README.md` des Pakets, erwartet: keine Wirkung).
- **Zeitraum der Vercel-Funktion und Region:** unverändert, eu-Multiregion für Draft und Verifier.

## 7. Prompt-Rahmung

### 7.1 Eine eng gefasste Regel für Repo-Widersprüche (Teil von Stufe 1)

Der heutige Draft darf nur melden, was eine Condition oder eine Law-Regel verletzt („every violation must cite a Condition or a Law rule“), und `validateIssuesAgainstManifest` verwirft jede andere Regel-ID. Ein Befund „Tabelle existiert nicht“ hat heute keine Regel, unter der er durchkäme. In der Probe hat das Modell mit Paket in einem von drei PRs trotzdem einen Weg gefunden (`MAINT-005` für die fehlende Abhängigkeit, als WARNING); in den beiden anderen schwieg es.

Vorschlag: eine neue Condition „Repository Mismatch“ mit geschlossener Liste:
1. Tabelle oder Spalte, die das mitgelieferte Schema nicht definiert.
2. Paket, das das mitgelieferte Manifest nicht deklariert (der Pre-Scanner prüft bisher nur, ob das Paket in der Registry existiert).
3. API, die die im Manifest festgelegte Hauptversion entfernt hat.
4. Route, Handler oder Modul, das der vorhandene Einstiegspunkt nie lädt.
5. Zustand im Prozessspeicher, obwohl das Repo dafür eine Tabelle und einen Datenbankzugang hat.
6. Zweiter Datenbanktreiber oder zweite Datenbank neben der vorhandenen.

Jeder Befund muss die Kontextdatei und die Zeile nennen, auf die er sich stützt. Damit ist er prüfbar:
- **Deterministisch**, wo möglich: Punkt 2 für JS/TS und Go lässt sich ohne Modell prüfen (Import-Name gleich Modulpfad). Das gehört als Regel in den Pre-Scanner, das Modell ist dann nur noch für Python (Import-Name ungleich Paketname, siehe den Fehlalarm `import yaml` in ROADMAP §1) und für die Punkte 1 und 3 bis 6 zuständig. Derselbe Manifest-Zugriff behebt auch zwei bekannte Fehlalarme: `import yaml` trotz `pyyaml` und HAL-002 auf APIs neuer Framework-Versionen (ROADMAP §1, „G8 gerissen“, dort als Variante b vorgeschlagen).
- **Durch den Verifier:** Der blinde Verifier bekommt den zitierten Ausschnitt und eine feste Frage (das Protokoll kennt „FIXED-QUESTION CLAIMS“ bereits), etwa: „Definiert der gezeigte Schema-Ausschnitt eine Tabelle `contact`?“

Wirkung auf Fehlalarme: Die Regel ist eng und jede Behauptung an einer Datei prüfbar. Das Risiko liegt bei unvollständigem Paket (das Schema liegt woanders, die Abhängigkeit kommt aus einem Workspace-Manifest). Deshalb: Ein Befund dieser Regel ist nur dann CRITICAL, wenn das Paket die betreffende Dateiart vollständig enthält (kein Budget-Abschnitt, genau ein Kandidat); sonst WARNING. Punkt 5 und 6 sind immer WARNING, weil sie eine Entwurfsentscheidung sein können.

### 7.2 Offene Fehlersuche im Diff (Stufe 2)

Was dafür spricht:
- 20 der 41 Befunde stehen im Diff, und unslop hat sie mit demselben Modell nicht gemeldet. In der Probe fand keine der drei Varianten die hartkodierte Admin-Rolle in `login.js`, obwohl die Datei vollständig im Prompt stand. Der Auftrag „prüfe gegen diese Regeln“ lenkt das Modell von allem weg, was keine Regel ist.
- Die Probe zeigt die Wirkung eines Auftragssatzes direkt: von 1 auf 5 von 6 bei gleichem Modell und gleichem Kontext.
- Zehn der 20 Diff-Befunde sind klassische Sicherheitsfehler (SSRF, Pfad-Traversal, `debug=True`, fehlende Authentifizierung). Für die ist der bessere erste Weg eine Regel: als deterministische Pre-Scan-Regel, wo ein Muster reicht (ROADMAP §1 schlägt das für SSRF und Upload-Traversal schon vor), sonst als Law-Regel. Die anderen zehn sind Logikfehler ohne Muster; nur eine offene Frage findet sie.

Was dagegen spricht:
- Die Fehlalarme von Claude Code in Segment A (34, also 1,70 je PR) sind laut Studie §9.4 „fast durchweg Logik-Behauptungen, die am Code oder an einer dokumentierten Entscheidung scheitern“. Genau diese Klasse holt man sich mit der offenen Suche ins Haus, und zwar mit einem schwächeren Modell als Fable.
- unslops Präzision auf Agenten-PRs liegt bei 65 bis 68 %. Sie kommt heute fast ganz aus Musterregeln (27 der 31 Fehlalarme: Pfad-Regel und Sicherheitsmuster in Teststrings), nicht aus der Modell-Review. Eine offene Suche würde eine zweite Quelle von Fehlalarmen daneben stellen, bevor die erste behoben ist.
- Der blinde Verifier prüft heute „verletzt das Zitat die Regel“. Für einen Logikfehler braucht er eine Frage, die sich am Code beantworten lässt, und oft mehr Kontext als das Zitat.
- Das Produktversprechen ist ein Gatekeeper mit Regeln und reproduzierbarem Urteil. Offene Befunde sind eine andere Art von Aussage und müssen im PR anders aussehen als ein Regelverstoß.

Empfehlung:
1. **Nicht in Stufe 1 mischen.** Zuerst die Regel aus §7.1, weil sie prüfbar ist, und die Musterregeln für die zehn Sicherheitsfehler.
2. **Stufe 2 als eigener Abschnitt im selben Draft-Call**, nicht als zusätzlicher Call: ein Auftrag mit geschlossener Liste von Fehlerklassen (Absturz bei üblicher Eingabe, Daten gehen verloren oder werden überschrieben, Prüfung wird nie wirksam, Berechtigung falsch vergeben, Funktion tut nicht, was Name und Aufrufer erwarten), eigene Regel-ID, immer WARNING, im PR als „möglicher Fehler“ gekennzeichnet und getrennt von Regelverstößen gezählt. Der Integrity Score bleibt an den Regelbefunden.
3. **Jeder offene Befund geht mit fester Frage durch den Verifier**; ohne CONFIRMED wird er nicht gepostet (strenger als bei Regelbefunden, wo UNCERTAIN heute sichtbar bleibt).
4. **Kill-Switch und Messung vor dem Default:** Stufe 2 wird nur Default, wenn die Leitplanken aus §10 halten. Sonst bleibt sie je Repo-Config.

## 8. Machbarkeitsprobe (2026-10-05)

**Frage:** Findet der heutige Flash-Draft die Repo-Fehler, wenn er das Paket bekommt?

**Aufbau:** Drei PRs aus Segment B mit zusammen sechs Repo-Befunden aus §3 (Nr. 31, 32, 33; 26, 27; 8). Je PR drei Requests an `MODEL_DRAFT` (`gemini-3.8-flash`, Rolle `draft`, eu-Multiregion, Explicit Cache, Temperatur 0) über `resolvePromptEnvelope` und `runEnvelopeGenerateContent`, also derselbe Envelope wie in Produktion, Variante `reviewer_diff`, alle Conditions, Law-Block für `react, typescript, nodejs` plus die Sprache des Diffs:
- **V1:** nur der Diff (heutiger Request).
- **V2:** Diff plus Kontextpaket, sonst unverändert.
- **V3:** wie V2, dazu ein Auftragssatz im dynamischen Teil, der Widersprüche zum Paket unter der Regel `CONTEXT (Repository Mismatch)` verlangt.

Das Paket baute ein Scratch-Skript nach vier Regeln aus dem PR-Head: Dateibaum, nächste Manifeste (A1), Schema-Dateien (A2), Einstiegspunkt laut `main` (A3), Nachbardateien (A6). Größe: 1 267 bis 1 957 Zeichen, 380 bis 684 Tokens. Abweichungen von der Produktion: kein Pre-Scan-Abschnitt, keine Reference Practices, kein Verifier, keine Validierung der Regel-IDs (die Regel aus V3 würde heute verworfen). Das Skript ist nicht Teil des PRs.

**Ergebnis (Repo-Befunde aus §3, die der Draft meldete):**

| PR | Ziel-Befunde | V1 nur Diff | V2 mit Paket | V3 mit Paket und Auftragssatz |
|---|---|---|---|---|
| Qwen t06 (`main.go`) | Nr. 31 SQLite statt Postgres, Nr. 32 `go-sqlite3` nicht in `go.mod`, Nr. 33 `price` statt `price_cents` | 0 von 3 („No AI slop found“) | 1 von 3 (Nr. 32 als `MAINT-005`, WARNING) | 2 von 3 (Nr. 32, Nr. 33; Nr. 31 nur im Summary gestreift, nicht gezählt) |
| Qwen t03 (`route.ts`) | Nr. 26 Tabelle `contact`, Nr. 27 `@vercel/postgres` nicht im Manifest | 0 von 2 | 0 von 2 | 2 von 2 |
| Flash-Lite t02 (`login.js`) | Nr. 8 eigene Express-App statt `server.js` | 0 von 1 | 0 von 1 | 1 von 1 |
| **Summe** | 6 | **0 von 6** | **1 von 6** | **5 von 6** |

Weitere Beobachtungen:
- V3 meldete in `login.js` zusätzlich „Nutzer im Speicher statt in der Tabelle `users`“. Der Befund ist am Schema nachvollziehbar und entspricht der Klasse von Nr. 25, steht für diesen PR aber nicht unter den 41.
- V2 meldete in `main.go` zusätzlich `SEC-007` (HTTP-Server ohne Timeouts), V1 nicht. Bei Temperatur 0 ändert das Paket also auch, welche Regelbefunde erscheinen. Das ist bei der Wiederholung der Studie zu beobachten.
- Keine Variante fand die Diff-Befunde Nr. 9 und 10 (`role: 'admin'`, Standard-Admin im Log) in `login.js`. Das stützt die Trennung in §7.
- Die Regelbefunde von V1 blieben in V3 erhalten (Secrets, Klartext-Passwort, Ratenbegrenzung, toter Code).
- Keiner der fünf Kontext-Befunde aus V3 ist ein Fehlalarm; geprüft an `db/schema.sql`, `go.mod`, `web/package.json` und `services/auth/server.js` des Skeletts.

**Kosten und Zeit:**

| PR | Variante | Prompt-Tokens (davon Cache) | Output-Tokens | Latenz | Kosten |
|---|---|---|---|---|---|
| Qwen t06 | V1 | 5 881 (4 673) | 1 548 | 11,8 s | 0,0078 USD |
| | V2 | 6 261 (4 673) | 18 842 | 128,9 s | 0,0794 USD |
| | V3 | 6 362 (4 673) | 2 247 | 16,6 s | 0,0110 USD |
| Qwen t03 | V1 | 5 586 (4 622) | 2 211 | 15,6 s | 0,0103 USD |
| | V2 | 6 270 (4 622) | 4 879 | 46,7 s | 0,0219 USD |
| | V3 | 6 371 (4 622) | 2 994 | 32,7 s | 0,0142 USD |
| Flash-Lite t02 | V1 | 6 192 (4 622) | 2 415 | 23,9 s | 0,0116 USD |
| | V2 | 6 740 (4 622) | 3 308 | 22,5 s | 0,0158 USD |
| | V3 | 6 841 (4 622) | 2 476 | 25,0 s | 0,0124 USD |

Summe: **0,1844 USD** für 9 Calls (mit Intro-Rabatt, wie `scripts/lib/vertex-pricing.ts` rechnet), Grenze 2 USD. Keine Eskalation, kein Job, kein Test-PR. Eskalationszähler des Dogfooding-Kontos vorher 19 von 50, nachher 19 von 50 (`billing_accounts.escalation_month_count`, per SQL gelesen).

**Was die Probe trägt und was nicht:**
- Sie trägt: Das Modell kann die Fehler finden, wenn es die Datei sieht und danach gefragt wird. Das Paket ohne Auftrag wirkt kaum. V2 brauchte mehr Thinking (bis 18 842 Output-Tokens) als V3, als suche das Modell nach einer Regel für das, was es sieht.
- Sie trägt nicht: ein Lauf je Zelle, drei PRs, ein winziges Repo mit genau einem Schema, kein Verifier, keine Messung von Fehlalarmen auf sauberem Code. Die Zahl 5 von 6 ist ein Machbarkeitsbeleg, keine Trefferquote.

Die Rohantworten stehen in Anhang A.

### 8.1 Nachtrag 2026-10-05: Probe auf dem Pipeline-Pfad (Stufe 1a/1b gebaut)

**Frage:** Findet die gebaute Pipeline die Repo-Fehler, und bestätigt sie der blinde Verifier?

**Aufbau:** Die drei PRs aus §8 und zwei weitere Studien-PRs mit Repo-Befunden (Flash-Lite t09 mit Nr. 19, Qwen t05 mit Nr. 29), zusammen acht Ziel-Befunde aus §3. Je PR ein Lauf über die Steps des Rule-Recall-Runners (`runCascadeLane`: Router, Draft, Verifier, Scorer; ohne Eskalation und Zweitmeinung, `allowEscalation: false`), mit dem Paket aus den Auswahlregeln, gelesen per `git show` am Head des Branches, Obergrenze 8 000 Tokens, Repo-Ökosysteme `react, typescript, nodejs` wie auf `unslopai/test`. Kein Test-PR, kein Pre-Scan, keine Reference Practices. Kosten aus den Telemetrie-Zeilen der Jobs, mit Intro-Rabatt wie `scripts/lib/vertex-pricing.ts` rechnet (Listenpreis das Doppelte).

**Ergebnis des abschließenden Laufs (Code und Prompt wie im PR, nach den Korrekturen aus dem Review):**

| PR | Ziel-Befunde | gefunden und CONFIRMED | weitere Condition-12-Befunde | Regelbefunde | Paket-Tokens | Draft | Verifier | Kosten | Job |
|---|---|---|---|---|---|---|---|---|---|
| Qwen t06 (`main.go`) | Nr. 31, 32, 33 | **2 von 3** (Nr. 32 `manifest`, Nr. 33 `schema`, beide CRITICAL) | keine | keine | 366 | 19,6 s | 9,8 s | 0,0234 USD | `f6d38669` |
| Qwen t03 (`route.ts`) | Nr. 26, 27 | **2 von 2** (`schema`, `manifest`, beide CRITICAL) | keine | Condition 5 | 446 | 20,1 s | 11,7 s | 0,0231 USD | `33ca72ae` |
| Flash-Lite t02 (`login.js`) | Nr. 8 | **1 von 1** (`unloaded_entry`, CRITICAL) | 1: Nutzer im Speicher statt Tabelle `users` (`in_memory_state`, WARNING) | SEC-012 | 478 | 24,3 s | 15,7 s | 0,0234 USD | `87501096` |
| Flash-Lite t09 (`fetcher.py`) | Nr. 19 | **1 von 1** (`manifest`, CRITICAL) | keine | MAINT-007 | 357 | 23,6 s | 9,5 s | 0,0256 USD | `102cc2ff` |
| Qwen t05 (`CommentView.tsx`) | Nr. 29 | **1 von 1** (`removed_api`, CRITICAL) | keine | keine | 452 | 35,6 s | 7,8 s | 0,0293 USD | `1ec72bbd` |
| **Summe** | 8 | **7 von 8** | 1 | | | | | **0,1249 USD** | |

- **Fehlalarme der Condition 12: 0 von 8.** Alle acht Befunde sind an `db/schema.sql`, `go.mod`, `requirements.txt`, `web/package.json` und `services/auth/server.js` des Skeletts nachvollziehbar; der zusätzliche Befund in `login.js` entspricht der Klasse von Nr. 25 und war schon in §8 als echt eingeordnet. Der Verifier hat alle acht mit der festen Frage bestätigt (Konfidenz 95 bis 99).
- **Verfehlt: Nr. 31** (SQLite statt der gemeinsamen Postgres-Datenbank). Die Art `second_database` braucht `web/lib/db.ts` oder einen Hinweis im Manifest; das Paket zeigt hier nur `go.mod` mit `lib/pq`, und der Draft meldete stattdessen den fehlenden Treiber (Nr. 32). A6 (Nachbardateien) ist nicht gebaut.
- **Schweregrad:** sieben CRITICAL, einer WARNING, wie §7.1 es vorsieht (ein Schema-Kandidat, keine Auslassung).
- **Kosten je PR:** 0,023 bis 0,029 USD mit Rabatt, also 0,046 bis 0,059 USD Liste, gegen 0,04 bis 0,10 USD in der Studie ohne Paket. Leitplanke 0,15 USD.
- **Regelbefunde schwanken.** In `login.js` meldete dieser Lauf nur SEC-012; SEC-005 (hartkodiertes Secret) und SEC-021 (Ratenbegrenzung) fehlten. Der Lauf davor mit demselben Prompt hatte alle drei, der Lauf ohne Paket ebenfalls (Tabelle unten). Über vier Läufe mit Paket: SEC-012 viermal, SEC-005 dreimal, SEC-021 einmal. Die Condition-12-Befunde waren in allen Läufen dieselben.

**Kontrollen und Regression (Rule-Recall-Runner, Produktionspfad, `--no-escalation`, Report `fixtures/rule-recall/results/2026-10-05-repo-context-stage1-regression.json`):**

| Fixture | Draft | Pre-Scan | überlebt | Bemerkung |
|---|---|---|---|---|
| r05 (TypeScript, Security) | 10 von 10 | 6 | 10 von 10 | |
| r10 (Go) | 5 von 6 | 2 | 6 von 6 | ein Draft-Miss, vom Pre-Scan gedeckt |
| r13 (PowerShell) | 3 von 3 | 2 | 3 von 3 | |
| r18 (saubere Kontrolle) | 0 Befunde | | | 0 Fehlalarme |
| r25 (saubere Kontrolle, System-Prompt) | 0 Befunde | | | 0 Fehlalarme, kein GATE-001 |

Kombiniert 19 von 19, kein Condition-12-Befund ohne Paket. Die Fixtures sind Diffs ohne Repo; sie prüfen den geänderten Prompt (Condition 12 im Prefix, neue Protokoll-Absätze) und den Secret-Filter auf dem Modell-Diff, nicht das Paket. Die Tabelle ist der Lauf auf dem Stand des PRs (nach den Korrekturen aus dem Review), Kosten 0,1231 USD mit Rabatt (`scripts/benchmark-cost.ts`). Ein erster Lauf vor den Korrekturen hatte dieselben Zahlen.

**Frühere Läufe desselben Tages.** „alt“ = Fußzeile des Pakets „Check the added lines of the diff against this context under Condition 12“, „neu“ = die endgültige Fußzeile vor den Korrekturen aus dem Review:

| PR | Paket | Condition-12-Ziele | Regelbefunde | Draft-Latenz | Kosten |
|---|---|---|---|---|---|
| Qwen t06 | ja, neu | 2 von 3 | keine | 22,3 s | 0,0230 USD |
| Qwen t03 | ja, neu | 2 von 2 | Condition 5 | 27,1 s | 0,0264 USD |
| Flash-Lite t02 | ja, neu | 1 von 1, dazu `in_memory_state` | SEC-005, SEC-012, SEC-021 | 38,0 s | 0,0267 USD |
| Flash-Lite t09 | ja, neu | 1 von 1 | MAINT-007 | 19,8 s | 0,0196 USD |
| Qwen t05 | ja, neu | 1 von 1 | keine | 36,7 s | 0,0263 USD |
| Qwen t03 | ja, alt | 2 von 2 | Condition 5 | 42,5 s | 0,0334 USD (ein Verifier-Parse-Fehler, Retry) |
| Qwen t06 | ja, alt | 2 von 3 | keine | 42,9 s | 0,0321 USD |
| Flash-Lite t02 | ja, alt | 1 von 1, dazu `in_memory_state` | SEC-005, SEC-012 | 249,5 s | 0,0284 USD |
| Flash-Lite t02 (Wiederholung) | ja, alt | 1 von 1, dazu `in_memory_state` | SEC-005, SEC-012 | 71,8 s | 0,0264 USD |
| Flash-Lite t02 | **nein** | 0 (kein Paket) | SEC-005, SEC-012, **SEC-021** | 41,2 s | 0,0237 USD |
| Flash-Lite t09 | ja, alt | 1 von 1 | MAINT-007 | 107,0 s | 0,0300 USD |
| Qwen t05 | ja, alt | 1 von 1 | keine | 205,3 s | 0,0220 USD |
| Qwen t05 (Wiederholung) | ja, alt | 1 von 1 | keine | 171,0 s | 0,0300 USD |
| Qwen t05 | **nein** | 0 (kein Paket) | **MAINT-007** (Datei importiert sich selbst) | 38,2 s | 0,0259 USD |

Zwei Beobachtungen daraus haben die Fußzeile geändert:
1. **Verdrängung eines Regelbefunds.** Mit Paket fehlte in `login.js` zweimal SEC-021 (fehlende Ratenbegrenzung), den der Lauf ohne Paket hatte. Die Fußzeile lenkte den Blick auf Condition 12. Sie lautet jetzt „Review the diff against the full rulebook as usual. In addition, check its added lines against this context under Condition 12 (Repository Mismatch).“ Im ersten Lauf danach war SEC-021 wieder da, im abschließenden fehlte er erneut, zusammen mit SEC-005. Die neue Fußzeile hat die Verdrängung also nicht behoben.
2. **Draft-Latenz.** Mit der alten Fußzeile brauchten Drafts auf t02, t09 und t05 107 bis 249 s bei 3 100 bis 5 400 Output-Tokens (eine Wiederholung auf t02: 72 s), ohne Paket 38 und 41 s. Mit der neuen Fußzeile 20 bis 38 s auf allen fünf PRs, in zwei Läufen.

**Was das trägt und was nicht:** Die Zahl 7 von 8 hielt in drei Läufen über alle fünf PRs. Ob die langen Drafts am Wortlaut der alten Fußzeile hingen oder an der Auslastung bei Vertex zur selben Zeit, ist nicht belegt. Offen und wichtiger: **Mit Paket erscheinen Regelbefunde weniger verlässlich.** In `login.js` fehlten mit Paket SEC-021 in drei von vier Läufen und SEC-005 in einem; in `CommentView.tsx` meldete der Lauf ohne Paket MAINT-007, alle vier Läufe mit Paket nicht. Ohne Paket gibt es je PR nur einen Lauf, die Streuung dort ist also ungemessen (in §8 fehlte SEC-021 in keiner Variante). Für Messung 1 heißt das: die Leitplanke „mindestens 10 der 11 bisher gefundenen blockierenden Befunde bleiben“ und die Job-Dauer sind die beiden Zahlen, die zuerst zu prüfen sind. Unverändert gilt: fünf PRs, ein Skelett-Repo mit genau einem Schema, kein Pre-Scan, keine Messung auf echten Repos.

**Budget:** alle Probe-Läufe zusammen 0,4989 USD (0,0334 + 0,1125 + 0,0496 + 0,0564 + 0,1221 + 0,1249), dazu die Regressionsprobe mit 0,1231 USD und ihr erster Lauf, dessen Kosten nicht gemessen sind (§13; gleiche Fixtures, also ebenfalls rund 0,12 USD). Zusammen rund 0,75 USD. Grenze der Session 1,50 USD. Eskalationszähler des Dogfooding-Kontos vorher 19 von 50, nachher 19 von 50 (`billing_accounts.escalation_month_count`, per SQL gelesen). Die 19 Probe-Jobs und die 5 Jobs der Regressionsprobe (`source = manual`) stehen als Beleg in der Datenbank; `scripts/cleanup-benchmark-jobs.ts` räumt sie ab.

## 9. Empfehlung und Stufenplan

**Option D, in dieser Reihenfolge:**

| Stufe | Inhalt | Deckt aus §3 | Mehrkosten je PR (Liste) | Mehrzeit | Aufwand |
|---|---|---|---|---|---|
| **1a** | Kontextpaket A1 bis A4 und A7 im App-Pfad; Condition „Repository Mismatch“ (§7.1); Verifier mit Ausschnitt und fester Frage; Pfadliste und Größe des Pakets im Job-Ergebnis; Degradation `repo_context_unavailable`, wenn der Abruf scheitert; Secret-Filter serverseitig für Paket und Diff | Schema 9, Manifest 6, Routing 1, ganze Datei 1 | 0,005 bis 0,03 USD | 1 bis 2 s plus Streuung des Drafts | mittel |
| **1b** | Dieselbe Auswahl im Client: Regeln in `packages/shared`, Upload-Feld neben dem Diff für CLI, Extension (über die CLI) und MCP; Aufrufer per `git grep` als Pfadliste | dasselbe auf den lokalen Oberflächen, dazu Aufrufer 1 | wie 1a | wie 1a | klein bis mittel |
| **1c** | Pre-Scan-Regel „Import nicht im nächsten Manifest deklariert“ für JS/TS und Go; Manifest-Versionen gegen die bekannten Fehlalarme (`import yaml`, HAL-002 auf neuen APIs) | Manifest 6 deterministisch statt per Modell | 0 | unter 1 s | klein |
| **Messung 1** | Wiederholung der Studie (§10) | | 1,5 bis 3 USD je Lauf | | |
| **2** | Musterregeln für die zehn Sicherheitsfehler im Diff; offene Fehlersuche als eigener Abschnitt (§7.2) hinter Kill-Switch | Diff 20 | 0 bis 0,01 USD | wenige Sekunden | mittel |
| **Messung 2** | wie Messung 1 | | 1,5 bis 3 USD | | |
| **3** (nur bei belegter Lücke) | Tool-Use mit höchstens 2 Runden und `read_file` / `list_directory`, erst auf Vercel Pro | was A nachweislich verfehlt | 0,05 bis 0,10 USD | 30 bis 80 s | hoch |
| nicht gebaut | Option C. Der bestehende Skeleton-Index wird nicht erweitert (Frage 5). | | | | |

Begründung in vier Sätzen: 15 der 18 Repo-Befunde hängen an Dateien, die eine Regel findet, also braucht es dafür weder Index noch Agent. Option A passt in das Zeitbudget, in den Cache-Vertrag und in die Kostenlage (Cent statt Dollar je PR) und speichert im App-Pfad keinen zusätzlichen Code. Sie ist modellunabhängig: Das Paket ist Text im Prompt und wirkt mit jedem Modell, auch mit Gemini 4 Argon, sobald es verfügbar ist. Tool-Use ist die stärkere Antwort auf unbekannte Fälle, kostet aber das Zehnfache, braucht den Cache-Umbau und passt erst mit Vercel Pro sicher in das Budget.

### 9.1 Je Oberfläche

| Oberfläche | Woher das Paket kommt | Besonderheiten |
|---|---|---|
| **GitHub App** (Webhook, `review_pr` über `/api/cli/pr/review`) | Server: Trees- und Contents-API mit dem Installation-Token am Head-SHA | Keine neue Berechtigung. Höchstens 16 Anfragen je PR. Nichts wird gespeichert. |
| **CLI** (`unslop scan`) | Client: dieselben Regeln aus `packages/shared` gegen das Arbeitsverzeichnis, inklusive nicht committeter Änderungen | Neues Feld `contextPackage` neben `diff` in `/api/cli/scan`. Eigene Größengrenze (Vorschlag 64 KB) neben den 300 KB für den Diff. Secret-Filter über das Paket. Ohne Feld läuft der Server wie heute, alte Clients bleiben gültig. |
| **VS-Code-Extension** | Ruft die CLI als Unterprozess auf und bekommt Stufe 1b ohne eigenen Code | Die Anzeige braucht den Hinweis, wenn das Paket fehlt oder gekürzt wurde. |
| **MCP** (`unslop_scan`) | Der MCP-Server baut das Paket wie die CLI (er nutzt dieselben Git-Helfer aus `@unslop/shared/node`) | Der aufrufende Agent hat das Repo, die Review läuft aber auf dem Server; „zero analysis“ aus `MCP_SPEC.md` bleibt, das Paket ist Auswahl, keine Analyse. Ein Agent kann später über einen optionalen Parameter weitere Pfade mitgeben; nicht in Stufe 1. |

Eine Auswahlregel-Datei für Server und Client ist Pflicht (MAINT-001): Die Regeln arbeiten gegen eine Leser-Schnittstelle (`listPaths`, `readFile`), wie `ecosystem-detection.ts` es mit dem `ManifestLoader` schon tut.

### 9.2 Ehrlichkeit im Ergebnis

- Kommt kein Paket zustande (API-Fehler, Zeitlimit, Größe), läuft die Review wie heute und sagt das: eine Degradation im Ergebnis und ein Satz in Kommentar, CLI, Extension und MCP. Die Condition „Repository Mismatch“ meldet dann nichts.
- Wird das Paket gekürzt, nennt das Ergebnis die weggelassenen Pfade.
- Die Landing sagt heute nicht, dass unslop das Repo liest. Bis Stufe 1 live belegt ist, bleibt das so.

### 9.3 Nachtrag 2026-10-05: Bau-Entscheidungen Stufe 1a/1b

Was beim Bau anders oder genauer entschieden wurde als oben beschrieben. Der Code hält sich an diesen Abschnitt.

1. **Condition 12 ohne eigenen Schalter.** „Repository Mismatch“ steht als `COND-012` in der Registry (und damit im Cache-Prefix), ist aber nicht je Repo wählbar: sie ist aktiv genau dann, wenn `pipeline_config.repoContext.enabled` gilt (`resolveActiveConditionIds`). Grund: persistierte Configs zählen ihre Conditions einzeln auf (`unslopai/test` hat elf, live gelesen 2026-10-05); eine neue ID bliebe dort still aus. Die Settings-Seite bietet sie nicht an, der Validator speichert sie nicht.
2. **Der Paket-Schritt steht in keiner `enabledStepIds`-Liste.** Der Worker hängt `repo-context-loader` direkt vor `draft-reviewer` ein, aus demselben Grund. Keine Daten-Migration nötig.
3. **Rekursiver Tree statt Verzeichnis-Abrufen** (anders als die Empfehlung in §6.2): das Schema liegt in der Regel nicht in einem Elternverzeichnis der geänderten Datei (`db/schema.sql` neben `services/catalog/main.go`). Ein abgeschnittener Tree (`truncated`) macht das Paket unvollständig; dann ist kein Condition-12-Befund CRITICAL.
4. **Schweregrad und Beleg** nach §7.1 an der Validation-Boundary (`repository-mismatch.ts`): CRITICAL nur, wenn keine Datei der tragenden Art ausgelassen wurde und, beim Schema, genau ein Kandidat existiert; „Zustand im Speicher“ und „zweite Datenbank“ immer WARNING. Verworfen wird ein Befund ohne Paket, ohne zitierte Datei im Paket des Calls oder mit einer Art, die nicht zur zitierten Datei passt (Schema-Arten brauchen eine Schema-Datei, Manifest-Arten ein Manifest, „wird nie geladen“ den Einstiegspunkt; Dateibaum und Aufrufer-Liste belegen nichts). Verlangt wird die Kontextdatei, nicht wie in §7.1 formuliert auch die Zeile: „fehlt im Manifest“ hat keine.
4a. **Manifeste:** A1 liefert das nächste Manifest und die gleichnamigen seiner Elternverzeichnisse, weil in einem Workspace oft erst die Wurzel deklariert, was ein Paket importiert. Der Verifier bekommt zu einem Manifest-Claim alle Manifeste der Datei, zu einem Schema-Claim alle gezeigten Schema-Dateien und, wenn Schema-Dateien fehlen, einen Hinweis; die Frage verlangt dann UNCERTAIN.
5. **Zwei Zusatzfelder im Befund** (`context_path`, `mismatch_kind`), aus denen die feste Verifier-Frage je Art entsteht. Mehrere Befunde derselben Datei werden je (Art, Kontextdatei) gebündelt, nicht je Regel, weil jede Gruppe ihre eigene Frage hat.
6. **Der Auftragssatz steht zweimal:** statisch in beiden Draft-Protokollen (Hinweis auf das Paket, Priority 3 des RAG-Protokolls) und als Fußzeile des Pakets im dynamischen Teil. V2 und V3 der Probe (§8) unterscheiden sich genau um diesen Satz hinter dem Paket.
7. **Schema-Reduktion** nennt je Datei immer zuerst alle definierten Tabellen. Nur so ist „Tabelle fehlt“ am Ausschnitt prüfbar, wenn bei vielen Migrationen nur die Statements zu im Diff genannten Tabellen gezeigt werden.
8. **Budget und Deckel:** die Obergrenze gilt für das ganze gerenderte Paket inklusive Kopf, Fuß und der Zeile der Auslassungen (600 Tokens Reserve, höchstens 20 Pfade à 100 Zeichen). Gelesen werden höchstens 6 Schema-Dateien (`schema.*` zuerst, dann die jüngsten Migrationen) bis je 60 KB; ältere Migrationen stehen als eine Auslassung `not_selected` im Ergebnis, machen das Schema unvollständig, lösen aber keinen Nutzer-Hinweis aus. Zeilen im Inhalt, die wie ein Rahmen des Prompts aussehen, werden entschärft (`| ` davor). Ein Abschnitt, der nicht passt, fällt ganz weg; ein kleinerer späterer darf noch hinein. Bei Datei-Batches wird das Paket einmal gebaut und je Batch auf dessen Dateien gefiltert, kein zweiter Abruf.
9. **Serverseitiger Secret-Filter** (§6.5): im Paket fällt ein Abschnitt mit Treffer weg. Im Diff wird das Material ersetzt (`<redacted-secret>`), nicht die Zeile: Zeilenzahl, Hunks und der Name der Variable bleiben, damit das Modell „hier steht ein Literal“ weiter melden kann und Zeilennummern stimmen. Ein unquotierter Wert, der ein Bezeichner, Zugriff oder Aufruf ist (`OTHER_CONSTANT`, `process.env.X`), bleibt stehen, ebenso eine quotierte Adresse ohne Zugangsdaten; Key-Prefixe zählen nur an einer Wortgrenze (`task-list-item` ist kein `sk-`-Schlüssel). Redigiert wird nur, was ein Modell liest; der Pre-Scanner liest die unveränderten Dateien. Das Ergebnis nennt je Zeile Datei und Musterklasse (`result.secret_redactions`).
10. **Upload-Feld:** `contextPackage` neben `diff`, strukturell validiert, höchstens 64 KB Abschnittsinhalt. Ein ungültiges Feld lehnt den Scan mit 422 ab, statt still ohne Kontext zu laufen. Gespeichert wird das geparste Paket, und nur bis der Job startet: der CliDiffLoaderStep ersetzt es als Erstes und ohne Bedingung im Payload durch Pfadliste und Größe (früher als „nach Job-Ende“ aus Frage 3, damit auch nach einem abgebrochenen oder gescheiterten Job nichts liegen bleibt). Ein Job, der nie startet, behält das Paket, bis seine Zeile gelöscht wird.
11. **Aufrufer** (nur CLI, Extension, MCP): Namen, die auf geänderten Zeilen bestehender Dateien deklariert werden, höchstens 10, je höchstens 5 Treffer aus `git grep -w -F`, als Liste `symbol: pfad:zeile`.
12. **Telemetrie:** `review_job_llm_calls.repo_context_tokens` (Migration 055) je Draft- und Verifier-Call, `result.repo_context` je Job (Status, Pfade, Tokens, Bytes, Auslassungen, Obergrenze, Ladezeit, Grund eines Ausfalls). Ohne die Migration schreibt der Call seine Zeile ohne die Spalte.
13. **Rollback ohne Deploy:** `UNSLOP_REPO_CONTEXT_DISABLED=1` schaltet Paket und Condition 12 für jeden Job ab.
14. **Nicht gebaut, wie freigegeben:** A5, A6, Stufe 1c, der Schattenlauf aus §10 und die Kontroll-Fixture „Injection in einer Kontextdatei“ (beide als To-Do in ROADMAP §1).

## 10. Vorregistrierter Messplan

Festgelegt mit dieser Spec, vor dem Bau. Änderungen nur mit Datum und Begründung in dieser Datei.

**Material:** dieselben 40 PRs der Mehrwert-Studie auf `unslopai/test` (#55 bis #94, Branches `av/*`), ausgelöst über den Produktionspfad wie in der Studie (PR schließen und öffnen). Ein Lauf je PR. Ein `review_timeout` wird genau einmal wiederholt, wie in §9.0 der Studie.

**Vergleich:** Die Befunde von Claude Code werden nicht neu erzeugt; es gelten die 397 normalisierten Befunde und ihre Gruppen aus `fixtures/added-value/results/`. Neu eingeordnet werden nur die unslop-Befunde des neuen Laufs: Normalisierung und blinde Einordnung nach §5 der Studie durch einen Subagenten, der nicht weiß, welcher Lauf vorliegt. Dazu die Zuordnung zu den bestehenden Gruppen (gleiche Stelle, gleiche Bedeutung).

**Kennzahlen:** alle aus §6 der Studie, je Segment, dazu je Klasse aus §3 die Zahl der 41 Befunde, die unslop jetzt meldet.

**Zielwerte:**

| Kennzahl | Stand Studie | Ziel nach Stufe 1 | Ziel nach Stufe 2 |
|---|---|---|---|
| Repo-Befunde gesamt (18) | 0 | **mindestens 12** | mindestens 12 |
| davon Schema (9) | 0 | mindestens 6 | |
| davon Manifest (6) | 0 | mindestens 5 | |
| davon Routing, ganze Datei, Aufrufer (3) | 0 | berichtet, kein Ziel (n zu klein) | |
| Diff-Befunde (20) | 0 | berichtet, kein Ziel | **mindestens 10** |
| Laufzeit-Befunde (3) | 0 | berichtet, kein Ziel | berichtet |
| Segment B: Anteil an den blockierenden echten Befunden (48) | 11 (22,9 %) | **mindestens 23 (47,9 %)** | **mindestens 31 (64,6 %)**, also über dem Orientierungswert 60 % aus §7 der Studie |
| Segment A: blockierende Befunde (4) | 0 | berichtet | mindestens 1 |

**Leitplanken (jede gerissene Leitplanke heißt: nicht Default, zurück in die Spec):**

| Leitplanke | Stand Studie | Grenze |
|---|---|---|
| Fehlalarme je PR, Segment B (je Gruppe) | 0,15 | höchstens 0,50 (Wert von Claude Code in der Studie) |
| Fehlalarme je PR, Segment A (je sichtbarem Kommentar) | 1,75 | kein Anstieg um mehr als 0,20 durch die neuen Regeln |
| Präzision der neuen Regeln (Repository Mismatch; in Stufe 2 die offenen Befunde), beide Segmente zusammen | | mindestens 80 % |
| Bisher gefundene blockierende Befunde (11 in Segment B) | 11 | mindestens 10 bleiben gefunden |
| `review_timeout` | 3 von 43 | nicht mehr als in der Studie; zusätzlich mittlere Job-Dauer höchstens 15 s über dem Studienwert (71 s in Segment A, 111 s in Segment B) |
| Kosten je PR (Vertex, Listenpreis) | 0,04 bis 0,10 USD | höchstens 0,15 USD im Mittel |
| Rule-Recall-Benchmark, Produktionspfad | letzter Volllauf | kein Rückgang beim Recall, 0 Fehlalarme auf den Kontroll-Fixtures, neue Kontrolle „Injection in einer Kontextdatei“ ohne Wirkung |

**Budget der Messung:** je Lauf höchstens 5 USD Vertex. Die Studie verbrauchte 15 Eskalationen; zwei Wiederholungen brauchen rund 30 von 50 im Monat. Jeder Lauf startet deshalb erst, wenn der Zähler mindestens 20 freie Eskalationen zeigt, und nennt den Stand vorher und nachher.

**Was die Messung nicht zeigt:** Segment B ist ein Skelett mit genau einem Schema. Ob die Auswahlregeln in großen Repos die richtige Datei treffen, zeigt erst ein Schattenlauf auf echten PRs (`scripts/shadow-run.ts`, Liste `fixtures/shadow-run/langcov-stufe3-prs.json`), bei dem jeder Befund der neuen Regel gesichtet wird. Der Schattenlauf ist Teil von Stufe 1 und hat das Gate „0 falsche CRITICALs“, wie G8 der Sprachabdeckung.

## 11. Nicht im Umfang

- Produktcode, Migrationen, Modellwechsel (auch kein Vergleich mit Gemini 4 Argon).
- Positionierung, Landing, Pricing. Die Zahlen in §6 und §10 sind für Lucas strategische Runde gedacht.
- Die Fehlalarme der Musterregeln aus der Studie (Pfad-Regel in Skripten, Sicherheitsmuster in Teststrings). Sie stehen als eigene To-Dos in ROADMAP §1 und sind unabhängig vom Kontext.
- Das Zeitbudget-Problem aus der Studie (3 Timeouts, hängender Verifier-Call). Eigenes To-Do in ROADMAP §1; es sollte vor Stufe 1 gelöst sein, weil es die Messung sonst stört.

## 12. Offene Fragen an Luca

**Entschieden 2026-10-05 (Luca): alle acht Fragen wie empfohlen.** Zu Frage 2 mit Auflage: Mehr Code als der Diff geht an das Modell, die Wirtschaftlichkeit wird aber gemessen und begrenzt, nicht geschätzt: konfigurierbare Token-Obergrenze für das Paket, Paket-Tokens und Kosten je Job in der Telemetrie, Hochrechnung der Paketgrößen auf allen 40 Studien-PRs vor dem Merge, Leitplanke 0,15 USD je PR im Mittel (Frage 4). Bau: Stufe 1a/1b (Kontextpaket) in einer Session, Stufe 1c zusammen mit den Fehlalarm-Fixes im Pre-Scanner, Zeitbudget separat; danach Messung 1.

1. **Freigabe der Empfehlung:** Option D mit Stufe 1 (Kontextpaket plus Regel „Repository Mismatch“) zuerst, Tool-Use erst nach Messung und Vercel Pro, kein Index-Ausbau. *Empfehlung: ja.*
2. **Mehr Code an das Modell als der Diff:** Im App-Pfad gehen Manifeste, Schema-Dateien und Ausschnitte weiterer Dateien an Vertex, ohne Speicherung bei unslop. Das ändert die Beschreibung in Datenschutzerklärung, AVV und Produkttexten. *Empfehlung: zulassen, als Default an, je Repo abschaltbar (`pipeline_config`); die Rechtstexte in derselben PR wie Stufe 1a anpassen und als Vorbedingung in Stufe A der ROADMAP eintragen.*
3. **Paket im CLI- und MCP-Pfad speichern?** Der hochgeladene Diff liegt heute im Job-Payload (30 Tage, sobald Migration 052 läuft). *Empfehlung: Das Paket nach Job-Ende aus dem Payload entfernen und nur Pfadliste und Größe behalten. Kostet die Möglichkeit, einen Job später mit demselben Kontext nachzustellen.*
4. **Kostenrahmen je PR:** Stufe 1 hebt die Vertex-Kosten je PR um 0,005 bis 0,03 USD (Liste), Stufe 3 um 0,05 bis 0,10 USD. *Empfehlung: Stufe 1 ohne Aufpreis in allen Plänen; Leitplanke 0,15 USD im Mittel je PR; über Stufe 3 erst mit den Zahlen aus Messung 1 entscheiden.*
5. **Bestehender Skeleton-Index:** Er liefert nach Lage der Daten fast nie Evidence (2 von 264 Jobs mit Indikator, §2.3), speichert aber Skelette von Kundencode. *Empfehlung: nicht erweitern, vorerst behalten, und nach Messung 1 entscheiden, ob er entfällt. Entfällt er, vereinfachen sich AVV, Löschpfad und die Aussage auf der Landing.*
6. **Offene Fehlersuche (Stufe 2) als Produktaussage:** Offene Befunde sind keine Regelverstöße und nicht im selben Maß reproduzierbar. *Empfehlung: nur als WARNING, getrennt gekennzeichnet, nur nach CONFIRMED des Verifiers, ohne Einfluss auf den Integrity Score; Default erst, wenn die Leitplanken aus §10 halten.*
7. **Reihenfolge gegenüber den Fehlalarm-To-Dos:** Die Studie zeigt 65 bis 68 % Präzision auf Agenten-PRs, fast ganz aus zwei Musterregeln. *Empfehlung: Diese beiden Regeln (ROADMAP §1, Punkte a und b der Fehlalarme) und das Zeitbudget-To-Do vor Messung 1 beheben, damit die Wiederholung den Kontext misst und nicht die alten Fehlalarme.*
8. **Eskalationskontingent für die Messungen:** Zwei Wiederholungen brauchen rund 30 Eskalationen. *Empfehlung: Messung 1 und 2 in verschiedene Kalendermonate legen oder den Zähler des Dogfooding-Kontos für die Messung anheben; das ist eine Entscheidung über bezahlte Läufe.*

## 13. Blocked: tooling

- **Trefferquote der Evidence-Search aus den Logs:** Vercel-Runtime-Logs reichen auf Hobby eine Stunde zurück, die Abfrage nach `[RagLoader]` über 7 Tage war leer. Die Quote ist damit ungeprüft, nicht null. Ersatzindikator in §2.3.
- **Vertex-Doku zu Function Calling mit Explicit Cache:** Die Seiten ließen sich nicht laden. Die Aussage in §4 stützt sich auf die Gemini-API-Referenz, die Firebase-Doku und den eigenen Befund F1.
- **Einzelne Herstellerseiten** (CodeRabbit „Agentic vs. RAG“, LanceDB-Fallstudie, Qodo-Doku zum dynamischen Kontext, Greptile-Doku zur Index-Aktualisierung) ließen sich nicht laden; die betroffenen Angaben sind als „Snippet“ oder „nicht belegt“ markiert.

- **Kosten des ersten Laufs der Regressionsprobe vom 2026-10-05** (r05, r10, r13, r18, r25): Der Benchmark-Runner löscht seine Jobs ohne `--keep`, die Telemetrie-Zeilen sind damit weg; `benchmark-cost.ts` fand 0 Calls. Die Kosten dieses einen Laufs sind nicht gemessen. Der zweite Lauf derselben Fixtures mit `--keep` kostete 0,1231 USD.
- **Pull Requests aus Forks:** nicht geprüft, weil die Session keine Test-PRs öffnen durfte. Kein Befund über das Verhalten.

## Anhang A: Rohantworten der Probe

Je Call: Regel, Schweregrad, Zeile, Konfidenz und Begründung, wörtlich aus der Modellantwort; `exact_quote` und `fixed_code_snippet` sind weggelassen.

**Qwen t06 (test#90, `services/catalog/main.go`)**

- *V1 nur Diff* (5881 Prompt-Tokens, davon 4673 aus dem Cache, 1548 Output-Tokens, 11.8 s, $0.0078, `explicit_created`), `has_slop: false`, 0 Issues:
  - Summary: „No AI slop found.“
- *V2 Diff + Kontextpaket* (6261 Prompt-Tokens, davon 4673 aus dem Cache, 18842 Output-Tokens, 128.9 s, $0.0794, `explicit_created`), `has_slop: true`, 2 Issues:
  - `MAINT-005`, WARNING, Zeile 11, Konfidenz 95: „The code imports 'github.com/mattn/go-sqlite3', which is an undeclared external dependency not present in go.mod. Furthermore, the repository is configured for PostgreSQL using 'github.com/lib/pq', making this an unjustified and unmanaged dependency that breaks builds.“
  - `SEC-007`, CRITICAL, Zeile 59, Konfidenz 95: „Invoking http.ListenAndServe without configuring an http.Server with explicit ReadTimeout, ReadHeaderTimeout, and WriteTimeout exposes the service to unbounded resource consumption and Slowloris denial-of-service attacks.“
  - Summary: „Flagged an undeclared external dependency not tracked in go.mod (MAINT-005) and unbounded HTTP server execution lacking read/write timeouts (SEC-007).“
- *V3 Diff + Kontextpaket + Auftragssatz* (6362 Prompt-Tokens, davon 4673 aus dem Cache, 2247 Output-Tokens, 16.6 s, $0.0110, `explicit_created`), `has_slop: true`, 2 Issues:
  - `CONTEXT (Repository Mismatch)`, CRITICAL, Zeile 11, Konfidenz 98: „The package 'github.com/mattn/go-sqlite3' is imported but is not declared in 'services/catalog/go.mod', which configures 'github.com/lib/pq' instead.“
  - `CONTEXT (Repository Mismatch)`, CRITICAL, Zeile 34, Konfidenz 95: „The query selects column 'price', but 'db/schema.sql' specifies the column as 'price_cents' in the 'products' table.“
  - Summary: „Found repository mismatches: 'services/catalog/main.go' imports an undeclared sqlite3 driver instead of the declared 'github.com/lib/pq' driver, and queries a non-existent 'price' column instead of 'price_cents' defined in db/schema.sql.“

**Qwen t03 (test#87, `web/app/api/contact/route.ts`)**

- *V1 nur Diff* (5586 Prompt-Tokens, davon 4622 aus dem Cache, 2211 Output-Tokens, 15.6 s, $0.0103, `explicit_created`), `has_slop: true`, 1 Issues:
  - `Condition 5 (Dead Code)`, WARNING, Zeile 12, Konfidenz 98: „The variable 'db' is initialized with the result of a dummy connection query but is never read or referenced. @vercel/postgres manages connections automatically, making this redundant dead code.“
  - Summary: „Detected dead code where an unused variable 'db' is initialized with a redundant SQL query.“
- *V2 Diff + Kontextpaket* (6270 Prompt-Tokens, davon 4622 aus dem Cache, 4879 Output-Tokens, 46.7 s, $0.0219, `explicit_created`), `has_slop: true`, 1 Issues:
  - `Condition 5 (Dead Code)`, WARNING, Zeile 12, Konfidenz 98: „The variable 'db' is initialized by executing a dummy database query but is never subsequently read or used anywhere in the handler.“
  - Summary: „Detected dead code where an unused variable 'db' is initialized via a dummy query.“
- *V3 Diff + Kontextpaket + Auftragssatz* (6371 Prompt-Tokens, davon 4622 aus dem Cache, 2994 Output-Tokens, 32.7 s, $0.0142, `explicit_created`), `has_slop: true`, 3 Issues:
  - `CONTEXT (Repository Mismatch)`, CRITICAL, Zeile 2, Konfidenz 98: „The package '@vercel/postgres' is not declared in web/package.json. The repository uses 'pg' for PostgreSQL connectivity.“
  - `Condition 5 (Dead Code)`, WARNING, Zeile 13, Konfidenz 95: „The variable 'db' is initialized with a query result but is never read or used anywhere in the function.“
  - `CONTEXT (Repository Mismatch)`, CRITICAL, Zeile 17, Konfidenz 99: „The database schema defined in db/schema.sql defines the table as 'contact_messages', not 'contact'. This query will fail at runtime.“
  - Summary: „Found critical repository mismatches including an undeclared dependency ('@vercel/postgres'), a non-existent database table ('contact' instead of 'contact_messages'), and unused dead code.“

**Flash-Lite t02 (test#76, `services/auth/login.js`)**

- *V1 nur Diff* (6192 Prompt-Tokens, davon 4622 aus dem Cache, 2415 Output-Tokens, 23.9 s, $0.0116, `explicit_hit`), `has_slop: true`, 3 Issues:
  - `SEC-005`, CRITICAL, Zeile 8, Konfidenz 100: „A hardcoded secret key is stored directly in source code, exposing cryptographic credentials. Secrets must be loaded from environment variables or a secret manager.“
  - `SEC-012`, CRITICAL, Zeile 23, Konfidenz 98: „Plaintext password storage detected. User credentials must be salted and hashed using a modern key derivation function (e.g., bcrypt, argon2, or scrypt).“
  - `SEC-021`, WARNING, Zeile 31, Konfidenz 92: „The login authentication endpoint does not implement rate limiting or attempt throttling, exposing it to brute-force and credential stuffing attacks.“
  - Summary: „Flagged critical security issues including a hardcoded JWT secret, plaintext password storage, and an unthrottled authentication endpoint vulnerable to brute-force attacks.“
- *V2 Diff + Kontextpaket* (6740 Prompt-Tokens, davon 4622 aus dem Cache, 3308 Output-Tokens, 22.5 s, $0.0158, `explicit_hit`), `has_slop: true`, 3 Issues:
  - `[SEC-005]`, CRITICAL, Zeile 8, Konfidenz 100: „A JWT secret is hardcoded directly in the source file. Secrets must be read from environment variables or a secrets manager to avoid credential exposure.“
  - `[SEC-012]`, CRITICAL, Zeile 23, Konfidenz 98: „Plaintext password storage and comparison. Passwords must be hashed using a slow, salted key derivation function such as bcrypt.“
  - `[SEC-021]`, WARNING, Zeile 31, Konfidenz 92: „The authentication endpoint lacks rate limiting or account lockout mechanisms, exposing the service to brute-force and credential-stuffing attacks.“
  - Summary: „Detected critical security violations in the new login service: hardcoded JWT secret, plaintext password storage/comparison, and absence of rate limiting on the authentication route.“
- *V3 Diff + Kontextpaket + Auftragssatz* (6841 Prompt-Tokens, davon 4622 aus dem Cache, 2476 Output-Tokens, 25.0 s, $0.0124, `explicit_hit`), `has_slop: true`, 5 Issues:
  - `[SEC-005]`, CRITICAL, Zeile 8, Konfidenz 100: „A hardcoded secret key is stored directly in source code instead of being loaded from environment variables or a secure secret store.“
  - `CONTEXT (Repository Mismatch)`, CRITICAL, Zeile 16, Konfidenz 98: „User records are stored in an in-memory array despite the repository defining a persistent PostgreSQL `users` table in `db/schema.sql` and providing the `pg` client in `services/auth/package.json`.“
  - `[SEC-012]`, CRITICAL, Zeile 44, Konfidenz 100: „Passwords are verified via direct plaintext equality checks rather than using a secure cryptographic hashing function such as bcrypt.“
  - `[SEC-021]`, WARNING, Zeile 31, Konfidenz 95: „The authentication endpoint handles login credential verification without rate limiting or request throttling, leaving it susceptible to brute-force attacks.“
  - `CONTEXT (Repository Mismatch)`, CRITICAL, Zeile 94, Konfidenz 96: „The file creates an independent Express HTTP listener on port 3000 rather than mounting routes on the service's existing entry point (`services/auth/server.js`, which listens on port 4000).“
  - Summary: „Pull request introduces tutorial-style mock code containing hardcoded credentials, plaintext password verification, in-memory state bypassing the PostgreSQL schema, unthrottled login endpoints, and duplicate server initialization conflicting with the auth service entry point.“
