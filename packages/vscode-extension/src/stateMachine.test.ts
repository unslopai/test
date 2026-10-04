/**
 * State-Machine-Tests (VSCODE_UX_SPEC §6.2/§6.3, ROADMAP §8).
 *
 * Getestet wird das HEUTIGE Verhalten des Codes, nicht die Spec-Tabelle von
 * 2026-07-12: seit der Paddle-Migration ist die 402-Familie vierteilig
 * (`no_subscription` / `subscription_inactive` / `unknown_plan` /
 * `trial_quota_exhausted`), dazu kamen `job_stalled` und `invalid_api_key`.
 */
import { describe, expect, it } from 'vitest';
import {
    changeTouchesAnchor,
    classifyMergeBaseRemedy,
    classifyScanFailure,
    presentState,
} from './stateMachine';
import type { MergeBaseRemedy, ScanFailureKind } from './stateMachine';

describe('classifyScanFailure — error-code → state mapping (§6.2)', () => {
    const wireCodeCases: ReadonlyArray<readonly [string, ScanFailureKind]> = [
        ['repository_not_connected', 'not_connected'],
        // 402-Familie (Paddle): ein erschöpfter Trial ist eine Paywall, kein Rate-Limit.
        ['no_subscription', 'paywalled'],
        ['subscription_inactive', 'paywalled'],
        ['unknown_plan', 'paywalled'],
        ['trial_quota_exhausted', 'paywalled'],
        ['rate_limit_exceeded', 'quota'],
        ['job_stalled', 'stalled'],
        ['Scan failed: model_unavailable — the AI model provider is temporarily out of capacity', 'model_unavailable'],
        ['Scan failed: review_timeout — the review exceeded the time limit for this plan', 'review_timeout'],
        ['invalid_api_key', 'unauthorized'],
    ];

    it.each(wireCodeCases)('maps %s to %s', (wireCode, expectedKind) => {
        expect(classifyScanFailure(wireCode)).toBe(expectedKind);
    });

    it('finds a wire code embedded in surrounding stderr output', () => {
        const stderrText = 'Error: scan rejected (402)\ncode: trial_quota_exhausted\nSee dashboard.';
        expect(classifyScanFailure(stderrText)).toBe('paywalled');
    });

    it('classifies unknown failure text as generic', () => {
        expect(classifyScanFailure('ECONNREFUSED 127.0.0.1:3000')).toBe('generic');
        expect(classifyScanFailure('')).toBe('generic');
    });
});

describe('classifyMergeBaseRemedy — merge-base failure → curing action (§4.2 Z1–Z5)', () => {
    // Each case uses the marker phrase exactly as the CLI emits it
    // (packages/shared/src/node/git.ts: diagnoseMergeBaseFailure).
    const remedyCases: ReadonlyArray<readonly [string, string, MergeBaseRemedy]> = [
        [
            'Z1 unfetched remote refs',
            "Cannot compute merge-base with 'origin/main': the remote has branches that are not "
            + 'fetched locally yet. Fetch the remote first, or pass an explicit base via --base <ref>.',
            'fetch_remote',
        ],
        [
            'Z2 empty remote (never pushed)',
            "Cannot compute merge-base with 'origin/main': the 'origin' remote is empty — this branch "
            + 'has never been pushed. Push the branch first (git push -u origin <branch>), or pass an '
            + 'explicit base via --base <ref>.',
            'push_branch',
        ],
        [
            'Z3/Z4 repo missing or masked 404',
            "Cannot compute merge-base with 'origin/main': the 'origin' repository was reported as not "
            + 'found — either it does not exist yet (publish it first), or it is private and the active '
            + "GitHub account cannot see it (GitHub masks private repositories as 'not found' to the "
            + 'wrong account). Check which account your git credentials use, then scan again.',
            'remote_not_found',
        ],
        [
            'Z5 unrelated history',
            "Cannot compute merge-base with 'origin/main': 'origin/main' exists locally but shares no "
            + "history with HEAD — 'origin' points at an unrelated repository. Check the origin URL "
            + '(git remote -v), or pass an explicit base via --base <ref>.',
            'unrelated_history',
        ],
        [
            'unborn HEAD (zero commits)',
            'This repository has no commits yet — create an initial commit first, then scan again.',
            'create_commit',
        ],
        [
            'offline/unknown probe fallback',
            "Cannot compute merge-base with 'origin/main'. Fetch the remote first, or pass an explicit "
            + 'base via --base <ref>.',
            'fetch_remote',
        ],
    ];

    it.each(remedyCases)('%s → %s', (_caseName, cliFailureText, expectedRemedy) => {
        expect(classifyMergeBaseRemedy(cliFailureText)).toBe(expectedRemedy);
    });

    it('classifies non-merge-base failures as none (normal [Retry] path)', () => {
        expect(classifyMergeBaseRemedy('The scan timed out on the server')).toBe('none');
        expect(classifyMergeBaseRemedy('')).toBe('none');
    });
});

