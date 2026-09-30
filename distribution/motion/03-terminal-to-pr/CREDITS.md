# CREDITS: 03-terminal-to-pr

- **Musik:** Mixkit „Young Trizzy“ (#416, `https://assets.mixkit.co/music/416/416.mp3`), Mixkit Stock Music Free License.
  - Die Mixkit-Technology-Listing-Seite (ausgewertet am 29.09.2026) führt den Track mit `musicFree`-Markierungen, ohne Restricted-Markierung.
  - Kommerziell inklusive Social Ads, keine Namensnennung, keine Weiterverteilung der Rohdatei. Die Datei ist deshalb nicht eingecheckt, `fetch_assets.py` lädt sie.
  - Verwendet werden Song 22,15–25,85 s (Hook, Tape-Stop), 11,08–14,77 s (Break, tiefpassgefiltert) und ab 14,77 s (Drop).
- **SFX:** Mixkit 1125, 2568, 1117, 1113, 2573, 1490, 1143, 2569, 2865 (Mixkit Sound Effects Free License).
- **Synthetisch** (`audio.py`, seeded, deterministisch, B-Moll): Blips, Glitch, Sub-Booms, Riser, Reverse-Swell, Plinks, Arpeggios, Akkorde, Tape-Stop, Tiefpass-Sweep.
- **Loudness:** −14 LUFS Ziel. Linearer Loudnorm, fällt auf dynamisch zurück, falls −1 dBTP sonst nicht zu halten ist. Gemessen: −14,4 LUFS, −1,4 dBTP.
- **Schriften:** Geist und Silkscreen aus `src/app/(marketing)/assets/`, dazu Geist 500/600 und Geist Mono von fontsource. Alle unter SIL OFL 1.1.
- **Produkt-Strings:** `packages/cli/src/format.ts`, `scan.ts`, `index.ts`; `packages/vscode-extension/src/applyFix.ts`, `diagnostics.ts`, `stateMachine.ts`; `src/lib/check-run.ts`.
- **SEC-026-Text:** `public_explanation` aus `supabase/migrations/040_populate_public_explanations.sql`, im Terminal umbrochen.
- **Beispieldaten:** Repo `acme/shop`, SHA, Code und PR sind Beispieldaten, im Bild als „Example“ markiert.
