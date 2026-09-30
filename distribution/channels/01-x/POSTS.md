# POSTS: X

**Wer postet:**
- Alle Posts gehen vom persönlichen Account des Gründers raus (RESEARCH.md §7.1: neue Accounts werden out-of-network gefiltert).
- Ein Marken-Account repostet und quotet nur. Das Handle `@unslop` ist vergeben (verlinkt von theunslop.app, `05-producthunt/RESEARCH.md` §3), zum Beispiel `@unslopcodes` vorher prüfen.
- Jeder Post macht klar, dass hier der Macher spricht („We're building“ / „I'm building“).

**Format:**
- Jeder Block `post` ist ein einzelner Post.
- In Threads trennt `---` die Einzelposts.
- Die Zeichenzahl ist mit `_kit/count.py` geprüft: 280 gewichtete Zeichen, URL = 23. Das Protokoll steht am Ende.

**Status-Regel:**
- In Phase A ist nichts öffentlich nutzbar. Deshalb steht in jedem Produkt-Post „private beta“, und jedes Bild trägt den Stempel.
- Roadmap steht nur in X-2 und X-L3, dort als „Next / Roadmap“ markiert und ohne Termine.

**Links:**
- Laut Algorithmus-Code 2026 gibt es keinen Link-Malus (RESEARCH.md §3). Der Link darf deshalb in den Hauptpost, sobald die Warteliste live ist.
- In Phase A steht er trotzdem im ersten Reply, damit der Hauptpost ohne Ziel-Seite funktioniert, falls die Warteliste am Posttag hakt.

---

## Phase A (HR-Eintrag bis Launch, Warteliste live)

### X-1 Intro und angepinnter Post · Medien: `visuals/x-film01-beta-16x9.mp4`

**Hook-Varianten (erste Zeile):**
1. „Your AI reviewer approved this.“ **← Empfehlung.** Identisch mit dem ersten Frame von Film 01. Beleg statt Slogan (BRIEF).
2. „The payment failed. The API said ok: true. The AI reviewer said LGTM.“
3. „Every finding we post names its rule, and every rule comes from a published study. Here's the first one: SEC-031.“
4. „A catch block, a comment that says ‘retry later’, and a 200. The bug that looks like success.“
5. „We're building a review gate for AI-written code, in public. Starting with the bug LLM reviewers are worst at.“ *(nicht empfohlen: „worst at“ ist mit N = 1 Modell nicht belegt, siehe CONTEXT C2)*

```post
Your AI reviewer approved this.

The payment failed. The catch swallowed it. The handler returned ok: true.

I'm building unslop, a review gate for AI-written code. Its rule SEC-031 (critical) targets exactly this, with a fix on the PR.

Private beta. Build log below.
```

**Erster Reply (Autor, direkt danach):**

```post
How it decides:
- 119 rules from published research
- 55 have a deterministic detector
- the rest: an LLM reviewer (JS/TS for now); each finding says how it was verified
- only critical findings fail the check

The demo code is example data. Waitlist: unslop.codes
```

---

### X-2 Build-Log #1: was läuft, was als Nächstes kommt (Roadmap-Thread) · Medien: `visuals/x-status-board.png` am ersten Post

```post
Build log #1 for unslop, a review gate for AI-written code.

Private beta. Nothing is publicly installable yet.

What runs today, what doesn't, and what's next. No dates, because I don't have honest ones.
---
Runs today, in the private beta:
- GitHub App: check run + PR comments with a 1-click fix
- CLI: unslop scan, with --fix and --dry-run
- VS Code: findings inline, "Apply Gatekeeper Fix"
- MCP server for coding agents, 5 tools

One engine behind all four.
---
The part I'm most careful about:

119 rules, each from a published study. 55 have a deterministic detector. The rest are checked by an LLM reviewer (JS/TS only for now) and, on the standard route, a blind verifier.

The output tells you which kind of check produced a finding.
---
What doesn't exist yet: failing a check because a revision got worse than the previous push.

Today every push gets its own review, and one critical finding fails it. Comparing revisions is next.
---
Also on the roadmap, planned and not built:
- integrity trend per repo over time
- a second model vendor as verifier, so a finding isn't confirmed by the model family that wrote it
- a signed certificate per commit SHA: which rules were checked, what passed
---
If you review AI-written PRs for a living: what should a gate like this never do?

Replies go straight into the spec.
```

