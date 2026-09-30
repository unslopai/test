# docs/

Alle Dokumente außer `ROADMAP.md`, `CLAUDE.md`, `AGENTS.md` und `README.md` liegen hier. `ROADMAP.md` bleibt im Root, weil es die Quelle der Wahrheit für den Projektstand ist und von `CLAUDE.md` per `@ROADMAP.md` geladen wird.

Wenn irgendwo (ROADMAP, Code-Kommentare, ältere Docs) eine Spec nur mit Dateinamen genannt wird, liegt sie in `docs/specs/`.

| Ordner | Inhalt |
|---|---|
| `ROADMAP_ARCHIVE.md` | Eingefrorene Vollfassung der ROADMAP (Stand 2026-09-17) mit allen Receipts. Verweise wie „ROADMAP §3t“ / „To-Do §16“ in älteren Notizen meinen die Abschnitte dieser Datei. Wird nicht fortgeschrieben. |
| `specs/` | Alle Feature-Specs. Kern: `SPEC.md` (Router Cascade, Cognitive Integrity), `PADDLE_SPEC.md`, `VSCODE_UX_SPEC.md`, `GITHUB_APP_SPEC.md`, `MCP_SPEC.md`. Dazu Pre-Scanner, Prompt-Caching, Operator-Settings, Onboarding, Dashboard, i18n, Modell-Migration, LLM-Lane-Quality, Waitlist/E-Mail (`WAITLIST_SPEC.md`), Rechtsseiten (`LEGAL_PAGES_SPEC.md`), Draft-Recall auf großen Diffs (`LARGE_DIFF_RECALL_SPEC.md`, Entwurf 2026-09-29), Sprachabdeckung für Nicht-JS/TS-Code (`LANGUAGE_COVERAGE_SPEC.md`, Entwurf 2026-09-30). |
| `strategy/` | `MODEL_STRATEGY_2026-08.md`, `UNIT_ECONOMICS.md`, `MARKETING_CLAIMS.md`, `BEST_PRACTICES_PLAN.md` |
| `benchmarks/` | `RULE_RECALL_BENCHMARK.md` (Messprotokoll, Rohdaten unter `fixtures/rule-recall/results/`), `REPLAY_AB_LAW_PROMPT.md` |
| `security/` | Client-Audit (2026-08), Hardening-Advice, Server-Audit `SERVER_AUDIT_2026-09.md` (AuthN/AuthZ, Webhooks, Keys, Quota, Supabase) |
| `seo/` | GEO/SEO-Guide und Regeln für die Landing Page |
| `research/` | Die beiden Grundlagen-PDFs, `fetch_papers.js` mit `asta_queries.json` / `asta_results.json` (Paper-Recherche für die Golden Database); `legal-pages-research-2026.md` mit den Quellenberichten unter `legal-pages-2026/` (Rechtsseiten-Research 2026) |
| `legal/` | Textentwürfe der Rechtsseiten (Impressum, Datenschutzerklärung, Nutzungsbedingungen, Erstattungsrichtlinie, AVV), je DE und EN; Status und Platzhalter in `specs/LEGAL_PAGES_SPEC.md` |
| `design-refs/` | Referenzbilder für Logo und Typografie |
| `company/` | Gründungsunterlagen der unslop UG (Checkliste, Nutzungsüberlassung, Buchhaltungs-Stack `buchhaltung-software.md`, Geschäftskonto `geschaeftskonto.md`, Fragebogen `fragebogen-steuerliche-erfassung.md`, Fristenkalender `fristenkalender.md` + `fristen-unslop-ug.ics` für Google Calendar). Nicht produktrelevant. |

Daten, die Skripte lesen, liegen nicht hier, sondern unter `data/` (Golden-Database-CSV, Reference-Practices) und `fixtures/`.
