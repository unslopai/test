# TODO: 02-regenerate-erosion

- [x] Belege prüfen: PROC-002 (2,1 → 4,7 → 6,2, arXiv 2506.11022), SEC-004 `public_explanation`, `synchronize` → neuer Check pro Push
- [x] Landing-Claim „If quality drops, the build fails“ nicht im Code gefunden → nicht behauptet, ROADMAP-To-Do
- [x] BRIEF.md mit Storyboard, Lesezeiten von Anfang an
- [x] film.html (Tooling, Fonts und Icon aus Film 01)
- [x] Probe-Runde 1: Kind-Elemente mit `visibility: visible` überstimmten die versteckte Hook-Karte (rote Zeile, Squiggle und Caret leckten in Chart und Endcard) → `inherit`; leere dritte Listenzeile → Kartenhöhe wächst
- [x] Probe-Runde 2: „Re-checked. Clean.“ kam vor dem ✓ → Headline nach dem ✓
- [x] audio.py: Break per Taktschnitt 2 → 4 Takte, Drop auf dem roten Check (Assert + Bass-Messung: Kick zurück bei 13,13 s), −13,9 LUFS
- [x] Voller Render: 0 Pops, Kontaktbogen: jede Aussage steht 1,5–4 s, Reihenfolge korrekt, kein Leck
- [x] final.mp4 (7,9 MB, 28,1 s, −13,9 LUFS) + poster.png („It got worse.“, 4,6 s)
- [x] Commit, Push, PR aktualisieren

## v2: „besseres Ear Candy, Musik ist trash, Hook besser“

- [x] Musik: 6 Mixkit-Kandidaten gemessen (Drop-Kontrast Gesamt/Bass). #364 hat +18,7 / +37 dB, #162 praktisch keinen Drop. Tempo-Fit 130 BPM, Drop bei 14,77 s, Tonart ~D-Moll. Lizenz: die Mixkit-Hip-Hop-Seite listet den Track unter der Free License.
- [x] Film auf das 130-BPM-Raster gezogen (`timeline.json`, Warp in `film.html`)
- [x] Hook neu: Regenerate-Button, 3 Klicks auf dem Beat, deterministischer Glyph-Scramble, Kamera-Ruck, neue Headlines
- [x] Sounddesign: Tape-Stop, Tiefpass-Sweep, Riser + Reverse-Swell, Sub-Boom, Glitches, gestimmte und gepannte Plinks, Arpeggios, 8-Bit-Blips, Sidechain
- [x] Audio-QA ohne Abhören: Abschnittspegel, Bass-Einsatz auf dem Drop (12,92 s), Spektrogramm und Wellenform angesehen. Die Plinks waren zu dominant → Pegel .30 → .19.
- [x] Voller Render: 0 Pops, Kontaktbogen des Hooks geprüft; Poster auf 3,2 s (Headline eingeschwungen statt halb im Aufstieg)
- [ ] Gegenhören mit Kopfhörern (offen, kann ich nicht)

## v3: Kanal-Posts (distribution/channels, 2026-09-29)

- [x] Endcard „Deterministic AI code review.“ → „A review gate for AI-written code.“ (`distribution/channels/CONTEXT.md` W3)
- [x] `?beta=1` (Render: `FILM_QUERY=beta=1`): durchgehender Stempel „Private beta“, `cuts/beta.mp4` mit unverändertem Original-Audio
- [x] Gegen den Volltext geprüft: arXiv 2506.11022 nutzt GPT-4o; „Even with a security-focused prompt.“ ist durch „even explicitly asking for security improvements was associated with new vulnerabilities“ gedeckt
- [ ] `final.mp4` trägt noch die alte Endcard
