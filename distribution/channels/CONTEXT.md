# CONTEXT: Was unslop heute ist, was kommt, was wir sagen dürfen

Stand **2026-09-29**, geprüft im Code, gegen die Live-Site und gegen die arXiv-Volltexte der zitierten Studien.
Jeder Kanal-Ordner (`01-x` … `05-producthunt`) prüft seine Texte gegen diese Datei. Wo diese Datei und ein Post sich widersprechen, gilt diese Datei.

**Bottom Line:**
- Öffentlich erreichbar ist heute nur die Landing Page `unslop.codes` (EN/DE).
- Alle Produktflächen (GitHub App, CLI, VS Code, MCP) sind gebaut und laufen für drei bestehende Accounts. Ein neuer Nutzer kann sie aber nicht benutzen:
  - Die Registrierung ist gesperrt (`disable_signup = true`).
  - npm und der VS Code Marketplace liefern 404.
  - Die Waitlist und die Rechtsseiten liegen hinter Flags.
- Die Gründerentscheidung lautet: **„nichts Öffentliches vor dem HR-Eintrag“** (`docs/specs/WAITLIST_SPEC.md:4`). Kein Kanal-Post darf deshalb vor dem Eintragungstag raus, und keiner vor einem erreichbaren Impressum.

---

**Hinweis zu allen Texten in diesem Paket:** Sie sind mit KI-Unterstützung entworfen. Drei Plattformen reagieren darauf ausdrücklich:

| Plattform | Regel bzw. Praxis | Folge für die Texte |
|---|---|---|
| **Hacker News** | Verbietet LLM-Text in Show HN: „not even a tiny bit, including to edit or spruce it up“ (`04-hackernews/RESEARCH.md` §1.4) | Die HN-Dateien sind deshalb nur Faktenblatt und Referenz. Der Gründer schreibt den Post selbst |
| **Reddit** | Mehrere Subs entfernen LLM-geschriebene Posts (`03-reddit/RESEARCH.md` §6) | Der Gründer schreibt sie in eigenen Worten neu |
| **LinkedIn** | Drosselt generisch wirkenden KI-Content (`02-linkedin/RESEARCH.md` §3.1) | vor dem Posten in die eigene Stimme bringen |

Für X gilt dasselbe als Empfehlung. Die Fakten, Zahlen und Grenzen in den Texten sind geprüft (jeweils `CHECK.md`). Die Stimme muss die des Gründers sein.

---

## 1. Feature-Tabelle

Status-Definitionen (Auftrag): **live** = im Code und für einen neuen, externen Nutzer heute nutzbar · **gebaut, nicht veröffentlicht** = Code fertig, aber hinter Flag / unpubliziert / Signup gesperrt · **in Arbeit** = Code angefangen, unvollständig · **geplant** = nur Roadmap/Docs, kein Code.

Wie die Tabelle geprüft wurde:
- im Code (Datei:Zeile), nicht in Texten;
- live per `curl`, `npm view`, Marketplace-Abruf und `GET /auth/v1/settings` (29.09.2026, 19:52 UTC).

Fundstellen der Live-Receipts: Chronik in `ROADMAP.md`.

### Produkt

