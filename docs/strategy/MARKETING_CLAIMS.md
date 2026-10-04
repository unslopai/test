# MARKETING_CLAIMS.md — Evidence-Backed Copy for the Landing Page

> **Purpose**: Source-of-truth claim inventory for the Landing Page build (ROADMAP §2 "Landing Page (Greenfield)").
> Every number below is extracted from the Evidence-Based Golden Database
> (`Golden_Database__-_Tabellenblatt1.csv`, 119 rules) and carries the originating study.
> **Nothing on the landing page may cite a number that is not in this file.**

---

## 00. Claim Policy since 2026-09-30 (supersedes §0–§8 for all new copy)

**Founder decision, 2026-09-30.** We stop selling with third-party study numbers. The papers behind §2–§8 mostly measure models nobody codes with anymore (GPT-4o era). On Hacker News "that's a GPT-4o study" ends the discussion, and the 2026-09-29 fact-check (`distribution/channels/CONTEXT.md` §6, W1–W19) found that almost every number problem on the landing page came from paper citations. The problem itself needs no proof: every developer who ships AI-written code has watched it look right and break.

**What we use instead, in this order:**

1. **Show, don't claim.** A real diff, the finding with its rule ID, the one-line explanation, the fix. Screenshots and films show actual product output, never mock-ups presented as real (concept visuals stay visibly marked as concept).
2. **Explain the mechanism.** Which part of the verdict is deterministic, which part comes from a model, that a second model re-checks blind, what happens when a stage is skipped. Skeptical engineers trust a checkable process more than a statistic.
3. **Our own measurements, always with context.** Allowed only with method, date, model and the caveat in the same place, and linked to the source (`docs/benchmarks/RULE_RECALL_BENCHMARK.md`). Example: "125 of 126 planted violations found, 0 false positives on clean controls (rule-recall benchmark, Gemini 3.8, 2026-09-16; planted fixtures, not customer repos)". Never round up, never drop the caveat.
4. **Problem framing from everyday experience, without numbers.** "Looks fine in review, breaks in production" needs no citation.

**What stays forbidden:**

- Third-party study numbers in the hero, stat band, headlines, ads, social posts, motion films or product UI. Papers may appear only in long-form blog or research pages as background, each with model name and publication date next to the number.
- Any claim, with or without a number, that the code or live system does not back. German law (UWG §5) makes misleading advertising actionable; "no numbers" does not mean "no evidence". Before a claim ships, it is checked against the code and, where possible, a live receipt.
- Everything in the forbidden list of §0 below (100 % claims, competitor numbers, wrong rule counts, unearned compliance claims).
- Claims about unbuilt features presented as current (e.g. W2 "If quality drops, the build fails"). Planned features appear only as clearly marked concept.

**Status of the rest of this file:** §0–§8 below are an archive of the study-based approach (2026-07). They are no longer a source for new headlines, stat bands or posts. The paper references remain useful background for long-form writing under the rules above.

**Where this must be applied (ROADMAP §10, "Landing, Distribution und Motion auf Claim-Policy 2026-09-30"):** the landing page (`messages/{en,de}.json`, marketing components), the distribution channel packages (`distribution/channels/`), the motion films (`distribution/motion/`), `docs/seo/` guidance.

---

## 0. Fact Discipline (archived 2026-09-30, see §00; the forbidden list still applies)

We sell an anti-hallucination product. One fabricated stat on our landing page and the product is dead.

1. **Every claim ships with its receipt.** Each stat below carries the arXiv/DOI identifier and the Golden DB rule ID. On the page, stats link to a footnote block ("Sources").
2. **These are third-party, peer-reviewed/preprint findings about LLM-generated code and LLM judges in general** — not benchmarks of our product, and not benchmarks of any named competitor. Copy may say "the research shows", never "we measured" (until we have our own telemetry study).
3. **Forbidden claims** (would be slop of our own making):
   - "Blocks 100% of AI vulnerabilities" — nothing does; our own DB documents coverage gaps.
   - Naming a competitor and attaching a study number to them.
   - "126 rules" — the database contains **119** rules. (The 126 figure in an old commit message is wrong.)
   - Any uptime/SOC2/compliance claim not yet contractually true.

