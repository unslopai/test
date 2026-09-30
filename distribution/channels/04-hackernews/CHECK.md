# CHECK: Selbstkontrolle Hacker News

Stand 2026-09-29.

## 1. Specs

| Prüfpunkt (RESEARCH.md §2) | Soll | Ergebnis |
|---|---|---|
| Titel | ≤ 80 Zeichen inkl. „Show HN: “ | 76 / 74 / 77 / 49 ✓ |
| Medien | HN zeigt keine Bilder oder Videos | keine HN-eigenen Medien. Die Terminal-Demo liegt für Zielseite und Demo-Repo bereit (`../03-reddit/visuals/terminal-demo-launch.*`, 0,7 MB / 0,33 MB) |
| Textformat | Kursiv mit Sternchen, Code mit 2 Leerzeichen Einzug, Links automatisch (formatdoc) | Der Referenztext nutzt Einzug nur zur Darstellung in dieser Datei. Der eigene Post braucht keinen Codeblock |

## 2. Zahlen und Status gegen CONTEXT.md

| Verwendet | CONTEXT | ✓ |
|---|---|---|
| 119 / 55 (regex 13, tree-sitter 18, config 17, ESLint 5, registry 2) | §1, `registry.ts` | ✓ |
| Modelle: Draft `gemini-3.8-flash`, Verifier `gemini-3.6-flash`, beide Google | `models.ts` | ✓ |
| Blind-Pass nur auf der Standard-Route, Status pro Befund | SPEC D5/§6 | ✓ |
| Check-Fazit, `COMMENTED`, 300 s | `check-run.ts`, ROADMAP_ARCHIVE L68, `deadline.ts` | ✓ |
| App-Rechte und Grund | GITHUB_APP_SPEC | ✓ |
| Server-Audit 0 CRITICAL / 0 HIGH / 3 MEDIUM | SERVER_AUDIT_2026-09, ROADMAP-Chronik 2026-09-28 | ✓ |
| Preis und Trial nur mit Paddle live | §1 Preise | ✓ |
| 1.80× als einzige Forschungszahl | C1 | ✓ |
| Nicht verwendet: 44×, Benchmark-Zahlen, „verdicts no LLM votes on“, `npx unslop` | §4, W1/W3 | ✓ |
| SEC-026 deterministisch (tree-sitter + ESLint `react/no-danger`), SEC-031 LLM | `security-rules.ts`, `eslint-engine.ts:30`, `grep SEC-031 packages/prescan` ⇒ 0 | ✓ (in der ersten Fassung hieß es fälschlich nur „ESLint“) |

## 3. Lesung als skeptischer Senior Engineer, der unslop nicht kennt

| Stelle | Einwand | Änderung |
|---|---|---|
| Titel-Variante 4 („Catch AI code slop before merge“) | „slop“-Pathos, sagt nicht, was es ist | als „nicht verwenden“ markiert |
| Titel mit „Unslop –“ | Verwechslung mit unslop.news | Empfehlung ist eine beschreibende Variante ohne Namen |
| Referenztext „verifier re-checks each claim“ | Stimmt nicht für `pro-direct` | „On the standard path“ |
| Referenztext „independent verification“ | Gleiche Modellfamilie | Die Grenze steht ausdrücklich im Text: „not independent in the model-family sense“ |
| FAQ 6 Sicherheit | Isolation der Parser auf fremdem Code ist nicht dokumentiert | Keine Behauptung, stattdessen „I'll write it up properly“. Vor dem Launch dokumentieren |
| FAQ 10 Datenhaltung | Speicherfristen gibt es noch nicht | als Vorbedingung markiert |
| Gesamter Kanal | LLM-Text verboten | Nur Faktenblatt und Referenz, der Gründer schreibt selbst (POSTS.md, CONTEXT) |

## 4. Offen

- Alle neun Vorbedingungen in `LAUNCH.md`. Heute ist keine davon vollständig erfüllt.
- Die Isolation der deterministischen Engines (tree-sitter/ESLint) auf Kundencode vor dem Launch dokumentieren, damit FAQ 6 eine belegte Antwort hat.
