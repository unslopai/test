# POSTS: Hacker News

> **Wichtig:** dang, 28.03.2026: „Write your text by hand. Don't use an LLM to generate any of it (not even a tiny bit, including to edit or spruce it up).“ (RESEARCH.md §1.4)
>
> Deshalb enthält diese Datei **keinen Post zum Kopieren**, sondern:
> 1. geprüfte Titel,
> 2. ein Faktenblatt mit Beleg pro Satz,
> 3. eine Gliederung,
> 4. einen **Referenztext**, gegen den der Gründer seinen eigenen, von Hand geschriebenen Text abgleicht: Fakten richtig, Grenze genannt, keine Werbesprache.
>
> Den Referenztext nicht posten, auch nicht umformuliert.

**Status:** blockiert (BRIEF.md). Alle Angaben gelten für den Zustand nach Launch-Tag L plus Demo-Repo.

---

## 1. Titel (Limit 80 Zeichen inkl. „Show HN: “; gezählt mit `_kit/count.py`)

Der Name trägt auf HN nicht: „unslop“ ist dort mit unslop.news und unslop.run belegt (RESEARCH.md §3). Deshalb beschreibt jede Variante das Produkt.

| # | Titel | Zeichen | Bewertung |
|---|---|---|---|
| 1 | Show HN: A PR check for AI-written code that says which findings an LLM made | 76 | **Empfehlung.** Trifft die Kernsorge (LLM-Urteil) und verspricht keine Zahl |
| 2 | Show HN: Unslop – GitHub check for AI-written code with rule IDs and fixes | 74 | Gut, aber der Name verwechselt sich mit unslop.news |
| 3 | Show HN: Review gate for AI-generated PRs: 55 deterministic rules plus an LLM | 77 | Konkret. Die Zahl lädt zur Frage „and the other 64?“ ein, das ist gut |
| 4 | Show HN: Unslop – Catch AI code slop before merge | 49 | **Nicht verwenden:** „slop“-Pathos, generisch |

## 2. Faktenblatt (jede Aussage mit Beleg; nur diese Fakten verwenden)

| Aussage | Beleg |
|---|---|
| unslop ist ein GitHub-Check („Anti-Slop Gatekeeper“) plus Review-Kommentare auf PRs, außerdem CLI, VS Code und MCP | `src/lib/check-run.ts`, `packages/*` |
| 119 Regeln, jeder eine veröffentlichte Studie zugeordnet | Golden DB, CONTEXT §4b |
| 55 Regel-IDs mit deterministischem Detektor: regex 13, tree-sitter 18, config 17, ESLint 5, registry 2; ~25 Dateitypen | `packages/prescan/src/rules/registry.ts` |
| Der Rest läuft über einen LLM-Reviewer, **nur für JS/TS**, Temperatur 0; Draft `gemini-3.8-flash`, Verifier `gemini-3.6-flash` (beide Google, Vertex AI EU) | `helpers.ts:381`, `models.ts:114-116,179` |
| Auf der Standard-Route prüft ein zweiter, blinder Call jede LLM-Behauptung, ohne die Begründung des ersten zu sehen. Die Route `pro-direct` überspringt das, und das Ergebnis sagt es dann („self-reported, no blind re-verification“) | SPEC D5, §6 |
| Jeder Befund hat den Status `deterministic`, `confirmed`, `uncertain`, `self_reported` oder `unverified` | SPEC §6 |
| Check-Fazit: failure nur bei ≥ 1 Critical; nur Warnungen ⇒ neutral; nichts ⇒ success | `check-run.ts:155-193` |
| Reviews posten als `COMMENTED`, nie `REQUEST_CHANGES`; Required-Check ist Branch-Protection des Kunden | ROADMAP_ARCHIVE L68 |
| Wenn nichts geprüft wurde: „Nothing was reviewed — this is NOT a clean verdict.“ | `packages/cli/src/format.ts` |
| Harte Obergrenze 300 s pro Review; bei Ausfall schließt der Check mit Begründung | `deadline.ts`, `job-failure.ts` |
| CLI-/Editor-Scans filtern Secrets lokal vor dem Upload; im PR-Pfad gibt es keinen serverseitigen Filter | `packages/shared/src/node/api-client.ts`, ROADMAP §2 |
| App-Rechte: `checks: write`, `pull_requests: write`, `contents: read & write` (nur für `resolveReviewThread`), `metadata: read`. Der unslop-Code schreibt nie Repo-Inhalte | GITHUB_APP_SPEC |
| Gespeichert werden Befunde mit zitierten Zeilen als Scan-Historie, bei CLI/MCP auch der Diff. Kein Training auf Kundencode | Landing-FAQ `sourceCode` |
| Kein Revisionsvergleich (geplant). Jeder Push wird einzeln geprüft | CONTEXT W2, §5 |
| Preis: Pro €29/Monat, 500 Scans, 14-Tage-Trial mit Karte; nur nennen, wenn Paddle live ist | `PADDLE_SPEC.md`, `plan-config.ts` |
| Motivation (Forschung Dritter): 1.80× mehr High-Severity-Befunde pro Datei in KI-zugeordnetem Code, 955 vs. 955 Dateien | CONTEXT C1 |