| Feature | Status | Fundstelle im Repo | Anmerkung für Posts |
|---|---|---|---|
| Landing Page EN/DE | **live** | `src/app/(marketing)/`, `messages/en.json` `marketing.*`; `curl https://unslop.codes/en` ⇒ 200 | Einzige öffentlich nutzbare Fläche. Keine Tracking-Skripte (nur `/_next/*`). |
| GitHub App: Check Run `Anti-Slop Gatekeeper` | gebaut, nicht veröffentlicht | `src/lib/check-run.ts:19,45,77`; Receipt unslopai/test#13, unslopai/unslop#10 (Bot `unslop-gatekeeper[bot]`) | Titel: „Reviewing for AI slop…“, „1 critical slop finding“, „No AI slop found“ |
| Check-Fazit: failure bei ≥ 1 CRITICAL, sonst neutral/success | gebaut, nicht veröffentlicht | `check-run.ts:155-193` | WARNINGs blockieren nie. Required-Check ist Entscheidung des Kunden (Branch Protection). |
| PR-Review-Kommentare mit Regel-ID + 1-Klick-`suggestion` | gebaut, nicht veröffentlicht | `src/lib/pipeline/helpers.ts:487-509` (`mapIssueToPrComment`) | Reviews immer `COMMENTED`, nie `REQUEST_CHANGES` |
| Neuer Review bei jedem Push (`opened/synchronize/reopened`), Re-Run-Button | gebaut, nicht veröffentlicht | `src/app/api/webhook/route.ts:57,97-99` | Jeder Push wird **für sich** geprüft, ohne Vergleich mit der Vorrevision |
| Vergleich Revision gegen Revision („If quality drops, the build fails“) | **in Arbeit** (nur Vorstufe) | `result-persister-step.ts:122-175`: nur `reroll_count` (gleiche Findings erneut), Hinweis im CLI-Poll | **Nicht behaupten.** Die Landing behauptet es (siehe §6) |
| CLI `unslop scan` (`@unslopcodes/cli` 0.1.0): `--fix`, `--dry-run`, `--fail-on`, `--json`, `--base`, `login`/`logout` | gebaut, nicht veröffentlicht | `packages/cli/src/index.ts:53-69`, `format.ts`; `npm view @unslopcodes/cli` ⇒ E404 | **Nie `npx unslop` schreiben**: das unscoped Paket `unslop` gehört einem Dritten (Archiv L548) |
| Secret-Filter vor jedem Upload (CLI/Extension/MCP) | gebaut, nicht veröffentlicht | `diff-upload-guard.ts`; ROADMAP Chronik 2026-08-09/24 | Kein Garantie-Claim. Im PR-Pfad gibt es keinen serverseitigen Filter (ROADMAP §2) |
| VS-Code-Extension (Diagnostics, „Apply Gatekeeper Fix“, Statusleiste) | gebaut, nicht veröffentlicht | `packages/vscode-extension/` (`private: true`); Marketplace `unslop.unslop-vscode` ⇒ 404 | Braucht die CLI. Nach einem Fix kein Auto-Rescan. |
| MCP-Server, 5 Tools (`unslop_scan`, `unslop_get_result`, `unslop_connect_repo`, `unslop_review_pr`, `unslop_resolve_finding`) | gebaut, nicht veröffentlicht | `packages/mcp/src/server.ts:48-104`; `npm view @unslopcodes/mcp` ⇒ E404 | |
| Deterministischer Pre-Scanner | gebaut, nicht veröffentlicht | `packages/prescan/src/rules/registry.ts`: **55 Regel-IDs** (regex 13, tree-sitter 18, config 17, eslint 5, registry 2), ~25 Dateitypen | In der Kaskade immer aktiv. Deckt nicht alle 119 Regeln ab (siehe §6) |
| LLM-Review (Draft → Blind-Verifier → Eskalation) | gebaut, nicht veröffentlicht | `src/lib/pipeline/models.ts:114-116`, Temperatur 0 `models.ts:179` | **Nur JS/TS** (`helpers.ts:381`). `pro-direct` überspringt den Verifier (`claim-verifier-step.ts:55`) |
| Cognitive Integrity Score 0–100 | gebaut, nicht veröffentlicht | `integrity-scorer-step.ts`, CLI `format.ts` | Misst die Konfidenz des Reviews, **nicht** die Code-Qualität |
| Slop-Score-Gate (`minIntegrityScore`) | gebaut, nicht veröffentlicht | `defaults.ts:64` (Default 0), nur für Operatoren (`api/repos/[id]/settings/route.ts:40`) | Kunden können es heute nicht einschalten. Kein Live-Receipt |
| Datenverarbeitung auf der Vertex-`eu`-Multiregion | gebaut, nicht veröffentlicht | ROADMAP §5 „GDPR-Stand“ | Der Rollback-Pfad `UNSLOP_ESCALATION_LEGACY_PRO` ist `global`. Frist 2026-10-14 zum Durable Caching (ROADMAP §0) |
| Dashboard (Repos, Scan-Historie, Keys, Billing, Onboarding) | gebaut, nicht veröffentlicht | `src/app/dashboard/**`; live `/dashboard` ⇒ 307 | |
| Webhook-HMAC, AES-256-GCM für Tokens | gebaut, nicht veröffentlicht | `src/lib/crypto.ts:10,58`, `webhook/route.ts` | Der Claim ist im Code belegt |
| Waitlist (Brevo, Double Opt-in, EU) | gebaut, nicht veröffentlicht | `src/lib/waitlist/`, `api/waitlist/route.ts:25`; live `POST /api/waitlist` ⇒ 404 | Geht mit dem HR-Eintrag live (WAITLIST_SPEC §7). Copy: „We email you when the private beta opens, nothing else.“ |
| Rechtsseiten (Impressum, Datenschutz, Terms, Refund, AVV) | gebaut, nicht veröffentlicht | `src/lib/legal/legal-pages.ts:15`; live `/en/privacy`, `/en/impressum` ⇒ 404 | **Vor jedem Post Pflicht** (Impressumspflicht) |
| Billing Pro (Paddle, Merchant of Record) | gebaut, nicht veröffentlicht | `src/lib/billing/plan-config.ts:45-61`; Env `sandbox` | Preis steht im Paddle-Katalog, nicht im Code. Prod-Cutover *blocked: incorporation* |
| Pricing-Seite | geplant | ROADMAP §4 (3-Spalten-Kandidat); live `/en/pricing` ⇒ 404 | |
| Brevo-Lifecycle (Beta-/Launch-Mails, Trial-Drips, Monatsreport, Win-back) | geplant (nur DOI gebaut) | WAITLIST_SPEC §8 | „≤ 5 Mails bis Launch“ |
| Docs-Site, Changelog, Blog, Vergleichsseiten | geplant | ROADMAP §10; live `/en/docs` ⇒ 404 | |
| Teams & Orgs (Seats, Members) | in Arbeit (nur Schema) | `supabase/migrations/032_paddle_billing_accounts.sql:16` (`kind in ('personal','team')`) | UI, Auth und Seats fehlen |
| Suppression-/Bypass-Audit-Ledger | in Arbeit (Basis gebaut) | Append-only `finding_suppressions` über MCP `unslop_resolve_finding` (Migration 037); Enterprise-Ausbau ROADMAP §9 | Geplant ist ein Audit-Ledger für Enterprise. **Heute ohne Lesepfad** (MCP_SPEC §4.4: „The ledger has no read surface in v1“): Ein verworfenes Finding erscheint bei späteren Scans wieder. Nie „dismissed findings stay dismissed“ schreiben |
| Zweiter Anbieter als Verifier (Cross-Vendor, „Consortium Consistency“) | geplant | ROADMAP §5, `UNIT_ECONOMICS.md` §9.2 | Heute nur Vertex/Gemini |
| Multi-Model-Konsens + Codebase-Zertifikat pro Commit-SHA | geplant (Vision, post-launch) | ROADMAP §11 | Öffentlich nur als Nutzen-Aussage erlaubt, siehe §5 |
| Kaskade als Infrastruktur-API (`@unslop/router`) | geplant (Vision, post-launch) | ROADMAP §11 | |
| CTO-Dashboard mit Score über die Zeit („18-Month-Wall“) | geplant (Idee, braucht Marktvalidierung) | ROADMAP §9 | |
| GitLab / Bitbucket, Enterprise EU Hosting | geplant (Vision, „nicht geplant“) | ROADMAP §6 | Nicht in Posts versprechen |
| „Verified Cloud“ | **nicht im Repo** | kein Treffer | Nicht verwenden, bis es spezifiziert ist |

