# CHECK: Selbstkontrolle Product Hunt

Stand 2026-09-29.

## 1. Dateien gegen die Specs (`python3 _kit/specs.py 05-producthunt/visuals`)

| Datei | Maße | Größe |
|---|---|---|
| `ph-01-pr-check.png` | 1270×760 | 183 KB |
| `ph-02-terminal.png` | 1270×760 | 171 KB |
| `ph-03-editor.png` | 1270×760 | 154 KB |
| `ph-04-how-it-decides.png` | 1270×760 | 92 KB |
| `ph-05-evidence.png` | 1270×760 | 82 KB |
| `ph-06-limits.png` | 1270×760 | 86 KB |
| `ph-07-roadmap.png` | 1270×760 | 115 KB |
| `ph-thumbnail.png` | 240×240 | 1 KB |

| Prüfpunkt (RESEARCH.md §2) | Soll | Ergebnis |
|---|---|---|
| Galerie | 1270×760, mindestens 2 Bilder | 7 ✓ |
| Thumbnail | quadratisch, 240×240 | ✓, statisch |
| Tagline | ≤ 60 Zeichen | 57 / 58 / 55 / 54 / 41 ✓ |
| Beschreibung | ≤ 260 Zeichen (sicher unter beiden PH-Angaben) | 233 ✓ |
| Video | nur YouTube | vorhandene MP4-Dateien, Upload durch den Gründer |

Von Hand geprüft:
- **Beschriftung:**
  - Jedes Bild mit Produktoberfläche trägt „Example“ bzw. „Example data“ und eine Fußzeile zur Herkunft der Strings.
  - Die Roadmap-Folie trägt „Roadmap · Concept“, „Concept sketch · example data“ und „Planned, not built, no dates“ im Bild, im gestrichelten Konzept-Stil.
  - Keine „01/02“-Labels.
- **Korrigiert:**
  - Leere Bildhälften (1, 6).
  - Zu kleiner Terminal-Text (2).
  - `--fix` brach am Bindestrich um; jetzt `nowrap` im Kit.
  - Gekürzter Hover-Text (3) durch den vollständigen Finding-Text ersetzt.

## 2. Zahlen und Status gegen CONTEXT.md

| Verwendet | CONTEXT | ✓ |
|---|---|---|
| 119 / 55, LLM JS/TS, Blind-Pass auf der Standard-Route, Status pro Befund, nur Critical blockiert | §1, §4b | ✓ |
| 1.80×, 0.435 vs 0.242, 955 vs 955 | C1 | ✓ |
| €29, 500 Scans, 14 Tage, Kartenpflicht | §1 Preise | ✓ nur mit Paddle live |
| Roadmap: Revisionsvergleich, Trend, zweiter Anbieter, Nachweis pro Commit; alles „planned, not built“ | §5 | ✓ |
| Dismiss unterdrückt spätere Scans nicht | §1 (Ledger ohne Lesepfad) | ✓ FAQ 2 |
| GitLab/Bitbucket „not planned right now“ | ROADMAP §6 („Vision, nicht geplant“) | ✓ |
| Kein 44×, keine Benchmark-Zahlen, kein „The only AI code gate …“ | §4c, W1 | ✓ |

## 3. Lesung als skeptischer Senior Engineer, der unslop nicht kennt

| Stelle | Einwand | Änderung |
|---|---|---|
| Tagline-Variante 5 „Catch what your AI reviewer waves through“ | Unbelegter Vergleich, Nutzenversprechen | als „nicht verwenden“ markiert |
| Galerie 1 und 3 | Sehen aus wie echte Oberflächen, sind aber nachgebaut | Fußzeile nennt die Herkunft der Strings. BRIEF und LAUNCH verlangen echte Screenshots aus dem Demo-Repo vor dem Launch |
| Galerie 7 (Roadmap) | Risiko „Vaporware“-Eindruck (Featuring-Kriterium) | als optionale letzte Folie markiert; nur eine Folie; Konzept-Stil |
| Maker-Kommentar | PH verbietet LLM-Kommentare | Nur Gliederung und Referenz, der Gründer schreibt selbst |
| „1-click fixes“ in der Tagline | Nicht jeder Befund hat einen Fix | Galerie 1 sagt „where it can“. Im selbst geschriebenen Maker-Kommentar dieselbe Einschränkung nennen (Gliederung Punkt 4) |

## 4. Offen

- Slug `unslop-codes` prüfen. `/products/unslop` ist belegt (theunslop.app).
- Echte Screenshots für Bild 1 und 3.
- Den Wortlaut der Regeln vor dem Launch im Browser gegenlesen: Der Abruf lief über ein Tool, das Auszüge erzeugt (RESEARCH.md, Hinweis des Researchers).
