# 02-regenerate-erosion: „Ask AI to improve this code. It got worse.“

Motion-Design-Promo für Reels, TikTok, Shorts und die Website: 1080 × 1920, 60 fps, 27,7 s (v2: neuer Hook, Trap-Track #364, Sounddesign). Thema, Belege und Storyboard stehen in [BRIEF.md](BRIEF.md).

- `final.mp4`, `poster.png`: das Ergebnis
- `film.html`: der Film als eine deterministische `window.seek(t)`-Funktion, direkt in Film-Zeit geschrieben
- `timeline.json`: Dauer, BPM und Musik-Anker (`filmBreak`, `filmDrop`). Die Szenen in `film.html` sind im 128-BPM-Raster geschrieben, die Zeitkarte streckt sie auf das 130-BPM-Raster des Tracks (Faktor 128/130).
- `render.py`, `audio.py`, `fetch_assets.py`: wie in [01-silent-failure](../01-silent-failure/README.md)

## Neu rendern

```bash
cd distribution/motion/02-regenerate-erosion
python fetch_assets.py
python render.py probe 1.2 4.4 8.5 14.2 19.0 22.5 27.0
python render.py full --jobs 4 --sub 6
python render.py pops && python render.py qa
python audio.py
python render.py poster 3.2
```

## Texte, Farben, Timing ändern

- **Texte:** Wörterbuch `STR.en` / `STR.de` oben in `film.html`. Die deutsche Fassung rendert `LANG_FILM=de python render.py …`.
- **Beispielcode:** `ROUNDS` (drei Fassungen der Datei, eine pro Runde) und `SUG` (Suggestion-Block).
- **Chart:** `BARS` (Werte), `SCALE` (px pro Einheit).
- **Farben:** CSS-Variablen in `:root` (= `src/app/globals.css`) sowie `LIME`, `RED` und `AMBER` im Script.
- **Timing:**
  - Die Szenen sind in einzelne Funktionen aufgeteilt (`sceneLoop`, `sceneChart`, `sceneChecks`, `sceneComment`, `sceneEnd`), jede mit ihren eigenen Zeiten.
  - Die Musik-Anker sind `BRK = 3 * BAR` (Schnitt auf den Chart) und `DROP = 7 * BAR` (roter Check). Wenn du sie verschiebst, ändere auch `filmBreak`/`filmDrop` in `timeline.json`.
  - `audio.py` rechnet die Anzahl der Break-Takte selbst aus und bricht mit einem Assert ab, wenn der Drop nicht trifft.

## Sound ändern

`audio.py` ist in drei Blöcke gegliedert:
- **Synth-Funktionen:** `plink`, `glitch`, `sub_boom`, `riser`, `reverse_swell`, `blip`, `arpeggio`, `tape_stop`, `lowpass_sweep`.
- **Musik-Montage:** Hook, Break und Drop aus dem Song.
- **`EVENTS`:** Liste aus Zeit, Klang, Pegel und Peak-Ausrichtung. Pegel hier ändern, Töne über `NOTE` (D-Moll). Das Ducking steht in der `duck`-Schleife.

## Bekannte Grenzen

- Der Mix ist nicht mit Kopfhörern gegengehört, die SFX sind rechnerisch gesetzt.
- Die DE-Fassung ist vorbereitet, aber nicht gerendert.
