# BRIEF: 02-regenerate-erosion

## Kernbotschaft (1 Satz)

**„Verbessere diesen Code“ macht KI-Code Runde für Runde unsicherer. Unslop prüft jeden Push, und ein kritisches Finding lässt den Check scheitern, bevor die Verschlimmbesserung gemergt wird.**

## Warum dieses Thema

- **Zweite Säule der Positionierung.** `docs/strategy/MARKETING_CLAIMS.md` §5 („It compounds“) und die Landing-Copy (`messages/en.json` → `marketing.pillarErosion`, `statBand.stats.erosion`) tragen die These „Just regenerate it makes code worse“.
- **Echte CRITICAL-Regeln.**
  - `PROC-002` in `data/Golden_Database__-_Tabellenblatt1.csv`: Iterative LLM-Verfeinerung erodiert Sicherheit, 2,1 → 4,7 → 6,2 Vulns/Sample, auch mit Security-Prompt (arXiv 2506.11022).
  - Der konkrete Fehler im Beispiel ist `SEC-004` (SQL-Injection). Seine `public_explanation` stammt aus `supabase/migrations/040_populate_public_explanations.sql`.
- **Echtes Produktverhalten.**
  - Jeder Push (`synchronize`, `src/app/api/webhook/route.ts`) löst einen neuen Review mit eigenem Check Run aus.
  - Check-Name und Titel stammen aus `src/lib/check-run.ts`, das Kommentarformat aus `src/lib/pipeline/helpers.ts`.
- **Bewusst nicht behauptet:** Die Landing sagt „If quality drops, the build fails“, also ein Vergleich Revision gegen Revision. Den gibt es im Code nicht, der Check scheitert pro Revision bei jedem CRITICAL-Finding. Das Video sagt deshalb nur „A critical finding fails the check“. Die Abweichung steht als To-Do in `ROADMAP.md`.

## Zielgruppe und Plattform

- **Zielgruppe:** Entwickler:innen und Tech Leads, die KI-Assistenten oder Agents Code „nachbessern“ lassen: Regenerate-Button, Agent-Loops, „fix this“-Prompts.
- **Plattform:** Reels, TikTok, Shorts und ein stummes Website-Autoplay. Die Botschaft funktioniert ohne Ton.

## Format

- 1080 × 1920, 60 fps, **27,7 s** (15 Takte bei 130 BPM), H.264 High BT.709, AAC.
- Die Lesezeiten sind von Anfang an eingeplant (Lehre aus Film 01): Jede Textzeile steht nach dem Einblenden mindestens 1,3 s.
- **Safe Zones:** Wichtiger Text liegt zwischen y = 250 und y = 1520.

## Sprache

**Englisch** (Default-Locale der App, Produkt-Strings englisch). Die DE-Fassung ist im Wörterbuch `STR.de` vorbereitet (`LANG_FILM=de`).

## Ehrlichkeit

- Code, Runden, Commits und Kommentar sind **Beispieldaten** und im Bild als „Example“ markiert.
- Die Zahlen 2,1 / 4,7 / 6,2 kommen aus der Golden DB bzw. aus MARKETING_CLAIMS §3, die Quelle steht im Bild. Den Balken ordne ich keine Rundennummern zu, weil die Zuordnung im Repo nicht belegt ist. Die Achse sagt nur „as ‘improve this code’ rounds pile up“, wie die Landing.

## v2 (Feedback: „besseres Ear Candy, Musik ist trash, Hook besser“)

- **Hook neu:**
  - Frame 0 zeigt „Hit regenerate.“, dazu einen großen Regenerate-Button mit Cursor.
  - Drei Klicks auf dem Beat, jeder mit Glyph-Scramble der umgeschriebenen Zeile, Kamera-Ruck und dem Chip „Regenerated ×n“.
  - Beim dritten Klick ist die SQL-Injection drin. Danach „It quietly added a SQL injection.“ und „That's not bad luck.“ als Brücke zur Studie.
