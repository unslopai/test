/**
 * `unslop scan` — compute the diff against the merge-base, upload it, poll.
 *
 * Interactive paths (TTY only, never in CI):
 *   - repository_not_connected → offer auto-connect and continue the scan
 *   - 402 (no subscription)     → open the billing page in the browser
 *
 * Exit codes (SPEC.md D10):
 *   0 = clean or below the --fail-on threshold
 *   1 = findings at/above the threshold
 *   2 = infrastructure/auth/git error
 */
import type { ScanResult } from '@unslop/shared';
import {
    loadConfig,
    assertInsideWorkTree, computeDiff, isWorkingTreeDirty, resolveGitRoot,
    resolveHeadSha, resolveMergeBase, resolveRepoFullName, GitError,
    submitScan, pollUntilDone, connectRepo, waitForRepoActive, ApiError,
    findDiffUploadRefusal, applyFixes, SecretUploadBlockedError,
} from '@unslop/shared/node';
import type { CliConfig, DiffUploadRefusal, FixReport } from '@unslop/shared/node';
import { printFixReport, printHumanResult } from './format.js';
import { isInteractive, confirm, openBrowser, green, yellow, dim } from './ui.js';

const DEFAULT_TIMEOUT_SECONDS = 120;
const CONNECT_TIMEOUT_MS = 180_000;

type FailOnLevel = 'critical' | 'warning' | 'none';

/** 'apply' writes fixes to disk; 'dry-run' previews and always wins over 'apply'. */
type FixMode = 'off' | 'apply' | 'dry-run';

export interface ScanOptions {
    readonly jsonOutput: boolean;
    readonly failOn: FailOnLevel;
    readonly explicitBaseRef: string | null;
    readonly timeoutSeconds: number;
    readonly fixMode: FixMode;
    readonly allowDirty: boolean;
}

export class UsageError extends Error {}

/**
 * Human hints for server failure codes the user can act on. The code itself
 * always leads the line: the VS Code extension classifies this stderr text by
 * the code (stateMachine.ts: classifyScanFailure).
 */
const SCAN_FAILURE_HINTS: Readonly<Record<string, string>> = {
    model_unavailable: 'the AI model provider is temporarily out of capacity (retries exhausted). '
        + 'Nothing is wrong with your repository or connection — retry in a minute.',
    review_timeout: 'the review exceeded the time limit for this plan (large diffs take longest). '
        + 'Run the scan again; if it keeps timing out, scan a smaller change set.',
};

export function formatScanFailure(failureCode: string | undefined): string {
    const stableCode = failureCode ?? 'unknown_error';
    const actionHint = SCAN_FAILURE_HINTS[stableCode];
    return actionHint ? `Scan failed: ${stableCode} — ${actionHint}` : `Scan failed: ${stableCode}`;
}

interface MutableFlagOptions {
    jsonOutput: boolean;
    fixMode: FixMode;
    allowDirty: boolean;
}

/** Handles valueless flags; false = the argument is not one of them. */
function applyBooleanFlag(options: MutableFlagOptions, currentArg: string): boolean {
    switch (currentArg) {
        case '--json':
            options.jsonOutput = true;
            return true;
        case '--fix':
            // --dry-run wins regardless of flag order: previewing is always safe.
            if (options.fixMode === 'off') options.fixMode = 'apply';
            return true;
        case '--dry-run':
            options.fixMode = 'dry-run';
            return true;
        case '--allow-dirty':
            options.allowDirty = true;
            return true;
        default:
            return false;
    }
}

