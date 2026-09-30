# CREDITS: 01-silent-failure

## Musik (v3)

| Titel | Quelle | Lizenz | Verwendung |
|---|---|---|---|
| Mixkit-Track #190 (Titel nicht ermittelt, siehe unten) | `https://assets.mixkit.co/music/190/190.mp3` | Mixkit Stock Music Free License laut den Mixkit-Musikseiten („All audio tracks are completely free … under the Mixkit License“), Stand 29.09.2026. Kommerziell inklusive Social Ads, keine Namensnennung, keine Weiterverteilung der Rohdatei. Die Rohdatei ist deshalb nicht eingecheckt, `fetch_assets.py` lädt sie. | Hook: Song 28,03–34,03 s mit Tape-Stop. Break: 10,03–16,03 s, tiefpassgefiltert. Drop: ab 16,03 s. |

**Offen vor der Veröffentlichung:** Titel und Lizenz-Label genau dieses Tracks auf seiner Mixkit-Seite bestätigen. Die Listing-Seiten waren am 29.09.2026 per Rate-Limit (HTTP 429) gesperrt, und die per WebFetch lesbare Seite zeigt keine IDs. v1/v2 nutzten „Minimal Techno 01“ (#162, per Listing als `musicFree` bestätigt).

## Soundeffekte (Mixkit Sound Effects Free License: kommerziell nutzbar, keine Namensnennung, Rohdateien nicht eingecheckt)

| Datei | Mixkit-ID | Einsatz |
|---|---|---|
| `click.mp3` | 1125 | LGTM-Badge, LLM-Judge-Block, Klick „Commit suggestion“ |
| `key.mp3` | 2568 („Cool interface click tone“) | Block-Raster, gefixte Codezeilen, Schild-Aufbau |
| `tick.mp3` | 1117 | Freigabezeile, Markierungen, Karten |
| `check.mp3` | 1113 | VS-Code-Status „No slop ✓“ |
| `toast.mp3` | 2573 („Interface option select“) | Wortmarke |
| `whoosh.mp3` | 1490 | Szenenwechsel |
| `impact.mp3` | 1143 | Drop auf dem roten Check |
| `fail.mp3` | 2569 („Negative tone interface tap“) | roter Check |
| `success.mp3` | 2865 | grüner Check |
| `rise.mp3` | 1489 | geladen, aktuell nicht im Mix |

**Im Code synthetisiert** (v3, `audio.py`, seeded, deterministisch): Blips, Akkorde, Glitches, Plinks, Sub-Booms, Riser, Reverse-Swell, Arpeggios, Tape-Stop, Tiefpass-Sweep. Das sind keine Stock-Assets.

Loudness: zweistufiges `loudnorm` auf −14 LUFS integriert, −1 dBTP (gemessen v3: −14,0 LUFS, True Peak −1,0 dBFS).

## Schriften

| Schrift | Quelle | Lizenz |
|---|---|---|
| Geist Regular / Bold (`geist-regular.ttf`, `geist-bold.ttf`) | aus dem Repo, `src/app/(marketing)/assets/` | SIL Open Font License 1.1 (Vercel) |
| Geist 500 / 600 (`geist-500.woff2`, `geist-600.woff2`) | @fontsource/geist via jsDelivr | SIL OFL 1.1 |
| Silkscreen Bold (`silkscreen-bold.ttf`) | aus dem Repo, `src/app/(marketing)/assets/` | SIL OFL 1.1 (Jason Kottke) |
| Silkscreen Regular (`silkscreen-400.woff2`) | @fontsource/silkscreen via jsDelivr | SIL OFL 1.1 |
| Geist Mono 400 / 500 | @fontsource/geist-mono via jsDelivr | SIL OFL 1.1 |
| Noto Color Emoji (🚨 💡 im Bot-Kommentar) | System-Font des Render-Containers | SIL OFL 1.1 |

## Bild-Assets

- **Pixel-Schild:** `packages/vscode-extension/icon.png` (eigenes Asset von unslop). Als `assets/img/shield-icon.png` kopiert und als 16 × 16-Raster nach `assets/img/shield-mark.svg` vektorisiert.
- **Alle UI-Elemente** sind im Code nachgebaut, nach den echten Komponenten:
  - Diff- und Preview-Stil aus `HeroSection.tsx`
  - Tokens aus `globals.css`
  - Check-Run-Texte aus `src/lib/check-run.ts`
  - Kommentarformat aus `src/lib/pipeline/helpers.ts`
  - CLI-Ausgabe aus `packages/cli/src/format.ts`
  - VS-Code-Status aus `packages/vscode-extension/src/stateMachine.ts`
- Es werden keine fremden Logos verwendet. „GitHub App“ und „VS Code“ stehen nur als Text-Labels für die Integrationsflächen.

## Inhalte und Belege

- Die Statistik „44 : 1“ ist eine Aussage der AIRA-Matched-Control-Studie (arXiv 2604.17587), so zitiert in `docs/strategy/MARKETING_CLAIMS.md` und `messages/en.json` (`marketing.pillarJudge.paragraphSilent`). Die Quelle steht im Bild.
- „119 research-backed rules“ ist die Regelzahl der Golden Database (`data/Golden_Database__-_Tabellenblatt1.csv`).
- Der Erklärungstext im Bot-Kommentar ist der erste Satz der `public_explanation` von SEC-031, ohne die Klammer (`supabase/migrations/040_populate_public_explanations.sql`).
- Code, PR, Reviewer-Freigabe und Oberflächen-Zustände sind Beispieldaten und im Bild als „Example“ gekennzeichnet.

## Werkzeug

Pipeline und Skill: [howseen-ai/claude-motion-design](https://github.com/howseen-ai/claude-motion-design) (MIT, Raphaël Aubry), kopiert nach `.claude/skills/motion-design/`. Gerendert mit Playwright/Chromium und ffmpeg (über `imageio-ffmpeg`).
