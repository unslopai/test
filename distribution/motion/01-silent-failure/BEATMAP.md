> **v3:** Musik ist jetzt Mixkit #190 (120 BPM, Drop 16,03 s), Film 32 s, Break 6,0 s, Drop 12,0 s, Klick 22,0 s. Anker in `timeline.json`, Musik-Montage in `audio.py`. Der Rest dieser Datei dokumentiert v2.

# BEATMAP: 01-silent-failure (v2, 30 s)

- **Track:** Mixkit „Minimal Techno 01“ (#162), gemessen mit `analyze_song.py` plus einem Kick-Raster-Fit:
  - **128,00 BPM**, Beat = 0,46875 s, Takt = 1,875 s, Kick-Phase bei Song 35,24 + n · Beat.
  - Das Auto-Raster lag bei 63,8 (halbe Zeit).
- **Break im Song:** Die Kick-Amplitude auf dem Raster fällt von ~140 auf 29–88 ab Song 41,33 s. Voll zurück ist sie bei **45,08 s**, das Break dauert also 2 Takte.
- **Schnitt (v2):** Song 35,705–43,205 (Anlauf + Break-Takt 1), dann Song 41,33 → Ende (Break-Takte 1–2 + Drop), mit 6 ms Crossfade am Taktschnitt. So ergibt sich ein Break von 3 Takten. `audio.py` prüft per Assert, dass der Drop auf Film 11,25 s landet.

## Zeitkarte

`film.html` rechnet seine Animationen in „Szenen-Zeit“ (die ursprüngliche 20,6-s-Fassung). `timeline.json` bildet Film-Zeit stückweise linear darauf ab: Zeitspannen, in denen viel Film-Zeit auf wenig Szenen-Zeit kommt, sind Lese-Haltephasen. Ambient-Bewegung (Beat-Punches, Spinner, Caret, Hintergrund) läuft in Film-Zeit, damit nichts einfriert. `audio.py` setzt die SFX über dieselbe Karte.

| Film | Szenen-Zeit | Ereignis |
|---|---|---|
| 0,00 | 0,00 | Code-Karte steht, Headline steigt auf |
| 1,35–2,90 | 1,35–1,875 | Haltephase Hook |
| **5,625** | **3,75** | **Break, harter Schnitt auf „44 : 1“** |
| 6,90–8,60 | 4,90–5,55 | Haltephase Statistik |
| 8,906 | 5,86 | Gate: Check-Run-Zeile, Spinner |
| **11,25** | **7,50** | **Drop: ✕ „1 critical slop finding“** |
| 15,0–17,0 | 10,4–11,2 | Haltephase Regel-Erklärung |
| 18,0–19,6 | 12,0–12,75 | Haltephase Suggested fix |
| 20,625 | 13,59 | Klick „Commit suggestion“ (auf dem Beat) |
| 22,2–23,3 | 14,9–14,95 | Haltephase „No AI slop found“ (erst nach dem ✓-Pop) |
| 25,0–26,2 | 16,4–16,6 | Haltephase Oberflächen (nach „No slop ✓“) |
| 26,5 | 16,875 | Endcard |
| 29,1–30,0 | | Musik-Fade-out |

Beat-Punches laufen ab dem Drop (11,25 s) bis 26,3 s mit `+0.008` pro Beat und `+0.022` auf jeder Takt-Eins, dazu exponentielles Abklingen. Vor dem Drop gibt es keine Punches.
