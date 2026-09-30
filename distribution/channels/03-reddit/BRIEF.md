# BRIEF: Reddit

## Zielgruppe

**Primär:** Entwickler, die täglich mit Claude Code, Cursor oder Copilot arbeiten (r/ClaudeCode, r/cursor, r/ChatGPTCoding, r/mcp). Dazu erfahrene Engineers und Tech Leads, die KI-PRs reviewen müssen (r/ExperiencedDevs, r/devops).

Laut Stack Overflow Survey 2025 nutzen 53,6 % der professionellen Entwickler Reddit (Zahl aus `../01-x/RESEARCH.md` §6). Reddit ist damit die größte der fünf Plattformen für unsere Dev-Zielgruppe. Gleichzeitig ist sie die mit den strengsten Werberegeln.

**Nicht hier:** CTOs als eigene Zielgruppe (LinkedIn), Käufer von Zertifikaten.

## Kernwinkel (einer)

**„Wie reviewt ihr KI-geschriebenen Code, und wo darf ein LLM mitentscheiden?“ Als ehrliche Frage aus der Praxis eines Machers, der die Grenzen seines eigenen Tools offenlegt.**

- In Phase A ist das eine Diskussion ohne Produktlink.
- In Phase B ist es ein Showcase, der zeigt, was deterministisch geprüft wird und was ein LLM prüft.

**Warum das auf Reddit funktioniert:**
- **Diskussion ohne Produkt wird belohnt.** „We should refuse to review vibe code PRs“ bekam 87 Kommentare ohne Produkt (RESEARCH.md §6). KI-Themen sind in r/ExperiencedDevs mittwochs und samstags ausdrücklich zugelassen (§2).
- **Werbung wird entfernt, und die Community reagiert feindselig.** „This is very obviously an ad.“ (Beispiel 1). Spamfilter-Quoten liegen bei 49–68 % (§6). Waitlist-Posts gelten in r/SaaS und r/programming als „gather emails“-Spam (§5).
- **Ehrliche Grenzen und Macher-Antworten mit Zahlen werden honoriert** (r/mcp, Beispiel 8), Ausreden nicht (Beispiel 9).

**Belege im Repo:**
- 55 Detektoren (`packages/prescan/src/rules/registry.ts`)
- LLM nur für JS/TS (`helpers.ts:381`)
- Blind-Verifier (SPEC D5)
- Check-Fazit (`check-run.ts`)
- App-Rechte (GITHUB_APP_SPEC: `contents: read & write` nur für `resolveReviewThread`)

## Wie viel Roadmap verträgt Reddit

**Sehr wenig.**
- Roadmap-Posts ohne Substanz verpuffen (OpenVue: 1 Punkt; Beta-Tester-Gesuche werden entfernt, RESEARCH.md §5).
- Geplantes erscheint nur **als Antwort in Kommentaren**, wenn jemand fragt, und dann mit „planned, not built“, zum Beispiel beim Revisionsvergleich oder bei weiteren Sprachen.
- Kein Zertifikat und keine Pläne für Teams in Reddit-Posts.

## Phase und Status

| Phase | Was | Status |
|---|---|---|
| Vorlauf (ab sofort möglich, braucht nichts von unslop) | Gründer-Account 4–6 Wochen mit echten Kommentaren aufbauen, > 100 Karma, 9:1 (RESEARCH.md §7.1) | **offen beim Gründer** |
| A (nach HR-Eintrag) | R-A1 (r/ExperiencedDevs, Mi/Sa UTC), R-A2 (r/devops): Diskussion, kein Link | vorbereitet |
| B (Launch-Tag +) | R-B1 r/ClaudeCode Showcase, R-B2 r/mcp, R-B3/B4 Weekly-Threads, R-B5 r/SaaS | **blockiert** bis npm-Publish und offene Registrierung |
| blockiert, zusätzlich | r/ClaudeAI verlangt „free to try“. Der Pro-Trial braucht eine Karte (`PADDLE_SPEC.md:15`), das zählt nicht. r/programming nimmt nur Link-Posts mit „deeply technical content“, und es gibt keinen Blog | nicht vorbereitet, Grund in POSTS.md |

## Assets

| Datei | Was | Status |
|---|---|---|
| `POSTS.md` | R-A1, R-A2 (Diskussion), R-B1–R-B5 (Showcase und Threads), je 3–5 Titel mit Empfehlung, erster Kommentar, Offenlegungssatz | fertig |
| `FAQ.md` | 10 Reddit-typische Einwände (Closed Source, „is this an ad“, App-Rechte, LLM-Wrapper, Preis …) | fertig |
| `LAUNCH.md` | Account-Vorlauf, Wochentage, Ablauf, Verhalten bei Entfernung | fertig |
| `visuals/terminal-demo-launch.mp4` / `.gif` | Echter CLI-Output (scan → --fix → sauber), 1600×900, 25 s, Beispieldaten, Wartezeit gekürzt und im Bild gekennzeichnet | fertig |
| `visuals/terminal-demo-beta.*` | dasselbe mit Stempel „Private beta“ (nur falls in Phase A jemand im Kommentar fragt, wie es aussieht) | fertig |
| wiederverwendet: `../01-x/visuals/x-pr-finding.png` | PR-Check und Kommentar (echte Strings) | fertig |

Film 01–03 sind für Reddit bewusst **nicht** vorgesehen: Werbe-Ästhetik mit Musik passt nicht zu den Showcase-Normen dort. Die Terminal-Demo zeigt dagegen nüchtern das Werkzeug.
