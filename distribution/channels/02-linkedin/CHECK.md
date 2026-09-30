# CHECK: Selbstkontrolle LinkedIn

Stand 2026-09-29.

## 1. Dateien gegen die Specs (`python3 _kit/specs.py 02-linkedin/visuals`)

| Datei | Maße / fps / Dauer / Codecs / Bitrate | Größe |
|---|---|---|
| `li-01` … `li-08` (EN), `li-de-01` … `li-de-08` (DE) | 1080×1350 | 119–269 KB |
| `li-carousel-quality-gates.pdf` | 8 Seiten, 1080×1350 px (einheitlich) | 1,6 MB |
| `li-carousel-quality-gates-de.pdf` | 8 Seiten, 1080×1350 px (einheitlich) | 1,8 MB |
| `li-film01-beta-4x5.mp4` | 1080×1350, 30 fps, 32,1 s, H.264 High / AAC LC, 2196 kb/s | 8,4 MB |
| `li-film02-beta-4x5.mp4` | 1080×1350, 30 fps, 27,7 s, H.264 High / AAC LC, 1834 kb/s | 6,1 MB |
| `li-film01-launch-4x5.mp4` | 1080×1350, 30 fps, 32,1 s, H.264 High / AAC LC, 2146 kb/s | 8,2 MB |
| `li-film03-launch-4x5.mp4` | 1080×1350, 30 fps, 27,7 s, H.264 High / AAC LC, 1611 kb/s | 5,3 MB |

| Prüfpunkt (RESEARCH.md §2) | Soll | Ergebnis |
|---|---|---|
| Bild-Seitenverhältnis | 3:1 bis 4:5 | 4:5 ✓ |
| Bildgröße | ≤ 5 MB, Breite ≥ 552 px | ≤ 269 KB, 1080 px ✓ |
| Dokument | ≤ 100 MB, ≤ 300 Seiten, einheitliche Seitengröße | 8 Seiten, 1080×1350, < 2 MB ✓ |
| Dokument ist herunterladbar | nichts Internes | nur freigegebene Zahlen (C1, C3), öffentliche Produkt-Strings, Konzepte gekennzeichnet ✓ |
| Video | 3 s–15 min, 1:2,4 bis 2,4:1, 10–60 fps, 75 KB–5 GB | 27,7–32,1 s, 4:5, 30 fps, 5–8 MB ✓ |
| Video < 50 MB (Auftrag) | | ✓ |
| Untertitel | SRT möglich | bewusst keins: kein Voiceover, die eingebrannte Typo ist der Text (`make_li_cuts.sh`) |
| 4:5-Ausschnitt | kein Inhalt abgeschnitten | Kontaktbögen von 01-beta und 03-launch geprüft. Fenster y 150–1500, tiefster Inhalt ≈ y 1476 ✓ |

Von Hand geprüft:
- **Karussell:** Jede Seite, die ein nicht-öffentliches Feature zeigt, trägt „Private beta“; die Roadmap-Seiten tragen „Roadmap · Concept“ und „Concept sketch · example data · not built“ im Bild, gezeichnet im Konzept-Stil (gestrichelt, schraffiert). Keine Seitenzahlen (Designvorgabe).
- **Korrigierte Mängel aus der ersten Fassung:**
  - Seite 3: Balkenbeschriftung kollidierte mit der Headline.
  - Seite 5: untere Hälfte leer.
  - Cover: ohne Bildelement.
  - „AI-written“ brach am Bindestrich um.

## 2. Zeichen (`python3 _kit/count.py 02-linkedin/POSTS.md linkedin`)

Alle 14 Post- und Kommentarblöcke ≤ 3.000 Zeichen (längster: L-2 mit ~1.230). Kommentare ≤ 1.250 (längster 285). Alle empfohlenen Hooks haben < 140 Zeichen:

| Post | Hook-Länge |
|---|---|
| L-1 | 122 |
| L-2 | 130 |
| L-3 | 111 |
| L-4 | 139 |
| L-5 | 128 |
| L-6 | 110 |
| L-L1 | 116 |
| L-L2 | 111 |

## 3. Zahlen und Status gegen CONTEXT.md

| Verwendet | CONTEXT | ✓ |
|---|---|---|
| 1.80×, 0.435 vs 0.242, 955 vs 955 (DE: 1,80-mal) | C1 | ✓ |
| 2.1 / 4.7 / 6.2 nach Iterationsgruppen, GPT-4o, Security-Prompts mit weniger, aber neuen Schwachstellen | C3 | ✓ |
| 44:1 nur mit „exploratory, one model, one codebase“ (L-5, L-6) | C2 | ✓ |
| 55 von 119 deterministisch, LLM nur JS/TS, keine Revisionsvergleiche | §1, §4b | ✓ |
| Check-Fazit failure/neutral/success | `check-run.ts:155-193` | ✓ |
| EU-Endpunkt Vertex AI | §1 | ✓ (Frist 2026-10-14 zum Durable Caching vor dem Posten klären) |
| Trend und Nachweis pro Commit nur als Roadmap, ohne Termin, ohne „bug-free“ | §5 | ✓ |
| Pro €29 / 500 Scans / 14 Tage nur in Phase B und nur mit Paddle live | §1 Preise | ✓ |
| Keine Aussagen zu externen Beta-Nutzern | Sprachregel „Private beta“ (§2) | ✓ |
| Keine internen Formulierungen (Supply-Chain, Monopol, Agenturen, CISOs/Banken als Käufer) | §5 | ✓ |

## 4. Lesung als skeptischer Senior Engineer bzw. CTO, der unslop nicht kennt

| Stelle | Einwand | Änderung |
|---|---|---|
| L-3: „a gate that fails on style gets ignored or removed“ | Unbelegte Verallgemeinerung, als Tatsache formuliert | Als unsere Begründung formuliert („a team has every reason to switch it off“) |
| L-3, Hook-Variante 3 („half of it was written by an AI“) | Zahl ohne Beleg | als „nicht verwenden“ markiert |
| L-1, Hook-Variante 4 (Aussage über andere Tools) | Wettbewerbsaussage ohne Beleg | als „nicht empfohlen“ markiert |
| L-2: „1,8-mal“ | Zahl nicht wortgleich mit der Quelle (1.80×) | → „1,80-mal“ |
| L-2: Satz zum Nachweis unter „Datenverarbeitung“ | Vermischt Heute und Roadmap | gestrichen |
| FAQ 4: „DPA goes live with the launch“ | ROADMAP §2: AVV erst in Stufe C | → „a DPA is in preparation“ |
| FAQ 10: „closed beta group“ | Unterstellt externe Tester, die es nicht gibt | → „access is closed“ |
| Karussell S. 5 „It is not fully deterministic“ | Ein CTO fragt: „Warum sagt ihr dann ‚deterministic‘ auf der Landing?“ | Nichts am Karussell geändert, der Satz ist richtig. Die Landing ist als W3 in ROADMAP §10 gemeldet. Bis zur Korrektur verlinken die Posts die Landing nur im Kommentar |
| KI-Ton | Keine „it's not X, it's Y“-Konstruktion, keine Kurzzeilen-Treppen, kein „I'm humbled“ | geprüft, nichts gefunden |

## 5. Offen

- Test-Upload von Video und Dokument, Sichtprüfung der 4:5-Darstellung auf Desktop und Mobil (LAUNCH.md).
- „…mehr“-Grenze (~140 mobil) ist nur sekundär belegt. Am eigenen Profil prüfen.
- Company Page: Rechtsform-Frage (UG in Gründung) vor dem Anlegen klären.
- L-6 hängt an der Landing-Korrektur W1.
