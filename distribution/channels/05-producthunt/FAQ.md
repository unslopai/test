# FAQ: Product Hunt (absehbare Fragen im Launch-Thread)

**So ist die Datei gedacht:**
- Antworten schreibt der Gründer selbst („No LLMs“, RESEARCH.md §1.6). Hier stehen die belegten Fakten dafür.
- Die ausführlichen Belege stehen in `../04-hackernews/FAQ.md` (technisch) und `../02-linkedin/FAQ.md` (CTO-Fragen). Zahlen und Status stammen aus `../CONTEXT.md`.

| # | Frage | Fakt für die Antwort | Beleg |
|---|---|---|---|
| 1 | „How is this different from CodeRabbit / Greptile / cubic?“ | Keine Wettbewerberaussagen. Nur beschreiben: Regel-IDs mit Studienquelle, 55 deterministische Detektoren, Status pro Befund, nur Critical blockiert, gleiche Engine in PR, CLI, Editor und MCP | MARKETING_CLAIMS §0.3 |
| 2 | „False positives?“ | Es gibt sie. Nur Critical blockiert. Dismiss mit Begründung per MCP landet im Append-only-Log, **unterdrückt aber spätere Scans noch nicht** | MCP_SPEC §4.4 |
| 3 | „Do you upload my code / secrets?“ | Diff geht an unser Backend, Modelle auf Vertex AI EU, kein Training. CLI und Editor filtern Secrets lokal vor dem Upload, **kein Garantie-Claim**. Im PR-Pfad gibt es keinen serverseitigen Filter | `api-client.ts`, ROADMAP §2 |
| 4 | „Why closed source?“ | Die Review-Pipeline hat Modellkosten pro Scan. Regeltexte gelten als IP. Die Entscheidung zur öffentlichen Regelliste ist offen | `../04-hackernews/BRIEF.md` |
| 5 | „Which languages?“ | LLM-Review: JS/TS. Deterministischer Pre-Scanner: auch Python, Go, Java, C, Terraform, YAML u. a. | `helpers.ts:381`, `language.ts` |
| 6 | „Price? Is the trial free?“ | €29/Monat, 500 Scans, 14 Tage; Karte nötig (Stand PADDLE_SPEC). Team-Pläne geplant, ohne Preis | PADDLE_SPEC, CONTEXT §1 |
| 7 | „Is the verifier independent?“ | Blind, aber gleiche Modellfamilie (Gemini). Zweiter Anbieter geplant, nicht gebaut | `models.ts`, ROADMAP §5 |
| 8 | „GitLab / Bitbucket?“ | Heute nur GitHub. GitLab/Bitbucket stehen in der Roadmap als Vision, **nicht geplant**. Ehrlich „not planned right now“ sagen | ROADMAP §6 |
| 9 | „Does it block merges?“ | Nur Critical macht den Check rot. Blockieren tut er nur, wenn der Check in der Branch Protection required ist | Landing-FAQ `ciSpeed` |
| 10 | „Is this related to unslop.news / theunslop.app?“ | Nein, andere Projekte | RESEARCH.md §3 |
