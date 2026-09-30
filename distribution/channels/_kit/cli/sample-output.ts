/**
 * Runs the REAL CLI formatter (packages/cli/src/format.ts → printHumanResult) on an EXAMPLE scan result,
 * so terminal text in the channel visuals is byte-for-byte what `unslop scan` prints for such a result.
 * The findings, paths and code are example data (labelled "Example" in every visual); the rule IDs,
 * critique texts (= public_explanation from supabase/migrations/040) and every formatting string are real.
 *
 * Usage (repo root):
 *   npx tsx distribution/channels/_kit/cli/sample-output.ts scan  > distribution/channels/_kit/cli/sample-output.ansi
 *   npx tsx distribution/channels/_kit/cli/sample-output.ts fix   > distribution/channels/_kit/cli/sample-fix.ansi
 *   npx tsx distribution/channels/_kit/cli/sample-output.ts clean > distribution/channels/_kit/cli/sample-clean.ansi
 * scan = findings as printed by `unslop scan`; fix = the same plus printFixReport (`unslop scan --fix`, one fix applied);
 * clean = the re-scan after the fix (no findings).
 * Colour: the formatter only emits ANSI on a TTY, so isTTY is forced before the dynamic import
 * (a .then chain, because tsx compiles this file as CJS where top-level await is unavailable).
 */
import type { ScanResult } from '@unslop/shared';

Object.defineProperty(process.stdout, 'isTTY', { value: true });

const EXAMPLE_RESULT: ScanResult = {
    hasSlop: true,
    filesReviewed: 3,
    outcome: 'reviewed',
    omittedFiles: [],
    cognitiveIntegrityScore: 98,
    summary: 'Found 1 critical issue: a payment error is swallowed and reported as success.',
    issues: [
        {
            id: '0000000000000001',
            rule: 'SEC-031',
            severity: 'CRITICAL',
            path: 'app/api/checkout/webhook/route.ts',
            line: 11,
            endLine: 13,
            exactQuote: '  } catch (err) {\n    // retry later\n  }',
            critique: 'An error is silently swallowed and the handler returns a success response anyway, so failures (including skipped authorization checks) look identical to successes. Propagate errors and return a proper failure status.',
            fixedCodeSnippet: '  } catch (err) {\n    console.error(err);\n    return Response.json({ ok: false }, { status: 500 });\n  }',
            verification: 'confirmed',
        },
    ],
};

const CLEAN_RESULT: ScanResult = {
    ...EXAMPLE_RESULT,
    hasSlop: false,
    issues: [],
    cognitiveIntegrityScore: 100,
    summary: 'No issues found.',
};

const mode = process.argv[2] ?? 'scan';
void import('../../../../packages/cli/src/format.js').then(({ printHumanResult, printFixReport }) => {
    if (mode === 'clean') {
        printHumanResult(CLEAN_RESULT);
        return;
    }
    printHumanResult(EXAMPLE_RESULT);
    if (mode === 'fix') {
        const [finding] = EXAMPLE_RESULT.issues;
        printFixReport({
            dryRun: false,
            outcomes: [{ rule: finding.rule, path: finding.path, line: finding.line, status: 'applied', reason: null }],
            applied: 1,
            skipped: 0,
            failed: 0,
        });
    }
});