export function parseScanOptions(commandArgs: readonly string[]): ScanOptions {
    const options = {
        jsonOutput: false,
        failOn: 'critical' as FailOnLevel,
        explicitBaseRef: null as string | null,
        timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        fixMode: 'off' as FixMode,
        allowDirty: false,
    };

    for (let argIndex = 0; argIndex < commandArgs.length; argIndex++) {
        const currentArg = commandArgs[argIndex];
        if (applyBooleanFlag(options, currentArg)) {
            // handled above
        } else if (currentArg === '--fail-on') {
            const failOnValue = commandArgs[++argIndex];
            if (failOnValue !== 'critical' && failOnValue !== 'warning' && failOnValue !== 'none') {
                throw new UsageError(`--fail-on must be critical, warning, or none (got '${failOnValue}').`);
            }
            options.failOn = failOnValue;
        } else if (currentArg === '--base') {
            options.explicitBaseRef = commandArgs[++argIndex] ?? null;
            if (!options.explicitBaseRef) throw new UsageError('--base requires a git ref.');
        } else if (currentArg === '--timeout') {
            const timeoutValue = Number.parseInt(commandArgs[++argIndex] ?? '', 10);
            if (!Number.isFinite(timeoutValue) || timeoutValue <= 0) {
                throw new UsageError('--timeout requires a positive number of seconds.');
            }
            options.timeoutSeconds = timeoutValue;
        } else {
            throw new UsageError(`Unknown option: ${currentArg}`);
        }
    }

    return options;
}

export async function runScan(options: ScanOptions): Promise<number> {
    const cliConfig = loadConfig();
    if (!cliConfig.apiKey) {
        console.error('No API key configured. Run `unslop login` first.');
        return 2;
    }

    try {
        assertInsideWorkTree();

        // Destructive-write guard (ROADMAP §3): --fix rewrites workspace files,
        // so uncommitted work must be safe in git first — checked BEFORE the
        // scan so no quota is burned on a run that would refuse anyway.
        // --dry-run never writes and needs no guard.
        if (options.fixMode === 'apply' && !options.allowDirty && isWorkingTreeDirty()) {
            console.error(
                'Refusing --fix: the working tree has uncommitted changes. Commit or stash them first '
                + '(so applied fixes stay revertible via git), pass --allow-dirty to override, '
                + 'or use --dry-run to preview without writing.',
            );
            return 2;
        }

        const repoFullName = resolveRepoFullName();
        const mergeBaseSha = resolveMergeBase(options.explicitBaseRef);
        const diff = computeDiff(mergeBaseSha);

        // Shared upload policy (ROADMAP §13): identical rules to the MCP server,
        // including the secret filter this path was missing entirely.
        const uploadRefusal = findDiffUploadRefusal(diff);
        if (uploadRefusal) {
            return reportUploadRefusal(uploadRefusal, options);
        }

        let attemptedAutoConnect = false;

        // Submit loop: exactly one retry after a successful auto-connect.
        for (;;) {
            try {
                return await submitAndReport(cliConfig, options, repoFullName, mergeBaseSha, diff);
            } catch (submitError: unknown) {
                const isNotConnected = submitError instanceof ApiError && submitError.httpStatus === 404;
                const isPaywalled = submitError instanceof ApiError && submitError.httpStatus === 402;

                if (isNotConnected && !attemptedAutoConnect && isInteractive()) {
                    attemptedAutoConnect = true;
                    const connected = await offerAutoConnect(cliConfig, repoFullName);
                    if (connected) continue;
                    return 2;
                }
                if (isPaywalled && isInteractive()) {
                    return offerBillingPage(cliConfig, (submitError as ApiError).message);
                }
                throw submitError;
            }
        }
    } catch (scanError: unknown) {
        return reportScanError(scanError);
    }
}

/**
 * Turns a refusal from the shared policy into CLI output and an exit code.
 *
 * "Nothing to scan" is a clean run (0), not a failure — CI must not go red
 * because a branch had no changes. A blocked secret and an oversized diff are
 * infrastructure refusals (2) and go to stderr, so `--json` stdout stays
 * parseable for the VS Code extension.
 */
