/**
 * State machine (pure, no vscode import — automatically testable, SPEC §6).
 *
 * Contains: state definitions + status bar presentation (§2.1),
 * error-code→state mapping (§5) and the stale-range overlap (V7).
 */

export type GatekeeperStateId =
    | 'NO_FOLDER'
    | 'NOT_A_REPO'
    | 'NO_ORIGIN'
    | 'SIGNED_OUT'
    | 'CLI_MISSING'
    | 'READY'
    | 'SCANNING'
    | 'RESULTS'
    | 'NOT_CONNECTED'
    | 'CONNECTING'
    | 'PAUSED_BILLING'
    | 'QUOTA_REACHED'
    | 'SCAN_FAILED';

export interface FindingCounts {
    readonly critical: number;
    readonly warning: number;
    readonly stale: number;
}

export interface StatePresentation {
    readonly text: string;
    /** ThemeColor token for the background ('error' | 'warning') or null. */
    readonly background: 'error' | 'warning' | null;
    readonly tooltip: string;
}

/**
 * Cognitive Integrity Score of the last scan plus the honest verification
 * balance of its findings (verificationSummary.ts). Only relevant for RESULTS;
 * null = no scan yet.
 */
export interface IntegrityNotice {
    /** 0-100, or null when the verification was unavailable. */
    readonly score: number | null;
    /** e.g. "3 findings: 2 survived independent blind re-verification, 1 remained uncertain". */
    readonly verificationSummary: string;
}

/**
 * Set when the last scan reviewed ZERO files (§2.1 nothing-reviewed split,
 * ROADMAP §3): "we reviewed nothing" must never render as "No slop ✓".
 * `reason` is the scan summary (e.g. the size-cap abort reason), `omittedFiles`
 * the paths dropped by the review size cap.
 */
export interface NothingReviewedNotice {
    readonly reason: string;
    readonly omittedFiles: readonly string[];
}

export function presentState(
    stateId: GatekeeperStateId,
    findingCounts?: FindingCounts,
    integrity: IntegrityNotice | null = null,
    nothingReviewed: NothingReviewedNotice | null = null,
): StatePresentation {
    switch (stateId) {
        case 'NO_FOLDER':
        case 'NOT_A_REPO':
            return {
                text: '$(shield) Gatekeeper',
                background: null,
                tooltip: 'Gatekeeper reviews git changes — open a git repository to scan.',
            };
        case 'NO_ORIGIN':
            return {
                text: '$(shield) Setup needed',
                background: null,
                tooltip: "This repository has no 'origin' remote. Click for setup guidance.",
            };
        case 'SIGNED_OUT':
            return {
                text: '$(shield) Sign in',
                background: null,
                tooltip: 'Authorize the Gatekeeper CLI via your browser.',
            };
        case 'CLI_MISSING':
            return {
                text: '$(shield) Install CLI',
                background: 'warning',
                tooltip: 'The unslop CLI was not found. Click to install it.',
            };
        case 'READY':
            return {
                text: '$(shield) Scan changes',
                background: null,
                tooltip: 'Scan your local diff against the merge-base.',
            };
        case 'SCANNING':
            return { text: '$(sync~spin) Scanning…', background: null, tooltip: 'Gatekeeper scan in progress.' };
        case 'CONNECTING':
            return {
                text: '$(sync~spin) Indexing repo…',
                background: null,
                tooltip: 'Connecting and indexing this repository — one-time step.',
            };
        case 'NOT_CONNECTED':
            return {
                text: '$(plug) Connect repo',
                background: 'warning',
                tooltip: 'This repository is not connected to the Gatekeeper. Click to connect.',
            };
        case 'PAUSED_BILLING':
            return {
                text: '$(warning) Scans paused',
                background: 'warning',
                tooltip: 'No active subscription or trial. Click to open the billing page.',
            };
        case 'QUOTA_REACHED':
            return {
                text: '$(watch) Quota reached',
                background: 'warning',
                tooltip: 'Scan quota reached. The hourly window resets automatically; monthly quota resets on the 1st.',
            };
        case 'SCAN_FAILED':
            return {
                text: '$(shield) Scan failed',
                background: 'warning',
                tooltip: 'The last scan failed. Click to retry.',
            };
        case 'RESULTS':
            return presentResults(
                findingCounts ?? { critical: 0, warning: 0, stale: 0 },
                integrity,
                nothingReviewed,
            );
    }
}

/** Caps the tooltip file list — a 40-file PR must not become a screen-high tooltip. */
const MAX_OMITTED_FILES_IN_TOOLTIP = 5;

function omittedFilesTooltip(omittedFiles: readonly string[]): string {
    if (omittedFiles.length === 0) return '';
    const shownFiles = omittedFiles.slice(0, MAX_OMITTED_FILES_IN_TOOLTIP).join(', ');
    const hiddenCount = omittedFiles.length - MAX_OMITTED_FILES_IN_TOOLTIP;
    return `\n\nOmitted (review size cap): ${shownFiles}`
        + (hiddenCount > 0 ? ` … and ${hiddenCount} more` : '');
}

