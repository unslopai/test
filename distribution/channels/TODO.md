# TODO: Kanäle (Checkliste über alle fünf)

## Vorbereitung (einmal)
- [x] Filme 01–03 gelesen (BRIEF, README, TODO), Skill `.claude/skills/motion-design/` gelesen. Beides lag auf dem ungemergten Branch `claude/eloquent-albattani-v0r3pc` und ist in diesen Branch gemergt.
- [x] Repo erkundet:
  - MARKETING_CLAIMS, WAITLIST_SPEC (§8 und Rest), SEO_RULES, ROADMAP (vollständig), ROADMAP_ARCHIVE (vollständig, per Agent)
  - Research-PDFs (per Agent)
  - Landing (`messages/en.json`, Komponenten, Tokens)
  - breite Suche nach Preisen, Personas und Roadmap
- [x] Feature-Status im Code geprüft, live mit `curl`, `npm view`, Marketplace und `auth/v1/settings`
- [x] Zahlen gegen arXiv-Volltexte geprüft: 2604.17587, 2506.11022, 2605.22175, 2406.10279, 2410.10628, 2306.12338, 2401.14176
- [x] CONTEXT.md: Feature-Tabelle, Launch-Status, Zielgruppen, Claims, Roadmap-Sprache, Widersprüche W1–W19
- [x] PLAN.md: Reihenfolge X → LinkedIn → Reddit → HN → Product Hunt, mit Begründung
- [x] Visual-Kit `_kit/` (kit.css, render.py, Fonts, Schild)
- [x] Echter CLI-Output über `_kit/cli/sample-output.ts` (echter Formatter, Beispieldaten)

## 01 X
- [x] RESEARCH.md (Regeln, Specs, 18 Beispiele, Roadmap-Kommunikation, Zielgruppe; help.x.com 403 → Sekundärquellen gekennzeichnet)
- [x] BRIEF.md (Kernwinkel „Receipts, not vibes“)
- [x] POSTS.md: X-1 bis X-6 (Phase A), X-L1 bis X-L3 (Launch), je 3–5 Hooks, erster Reply, Build-Log-Thread mit Roadmap, Reply-Bausteine
- [x] FAQ.md (11 Einwände, Kurzformen ≤ 280)
- [x] Visuals: 5 Stills (echter CLI-Output, PR-Finding, 2 Studienkarten, Status-Board); Filme 01/02 neu gerendert (Faktencheck + „Private beta“-Stempel), 9:16 + 16:9-Komposition, Film 03 für den Launch
- [x] LAUNCH.md
- [x] CHECK.md: Specs gemessen, Zeichen gezählt, Zahlen gegen CONTEXT, skeptische Lesung (9 Korrekturen)
- [ ] Offen beim Gründer: Test-Upload 1080×1920 (API-Doku „max 1280x1024“)

## 02 LinkedIn
- [x] RESEARCH.md (Community Policies, User Agreement, Specs primär, 15 Beispiele, Deutsch vs. Englisch)
- [x] BRIEF.md (Kernwinkel: Gate mit offengelegten Belegen und Grenzen + Weg zum Nachweis pro Commit)
- [x] POSTS.md: L-1 (Dokument EN), L-2 (Dokument DE), L-3 (Gate-Policy), L-4 (Roadmap-Diskussion Nachweis), L-5 (Video), L-6 (Korrektur 44×), L-L1/L-L2 (Launch EN/DE); Hooks < 140 Zeichen, erster Kommentar
- [x] CTO-Roadmap-Inhalte: Karussell-Seiten Trend + Nachweis (Konzept), L-4
- [x] FAQ.md (10 CTO-Einwände, EN + DE)
- [x] Visuals: Karussell EN + DE (8 Seiten, PDF + PNG), Filme 4:5 (beta + launch)
- [x] LAUNCH.md
- [x] CHECK.md (Specs, Zeichen, Zahlen, skeptische Lesung mit 8 Änderungen)
- [ ] Offen beim Gründer: Test-Upload Video/Dokument, Rechtsform vor Company Page

## 03 Reddit
- [x] RESEARCH.md (Plattformregeln primär; 25 Subreddits mit Regeln und Entfernungsquoten; Reddit 403/302 → RSS, Zendesk-API, Archiv, Prowlo, gekennzeichnet; 15 Beispiele)
- [x] BRIEF.md (Kernwinkel: Praxisfrage „wie reviewt ihr KI-Code“, Grenzen offen; Roadmap nur in Kommentaren)
- [x] POSTS.md: R-A1 r/ExperiencedDevs (Mi/Sa UTC), R-A2 r/devops (Diskussion, kein Link); R-B1 r/ClaudeCode, R-B2 r/mcp, R-B3/B4 Weekly-Threads, R-B5 r/SaaS; bewusst nicht vorbereitete Subs mit Grund
- [x] FAQ.md (10 Einwände inkl. App-Rechte, Closed Source, npm-Namensverwechslung)
- [x] Visuals: Terminal-Demo (echter CLI-Output, scan → --fix → sauber), MP4 + GIF, beta + launch
- [x] LAUNCH.md (4–6 Wochen Account-Vorlauf, Wochentage, Verhalten bei Entfernung)
- [x] CHECK.md (4 inhaltliche Korrekturen, u. a. Ledger-Semantik)
- [ ] Offen beim Gründer: Account-Vorlauf, „Built with Claude“ bestätigen, Regeln eingeloggt gegenlesen