export function reportUploadRefusal(uploadRefusal: DiffUploadRefusal, options: ScanOptions): number {
    if (uploadRefusal.kind === 'no_changes') {
        if (options.jsonOutput) {
            console.log(JSON.stringify({
                hasSlop: false,
                issues: [],
                summary: 'No changes to scan (working tree matches the merge-base).',
                filesReviewed: 0,
                // Honesty contract (ROADMAP §3): zero files reviewed is never a verdict.
                outcome: 'nothing_reviewed',
                omittedFiles: [],
                cognitiveIntegrityScore: null,
            }));
        } else {
            console.log('No changes to scan (working tree matches the merge-base).');
        }
        return 0;
    }

    if (uploadRefusal.kind === 'secret_detected') {
        const { path: secretPath, line, patternClass } = uploadRefusal.firstMatch;
        console.error(
            `Upload blocked: a possible secret was found at ${secretPath}:${line} (${patternClass}). `
            + 'Nothing was uploaded. Remove it before scanning.',
        );
        return 2;
    }

    console.error(
        `Diff is ${Math.ceil(uploadRefusal.diffBytes / 1024)} KB; the limit is `
        + `${uploadRefusal.limitBytes / 1024} KB. Split the change or scan via a pull request.`,
    );
    return 2;
}

// =============================================================================
// Scan run
// =============================================================================

async function submitAndReport(
    cliConfig: CliConfig,
    options: ScanOptions,
    repoFullName: string,
    mergeBaseSha: string,
    diff: string,
): Promise<number> {
    if (!options.jsonOutput) {
        console.error(`Scanning ${repoFullName} ${dim(`(diff vs ${mergeBaseSha.substring(0, 10)})`)}…`);
    }

    const jobId = await submitScan({
        baseUrl: cliConfig.baseUrl,
        apiKey: cliConfig.apiKey!,
        repoFullName,
        diff,
        baseSha: mergeBaseSha,
        headSha: resolveHeadSha(),
        dirty: true,
    });

    const finalPoll = await pollUntilDone({
        baseUrl: cliConfig.baseUrl,
        apiKey: cliConfig.apiKey!,
        jobId,
        timeoutMs: options.timeoutSeconds * 1000,
    });

    if (finalPoll.status === 'error' || !finalPoll.result) {
        console.error(formatScanFailure(finalPoll.error));
        return 2;
    }

    return reportScanResult(finalPoll.result, options);
}

/**
 * Prints the result and — in --fix/--dry-run mode — applies the suggested
 * fixes FIRST, so the machine-readable stdout carries the autoFixSummary in
 * the same JSON document CI already parses. Exit-code semantics (SPEC.md D10)
 * are unchanged by fixing: the scan FOUND the issues, and --fail-on gates on
 * that honestly even when every fix applied.
 */
export function reportScanResult(scanResult: ScanResult, options: ScanOptions): number {
    const fixReport: FixReport | null = options.fixMode === 'off'
        ? null
        : applyFixes(scanResult.issues, { repoRoot: resolveGitRoot(), dryRun: options.fixMode === 'dry-run' });

    if (options.jsonOutput) {
        console.log(JSON.stringify(fixReport === null ? scanResult : {
            ...scanResult,
            autoFixSummary: {
                applied: fixReport.applied,
                skipped: fixReport.skipped,
                failed: fixReport.failed,
                dryRun: fixReport.dryRun,
            },
        }));
    } else {
        printHumanResult(scanResult);
        if (fixReport !== null) printFixReport(fixReport);
    }

    return exitCodeForFindings(scanResult, options.failOn);
}

// =============================================================================
// Interactive paths (TTY only)
// =============================================================================

