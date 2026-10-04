/**
 * SecondOpinionReviewerStep (LLM_LANE_QUALITY_SPEC §4): Skip-Pfade,
 * Budget-Gate (D11), additive Findings + Dedupe, Summary-Honesty und die
 * D10-Degradation. Gemockt sind nur die Systemgrenzen (Law, Budget-RPC,
 * Reviewer-Pass, Telemetrie) — die Trigger-Logik laeuft echt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallBudgetExhaustedError } from '@/lib/pipeline/vertex-retry';
import {
    buildCascadeState,
    buildPipelineContext,
    buildPullRequestFile,
    buildReviewIssue,
} from '@/lib/pipeline/testing/context-fixture';

const consumeProEscalationBudget = vi.fn();
const recordLlmCall = vi.fn();
const runReviewerPass = vi.fn();

vi.mock('@/lib/billing/entitlements', () => ({
    consumeProEscalationBudget: (...args: unknown[]) => consumeProEscalationBudget(...args),
}));
vi.mock('@/lib/telemetry/llm-call-log', () => ({
    recordLlmCall: (...args: unknown[]) => recordLlmCall(...args),
}));
vi.mock('@/lib/pipeline/reviewer-call', () => ({
    runReviewerPass: (...args: unknown[]) => runReviewerPass(...args),
}));
vi.mock('@/lib/law', () => ({
    fetchRenderedLawBlock: vi.fn().mockResolvedValue({ lawBlock: 'law', ruleIds: ['SEC-001'] }),
}));
vi.mock('@/lib/pipeline/context-cache', () => ({
    resolvePromptEnvelope: vi.fn().mockResolvedValue({ plan: { cacheStatus: 'inline' }, role: 'escalation' }),
}));

const { secondOpinionReviewerStep } = await import(
    '@/lib/pipeline/steps/second-opinion-reviewer-step'
);

/** Kontext, in dem T2 (prescan-divergence) sicher feuert. */
function buildTriggeringContext(overrides: Parameters<typeof buildPipelineContext>[0] = {}) {
    return buildPipelineContext({
        reviewableFiles: [buildPullRequestFile({ filename: 'src/native/session.c' })],
        issues: [],
        prescanIssues: [
            buildReviewIssue({ rule: 'SEC-027 (gets)', path: 'src/native/session.c', source: 'pre-scanner' }),
            buildReviewIssue({ rule: 'SEC-028 (system)', path: 'src/native/session.c', source: 'pre-scanner' }),
            buildReviewIssue({ rule: 'SEC-029 (strcpy)', path: 'src/native/session.c', source: 'pre-scanner' }),
        ],
        reviewSummary: 'No AI slop found.',
        ...overrides,
    });
}

function buildPassResult(issues: ReturnType<typeof buildReviewIssue>[]) {
    return {
        aggregatedIssues: issues,
        summary: 'Pro found real problems in the native session handling.',
        hasSlop: issues.length > 0,
        callUsage: { promptTokens: 1000, cachedTokens: 0, outputTokens: 200, model: 'gemini-3.1-pro-preview' },
        effectiveCacheStatus: 'inline',
        rejectedCount: 0,
        scopeFilteredCount: 0,
        preAggregationIssueCount: issues.length,
    };
}

beforeEach(() => {
    consumeProEscalationBudget.mockReset().mockResolvedValue(true);
    recordLlmCall.mockReset().mockResolvedValue(undefined);
    runReviewerPass.mockReset();
});

describe('Skip-Pfade', () => {
    it('tut nichts auf der pro-direct-Route (Pro hat alles gesehen)', async () => {
        const context = buildTriggeringContext({ cascade: buildCascadeState({ route: 'pro-direct' }) });
        const result = await secondOpinionReviewerStep.execute(context);
        expect(result).toBe(context);
        expect(consumeProEscalationBudget).not.toHaveBeenCalled();
    });

    it('tut nichts ohne Trigger — und verbraucht kein Budget', async () => {
        const context = buildPipelineContext({
            reviewableFiles: [buildPullRequestFile()],
            issues: [buildReviewIssue()],
        });
        const result = await secondOpinionReviewerStep.execute(context);
        expect(result).toBe(context);
        expect(consumeProEscalationBudget).not.toHaveBeenCalled();
        expect(runReviewerPass).not.toHaveBeenCalled();
    });

    it('tut nichts bei llmSkipped (Short-Circuit)', async () => {
        const context = buildTriggeringContext({ llmSkipped: true });
        expect(await secondOpinionReviewerStep.execute(context)).toBe(context);
        expect(consumeProEscalationBudget).not.toHaveBeenCalled();
    });
});

describe('Budget-Gate (D11)', () => {
    it('degradiert ehrlich bei erschoepftem Budget und schreibt die Telemetrie-Zeile', async () => {
        consumeProEscalationBudget.mockResolvedValue(false);
        const result = await secondOpinionReviewerStep.execute(buildTriggeringContext());

        expect(result.cascade.degradations).toContain('pro_budget_exhausted');
        expect(result.issues).toHaveLength(0);
        expect(runReviewerPass).not.toHaveBeenCalled();
        expect(recordLlmCall).toHaveBeenCalledWith(expect.objectContaining({
            phase: 'escalate_second_opinion',
            status: 'skipped_budget',
        }));
    });
});

