# POSTS: LinkedIn

**Wer postet:**
- Alle Posts gehen vom persönlichen Profil des Gründers raus (RESEARCH.md §8.1). Die Company Page teilt nur.
- Die Headline des Gründers nennt das Thema, zum Beispiel „Building unslop · quality gates for AI-written code“, weil Autor-Headline und -Firma ins Ranking einfließen (RESEARCH.md §3.1).

**Format:**
- Jeder Block `post` ist ein Post. Grenze 3.000 Zeichen.
- Der Hook, also der erste Satz, bleibt unter 140 Zeichen (mobiles „…mehr“, sekundär belegt, RESEARCH.md §2).
- Geprüft mit `_kit/count.py 02-linkedin/POSTS.md linkedin`; Hook-Längen stehen in `CHECK.md`.

**Links:**
- Ein Post trägt entweder Link-Vorschau oder Bild/Dokument/Video, nicht beides (RESEARCH.md §2). Links gehören deshalb in den ersten eigenen Kommentar.
- Hashtags höchstens zwei. Sie sind „a nice to have“, kein Muss (RESEARCH.md §2).

**Status-Regel:**
- In Phase A ist nichts öffentlich nutzbar. Deshalb steht „private beta“ im Text, und jedes Bild trägt den Stempel.
- Roadmap wird immer als „on our roadmap / planned / not built“ benannt (CONTEXT §5).

---

## Phase A (HR-Eintrag bis Launch, Warteliste live)

### L-1 Dokument-Post „Quality gates for AI-written code“ (EN) · Anhang: `visuals/li-carousel-quality-gates.pdf`

Dokumenttitel beim Upload: „Quality gates for AI-written code: what we can check today, and what we're building“

**Hook-Varianten:**
1. „In a 955-vs-955 matched-control study, AI-attributed files had 1.80× more high-severity findings per file than human code.“ (122 Zeichen) **← Empfehlung:** konkrete Zahl mit belastbarer Quelle (CONTEXT C1, RESEARCH.md §8.5)
2. „We're building a quality gate for AI-written code. Here's what it checks today, where it stops, and what's next.“ (111)
3. „If one model writes the code and another approves it, what did your quality gate actually check?“ (96) *Gute Frage, aber keine Zahl; eher für L-4*
4. „Most AI code review tools tell you what they found. Fewer tell you what they didn't check.“ (89) *Nicht empfohlen: Aussage über andere Tools, nicht belegt*

```post
In a 955-vs-955 matched-control study, AI-attributed files had 1.80× more high-severity findings per file than human code.

That's the problem we work on at unslop: a quality gate for AI-written code that an engineering leader can inspect, not just trust.

The document is our build log, 8 pages:

- Two research results, each with its source. Third-party studies, not our own benchmark.
- What the gate does today in our private beta: a check on every pull request. One critical finding fails it, warnings never block a merge, and every finding names its rule and a suggested fix.
- Where it stops: 55 of our 119 rules have a deterministic detector. The LLM review covers JS/TS only. It doesn't compare revisions yet.
- Two things on our roadmap, marked as concepts: an integrity trend per repository, and a signed record per commit SHA that lists which rules ran and what passed.

A question for CTOs and heads of engineering: what would that record need to show before you'd rely on it in an audit or a due diligence?

I read every comment. The answers go into the spec.
```

**Erster Kommentar (Autor, direkt nach dem Posten):**

```post
Sources:
AIRA, matched-control replication (Study 3): https://arxiv.org/abs/2604.17587
Iterative refinement and security, GPT-4o: https://arxiv.org/abs/2506.11022

Private beta, EU inference (Google Vertex AI, EU endpoint). Waitlist, one email when the beta opens: https://unslop.codes
```

---

### L-2 Dokument-Post (DE, eigenständig) · Anhang: `visuals/li-carousel-quality-gates-de.pdf`

Dokumenttitel: „Quality Gates für KI-Code: was heute prüfbar ist und was wir bauen“

**Hook-Varianten:**
1. „In einer Studie mit je 955 Dateien hatte KI-zugeordneter Code 1,80-mal so viele schwerwiegende Befunde pro Datei wie menschlicher.“ (129) **← Empfehlung**
2. „Wir bauen ein Quality Gate für KI-Code. Hier steht, was es heute prüft, wo es aufhört und was als Nächstes kommt.“ (113)
3. „Wer KI Code schreiben lässt, braucht ein Gate, dem man nachprüfen kann, was es geprüft hat.“ (91)