### Preise und Pläne

| Plan | Status | Repo-Stand | Angabe des Gründers | Widerspruch |
|---|---|---|---|---|
| Pro | gebaut, nicht veröffentlicht (Paddle-Sandbox) | €29/Monat (`PADDLE_SPEC.md:15,53`; Sandbox-Overlay „29,00 € inkl. MwSt.“); 500 Scans, 50 Pro-Eskalationen, 60 Scans/h, 10 Repos, 10 API-Keys (`plan-config.ts:45-61`, `PADDLE_SPEC.md:167`); 14-Tage-Trial mit Karte, 100 Scans + 5 Eskalationen | 29 €/Monat, 500 Scans, 50 Pro-Eskalationen | keiner. Ergänzungen aus dem Repo: 14-Tage-Trial, Repo-/Key-Limits |
| Pro Max | geplant | €79, 2.000 Scans, 200 Eskalationen (`UNIT_ECONOMICS.md:204`); ROADMAP §4: „Tier-Entscheidungen offen“ | 79 €, 2.000 Scans, 200 Eskalationen | Zahlen gleich. Im Repo ist der Plan **nicht entschieden** („when the first users hit the 500 cap“, `UNIT_ECONOMICS.md:312`) |
| Team / Enterprise | geplant (nur Optionen) | €249/Seat Team-Tier, €299/350-Scan-Seat, Overage €0,89/Scan (`UNIT_ECONOMICS.md:272-274`, ROADMAP §4); Cap bei €299: 350 (l.272) vs ~370 (l.267) im selben Dokument | 249–299 €/Monat mit Multi-Model-Konsens, Cross-Vendor, Verified Cloud, Overage-Billing, Audit-Zertifikaten | Im Repo **pro Seat**, nicht pro Monat pauschal, und nur Optionen. „Verified Cloud“ fehlt. Konsens und Zertifikate sind Vision (ROADMAP §11), nicht an einen Preis gebunden |

**Regel für Posts:**
- Preise nennen wir erst, wenn Paddle live ist.
- Bis dahin höchstens „Pro €29/month is planned for launch“, und nur dort, wo Preise zwingend gefragt werden (Product Hunt, HN-FAQ).
- Pro Max und Team/Enterprise erscheinen ohne Preis, nur als „planned“.

---

## 2. Launch-Status (heute öffentlich erreichbar?)