**Nicht verwenden:**
- 44×
- „deterministic AI code review“ als Pauschalbegriff
- „verdicts no LLM votes on“
- eigene Benchmark-Zahlen (keine öffentliche Harness)
- „every revision“ im Sinne eines Vergleichs
- Vergleichszahlen zu Wettbewerbern
- „npx unslop“

## 3. Gliederung (nach dang-Tipps und RESEARCH.md §8.6)

1. Wer schreibt: Name(n) des Teams, kleines Team in Deutschland. *Nur echte Namen, keine Rolle erfinden.*
2. Ein Satz, was es ist, anders formuliert als der Titel.
3. Vorgeschichte: welcher KI-geschriebene Fehler uns selbst gebissen hat. *Nur ein echter Fall aus dem eigenen Code, nicht das Beispiel aus den Filmen.*
4. Wie es funktioniert: deterministischer Teil, LLM-Teil, Verifier, Status pro Befund, nur Critical blockiert.
5. Grenzen: JS/TS-only im LLM-Teil, serverseitig, beide Modelle von Google, kein Revisionsvergleich.
6. Warum closed und kostenpflichtig, mit Preis und Trial-Bedingungen im Klartext.
7. Link zum Demo-Repo bzw. zum Weg ohne Konto.
8. Konkrete Bitte um Feedback, etwa zu False Positives auf eigenem Code oder zu fehlenden Regeln.

## 4. Referenztext (NICHT posten, nur zum Abgleichen)

    [Namen], a small team in Germany. unslop is a GitHub check (plus a CLI and a VS Code
    extension) for pull requests that contain AI-written code. It posts findings as review
    comments with a rule ID and, where it can, a suggested fix, and it fails the check only
    on critical findings.

    Why: [echter eigener Fall, 2–3 Sätze].

    How it decides:
    - 119 rules, each tied to a published study on how AI-generated code fails.
    - 55 of them have deterministic detectors (regex, tree-sitter, ESLint, config files,
      package registries). No model involved.
    - The rest are checked by an LLM reviewer, JS/TS only for now. On the standard path,
      a second blind call re-checks each claim without seeing the first call's reasoning.
    - Every finding is labelled: deterministic, confirmed, uncertain or self-reported.
      If nothing was reviewed, it says "Nothing was reviewed — this is NOT a clean verdict."

    Limits: both models are Google's (Gemini on Vertex AI, EU endpoint), so the verifier is
    not independent in the model-family sense. We'd like a second vendor there; it's not
    built. It reviews each push on its own, without comparing to the previous one. The
    review runs on our servers, so you need an account.

    Pricing: €29/month, 500 scans, 14-day trial (card required). Closed source because the
    review pipeline carries per-scan model costs. [Falls entschieden: Regel-IDs und Quellen
    sind öffentlich unter …]

    Try it without an account: [Demo-Repo mit offenen PRs und sichtbaren Checks].

    Most useful feedback: false positives on your own code, and failure patterns you'd
    expect a tool like this to catch but it doesn't.

## 5. Erster Maker-Kommentar (Referenz, ebenfalls von Hand schreiben)

Ziel: technische Tiefe statt Werbe-Echo (RESEARCH.md §8.9). Inhalt:
- Ein echtes Beispiel-Finding aus dem Demo-Repo, mit Regel-ID, `public_explanation` und Quellen-Paper der Regel.
- Wie der Blind-Verifier aufgebaut ist: Er bekommt Regel, Pfad, Zeile, exaktes Zitat und Diff-Hunk, aber nie Critique oder Fix-Text (SPEC D5).
- Was deterministisch ist, an einem Beispiel: SEC-026 (XSS via `dangerouslySetInnerHTML`/`innerHTML`) läuft deterministisch über tree-sitter (`rules/ast/security-rules.ts`) und das ESLint-Mapping `react/no-danger`, SEC-031 (verschluckter Fehler) dagegen über das LLM.
- Die ehrliche Antwort auf „same model family?“, **vorweggenommen**: ja, beide Gemini; ein zweiter Anbieter ist geplant, nicht gebaut.
