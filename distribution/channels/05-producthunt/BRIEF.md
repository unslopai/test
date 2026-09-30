# BRIEF: Product Hunt

## Status: **blockiert** bis Launch-Tag L; empfohlen L + 1–3 Wochen, nach HN

**Warum heute nicht:**
- PH featured keine „Waitlisted products (without immediate access)“, kein „Vaporware“ und keine Produkte, die nur „email sign-up“ bieten (RESEARCH.md §1.2).
- Coming-soon-Seiten gibt es seit August 2025 nicht mehr.
- Ein Relaunch ist erst nach sechs Monaten und nur mit „significant update“ möglich (§1.3). Ein verfrühter Launch verbrennt also den ersten Auftritt für ein halbes Jahr.

**Was fehlt:**
1. Das Produkt muss ohne Operator nutzbar sein: Signup offen, GitHub App installierbar, CLI auf npm, Extension im Marketplace.
2. Paddle live, Preis öffentlich, Trial-Bedingungen klar. Ob der Trial eine Karte verlangt, steht in Beschreibung und Maker-Kommentar.
3. Impressum, Datenschutz, Landing-Korrekturen (ROADMAP §10). Vor allem „If quality drops, the build fails“ muss weg sein (§7.12).
4. Echte Screenshots aus einem Demo-Repo für die Galerie-Bilder 1 und 3. Die aktuellen Bilder bauen die UI mit echten Strings nach (siehe unten).
5. Persönliche PH-Accounts der Gründer mit Vorlauf. PH rät zu drei Monaten, mindestens eine Woche ist Pflicht (§7.3).

## Zielgruppe

- Technische Gründer, Indie-Hacker und Early Adopter von Dev-Tools. Die Top-10 im September 2026 waren zu großen Teilen Coding-Agent-, MCP- und Dev-Tools (§5).
- Deutschland macht 2,4 % des Traffics aus, die USA 39,6 %, also Englisch, US-Zeitzone mitdenken.
- CTOs sind hier nicht belegt erreichbar (§5: keine Rollenzahlen).

## Kernwinkel (einer)

**„PR checks for AI-written code: rule IDs, one-click fixes, and a visible line between what a rule decided and what a model decided.“** Das komplette Produkt über vier Flächen, mit offenen Grenzen.

**Warum das auf PH trägt:**
- **Features schlagen Nutzenversprechen.** „They highlight the features, not the benefits“ ist das Muster erfolgreicher Taglines (§5).
- **Offene Grenzen und klarer Preis werden gelobt** (Chit, Sutura). Unbelegte Zahlen werden zerlegt (Gammacode).
- **PH belohnt Vollständigkeit.** Der erste Launch soll das ganze Produkt zeigen (§7.12). Vier Flächen (PR, CLI, VS Code, MCP) sind unser stärkster Beleg für „High Craft“ (Featuring-Kriterium, §1.2).

## Wie viel Roadmap verträgt PH

**Mittel.** Ein Abschnitt „What's next (planned, not built)“ mit höchstens drei Punkten im Maker-Kommentar, in einem Forum-Thread als „tiny roadmap“ empfohlen (§4). Dazu höchstens **eine** Galerie-Folie am Ende, klar als Konzept gekennzeichnet (`ph-07-roadmap.png`).

Roadmap-Punkte sind zugleich Anlässe für spätere Relaunches (§7.12) und gehören deshalb nicht groß in den ersten Launch.

## Assets

| Datei | Was | Status |
|---|---|---|
| `POSTS.md` | Name/Slug, 3–5 Taglines (≤ 60, geprüft), Beschreibung (≤ 260), Preisfeld, Launch-Tags, Referenz für den Maker-Kommentar mit „What's next“, Outreach-Wortlaut | fertig, blockiert |
| `FAQ.md` | 10 absehbare PH-Fragen mit Antwort | fertig |
| `LAUNCH.md` | Tag, Zeitfenster (09:01 Uhr MEZ/MESZ), Kommentar-Dienst, Outreach ohne „upvote“ | fertig |
| `visuals/ph-01-pr-check.png` … `ph-07-roadmap.png` | Galerie 1270×760: PR-Check, Terminal (echter Formatter-Output), VS Code, „How it decides“, Evidenz 1.80×, Grenzen, Roadmap (Konzept) | fertig |
| `visuals/ph-thumbnail.png` | 240×240, Pixel-Schild | fertig |
| Video (optional, nur YouTube) | `../01-x/visuals/x-film03-launch-16x9.mp4` (Film 03) oder `../03-reddit/visuals/terminal-demo-launch.mp4`; der Gründer lädt es auf YouTube hoch | vorhanden |

**Ehrlichkeitshinweis zur Galerie:** Bilder 1–3 sind **nachgebaute Oberflächen mit den echten Produkt-Strings** und Beispieldaten, keine Screenshots. Die Fußzeile sagt das. PH empfiehlt echte Screenshots (§5, §7.7). Deshalb sollen die Bilder 1 und 3 vor dem Launch durch Screenshots aus einem öffentlichen Demo-Repo ersetzt werden. Bild 2 zeigt den echten Formatter-Output und darf bleiben.