| Fläche | Heute | Was fehlt | Beleg |
|---|---|---|---|
| Landing `unslop.codes` | ja | Impressum/Datenschutz verlinkt, Waitlist statt `/login`-CTA | `curl` 200 |
| Login / Registrierung | nur 3 bestehende Accounts | Supabase „Allow new users to sign up“ am Launch-Tag (ROADMAP §6) | `/auth/v1/settings`: `disable_signup=True` |
| GitHub App | unklar, ob öffentlich installierbar (**blocked: tooling**: `api.github.com/apps/<slug>` vom Proxy gesperrt, Slug nur als Env) | Signup + Paddle live; ohne Abo gibt es `action_required` | `src/lib/github-app.ts:107-114`; Bot-Seite `github.com/apps/unslop-gatekeeper` erscheint in der API-Antwort |
| npm `@unslopcodes/cli`, `@unslopcodes/mcp` | nein (E404) | `npm publish` + `NEXT_PUBLIC_CLI_DISTRIBUTION_LIVE=true`, CI fehlt (`.github/` gibt es nicht) | ROADMAP §3, §6 |
| VS Code Marketplace | nein (404) | Publish, `private: true` entfernen | `packages/vscode-extension/package.json` |
| MCP (Registries) | nein | npm-Publish; keine Registry-Planung im Repo | — |
| Waitlist | nein (404) | HR-Eintrag, Impressum, Datenschutz, Brevo-Env in Vercel, `news.unslop.codes` authentifizieren | WAITLIST_SPEC §7, ROADMAP §10 |
| Rechtsseiten | nein (404) | HR-Eintrag (Platzhalter HRB, USt-IdNr.) | ROADMAP §2 |
| Paddle live | nein | *blocked: incorporation* | ROADMAP §4 |
| Termine | keine Launch-Termine im Repo | Platzhalter im Fristenkalender: Notartermin T = 15.10.2026, Eintragung E = 05.11.2026 (`docs/company/fristenkalender.md:9-10`; Eintragung „dauert 1 bis 3 Wochen“) | Nicht öffentlich nennen |

Der Waitlist-Flag hat drei Phasen (WAITLIST_SPEC §4.1):

| Phase | Zustand |
|---|---|
| heute bis HR-Eintrag | nichts live |
| HR-Eintrag bis Launch | Waitlist live, Produkt geschlossen („private beta“) |
| Launch | Signup offen, npm und Marketplace publiziert, Waitlist aus |

Die Kanäle sind entlang dieser Phasen geplant (`PLAN.md`).

**Sprachregel „Private beta“:** Der Stempel „Private beta“ ist die Kennzeichnung für „gebaut, nicht veröffentlicht“, so wie der Auftrag sie erlaubt („coming soon“ / „in beta“). Die Waitlist-Copy sagt „We email you when the private beta opens“: Aus Sicht der Leser ist die Beta also **geschlossen**. Heute gibt es nur interne Accounts (drei GitHub-Identitäten, alle vom Team).
- Posts sagen „in private beta“, „access is closed“ oder „not public yet“.
- Posts sagen nie „our beta users“, „teams using unslop“ oder Ähnliches, solange es keine externen Beta-Nutzer gibt.

---

## 3. Zielgruppen und ihr Schmerz

