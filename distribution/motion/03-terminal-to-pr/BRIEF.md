# BRIEF: 03-terminal-to-pr

## Kernbotschaft (1 Satz)

**Ein Befehl vor dem Push: Unslop fängt den Fehler im Terminal, du fixt ihn mit einem Klick im Editor, und der PR ist sauber, weil überall dasselbe Gate prüft.**

## Recherche (was das Produkt wirklich tut, mit Belegen)

- **CLI** `unslop` aus dem Paket **`@unslopcodes/cli`** (`packages/cli/package.json`, `bin: unslop`).
  - `unslop scan` prüft den lokalen Diff gegen die Merge-Base (Hilfetext `packages/cli/src/index.ts`).
  - Die Ausgabe folgt `packages/cli/src/format.ts`, `scan.ts`: `Scanning <repo> (diff vs <sha>)…`, dann Datei, `CRITICAL <rule> <path>:<line>`, Kritik, `Suggested fix:`, `Result: 1 issue(s) — 1 critical, 0 warning` und der Hinweis „open this folder in VS Code (with the Gatekeeper extension) to see these issues inline, or re-run with unslop scan --fix“.
- **VS Code** (`packages/vscode-extension`):
  - Findings erscheinen als Diagnostics mit Quelle `unslop` und dem Rule-Code (`diagnostics.ts`).
  - Die Quick-Fix-Aktion heißt **„Apply Gatekeeper Fix“** (`applyFix.ts`). Sie ersetzt die Zeile, entfernt das Finding und meldet „Gatekeeper fix applied.“.
  - Die Statusleiste zeigt `$(shield) 1 critical`, nach Klick zum Neu-Scan `$(sync~spin) Scanning…`, dann `$(shield) No slop ✓` (`stateMachine.ts`).
  - Ein Neu-Scan passiert **nicht** automatisch nach dem Fix. Im Video klickt der Cursor deshalb auf das Statusleisten-Item.
- **PR:** Die GitHub App führt pro Push einen Check Run `Anti-Slop Gatekeeper` aus, mit den Titeln „Reviewing for AI slop…“ und „No AI slop found“ (`src/lib/check-run.ts`).
- **Beispielbug `SEC-026`** (XSS über `dangerouslySetInnerHTML`, CRITICAL):
  - Der Pre-Scanner prüft ihn deterministisch per ESLint-Engine (`packages/prescan/src/engines/eslint-engine.ts`).
  - Der Erklärtext ist die echte `public_explanation` (`supabase/migrations/040_populate_public_explanations.sql`).
  - Einen hartkodierten Key habe ich bewusst **nicht** gewählt: Der Secret-Filter der CLI würde so einen Diff gar nicht hochladen.
- **CTA `npm i -g @unslopcodes/cli`:** Der Name ist korrekt, der Scope ist gesichert. Das Paket ist aber laut `ROADMAP.md` noch **nicht veröffentlicht** („Publish wartet auf Launch“). **Das Video ist deshalb ein Launch-Asset und darf erst nach `npm publish` raus.** Eine Beta-Variante ohne npm (`?cta=beta`) ist eingebaut, verweist aber auf die Waitlist, die ebenfalls noch hinter Flag liegt.

## Zielgruppe und Plattform

- **Zielgruppe:** Entwickler:innen, die mit KI-Assistenten Code schreiben und lokal arbeiten (Terminal, VS Code), bevor sie pushen.
- **Plattform:** Reels, TikTok, Shorts, Website. Das Video funktioniert ohne Ton.

## Format

1080 × 1920, 60 fps, **27,7 s** (15 Takte bei 130 BPM), H.264 High BT.709, AAC. Lesezeiten sind von Anfang an eingeplant. Wichtiger Text liegt in der Safe Zone y 250–1520.

## Sprache

**Englisch** (Default-Locale, alle Produkt-Strings englisch). Die DE-Fassung ist im Wörterbuch `STR.de` vorbereitet.

## Musik und Sound

- **Musik:** Mixkit **„Young Trizzy“ (#416)**, Trap, 130 BPM, wie Film 02 gewünscht „ähnlich“. Ein anderer Track, aber derselbe Produzenten-Stil.
  - **Gemessen:** Das Intro ist praktisch bassfrei (−63 dB). Der Drop liegt exakt bei **14,77 s** mit +43 dB Bass. Die Tonart liegt um B-Moll.
  - **Kandidaten:** Unter sieben gemessenen Tracks war nur #364 (Film 02) stärker.
- **Montage:**
  - Hook laut (Song 22,15–25,85 s) mit Tape-Stop.
  - Break leise, während der Scan läuft (Song 11,08–14,77 s, Tiefpass öffnet sich).
  - Drop exakt auf dem CRITICAL-Finding im Terminal.
- **Sounddesign in B-Moll:**
  - Tipp-Klicks und Backspace-Ticks
  - Enter-Thump
  - Scan-Ticks auf dem Beat
  - Riser und Reverse-Swell in den Drop
  - Sub-Boom und Glitch auf dem Finding
  - Lightbulb-Plink, Klick und Fix-Arpeggio im Editor
  - Push-Keys und grünes Arpeggio am PR
  - CTA: aufsteigende Tipp-Blips, Schlussakkord

## Storyboard (Film-Zeit, 130 BPM, Takt = 1,846 s)

| Zeit | Szene | Bild | Text |
|---|---|---|---|
| 0,00–3,69 | **Hook** | Terminal: `$ git push` wird getippt, stoppt, wird zurückgelöscht und durch `unslop scan` ersetzt, Enter auf dem Beat | „Don't push it yet.“ → „Scan it first.“ |
| 3,69–7,38 | **Scan** (leiser Break) | `Scanning acme/shop (diff vs 3f9c2a17de)…` mit Spinner, Riser | „Checks your diff / before you push.“ |
| 7,38–11,08 | **Drop: Finding** | Das Terminal druckt `CRITICAL SEC-026 app/components/Comment.tsx:3`, die Erklärung, `Suggested fix:` und das Ergebnis. Ruck, Sub-Boom. | „Caught in your **terminal**.“ |
| 11,08–16,6 | **Editor** | VS-Code-Karte mit derselben Zeile rot unterkringelt, Hover mit der Erklärung `unslop(SEC-026)`, Quick-Fix „Apply Gatekeeper Fix“, Klick auf dem Beat. Die Zeile wird zu `<div>{body}</div>`, „Gatekeeper fix applied.“, Klick auf die Statusleiste, dann Scanning… → No slop ✓. | „Fixed in your **editor**.“ |
| 16,6–20,3 | **PR** | `$ git push` wird getippt, der Check Run `Anti-Slop Gatekeeper`: Spinner → ✓ „No AI slop found“ | „Clean on the **PR**.“ |
| 20,3–27,69 | **CTA** | Großes Terminal: `$ npm i -g @unslopcodes/cli` wird getippt, dann `$ unslop scan`, blinkender Lime-Caret. Darunter Schild, Wortmarke und unslop.codes. | „Try it on your next diff.“ |

## Ehrlichkeit

- Repo `acme/shop`, SHA, Code und PR sind **Beispieldaten**, im Bild als „Example“ markiert. Der CTA-Befehl ist real, aber erst nach dem Publish gültig (siehe oben).
- Es gibt keine Zahlen außer der Regel-ID.
