# LAUNCH: Hacker News

## Was vorher live sein muss (alles, sonst kein Post)

| # | Voraussetzung | Warum | Status heute |
|---|---|---|---|
| 1 | **Ausprobieren ohne unslop-Konto:** öffentliches Demo-Repo mit echten PRs und sichtbaren Check Runs und Kommentaren. Besser zusätzlich: eine CLI, die die 55 deterministischen Detektoren lokal ohne Login ausführt | showhn.html: „ideally without barriers such as signups or emails“. Alle funktionierenden Beispiele boten das (RESEARCH.md §3, §8.2) | fehlt, ROADMAP-To-Do eingetragen |
| 2 | Signup offen, `@unslopcodes/cli` auf npm, Extension im Marketplace | Wer mehr will als das Demo-Repo, muss sofort starten können | fehlt |
| 3 | Preis und Trial-Bedingungen öffentlich auf der Seite, Paddle live | „Make your pricing transparent“ (RESEARCH.md §1.6) | fehlt |
| 4 | Landing-Korrekturen W1–W5, W8–W11 | Die 44×-Zeile und „verdicts no LLM votes on“ bestimmen sonst die ganze Diskussion (§8.4) | fehlt, ROADMAP §10 |
| 5 | Impressum, Datenschutz, Speicherfristen festgelegt, Frist Durable Caching (2026-10-14) geklärt | FAQ 10 | fehlt, ROADMAP §0/§2 |
| 6 | Server-Audit M1–M3 behoben, vor allem M3 (Fork-PRs verbrauchen Owner-Quota) | HN testet Sicherheit öffentlich (FAQ 6) | offen, ROADMAP §6 |
| 7 | HN-Account des Gründers mit wochenlanger echter Kommentarhistorie; Username ≠ „unslop“; E-Mail im Profil | showlim-Sperre für neue Accounts; dang-Tipps (§1.4, §1.5) | offen beim Gründer |
| 8 | Post-Text von Hand geschrieben, ohne LLM-Hilfe beim Formulieren | dang, 28.03.2026 (§1.4) | offen beim Gründer |
| 9 | Gründerentscheidung zur öffentlichen Regelliste (IDs + Quellen) | Beantwortet „why closed“ und „how did you pick the patterns“ vorab | offen beim Gründer (BRIEF.md) |

## Empfohlener Zeitpunkt

- **Tag:** Der Launch-Tag L selbst, sobald 1–9 erfüllt sind, als Leit-Kanal des Tages. X, LinkedIn und Reddit ziehen nach (siehe deren LAUNCH.md). Sonntag, Montag, Dienstag oder Donnerstag.
- **Uhrzeit:** 15:00–17:00 UTC (17:00–19:00 MESZ).
- **Beleg:** Auswertung aller 45.844 Show HNs der letzten 12 Monate über Algolia (RESEARCH.md §7). Das ist nur eine Korrelation, und die Unterschiede sind klein.
- **Wichtiger als die Uhrzeit:** In den ersten sechs Stunden verfügbar sein.
- **Nicht** am selben Tag wie ein großes Branchen-Event posten. Das vorher prüfen, dazu liegt kein Beleg vor, es ist eine Heuristik.

## Ablauf am Tag

1. Titel (Empfehlung aus POSTS.md §1) und Text in eigenen Worten posten. URL: Demo-Repo oder eine Landing mit dem Weg ohne Konto.
2. Sofort den ersten Maker-Kommentar posten (POSTS.md §5, von Hand geschrieben).
3. **Sechs Stunden erreichbar bleiben.** Jede ernsthafte Frage selbst beantworten, faktenbasiert (FAQ.md).
4. **Keine Booster:** Kein Teammitglied, Freund oder Beta-Nutzer kommentiert oder votet koordiniert. Den Link nirgends mit der Bitte um Votes teilen. Voting-Ring-Detektor und Community bestrafen das (§1.5).
5. **Nicht löschen und neu posten, keinen Zweit-Account nutzen** (newsguidelines; avouch-Lehre, §3 Nr. 9).
6. Geht der Post unter: E-Mail im Profil lassen und auf eine Repost-Einladung bzw. den Second-Chance-Pool hoffen (§1.5). Erneut posten erst bei einem wesentlich neuen Stand, etwa mit lokaler CLI.
7. Nach 48 h notieren: Punkte, Kommentare, Kritikthemen (als neue FAQ-Einträge), Signups und Demo-Repo-Besuche aus eigenen Logs. Kein Tracking-Pixel.

## Reaktion auf Kritik in den ersten Stunden

- **Zuerst recht geben, wo es stimmt.** Beispiel „same model family“: ja (FAQ 1).
- **Nie mit Zahlen antworten, die es nicht gibt.** Keine Präzision, keine Recall-Werte aus dem internen Benchmark (FAQ 7).
- **Sicherheitsfragen:** nur Verifiziertes sagen. Bei offenen Punkten versprechen, sie ordentlich aufzuschreiben, und das dann auch tun (FAQ 6).
- **Harte Einzelbeispiele** („I threw a PR at it, 10 of 11 were wrong“): danken, um das Beispiel bitten, konkret prüfen. Nicht generisch antworten (mrge-Lehre, §3).
- **Namensverwechslung** mit unslop.news: freundlich klarstellen (FAQ 9).
