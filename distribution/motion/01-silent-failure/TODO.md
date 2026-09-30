# TODO – 01-silent-failure

- [x] Repo erkunden (README, ROADMAP, Marketing-Claims, Landing-Komponenten, Tokens, Fonts, Icon, Check-Run- und Kommentar-Code, Golden DB)
- [x] Skill klonen, SKILL.md + Beispiel howseen-launch vollständig lesen
- [x] Skill nach `.claude/skills/motion-design/` kopieren
- [x] Musik + SFX wählen, Drop per Band-Energie messen
- [x] BRIEF.md (Thema, Zielgruppe, Format, Storyboard, Sprache)
- [x] BEATMAP.md
- [x] film.html (seek(t)-Engine, i18n-Wörterbuch, echte Tokens/Fonts/Icon)
- [x] render.py (probe / full / pops / contact) + fetch_assets.py + audio.py
- [x] Probe-Stills Runde 1 ansehen + kritisieren
- [x] Probe-Stills Runde 2 ansehen + kritisieren
- [x] Voller Render mit Motion Blur
- [x] Dichte Frame-Extraktion: Pops, abgeschnittener Text, Overflow, Reihenfolge
- [x] Fixes + Re-Render (4 volle Renders)
- [x] Audio: Musik + SFX nach Peak, −14 LUFS, Mux
- [x] final.mp4 (7,9 MB), poster.png (Hook-Frame 1,7 s)
- [x] README.md, CREDITS.md, .gitignore
- [ ] Commit, Push, Pull Request

## Befunde der Selbstkontrolle

**Probe-Runde 1**
- Silkscreen-Ziffern („44:1“, „119“) unleserlich → Zahlen in Geist Bold
- Zoom in Szene 2 schneidet Pfad und Avatar ab → Fokus nach links, Zoom 1,16
- Headline überlappt Kommentar-Karte → Kamera-Keys korrigiert
- „Fixed before merge“: einsame Karte in Leere → gefixte Code-Karte als Vorher/Nachher
- Code zu klein → 34 px
- Frame 0 leer → Karte und Headline ab t=0

**Probe-Runde 2**
- Statistik zu kurz lesbar → bis 5,86 s
- Lücke in der Gate-Szene → Karte hoch
- Silkscreen-Akzent 5× → nur noch 3× plus Wortmarke

**Übergänge**
- 13,9 s und 15,2 s: Karten fahren durch Headlines bzw. doppelbelichten → Fade an Ort und Stelle, zeitlich getrennt
- „Fixed“ vor dem Klick → Headline nach dem Klick

**Voller Render 1: Kontaktbogen, Handy-Sheet, Pop-Scan (0 Pops)**
- Kommentar-Karte 1,8 s halb leer → Höhe wächst mit dem Inhalt
- Endcard > 2 s statisch → langsamer Push-in
- Check-Karte auf 360 px zu klein → größer
- Exit bei 9,3 s verschmiert → langsamer

**Voller Render 2: dichte Streifen um 3,65 / 7,4 / 9,25 / 13,4 / 14,9 / 16,7 s**
- Headline-Wechsel überlappen (alte fährt raus, neue schon rein) bei 3,7, 7,4, 9,3, 14,9 → Ausstiege vorgezogen
- Check-Karte fliegt beim Exit durch die Headline-Zone → blendet an Ort und Stelle aus

**Render 3**
- 0 Pops, Übergänge sauber sequenziell
- Label-Swap „Checks“ → „GitHub App“ gleichzeitig = Textsalat → nacheinander
- Leere Frames nach dem Schnitt 3,75 → „44“ startet 3,70

**Poster-Check**
- Zeile 7 klebt am Kartenrand (935/940 px) → Code 33 px

- [x] Voller Render 2, 3, 4 + Pop-Scan + QA-Sheets

## v2: Feedback „zu schnell, der Text usw.“

- [x] Zeitkarte `timeline.json`: 20,6 s → 30 s, Lese-Haltephasen nach jeder Textzeile (Hook 1,5 s, Bug 1,5 s, Statistik 1,7 s, Gate 1,1 s, Regel-Erklärung 2 s, Suggested fix 1,6 s, Fixed 1,1 s, Oberflächen 1,2 s)
- [x] Ambient-Bewegung (Beat-Punches, Spinner, Caret, Hintergrund) in Film-Zeit, damit in Haltephasen nichts einfriert
- [x] Musik: Break per Taktschnitt 2 → 3 Takte, Drop weiter exakt auf dem roten Check (Film 11,25 s, per Assert und Bass-Messung belegt)
- [x] Bug: Der seek-Parameter `T` überdeckte das Text-Wörterbuch `T`, der Button „Commit suggestion“ war leer → umbenannt
- [x] Bug: ✓-Pop und VS-Code-Status lagen in Haltephasen (Zeitlupen-Pop) → Anker hinter die Animationen verschoben
- [x] Pop-Scan: 1 Treffer bei 5,633 s = der gewollte harte Schnitt auf „44 : 1“ am Break-Beginn
- [x] Voller Render v2 + QA + Mux

## v3: „mehr Ear Candy, bessere Hook, andere Musik“ (wie Film 02)

- [x] Hook: 16tel-Scan mit Haken auf jeder Zeile (auch dem Bug), LGTM-Slam mit Ruck, Haken der Bug-Zeilen glitchen zu roten ✕
- [x] Zeile 7 kollidierte mit dem Haken → Beispielzeile auf `POST(req) {` gekürzt
- [x] Musik #190 (120 BPM, Drop 16,03 s, B-Moll), Zeitkarte auf das 120-BPM-Raster (32 s, Break 6 s, Drop 12 s, Klick 22 s)
- [x] Sounddesign wie Film 02, in B-Moll gestimmt; Audio-QA: Abschnittspegel, Bass-Einsatz 12,00 s, Spektrogramm
- [x] Voller Render: 0 Pops, Kontaktbogen geprüft, Poster 2,4 s
- [ ] Titel und Lizenz-Label von Track #190 auf der Mixkit-Seite bestätigen (Rate-Limit am 29.09.)
- [ ] Gegenhören mit Kopfhörern

## v4: Faktencheck für die Kanal-Posts (distribution/channels, 2026-09-29)

- [x] Stat-Szene gegen den Volltext von arXiv 2604.17587 geprüft: „44:1“ stammt aus dem *explorativen* Vergleich (§5.5, ein Modell `minimax-m2:cloud`, eine Codebasis), nicht aus der Matched-Control-Studie. Neuer Text: „A cloud LLM reviewer passed what / a deterministic scan flagged.“, Label „LLM evaluator“, Quelle „AIRA · arXiv 2604.17587 · exploratory comparison, one model“ (DE entsprechend)
- [x] Endcard ohne „Verdicts no LLM votes on.“ (widerspricht dem Code, `distribution/channels/CONTEXT.md` W3): „A review gate for AI-written code.“ / „119 research-backed rules.“ / „Every finding names its rule.“
- [x] `?beta=1` (Render: `FILM_QUERY=beta=1`): durchgehender Stempel „Private beta“ oben, für Posts vor dem Launch
- [x] `cuts/beta.mp4` (mit Stempel) und `cuts/launch.mp4` (ohne), Video neu gerendert, Original-Audio unverändert gemuxt (Timing identisch), `render.py pops` ⇒ 0
- [ ] `final.mp4` und `poster.png` tragen noch den alten Text. Vor einer weiteren Nutzung `cuts/launch.mp4` als neues `final.mp4` übernehmen oder den Film für Reels neu abnehmen