function presentResults(
    findingCounts: FindingCounts,
    integrity: IntegrityNotice | null,
    nothingReviewed: NothingReviewedNotice | null,
): StatePresentation {
    // Honesty gate before the clean branch: zero files reviewed is not a verdict.
    if (nothingReviewed) {
        return {
            text: '$(shield) Nothing reviewed',
            background: 'warning',
            tooltip: `${nothingReviewed.reason} The Gatekeeper reviewed 0 files — `
                + 'this is NOT a clean verdict. Click to re-scan.'
                + omittedFilesTooltip(nothingReviewed.omittedFiles),
        };
    }

    const totalFindings = findingCounts.critical + findingCounts.warning;

    if (totalFindings === 0) {
        return {
            text: '$(shield) No slop ✓',
            background: null,
            tooltip: 'No AI slop found in the current changes. Click to re-scan.'
                + integrityScoreTooltip(integrity),
        };
    }

    const parts: string[] = [];
    if (findingCounts.critical > 0) parts.push(`${findingCounts.critical} critical`);
    if (findingCounts.warning > 0) parts.push(`${findingCounts.warning} warning`);
    const staleSuffix = findingCounts.stale > 0 ? ' · stale' : '';

    const findingsTooltip = findingCounts.stale > 0
        ? 'Some findings are stale (code changed since the scan). Click to re-scan.'
        : 'Findings in the Problems panel. Click to open it.';

    return {
        text: `$(shield) ${parts.join(', ')}${staleSuffix}`,
        background: findingCounts.stale === totalFindings
            ? 'warning'
            : findingCounts.critical > 0 ? 'error' : 'warning',
        tooltip: findingsTooltip + integrityScoreTooltip(integrity),
    };
}

/**
 * The score belongs in the tooltip, not in the status bar text: there the
 * findings count, and a second number next to them reads like a code grade —
 * but the score measures the confidence of the review, not the code quality.
 */
function integrityScoreTooltip(integrity: IntegrityNotice | null): string {
    if (integrity === null || integrity.score === null) {
        return '\n\nCognitive Integrity Score: n/a — confidence verification was unavailable.';
    }
    // The tagline counts each finding's verification status (SPEC.md §6) —
    // "every finding survived" only when it is true.
    return `\n\nCognitive Integrity Score: ${integrity.score}/100 — ${integrity.verificationSummary}.`;
}

// =============================================================================
// Error code → next state (§5: the CLI emits codes on stderr)
// =============================================================================

export type ScanFailureKind =
    | 'not_connected'
    | 'paywalled'
    | 'quota'
    | 'stalled'
    | 'model_unavailable'
    | 'review_timeout'
    | 'unauthorized'
    | 'generic';

export function classifyScanFailure(failureText: string): ScanFailureKind {
    if (failureText.includes('repository_not_connected')) return 'not_connected';
    // An exhausted trial is a paywall, not a rate limit: it does not come back
    // on its own, the user has to upgrade.
    if (failureText.includes('subscription_inactive') || failureText.includes('no_subscription')
        || failureText.includes('unknown_plan') || failureText.includes('trial_quota_exhausted')) return 'paywalled';
    if (failureText.includes('rate_limit_exceeded')) return 'quota';
    if (failureText.includes('job_stalled')) return 'stalled';
    // Vertex capacity after server-side retries — transient, never a repo or
    // connection problem (the F5 user read the old server_error as one).
    if (failureText.includes('model_unavailable')) return 'model_unavailable';
    // Server-side time limit (Deadline Guard) — a re-run can succeed.
    if (failureText.includes('review_timeout')) return 'review_timeout';
    if (failureText.includes('invalid_api_key')) return 'unauthorized';
    return 'generic';
}

// =============================================================================
// Merge-base failure → curing action (§4.2 Z1–Z5: the CLI differentiates the
// repository states behind a failed merge-base; the marker phrases below are
// its message contract)
// =============================================================================

export type MergeBaseRemedy =
    | 'fetch_remote'       // Z1: remote refs exist, not fetched locally
    | 'push_branch'        // Z2: remote is empty — the branch was never pushed
    | 'remote_not_found'   // Z3/Z4: repo missing OR masked 404 on a private repo
    | 'unrelated_history'  // Z5: origin points at an unrelated history
    | 'create_commit'      // unborn HEAD: zero commits
    | 'none';

export function classifyMergeBaseRemedy(failureText: string): MergeBaseRemedy {
    if (failureText.includes('has never been pushed')) return 'push_branch';
    if (failureText.includes('masks private repositories')) return 'remote_not_found';
    if (failureText.includes('shares no history')) return 'unrelated_history';
    if (failureText.includes('no commits yet')) return 'create_commit';
    // Last: both the Z1 message and the CLI's offline/unknown fallback carry
    // this phrase — a fetch is the safe default action for either.
    if (failureText.includes('Fetch the remote first')) return 'fetch_remote';
    return 'none';
}

// =============================================================================
// Stale overlap (V7) — 0-based line ranges
// =============================================================================

export interface LineRange {
    readonly startLine: number;
    readonly endLine: number;
}

/**
 * Checks whether a document change touches a finding's anchor.
 * Changes that insert/delete lines ABOVE also shift the anchor —
 * which is why anything before the anchor also counts as a touch as soon
 * as the line count changes (addedLineDelta != 0).
 */
export function changeTouchesAnchor(
    changeRange: LineRange,
    anchorRange: LineRange,
    addedLineDelta: number,
): boolean {
    const directOverlap =
        changeRange.startLine <= anchorRange.endLine && changeRange.endLine >= anchorRange.startLine;
    if (directOverlap) return true;

    // Lines inserted/removed before ⇒ the anchor line numbers no longer match.
    return addedLineDelta !== 0 && changeRange.endLine < anchorRange.startLine;
}