---

## 1. Positioning Statement (internal north star)

**Most "AI code review" tools ask a second LLM to grade the first LLM's homework. The research verdict on that architecture is in, and it is brutal: a probabilistic judge misses up to 44x more issues than a deterministic scanner, and cannot be trusted as a pass/fail gate. Unslop is built the other way around: 119 evidence-based rules, each enforced by deterministic AST/static analysis — with LLMs demoted to what they're actually good at: explaining findings that were already mechanically proven.**

One-line version:

> **The only AI code gate that doesn't ask an AI whether the AI was wrong.**

---

## 2. Hero Section — Candidates

**H1 options:**

1. **"Your AI reviewer misses 44x more bugs than a parser."**
   Sub: A cloud LLM re-scanned the exact same files as a deterministic AST scanner — and found 44x fewer issues. We built the gate on the scanner, not the vibes. *(AIRA, arXiv 2604.17587 → PROC-001)*

2. **"LLM judges grade their own homework. We audit it."**
   Sub: When the same model writes the code and the tests, real defect detection drops from 81.6% to 63.8%. Independence isn't a feature — it's the whole point. *(arXiv 2605.22175 → TEST-006)*

3. **"AI code ships 1.8x more high-severity flaws. Yours is no exception."**
   Sub: A 955-vs-955 matched-control study. Not a hot take — a measurement. *(AIRA, arXiv 2604.17587 → SEC-031)*

**Recommended pairing**: H1 #1 (the 44x number is the sharpest single fact we own) with the stat band below.

---

## 3. The Stat Band (numbers under the hero)

| Stat | Caption | Source → Rule |
|---|---|---|
| **44x** | fewer issues found by an LLM judge vs. a deterministic AST scan of the same files | arXiv 2604.17587 → PROC-001 |
| **1.80x** | more high-severity findings per file in AI code vs. matched human code | arXiv 2604.17587 → SEC-031 |
| **2.1 → 6.2** | vulnerabilities per sample after repeated "improve this code" rounds — security *erodes* monotonically (p ≪ 0.001, η² = 0.42) | arXiv 2506.11022 → PROC-002 |
| **27%** | of cases where LLM "self-correction" actually made code more secure | arXiv 2506.11022 → PROC-001/002 |
| **96.2% vs 63.7%** | test pass rate vs. real defect detection — the coverage illusion, measured on a frontier model | arXiv 2605.22175 → TEST-005 |
| **119** | evidence-based rules, every one enforced deterministically | Golden Database |

---

## 4. Pillar 1 — "The judge is compromised" (why LLM-as-judge is a security risk)

**Section header:** *An LLM cannot be your CI gate. This is now a measured result, not an opinion.*

Copy block:

> Three independent research tracks reached the same verdict. A deterministic API-existence
> oracle achieves **precision 1.00**; an LLM judge on the same task manages **0.50–0.67** — a
> coin flip with confidence. On smart contracts, GPT-4 and Claude identified the vulnerability
> class in only **40% of cases** and produced **1,318 false positives** (F1 ≈ 0.076) — and one
> model's F1 *quadrupled* just by changing the sampling temperature. A gate whose verdict
> depends on a sampling parameter is not a gate. It's a slot machine.
>
> Worst of all: the failure mode is silent. The AIRA study found LLM judges under-count the
> most dangerous class — swallowed errors that make failure look like success — by **44 to 1**.
> The bug your LLM reviewer is most likely to miss is precisely the one engineered to look fine.

*(Sources: arXiv 2604.20202, 2306.12338, 2604.17587 → PROC-001, SEC-031, SEC-051)*

**Punchline:** *Unslop's Judge Pattern is deterministic-first: AST rules, static analyzers, and registry oracles decide pass/fail. The LLM writes the explanation — never the verdict.*

---

## 5. Pillar 2 — "It compounds" (the iterative-refinement trap)

**Section header:** *"Just ask the AI to fix it" makes it worse. Monotonically.*

Copy block:

