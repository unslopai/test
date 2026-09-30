# FAQ: LinkedIn (Einwände von CTOs und Engineering-Leitungen)

**So ist die Datei gedacht:**
- Die Antworten sind Vorlagen für **handgeschriebene** Kommentare. Kommentar-Tools, Browser-Erweiterungen und KI-Kommentare sind laut LinkedIn verboten bzw. werden gedrosselt (RESEARCH.md §1.1, §3.1).
- Kommentare haben höchstens 1.250 Zeichen.
- Zu jeder Frage gibt es eine EN-Fassung und eine DE-Kurzform. Zahlen und Status stammen aus `../CONTEXT.md`.

---

### 1. „Why not SonarQube, Semgrep or CodeQL? We already have SAST.“

**EN:** „Keep them. unslop is meant to sit next to SAST, not replace it. The difference is the target: failure patterns that research found in AI-written code (swallowed errors, invented APIs, tests without assertions), each rule traced to a study, with the rule ID and a suggested fix on the PR. Where a rule can be checked mechanically, it is: 55 of 119 rules have a deterministic detector.“

**DE:** „Behalten Sie sie. unslop ergänzt SAST, statt es zu ersetzen. Der Fokus liegt auf Fehlermustern, die Studien in KI-Code gefunden haben. Jede Regel ist einer Studie zugeordnet, und am PR stehen Regel-ID und Fix-Vorschlag.“

**Nicht sagen:** Vergleichszahlen zu Wettbewerbern (MARKETING_CLAIMS §0.3).

---

### 2. „How do you know it works? What's your detection rate?“

**EN:** „We run an internal benchmark with violations we planted ourselves, so I won't sell its numbers as proof of real-world performance. The research figures in the post are third-party studies about AI code, not about unslop. Real-world rates come once there's real usage, and we'll publish how we measured them.“

**DE:** „Wir messen intern mit selbst gepflanzten Verstößen. Diese Zahlen verkaufen wir nicht als Beleg für den Praxiseinsatz. Die Forschungszahlen im Post sind Studien Dritter, keine Messung von unslop.“

**Beleg:** MARKETING_CLAIMS §0.2 („never ‘we measured’“), CONTEXT §4b.

---

### 3. „Who decides what's ‘critical’? A model?“

**EN:** „For the 55 rules with a deterministic detector, the rule does. For findings from the LLM review, the model proposes the severity, and a separate blind verification pass checks the claim on the standard route. Each finding shows how it was verified. Only critical findings fail the check, and whether the check is required is your branch-protection call.“

**DE:** „Bei den 55 deterministischen Regeln entscheidet die Regel. Bei LLM-Befunden schlägt das Modell die Schwere vor, und ein getrennter, blinder Prüfschritt kontrolliert den Befund. Jeder Befund zeigt, wie er verifiziert wurde.“

**Belege:**
- `reviewer-call.ts:231-233` (Modell-Severity)
- `claim-verifier-step.ts`
- CONTEXT W3: nie „the AI never decides“

---

### 4. „Where does our code go? GDPR, DPA?“

**EN:** „Inference runs on Google Vertex AI on the EU endpoint, and Google doesn't train on it. We store findings with the quoted lines as your scan history, and for CLI and MCP scans the submitted diff. CLI and editor scans filter secrets on your machine before upload. The privacy policy is public before signup opens; a DPA is in preparation.“

**DE:** „Die Modelle laufen auf Vertex AI am EU-Endpunkt, ohne Training auf Ihren Daten. Wir speichern Befunde mit den zitierten Zeilen als Scan-Historie, bei CLI- und MCP-Scans auch den Diff. Die Datenschutzerklärung ist vor der Registrierung öffentlich, ein AVV ist in Vorbereitung.“

**Vorbedingung:** Erst so beantworten, wenn `/en/privacy` live ist. Bis dahin: „The privacy policy goes live before anyone can sign up.“ Die Frist 2026-10-14 zum Durable Caching (ROADMAP §0) muss vorher geklärt sein.

---

### 5. „Will it slow down our PR flow?“

**EN:** „It runs as its own GitHub check, parallel to CI, with a hard cap of 300 seconds. Warnings never block. If the service fails, the check closes with the reason instead of hanging.“

**DE:** „Ein eigener GitHub-Check, parallel zur CI, hart begrenzt auf 300 Sekunden. Warnungen blockieren nie. Fällt der Dienst aus, schließt der Check mit Begründung, statt hängen zu bleiben.“

**Belege:**
- FAQ `ciSpeed`/`outage` der Landing
- `deadline.ts`
- `job-failure.ts`

---

### 6. „When does the certificate ship? Will auditors accept it?“

**EN:** „It's on our roadmap, not built, and there's no date I'd stand behind. I also can't claim any auditor accepts it. That's exactly why I'm asking what it would need to show. What we won't do is certify code as bug-free.“

**DE:** „Es steht auf der Roadmap, gebaut ist es nicht, und einen Termin nenne ich nicht. Ob Prüfer es akzeptieren, kann ich nicht behaupten. Genau deshalb frage ich, was es zeigen müsste.“

**Nicht sagen:** Supply-Chain-Pflicht, „your vendors will need it“, Banken/VCs als Abnehmer (CONTEXT §5).

---

### 7. „What does it cost? Is there a team plan?“

**EN (Phase A):** „Pricing will be public before anyone pays. Team plans are planned, not priced.“

**EN (Phase B, nur mit Paddle live):** „Pro is €29/month with 500 scans and a 14-day trial. Plans for heavier usage and for teams are planned.“

**DE:** „Pro: 29 €/Monat, 500 Scans, 14 Tage Testphase. Pläne für Teams sind geplant, Preise dafür gibt es noch nicht.“

---

### 8. „Which languages?“

**EN:** „The LLM review covers JS/TS today. The deterministic pre-scanner also reads Python, Go, Java, C, Terraform and YAML, among others, for its rules. We'll extend the LLM lane once we've measured what it costs.“

**DE:** „Der LLM-Review deckt heute JS/TS ab. Der deterministische Pre-Scanner liest weitere Sprachen, zum Beispiel Python, Go, Java und Terraform, für seine Regeln.“

---

### 9. „You criticise AI grading AI, but you use an LLM yourself.“

**EN:** „Fair. Two differences we can show: rules that can be checked mechanically are, and every LLM finding is labelled with how it was verified, including when it wasn't. We'd rather show that label than claim the model never decides.“

**DE:** „Berechtigt. Mechanisch prüfbare Regeln prüfen wir mechanisch, und jeder LLM-Befund zeigt, wie er verifiziert wurde, auch wenn er es nicht wurde.“

---

### 10. „Why trust a pre-launch startup with this?“

**EN:** „You shouldn't have to take our word for it. That's the point of rule IDs, sources and a visible verification status. Until the public launch, access is closed.“

**DE:** „Sie sollen uns nicht aufs Wort glauben müssen. Dafür gibt es Regel-IDs, Quellen und einen sichtbaren Prüfstatus. Bis zum Launch ist der Zugang geschlossen.“

**Hinweis:** Keine Nutzerzahlen oder Kundennamen nennen. Es gibt keine zahlenden Kunden (ROADMAP_ARCHIVE L411) und keine Testimonials.
