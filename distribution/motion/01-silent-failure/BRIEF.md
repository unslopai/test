# BRIEF: 01-silent-failure

## Kernbotschaft (1 Satz)

**Ein KI-Reviewer winkt einen Fehler durch, der wie Erfolg aussieht. Unslop fängt ihn am Pull Request, nennt die Regel und liefert den Fix.**

## Warum dieses Thema

Das Video erzählt die These, auf der die ganze Positionierung steht. Es zeigt dafür genau einen konkreten Bug statt einer Feature-Liste.

- **Die Kernbehauptung des Produkts.** `docs/strategy/MARKETING_CLAIMS.md` §1 und §2 empfehlen als H1 die „44x“-These. Die Landing Page verwendet sie wörtlich (`messages/en.json` → `marketing.hero.headline`: „Your AI reviewer misses 44× more bugs than a parser.“). Die schärfste Form davon steht in `marketing.pillarJudge.paragraphSilent`: LLM-Judges unterzählen „failures dressed up as success“ im Verhältnis **44 zu 1**.
- **Diese Fehlerklasse ist eine echte CRITICAL-Regel.** `SEC-031` in `data/Golden_Database__-_Tabellenblatt1.csv` heißt „Stiller Erfolg statt Fehlerpropagierung (Failure-Untruthful) in API-Handlern“ (Quelle AIRA, arXiv 2604.17587). Ihre kundensichere Erklärung ist `public_explanation` in `supabase/migrations/040_populate_public_explanations.sql`, und genau diesen Text zeigt der Bot-Kommentar im Video. Die Regel wird im Rule-Recall-Benchmark tatsächlich gefunden (`fixtures/rule-recall/results/2026-09-29-xl-r24-gate-chunk12k.json`, `SEC-031`, `CRITICAL`, ein `catch` mit „best-effort“-Kommentar).
- **Die UI-Momente sind echt.**
  - Der Check-Name `Anti-Slop Gatekeeper` und die Titel „Reviewing for AI slop…“, „1 critical slop finding“ und „No AI slop found“ stammen aus `src/lib/check-run.ts`.
  - Das Kommentarformat „🚨 **SEC-031** (CRITICAL)“ und „💡 **Suggested fix** (1-click commit)“ mit `suggestion`-Block stammt aus `src/lib/pipeline/helpers.ts` (`mapIssueToPrComment`).
  - Die CLI-Zeile „✔ No AI slop found.“ stammt aus `packages/cli/src/format.ts`.
  - Das Pixel-Schild ist `packages/vscode-extension/icon.png`.
- **Die Marke ist echt.** Farben kommen aus `src/app/globals.css`: `#0a0a0b`, zinc-Flächen, Lime `#bef264`, `red-400`, `amber-300`. Dazu Geist plus die Silkscreen-Wortmarke mit Lime-Caret (`MarketingNav.tsx`, `opengraph-image.tsx`), das Dot-Grid (`.marketing-dot-grid`) und der Diff-Stil aus `HeroSection.tsx` (`PreviewDiffPane`).

Andere Kandidaten, die ich verworfen habe:
- „Vier Oberflächen“ (App, CLI, VS Code, MCP): zu breit für 20 s.
- „Revisions-Erosion 2,1 → 6,2“: stark, aber abstrakter und ohne einen einzelnen UI-Moment.
- Pricing: Der Prod-Cutover ist laut ROADMAP noch offen.

## Zielgruppe und Plattform

- **Zielgruppe:** Entwickler:innen, Tech Leads und Engineering Manager in Teams, die KI-generierten Code (Copilot, Cursor, Agents) mergen und dafür bereits einen LLM-Reviewer nutzen oder erwägen.
- **Plattform:** Instagram Reels, TikTok, YouTube Shorts und ein stummes Autoplay auf der Website. Die Botschaft muss **ohne Ton** funktionieren (kinetische Typo trägt die Story), der Ton ist ein Bonus.

## Format

- 1080 × 1920 (9:16), 60 fps, **30,0 s** (16 Takte bei 128 BPM), H.264 High, BT.709 TV-Range, AAC 48 kHz.
- **v2 (Feedback „zu schnell“):** Die erste Fassung hatte 20,6 s. Jetzt sind es 30 s, mit Lese-Haltephasen nach jeder Textzeile (Zeitkarte `timeline.json`). Das liegt über den ursprünglich angesetzten 15–25 s, weil die Lesbarkeit Vorrang hat.
- **Safe Zones:** Wichtiger Text liegt zwischen y = 250 und y = 1520. Die oberen 250 px und die unteren 400 px bleiben frei.
- **Lesbarkeit:** Headlines ≥ 72 px, Fließtext in UI-Karten ≥ 30 px, Code ≥ 30 px. Maßstab ist die Lesbarkeit auf einem 360-px-breiten Handy-Thumbnail.

## Sprache der On-Screen-Texte

**Englisch.** `DEFAULT_LOCALE = 'en'` (`src/i18n/config.ts`), und alle Produkt-Oberflächen im Bild sind englisch: Check-Run-Titel, Bot-Kommentar und CLI-Ausgabe. Der Film nutzt ein Wörterbuch (`STR.en` / `STR.de` in `film.html`, DE-Texte aus `messages/de.json`), sodass eine deutsche Fassung ein Parameter ist (`?lang=de`), kein Umbau.

## Ehrlichkeit

- Code, PR und Reviewer-Freigabe sind **Beispieldaten** und im Bild als „Example“ gekennzeichnet.
- Den „AI reviewer“ zeige ich generisch und ohne Marke oder Wettbewerber (MARKETING_CLAIMS §0.3).
- Die Statistik steht mit Quelle im Bild: „AIRA matched-control study · arXiv 2604.17587“. Die Zahl „119 research-backed rules“ ist die Regelzahl der Golden DB (MARKETING_CLAIMS §0.3: 119, nicht 126).
- Es gibt keine Nutzerzahlen, Testimonials oder Preise.
- Die Claims stammen wörtlich aus der freigegebenen Landing-Copy (`messages/en.json`).