> The most dangerous button in your workflow is "regenerate". Controlled measurement across
> repeated refinement rounds: vulnerability density climbed **2.1 → 4.7 → 6.2 per sample** —
> every round, without exception, even with an explicitly security-focused prompt
> (F(9,90) = 14.32, p ≪ 0.001). Self-repair loops fix the compile error and quietly add the
> injection: the wrong-answer fix rate in multi-round self-fixing is **9.1%**.
>
> And it's not just your code. **205,474 unique hallucinated package names** were observed
> across 576,000 generations; 43% of them recur deterministically — a pre-built supply-chain
> attack surface called slopsquatting. Your AI doesn't just write bugs. It invents dependencies.

*(Sources: arXiv 2506.11022, 2308.04838, 2406.10279 → PROC-002, PROC-003, SEC-035)*

**Punchline:** *Unslop re-scans every AI revision — not just the final diff — and fails the build if severity-weighted findings rise. Regeneration stops being roulette.*

---

## 6. Pillar 3 — "Deterministic + gated RAG is the sound architecture"

**Section header:** *Precision 1.00 exists. We gate on it.*

Copy block:

> When the check is mechanical, run a machine: registry lookups catch hallucinated imports with
> **perfect precision** — an LLM judge tops out at 0.67 on the same task. When the check needs
> context, feed it *curated* context: telling the fixer the exact violated rule lifts repair
> success from **34.4% to 87.1%**. That's why every one of our **119 rules** carries a named,
> deterministic enforcement — CodeQL, Semgrep, Bandit, AST checks — distilled from the
> published research on how AI code actually fails.
>
> Even our retrieval is gated, because the research demands it: naive "always-inject-docs" RAG
> *degrades* correctness by up to 39 points on well-known APIs. The Dual-RAG design injects
> The Law (absolute rules) and Evidence (your repo's own patterns) only where they provably help.

*(Sources: arXiv 2604.20202, 2401.14176, 2407.09726 → PROC-001, PROC-003, PROC-009)*

---

## 7. Secondary Ammunition (feature sections, blog posts, objection handling)

- **"But our tests pass."** Up to **77%** of LLM-generated test methods contain *zero assertions*; LLM test suites hit high line coverage (0.879) but detect real mutants far worse (0.546) than human suites. Green CI on AI tests is a decoration, not a verdict. *(arXiv 2410.10628, 2408.07846 → TEST-001, TEST-005)*
- **"We prompt it to be secure."** Security-focused prompting and chain-of-thought produced **+41–42% more findings** in C, no improvement in Java — prompting is not a control, and no risk model may treat it as one. *(arXiv 2605.24300 → PROC-006)*
- **"The demo code worked."** **100%** of generated OAuth integrations hard-coded the client secret; **100%** of Java keystore samples hard-coded the password; all five models evaluated scored **0/12** on HTTP security headers. AI code is a happy-path generator. *(arXiv 2404.03823, 2504.20612 → SEC-005, SEC-018, SEC-019)*
- **"Our agent has guardrails."** **69–98.6%** of 1,709 real-world command denylists were bypassable; **10 out of 10** tested browser agents were TOCTOU-exploitable. Agentic AI needs deterministic gates more, not less. *(arXiv 2607.05743, 2508.17155 → SEC-042, CONC-007)*
- **Honesty differentiator (use openly):** our database documents its own coverage gaps instead of inventing rules to fill them. An anti-slop vendor that hallucinates rules would be poetry, not product.

---

## 8. Sources Block (footer of the landing page)

AIRA matched-control study (arXiv 2604.17587) · API-hallucination oracle study (arXiv 2604.20202) · Iterative-refinement erosion (arXiv 2506.11022) · Real Detection Rate / coverage illusion (arXiv 2605.22175) · Test-smell corpus (arXiv 2410.10628) · Slopsquatting (arXiv 2406.10279) · Crypto/API misuse (arXiv 2404.03823) · Web-app security scoring (arXiv 2504.20612) · Smart-contract audit failure (arXiv 2306.12338) · Multi-round self-fixing (arXiv 2308.04838) · Copilot smell study (arXiv 2401.14176) · RAG degradation (arXiv 2407.09726) · Agent-harness security (arXiv 2607.05743) · Agent TOCTOU (arXiv 2508.17155)
