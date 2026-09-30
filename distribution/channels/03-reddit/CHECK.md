# CHECK: Selbstkontrolle Reddit

Stand 2026-09-29.

## 1. Dateien gegen die Specs (`python3 _kit/specs.py 03-reddit/visuals`)

| Datei | Maße / fps / Dauer / Codecs / Bitrate | Größe |
|---|---|---|
| `terminal-demo-beta.gif` | 960×540, 12 fps | 334 KB |
| `terminal-demo-beta.mp4` | 1600×900, 30 fps, 25,0 s, H.264 High / AAC LC (stumm) | 0,7 MB |
| `terminal-demo-launch.gif` | 960×540, 12 fps | 331 KB |
| `terminal-demo-launch.mp4` | 1600×900, 30 fps, 25,0 s, H.264 High / AAC LC (stumm) | 0,7 MB |

| Prüfpunkt (RESEARCH.md §3, sekundär) | Soll | Ergebnis |
|---|---|---|
| Video | MP4, ≤ 1 GB, ≤ 15 min | ✓ |
| GIF | ≤ 100 MB | ✓ |
| Autoplay | spielt im Feed ab; ob stumm, ist nicht primär belegt | Die Demo hat eine stumme Tonspur und funktioniert ohne Ton ✓ |
| Inhalt echt | Jede Zeile nach einem Prompt stammt aus `packages/cli` (`scan.ts`-Header, `format.ts` über `_kit/cli/sample-output.ts`) | ✓ Wartezeiten gekürzt, im Bild gekennzeichnet („wait shortened“, Bildunterschrift) |
| Stempel | Beta-Fassung mit „Private beta“; Launch-Fassung ohne, nur ab L | ✓ |
| Lesbarkeit | GIF bei 960 px: Mono auf ~11,7 px | ✓ Frames geprüft (Frames 70/150/220/290) |

## 2. Zeichen

- Alle 15 Titel-Varianten ≤ 300 Zeichen, der längste hat 133.
- Alle Textposts ≤ 40.000 Zeichen, der längste (R-B1) hat ~1.460.
- Codeblöcke sind eingerückt (old.reddit-kompatibel).

## 3. Zahlen und Status gegen CONTEXT.md

| Verwendet | CONTEXT | ✓ |
|---|---|---|
| 1.80×, 955 vs 955; „pilot study … exception handling“; 44:1 nur als „one model on one codebase“ | C1, C2 | ✓ |
| 2.1 / 4.7 / 6.2 nach Iterationsgruppen, GPT-4o, Security-Prompts „added new ones, just fewer“ | C3 | ✓ |
| 55 von 119 deterministisch, LLM nur JS/TS, Blind-Pass „on the standard route“ | §4b | ✓ |
| Check scheitert nur bei critical; `--fail-on` für CI | `check-run.ts`, `index.ts` | ✓ |
| 5 MCP-Tools, Phasen submitted/deterministic/complete, Tool-Beschreibungen wörtlich | `server.ts`, MCP_SPEC §4 | ✓ |
| App-Rechte, Grund für `contents: write` | GITHUB_APP_SPEC | ✓ |
| Ledger ohne Unterdrückung späterer Scans | MCP_SPEC §4.4 | ✓ (FAQ 8 korrigiert) |
| 14-Tage-Trial mit Karte, Preis nur mit Paddle live | §1 Preise | ✓ |
| `@unslopcodes/cli`, nie `npx unslop` | §1 | ✓ (FAQ 9) |
| Keine Waitlist-Links in Posts | RESEARCH.md §5 | ✓ |
| Roadmap nur als Antwort (FAQ 10) | BRIEF | ✓ |

## 4. Lesung als skeptischer Senior Engineer, der unslop nicht kennt

| Stelle | Einwand | Änderung |
|---|---|---|
| R-A1: „The pattern I see most“ | Unbelegte Häufigkeitsaussage | → „A pattern I keep running into“ |
| R-B5: „we re-read every paper we cite“ | Stimmt nicht: im Volltext geprüft wurden die Papers der Kernzahlen (7 Stück), nicht alle 16 | → „the papers behind our headline numbers“ |
| FAQ 8: „won't come back for that code“ | Falsch: Das Ledger hat keinen Lesepfad (MCP_SPEC §4.4) | → „doesn't yet suppress the same finding on later scans. That's planned.“; Befund in CONTEXT ergänzt |
| FAQ 7: „Dockerfiles“ | Nicht in `language.ts` | gestrichen |
| R-B1: „Built with Claude“ | Nur, wenn es stimmt | als Vorbedingung markiert |
| R-B1: „free to try“? | Der Trial braucht eine Karte | „14-day trial (card required)“ offen genannt; r/ClaudeAI bewusst nicht vorbereitet |
| Werbeton | Keine Superlative, kein „Introducing“, keine Emojis. Die Grenzen stehen in jedem Showcase-Post vor der Frage | ✓ |
| Astroturfing-Risiko | Offenlegung jeweils im ersten Satz; keine Zweit-Accounts, keine Vote-Bitten (LAUNCH.md) | ✓ |

## 5. Offen

- Die Regeln der Ziel-Subs wurden über RSS, Zendesk-API, Archiv und Prowlo ermittelt, nicht auf den Live-Seiten (Reddit 403/302). Vor jedem Post eingeloggt gegenlesen.
- Die Reddit-Threads zu curl und tldraw sind **blocked: tooling** (Archiv-Timeout), das ist kein Negativbefund.
- r/ClaudeAI wird erst mit einem Trial ohne Karte oder einem Free-Tier möglich.
- r/programming wird erst mit einem Engineering-Artikel möglich (es gibt keinen Blog).
