/**
 * unslop_scan-Tests (MCP_SPEC.md §10): 10s-Ceiling ⇒ phase 'submitted',
 * frühes Partial ⇒ phase 'deterministic', Secret-Refusal VOR jedem Upload,
 * Größen-Refusal mit den größten Dateien, Envelope-Trennung.
 */
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@unslop/shared/node';
import { runScanTool } from './scan.js';
import type { ToolDeps } from '../tool-deps.js';
import type { RepoContextResolution } from '../repo-context.js';
import type { ScanPollResponse, ScanResult } from '@unslop/shared';

const REPO_CONTEXT_FIXTURE: RepoContextResolution = {
    ok: true,
    context: {
        gitRoot: 'C:/fixtures/widgets',
        repoFullName: 'acme/widgets',
        mergeBase: 'a'.repeat(40),
        headSha: 'b'.repeat(40),
        isDirty: true,
    },
};

const HARMLESS_DIFF =
    'diff --git a/src/index.ts b/src/index.ts\n'
    + 'index 1111111..2222222 100644\n'
    + '--- a/src/index.ts\n'
    + '+++ b/src/index.ts\n'
    + '@@ -1,1 +1,2 @@\n'
    + ' const alpha = 1;\n'
    + '+const beta = 2;\n';

const PARTIAL_RESULT_FIXTURE: ScanResult = {
    hasSlop: true,
    issues: [{
        id: 'c'.repeat(16),
        rule: 'SEC-029 (Banned libc API)',
        severity: 'CRITICAL',
        path: 'src/native/buffer.c',
        line: 12,
        endLine: 12,
        exactQuote: 'strcpy(destinationBuffer, sourceInput);',
        critique: 'This libc function has no bounds checking.',
        fixedCodeSnippet: 'strlcpy(destinationBuffer, sourceInput, sizeof destinationBuffer);',
    }],
    summary: '1 deterministic findings; LLM analysis running.',
    filesReviewed: 0,
    // Partial eines laufenden Scans — kein Urteil, deshalb nie 'nothing_reviewed'.
    outcome: 'reviewed',
    omittedFiles: [],
    cognitiveIntegrityScore: null,
};

const PROCESSING_POLL: ScanPollResponse = { status: 'processing', phase: 'submitted' };

function buildApi(overrides: Partial<ToolDeps['api']> = {}): ToolDeps['api'] {
    return {
        submitScan: vi.fn().mockResolvedValue('job-under-test'),
        fetchScanStatus: vi.fn().mockResolvedValue(PROCESSING_POLL),
        connectRepo: vi.fn(),
        fetchRepoStatus: vi.fn(),
        submitPrReview: vi.fn(),
        resolveFinding: vi.fn(),
        ...overrides,
    };
}

function buildDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
    return {
        api: buildApi(),
        resolveRepoContext: () => REPO_CONTEXT_FIXTURE,
        resolveRepoIdentity: () => ({
            ok: true,
            gitRoot: 'C:/fixtures/widgets',
            repoFullName: 'acme/widgets',
            headSha: 'b'.repeat(40),
        }),
        buildDiff: () => HARMLESS_DIFF,
        baseUrl: 'https://unslop.codes',
        rerollLimit: 3,
        waitMs: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function parseSafeSection(toolResultText: string): Record<string, unknown> {
    const [safeSection] = toolResultText.split('<unslop-findings');
    return JSON.parse(safeSection) as Record<string, unknown>;
}

function parseErrorBody(toolResultText: string): { error: { code: string; message: string } } {
    return JSON.parse(toolResultText) as { error: { code: string; message: string } };
}

describe('unslop_scan — timing (MCP_SPEC §10)', () => {
    it("returns phase 'submitted' with the jobId at the 10s ceiling when no partial arrives", async () => {
        const deps = buildDeps();

        const toolResult = await runScanTool(deps, {});

        const safePayload = parseSafeSection(toolResult.content[0].text);
        expect(safePayload.phase).toBe('submitted');
        expect(safePayload.jobId).toBe('job-under-test');
        expect(safePayload.deepAnalysisPending).toBe(true);
        expect(safePayload.nextStep).toBe('Call unslop_get_result with this jobId for the LLM analysis.');
        // 10 Polls à 1s — das Budget aus §3.5.
        expect(deps.api.fetchScanStatus).toHaveBeenCalledTimes(10);
        expect(deps.waitMs).toHaveBeenCalledTimes(10);
    });

    it("returns early with phase 'deterministic' as soon as the partial lands", async () => {
        const fetchScanStatusMock = vi.fn()
            .mockResolvedValueOnce(PROCESSING_POLL)
            .mockResolvedValueOnce({
                status: 'processing',
                phase: 'deterministic',
                partialResult: PARTIAL_RESULT_FIXTURE,
            } satisfies ScanPollResponse);
        const deps = buildDeps({ api: buildApi({ fetchScanStatus: fetchScanStatusMock }) });

        const toolResult = await runScanTool(deps, {});

        const safePayload = parseSafeSection(toolResult.content[0].text);
        expect(safePayload.phase).toBe('deterministic');
        expect(safePayload.deepAnalysisPending).toBe(true);
        expect((safePayload.findings as unknown[]).length).toBe(1);
        expect(fetchScanStatusMock).toHaveBeenCalledTimes(2);
    });

    it("returns phase 'complete' when a short-circuited job finishes inside the budget", async () => {
        const deps = buildDeps({
            api: buildApi({
                fetchScanStatus: vi.fn().mockResolvedValue({
                    status: 'done',
                    phase: 'complete',
                    result: PARTIAL_RESULT_FIXTURE,
                } satisfies ScanPollResponse),
            }),
        });

        const toolResult = await runScanTool(deps, {});

        const safePayload = parseSafeSection(toolResult.content[0].text);
        expect(safePayload.phase).toBe('complete');
        expect(safePayload.deepAnalysisPending).toBe(false);
    });
});

describe('unslop_scan — envelope (MCP_SPEC §5.2)', () => {
    it('keeps model-authored fields inside the envelope and server fields outside', async () => {
        const deps = buildDeps({
            api: buildApi({
                fetchScanStatus: vi.fn().mockResolvedValue({
                    status: 'processing',
                    phase: 'deterministic',
                    partialResult: PARTIAL_RESULT_FIXTURE,
                } satisfies ScanPollResponse),
            }),
        });

        const toolResultText = (await runScanTool(deps, {})).content[0].text;
        const [safeSection, envelopeSection] = toolResultText.split('<unslop-findings trust="untrusted-model-output">');

        expect(safeSection).toContain('SEC-029');
        expect(safeSection).toContain('src/native/buffer.c');
        expect(safeSection).toContain('c'.repeat(16));
        expect(safeSection).not.toContain('bounds checking');
        expect(safeSection).not.toContain('strcpy(destinationBuffer');

        expect(envelopeSection).toContain('bounds checking');
        expect(envelopeSection).toContain('strlcpy');
        expect(envelopeSection).toContain('deterministic findings; LLM analysis running.');
    });
});

describe('unslop_scan — local refusals (MCP_SPEC §3.4)', () => {
    it('refuses with secret_detected naming path and line, and uploads NOTHING', async () => {
        const secretDiff =
            'diff --git a/src/config.ts b/src/config.ts\n'
            + '--- a/src/config.ts\n'
            + '+++ b/src/config.ts\n'
            + '@@ -1,1 +1,2 @@\n'
            + ' const alpha = 1;\n'
            + '+const awsSecret = "AKIAABCDEFGHIJKLMNOP";\n';
        const deps = buildDeps({ buildDiff: () => secretDiff });

        const toolResult = await runScanTool(deps, {});

        expect(toolResult.isError).toBe(true);
        const errorBody = parseErrorBody(toolResult.content[0].text);
        expect(errorBody.error.code).toBe('secret_detected');
        expect(errorBody.error.message).toContain('src/config.ts:2');
        expect(deps.api.submitScan).not.toHaveBeenCalled();
    });

    it('refuses an empty diff with no_changes', async () => {
        const deps = buildDeps({ buildDiff: () => '' });

        const toolResult = await runScanTool(deps, {});

        expect(parseErrorBody(toolResult.content[0].text).error.code).toBe('no_changes');
        expect(deps.api.submitScan).not.toHaveBeenCalled();
    });

    it('refuses an oversized diff with the byte count and the largest files', async () => {
        const oversizedFileBody = '+'.padEnd(200 * 1024, 'x');
        const oversizedDiff =
            `diff --git a/src/huge-one.ts b/src/huge-one.ts\n${oversizedFileBody}\n`
            + `diff --git a/src/huge-two.ts b/src/huge-two.ts\n${oversizedFileBody}\n`
            + 'diff --git a/src/tiny.ts b/src/tiny.ts\n+const tiny = true;\n';
        const deps = buildDeps({ buildDiff: () => oversizedDiff });

        const toolResult = await runScanTool(deps, {});

        const errorBody = parseErrorBody(toolResult.content[0].text);
        expect(errorBody.error.code).toBe('diff_too_large');
        expect(errorBody.error.message).toContain('the limit is 300 KB');
        expect(errorBody.error.message).toContain('src/huge-one.ts');
        expect(errorBody.error.message).toContain('src/huge-two.ts');
        expect(deps.api.submitScan).not.toHaveBeenCalled();
    });

    it('maps a repo-context failure onto the typed error contract', async () => {
        const deps = buildDeps({
            resolveRepoContext: () => ({ ok: false, failureKind: 'no_origin_remote', detail: 'no origin' }),
        });

        const toolResult = await runScanTool(deps, {});

        expect(parseErrorBody(toolResult.content[0].text).error.code).toBe('no_origin_remote');
    });

    it('forwards the paths narrowing into the diff builder', async () => {
        const buildDiffMock = vi.fn().mockReturnValue(HARMLESS_DIFF);
        const deps = buildDeps({ buildDiff: buildDiffMock });

        await runScanTool(deps, { paths: ['src/lib/only-this.ts'] });

        expect(buildDiffMock).toHaveBeenCalledWith(
            'C:/fixtures/widgets',
            'a'.repeat(40),
            ['src/lib/only-this.ts'],
        );
    });
});

describe('unslop_scan — wire failures (MCP_SPEC §6)', () => {
    it('maps a 402 submit failure to payment_required', async () => {
        const deps = buildDeps({
            api: buildApi({ submitScan: vi.fn().mockRejectedValue(new ApiError('no_subscription', 402)) }),
        });

        const toolResult = await runScanTool(deps, {});

        expect(parseErrorBody(toolResult.content[0].text).error.code).toBe('payment_required');
    });

    it('sends the configured rerollLimit with the submit', async () => {
        const submitScanMock = vi.fn().mockResolvedValue('job-under-test');
        const deps = buildDeps({
            api: buildApi({ submitScan: submitScanMock }),
            rerollLimit: 0,
        });

        await runScanTool(deps, {});

        expect(submitScanMock).toHaveBeenCalledWith(expect.objectContaining({
            repoFullName: 'acme/widgets',
            dirty: true,
            rerollLimit: 0,
        }));
    });
});