> **Faktencheck zu Post 3, „The output tells you which kind of check produced a finding“:** Im Code setzt der Pre-Scanner `verification: 'deterministic'`, LLM-Findings bekommen `confirmed`/`uncertain`/`self_reported`/`unverified`, und die Tagline in CLI, Extension und GitHub-Block zählt das aus (ROADMAP Chronik 2026-09-17). Die Aussage ist also belegt.

---

### X-3 Forschung und eine Korrektur in eigener Sache · Medien: `visuals/x-study-aira.png` an Post 3

**Vorbedingung:** Die Landing-H1 (W1) muss vorher geändert sein. Sonst entfällt der Post, oder Post 1 wird zu „Our landing page says …, and we're changing it this week.“

**Hook-Varianten:**
1. „Our landing page said an AI reviewer misses 44× more bugs than a parser. I re-read the paper. We're not leading with that anymore.“ **← Empfehlung:** öffentliche Selbstkorrektur, auf X selten und glaubwürdig (RESEARCH.md §5)
2. „The most quoted number in our own pitch was the weakest one in the paper.“
3. „1.80×: the number from the AIRA paper that holds up.“

```post
Our landing page said an AI reviewer misses 44× more bugs than a parser.

I re-read the paper. We're not leading with that anymore. Here's why, and the number from the same paper that does hold up.
---
The 44:1 is from AIRA (arXiv 2604.17587). A cloud LLM evaluator produced findings at a 44:1 ratio below a deterministic scanner.

The author calls it a secondary, exploratory finding: one model, one codebase. That's not a headline.
---
The stronger result in the same paper: a 955-vs-955 matched-control study.

AI-attributed files: 0.435 high-severity findings per file. Human controls: 0.242. A 1.80× excess, same direction in JS, Python and TypeScript.
---
In the paper's pilot study, the clearest signal sat in exception-handling patterns.

In our rules, a swallowed error that returns success is SEC-031. It's the first finding in every unslop demo.
```

---

### X-4 „Just regenerate it“ · Medien: `visuals/x-film02-beta-9x16.mp4` (A/B gegen das 16:9 aus X-1)

**Hook-Varianten:**
1. „‘Just regenerate it’ has a measured cost.“ **← Empfehlung**
2. „Asked to improve the same code 10 times, an LLM made it less secure.“
3. „Regenerate is the most dangerous button in your editor.“ *(nicht empfohlen: Superlativ, nicht belegt)*

```post
"Just regenerate it" has a measured cost.

One study had GPT-4o "improve" the same code 10 times. Average vulnerabilities per sample: 2.1 in the first iterations, 4.7 in 3–7, 6.2 in 8–10. Even prompts asking for security added new ones.

arXiv 2506.11022
```

**Erster Reply:**

```post
What unslop does about it today (private beta): every push gets its own review, and a critical finding fails the check.

What it doesn't do yet: compare a revision against the previous one. That's on the roadmap.

Chart and method notes: 👇
```

Reply 2: das Bild `visuals/x-study-erosion.png`, ohne Text oder mit „400 samples, 4 prompting strategies. Significant between early and late iterations, not between adjacent ones.“

---

### X-5 Was die CLI wirklich ausgibt · Medien: `visuals/x-cli-output.png`

```post
What unslop scan prints when your diff swallows an error.

Real formatter output, example data. Private beta.
```

**Erster Reply:**

```post
And when it didn't review anything, it says so:

"Nothing was reviewed — this is NOT a clean verdict."

A green check that wasn't earned is its own kind of slop.
```

---

### X-6 Frage ohne Link (Replies, keine Werbung)

```post
What's the last bug an AI reviewer approved in your codebase?

Asking because I'm building a gate for exactly that, and real cases beat the ones I make up.
```

Keine Medien, kein Link. Antworten mit echten Fällen bedanken und nachfragen. Nicht mit dem Produkt antworten, außer jemand fragt direkt.

---

## Phase B (Launch-Tag L: Signup offen, npm und Marketplace publiziert)

### X-L1 Launch · Medien: `visuals/x-film03-launch-16x9.mp4`