## 04 Hacker News
- [x] RESEARCH.md (Guidelines, Show-HN-Regeln, dang-Tipps inkl. LLM-Text-Verbot 2026-03-28, showlim; 15 Show HNs aus der Kategorie per Algolia; Timing aus 45.844 Show HNs)
- [x] BRIEF.md (Status **blockiert**, vier fehlende Voraussetzungen; Kernwinkel: offenlegen, was deterministisch und was LLM ist)
- [x] POSTS.md: Titel (≤ 80, geprüft), Faktenblatt mit Beleg pro Satz, Gliederung, Referenztext und Referenz-Maker-Kommentar (**nicht zum Posten**, HN verbietet LLM-Text)
- [x] FAQ.md (12 erwartbare Kritiken, u. a. gleiche Modellfamilie, App-Rechte, Closed Source, Namensverwechslung unslop.news)
- [x] Visuals: keine auf HN; Terminal-Demo für Zielseite/Demo-Repo vorhanden
- [x] LAUNCH.md (9 Vorbedingungen, Tag/Uhrzeit, keine Booster, kein Löschen und Neuposten)
- [x] CHECK.md
- [x] ROADMAP-To-Do „Distribution-Voraussetzungen“ (Weg ohne Konto, Name, Trial ohne Karte, Regelliste, Modellfamilie)
- [ ] Offen beim Gründer: HN-Account-Historie, Text von Hand, Entscheidungen (Regelliste, Weg ohne Konto)

## 05 Product Hunt
- [x] RESEARCH.md (Featuring-Richtlinien 2026, keine Coming-soon-Seiten mehr, 6-Monats-Relaunch, „No LLMs“ in Kommentaren, Specs, 16 Beispiele, Timing)
- [x] BRIEF.md (Status **blockiert** bis L, empfohlen L + 1–3 Wochen nach HN; Kernwinkel: vier Flächen, sichtbare Grenze zwischen Regel und Modell)
- [x] POSTS.md: Name/Slug, 5 Taglines (≤ 60), Beschreibung (233/260), Felder, Maker-Kommentar als Gliederung + Referenz mit „What's next“, Outreach-Wortlaut ohne „upvote“
- [x] FAQ.md (10 Fragen)
- [x] Galerie 7 × 1270×760 (PR-Check, Terminal, VS Code, How it decides, Evidenz, Grenzen, Roadmap-Konzept) + Thumbnail 240×240
- [x] LAUNCH.md
- [x] CHECK.md
- [x] PH-Account angelegt (https://www.producthunt.com/@unslopcodes, 2026-09-30)
- [ ] Offen beim Gründer: Produkt-Slug `unslop-codes` prüfen, echte Screenshots für Galerie 1 und 3, YouTube-Upload

## Abschluss
- [x] README.md (Übersicht: Kanal, Status, Assets, nächster Schritt)
- [x] ROADMAP.md: Widersprüche als To-Do (§10 „Landing- und Claims-Faktencheck“, „Distribution-Voraussetzungen“); Chronik-Zeile für das Distribution-Paket
- [x] `.gitignore` für Zwischendateien (`plates/`, `probe/`, `frames/`), jedes Video < 50 MB (größtes: 23,7 MB)
- [x] Commit, Push, Pull Request

## Claim-Policy 2026-09-30 (MARKETING_CLAIMS §00)
- [x] CONTEXT.md §0 (Policy), §4a–§4f neu (echte Ausgabe, Mechanismus, M1/M2, Archiv C1–C10, Problem-Framing), §6-Hinweis
- [x] 01 X: X-3/X-4 ersetzt, X-7 neu (M1/M2 nur als Bild + Alt-Text), Studien-Stills gelöscht, drei neue Stills; CHECK.md mit grep-Beleg
- [x] 02 LinkedIn: L-1/L-2/L-6 ersetzt, Karussell-Seiten 2/3 EN+DE neu, PDFs neu (LFS); CHECK.md mit grep-Beleg
- [x] 03 Reddit: R-A1/R-A2 umgebaut, R-B5 ersetzt, FAQ +3; CHECK.md mit grep-Beleg
- [x] 04 Hacker News: Faktenblatt ohne Studienzahl, FAQ 18 Einträge; CHECK.md mit grep-Beleg
- [x] 05 Product Hunt: Galerie-Bild 5 ersetzt (echter Pre-Scanner), Tagline 4 und Beschreibung neu; CHECK.md mit grep-Beleg
- [x] Filme 01/02 umgebaut und neu gerendert, Kanal-Schnitte X (9:16/16:9) und LinkedIn (4:5) neu; Film 03 hatte keine Studienzahlen
- [x] `.gitattributes`: mov/webm/wav und PDFs unter `distribution/` in LFS
- [ ] Offen beim Gründer: Landing-H1 ohne Studienzahl (ROADMAP §10 Claim-Policy (a)), sonst widerspricht jeder verlinkende Post der eigenen Linie
- [ ] Offen: echte Screenshots/Kommentare aus einem Demo-Repo statt nachgebauter Oberflächen (auch für ein echtes Modell-Finding wie SEC-031)