```post
In einer Studie mit je 955 Dateien hatte KI-zugeordneter Code 1,80-mal so viele schwerwiegende Befunde pro Datei wie menschlicher.

Daran arbeiten wir bei unslop: ein Quality Gate für KI-Code, das eine Engineering-Leitung nachprüfen kann, statt ihm glauben zu müssen.

Das Dokument ist unser Build-Log auf acht Seiten:

- Zwei Forschungsergebnisse mit Quelle. Studien Dritter, kein eigener Benchmark.
- Was das Gate heute in der Private Beta tut: ein Check an jedem Pull Request. Ein kritischer Befund lässt ihn scheitern, Warnungen blockieren nie einen Merge, und jeder Befund nennt seine Regel und einen Fix-Vorschlag.
- Wo es aufhört: 55 unserer 119 Regeln haben einen deterministischen Detektor. Der LLM-Review liest vorerst nur JS/TS. Revisionen vergleicht es noch nicht.
- Zwei Punkte auf unserer Roadmap, als Konzept gekennzeichnet: ein Integritäts-Trend pro Repository und ein signierter Nachweis pro Commit-SHA, welche Regeln liefen und was bestanden hat.

Zur Datenverarbeitung: Die Modelle laufen auf Google Vertex AI am EU-Endpunkt.

Eine Frage an CTOs und Engineering-Leitungen: Was müsste so ein Nachweis zeigen, damit Sie sich in einem Audit oder einer Due Diligence darauf stützen würden?
```

**Erster Kommentar:**

```post
Quellen:
AIRA, Matched-Control-Replikation (Studie 3): https://arxiv.org/abs/2604.17587
Iterative Verbesserung und Sicherheit, GPT-4o: https://arxiv.org/abs/2506.11022

Warteliste, eine E-Mail, wenn die Private Beta öffnet: https://unslop.codes
```

---

### L-3 Text + Bild: wann ein Gate blockieren darf · Bild: `visuals/li-04-today.png`

**Hook-Varianten:**
1. „Our gate fails a pull request for one reason only: a critical finding. Here's why warnings never block a merge.“ (111) **← Empfehlung**
2. „A quality gate that blocks on everything gets switched off. So ours blocks on one thing.“ (86) *Erster Satz ist eine Meinung, nicht belegt, deshalb 2. Wahl*
3. „What should fail a pull request when half of it was written by an AI?“ (69) *„Half“ ist nicht belegt, nicht verwenden*

```post
Our gate fails a pull request for one reason only: a critical finding. Here's why warnings never block a merge.

In the unslop private beta, every pull request gets a GitHub check called "Anti-Slop Gatekeeper". It ends in one of three states:
- failure, if at least one finding is critical
- neutral, if there are only warnings
- success, if there is nothing to report

Each finding lands as a review comment with its rule ID, a short explanation and, where we can produce one, a one-click fix. SEC-031, in the image, is a swallowed error that returns success.

Why only critical findings block: if a gate fails pull requests over style, a team has every reason to switch it off, and then it catches nothing. Whether the check is required at all stays your branch-protection decision, not ours.

What I'd like to learn from engineering leads: which classes of findings would you let block a merge in your org, and which would you only want to see?
```

**Erster Kommentar:**

```post
The check titles and comment format in the image are the product's real strings. The code and the finding are example data. Waitlist: https://unslop.codes
```

---

### L-4 Roadmap-Diskussion: Nachweis pro Commit · Bild: `visuals/li-07-roadmap-record.png`

**Hook-Varianten:**
1. „We're designing a signed record per commit: which rules ran on the code and what passed. It isn't built yet, and I'd like CTOs to shape it.“ (138) **← Empfehlung:** Roadmap-Post, schon im ersten Satz als nicht gebaut erkennbar
2. „What should a ‘certificate’ for AI-written code certify? Probably less than you'd think.“ (86)
3. „‘Certified bug-free’ is a claim no tool can make. ‘Checked against these rules, and this passed’ is one we can.“ (108)

```post
We're designing a signed record per commit: which rules ran on the code and what passed. It isn't built yet, and I'd like CTOs to shape it.

The idea, on our roadmap: for a given commit SHA, the record lists
- which rules were checked, and which of them by a deterministic detector
- critical findings and warnings, and which ones a human accepted
- files that were not reviewed, and why
- a signature, so the record can't be edited after the fact

What it would never say: that the code is bug-free. No tool can honestly claim that, and a record that did would be worthless in an audit.

Where I'm unsure and would value your view:
1. Who needs to trust it: your auditors, your customers, an acquirer, or your own board?
2. Should a human override be allowed on the record, or only next to it?
3. Per commit, or per release?

The image is a concept sketch with example data. Today, in the private beta, the gate runs a check on every pull request. The record is the next layer, not a promise with a date.
```

**Erster Kommentar:**

```post
Background on what runs today and where it stops: an 8-page build log is in my previous post. Waitlist: https://unslop.codes
```

---

### L-5 Natives Video · Datei: `visuals/li-film01-beta-4x5.mp4`

LinkedIn stuft Videos herab, die mit dem Text nichts zu tun haben (Jurka, RESEARCH.md §3.1). Der Text beschreibt deshalb genau, was der Film zeigt.

**Hook-Varianten:**
1. „An AI reviewer approved a handler that swallows a failed payment and returns ok: true. 30 seconds on what our gate does with it.“ (129) **← Empfehlung**
2. „The bug that looks like success: a catch block, a comment, and a 200.“ (70)
3. „Your AI reviewer approved this.“ (31) *Stärker auf X; auf LinkedIn fehlt ohne Kontext der Bezug*

