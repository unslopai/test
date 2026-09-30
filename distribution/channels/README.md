# distribution/channels: organische Kanäle für unslop.codes

Veröffentlichungsfertige Entwürfe und Assets für fünf Kanäle. Nichts davon ist gepostet, und es wurden keine Accounts angelegt.

**Zuerst lesen:**

| Datei | Inhalt |
|---|---|
| [CONTEXT.md](CONTEXT.md) | Was heute live ist, freigegebene Claims (gegen die Paper-Volltexte geprüft), Roadmap-Sprache, Widersprüche W1–W19 |
| [PLAN.md](PLAN.md) | Reihenfolge und Begründung |
| [TODO.md](TODO.md) | Checkliste |

Jeder Kanal-Ordner enthält:

| Datei | Inhalt |
|---|---|
| `RESEARCH.md` | Regeln, Specs, Beispiele, Quellen mit Abrufdatum |
| `BRIEF.md` | Zielgruppe, Kernwinkel, Roadmap-Anteil, Assets |
| `POSTS.md` | Texte |
| `FAQ.md` | Einwände und Antworten |
| `LAUNCH.md` | Zeitpunkt, Ablauf, Vorbedingungen |
| `CHECK.md` | Selbstkontrolle: Specs gemessen, Zeichen gezählt, Zahlen gegen CONTEXT, skeptische Lesung |
| `visuals/` | Bilder, Videos und die Quellen dazu |

> **Vor jedem Post:** Alle Texte sind mit KI entworfen. Hacker News verbietet LLM-Text in Show HN ausdrücklich, mehrere Subreddits entfernen ihn, und LinkedIn drosselt generisch wirkenden Content. Die Fakten sind geprüft, die Stimme muss deine sein (CONTEXT.md, oben).

## Übersicht

| # | Kanal | Status | Kernwinkel | Roadmap-Anteil | Assets | Dein nächster Schritt |
|---|---|---|---|---|---|---|
| 1 | [X](01-x/) | **fertig**, blockiert durch HR-Eintrag + Warteliste live | „Receipts, not vibes“: eine konkrete Fehlerklasse, das Finding mit Regel-ID und Quelle, ein ehrliches Build-Log | hoch, nur in Build-Log-Posts (X-2, X-L3) | 9 Posts/Threads + Replies, FAQ, 5 Stills, Filme 01/02 neu gerendert (Faktencheck + „Private beta“-Stempel) in 9:16 + 16:9, Film 03 für den Launch | Gründer-Profil schärfen; Test-Upload eines 1080×1920-Videos (API-Doku nennt max. 1280×1024) |
| 2 | [LinkedIn](02-linkedin/) | **fertig**, blockiert durch HR-Eintrag + Warteliste live | Ein Quality Gate, das Belege und Grenzen offenlegt, plus Weg zu einem prüfbaren Nachweis pro Commit | am höchsten: 2 von 8 Karussell-Seiten + eigener Diskussions-Post, alles als Konzept markiert | 8 Posts (EN + DE), FAQ EN/DE, Karussell-PDF EN + DE (8 Seiten), Filme 4:5 | Headline anpassen; Rechtsform klären, bevor die Company Page entsteht; Test-Upload Dokument/Video |
| 3 | [Reddit](03-reddit/) | **teilweise blockiert**: Diskussion (Phase A) nach HR-Eintrag; Showcases erst ab Launch | Praxisfrage „wie reviewt ihr KI-Code?“ mit offen gelegten Grenzen, Roadmap nur in Kommentaren | sehr niedrig | 2 Diskussions- + 5 Showcase-Posts, FAQ, Terminal-Demo (echter CLI-Output) als MP4/GIF | **Jetzt schon möglich:** 4–6 Wochen echte Beteiligung, > 100 Karma; „Built with Claude“ bestätigen oder streichen |
| 4 | [Hacker News](04-hackernews/) | **blockiert**: nichts ohne Konto ausprobierbar; neue Accounts gesperrt (showlim); LLM-Text verboten | Offenlegen, welcher Teil des Urteils deterministisch ist und welcher vom LLM | fast keiner | Titel (≤ 80), Faktenblatt mit Beleg pro Satz, Gliederung, Referenztext (nicht zum Posten), FAQ mit 12 Kritiken | Weg ohne Konto entscheiden (Demo-Repo / lokale CLI); HN-Account aufbauen; Text selbst schreiben |
| 5 | [Product Hunt](05-producthunt/) | **blockiert** bis Launch-Tag L; empfohlen L + 1–3 Wochen nach HN | PR-Checks für KI-Code über vier Flächen, mit sichtbarer Grenze zwischen Regel und Modell | mittel: 3 Punkte „What's next“ im Maker-Kommentar + 1 Konzept-Folie | Taglines (≤ 60), Beschreibung (233/260), Galerie 7×1270×760 + Thumbnail, Maker-Kommentar als Gliederung/Referenz, FAQ | PH-Account jetzt anlegen (Vorlauf); Slug `unslop-codes` prüfen (`unslop` ist belegt); echte Screenshots für Galerie 1 und 3 |