describe('changeTouchesAnchor — stale-range overlap (§6.3, V7)', () => {
    const anchor = { startLine: 10, endLine: 12 };

    it('marks a change inside the anchored range as touching', () => {
        expect(changeTouchesAnchor({ startLine: 11, endLine: 11 }, anchor, 0)).toBe(true);
    });

    it('marks edge-touching changes (first and last anchor line)', () => {
        expect(changeTouchesAnchor({ startLine: 5, endLine: 10 }, anchor, 0)).toBe(true);
        expect(changeTouchesAnchor({ startLine: 12, endLine: 20 }, anchor, 0)).toBe(true);
    });

    it('marks a change above the anchor as touching only when lines were added/removed', () => {
        const changeAbove = { startLine: 2, endLine: 4 };
        expect(changeTouchesAnchor(changeAbove, anchor, 1)).toBe(true);
        expect(changeTouchesAnchor(changeAbove, anchor, -2)).toBe(true);
        // Reine Ersetzung oberhalb verschiebt keine Zeilennummern.
        expect(changeTouchesAnchor(changeAbove, anchor, 0)).toBe(false);
    });

    it('never marks a change below the anchor', () => {
        const changeBelow = { startLine: 20, endLine: 25 };
        expect(changeTouchesAnchor(changeBelow, anchor, 0)).toBe(false);
        expect(changeTouchesAnchor(changeBelow, anchor, 3)).toBe(false);
    });
});

describe('presentState — RESULTS variants (§2.1)', () => {
    it('presents a clean scan without background color', () => {
        const presentation = presentState(
            'RESULTS',
            { critical: 0, warning: 0, stale: 0 },
            { score: 98, verificationSummary: 'no findings to verify' },
        );

        expect(presentation.text).toBe('$(shield) No slop ✓');
        expect(presentation.background).toBeNull();
        expect(presentation.tooltip).toContain('Cognitive Integrity Score: 98/100 — no findings to verify.');
    });

    it('renders the verification balance instead of "every finding survived" next to an uncertain finding (SPEC §6)', () => {
        const presentation = presentState(
            'RESULTS',
            { critical: 0, warning: 1, stale: 0 },
            { score: 50, verificationSummary: '1 finding: 1 remained uncertain' },
        );

        expect(presentation.tooltip).toContain('Cognitive Integrity Score: 50/100 — 1 finding: 1 remained uncertain.');
        expect(presentation.tooltip).not.toContain('every finding survived');
    });

    it('presents critical findings with error background', () => {
        const presentation = presentState('RESULTS', { critical: 3, warning: 1, stale: 0 });

        expect(presentation.text).toBe('$(shield) 3 critical, 1 warning');
        expect(presentation.background).toBe('error');
    });

    it('presents warning-only findings with warning background', () => {
        const presentation = presentState('RESULTS', { critical: 0, warning: 2, stale: 0 });

        expect(presentation.text).toBe('$(shield) 2 warning');
        expect(presentation.background).toBe('warning');
    });

    it('downgrades to warning background when ALL findings are stale', () => {
        const presentation = presentState('RESULTS', { critical: 2, warning: 0, stale: 2 });

        expect(presentation.text).toBe('$(shield) 2 critical · stale');
        expect(presentation.background).toBe('warning');
        expect(presentation.tooltip).toContain('stale');
    });

    it('reports an unavailable integrity score as n/a in the tooltip', () => {
        const noScan = presentState('RESULTS', { critical: 0, warning: 0, stale: 0 }, null);
        const degradedScan = presentState(
            'RESULTS',
            { critical: 1, warning: 0, stale: 0 },
            { score: null, verificationSummary: '1 finding: 1 could not be independently verified' },
        );

        expect(noScan.tooltip).toContain('Cognitive Integrity Score: n/a');
        expect(degradedScan.tooltip).toContain('Cognitive Integrity Score: n/a');
    });

    it('renders a nothing-reviewed scan as a warning naming the reason — never "No slop ✓" (ROADMAP §3)', () => {
        const presentation = presentState(
            'RESULTS',
            { critical: 0, warning: 0, stale: 0 },
            null,
            {
                reason: 'All changed code files exceed the review size cap.',
                omittedFiles: ['src/lib/huge-a.ts', 'src/lib/huge-b.ts'],
            },
        );

        expect(presentation.text).toBe('$(shield) Nothing reviewed');
        expect(presentation.text).not.toContain('No slop');
        expect(presentation.background).toBe('warning');
        expect(presentation.tooltip).toContain('All changed code files exceed the review size cap.');
        expect(presentation.tooltip).toContain('NOT a clean verdict');
        expect(presentation.tooltip).toContain('src/lib/huge-a.ts');
        expect(presentation.tooltip).toContain('src/lib/huge-b.ts');
    });

    it('caps the omitted-files tooltip list and reports the remainder as a count', () => {
        const omittedFiles = Array.from({ length: 8 }, (_, fileIndex) => `src/file-${fileIndex}.ts`);
        const presentation = presentState(
            'RESULTS',
            { critical: 0, warning: 0, stale: 0 },
            null,
            { reason: 'All changed code files exceed the review size cap.', omittedFiles },
        );

        expect(presentation.tooltip).toContain('src/file-4.ts');
        expect(presentation.tooltip).not.toContain('src/file-5.ts');
        expect(presentation.tooltip).toContain('and 3 more');
    });

    it('keeps the clean rendering when the scan reviewed files (no nothing-reviewed notice)', () => {
        const presentation = presentState(
            'RESULTS',
            { critical: 0, warning: 0, stale: 0 },
            { score: 98, verificationSummary: 'no findings to verify' },
            null,
        );

        expect(presentation.text).toBe('$(shield) No slop ✓');
        expect(presentation.background).toBeNull();
    });

    it('presents PAUSED_BILLING (402) and QUOTA_REACHED (429) as distinct states', () => {
        const paused = presentState('PAUSED_BILLING');
        const quota = presentState('QUOTA_REACHED');

        expect(paused.text).toBe('$(warning) Scans paused');
        expect(quota.text).toBe('$(watch) Quota reached');
        // V6: 402 führt zur Billing-Page, 429 löst sich von selbst — nie verwechseln.
        expect(paused.tooltip).toContain('billing');
        expect(quota.tooltip).toContain('resets');
    });
});
