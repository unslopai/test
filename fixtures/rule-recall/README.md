# Rule-Recall Benchmark

Empirical detection-coverage benchmark for the Golden-Standard rules. Where the
9-diff golden-diff replay rig (`scripts/replay-golden-diffs.ts`) proves the
cascade did not *regress* on a handful of diffs, this benchmark proves, per
rule, that the cascade *catches* the violation in the first place.

It answers three questions across the whole rule set:

1. **Rule Recall** — does the Draft Reviewer flag the planted violation?
2. **Verifier Survival** — does the finding survive the blind Claim Verifier
   (a finding caught by the draft but dropped by the verifier is a False
   Refutation)?
3. **Clean Precision** — do negative-control (clean) diffs stay free of
   CRITICAL false positives?

## Layout

- `*.diff` — synthetic fixtures. Each bundle is a multi-file unified diff; every
  file plants exactly one rule violation (negative controls plant none). Format
  and authoring rules: `AUTHORING.md`.
- `manifest.json` — per-fixture `detectedEcosystems` (drives Dynamic Law
  Filtering exactly like production) and the `expected` planted rule per file.
- `rules-inventory.json` — checked-in snapshot of `golden_standards`
  (rule_id, applies_to, has_explanation) at capture time.
- `excluded-rules.json` — rules deliberately NOT planted, each with a reason.
  The offline guard enforces: every detectable rule is planted or excluded.
- `results/` — captured benchmark reports (`--out`).

## Coverage

- 100 detectable golden rules (those with a `public_explanation`; the 19 without
  one render as a neutral line and cannot fire on a code diff).
- 95 planted, 5 excluded as agent-architecture / build-dependent rules
  (`excluded-rules.json`). Plus all 11 React/Next reviewer Conditions.
- 20 bundles across C/C++, Python, TypeScript/Node, React/Next, Java-Spring, Go,
  Kubernetes, Terraform/AWS, PowerShell, and AI-agent code; 3 negative controls;
  one 18-file bundle that routes **pro-direct** to stress large-PR attention decay.

## Running

```bash
npm run benchmark:rules              # full suite (real Vertex calls, real Pro budget)
npm run benchmark:rules -- --only r11 # substring filter (one bundle / ecosystem)
npm run benchmark:rules -- --keep     # keep replay jobs + telemetry in the DB
npm run benchmark:rules -- --out results/2026-08-24.json
```

The runner reuses the real cascade (complexity-router → draft → blind verifier →
pro escalation → integrity scorer), RAG/Practices off for a reproducible
baseline — the same wiring as the replay rig. Its only deliberate difference:
`detectedEcosystems` is set per fixture so the Law filter behaves as in
production, instead of globally off.

Exit code: 0 = no rule missed, no False Refutation, no CRITICAL false positive on
a negative control; 1 = at least one of those; 2 = infrastructure error.

A Vertex `429 RESOURCE_EXHAUSTED` during a run is a tooling STOP (INFRA-002), not
a detection finding — completed fixtures are still written to the results file;
the rest are re-run once the rate limit recovers.

## Offline guard

`src/lib/benchmark/rule-recall-manifest.test.ts` runs under `npm test` (no LLM,
no DB). It fails if any hunk header miscounts its `+` lines (which would silently
drop a finding out of the anchor range and fake a "miss"), if a fixture drifts
from the manifest, if a tagged rule is planted under a Law filter that would
strip it, or if a detectable rule is neither planted nor excluded.
