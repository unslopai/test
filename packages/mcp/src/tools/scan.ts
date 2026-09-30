/**
 * unslop_scan (MCP_SPEC.md §3.5): build the working-tree diff, run the local
 * secret filter, submit to the hosted pipeline, then poll up to 10s for the
 * deterministic partial (§4.1). The 10s ceiling is a client-side budget chosen
 * to stay far inside every known MCP client's tool timeout — if it elapses the
 * agent still gets a jobId and loses nothing.
 */
import { GitError, findDiffUploadRefusal } from '@unslop/shared/node';
import { largestDiffFiles } from '../diff-stats.js';
import { buildEnvelopedResponseText, splitFindings } from '../envelope.js';
import { localToolError, mapApiError, pollFailureToToolError, toolErrorResult } from '../errors.js';
import type { McpToolResult, UnslopToolError } from '../errors.js';
import type { RepoContextFailureKind } from '../repo-context.js';
import type { ToolDeps } from '../tool-deps.js';
import type { ScanIssue, ScanPhase, ScanResult } from '@unslop/shared';

const PARTIAL_POLL_BUDGET_MS = 10_000;
const PARTIAL_POLL_INTERVAL_MS = 1_000;
const LARGEST_FILES_LISTED = 5;

export interface ScanToolArgs {
    readonly repoPath?: string;
    readonly paths?: readonly string[];
}

export async function runScanTool(deps: ToolDeps, toolArgs: ScanToolArgs): Promise<McpToolResult> {
    const repoResolution = deps.resolveRepoContext(toolArgs.repoPath);
    if (!repoResolution.ok) {
        return toolErrorResult(repoFailureToToolError(repoResolution.failureKind));
    }
    const repoContext = repoResolution.context;

    let workingTreeDiff: string;
    try {
        workingTreeDiff = deps.buildDiff(repoContext.gitRoot, repoContext.mergeBase, toolArgs.paths);
    } catch (diffError: unknown) {
        const detail = diffError instanceof GitError ? diffError.message : String(diffError);
        return toolErrorResult(localToolError('no_merge_base', detail));
    }

    const uploadRefusal = refuseUnsafeDiff(workingTreeDiff);
    if (uploadRefusal) {
        return toolErrorResult(uploadRefusal);
    }

    let jobId: string;
    try {
        jobId = await deps.api.submitScan({
            repoFullName: repoContext.repoFullName,
            diff: workingTreeDiff,
            baseSha: repoContext.mergeBase,
            headSha: repoContext.headSha,
            dirty: repoContext.isDirty,
            rerollLimit: deps.rerollLimit,
        });
    } catch (submitError: unknown) {
        return toolErrorResult(mapApiError(submitError, deps.baseUrl));
    }

    return pollForPartial(deps, jobId);
}

/**
 * Maps the shared upload policy (§3.4, emptiness, the 300 KB cap) onto this
 * server's typed tool errors. The policy itself lives in @unslop/shared/node
 * so the CLI enforces byte-identical rules (ROADMAP §13); only the wording
 * and the largest-files hint are MCP-specific.
 */
function refuseUnsafeDiff(workingTreeDiff: string): UnslopToolError | null {
    const uploadRefusal = findDiffUploadRefusal(workingTreeDiff);
    if (!uploadRefusal) return null;

    switch (uploadRefusal.kind) {
        case 'no_changes':
            return localToolError('no_changes', 'There are no changes to review against the merge-base.');
        case 'secret_detected':
            return localToolError(
                'secret_detected',
                `Upload blocked: a possible secret was found at `
                + `\`${uploadRefusal.firstMatch.path}:${uploadRefusal.firstMatch.line}\` `
                + `(${uploadRefusal.firstMatch.patternClass}). Remove it before scanning.`,
            );
        case 'diff_too_large': {
            const largestFilesSummary = largestDiffFiles(workingTreeDiff, LARGEST_FILES_LISTED)
                .map((diffFile) => `${diffFile.path} (${Math.ceil(diffFile.bytes / 1024)} KB)`)
                .join(', ');
            return localToolError(
                'diff_too_large',
                `The diff is ${Math.ceil(uploadRefusal.diffBytes / 1024)} KB; `
                + `the limit is ${uploadRefusal.limitBytes / 1024} KB. `
                + `Narrow the scan with \`paths\`. Largest files: ${largestFilesSummary}.`,
            );
        }
    }
}

/** Polls every 1s for up to 10s, returning as soon as the partial (or final) result lands. */
async function pollForPartial(deps: ToolDeps, jobId: string): Promise<McpToolResult> {
    for (let elapsedMs = 0; elapsedMs < PARTIAL_POLL_BUDGET_MS; elapsedMs += PARTIAL_POLL_INTERVAL_MS) {
        await deps.waitMs(PARTIAL_POLL_INTERVAL_MS);

        try {
            const pollResponse = await deps.api.fetchScanStatus(jobId);

            if (pollResponse.status === 'error') {
                return toolErrorResult(pollFailureToToolError(pollResponse.error));
            }
            if (pollResponse.status === 'done' && pollResponse.result) {
                return buildScanResponse(jobId, 'complete', pollResponse.result);
            }
            if (pollResponse.phase === 'deterministic' && pollResponse.partialResult) {
                return buildScanResponse(jobId, 'deterministic', pollResponse.partialResult);
            }
        } catch (pollError: unknown) {
            // The jobId is already valuable — a flaky poll degrades to 'submitted',
            // and unslop_get_result surfaces any persistent failure as a typed error.
            console.error(`[unslop-mcp] partial poll failed for job ${jobId}: ${(pollError as Error).message}`);
            break;
        }
    }

    return buildScanResponse(jobId, 'submitted', null);
}

function buildScanResponse(
    jobId: string,
    phase: ScanPhase,
    scanResult: ScanResult | null,
): McpToolResult {
    const issues: readonly ScanIssue[] = scanResult?.issues ?? [];
    const { safeFindings, untrustedFindings } = splitFindings(issues);

    const safePayload = {
        jobId,
        phase,
        deepAnalysisPending: phase !== 'complete',
        findings: safeFindings,
        nextStep: phase === 'complete'
            ? 'The review is complete; no deeper analysis is pending.'
            : 'Call unslop_get_result with this jobId for the LLM analysis.',
    };

    if (issues.length === 0) {
        return { content: [{ type: 'text', text: JSON.stringify(safePayload, null, 2) }] };
    }

    const untrustedPayload = {
        summary: scanResult?.summary ?? '',
        findings: untrustedFindings,
    };
    return {
        content: [{ type: 'text', text: buildEnvelopedResponseText(safePayload, untrustedPayload) }],
    };
}

function repoFailureToToolError(failureKind: RepoContextFailureKind): UnslopToolError {
    switch (failureKind) {
        case 'no_cwd':
        case 'not_a_git_repo':
            return localToolError('not_a_git_repo', 'The current directory is not a git repository. Pass repoPath.');
        case 'no_origin_remote':
            return localToolError('no_origin_remote', 'This repository has no `origin` remote, so unslop cannot identify it.');
        case 'detached_or_no_merge_base':
            return localToolError('no_merge_base', 'Cannot determine a merge-base against the default branch.');
    }
}