| Zielgruppe | Schmerz (in ihren Worten) | Was unslop heute belegbar dagegen tut | Was sie ablehnt |
|---|---|---|---|
| **Solo-Entwickler, Freelancer, kleine Teams** (LEGAL_PAGES_SPEC E1: „Solo-Entwickler sind Zielgruppe“) | „Der Agent hat 40 Dateien geändert, ich hab nicht alles gelesen.“ „Regenerate hat's schlimmer gemacht.“ Kein Senior, der reviewt. | Ein Befehl vor dem Push (`unslop scan`), Fix per Klick oder `--fix`, Check am PR. Preis Pro €29 (geplant zum Launch) | Noch ein Abo, Dashboard-Pflicht, Lock-in, „AI-powered“-Floskeln |
| **Senior Engineers, Tech Leads** (Film-BRIEFs 01–03) | KI-Reviewer halluzinieren oder nicken KI-Code ab („AI grading AI's homework“). Vibe-Coding-PRs mit verschluckten Fehlern, erfundenen APIs, Tests ohne Assertions | Regel-ID pro Finding, Blind-Verifier, deterministischer Pre-Scanner für 55 Regeln, ehrliche Degradationshinweise („Nothing was reviewed — this is NOT a clean verdict.“) | Überzogene Zahlen, „deterministic“ als Buzzword, geschlossene Rezepte ohne Belege, Marketing-Sprech, LLM-Wrapper |
| **CTOs, VPs of Engineering** | Versteckte technische Schulden durch unkontrollierten KI-Einsatz; keine messbare Codebase-Integrität; keine Quality Gates, die auch bei 10× mehr PRs halten | Heute: Gate pro PR (CRITICAL ⇒ failure), Score pro Review, EU-Verarbeitung. **Roadmap:** Score über die Zeit, Audit-Ledger, Cross-Vendor-Verifikation, Codebase-Zertifikat | Vendor-Versprechen ohne Datum, Compliance-Theater, Angst-Marketing |
| Später: CISOs, Banken, Versicherungen, VCs | Nachweis über die Qualität zugekauften Codes | Zertifikat (geplant) | **Jetzt nicht direkt ansprechen.** Zertifikats-Inhalte richten sich an CTOs |

---

## 4. Freigegebene Claims: exakte Formulierung und Quelle

Laut Auftrag gilt die Fact Discipline aus `docs/strategy/MARKETING_CLAIMS.md` §0 ohne Ausnahme. Ich habe jede Zahl gegen den **arXiv-Volltext** geprüft (PDFs am 29.09. geladen, Textauszug mit pypdf).
- Weicht die Repo-Formulierung vom Paper ab, gilt die Formulierung des Papers; der Widerspruch steht in §6.
- **Nur die Zeilen dieser Tabelle dürfen in Posts stehen.**

### 4a. Zahlen aus der Forschung (Drittstudien, nie „we measured“)

| # | In Posts verwenden (Formulierung) | Paper-Wortlaut (Volltext) | Repo-Wortlaut (MARKETING_CLAIMS / Landing) | Quelle | Einsatz |
|---|---|---|---|---|---|
| C1 | **„In a 955-vs-955 matched-control study, AI-attributed files showed 0.435 high-severity findings per file versus 0.242 in human controls, a 1.80× excess.“** | „AI-attributed files show 0.435 high-severity findings per file versus 0.242 in human controls, a 1.80× excess“ | „1.80x more high-severity findings per file in AI code vs. matched human code“ | AIRA, arXiv 2604.17587 (Studie 3) · Golden DB SEC-031 | **Stärkste Zahl, uneingeschränkt nutzbar** |
| C2 | **„In the same paper, a secondary comparison using a cloud LLM evaluator produced findings at a 44:1 ratio below the deterministic scanner. The author calls it exploratory: one model, one codebase.“** | „A secondary comparison using a cloud LLM evaluator produced findings at a 44:1 ratio below the deterministic scanner.“ §5.5: „presented as a secondary exploratory finding, not as primary evidence“; Modell `minimax-m2:cloud` via Ollama; Einzeldateien: 7 von 7 bzw. 8 von 8 FAILs als PASS | Landing-H1 „Your AI reviewer misses 44× more bugs than a parser.“; MARKETING_CLAIMS „44x fewer issues found by an LLM judge vs. a deterministic AST scan“ | arXiv 2604.17587 §5.5, Tab. 9/10 · PROC-001, SEC-031 | **Nur mit Einordnung.** Nie als Headline oder Hook auf HN/Reddit |
| C3 | **„Across 10 ‘improvement’ iterations, average vulnerabilities per sample rose from 2.1 (first iterations) to 4.7 (iterations 3–7) to 6.2 (iterations 8–10).“** | „First iterations … average 2.1 per sample … Middle iterations (3-7) … average 4.7 … Later iterations (8-10) … average 6.2“; „F(9,90) = 14.32, p <0.001, η2 = 0.42“; Tukey: signifikant 1–3 vs. 8–10, „but not between adjacent iterations“ | „2.1 → 4.7 → 6.2 per sample — every round, without exception, even with an explicitly security-focused prompt (… p ≪ 0.001)“ | arXiv 2506.11022 (IEEE-ISTAS 2025) · PROC-002 | Nutzbar. **Nie „every round“**. Ein Modell nennen (GPT-4o, Temperatur 0.7). Security-fokussierte Prompts hatten die wenigsten Schwachstellen (38), aber „even explicitly asking for security improvements was associated with new vulnerabilities“ |
| C4 | **„Among security-focused prompts, 27% of iterations resulted in net security improvements.“** | Wortgleich | „27% of cases where LLM ‘self-correction’ actually made code more secure“ | arXiv 2506.11022 §F · PROC-002 | Nutzbar mit dieser Einschränkung |
| C5 | **„Claude-sonnet-4.5 reached 96.20% Pass@1 on generated tests but a 63.70% real detection rate against semantic mutants (SWE-Mutation).“** | Tab. 3 (Mini-Swe-Agent): Pass@1 96.20, RDR 63.70 | „96.2% vs 63.7% test pass rate vs. real defect detection — the coverage illusion, measured on a frontier model“ | arXiv 2605.22175 · TEST-005 | Nutzbar, Modell nennen |
| C6 | **„205,474 unique hallucinated package names across 576,000 code samples.“** | „576,000 code samples“, „205,474 unique examples of hallucinated package names“ | wie Paper | arXiv 2406.10279 · SEC-035 | Nutzbar |
| C7 | **„43% of hallucinated packages were repeated in all 10 queries of the same prompt.“** | „43% of hallucinated packages were repeated in all 10 queries, while 39% did not repeat at all“ | „43% of them recur deterministically“ | arXiv 2406.10279 | Nur in dieser Form |
| C8 | **„Up to 77% of LLM-generated test classes were ‘Unknown Test’ smells (no assertion), versus 0–7% for EvoSuite.“** | „Unknown Test (UT) reaches up to 77% in LLMs but remains almost absent in EvoSuite (0–7%)“ (Klassenebene) | „Up to 77% of LLM-generated test methods contain zero assertions“ | arXiv 2410.10628 · TEST-001 | Nutzbar mit „test classes“ |
| C9 | **„GPT-4 and Claude models correctly identify the vulnerability type in 40% of the cases“** (52 exploited DeFi contracts, GPT-4-32k and Claude-v1.3, 2023) | wortgleich im Abstract | wie Paper, plus 1,318 FP / F1 ≈ 0.076 (im Abstract nicht enthalten, Volltext nicht gezielt geprüft) | arXiv 2306.12338 · SEC-051 | Mit Jahr und Modellen; FP/F1 nicht nutzen |
| C10 | **„Copilot Chat fixed 34.4% of code smells with a general fix prompt and 87.1% when the prompt named the specific smell.“** (Python code smells in Copilot-generated code) | Tab. 4: „General Fix Prompt … 34.4%“, „Specific Code Smell Fix Prompt … 87.1%“ | „telling the fixer the exact violated rule lifts repair success from 34.4% to 87.1%“ | arXiv 2401.14176 (ASE ’24) · PROC-003 | Nutzbar mit Kontext „code smells“ – das ist das Argument dafür, dass jedes Finding seine Regel-ID nennt |

**Nicht in Posts verwenden** (nur Golden DB, im Volltext nicht geprüft, oder falsch attribuiert):
- Precision 1.00 vs 0.50–0.67: laut Paper eine Android-API-Migration, „preliminary“.
- 9.1 % Wrong-Answer-Fix-Rate: das Abstract sagt „more than 89% of vulnerabilities successfully addressed“.
- +41–42 % durch Security-Prompting: das Paper 2605.24300 liegt nicht im Korpus.
- 100 % OAuth.
- 0/12 Security-Header.
- 69–98,6 % Denylists.
- 10 von 10 TOCTOU: falsches Paper zitiert, korrekt wäre 2603.00476.
- 81,6 % → 63,8 %: das sind SWE-bench-Resolve-Raten, keine Defekterkennung.
- Die Zahlen aus dem deutschen Research-PDF (METR 19 %, +21,42 % Design Smells): ohne Quellenangabe, nicht freigegeben.

### 4b. Produkt-Claims (was der Code belegt)

| Claim (so formulieren) | Beleg | Status des Features |
|---|---|---|
| „119 research-backed rules“ | Golden DB 119 Zeilen/IDs; ROADMAP „119 Golden-Regeln live“ | gebaut, nicht veröffentlicht |
| „55 of them have a deterministic detector in the pre-scanner; the rest are checked by an LLM reviewer whose findings go through a blind verification pass“ | `packages/prescan/src/rules/registry.ts`; `claim-verifier-step.ts` | gebaut, nicht veröffentlicht |
| „Only CRITICAL findings fail the check; warnings conclude as neutral“ | `check-run.ts:155-193` | gebaut, nicht veröffentlicht |
| „Every finding names its rule ID and ships a one-click suggested fix where one exists“ | `helpers.ts:487-509` | gebaut, nicht veröffentlicht |
| „Every push is reviewed again“ | `webhook/route.ts:57` | gebaut, nicht veröffentlicht |
| „Nothing was reviewed — this is NOT a clean verdict.“ (echter CLI-String) | `packages/cli/src/format.ts` | gebaut, nicht veröffentlicht |
| „The LLM review covers JS/TS today; other languages get the deterministic pre-scanner only“ | `helpers.ts:381` | Ehrlichkeits-Satz für FAQ |
| „Inference runs on Google Vertex AI on the EU endpoint“ | ROADMAP §5 | gebaut, nicht veröffentlicht |
| „Webhooks HMAC-verified, tokens AES-256-GCM at rest“ | `crypto.ts`, `webhook/route.ts` | gebaut, nicht veröffentlicht |
| „Temperature 0 on every model call“ | `models.ts:179` | **Nicht als „same diff, same verdict“ verkaufen**: der Benchmark streut zwischen Läufen (Draft-Recall 41,7 / 44,0 / 42,7 von 48, ROADMAP Chronik 2026-09-29) |
| Eigene Benchmark-Zahlen (z. B. 125/126) | ROADMAP „Qualität gemessen“ | **Nicht öffentlich.** Synthetische, selbst gepflanzte Fixtures; MARKETING_CLAIMS §0.2: „never ‘we measured’“, bis es eine eigene Telemetrie-Studie gibt |

### 4c. Freigegebene Sätze (wörtlich aus der Landing, `messages/en.json`), sofern mit §6 vereinbar

| Satz | Nutzbar? |
|---|---|
| „The only AI code gate that doesn’t ask an AI whether the AI was wrong.“ (`hero.tagline`) | **Nein, nicht auf HN, Reddit oder Product Hunt.** Der Draft-Reviewer ist ein LLM, und der Verifier ist ebenfalls ein LLM, das über den Draft urteilt. Auf X und LinkedIn ebenfalls nicht als Hook |
| „Nothing blocks 100% of AI vulnerabilities. We document our gaps — vendors who don’t are selling slop.“ (`architectureSpec.rows.limits`) | Ja |
| „Only CRITICAL findings fail the check; advisory findings conclude as neutral and cannot block a merge.“ (`faq.items.ciSpeed`) | Ja |
| „Evidence, not vibes.“ (`closingCta.sub`) | Ja |
| „Deterministic AI code review.“ (`meta.title`, Film-Endcards) | Mit Vorsicht, nur zusammen mit dem Ehrlichkeits-Satz aus 4b (55 Detektoren, der Rest LLM + Blind-Verifier) |

---

## 5. Geplantes: wie es öffentlich heißen darf

| Roadmap-Punkt (Repo) | Öffentliche Formulierung (Beispiel) | Nicht sagen |
|---|---|---|
| Codebase-Zertifikat (ROADMAP §11) | „On our roadmap: a signed certificate per commit SHA that records which rules a codebase was checked against and what passed. The idea: a CTO can hand an auditor or acquirer a receipt instead of a slide.“ | „100% slop-free“ (MARKETING_CLAIMS §0.3), Supply-Chain-Enforcement, „Agenturen müssen kaufen“, „enforced monopoly via compliance“, CISOs/Banken/VCs als Käufer |
| Multi-Model-Konsens / Cross-Vendor-Verifier | „We’re building a second, independent model vendor into the verification step, so a finding isn’t confirmed by the same model family that wrote it.“ | Modellnamen als Versprechen, Zeitpläne |
| Score über die Zeit / CTO-Dashboard | „Planned: integrity trends per repo over time, so you can see whether AI-assisted changes are adding debt faster than you pay it down.“ | „18-Month-Wall“ als Zahl |
| Revision-vs-Revision-Gate (PROC-002) | „Planned: fail the check when a revision raises severity-weighted findings over the previous one.“ (Film 02 sagt heute nur: „A critical finding fails the check.“) | „If quality drops, the build fails“ im Präsens |
| Pro Max, Team/Enterprise | „Plans for heavier usage and for teams are planned; pricing isn’t set.“ | Preise |
| Router-API | „Later: the verification cascade as an API for other AI products.“ Nur in Build-in-Public-Kontexten (X) | „Pickaxe during the Gold Rush“ |
| Vergleichsseiten, Docs, Changelog | nicht bewerben | — |

**Interne Formulierungen, die nie öffentlich werden:**
- Supply-Chain-Enforcement
- „enforced monopoly via compliance“
- Agenturen über Enterprise-Verträge zum Kauf zwingen
- „aggressive SEO capturing“
- Haftungsisolation
- Margen und Break-even
- Vercel Hobby
- der „7-Regeln-Monat“
- Details zum Prompt-Injection-Audit

Nach Copy v2 (Archiv L375) ist Blueprint-Vokabular ebenfalls intern: Judge Pattern, Dual-RAG, The Law/Evidence, gated retrieval, registry oracles.

---

## 6. Widersprüche, gefunden bei dieser Arbeit

Alle Punkte stehen auch als To-Do in `ROADMAP.md` §10. Ich habe keinen davon selbst gefixt (Auftrag: App-Code nicht ändern).

| # | Wo | Behauptung | Realität | Quelle der Realität |
|---|---|---|---|---|
| W1 | Landing-H1 `hero.headline` | „Your AI reviewer misses 44× more bugs than a parser.“ | Das Paper sagt „produced findings at a 44:1 ratio below the deterministic scanner“, als „secondary exploratory finding“ mit einem Modell (`minimax-m2:cloud`) auf einer Codebasis und trunkiertem Repo-Lauf. „Findings“ sind etwas anderes als „bugs“, und „misses more“ ist etwas anderes als „finds fewer“ | arXiv 2604.17587 §5.5 |
| W2 | Landing `pillarErosion.punchline`, `architectureSpec.rows.rescans`; MARKETING_CLAIMS §5 | „re-checks every revision … If quality drops, the build fails“ | Kein Vergleich zwischen Revisionen, nur `reroll_count` | `result-persister-step.ts:122-175` (bekannt, ROADMAP §10) |
| W3 | `meta.ogTagline`, `pillarJudge.punchline`, `faq.determinism`, `architectureSpec.rows.rules`, Extension-README, MARKETING_CLAIMS §3 („every one enforced deterministically“) | „Verdicts no LLM votes on“, „The AI … never decides“, „119 deterministic rules“ | Detektoren im Pre-Scanner für 55 Regel-IDs. Ein nur vom LLM gefundenes CRITICAL lässt den Check scheitern. Die Migration-046-Metadaten zählen 89 als abgedeckt, davon haben 35 keinen Detektor | `registry.ts`, `helpers.ts:34-38`, `reviewer-call.ts:231-233`, `check-run.ts:159-165` |
| W4 | `verdictTable.rows.swallowedErrors` | Silent failures: „Caught deterministically“ | SEC-031 hat keinen Detektor im Pre-Scanner, die LLM-Lane fängt es | `grep SEC-031 packages/prescan/src` ⇒ 0 |
| W5 | `faq.determinism` | „every draft finding must survive a blind verification pass“ | `pro-direct` und ein degradierter Verifier überspringen die Verifikation | `claim-verifier-step.ts:55`, `complexity-router-step.ts:47-70` |
| W6 | `faq.determinism` | „the same diff always produces the same verdict“ | Temperatur 0 ist gesetzt, der Draft-Recall streut trotzdem zwischen Läufen | ROADMAP Chronik 2026-09-29 |
| W7 | `faq.ciSpeed` | „full three-model escalation“ | drei Stufen auf zwei Modellen | `models.ts:114-116` |
| W8 | Hero/Closing-CTA | „Install the GitHub App“ → `/login` | Registrierung gesperrt | `disable_signup=True` |
| W9 | FAQ `sourceCode` | „Full details in the privacy policy.“ | `/en/privacy` ⇒ 404 | live |
| W10 | `verdictTable.rows.apiHallucination`, `pillarArchitecture` | „Precision 1.00“ in der Unslop-Spalte, „perfect precision“, „lifting fix success from 34.4% to 87.1%“ | Das sind Forschungswerte (Android-API-Migration, Python Code Smells), keine Messung von Unslop. Das kollidiert mit MARKETING_CLAIMS §0.2 | arXiv 2604.20202, 2401.14176 |
| W11 | Landing `objections.testsPass` | „Up to 77% of AI-written test methods assert nothing.“ | Paper: „test classes“ (Klassenebene) | arXiv 2410.10628 |
| W12 | MARKETING_CLAIMS §5 | „every round, without exception“ | Tukey: keine signifikanten Unterschiede zwischen benachbarten Iterationen | arXiv 2506.11022 App. E |
| W13 | MARKETING_CLAIMS §3 | 27 % „self-correction made code more secure“ | „Among security-focused prompts, 27% of iterations“. Die Golden DB attribuiert die 27 % in PROC-001 an andere Paper | arXiv 2506.11022 |
| W14 | MARKETING_CLAIMS §2 (H1-Kandidat 2) | „real defect detection drops from 81.6% to 63.8%“ | SWE-bench-Resolve-Raten mit bzw. ohne Golden Tests | arXiv 2605.22175 |
| W15 | MARKETING_CLAIMS §5 | 9,1 %: „quietly add the injection“ | Das Abstract berichtet über 89 % behobene Schwachstellen | 2308.04838 / TSE |
| W16 | MARKETING_CLAIMS §7 | „10 out of 10 … TOCTOU“ mit Quelle 2508.17155 | Die Zahl stammt aus 2603.00476 | Golden DB CONC-007 |
| W17 | Gründer-Stand vs. Repo | Team/Enterprise „249–299 €/Monat“ mit „Verified Cloud“ | Im Repo pro Seat und nur als Optionen; „Verified Cloud“ gibt es nicht | `UNIT_ECONOMICS.md` §9 |
| W18 | `docs/seo/UNSLOP_SEO_RULES.md:36,40` | Beispiel „never persisted“, Integration „Stripe“ | FAQ sagt „We do store data“, Stripe ist entfernt | `messages/en.json:477`, ROADMAP 2026-08-08 |
| W19 | ROADMAP_ARCHIVE §11-Vision | Zertifikat „100% free of AI Slop“ | MARKETING_CLAIMS §0.3 verbietet 100 %-Claims | — |
