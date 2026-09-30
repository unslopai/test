# FAQ: Hacker News (erwartbare Kritik, belegte Antworten)

**So ist die Datei gedacht:**
- HN verlangt handgeschriebenen Text (RESEARCH.md §1.4). Die Antworten hier sind **Faktenbasis** für die eigenen Worte des Gründers, keine Textbausteine zum Einfügen.
- Ton wie in yli.html: zuerst finden, worin der Kritiker recht hat; Kritik als Gefallen behandeln; kein „sorry to hear that“ (RESEARCH.md §8.10).

---

### 1. „Isn't the verifier the same model family? Then it's not independent.“

**Fakt:** Ja. Draft `gemini-3.8-flash`, Verifier `gemini-3.6-flash`, beide Google (`models.ts:114-116`). Unabhängigkeit gibt es nur im Sinn von „blind“: Der Verifier sieht Regel, Pfad, Zeile, Zitat und Diff-Hunk, aber nie Critique oder Fix des Drafts (SPEC D5). Ein zweiter Anbieter als Verifier ist geplant, nicht gebaut (ROADMAP §5 „Consortium Consistency“).

**Kern der Antwort:** zustimmen, dass „same family“ keine echte Unabhängigkeit ist. Erklären, was „blind“ hier heißt. Sagen, dass ein zweiter Anbieter auf der Roadmap steht, ohne Datum.

### 2. „AI reviewers are pure noise.“

**Fakt:**
- Nur Critical-Befunde lassen den Check scheitern, Warnungen enden als `neutral` (`check-run.ts:155-193`).
- Reviews sind immer `COMMENTED`.
- Ob der Check required ist, entscheidet der Kunde.
- Eine eigene Präzisionszahl aus echter Nutzung gibt es **nicht**.

**Kern:** Das Rauschproblem anerkennen. Den Mechanismus nennen, der es begrenzen soll. Keine Präzisionszahl erfinden, sondern ankündigen, dass sie kommt, sobald echte Daten vorliegen.

### 3. „Nondeterministic checks in CI? No thanks.“

**Fakt:**
- Deterministisch sind die 55 Detektoren sowie die Regel „Critical ⇒ failure“ selbst.
- Nicht deterministisch ist, welche Befunde das LLM findet. Temperatur 0 ist gesetzt, trotzdem streut der Recall zwischen Läufen (ROADMAP-Chronik 2026-09-29).
- Jeder Befund trägt seinen Status.

**Kern:** Genau aufschlüsseln. Nicht „same diff, same verdict“ behaupten (CONTEXT W6).

### 4. „Why not just ESLint/Semgrep plus Claude's /review?“

**Fakt:** Möglich und legitim („build vs. buy“ ist die Standardfrage, RESEARCH.md §3 Nr. 14). Was unslop zusätzlich hat:
- Regeln mit IDs und Quellen
- gleiche Engine in PR, CLI, Editor und MCP
- Blind-Pass
- Status pro Befund
- Apply-Contract für Fixes (Exact-Match/Prefix-Verify, ROADMAP-Chronik 2026-09-16)

**Kern:** Das Selbstbauen nicht kleinreden. Sagen, was man selbst nachbauen müsste.

### 5. „Why closed source?“

**Fakt:** Die Review-Pipeline hat LLM-Kosten pro Scan (UNIT_ECONOMICS, intern, keine Zahlen nennen). Die Regeltexte behandelt das Repo als IP (ROADMAP_ARCHIVE L375). **Offene Gründerentscheidung:** Regel-IDs und Quellen veröffentlichen (BRIEF.md).

**Kern:** Die Antwort steht vorab im Post, nicht erst auf Nachfrage (Lehre Stage/Zingle, RESEARCH.md §8.7).

### 6. „Your GitHub App gets write access to my repo. After the CodeRabbit exploit?“

**Fakt:**
- Rechte: `checks: write`, `pull_requests: write`, `contents: read & write`, `metadata: read`.
- `contents: write` wird nur für die GraphQL-Mutation `resolveReviewThread` gebraucht; der unslop-Code schreibt nie Repo-Inhalte (GITHUB_APP_SPEC).
- Webhooks sind HMAC-verifiziert (`timingSafeEqual`), Tokens mit AES-256-GCM verschlüsselt (`crypto.ts`).
- Ein Server-Audit vom 2026-09-28 fand 0 CRITICAL, 0 HIGH und 3 MEDIUM (SERVER_AUDIT_2026-09).

**Kern:** Rechte und Grund offen nennen. **Nur behaupten, was verifiziert ist.** Isolation der tree-sitter- und ESLint-Läufe auf fremdem Code nicht beschreiben, solange sie nicht dokumentiert ist; wenn gefragt: „Good question, I'll write it up properly rather than improvise here.“

**Vorbedingung:** Die offenen MEDIUM-Befunde M1–M3 (ROADMAP §6) sollten vor dem HN-Launch behoben sein. Vor allem M3 (Fork-PRs verbrauchen Owner-Quota) ist für öffentliche Repos relevant.

### 7. „Where's the eval? Prove it catches more than X.“

**Fakt:** Es gibt nur den internen Rule-Recall-Benchmark auf selbst gepflanzten Verstößen. Nach MARKETING_CLAIMS §0.2 wird er nicht öffentlich als Beleg genutzt.

**Kern:** Ehrlich sagen, dass es keine öffentliche Harness gibt. Beschreiben, was wir messen würden. Keine Vergleiche mit Wettbewerbern (Lehre adamsreview, RESEARCH.md §3 Nr. 5).

### 8. „What languages?“

**Fakt:** LLM-Teil nur JS/TS (`helpers.ts:381`). Pre-Scanner auch Python, Go, Java, C, Terraform, YAML u. a. (`language.ts`).

### 9. „Isn't ‘unslop’ the Hacker News filter?“

**Fakt:** Nein, das ist unslop.news („Show HN: Hacker News, Without AI“, 198 Punkte) bzw. unslop.run (RESEARCH.md §3). Ein anderes Projekt, keine Verbindung.

**Kern:** kurz und freundlich klarstellen, keine Abwertung.

### 10. „Where does my code go / GDPR?“

**Fakt:**
- Vertex AI am EU-Endpunkt, kein Training auf Kundencode.
- Gespeichert werden Befunde mit zitierten Zeilen; bei CLI/MCP auch der Diff.
- Speicherfristen sind noch nicht umgesetzt (ROADMAP §2 „Keine Speicherfristen“).

**Vorbedingung:**
- Datenschutzerklärung live.
- Frist zum Durable Caching (2026-10-14) geklärt.
- Die Speicherfristen sollten vor dem HN-Launch stehen, sonst ist die ehrliche Antwort „we keep them until you delete your account“, und das sollte stimmen.

### 11. „Pricing? Trial with a card is a dark pattern.“

**Fakt:** Pro €29/Monat, 500 Scans, 14 Tage Trial mit Karte (PADDLE_SPEC). launch-hn-Rat: „Make your pricing transparent“, „Don't use bait-and-switch tactics“ (RESEARCH.md §1.6).

**Kern:** Preis und Bedingungen im Post nennen. Der Weg ohne Konto (Demo-Repo) ist die Antwort auf „dark pattern“.

### 12. „Does it block merges automatically?“

**Fakt:** Nur, wenn der Kunde den Check als required markiert. Ein Advisory-Betrieb ist Standard: Warnungen enden neutral, und Critical macht den Check rot, blockiert aber nur mit Branch Protection (Landing-FAQ `ciSpeed`).
