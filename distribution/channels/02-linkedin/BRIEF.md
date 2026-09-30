# BRIEF: LinkedIn

## Zielgruppe

**Primär: CTOs, VPs und Heads of Engineering in Teams, die KI-Coding-Tools einführen oder schon breit nutzen.**
- Ihr Schmerz: Das PR-Volumen wächst schneller als die Review-Kapazität. Am Beispiel E14 bestätigen Praktiker den „review cycles“-Engpass.
- Sie haben keine Messgröße für Codebase-Integrität und kein Gate, das sich gegenüber Audit, Kunde oder Käufer belegen lässt.
- Für CTOs ist LinkedIn plausibel, aber nicht mit einer CTO-Zahl belegt. Belegt ist, dass die C-Suite Thought Leadership liest (Edelman/LinkedIn 2024, RESEARCH.md §6).

**Sekundär:**
- Tech Leads und Staff Engineers, die intern für ein Gate argumentieren müssen.
- Das DACH-Netzwerk des Gründers.

**Nicht jetzt:** CISOs, Banken, Versicherungen, VCs. Das Zertifikat erscheint nur als CTO-Nutzen (CONTEXT §5).

## Kernwinkel (einer)

**„Ein Quality Gate für KI-Code, das seine Belege und seine Grenzen offenlegt, und ein Weg zu einem prüfbaren Nachweis pro Commit.“**

Heute belegbar (Private Beta):
- Regel-ID pro Befund
- ein kritischer Befund lässt den Check scheitern
- ehrliche Kennzeichnung, was deterministisch geprüft ist

Ausblick (Roadmap): Integritäts-Trend pro Repo und signierter Nachweis pro Commit-SHA.

**Warum das auf LinkedIn trägt:**
- **CTOs antworten auf eigene Erfahrung.** Sie melden sich mit eigenen Engpass-Zahlen, wenn ein Post ihre Erfahrung benennt (E8, E14). Unsere Schlussfrage („Was müsste der Nachweis zeigen?“) holt genau diese Antworten ab.
- **Research schlägt Behauptung.** „Strong research and data“ ist für 55 % der Entscheider das Merkmal guter Thought Leadership (RESEARCH.md §5). Deshalb stehen C1 und C3 im Karussell, jeweils mit Quelle.
- **Das Vokabular ist teils besetzt, der Nachweis nicht.** Qodo hat „code integrity“ und „Can I trust what is being shipped?“ (E8, E9), Dohmke „context per commit“ (E1). Ein prüfbarer Nachweis, *was* geprüft wurde, inklusive der Grenzen, ist davon unterscheidbar.
- **Ehrlichkeit ist hier Differenzierung.** LinkedIn drosselt seit 20.05.2026 generischen KI-Content (RESEARCH.md §3.1), Kommentare strafen Wiederholung ab (E15). Ein Post, der sagt, was das Produkt *nicht* kann, ist das Gegenteil von „recycled thought leadership“.

Belege im Repo:
- `check-run.ts` (Fazit-Logik)
- `helpers.ts` (Kommentarformat)
- `packages/prescan/src/rules/registry.ts` (55 Detektoren)
- ROADMAP §9/§11 (Trend, Zertifikat)
- CONTEXT §5 (freigegebene Roadmap-Sprache)

## Wie viel Roadmap verträgt LinkedIn

**Am meisten von allen fünf Kanälen, aber immer neben etwas heute Prüfbarem.** Das Muster aus RESEARCH.md §5: These → heute Ausgeliefertes → Geplantes (Dohmke E1).

- Im Karussell sind 2 von 8 Seiten Roadmap. Sie tragen den Stempel „Roadmap · Concept“ und sind im gestrichelten Konzept-Stil gezeichnet, mit „Concept sketch · example data · not built“ im Bild.
- Ein eigener Roadmap-Post (L-4) fragt CTOs, was ein Nachweis pro Commit zeigen müsste. Er ist klar als Diskussion über Geplantes erkennbar.
- Keine Termine, keine Preise für Team/Enterprise, kein „certified“ im Präsens.

## Sprache

Englisch als Standard, **eigenständige deutsche Posts für DACH-Themen** (RESEARCH.md §7/§8.11).
- L-2 ist die deutsche Fassung des Dokument-Posts mit eigenem Text, der EU-Verarbeitung erwähnt.
- L-L2 ist ein deutscher Launch-Post.
- Im Deutschen wird gesiezt oder neutral formuliert (Appinio 2019, RESEARCH.md §6).
- Keine Wortspiele im Hook, weil LinkedIn englische Posts für deutsch eingestellte Leser automatisch übersetzt (RESEARCH.md §7).

## Phase und Status

Alle Posts sind **blockiert bis zum HR-Eintrag** (`PLAN.md`), zusätzlich gilt:

| Vorbedingung | Betrifft |
|---|---|
| Company Page erst anlegen, wenn die Rechtsform es erlaubt (Pages Terms: juristische Person oder Einzelunternehmen, RESEARCH.md §1.3) | Company Page |
| Impressum auf unslop.codes live und im Website-Feld der Page verlinkt | alle |
| Warteliste live | Phase A (L-1 bis L-5) |
| npm, Marketplace, Signup offen | Phase B (L-L1, L-L2) |

## Assets

| Datei | Was | Status |
|---|---|---|
| `POSTS.md` | L-1 bis L-6 (Phase A, davon L-2 auf Deutsch), L-L1/L-L2 (Launch, EN/DE); je 3–5 Hooks mit Empfehlung, erster Kommentar | fertig |
| `FAQ.md` | 10 CTO-typische Einwände mit Antwort (EN, dazu DE-Kurzform für die deutschen Posts) | fertig |
| `LAUNCH.md` | Zeitplan, Profil-Vorbereitung, Ablauf, Umgang mit Kommentaren | fertig |
| `visuals/li-carousel-quality-gates.pdf` | Dokument-Post EN, 8 Seiten 1080×1350: Cover · 1.80× · 2.1→6.2 · Heute (Private beta) · Grenzen · Roadmap-Trend (Konzept) · Roadmap-Nachweis (Konzept) · Frage | fertig |
| `visuals/li-carousel-quality-gates-de.pdf` | dasselbe auf Deutsch (Sie-Form, Produkt-Strings englisch) | fertig |
| `visuals/li-0*.png`, `visuals/li-de-0*.png` | Einzelseiten, zugleich Einzelbilder für Text+Bild-Posts (4:5) | fertig |
| `visuals/li-film01-beta-4x5.mp4`, `li-film02-beta-4x5.mp4` | Filme mit „Private beta“-Stempel, 1080×1350 aus der Safe Zone geschnitten | fertig |
| `visuals/li-film01-launch-4x5.mp4`, `li-film03-launch-4x5.mp4` | Launch-Fassungen (ohne Stempel; 03 mit npm-CTA), **erst ab Launch-Tag** | fertig |
