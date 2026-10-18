# Rule-Recall Fixture Authoring Guide

Synthetic diff fixtures for the Rule-Recall Benchmark (`npm run benchmark:rules`).
Each fixture is a multi-file diff in which every file plants **exactly one**
Golden-Standard rule violation (or, for negative controls, none at all).

## Fixture file format (strict — validated by `src/lib/benchmark/rule-recall-manifest.test.ts`)

```
=== FILE: src/billing/invoice-export.ts (modified) ===
@@ -1,0 +1,5 @@
+import { db } from '../db';
+export async function exportInvoice(invoiceId: string) {
+    const invoiceRows = await db.query('SELECT * FROM invoices WHERE id = ' + invoiceId);
+    return invoiceRows[0];
+}

=== FILE: next/file.py (modified) ===
...
```

Rules:

1. Every file section starts with `=== FILE: <path> (modified) ===`.
2. Exactly **one hunk** per file, header `@@ -1,0 +1,N @@` where **N equals the
   number of `+` lines that follow**. All content lines start with `+`
   (pure-addition patch). The claim-anchoring validator
   (`issue-validation.ts`) rejects findings outside hunk line ranges — a wrong
   `N` silently turns a caught violation into a "miss".
3. LF line endings only. ASCII quotes. One blank line between file sections.
4. File paths: realistic for the ecosystem, unique within the whole suite.

## Content rules

- **One planted violation per file.** The surrounding code must be realistic
  and otherwise clean: no `any`, no empty catch, no emojis, no generic names
  (`data`, `result`, `temp`), no magic-number bait, no TODO comments — unless
  that pattern IS the planted rule. Accidental second violations pollute the
  per-rule attribution.
- 6–25 lines per file. English comments/identifiers (customer-realistic).
- Rules that describe an *absence* (missing rate limit, missing CSRF, missing
  securityContext, …) need enough surrounding context to make the absence
  salient — e.g. a login handler that plainly compares credentials so the
  missing throttling is visible.
- Kubernetes files: use the **hardened-except-one** pattern. Start from a fully
  hardened manifest (runAsNonRoot, allowPrivilegeEscalation: false,
  readOnlyRootFilesystem: true, seccompProfile RuntimeDefault, capabilities
  drop ALL, resources limits+requests, image pinned) and break exactly the one
  aspect under test — otherwise every negative-space INFRA rule fires on every
  file and attribution collapses.
- Negative controls: idiomatic, well-engineered code with named constants,
  handled errors, and no DRY bait. They gate false-positive precision.
  **Resource acquisition needs visible release in the same diff**: a
  `create`-style function without its `destroy`/`free`/`close` counterpart
  reads as a leak (SEC-007) from the reviewer's diff-only perspective — that
  exact fixture defect produced the only "false positive" of the 2026-08-24
  first run.
  **Error handling must satisfy the rule's own letter, not just its spirit**
  (2026-08-26 lesson): a `.catch(() => setLoadFailed(true))` that discards the
  error object read as MAINT-001 in 6/6 runs across BOTH models — and by the
  rule text ("at least log it with context") that claim was defensible; the
  Flash verifier even refuted it while Pro confirmed it, i.e. the fixture sat
  exactly on the ambiguity line. Clean fixtures must log the caught error with
  context (or rethrow) so no defensible reading of the rule can fire. Fixed in
  `r18-clean-ts.diff` (TeamMemberList.tsx); 3/3 clean runs after the fix.

## Manifest entry format (`manifest.json`)

```json
"r03-python-security.diff": {
    "description": "Python security rules under a realistic ['python'] law filter",
    "detectedEcosystems": ["python"],
    "negativeControl": false,
    "expected": [
        { "path": "svc/loader.py", "ruleContains": "SEC-006" }
    ]
}
```

- `detectedEcosystems` mirrors `repositories.detected_ecosystems` and drives
  Dynamic Law Filtering exactly like production. Use a realistic value from
  `KNOWN_ECOSYSTEMS` (`nextjs, react, typescript, nodejs, python, go,
  java-spring, java, c, cpp, terraform, powershell, kubernetes, solidity`) —
  or `null` for a repository whose detection never ran, which fails open to
  the unfiltered Law block, again exactly like production.
- `polyglotEcosystems` (optional) is what the detection yields for a
  TypeScript host repository that also contains the fixture files;
  `--ecosystems polyglot` uses it. `src/lib/law.test.ts` checks the value
  against `detectRepoEcosystems`.
- `ruleContains` may list `|`-separated alternatives when detection layers
  legitimately overlap (e.g. `"Condition 1|MAINT-001"`). Keep it strict
  otherwise — loose alternatives fake per-rule recall.

## Known overlap aliases

| Planted rule | ruleContains |
|---|---|
| MAINT-001 | `Condition 1\|MAINT-001` |
| MAINT-004 | `Condition 3\|MAINT-004` |
| MAINT-005 | `Condition 4\|MAINT-005` |
| MAINT-007 | `Condition 5\|MAINT-007` |
| SEC-031 | `SEC-031\|Condition 1\|MAINT-001` |
| CONC-003 | `CONC-003\|CONC-001` |
| CONC-004 | `CONC-004\|CONC-001` |
| HAL-005 | `HAL-005\|HAL-002` |

## Routing constraints

- Flash-cascade bundles: ≤ 15 files AND ≤ ~48 000 chars total (12k estimated
  tokens). Keep bundles well under both.
- Pro-direct stress fixtures: **> 15 files** and ≤ ~100 000 chars — this is the
  large-PR attention-decay test and must route `pro-direct`.

## Rule universe

`rules-inventory.json` is the checked-in snapshot of `golden_standards`
(rule_id, applies_to, has_explanation). The 19 rules without
`public_explanation` are process/meta rules that render as a neutral line and
cannot fire on a code diff; they are excluded in `manifest.json` with reasons,
as are rules whose text is merge-process advice rather than a code pattern.
The static test enforces: every rule is either planted in some fixture or
listed in `excludedRules` — no silent gaps.
