/**
 * PreScannerStep-Tests — Soft-Launch Fail-Safe Gate (pre_scanner_design.md §5.4)
 * und das Lane-Mapping (§4/§5.1): Findings landen in prescanIssues, nie in
 * context.issues; ein Prescan-Fehler degradiert nie unter Vor-Prescan-Verhalten.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPipelineContext, buildPullRequestFile, buildReviewIssue } from '@/lib/pipeline/testing/context-fixture';
import { collectReportableIssues } from '@/lib/pipeline/helpers';
import type { PrescanFinding, PrescanResult } from '@unslop/prescan';

import { InternalPrescanError } from '@/lib/prescan/internal-contract';

const { runPrescanMock, loadPrescanFilesMock, partialUpdateMock, partialUpdateEqMock } = vi.hoisted(() => ({
    runPrescanMock: vi.fn(),
    loadPrescanFilesMock: vi.fn(),
    partialUpdateMock: vi.fn(),
    partialUpdateEqMock: vi.fn(),
}));

// Seit der Standalone-Invocation (ROADMAP §1b) ruft der Step die Engines nicht
// mehr selbst, sondern POST /api/internal/prescan über den internal-client.
vi.mock('@/lib/prescan/internal-client', () => ({ requestInternalPrescan: runPrescanMock }));
vi.mock('@/lib/prescan/file-content-loader', () => ({ loadPrescanFiles: loadPrescanFilesMock }));
// Partial-Write-Grenze (MCP_SPEC.md §4.1): from('review_jobs').update(...).eq('id', jobId)
vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({ update: partialUpdateMock }),
    },
}));

// Import NACH den Mocks, damit der Step die gemockten Module sieht.
const { preScannerStep } = await import('@/lib/pipeline/steps/pre-scanner-step');

function buildPrescanFinding(overrides: Partial<PrescanFinding> = {}): PrescanFinding {
    return {
        ruleId: 'SEC-029',
        ruleTitle: 'Banned libc API',
        severity: 'CRITICAL',
        path: 'src/native/buffer.c',
        line: 12,
        endLine: 12,
        exactQuote: 'strcpy(destinationBuffer, sourceInput);',
        explanation: 'This libc function has no bounds checking.',
        fixTemplate: 'strcpy→strlcpy/snprintf',
        engine: 'regex',
        fileLevel: false,
        ...overrides,
    };
}

function buildPrescanResult(findings: readonly PrescanFinding[]): PrescanResult {
    return {
        findings,
        filesScanned: 1,
        filesSkipped: [],
        skippedChecks: [],
        rulesEvaluated: 42,
        rulesDisabled: [],
        durationMs: 250,
        engineVersions: { prescanCore: '0.1.0', treeSitter: 'test', grammars: 'test', eslint: 'test' },
    };
}

function resetPartialWriteMocks(): void {
    partialUpdateMock.mockReset();
    partialUpdateEqMock.mockReset();
    partialUpdateMock.mockImplementation(() => ({ eq: partialUpdateEqMock }));
    partialUpdateEqMock.mockResolvedValue({ error: null });
}

describe('preScannerStep', () => {
    beforeEach(() => {
        runPrescanMock.mockReset();
        loadPrescanFilesMock.mockReset();
        loadPrescanFilesMock.mockResolvedValue([]);
        resetPartialWriteMocks();
    });

    it('maps findings into the prescanIssues lane with source pre-scanner and confidence 100', async () => {
        runPrescanMock.mockResolvedValue(buildPrescanResult([buildPrescanFinding()]));
        const initialContext = buildPipelineContext({
            prFiles: [buildPullRequestFile({ filename: 'src/native/buffer.c' })],
        });

        const enrichedContext = await preScannerStep.execute(initialContext);

        expect(enrichedContext.prescanIssues).toHaveLength(1);
        expect(enrichedContext.prescanIssues[0]).toMatchObject({
            rule: 'SEC-029 (Banned libc API)',
            severity: 'CRITICAL',
            source: 'pre-scanner',
            confidence: 100,
            fixedCodeSnippet: 'strcpy→strlcpy/snprintf',
        });
        // PROC-001-Lane-Garantie: die LLM-Issue-Liste bleibt unberührt.
        expect(enrichedContext.issues).toHaveLength(0);
        expect(enrichedContext.prescanStats?.degraded).toBe(false);
        expect(enrichedContext.prescanStats?.criticalCount).toBe(1);
    });

    it('absorbs ANY step failure: degraded stats, empty lane, pipeline continues (§5.4)', async () => {
        loadPrescanFilesMock.mockRejectedValue(new Error('GitHub blob fetch timed out'));
        const initialContext = buildPipelineContext({
            prFiles: [buildPullRequestFile()],
        });

        const degradedContext = await preScannerStep.execute(initialContext);

        expect(degradedContext.prescanIssues).toHaveLength(0);
        expect(degradedContext.llmSkipped).toBe(false);
        expect(degradedContext.shouldAbort).toBe(false);
        expect(degradedContext.prescanStats).toMatchObject({
            degraded: true,
            degradedReason: 'GitHub blob fetch timed out',
            findingsCount: 0,
            skippedChecks: [{ ruleId: '*', reason: 'step-failure' }],
        });
    });

    it('absorbs a 5xx from the internal prescan route the same way (engine crash remote)', async () => {
        runPrescanMock.mockRejectedValue(
            new InternalPrescanError('Prescan-Route antwortete mit HTTP 500.', 'http', 500),
        );

        const degradedContext = await preScannerStep.execute(buildPipelineContext({
            prFiles: [buildPullRequestFile()],
        }));

        expect(degradedContext.prescanStats?.degraded).toBe(true);
        expect(degradedContext.prescanStats?.degradedReason).toContain('HTTP 500');
        // Degradation triggert NIE den Short-Circuit — LLM-Review läuft.
        expect(degradedContext.llmSkipped).toBe(false);
    });

    it('absorbs an HTTP timeout of the internal route: degraded, job never errors', async () => {
        runPrescanMock.mockRejectedValue(
            new InternalPrescanError('Prescan-Route hat nach 30000ms nicht geantwortet.', 'timeout'),
        );

        const degradedContext = await preScannerStep.execute(buildPipelineContext({
            prFiles: [buildPullRequestFile()],
        }));

        expect(degradedContext.prescanIssues).toHaveLength(0);
        expect(degradedContext.shouldAbort).toBe(false);
        expect(degradedContext.prescanStats).toMatchObject({
            degraded: true,
            degradedReason: 'Prescan-Route hat nach 30000ms nicht geantwortet.',
            skippedChecks: [{ ruleId: '*', reason: 'step-failure' }],
        });
    });

    it('forwards files, config and job coordinates to the internal route', async () => {
        runPrescanMock.mockResolvedValue(buildPrescanResult([]));
        const loadedFiles = [{ path: 'src/a.ts', content: 'const a = 1;', patch: '@@ -0,0 +1 @@\n+const a = 1;' }];
        loadPrescanFilesMock.mockResolvedValue(loadedFiles);

        await preScannerStep.execute(buildPipelineContext({
            prFiles: [buildPullRequestFile({ filename: 'src/a.ts' })],
            repoFullName: 'unslopai/test33',
            headSha: 'abc1234',
        }));

        expect(runPrescanMock).toHaveBeenCalledWith(expect.objectContaining({
            files: loadedFiles,
            repoFullName: 'unslopai/test33',
            headSha: 'abc1234',
        }));
    });

    it('respects shouldAbort and does not scan', async () => {
        const abortedContext = buildPipelineContext({ shouldAbort: true });

        const passedThroughContext = await preScannerStep.execute(abortedContext);

        expect(passedThroughContext).toBe(abortedContext);
        expect(runPrescanMock).not.toHaveBeenCalled();
    });

    it('filters generated paths before content loading', async () => {
        runPrescanMock.mockResolvedValue(buildPrescanResult([]));
        await preScannerStep.execute(buildPipelineContext({
            prFiles: [
                buildPullRequestFile({ filename: 'package-lock.json' }),
                buildPullRequestFile({ filename: 'dist/bundle.min.js' }),
                buildPullRequestFile({ filename: 'src/lib/service.ts' }),
            ],
        }));

        const loadedFileNames = loadPrescanFilesMock.mock.calls[0][0].files
            .map((file: { filename: string }) => file.filename);
        expect(loadedFileNames).toEqual(['src/lib/service.ts']);
    });
});

describe('preScannerStep — early partial results (MCP_SPEC §4.1)', () => {
    beforeEach(() => {
        runPrescanMock.mockReset();
        loadPrescanFilesMock.mockReset();
        loadPrescanFilesMock.mockResolvedValue([]);
        resetPartialWriteMocks();
    });

    it('writes partial_result with phase deterministic and id-carrying findings', async () => {
        runPrescanMock.mockResolvedValue(buildPrescanResult([buildPrescanFinding()]));

        await preScannerStep.execute(buildPipelineContext({
            prFiles: [buildPullRequestFile({ filename: 'src/native/buffer.c' })],
        }));

        expect(partialUpdateEqMock).toHaveBeenCalledWith('id', 'job-under-test');
        const [partialUpdatePayload] = partialUpdateMock.mock.calls[0] as [{
            partial_result: {
                phase: string;
                review: { has_slop: boolean; issues: { id?: string }[]; summary: string };
                prescan: { findingsCount: number };
            };
        }];
        expect(partialUpdatePayload.partial_result.phase).toBe('deterministic');
        expect(partialUpdatePayload.partial_result.review.has_slop).toBe(true);
        expect(partialUpdatePayload.partial_result.review.summary).toBe(
            '1 deterministic findings; LLM analysis running.',
        );
        // §4.2: die IDs müssen schon im Partial hängen — collectReportableIssues
        // läuft erst am Pipeline-Ende.
        expect(partialUpdatePayload.partial_result.review.issues[0].id).toMatch(/^[0-9a-f]{16}$/);
        expect(partialUpdatePayload.partial_result.prescan.findingsCount).toBe(1);
    });

    it('keeps the findings and continues when the partial write reports an error (fail-soft)', async () => {
        runPrescanMock.mockResolvedValue(buildPrescanResult([buildPrescanFinding()]));
        partialUpdateEqMock.mockResolvedValue({ error: { message: 'permission denied' } });

        const enrichedContext = await preScannerStep.execute(buildPipelineContext({
            prFiles: [buildPullRequestFile({ filename: 'src/native/buffer.c' })],
        }));

        expect(enrichedContext.prescanIssues).toHaveLength(1);
        expect(enrichedContext.prescanStats?.degraded).toBe(false);
        expect(enrichedContext.shouldAbort).toBe(false);
    });

    it('keeps the findings and continues when the partial write throws (fail-soft)', async () => {
        runPrescanMock.mockResolvedValue(buildPrescanResult([buildPrescanFinding()]));
        partialUpdateEqMock.mockRejectedValue(new Error('network dropped'));

        const enrichedContext = await preScannerStep.execute(buildPipelineContext({
            prFiles: [buildPullRequestFile({ filename: 'src/native/buffer.c' })],
        }));

        expect(enrichedContext.prescanIssues).toHaveLength(1);
        expect(enrichedContext.prescanStats?.degraded).toBe(false);
    });
});

describe('preScannerStep — short-circuit (§5.3)', () => {
    beforeEach(() => {
        runPrescanMock.mockReset();
        loadPrescanFilesMock.mockReset();
        loadPrescanFilesMock.mockResolvedValue([]);
        resetPartialWriteMocks();
    });

    function buildShortCircuitContext(minCriticalFindings: number, mode: 'off' | 'critical' = 'critical') {
        return buildPipelineContext({
            prFiles: [buildPullRequestFile({ filename: 'src/native/buffer.c' })],
            prescanConfig: {
                ruleOverrides: {},
                shortCircuit: { mode, minCriticalFindings },
                registryChecks: false,
                maxFileBytes: 262144,
                totalBudgetMs: 15000,
            },
        });
    }

    it('skips the LLM review when critical findings reach the threshold', async () => {
        runPrescanMock.mockResolvedValue(buildPrescanResult([
            buildPrescanFinding({ line: 12 }),
            buildPrescanFinding({ line: 30, ruleId: 'SEC-027', ruleTitle: 'Unbounded %s in scanf' }),
        ]));

        const shortCircuitedContext = await preScannerStep.execute(buildShortCircuitContext(2));

        expect(shortCircuitedContext.llmSkipped).toBe(true);
        expect(shortCircuitedContext.prescanStats?.llmSkipped).toBe(true);
        expect(shortCircuitedContext.reviewSummary).toBe(
            'LLM review skipped: 2 critical structural violations found by the deterministic pre-scanner. Fix these first.',
        );
    });

    it('does not skip below the threshold and leaves the summary untouched', async () => {
        runPrescanMock.mockResolvedValue(buildPrescanResult([buildPrescanFinding()]));

        const scannedContext = await preScannerStep.execute(buildShortCircuitContext(2));

        expect(scannedContext.llmSkipped).toBe(false);
        expect(scannedContext.prescanStats?.llmSkipped).toBe(false);
        expect(scannedContext.reviewSummary).toBe('');
    });

    it('never skips in mode "off", regardless of finding count', async () => {
        runPrescanMock.mockResolvedValue(buildPrescanResult([
            buildPrescanFinding({ line: 1 }),
            buildPrescanFinding({ line: 2 }),
            buildPrescanFinding({ line: 3 }),
        ]));

        const scannedContext = await preScannerStep.execute(buildShortCircuitContext(1, 'off'));

        expect(scannedContext.llmSkipped).toBe(false);
    });

    it('WARNING-only findings never trigger the short-circuit', async () => {
        runPrescanMock.mockResolvedValue(buildPrescanResult([
            buildPrescanFinding({ severity: 'WARNING', ruleId: 'MAINT-005', ruleTitle: 'Overblanking' }),
        ]));

        const scannedContext = await preScannerStep.execute(buildShortCircuitContext(1));

        expect(scannedContext.llmSkipped).toBe(false);
    });
});

describe('collectReportableIssues — lane merge (§5.1)', () => {
    it('prepends prescan issues and drops colliding LLM duplicates', () => {
        const prescanIssue = buildReviewIssue({
            rule: 'SEC-029 (Banned libc API)',
            path: 'src/native/buffer.c',
            line: 12,
            endLine: 12,
            source: 'pre-scanner',
        });
        const duplicateLlmIssue = buildReviewIssue({
            rule: 'SEC-029 (unsafe strcpy)',
            path: 'src/native/buffer.c',
            line: 12,
            endLine: 13,
            source: 'draft-reviewer',
        });
        const independentLlmIssue = buildReviewIssue({
            rule: 'Condition 3 (Lexical Slop)',
            path: 'src/lib/example.ts',
            source: 'draft-reviewer',
        });

        const mergedIssues = collectReportableIssues(buildPipelineContext({
            prescanIssues: [prescanIssue],
            issues: [duplicateLlmIssue, independentLlmIssue],
        }));

        // Der Merge-Punkt vergibt zusätzlich die stabilen Finding-IDs (§4.2).
        expect(mergedIssues).toHaveLength(2);
        expect(mergedIssues[0]).toMatchObject(prescanIssue);
        expect(mergedIssues[1]).toMatchObject(independentLlmIssue);
    });

    it('drops an LLM issue that matches a prescan finding exactly on (path, line, ruleId)', () => {
        const prescanIssue = buildReviewIssue({
            rule: 'MAINT-001 (Empty catch/except block)',
            path: 'src/lib/sync.ts',
            line: 88,
            endLine: 88,
            source: 'pre-scanner',
            confidence: 100,
        });
        const identicalLlmIssue = buildReviewIssue({
            rule: 'MAINT-001 (Silent error swallowing)',
            path: 'src/lib/sync.ts',
            line: 88,
            endLine: 88,
            source: 'draft-reviewer',
            confidence: 72,
        });

        const mergedIssues = collectReportableIssues(buildPipelineContext({
            prescanIssues: [prescanIssue],
            issues: [identicalLlmIssue],
        }));

        // Das deterministische Finding gewinnt — inklusive seiner Confidence 100.
        expect(mergedIssues).toHaveLength(1);
        expect(mergedIssues[0]).toMatchObject(prescanIssue);
        expect(mergedIssues[0].source).toBe('pre-scanner');
    });

    it('keeps both lanes when rules or files differ', () => {
        const prescanIssue = buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', source: 'pre-scanner' });
        const llmIssueSameLine = buildReviewIssue({ rule: 'Condition 7 (Derived State)', source: 'draft-reviewer' });

        const mergedIssues = collectReportableIssues(buildPipelineContext({
            prescanIssues: [prescanIssue],
            issues: [llmIssueSameLine],
        }));

        expect(mergedIssues).toHaveLength(2);
    });
});
