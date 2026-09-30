# CHECK: Selbstkontrolle X

Stand 2026-09-29.

## 1. Dateien gegen die Specs gemessen (`python3 _kit/specs.py 01-x/visuals`)

<!-- SPECS:BEGIN -->
| Datei | Maße / fps / Dauer / Codecs / Bitrate | Größe |
|---|---|---|
| `x-cli-output.png` | 1600×900 | 202 KB |
| `x-film01-beta-16x9.mp4` | 1920×1080 | 30 fps | 32.0 s | h264 High / aac LC | 6191 kb/s | 23.6 MB |
| `x-film01-beta-9x16.mp4` | 1080×1920 | 30 fps | 32.1 s | h264 High / aac LC | 6191 kb/s | 23.7 MB |
| `x-film02-beta-16x9.mp4` | 1920×1080 | 30 fps | 27.7 s | h264 High / aac LC | 6191 kb/s | 20.4 MB |
| `x-film02-beta-9x16.mp4` | 1080×1920 | 30 fps | 27.7 s | h264 High / aac LC | 6191 kb/s | 20.5 MB |
| `x-film03-launch-16x9.mp4` | 1920×1080 | 30 fps | 27.7 s | h264 High / aac LC | 6196 kb/s | 20.5 MB |
| `x-film03-launch-9x16.mp4` | 1080×1920 | 30 fps | 27.7 s | h264 High / aac LC | 6196 kb/s | 20.5 MB |
| `x-pr-finding.png` | 1600×900 | 228 KB |
| `x-status-board.png` | 1600×900 | 200 KB |
| `x-study-aira.png` | 1600×900 | 104 KB |
| `x-study-erosion.png` | 1600×900 | 115 KB |
<!-- SPECS:END -->

Soll-Werte laut RESEARCH.md §2 (docs.x.com/x-api/media/quickstart/best-practices):

| Prüfpunkt | Soll | Ergebnis |
|---|---|---|
| Seitenverhältnis | zwischen 1:3 und 3:1 | 16:9 und 9:16 ✓ |
| Codec | H.264 High, AAC LC, yuv420p, progressive | ✓ (ffmpeg-Streaminfo) |
| Video-Bitrate | ≥ 5.000 kbps | CBR 6 Mbit/s (`make_x_cuts.sh`) ✓ |
| fps | ≤ 60, empfohlen 30/60 | 30 ✓ |
| Dauer | ≤ 140 s (strengste Angabe, sekundär) | 27,7–32,1 s ✓ |
| Dateigröße | ≤ 512 MB (strengste Angabe); Auftrag: < 50 MB | alle < 25 MB ✓ |
| Auflösung | Doku: „must be between 32x32 and 1280x1024“ (widersprüchlich zu 1080p) | **offen:** Test-Upload vor dem Posten (LAUNCH.md) |
| Bilder | ≤ 5 MB; 16:9 füllt die Timeline-Vorschau | 1600×900, 100–230 KB ✓ |

Von Hand in den Stills und im Kontaktbogen der Videos geprüft:
- **Stempel:** Jedes Bild eines nicht-öffentlichen Features trägt „Private beta“ bzw. „Roadmap“ sichtbar im Bild, auch im 9:16-Film durchgehend oben (`?beta=1`).
- **Beispieldaten:** Jede Beispieldatei ist markiert („Example“/„Example data“).
- **Konzept-Stil:** Die Roadmap-Spalte im Status-Board ist gestrichelt und schraffiert, sie sieht nicht wie ein Screenshot aus.

## 2. Zeichenlimits (`python3 _kit/count.py 01-x/POSTS.md x`)

Alle 26 Posts bzw. Thread-Teile ≤ 280 gewichtete Zeichen. Gewichtung nach den twitter-text-Bereichen; `unslop.codes` zählt als Link mit 23. Die knappsten Posts:

| Post | Zeichen |
|---|---|
| X-1 Reply | 275 |
| X-2 Teil 3 | 276 |
| X-L3 | 270 |
| X-1 | 268 |

Beim Umformulieren neu zählen. Die FAQ-Kurzantworten sind ebenfalls ≤ 280 (höchster Wert 266).

## 3. Zahlen und Status gegen CONTEXT.md

