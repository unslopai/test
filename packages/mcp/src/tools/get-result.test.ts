/**
 * unslop_get_result-Tests (MCP_SPEC.md §3.5): terminales Ergebnis mit Score
 * und rerollNotice, job_stalled als typed error, Budget-Ablauf liefert die
 * aktuelle Phase samt Poll-again-Hinweis.
 */
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@unslop/shared/node';
import { runGetResultTool } from './get-result.js';
import type { ToolDeps } from '../tool-deps.js';
import type { ScanPollResponse, ScanResult } from '@unslop/shared';

const COMPLETE_RESULT_FIXTURE: ScanResult = {
    hasSlop: true,
    issues: [{
        id: 'd'.repeat(16),
        rule: 'ARCH-002 (Strict Validation Boundary)',
        severity: 'CRITICAL',
        path: 'src/lib/webhook.ts',
        line: 8,
        endLine: 8,
        exactQuote: 'const parsed = payload as unknown as WebhookEvent;',
        critique: 'Type capitulation bypasses the validation boundary.',
    }],
    summary: 'One violation found.',
    filesReviewed: 2,
    outcome: 'reviewed',
    omittedFiles: [],
    cognitiveIntegrityScore: 88,
};

function buildDeps(fetchScanStatusMock: ToolDeps['api']['fetchScanStatus']): ToolDeps {
    return {
        api: {
            submitScan: vi.fn(),
            fetchScanStatus: fetchScanStatusMock,
            connectRepo: vi.fn(),
            fetchRepoStatus: vi.fn(),
            submitPrReview: vi.fn(),
            resolveFinding: vi.fn(),
        },
        resolveRepoContext: vi.fn() as unknown as ToolDeps['resolveRepoContext'],
        resolveRepoIdentity: vi.fn() as unknown as ToolDeps['resolveRepoIdentity'],
        buildDiff: vi.fn() as unknown as ToolDeps['buildDiff'],
        baseUrl: 'https://unslop.codes',
        rerollLimit: 3,
        waitMs: vi.fn().mockResolvedValue(undefined),
    };
}

function parseSafeSection(toolResultText: string): Record<string, unknown> {
    const [safeSection] = toolResultText.split('<unslop-findings');
    return JSON.parse(safeSection) as Record<string, unknown>;
}

describe('unslop_get_result', () => {
    it('returns the complete result with score, findings, and the reroll notice untouched', async () => {
        const deps = buildDeps(vi.fn().mockResolvedValue({
            status: 'done',
            phase: 'complete',
            result: COMPLETE_RESULT_FIXTURE,
            rerollNotice: {
                attempts: 4,
                persistentRules: ['ARCH-002'],
                message: 'You have scanned this code 4 times…',
            },
        } satisfies ScanPollResponse));

        const toolResult = await runGetResultTool(deps, { jobId: 'job-under-test' });

        const safePayload = parseSafeSection(toolResult.content[0].text);
        expect(safePayload.phase).toBe('complete');
        expect(safePayload.cognitiveIntegrityScore).toBe(88);
        expect(safePayload.filesReviewed).toBe(2);
        expect((safePayload.rerollNotice as { attempts: number }).attempts).toBe(4);
        expect(safePayload.nextStep).toBeUndefined();
        // Model-authored Inhalte liegen im Envelope, nicht im Safe-Teil.
        expect(toolResult.content[0].text).toContain('<unslop-findings trust="untrusted-model-output">');
    });

    it("surfaces outcome 'nothing_reviewed' and the omitted files in the safe payload (ROADMAP §3)", async () => {
        const deps = buildDeps(vi.fn().mockResolvedValue({
            status: 'done',
            phase: 'complete',
            result: {
                hasSlop: false,
                issues: [],
                summary: 'All changed code files exceed the review size cap.',
                filesReviewed: 0,
                outcome: 'nothing_reviewed',
                omittedFiles: ['src/lib/huge-a.ts'],
                cognitiveIntegrityScore: null,
            },
        } satisfies ScanPollResponse));

        const toolResult = await runGetResultTool(deps, { jobId: 'job-under-test' });

        const safePayload = parseSafeSection(toolResult.content[0].text);
        expect(safePayload.outcome).toBe('nothing_reviewed');
        expect(safePayload.filesReviewed).toBe(0);
        expect(safePayload.omittedFiles).toEqual(['src/lib/huge-a.ts']);
    });

    it('maps a stalled job onto the retryable job_stalled error', async () => {
        const deps = buildDeps(vi.fn().mockResolvedValue({
            status: 'error',
            phase: 'submitted',
            error: 'job_stalled',
        } satisfies ScanPollResponse));

        const toolResult = await runGetResultTool(deps, { jobId: 'job-under-test' });

        expect(toolResult.isError).toBe(true);
        const errorBody = JSON.parse(toolResult.content[0].text) as { error: { code: string; retryable: boolean } };
        expect(errorBody.error.code).toBe('job_stalled');
        expect(errorBody.error.retryable).toBe(true);
    });

    it('maps exhausted model capacity onto the retryable model_unavailable error, not "unreachable"', async () => {
        const deps = buildDeps(vi.fn().mockResolvedValue({
            status: 'error',
            phase: 'submitted',
            error: 'model_unavailable',
        } satisfies ScanPollResponse));

        const toolResult = await runGetResultTool(deps, { jobId: 'job-under-test' });

        const errorBody = JSON.parse(toolResult.content[0].text) as { error: { code: string; message: string; retryable: boolean } };
        expect(errorBody.error.code).toBe('model_unavailable');
        expect(errorBody.error.retryable).toBe(true);
        expect(errorBody.error.message).toContain('Wait about a minute');
    });

    it('maps a server-side time limit onto the retryable review_timeout error', async () => {
        const deps = buildDeps(vi.fn().mockResolvedValue({
            status: 'error',
            phase: 'submitted',
            error: 'review_timeout',
        } satisfies ScanPollResponse));

        const toolResult = await runGetResultTool(deps, { jobId: 'job-under-test' });

        const errorBody = JSON.parse(toolResult.content[0].text) as { error: { code: string; retryable: boolean } };
        expect(errorBody.error.code).toBe('review_timeout');
        expect(errorBody.error.retryable).toBe(true);
    });

    it('returns the deterministic partial with a poll-again hint when the budget elapses', async () => {
        const deps = buildDeps(vi.fn().mockResolvedValue({
            status: 'processing',
            phase: 'deterministic',
            partialResult: COMPLETE_RESULT_FIXTURE,
        } satisfies ScanPollResponse));

        const toolResult = await runGetResultTool(deps, { jobId: 'job-under-test' });

        const safePayload = parseSafeSection(toolResult.content[0].text);
        expect(safePayload.phase).toBe('deterministic');
        expect(safePayload.nextStep).toContain('Call unslop_get_result again');
        expect((safePayload.findings as unknown[]).length).toBe(1);
    });

    it('maps a 401 on the poll to not_authenticated', async () => {
        const deps = buildDeps(vi.fn().mockRejectedValue(new ApiError('invalid_api_key', 401)));

        const toolResult = await runGetResultTool(deps, { jobId: 'job-under-test' });

        const errorBody = JSON.parse(toolResult.content[0].text) as { error: { code: string } };
        expect(errorBody.error.code).toBe('not_authenticated');
    });
});