**Vorbedingung:** `npm view @unslopcodes/cli version` liefert eine Version. Signup ist offen. Die Warteliste hat die Launch-Mail bekommen (WAITLIST_SPEC §8, Phase 1b).

**Hook-Varianten:**
1. „Don't push it yet.“ **← Empfehlung:** erster Frame von Film 03, ab L live und ausprobierbar
2. „unslop is public today: one command before you push.“
3. „The review gate for AI-written code I've been building in public is out.“

```post
Don't push it yet.

npm i -g @unslopcodes/cli
unslop scan

It checks your diff against 119 rules from published research and suggests fixes. The GitHub App runs the same checks on every PR.

Public today. unslop.codes
```

**Erster Reply** (Preis nur, wenn Paddle live ist, sonst die Zeile weglassen):

```post
What you get today:
- CLI, VS Code extension, GitHub App, MCP server
- 55 deterministic rules, the rest via an LLM reviewer (JS/TS)
- each finding says how it was verified
- only critical findings fail the check

Pro: €29/month, 14-day trial. Limits and FAQ on the site.
```

> **Nicht schreiben:** `npx unslop`. Das unscoped Paket gehört einem Dritten (CONTEXT §1).

### X-L2 So funktioniert es und wo die Grenzen liegen (Thread, am Launch-Tag +3 h)

```post
How unslop works, and where it doesn't (yet). A short thread for the people who asked in the build logs.
---
1. A deterministic pre-scanner runs first: 55 rules via regex, tree-sitter, ESLint, config and registry checks, across ~25 file types. No model involved.
---
2. JS/TS files also go to an LLM reviewer. On the standard route, each claimed finding gets a blind second pass by a model call that doesn't see the first one's reasoning. Each finding says how it was verified.
---
3. The PR check fails only on a critical finding. Warnings conclude as neutral and never block a merge. Whether the check is required is your branch-protection call.
---
4. Limits, plainly: the LLM review covers JS/TS only for now. Nothing blocks 100% of AI vulnerabilities. And if a scan couldn't review anything, it says so instead of showing a green check.
```

> **Faktencheck zu Post 2:** „blind second pass … doesn't see the first one's reasoning“ entspricht dem Blind-Verifier (SPEC.md, `claim-verifier-step.ts`). Einschränkung: Die Route `pro-direct` überspringt ihn. Die Tagline sagt dann „self-reported, no blind re-verification“, deshalb stimmt der Satz „The output says per finding how it was verified“.

### X-L3 Was als Nächstes kommt (Roadmap nach dem Launch, L + 7 Tage) · Medien: `visuals/x-status-board.png` (Stempel links vorher auf „Live“ umstellen, siehe LAUNCH.md)

```post
unslop has been public for a week. Next, no dates:

- fail a check when a revision gets worse than the last push
- integrity trend per repo
- a second model vendor as verifier
- a signed certificate per commit SHA

All planned, none built. Which one would you use first?
```

---

## Reply-Bausteine (von Hand anpassen, nie automatisiert posten; RESEARCH.md §1.2)

Die ausführlichen Antworten stehen in `FAQ.md`. Kurzformen für X:

- **„Isn't this just another LLM wrapper?“** → „Partly LLM, and I won't pretend otherwise: 55 of 119 rules have a deterministic detector, the rest go through an LLM reviewer and, on the standard route, a blind verifier. The output labels which is which.“
- **„How is this different from CodeRabbit/Greptile/Bugbot?“** → „I'd rather not score other tools. What unslop does: every finding cites a rule traced to a published study, critical ones fail the check, and it tells you when it didn't check something.“
- **„When can I try it?“** (Phase A) → „Not publicly yet, no date I can promise. The waitlist gets one mail when the beta opens: unslop.codes“
- **„Source for 2.1 → 6.2?“** → „arXiv 2506.11022, §IV: GPT-4o, 10 improvement rounds, average vulnerabilities per sample by iteration group. Significant between early and late iterations, not between adjacent ones. One model, so treat it as a signal, not a law.“

---

## Zeichenprotokoll (`python3 _kit/count.py 01-x/POSTS.md x`)

Siehe `TODO.md` im Kanalordner. Stand der letzten Prüfung: alle Posts ≤ 280.
