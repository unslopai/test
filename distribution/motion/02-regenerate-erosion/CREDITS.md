# CREDITS: 02-regenerate-erosion

Musik, SFX, Schriften und Pixel-Schild sind identisch mit [01-silent-failure/CREDITS.md](../01-silent-failure/CREDITS.md), dort stehen Lizenzen, IDs und die Prüfung vom 29.09.2026.

- **Musik (v2):** Mixkit „Waka Floka Type“ von Arulo (#364, `https://assets.mixkit.co/music/364/364.mp3`). Die Mixkit-Hip-Hop-Seite listet den Titel, alle Tracks dort stehen laut Seite unter der [Mixkit Stock Music Free License](https://mixkit.co/license/#musicFree), geprüft am 29.09.2026: kommerziell inklusive Social Ads, keine Namensnennung, keine Weiterverteilung der Rohdatei. Die Rohdatei ist deshalb nicht eingecheckt, `fetch_assets.py` lädt sie. Verwendet werden Song 25,85–31,38 s (Hook, mit Tape-Stop), 7,38–14,77 s (Break, tiefpassgefiltert) und ab 14,77 s (Drop).
- **SFX:** Mixkit 1125, 2568, 1117, 1113, 2573, 1490, 1143, 2569, 2865 (Mixkit Sound Effects Free License). Im Code synthetisiert (seeded, deterministisch, `audio.py`): Glitch-Bursts, gestimmte Plinks, Sub-Boom, Riser, Reverse-Swell, Arpeggios, 8-Bit-Blips und -Akkord, Tape-Stop, Tiefpass-Sweep. Das sind keine Stock-Assets.
- **Loudness:** −14 LUFS integriert, −1 dBTP (gemessen v2: −14,0 LUFS, True Peak −1,0 dBFS).
- **Schriften:** Geist und Silkscreen aus `src/app/(marketing)/assets/`, dazu Geist 500/600 und Geist Mono von fontsource. Alle unter SIL OFL 1.1. Die Emojis stammen aus Noto Color Emoji.
- **Inhalte:**
  - 2,1 / 4,7 / 6,2 Schwachstellen pro Sample: arXiv 2506.11022, via Golden DB `PROC-002` und `docs/strategy/MARKETING_CLAIMS.md` §3. Die Quelle steht im Bild.
  - Der Erklärtext im Bot-Kommentar ist der erste Satz der `public_explanation` von `SEC-004` (`supabase/migrations/040_populate_public_explanations.sql`).
  - Code, Runden, Commits, SHAs und Kommentar sind Beispieldaten, im Bild als „Example“ markiert.
