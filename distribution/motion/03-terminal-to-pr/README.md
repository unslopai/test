# 03-terminal-to-pr: „Don't push it yet.“

Motion-Design-Promo für Reels, TikTok, Shorts und die Website: 1080 × 1920, 60 fps, 27,7 s. Eine Änderung geht den ganzen Weg: `unslop scan` im Terminal fängt SEC-026, „Apply Gatekeeper Fix“ im Editor behebt es, der PR-Check ist grün. Am Ende steht der CTA `npm i -g @unslopcodes/cli`. Recherche, Belege und Storyboard stehen in [BRIEF.md](BRIEF.md).

> **Launch-Asset:** `@unslopcodes/cli` ist laut `ROADMAP.md` noch nicht auf npm veröffentlicht. Dieses Video erst nach `npm publish` posten, oder die Beta-Variante rendern (siehe unten).

- `final.mp4`, `poster.png`: das Ergebnis
- `film.html`: der Film als eine deterministische `window.seek(t)`-Funktion, in Film-Zeit auf dem 130-BPM-Raster des Tracks geschrieben
- `timeline.json`: Dauer, BPM, Musik-Anker (`filmBreak` = der Scan startet, `filmDrop` = das CRITICAL-Finding erscheint)
- `render.py`, `audio.py`, `fetch_assets.py`: wie in Film 01/02

## Neu rendern

```bash
cd distribution/motion/03-terminal-to-pr
python fetch_assets.py
python render.py probe 0.9 5.0 8.4 13.2 16.2 19.5 24.5
python render.py full --jobs 4 --sub 6
python render.py pops && python render.py qa
python audio.py
python render.py poster 0.9
```

## Varianten, Texte, Timing

- **CTA ohne npm:** `film.html?cta=beta` zeigt „Get early access · unslop.codes“ mit `open https://unslop.codes` / `unslop login`. Zum Rendern setzt du die URL in `render.py` (`serve()`) um `?cta=beta` oder rufst die Seite direkt auf. Achtung: Auch die Waitlist ist laut ROADMAP noch hinter einem Flag.
- **Sprache:** `LANG_FILM=de`, Wörterbuch `STR.de` in `film.html`. Die CLI- und VS-Code-Strings bleiben englisch, weil das Produkt englisch ist.
- **Texte und Code:** `STR` (Headlines, Hover-Text), `FINDING` (Terminal-Ausgabe), `CODE` / `FIXED3` (Editor), `CTA` (Befehle).
- **Timing:** Die Szenen hängen an `BRK`, `DROP`, `EDIT`, `PR`, `CTAT` (Vielfache von `BAR`). Klicks und Enter sitzen auf Beats (`n * BEAT`). Wer Anker verschiebt, zieht `timeline.json` und `audio.py` nach, sonst schlägt der Drop-Assert an.

## Bekannte Grenzen

- Der Mix ist nicht mit Kopfhörern gegengehört.
- Die DE-Fassung ist nicht gerendert.
- Das Terminal im Hook ist bewusst rechts angeschnitten, die Kamera zoomt auf die Prompt-Zeile.