- **Musik neu:** Mixkit „Waka Floka Type“ (Arulo, #364, Trap, 130 BPM). Messbar der stärkste Drop der geprüften Kandidaten: +18,7 dB Gesamtpegel und +37 dB Bass am Drop (#162 hatte praktisch keinen). Der Film läuft deshalb im 130-BPM-Raster (`timeline.json`, Faktor 128/130).
- **Sounddesign:**
  - Tape-Stop aus dem lauten Hook in den leisen Break
  - Tiefpass, der sich über den Break von 600 Hz auf 9 kHz öffnet
  - Synth-Riser und Reverse-Swell in den Drop
  - Sub-Boom auf dem roten Check
  - Glitch-Bursts auf jedem Regenerate
  - gestimmte Plinks D–F–A für die Chart-Balken, links, Mitte, rechts gepannt
  - Erfolgs-Arpeggio beim grünen Check
  - 8-Bit-Blips (D-Moll-Pentatonik) beim Pixel-Schild
  - Sidechain-Ducking der Musik unter den Treffern
- **Gemessen:**
  - Hook −11,6 dB, Break −19,4 dB, Drop −9,6 dB
  - Bass-Einsatz bei 12,92 s = roter Check
  - −14,0 LUFS, True Peak −1,0 dBFS

## Storyboard v2 (Film-Zeit, 130 BPM, Takt = 1,846 s)

| Zeit | Szene | Bild | Text |
|---|---|---|---|
| 0,00–1,70 | **Hook** | Code-Karte „Original“, darunter der Regenerate-Button mit Cursor. Klicks bei 0,46 / 0,92 / 1,38 s: Scramble, Ruck, „Regenerated ×1–×3“. Beim dritten wird die Zeile zur SQL-Injection (rot, Squiggle). | „Hit regenerate.“ |
| 1,87–3,50 | **Der Fehler** | Push-in auf die rote Zeile | „It quietly added / a **SQL injection**.“ |
| 3,66–5,54 | **Brücke** | Halten, Tape-Stop in den Break | „That's not bad luck.“ |
| 5,54–10,19 | **Evidenz** (Break) | Balken 2,1 → 4,7 → 6,2 mit Plinks, Caption, Quelle | „Vulnerabilities per sample“ / „Even with a security-focused prompt.“ |
| 10,19–12,92 | **Gate** (Break) | Commit-Liste, erster Commit ✓, zweiter mit Spinner, Riser | „Unslop checks **every push**.“ |
| 12,92–15,26 | **Drop** | ✕ „1 critical slop finding“, Sub-Boom | „A critical finding / **fails** the check.“ |
| 15,6–20,1 | **Regel + Fix** | `unslop[bot]`: 🚨 SEC-004 (CRITICAL), Suggested fix, Klick bei 19,85 s | „It names the rule. / And the fix.“ |
| 20,0–23,7 | **Clean** | dritter Commit ✓ mit Arpeggio | „Re-checked. **Clean.**“ |
| 24,0–27,7 | **Endcard** | Pixel-Schild mit 8-Bit-Blips, Wortmarke | „Deterministic AI code review.“ / „Every push. Every revision.“ |

## Storyboard v1 (historisch, 128 BPM, Musik #162)


| Zeit | Szene | Bild | Text |
|---|---|---|---|
| 0,00–1,88 | **Hook** | Code-Karte `lib/users.ts` mit parametrisierter Query, Chip „Round 1“. Im Prompt-Feld wird „improve this code“ getippt und gesendet. | „Ask AI to / “improve this code.”“ |
| 1,88–3,40 | **Loop** | Runde 2: harmlose Änderung, Zeile blitzt lime auf. Runde 3: die Query wird zum Template-String mit `${id}`, rot markiert und unterkringelt. Push-in. | „Again. And again.“ |
| 3,40–5,63 | **Ergebnis** | Halten auf der roten Zeile | „It got **worse**.“ |
| 5,63–10,35 | **Evidenz** (Musik-Break) | Balken 2,1 → 4,7 → 6,2, Achse, Caption, Quelle | „Vulnerabilities per sample“ / „Even with a security-focused prompt.“ |
| 10,35–13,13 | **Gate** (Break) | Commit-Liste: `feat: add user lookup` ✓, `refactor: improve this code` mit amber Spinner | „Unslop checks **every push**.“ |
| 13,13–15,55 | **Drop** | Der Commit schlägt fehl: ✕ „1 critical slop finding“, rote Zeile | „A critical finding / **fails** the check.“ |
| 15,85–20,40 | **Regel + Fix** | `unslop[bot]`: 🚨 SEC-004 (CRITICAL), public_explanation, Suggested fix (Template → `$1`). Klick „Commit suggestion“ bei 20,156 s (Beat). | „It names the rule. / And the fix.“ |
| 20,30–24,05 | **Clean** | Commit-Liste mit drittem Commit „Apply suggestions from code review“: Spinner, dann ✓ | „Re-checked. **Clean.**“ |
| 24,38–28,13 | **Endcard** | Pixel-Schild, Wortmarke, Push-in | „Deterministic AI code review.“ / „Every push. Every revision.“ / „119 research-backed rules.“ / „unslop.codes“ |

Musik: wie Film 01 („Minimal Techno 01“, 128 BPM). Der 2-taktige Break wird zweimal gespielt (Film 5,625–13,125), der Kick kommt auf dem roten Check zurück. Das prüft `audio.py` per Assert, die Bass-Messung bestätigt es.
