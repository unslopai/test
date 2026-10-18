/**
 * `unslop scan` — Diff gegen die Merge-Base berechnen, hochladen, pollen.
 *
 * Exit-Codes (SPEC.md D10):
 *   0 = sauber bzw. unterhalb des --fail-on Schwellwerts
 *   1 = Findings auf/über dem Schwellwert
 *   2 = Infrastruktur-/Auth-/Git-Fehler
 */
import type { ScanResult } from '@unslop/shared';
import { loadConfig } from './config.js';
import { assertInsideWorkTree, computeDiff, resolveHeadSha, resolveMergeBase, resolveRepoFullName, GitError } from './git.js';
import { submitScan, pollUntilDone, ApiError } from './api.js';
import { printHumanResult } from './format.js';

const MAX_DIFF_BYTES = 300 * 1024;
const DEFAULT_TIMEOUT_SECONDS = 120;

type FailOnLevel = 'critical' | 'warning' | 'none';

export interface ScanOptions {
    readonly jsonOutput: boolean;
    readonly failOn: FailOnLevel;
    readonly explicitBaseRef: string | null;
    readonly timeoutSeconds: number;
}

export function parseScanOptions(commandArgs: readonly string[]): ScanOptions {
    const options = {
        jsonOutput: false,
        failOn: 'critical' as FailOnLevel,
        explicitBaseRef: null as string | null,
        timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
    };

    for (let argIndex = 0; argIndex < commandArgs.length; argIndex++) {
        const currentArg = commandArgs[argIndex];
        if (currentArg === '--json') {
            options.jsonOutput = true;
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

export class UsageError extends Error {}

export async function runScan(options: ScanOptions): Promise<number> {
    const cliConfig = loadConfig();
    if (!cliConfig.apiKey) {
        console.error('No API key configured. Run `unslop login` or set UNSLOP_API_KEY.');
        return 2;
    }

    try {
        assertInsideWorkTree();
        const repoFullName = resolveRepoFullName();
        const mergeBaseSha = resolveMergeBase(options.explicitBaseRef);
        const diff = computeDiff(mergeBaseSha);

        if (diff.trim().length === 0) {
            if (options.jsonOutput) {
                console.log(JSON.stringify({ hasSlop: false, issues: [], summary: 'No changes to scan.', filesReviewed: 0 }));
            } else {
                console.log('No changes to scan (working tree matches the merge-base).');
            }
            return 0;
        }

        if (Buffer.byteLength(diff, 'utf-8') > MAX_DIFF_BYTES) {
            console.error(`Diff is larger than ${MAX_DIFF_BYTES / 1024} KB. Split the change or scan via a pull request.`);
            return 2;
        }

        if (!options.jsonOutput) {
            console.error(`Scanning ${repoFullName} (diff vs ${mergeBaseSha.substring(0, 10)})…`);
        }

        const jobId = await submitScan({
            baseUrl: cliConfig.baseUrl,
            apiKey: cliConfig.apiKey,
            repoFullName,
            diff,
            baseSha: mergeBaseSha,
            headSha: resolveHeadSha(),
            dirty: true,
        });

        const finalPoll = await pollUntilDone({
            baseUrl: cliConfig.baseUrl,
            apiKey: cliConfig.apiKey,
            jobId,
            timeoutMs: options.timeoutSeconds * 1000,
        });

        if (finalPoll.status === 'error' || !finalPoll.result) {
            console.error(`Scan failed: ${finalPoll.error ?? 'unknown_error'}`);
            return 2;
        }

        if (options.jsonOutput) {
            console.log(JSON.stringify(finalPoll.result));
        } else {
            printHumanResult(finalPoll.result);
        }

        return exitCodeForFindings(finalPoll.result, options.failOn);
    } catch (scanError: unknown) {
        return reportScanError(scanError);
    }
}

function exitCodeForFindings(scanResult: ScanResult, failOn: FailOnLevel): number {
    if (failOn === 'none') return 0;

    const hasCritical = scanResult.issues.some((issue) => issue.severity === 'CRITICAL');
    const hasAnyFinding = scanResult.issues.length > 0;

    if (failOn === 'critical') return hasCritical ? 1 : 0;
    return hasAnyFinding ? 1 : 0;
}

function reportScanError(scanError: unknown): number {
    if (scanError instanceof GitError || scanError instanceof ApiError) {
        console.error(scanError.message);
        if (scanError instanceof ApiError && scanError.httpStatus === 404) {
            console.error('Hint: this repository must be connected in the Gatekeeper dashboard first.');
        }
        if (scanError instanceof ApiError && scanError.httpStatus === 401) {
            console.error('Hint: check your API key (unslop login) — it may be revoked.');
        }
        return 2;
    }
    console.error(`Unexpected error: ${(scanError as Error).message}`);
    return 2;
}