## Was vor dem ersten Post live sein muss

| # | Voraussetzung | Für | Quelle |
|---|---|---|---|
| 1 | HR-Eintrag | alle Kanäle | Gründerentscheidung „nichts Öffentliches vor dem HR-Eintrag“ (`docs/specs/WAITLIST_SPEC.md:4`) |
| 2 | Impressum und Datenschutzerklärung live (`NEXT_PUBLIC_LEGAL_PAGES_LIVE=impressum,privacy`) | alle Kanäle | |
| 3 | Warteliste live (`NEXT_PUBLIC_WAITLIST_LIVE=true`, Brevo-Env in Vercel, `news.unslop.codes` authentifiziert) | CTA in Phase A | |
| 4 | Landing-Korrekturen, mindestens W1 (44×-H1), W2 („If quality drops, the build fails“), W3 („Verdicts no LLM votes on“), W4 (SEC-031 „deterministically“), W8 (CTA auf `/login` bei gesperrter Registrierung) | alle Kanäle | ROADMAP §10 „Landing- und Claims-Faktencheck“; nicht selbst gefixt, weil App-Code |
| 5 | Frist 2026-10-14: Vertex Durable Caching abgewählt oder Rechtstexte angepasst | jede Aussage „EU endpoint“ | ROADMAP §0 |
| 6 | Signup offen, `@unslopcodes/cli` und `@unslopcodes/mcp` auf npm, Extension im Marketplace, Paddle live | Launch-Posts (Phase B) | |
| 7 | Weg zum Ausprobieren ohne Konto | Hacker News und Product Hunt | ROADMAP §10 „Distribution-Voraussetzungen“ |

## Geänderte Dateien außerhalb von `distribution/channels/`

- **`distribution/motion/01-silent-failure/film.html`:**
  - Stat-Szene nach Paper-Wortlaut (44:1 ist ein explorativer Vergleich mit einem Modell).
  - Endcard ohne „Verdicts no LLM votes on.“
  - Parameter `?beta=1` für den Stempel.
  - `render.py` nimmt `FILM_QUERY`.
  - Neue Schnitte `cuts/beta.mp4` und `cuts/launch.mp4`.
- **`distribution/motion/02-regenerate-erosion/film.html`:** Endcard „A review gate for AI-written code.“, dazu `?beta=1` und `cuts/beta.mp4`.
- **`ROADMAP.md` §10:** To-Dos zum Faktencheck und zu den Distribution-Voraussetzungen, außerdem eine aktualisierte Zeile zu Film 01.
- **App-Code:** nicht geändert.

## Werkzeuge in `_kit/`

| Datei | Zweck |
|---|---|
| `kit.css`, `assets/` | Tokens aus `globals.css`, Geist, Silkscreen, Pixel-Schild |
| `render.py` | Rendert jede `<section class="frame">` einer HTML-Seite als PNG in exakter Größe; `render.py check <dir>` misst sie |
| `make_pdf.py` | PNG-Seiten → PDF (LinkedIn-Dokument) |
| `cli/sample-output.ts` | Führt den **echten** CLI-Formatter mit Beispieldaten aus (`scan`, `fix`, `clean`) |
| `terminal-demo/` | Deterministische Terminal-Animation aus diesen echten Ausgaben → MP4 + GIF |
| `count.py` | Zeichen gegen Plattform-Limits (X gewichtet nach twitter-text) |
| `specs.py` | Misst Maße, fps, Dauer, Codecs, Bitrate und Größe jeder Asset-Datei |
