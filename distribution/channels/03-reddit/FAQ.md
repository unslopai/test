# FAQ: Reddit (Einwände und Antworten)

**So ist die Datei gedacht:**
- Die Antworten sind Vorlagen, die der Gründer **selbst** in eigenen Worten postet. Mehrere Subs entfernen LLM-geschriebene Kommentare (RESEARCH.md §6).
- Die Antworten sind kurz, konkret und geben Grenzen zu.
- Zahlen und Status stammen aus `../CONTEXT.md`.

---

### 1. „This is an ad.“

„Yes, I'm the founder, which is why the first line says so. If it breaks the sub's rules, I'll take it down. Otherwise I'm here for the technical questions.“

Danach nicht weiter verteidigen. Wenn Mods entfernen, nicht neu posten (LAUNCH.md).

### 2. „Isn't this just a linter / Semgrep with extra steps?“

„Partly, and that's intentional: 55 of the 119 rules are deterministic detectors (regex, tree-sitter, ESLint, config and registry checks). The rest cover things syntax can't show, like a catch block that returns success. An LLM reviews those, and a second, blind call checks each claim on the standard route. If you already run Semgrep, keep it; this targets AI-specific failure patterns.“

**Beleg:** `packages/prescan/src/rules/registry.ts`, SPEC D5.

### 3. „So an LLM checks the LLM. Why would I trust that?“

„You shouldn't have to take it on trust. Every finding carries its rule ID and a verification status: deterministic, confirmed by the blind pass, uncertain, or self-reported. So you can see which kind of check produced it. Only critical findings fail the check.“

**Beleg:** Feld `verification` (SPEC §6), `check-run.ts:155-193`.

### 4. „Closed source and paid? Pass.“

„Understood. It's closed source. There's a 14-day trial with a card, then a paid plan. The review runs on our servers, so there are real per-scan model costs. If you want to see the output first, the video in the post is real CLI output.“

**Nur in Phase B**, und den Preis nur mit Paddle live nennen (€29/month, 500 scans).

### 5. „Your GitHub App wants write access to my code?“

„Fair question. The app asks for checks: write, pull_requests: write and contents: read & write. The contents write permission exists only because GitHub's resolveReviewThread mutation requires it for app tokens: when you dismiss a finding, we resolve that review thread. The unslop code never writes repository contents. Fixes are applied locally by you (CLI/VS Code) or as a suggestion you click on GitHub.“

**Beleg:** `docs/specs/GITHUB_APP_SPEC.md` (Permissions, Nachtrag 2026-08-09).

Wenn jemand den CodeRabbit-Vorfall anspricht (RESEARCH.md §4 Nr. 13): Nicht über den Wettbewerber urteilen. Nur sagen, was unslop tut und was nicht.

### 6. „Where does my code go?“

„The diff goes to our backend, and the models run on Google Vertex AI on the EU endpoint, without training on your code. We keep findings with the quoted lines as your scan history, and for CLI/MCP scans also the submitted diff. The CLI filters secrets locally before upload. Privacy policy: [link].“

**Vorbedingung:** `/en/privacy` ist live.

### 7. „Which languages?“

„The LLM review covers JS/TS today. The deterministic pre-scanner reads more, including Python, Go, Java, C, Terraform and YAML, for its 55 rules. I'd rather say that up front than have you find out on a Python repo.“

**Beleg:** `helpers.ts:381`, `packages/prescan/src/language.ts` (`.py`, `.go`, `.tf`, `.yaml` u. a., geprüft).

### 8. „False positives?“

„They exist. That's why only critical findings block and warnings stay comments. Through the MCP server you can dismiss a finding with a written reason: it's recorded in an append-only log and the review thread on GitHub is resolved. It doesn't yet suppress the same finding on later scans. That's planned. If you hit a false positive, I'd genuinely like to see it.“

**Beleg:** `unslop_resolve_finding`, MCP_SPEC §4.4 („The ledger has no read surface in v1“). Eine Unterdrückung bei späteren Scans ist also **nicht** gebaut.

### 9. „Is this the `unslop` package on npm?“

„No. The unscoped `unslop` name on npm belongs to someone else. Ours is `@unslopcodes/cli` (and `@unslopcodes/mcp`). Please don't `npx unslop`.“

**Beleg:** MCP_SPEC §3.2 (Naming Amendment), ROADMAP_ARCHIVE L548.

### 10. „What's next?“ (nur als Antwort, nie als eigener Post)

„Planned, not built: failing a check when a push makes things worse than the previous one, and extending the LLM review beyond JS/TS once we've measured the cost. No dates.“

**Beleg:** CONTEXT §5.