/** Offers auto-connect; true = repo is now active, the scan can continue. */
async function offerAutoConnect(cliConfig: CliConfig, repoFullName: string): Promise<boolean> {
    console.error(yellow(`Repository ${repoFullName} is not connected to the Gatekeeper.`));
    if (!(await confirm('Connect it now?'))) {
        console.error('Aborted — connect it in the dashboard or re-run and confirm.');
        return false;
    }

    try {
        await connectRepo({ baseUrl: cliConfig.baseUrl, apiKey: cliConfig.apiKey!, repoFullName });
        console.error(`Connecting and indexing ${repoFullName} ${dim('(one-time step, may take a minute)')}…`);

        const finalStatus = await waitForRepoActive(
            { baseUrl: cliConfig.baseUrl, apiKey: cliConfig.apiKey!, repoFullName },
            CONNECT_TIMEOUT_MS,
        );

        if (finalStatus === 'active') {
            console.error(green('✔ Repository connected.') + ' Continuing the scan…');
            return true;
        }
        console.error(`Repository indexing did not finish (status: ${finalStatus}). Check the dashboard.`);
        return false;
    } catch (connectError: unknown) {
        if (connectError instanceof ApiError && connectError.httpStatus === 402) {
            await offerBillingPage(cliConfig);
            return false;
        }
        if (connectError instanceof ApiError && connectError.httpStatus === 403) {
            console.error('You need admin permission on this GitHub repository to connect it.');
            return false;
        }
        if (connectError instanceof ApiError && connectError.httpStatus === 409) {
            console.error(`Connect refused: ${connectError.message} (plan limit or already connected).`);
            return false;
        }
        console.error(`Connect failed: ${(connectError as Error).message}`);
        return false;
    }
}

/** 402 path: offers to open the billing page in the browser. Exit stays 2. */
async function offerBillingPage(cliConfig: CliConfig, errorCode = ''): Promise<number> {
    // Trial exhausted means: an upgrade is needed — not "wait until it comes back".
    const isTrialExhausted = errorCode.includes('trial_quota_exhausted');

    console.error(yellow(isTrialExhausted
        ? 'Your free trial limit is used up — upgrade to keep scanning.'
        : 'You need an active subscription or trial to scan.'));

    if (await confirm('Open the billing page in your browser?')) {
        const billingUrl = `${cliConfig.baseUrl}/dashboard/settings/billing`;
        openBrowser(billingUrl);
        console.error(`Opened ${billingUrl} — re-run the scan once your plan is active.`);
    }
    return 2;
}

// =============================================================================
// Gating + error reporting
// =============================================================================

function exitCodeForFindings(scanResult: ScanResult, failOn: FailOnLevel): number {
    if (failOn === 'none') return 0;

    const hasCritical = scanResult.issues.some((issue) => issue.severity === 'CRITICAL');
    const hasAnyFinding = scanResult.issues.length > 0;

    if (failOn === 'critical') return hasCritical ? 1 : 0;
    return hasAnyFinding ? 1 : 0;
}

function reportScanError(scanError: unknown): number {
    // Netzwerkgrenzen-Refusal aus submitScan (ROADMAP §13): die Message nennt
    // nur Ort und Musterklasse, nie das Material — sicher fürs Terminal.
    if (scanError instanceof SecretUploadBlockedError) {
        console.error(scanError.message);
        return 2;
    }
    if (scanError instanceof GitError || scanError instanceof ApiError) {
        console.error(scanError.message);
        if (scanError instanceof ApiError && scanError.httpStatus === 404) {
            console.error('Hint: this repository must be connected in the Gatekeeper dashboard first.');
        }
        if (scanError instanceof ApiError && scanError.httpStatus === 401) {
            console.error('Hint: check your API key (unslop login) — it may be revoked.');
        }
        if (scanError instanceof ApiError && scanError.httpStatus === 402) {
            console.error(scanError.message.includes('trial_quota_exhausted')
                ? 'Hint: your free trial limit is used up — upgrade in the Gatekeeper dashboard to continue.'
                : 'Hint: no active subscription or trial — manage billing in the Gatekeeper dashboard.');
        }
        return 2;
    }
    console.error(`Unexpected error: ${(scanError as Error).message}`);
    return 2;
}