describe('Erfolgs-Pfad', () => {
    it('haengt deduplizierte Findings ans ENDE, markiert die Eskalation und ersetzt die Clean-Summary', async () => {
        const freshFinding = buildReviewIssue({
            rule: 'SEC-001 (Unbounded copy)', path: 'src/native/session.c', source: 'second-opinion-reviewer',
        });
        const duplicateOfPrescan = buildReviewIssue({
            rule: 'SEC-027 (Banned input API)', path: 'src/native/session.c', source: 'second-opinion-reviewer',
        });
        runReviewerPass.mockResolvedValue(buildPassResult([freshFinding, duplicateOfPrescan]));

        const result = await secondOpinionReviewerStep.execute(buildTriggeringContext());

        expect(result.issues).toEqual([freshFinding]);
        expect(result.cascade.escalated).toBe(true);
        expect(result.cascade.escalationReason).toBe('second_opinion');
        expect(result.reviewSummary).toBe('Pro found real problems in the native session handling.');
        expect(result.tokenUsage?.promptTokens).toBe(1000);
        expect(runReviewerPass).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            telemetryPhase: 'escalate_second_opinion',
            issueSource: 'second-opinion-reviewer',
            adoptSelfReportedConfidence: true,
        }));
    });

    it('laesst eine bestehende Draft-Summary und einen bestehenden escalationReason unangetastet', async () => {
        const draftIssue = buildReviewIssue({ path: 'src/payments/iban.ts' });
        runReviewerPass.mockResolvedValue(buildPassResult([
            buildReviewIssue({ rule: 'TEST-003 (Happy path only)', path: 'tests/payments/iban.test.ts', source: 'second-opinion-reviewer' }),
        ]));

        const result = await secondOpinionReviewerStep.execute(buildTriggeringContext({
            reviewableFiles: [
                buildPullRequestFile({ filename: 'tests/payments/iban.test.ts' }),
                buildPullRequestFile({ filename: 'src/payments/iban.ts' }),
            ],
            issues: [draftIssue],
            prescanIssues: [],
            reviewSummary: 'AI slop detected: generic naming.',
            cascade: buildCascadeState({ escalationReason: 'uncertain_claims' }),
        }));

        expect(result.issues[0]).toBe(draftIssue);
        expect(result.issues).toHaveLength(2);
        expect(result.reviewSummary).toBe('AI slop detected: generic naming.');
        expect(result.cascade.escalationReason).toBe('uncertain_claims');
    });
});

describe('D10 — Pro-Fehler degradiert, nie ein Job-Fehler', () => {
    it('faengt einen Reviewer-Pass-Fehler als pro_api_error-Degradation', async () => {
        runReviewerPass.mockRejectedValue(new Error('vertex 500'));
        const context = buildTriggeringContext();

        const result = await secondOpinionReviewerStep.execute(context);

        expect(result.cascade.degradations).toContain('pro_api_error');
        expect(result.issues).toEqual(context.issues);
        expect(result.reviewSummary).toBe(context.reviewSummary);
    });
});

describe('Deadline Guard (DEADLINE_GUARD_SPEC D4/D13)', () => {
    it('unter 80 s Rest: Zweitmeinung übersprungen, KEIN Pro-Kontingent verbraucht', async () => {
        const context = buildTriggeringContext({ deadlineAtMs: Date.now() + 79_000 });

        const skippedContext = await secondOpinionReviewerStep.execute(context);

        expect(consumeProEscalationBudget, 'Zeit-Skip verbraucht kein Pro-Kontingent').not.toHaveBeenCalled();
        expect(runReviewerPass, 'kein Second-Opinion-Call unter der 80-s-Schwelle').not.toHaveBeenCalled();
        expect(skippedContext.cascade.skippedStages, 'Second Opinion als übersprungen markiert').toEqual(['second_opinion']);
        expect(recordLlmCall, 'skipped_deadline-Telemetriezeile geschrieben').toHaveBeenCalledWith(
            expect.objectContaining({ phase: 'escalate_second_opinion', status: 'skipped_deadline' }),
        );
        expect(skippedContext.cascade.degradations, 'Degradation time_budget_exhausted').toEqual(['time_budget_exhausted']);
    });

    it('ein Abbruch am Job-Budget während des Calls ist ein Zeit-Skip, kein pro_api_error (D14)', async () => {
        const context = buildTriggeringContext({ deadlineAtMs: Date.now() + 90_000 });
        runReviewerPass.mockRejectedValueOnce(new CallBudgetExhaustedError('ReviewerPass/escalate_second_opinion'));

        const skippedContext = await secondOpinionReviewerStep.execute(context);

        expect(skippedContext.cascade.degradations).toEqual(['time_budget_exhausted']);
        expect(skippedContext.cascade.degradations).not.toContain('pro_api_error');
    });
});