```post
An AI reviewer approved a handler that swallows a failed payment and returns ok: true. 30 seconds on what our gate does with it.

What you see, in order:
- an example handler whose catch block hides the failure
- a research result: in the AIRA paper (arXiv 2604.17587), a cloud LLM evaluator produced findings at a 44:1 ratio below a deterministic scanner. The author calls it an exploratory comparison with one model on one codebase, so read it as a signal, not a law.
- the check run failing on SEC-031, the rule for errors that are silently swallowed
- the review comment with the rule, the explanation and a one-click fix

This runs in our private beta. The code in the film is example data.
```

**Erster Kommentar:**

```post
The 44:1 comes from §5.5 of https://arxiv.org/abs/2604.17587. The stronger result in the same paper: 1.80× more high-severity findings per file in AI-attributed code (955 vs. 955 files). Waitlist: https://unslop.codes
```

---

### L-6 Korrektur in eigener Sache (nur Text) · Vorbedingung: Landing-H1 geändert (CONTEXT W1)

**Hook-Varianten:**
1. „Our landing page led with ‘Your AI reviewer misses 44× more bugs than a parser.’ We've changed it. Here's why.“ (107) **← Empfehlung**
2. „The most quoted number in our pitch turned out to be the weakest one in the paper.“ (82)

```post
Our landing page led with "Your AI reviewer misses 44× more bugs than a parser." We've changed it. Here's why.

The 44 comes from the AIRA paper (arXiv 2604.17587). In it, a cloud LLM evaluator produced findings at a 44:1 ratio below a deterministic scanner. The author labels that a secondary, exploratory comparison: one model, one codebase, and a repository-level run that was truncated.

That's an interesting signal. It isn't a headline, and "misses 44× more bugs" said more than the paper does.

The same paper has a stronger result: in a matched-control replication with 955 AI-attributed and 955 human files, the AI-attributed files had 0.435 high-severity findings per file versus 0.242. That's the number we lead with now.

We sell a gate against confident claims without evidence. Our own copy has to pass the same test.
```

---

## Phase B (Launch-Tag L)

### L-L1 Launch (EN) · Video: `visuals/li-film03-launch-4x5.mp4`

**Vorbedingung:** `npm view @unslopcodes/cli version` liefert eine Version, Signup offen, Marketplace live. Preise nur mit Paddle live.

**Hook-Varianten:**
1. „unslop is public today: a quality gate for AI-written code, in your terminal, your editor and on every pull request.“ (116) **← Empfehlung**
2. „After months in private beta, the review gate for AI-written code we've been building is open to everyone.“ (106) *„months“ nur, wenn es stimmt*
3. „One command before you push: npm i -g @unslopcodes/cli“ (54)

```post
unslop is public today: a quality gate for AI-written code, in your terminal, your editor and on every pull request.

What you can use now:
- CLI: npm i -g @unslopcodes/cli, then unslop scan before you push
- VS Code extension: findings inline, "Apply Gatekeeper Fix"
- GitHub App: a check on every pull request. One critical finding fails it, warnings never block
- MCP server for coding agents

119 rules from published research. 55 have a deterministic detector; the rest go through an LLM reviewer, JS/TS for now, and every finding says how it was verified. Inference runs on Google Vertex AI, EU endpoint.

What's next is on our roadmap, without dates: an integrity trend per repository and a signed record per commit.

Thank you to everyone who commented on the build logs. Several of your answers are now in the spec.
```

**Erster Kommentar:**

```post
Start here: https://unslop.codes
Pro: €29/month, 500 scans, 14-day trial. Plans for teams are planned, not priced yet.
```

> Die letzte Zeile nur posten, wenn Paddle live ist und der Preis dort steht. Sonst: „Pricing is on the site.“ Den Satz „Several of your answers are now in the spec“ nur behalten, wenn er zutrifft.

### L-L2 Launch (DE, eigenständig) · Video: `visuals/li-film03-launch-4x5.mp4`

```post
unslop ist ab heute öffentlich: ein Quality Gate für KI-Code, im Terminal, im Editor und an jedem Pull Request.

Was Sie jetzt nutzen können:
- CLI: npm i -g @unslopcodes/cli, dann vor dem Push unslop scan
- VS-Code-Erweiterung: Befunde direkt im Code, Fix per Klick
- GitHub App: ein Check an jedem Pull Request. Ein kritischer Befund lässt ihn scheitern, Warnungen blockieren nie
- MCP-Server für Coding-Agents

119 Regeln aus veröffentlichter Forschung. 55 haben einen deterministischen Detektor, den Rest prüft ein LLM-Reviewer (vorerst JS/TS), und jeder Befund zeigt, wie er verifiziert wurde. Die Modelle laufen auf Google Vertex AI am EU-Endpunkt.

Auf der Roadmap, ohne Termin: ein Integritäts-Trend pro Repository und ein signierter Nachweis pro Commit.
```

**Erster Kommentar:** „Start: https://unslop.codes“, plus die Preiszeile auf Deutsch, nur bei Paddle live: „Pro: 29 €/Monat, 500 Scans, 14 Tage Testphase.“
