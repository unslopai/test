# FAQ: X (kritische Fragen und Einwände)

**So ist die Datei gedacht:**
- Die Antworten sind Vorlagen für **handgeschriebene** Replies (RESEARCH.md §1.2: KI-generierte Replies brauchen eine Freigabe durch X; außerdem passen sie nicht zu unserer Positionierung).
- Jede Antwort hat eine X-taugliche Kurzform (≤ 280) und darunter die Belege, falls jemand nachhakt.
- Alle Zahlen und Status stammen aus `../CONTEXT.md`.

---

### 1. „Isn't this just a linter?“

**Kurz:** „Part of it is: 55 of the 119 rules have deterministic detectors, linter-style. The rest are things a linter can't see from syntax, like a catch that returns success. An LLM reviewer checks those, with a blind second pass on the standard route. Each finding says which path produced it.“

**Belege:**
- `packages/prescan/src/rules/registry.ts` (55 Regel-IDs)
- `claim-verifier-step.ts`
- Feld `verification` pro Finding (`deterministic`, `confirmed`, …)

---

### 2. „So it's an LLM grading an LLM. Isn't that exactly what you criticise?“

**Kurz:** „Fair hit. The LLM part exists, and I won't hide it. Differences: where a rule can be checked mechanically, no model decides. On the standard route, a second model call re-checks each LLM claim blind, without the first one's reasoning. And when that didn't happen, the output says so.“

**Belege:**
- SPEC.md D5: „The verifier call is strictly blind … never the draft's critique text or reasoning“.
- Tagline für `pro-direct`: „self-reported, no blind re-verification“ (SPEC §6).

**Nicht sagen:** „Verdicts no LLM votes on“, „the AI never decides“ (CONTEXT W3).

---

### 3. „How do you measure that it works? Show me your numbers.“

**Kurz:** „We run an internal benchmark with planted violations, but it's our own fixtures, so I won't quote it as proof. The published numbers I cite are third-party research about AI code, not about unslop. Real-world numbers come when there's real usage.“

**Belege:**
- MARKETING_CLAIMS §0.2: „Copy may say ‘the research shows’, never ‘we measured’“.
- CONTEXT §4b: Die Benchmark-Zahlen sind nicht öffentlich.

---

### 4. „Why not Semgrep / SonarQube / CodeQL?“

**Kurz:** „Use them. They're great at what they check. unslop targets failure patterns that show up in AI-written code specifically, each tied to a study, and it puts a rule ID plus a suggested fix on the PR. It's meant to sit next to your SAST, not replace it.“

**Belege:** Die Golden-DB-Regeln nennen Quellen und Enforcement pro Regel (`data/Golden_Database__-_Tabellenblatt1.csv`).

**Nicht sagen:**
- Vergleiche mit Zahlen zu einem Wettbewerber (MARKETING_CLAIMS §0.3)
- „we're better than“

---

### 5. „Where is the 44× from? That sounds made up.“

**Kurz:** „AIRA, arXiv 2604.17587: a cloud LLM evaluator produced findings at a 44:1 ratio below a deterministic scanner. The author calls it exploratory (one model, one codebase), so I don't lead with it. Stronger in the same paper: 1.80× more high-severity findings per file.“

**Belege:** CONTEXT C1, C2. Das Paper beschreibt in §5.5, Tab. 9/10 das Modell `minimax-m2:cloud`.

---

### 6. „When does it ship? / When can I try it?“

**Kurz (Phase A):** „No public date I can stand behind. It runs in a private beta today. The waitlist gets a mail when it opens, nothing else: unslop.codes“

**Kurz (Phase B):** „Today: npm i -g @unslopcodes/cli, then unslop scan. The GitHub App and VS Code extension are linked on unslop.codes.“

**Beleg:** WAITLIST_SPEC §5, Copy „We email you when the private beta opens, nothing else.“ Im Repo steht kein Termin (CONTEXT §2).

---

### 7. „Which languages?“

**Kurz:** „The LLM review covers JS/TS today. The deterministic pre-scanner reads more, including Python, Go, Java, C, Terraform and YAML, but only for its 55 rules. More languages in the LLM lane come when we've measured the cost.“

**Belege:**
- `helpers.ts:381` (`REVIEWABLE_EXTENSIONS`)
- `packages/prescan/src/language.ts`
- ROADMAP §1 „LLM-Lane sieht in Produktion nur JS/TS“

---

### 8. „Do you store or train on my code?“

**Kurz:** „No training. Inference runs on Vertex AI, EU endpoint. We store findings with the quoted lines as scan history, plus the diff for CLI/MCP scans. CLI and editor scans filter secrets on your machine before upload. Details: privacy policy.“

**Belege:**
- `messages/en.json` FAQ `sourceCode` (Wortlaut der Landing)
- `diff-upload-guard.ts`

**Vorbedingung:** Erst posten, wenn `/en/privacy` live ist (CONTEXT W9).

---

### 9. „Will it block my merges / slow my CI?“

**Kurz:** „It runs as a separate GitHub check, parallel to CI, capped at 300 seconds. Only critical findings fail it. Warnings conclude as neutral. Whether it blocks a merge is your branch-protection setting.“

**Belege:**
- FAQ `ciSpeed` der Landing
- `check-run.ts:155-193`
- `deadline.ts:22-25`

---

### 10. „What does it cost?“

**Kurz (Phase A):** „Pricing isn't public yet. It will be before anyone pays anything.“

**Kurz (Phase B, nur wenn Paddle live ist):** „Pro is €29/month: 500 scans, 14-day trial. Plans for heavier use and for teams are planned, not priced.“

**Belege:**
- `PADDLE_SPEC.md:15`
- `plan-config.ts`
- CONTEXT §1 „Preise und Pläne“

**Hinweis:** Preise nicht in einem Thread verstecken (Greptile-Lehre, RESEARCH.md §4 Nr. 5).

---

### 11. „Is a ‘certificate’ for code not just compliance theatre?“ (zu X-2 und X-L3)

**Kurz:** „Could be, if it claimed ‘no bugs’. The idea is narrower: a signed record per commit SHA of which rules ran and what passed, so a CTO can show an auditor a receipt instead of a slide. It's on the roadmap, not built.“

**Belege:** ROADMAP §11 (Vision). Nicht sagen: „100% slop-free“, Supply-Chain, Pflicht für Lieferanten (CONTEXT §5).
