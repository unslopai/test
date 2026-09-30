# LAUNCH: Product Hunt

## Was vorher live sein muss

| # | Voraussetzung | Warum |
|---|---|---|
| 1 | Alles aus `../04-hackernews/LAUNCH.md` Punkte 2–6: Signup, npm, Marketplace, Paddle, Rechtsseiten, Landing-Korrekturen, Audit M1–M3 | PH featured nur „currently available“, kein „Vaporware“ (RESEARCH.md §1.2) |
| 2 | Die Landing sagt nicht mehr „If quality drops, the build fails“ | RESEARCH.md §7.12, CONTEXT W2 |
| 3 | Galerie-Bilder 1 und 3 als echte Screenshots aus einem Demo-Repo | PH empfiehlt echte Screenshots; die jetzigen sind nachgebaut (BRIEF.md) |
| 4 | Persönliche PH-Accounts der Gründer, mindestens eine Woche alt, besser Monate, mit eigenen Kommentaren bei anderen Launches. Kein Firmen-Account, kein bezahlter Hunter | RESEARCH.md §7.3 |
| 5 | Slug `unslop-codes` frei (prüfen) | `/products/unslop` ist belegt |
| 6 | Maker-Kommentar vom Gründer selbst geschrieben | „No LLMs“ |
| 7 | YouTube-Upload des Videos (optional), öffentlich oder nicht gelistet | PH akzeptiert nur YouTube |

## Empfohlener Zeitpunkt

- **Wann:** L + 1–3 Wochen, also nach HN. Dann stecken die HN-Einwände (Closed Source, Modellfamilie, JS/TS) schon im Maker-Kommentar und in der FAQ.
- **Tag:** Samstag, Sonntag oder ein ruhiger Montag, kein voller Freitag.
  - PH selbst: „Products launched on the weekend get 15% more ‚Visit‘ button clicks“.
  - Eigene Auswertung September 2026: niedrigste Schwellen am Wochenende, Freitage mit 67 bzw. 91 Featured-Launches.
  - Die Evidenz ist dünn (RESEARCH.md §6). Ein US-Feiertag ist günstig.
- **Start:** 12:01 AM Pacific = **09:01 Uhr in Deutschland**. In den Wochen, in denen US- und EU-Zeitumstellung auseinanderfallen, ist es 08:01 Uhr (RESEARCH.md §2).
- **Einplanen:** per „Schedule“ bis zu 30 Tage vorher. Den Entwurf vorher per Draft im Team prüfen (§1.2).

## Ablauf am Launch-Tag

1. 09:01 Uhr: Der Launch geht live, **sofort** der Maker-Kommentar (70 % der Tagessieger hatten einen, RESEARCH.md §2).
2. **Kommentar-Dienst 09:00 bis ca. 01:00 Uhr MESZ**, damit der US-Tag abgedeckt ist. Beide Gründer im Wechsel. Jeden Kommentar selbst beantworten („We left no questions or comments unanswered“, §5), Fakten aus `FAQ.md`.
3. **Outreach nur mit dem Wortlaut aus POSTS.md** („visit and comment“). Keine Vote-Bitte, keine Massen-DMs, keine frischen Accounts von Freunden (§1.4).
4. X- und LinkedIn-Post am Morgen (Cursor-/Mastra-Muster, §6), ohne „upvote“.
5. Nach 24 h notieren: Rang, Punkte, Kommentare, Besuche und Signups aus eigenen Logs. Keine Drittanbieter-Pixel.

## Reaktion auf Kritik

- „Not yet“ ist eine zulässige Antwort (GitWarren, Chit, §4). Nie „coming soon“ mit Datum, das nicht im Repo steht.
- Zahlenfragen: nur belegte Zahlen (C1). Keine Benchmark-Werte, kein 44× (Gammacode-Lehre, §3).
- Preiskritik: Preis und Kartenpflicht sachlich bestätigen. Nicht spontan im Thread Rabatte versprechen.

## Nach dem Launch

Die Relaunch-Sperre beträgt sechs Monate, UI- und Preisänderungen zählen nicht als Anlass (§1.3). Natürliche nächste Launches sind Roadmap-Punkte, **wenn sie gebaut sind**: Revisionsvergleich, Integritäts-Trend, zweiter Anbieter als Verifier, signierter Nachweis pro Commit, Team-Pläne.
