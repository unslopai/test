# 01-silent-failure: „Your AI reviewer approved this.“

Motion-Design-Promo für Reels, TikTok, Shorts und die Website: 1080 × 1920, 60 fps, 32 s (v3: Scan-Haken-Hook, Track #190, Sounddesign). Ein KI-Reviewer gibt einen Handler frei, der einen Fehler verschluckt und `ok: true` zurückgibt. Unslop fängt das als `SEC-031` (CRITICAL), nennt die Regel, liefert den 1-Klick-Fix, und der Check wird grün. Thema, Belege und Storyboard stehen in [BRIEF.md](BRIEF.md), das Musik-Raster in [BEATMAP.md](BEATMAP.md).

- `final.mp4`: H.264 High, BT.709 TV-Range, AAC 256k, −14 LUFS
- `poster.png`: Thumbnail
- `film.html`: der ganze Film als eine deterministische `window.seek(t)`-Funktion (keine CSS-Transitions, keine Timer)
- `timeline.json`: die Zeitkarte Film-Zeit → Szenen-Zeit (Lese-Haltephasen, Musik-Anker), gelesen von `film.html`, `render.py` und `audio.py`
- `render.py`: Playwright rendert Frame für Frame, 6 Subframes pro Frame werden per `tmix` zu Motion Blur gemischt, dazu kommen Pop-Scan und QA-Sheets
- `audio.py`: Musik plus SFX nach gemessenem Peak, synthetischer Riser, Loudnorm, Mux zu `final.mp4`
- `fetch_assets.py`: lädt Musik und SFX von Mixkit (nicht eingecheckt, siehe [CREDITS.md](CREDITS.md))

Gebaut mit dem Skill unter `.claude/skills/motion-design/` (aus [howseen-ai/claude-motion-design](https://github.com/howseen-ai/claude-motion-design), MIT).

## Neu rendern

Voraussetzungen: Python 3.10+, `pip install playwright imageio-ffmpeg numpy pillow` und ein Chromium. `render.py` nimmt `CHROME_PATH`, sonst `/opt/pw-browsers/chromium`, sonst den von `python -m playwright install chromium`.

```bash
cd distribution/motion/01-silent-failure
python fetch_assets.py                                  # Mixkit-Musik + SFX, Geist Mono (einmalig)
python render.py probe 1.4 3.3 5.0 8.2 12.4 14.8 16.4 19.5   # Stills -> probe/sheet.png, erst ansehen
python render.py full --jobs 4 --sub 6                  # ~15-20 min auf 4 Kernen -> out/video.mp4
python render.py pops                                   # Frame-Sprünge suchen
python render.py qa                                     # out/qa/: contact.png, phone.png, strip_*.png
python audio.py                                         # out/audio.wav + final.mp4
python render.py poster 2.4                             # poster.png (Hook-Frame mit Haken + LGTM)
```

`render.py` startet selbst einen lokalen HTTP-Server, ein separates `http.server` ist nicht nötig. `film.html` lässt sich zum Scrubben auch im Browser öffnen: über einen beliebigen lokalen Server, dann in der Konsole `seek(8.2)`.

## Texte ändern

Alle On-Screen-Texte stehen im Wörterbuch `STR` ganz oben im `<script>` von `film.html`, als `STR.en` und `STR.de`.

- **Sprache:** `LANG_FILM=de python render.py …` rendert die deutsche Fassung (`film.html?lang=de`). Beim DE-Render vorher `out/` sichern, weil derselbe Ausgabepfad benutzt wird.
- **Akzentwörter:** `<b class="px">…</b>` setzt ein Wort in Silkscreen/Lime wie das Akzentwort der Landing-H1. `<b class="rd">` macht es rot, `<b style="color:#bef264">` lime in Geist.
- **Überlange Zeilen** werden beim Laden automatisch auf 940 px Breite verkleinert (`fitLine`), sodass nichts aus den Seitenrändern läuft.
- **Code-Beispiele:** `CODE` (vorher), `FIXED` (nachher) und `SUG` (Suggestion-Block). Wenn du Zeilen änderst, prüfe auch die Squiggle-Spalten in `seek` (`squiggle(78 + 4 * CH, …)`, `CH` = Zeichenbreite).
- **Echte Produkt-Strings** (Check-Name, Check-Titel, Kommentarformat, CLI- und VS-Code-Texte) stammen aus dem App-Code. Ändert sich die App, zieh die Texte nach:
  - `src/lib/check-run.ts`
  - `src/lib/pipeline/helpers.ts`
  - `packages/cli/src/format.ts`
  - `packages/vscode-extension/src/stateMachine.ts`

## Farben ändern

Die Tokens stehen als CSS-Variablen in `:root` von `film.html` und entsprechen `src/app/globals.css`. In JS gibt es zusätzlich `LIME`, `RED` und `AMBER`. Ändert sich die Markenfarbe in `globals.css`, reicht es, diese Stellen und das Schild-SVG (`assets/img/shield-mark.svg`, `fill`) anzupassen.

## Dauer und Timing ändern

Der Film hat zwei Zeitebenen:
- **Szenen-Zeit:** Alle Ein- und Ausstiege in `seek(t)` von `film.html` sind in Szenen-Zeit geschrieben, das ist die ursprüngliche 20,6-s-Fassung.
- **Zeitkarte:** `timeline.json` bildet Film-Zeit darauf ab. Die `anchors` sind Paare `[Szenen-Zeit, Film-Zeit]` und werden stückweise linear interpoliert. `duration` ist die Filmlänge und wird auch von `render.py` und `audio.py` gelesen.

- **Mehr oder weniger Lesezeit:** Den Film-Wert des Ankers am Ende einer Haltephase verschieben, zum Beispiel `[11.2, 17.0]` auf `[11.2, 17.6]`, und alle folgenden Film-Werte um denselben Betrag. `duration` entsprechend anpassen. Die Anker `[3.75, 5.625]` (Break), `[7.5, 11.25]` (Drop) und `[13.59, 20.625]` (Klick) liegen auf dem Musikraster: nur um ganze Beats (0,46875 s) oder Takte (1,875 s) verschieben. Dann `filmBreak` und `filmDrop` nachziehen.
- **Break-Länge:** `audio.py` verlängert das Song-Break per Taktschnitt. Ändert sich die Dauer von Break bis Drop, muss der Schnitt in `audio.py` (`parts`) mitziehen, sonst schlägt der Drop-Assert an.
- **Anderer Song:** BPM und Drop mit `.claude/skills/motion-design/scripts/analyze_song.py` messen. Einem Auto-Beat-Raster nicht trauen: bei diesem Track lag es bei 63,8 statt 128.

## Qualitätssicherung (so wurde abgenommen)

1. Probe-Stills in drei Runden, jede Runde kritisch bewertet. Die Befunde stehen in [TODO.md](TODO.md).
2. Voller Render, danach `render.py pops` und `render.py qa`: dichte Frame-Streifen um jede Bewegung, Handy-Breiten-Sheet (360 px), Kontaktbogen.
3. Loudness mit `ebur128` gemessen.

`render.py pops` meldet in v2 genau einen Treffer bei 5,633 s. Das ist der gewollte harte Schnitt auf „44 : 1“ am Beginn des Musik-Breaks, kein Fehler.

## Bekannte Grenzen

- Das Video wurde ohne Abhören gemischt: SFX-Pegel und Timing sind rechnerisch auf die Bild-Events gesetzt, ein Gegenhören mit Kopfhörern steht aus.
- Die deutsche Fassung ist vorbereitet (Wörterbuch), aber nicht gerendert und nicht Korrektur gelesen.
