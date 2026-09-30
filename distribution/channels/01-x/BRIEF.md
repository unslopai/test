# BRIEF: X

## Zielgruppe

**Primär:** Senior Engineers, Tech Leads und Indie-Builder, die mit Claude Code, Cursor, Codex oder Copilot Code erzeugen und einen KI-Reviewer nutzen oder erwägen.
- Auf X lesen sie die Macher ihrer Tools mit (Cherny, Cursor, CodeRabbit; RESEARCH.md §4) und belohnen konkrete Build-Logs mit Bookmarks.
- Nur 17 % der professionellen Entwickler nutzen X (Stack Overflow Survey 2025, RESEARCH.md §6). Dieser Anteil ist aber überproportional der Early-Adopter-Teil, der KI-Coding-Tools öffentlich bespricht.

**Sekundär:** Gründer anderer Dev-Tools (Build-in-Public-Szene). CTOs sind auf X schwer belegbar (RESEARCH.md §6: keine belastbare Quelle). Sie bekommen LinkedIn.

## Kernwinkel (einer)

**„Receipts, not vibes“: Wir zeigen eine konkrete Fehlerklasse, die ein KI-Reviewer durchwinkt, und das Finding, das unslop dazu postet: Regel-ID, Studienquelle, Fix. Dazu kommt ein ehrliches Build-Log, was läuft und was nicht.**

Warum das auf X funktioniert:
- **Der Slogan-Raum ist besetzt.** CodeRabbit hat „Stop shipping slop“ und „quality gates“ am 16.09.2025 wörtlich gelauncht (RESEARCH.md §4 Nr. 3). Ein weiterer Slogan verschwindet; ein sichtbarer Beleg nicht (RESEARCH.md §7.2).
- **Nutzwert schlägt Hype.** Macher-Threads mit konkreter Praxis sammeln Bookmarks statt Likes: Cherny, 8,2 Mio. Views und 103k Bookmarks (RESEARCH.md §4 Nr. 1).
- **Entwickler rechnen Zahlen nach** (Devin-Fall, RESEARCH.md §5/§7.7). Deshalb stehen im Kern nur die Zahlen aus `CONTEXT.md` §4a. C2 (44:1) erscheint nie ohne Einordnung.

Belege im Repo:
- `SEC-031` ist eine CRITICAL-Regel der Golden DB. Ihre Quelle ist AIRA (arXiv 2604.17587), ihr Text die `public_explanation` aus `supabase/migrations/040_populate_public_explanations.sql`.
- Check-Run-Titel und Kommentarformat stammen aus `src/lib/check-run.ts` und `src/lib/pipeline/helpers.ts`.
- Der CLI-Output ist der echte Formatter (`_kit/cli/sample-output.ts`).

## Wie viel Roadmap verträgt X

**Viel, aber nur im erkennbaren Build-in-Public-Format.**
- Build-Logs und „what's next“-Threads sind auf X eine eigene, akzeptierte Form (RESEARCH.md §5).
- Scharf abgestraft wird Over-Promising, also Termine und unbelegte Raten.

Daraus folgen drei Regeln:
- Roadmap steht in eigenen Posts (X-2, X-L3). Diese Posts sind als „Next / Roadmap“ markiert und haben keine Termine.
- In Produkt-Posts steht Roadmap höchstens im letzten Satz eines Threads.
- Der Haupt-Hook jedes Produkt-Posts beruht auf etwas, das existiert.
  - In Phase A ist das nicht öffentlich nutzbar, deshalb stehen „private beta“ oder „build log“ in Text **und** Bild.
  - Ab Phase B ist es live: `npm i -g @unslopcodes/cli`.

## Phase und Status

Alle Posts sind **blockiert bis zum HR-Eintrag** (`PLAN.md`).
- **Phase A** (Warteliste live): X-1 bis X-6.
- **Phase B** (Launch-Tag): X-L1 bis X-L3.

## Assets

| Datei | Was | Status |
|---|---|---|
| `POSTS.md` | Post-Texte Phase A und B, je 3–5 Hook-Varianten mit Empfehlung, erster Reply, Build-in-Public-Thread (Roadmap), Reply-Bausteine | fertig |
| `FAQ.md` | 10 kritische Fragen mit Antwort (für Replies) | fertig |
| `LAUNCH.md` | Zeitpunkt, Ablauf, Vorbedingungen, Reaktion in den ersten Stunden | fertig |
| `visuals/x-cli-output.png` | Echter `unslop scan`-Output (echter Formatter, Beispieldaten), 1600×900, Stempel „Private beta“ | fertig |
| `visuals/x-pr-finding.png` | Check Run + PR-Kommentar SEC-031 mit Suggested fix, 1600×900, „Private beta“ + „Example“ | fertig |
| `visuals/x-study-aira.png` | 1.80× (0.435 vs 0.242), Quelle AIRA Study 3 | fertig |
| `visuals/x-study-erosion.png` | 2.1 → 4.7 → 6.2 nach Iterationsgruppen, Quelle arXiv 2506.11022 | fertig |
| `visuals/x-status-board.png` | Build-Log: „Built and running · Private beta“ vs. „Next · Roadmap“ (Konzept-Stil, gestrichelt) | fertig |
| `visuals/x-film01-beta-16x9.mp4` | Film 01 mit „Private beta“-Stempel, korrigierter Stat-Szene und Endcard, 16:9-Komposition für Desktop | fertig |
| `visuals/x-film01-beta-9x16.mp4` | dasselbe in 9:16 für den mobilen Vollbild-Player | fertig |
| `visuals/x-film02-beta-16x9.mp4`, `visuals/x-film02-beta-9x16.mp4` | Film 02 mit Stempel und neuer Endcard | fertig |
| `visuals/x-film03-launch-16x9.mp4`, `visuals/x-film03-launch-9x16.mp4` | Film 03 unverändert (CTA `npm i -g @unslopcodes/cli`), **erst ab Launch-Tag** | fertig |

Warum es Filme **und** Stills gibt:
- Die Filme tragen Hook und Emotion. Ohne Ton funktionieren sie über die eingebrannte kinetische Typo; es gibt kein Voiceover, also braucht es kein SRT.
- Die Stills tragen die Belege, die man anhalten und lesen will.

Alle Launch-Videos von Dev-Tools im Sample waren 16:9 (RESEARCH.md §7.3). Deshalb gibt es zu jedem 9:16-Film eine 16:9-Komposition. Sie ist kein Crop: Der Film läuft als Karte in einem Markenrahmen mit statischer Beschriftung.