## v3 (Feedback: „mehr Ear Candy, bessere Hook, andere Musik“, wie Film 02)

- **Hook neu:**
  - Der KI-Reviewer „scannt“ im 16tel-Takt jede Code-Zeile mit einem Lichtband und setzt überall einen Haken, auch auf den kaputten `catch`-Block.
  - Danach knallt „LGTM“ mit Kamera-Ruck (1,64 s).
  - In Szene 2 glitchen genau die Haken auf den Bug-Zeilen zu roten ✕, mit Ruck und Sub-Thump.
- **Musik neu:** Mixkit #190 (elektronisch, 120 BPM, B-Moll), bewusst ein anderer Track als in Film 02. Unter sechs gemessenen Kandidaten hat er den zweitstärksten Drop (+18,6 dB) und dieselbe Struktur mit leisem Intro vor dem Drop.
- **Neue Zeitkarte** im 120-BPM-Raster, Film jetzt **32 s**:
  - Break bei 6,0 s (Tape-Stop, Tiefpass öffnet sich)
  - Drop bei 12,0 s auf dem roten Check
  - Klick „Commit suggestion“ bei 22,0 s auf dem Beat
- **Sounddesign in B-Moll:**
  - aufsteigende 8-Bit-Blips für jeden Scan-Haken
  - Akkord-Slam auf LGTM
  - Glitch, Fail und Sub auf den roten ✕
  - Blip-Kaskade für die 44 Blöcke, ein tiefer Plink für den einen LLM-Judge-Block
  - Riser und Reverse-Swell, Sub-Boom auf dem Drop
  - Arpeggios auf Grün und für die Oberflächen
  - Pixel-Schild-Blips
  - Sidechain-Ducking
- **Gemessen:**
  - Hook −11,9 dB, Break −21,3 dB, Drop −11,8 dB
  - Bass-Einsatz bei 12,00 s
  - −14,0 LUFS, True Peak −1,0 dBFS

## Storyboard v2 (historisch: 30 s, Musik #162, 128 BPM; v3 verschiebt die Zeiten um Faktor ~1,07 auf das 120-BPM-Raster, siehe timeline.json)

Musik: Mixkit „Minimal Techno 01“ (#162), Start im Song bei 35,705 s. Der Kick-lose Break (Song 41,33–45,08 s, 2 Takte) wird per Taktschnitt auf 3 Takte verlängert. Er läuft von Film 5,625 bis 11,25 s, der Drop liegt bei **Film 11,25 s**.

| Film-Zeit | Szene | Bild | Text |
|---|---|---|---|
| 0,00–2,90 | **Hook** | Eine Code-Karte (Webhook-Handler, *Example*) ist ab Frame 0 da. Um 0,9 s erscheint die Freigabe „AI reviewer approved these changes · ✓ LGTM“. | „Your AI reviewer / approved **this**.“ |
| 2,90–5,63 | **Der Bug** | Push-in auf den `catch`-Block. Der leere Catch und `return … { ok: true }` werden rot markiert und rot unterkringelt. | „The charge failed. / The API says **ok: true**.“ |
| 5,63–8,91 | **Die Evidenz** (Break) | „44 : 1“ mit 44 Lime-Blöcken gegen 1 grauen Block, darunter die Quelle | „LLM judges under-count failures dressed up as success.“ |
| 8,91–11,25 | **Das Gate** (Break) | Check-Run-Zeile „Anti-Slop Gatekeeper“ mit amber Spinner, „Reviewing for AI slop…“, dazu ein synthetischer Riser | „Unslop checks every PR against / **119** research-backed rules.“ |
| 11,25–13,75 | **Drop: Caught** | Roter Check mit ✕ und „1 critical slop finding“. Kamera-Punch. | „**Caught.**“ |
| 13,75–20,80 | **Regel + Fix** | Bot-Kommentar `unslop[bot]`: 🚨 SEC-031 (CRITICAL), public_explanation (≈ 2 s Lesezeit), dann „💡 Suggested fix“ mit Diff (≈ 1,6 s Lesezeit). Der Cursor klickt „Commit suggestion“ auf dem Beat bei 20,625 s. | „It names the rule. / And the fix.“ |
| 20,80–23,45 | **Fixed** | Die gefixte Code-Karte kommt zurück (Vorher/Nachher). Der Check läuft neu: Spinner, dann ✓ „No AI slop found“. | „Fixed before **merge**.“ |
| 23,45–26,50 | **Jede Oberfläche** | GitHub-App-Check, Terminal `unslop scan` → „✔ No AI slop found.“, VS-Code-Statusleiste „No slop ✓“ | „One engine. / Every surface.“ |
| 26,50–30,00 | **Endcard** | Pixel-Schild, Wortmarke „unslop“ mit Lime-Caret, langsamer Push-in | „Deterministic AI code review.“ / „119 research-backed rules. Verdicts no LLM votes on.“ / „unslop.codes“ |

## Stil

- Dunkel und ruhig wie die Landing Page. Ein einziger Akzent Lime, Rot nur für den Fehler und Amber nur für „läuft“.
- Es gibt keine Verläufe mit Glow, kein Glas, keine Partikel, keine Pillen-Buttons (die App nutzt `rounded-md`), keine Monospace-Labels (Mono nur für echten Code) und keine Szenennummern.
- Bewegung: Springs mit geschlossener Lösung, maskierter Wort-für-Wort-Rise für Headlines, eine Kamera im Log-Raum, Beat-Punches ab dem Drop.
