/**
 * unslop_get_result (MCP_SPEC.md §3.5): retrieve the full review for a jobId.
 *
 * Waits up to 25s per call for the terminal result (2s interval) — long enough
 * to often finish a fast cascade in one call, short enough to stay inside MCP
 * client tool timeouts. If the pipeline is still running when the budget
 * elapses, the current phase is returned and the agent polls again, exactly as
 * the tool description instructs.
 */
import { buildEnvelopedResponseText, splitFindings } from '../envelope.js';
import { mapApiError, pollFailureToToolError, toolErrorResult } from '../errors.js';
import type { McpToolResult } from '../errors.js';
import type { ToolDeps } from '../tool-deps.js';
import type { ScanPollResponse } from '@unslop/shared';

const RESULT_POLL_BUDGET_MS = 25_000;
const RESULT_POLL_INTERVAL_MS = 2_000;

export interface GetResultToolArgs {
    readonly jobId: string;
}

export async function runGetResultTool(
    deps: ToolDeps,
    toolArgs: GetResultToolArgs,
): Promise<McpToolResult> {
    let latestPoll: ScanPollResponse;

    for (let elapsedMs = 0; ; elapsedMs += RESULT_POLL_INTERVAL_MS) {
        try {
            latestPoll = await deps.api.fetchScanStatus(toolArgs.jobId);
        } catch (pollError: unknown) {
            return toolErrorResult(mapApiError(pollError, deps.baseUrl));
        }

        if (latestPoll.status === 'done' || latestPoll.status === 'error') break;
        if (elapsedMs >= RESULT_POLL_BUDGET_MS) break;
        await deps.waitMs(RESULT_POLL_INTERVAL_MS);
    }

    if (latestPoll.status === 'error') {
        return toolErrorResult(pollFailureToToolError(latestPoll.error));
    }

    return buildResultResponse(toolArgs.jobId, latestPoll);
}

function buildResultResponse(jobId: string, pollResponse: ScanPollResponse): McpToolResult {
    const scanResult = pollResponse.result ?? pollResponse.partialResult ?? null;
    const issues = scanResult?.issues ?? [];
    const { safeFindings, untrustedFindings } = splitFindings(issues);

    const safePayload = {
        jobId,
        phase: pollResponse.phase,
        status: pollResponse.status,
        findings: safeFindings,
        filesReviewed: scanResult?.filesReviewed ?? 0,
        // Honesty contract (ROADMAP §3): zero findings with outcome
        // 'nothing_reviewed' means the review never ran — not a clean verdict.
        // 'deterministic_only' means no model read the diff, only the
        // deterministic pre-scanner ran (LANGUAGE_COVERAGE_SPEC §6.2).
        outcome: scanResult?.outcome ?? null,
        omittedFiles: scanResult?.omittedFiles ?? [],
        cognitiveIntegrityScore: scanResult?.cognitiveIntegrityScore ?? null,
        ...(pollResponse.rerollNotice ? { rerollNotice: pollResponse.rerollNotice } : {}),
        ...(pollResponse.phase !== 'complete'
            ? { nextStep: 'The LLM analysis is still running. Call unslop_get_result again with this jobId.' }
            : {}),
    };

    if (issues.length === 0 && !scanResult?.summary) {
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