| In X verwendet | CONTEXT | ✓ |
|---|---|---|
| 1.80×, 0.435 vs 0.242, 955-vs-955, JS/Python/TS | C1 | ✓ Wortlaut nach Paper |
| 44:1 nur mit „secondary, exploratory“, „one model, one codebase“ | C2 | ✓ nie als Hook |
| 2.1 / 4.7 (3–7) / 6.2 (8–10), GPT-4o, nicht zwischen benachbarten Iterationen signifikant | C3 | ✓ |
| „Even prompts asking for security added new ones“ | C3 (Paper: „even explicitly asking for security improvements was associated with new vulnerabilities“) | ✓ |
| 119 Regeln, 55 mit deterministischem Detektor, LLM-Lane nur JS/TS | §4b | ✓ |
| „only critical findings fail the check“ | §4b, `check-run.ts` | ✓ |
| Blind-Verifier nur „on the standard route“ plus Label pro Finding | §4b, SPEC D5/§6 | ✓ nach Korrektur |
| „Nothing was reviewed — this is NOT a clean verdict.“ | echter CLI-String | ✓ |
| Pro €29/month, 14-day trial | §1 Preise, nur Phase B und nur bei Paddle live | ✓ mit Vorbedingung |
| Roadmap: Revisionsvergleich, Trend, zweiter Anbieter, Zertifikat | §5 | ✓ ohne Termine, als „planned, not built“ |
| Keine internen Formulierungen (Supply-Chain, Monopol, Agenturen) | §5 | ✓ |
| Kein `npx unslop` | §1 | ✓ |

## 4. Lesung als skeptischer Senior Engineer, der unslop nicht kennt

| Stelle | Einwand | Änderung |
|---|---|---|
| X-1: „It flags this as SEC-031“ | Behauptet ein Ergebnis für Beispielcode, ohne Beleg für genau diesen Lauf | → „Its rule SEC-031 (critical) targets exactly this“ |
| X-1, X-2, X-L1, X-L2, FAQ 1/2: „findings get a blind second pass“ | Nicht immer wahr: `pro-direct` überspringt den Verifier | → „on the standard route“ und „each finding says how it was verified“ |
| X-3 Teil 4: „strongest concentration in exception handling“ | Das steht im Paper für die Pilotstudie, nicht für die Replikation | → „In the paper's pilot study, the clearest signal sat in exception-handling patterns.“ |
| X-4: „One study asked LLMs … Security-focused prompts included.“ | Klingt nach vielen Modellen und danach, dass die Durchschnittswerte auch für Security-Prompts gelten | → „had GPT-4o ‘improve’ …“, „Even prompts asking for security added new ones“; Karte und Panel ebenso |
| X-L1: „posts the same findings as a GitHub check“ | Die CLI postet selbst nichts auf GitHub | → „The GitHub App runs the same checks on every PR.“ |
| X-5: „example repo“ | Auch das Finding ist Beispieldaten | → „example data“ |
| Film 01: „LLM judges under-count failures dressed up as success“, Quelle „AIRA matched-control study“ | Falsch zugeordnet (44:1 stammt aus dem explorativen Vergleich) und verallgemeinert | Film-Text geändert (gilt für alle Fassungen): „A cloud LLM reviewer passed what a deterministic scan flagged.“ Quelle: „AIRA · arXiv 2604.17587 · exploratory comparison, one model“ |
| Film 01 Endcard: „Verdicts no LLM votes on.“ | Widerspricht dem Code (W3) | → „A review gate for AI-written code.“ / „Every finding names its rule.“ |
| Film 02 Endcard: „Deterministic AI code review.“ | Überdehnt (W3) | → „A review gate for AI-written code.“ |
| Werbeton | Keine Superlative, keine Hype-Emojis. Einziges Emoji: 👇 im Reply von X-4 als Verweis | belassen |

## 5. Offen (nicht in diesem Paket lösbar)

- **Test-Upload** der 1080×1920-Datei (API-Doku „max 1280x1024“) und Sichtprüfung auf iOS, Android und Desktop. Falls X ablehnt oder schlecht skaliert: 720×1280 aus derselben Quelle erzeugen. Dafür in `make_x_cuts.sh` `scale=720:1280` setzen.
- **`x-cli-output.png`** ist auf dem Handy erst nach dem Antippen lesbar (17,6 px Mono auf 1600 px Breite). Das ist gewollt, weil es den vollständigen echten Output zeigt. Der Hook liegt deshalb im Text von X-5, nicht im Bild.
- **Mix der Filme** ist weiterhin nicht mit Kopfhörern gegengehört (Film-TODOs). Ohne Ton funktionieren die Filme durch die eingebrannte Typo. Kein Voiceover, deshalb kein SRT.
- **X-3** hängt an der Landing-Korrektur W1 (ROADMAP §10).
