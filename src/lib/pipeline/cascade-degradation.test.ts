/**
 * Golden-Replay-Harness: Degradations-Pfade der Router-Cascade (SPEC.md §8, §11).
 *
 * Fährt die echte Step-Kette claim-verifier -> escalation-reviewer ->
 * integrity-scorer gegen einen gemockten Vertex-Client und prüft die
 * Kern-Invariante von D10: Der Kunde bekommt IMMER ein Review — interne
 * Cascade-Fehler enden in dokumentierter Degradation, nie in einem Job-Fehler.
 */
import { ApiError } from '@google/genai';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimVerifierStep } from '@/lib/pipeline/steps/claim-verifier-step';
import { escalationReviewerStep } from '@/lib/pipeline/steps/escalation-reviewer-step';
import { integrityScorerStep } from '@/lib/pipeline/steps/integrity-scorer-step';
import {
    buildPipelineContext,
    buildPullRequestFile,
    buildReviewIssue,
} from '@/lib/pipeline/testing/context-fixture';
import type { PipelineContext } from '@/lib/pipeline/types';

// =============================================================================
// Systemgrenzen-Mocks (Vertex, Telemetrie, Law, Billing)
// =============================================================================

const { generateContentMock, recordLlmCallMock, consumeProEscalationBudgetMock } = vi.hoisted(() => ({
    generateContentMock: vi.fn(),
    recordLlmCallMock: vi.fn(() => Promise.resolve()),
    consumeProEscalationBudgetMock: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/lib/vertex', () => ({
    getVertexClient: () => ({ models: { generateContent: generateContentMock } }),
    getVertexEuClient: () => ({ models: { generateContent: generateContentMock } }),
    // Pro-Eskalation läuft über den global-Client — im Test derselbe Stub.
    getVertexGlobalClient: () => ({ models: { generateContent: generateContentMock } }),
}));
vi.mock('@/lib/telemetry/llm-call-log', () => ({
    recordLlmCall: recordLlmCallMock,
}));
vi.mock('@/lib/law', () => ({
    fetchRenderedLawBlock: () => Promise.resolve({ lawBlock: '', lawContentHash: 'law-test-hash', ruleIds: [] }),
}));
vi.mock('@/lib/billing/entitlements', () => ({
    consumeProEscalationBudget: consumeProEscalationBudgetMock,
}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

// Kill-Switch (PROMPT_CACHING_SPEC D10): die Degradations-Pfade laufen hier
// bewusst über den Inline-Prompt — der Explicit-Cache-Pfad hat seine eigene
// Suite (context-cache.test.ts) und würde diese Assertions nur verrauschen.
process.env.VERTEX_CONTEXT_CACHE_DISABLED = '1';
afterAll(() => {
    delete process.env.VERTEX_CONTEXT_CACHE_DISABLED;
});

// =============================================================================
// Harness
// =============================================================================

interface MockedVerdictEntry {
    readonly claim_id: string;
    readonly verdict: 'CONFIRMED' | 'REFUTED' | 'UNCERTAIN';
    readonly confidence: number;
}

function buildVerdictLlmResponse(verdictEntries: readonly MockedVerdictEntry[]) {
    return {
        text: JSON.stringify({
            verdicts: verdictEntries.map((verdictEntry) => ({
                ...verdictEntry,
                verification_question: `Blind check for ${verdictEntry.claim_id}.`,
                blind_answer: 'Independent assessment from the rules and quoted code.',
            })),
        }),
        usageMetadata: { promptTokenCount: 200, cachedContentTokenCount: 0, candidatesTokenCount: 80 },
    };
}

/** Ein CRITICAL- und ein WARNING-Draft-Issue — der Standard-Replay-Input. */
function buildDraftedContext(): PipelineContext {
    return buildPipelineContext({
        issues: [
            buildReviewIssue({ severity: 'CRITICAL', line: 42 }),
            buildReviewIssue({ severity: 'WARNING', line: 50, exactQuote: 'catch (e) {}' }),
        ],
        reviewableFiles: [buildPullRequestFile()],
    });
}

async function runCascadeTail(draftedContext: PipelineContext): Promise<PipelineContext> {
    const verifiedContext = await claimVerifierStep.execute(draftedContext);
    const escalatedContext = await escalationReviewerStep.execute(verifiedContext);
    return integrityScorerStep.execute(escalatedContext);
}

describe('cascade degradation replay', () => {
    beforeEach(() => {
        generateContentMock.mockReset();
        recordLlmCallMock.mockClear();
        consumeProEscalationBudgetMock.mockReset();
        consumeProEscalationBudgetMock.mockResolvedValue(true);
    });

    it('passes the draft through unfiltered with a null score when the verifier JSON stays unreadable', async () => {
        generateContentMock.mockResolvedValue({
            text: 'this is not json',
            usageMetadata: { promptTokenCount: 10, cachedContentTokenCount: 0, candidatesTokenCount: 5 },
        });

        const finalContext = await runCascadeTail(buildDraftedContext());

        expect(generateContentMock).toHaveBeenCalledTimes(2);
        expect(finalContext.cascade.degradations).toEqual(['verifier_parse_error']);
        expect(finalContext.issues).toHaveLength(2);
        expect(finalContext.cascade.integrityScore).toBeNull();
    });

    it('degrades to verifier_api_error when Vertex rejects both attempts', async () => {
        generateContentMock.mockRejectedValue(new Error('Vertex unavailable'));

        const finalContext = await runCascadeTail(buildDraftedContext());

        expect(generateContentMock).toHaveBeenCalledTimes(2);
        expect(finalContext.cascade.degradations).toEqual(['verifier_api_error']);
        expect(finalContext.cascade.integrityScore).toBeNull();
    });

    it('heilt einen Verifier-429 per Backoff — keine Degradation, api_error+ok-Telemetrie', async () => {
        vi.useFakeTimers();
        try {
            generateContentMock
                .mockRejectedValueOnce(new ApiError({ message: 'RESOURCE_EXHAUSTED', status: 429 }))
                .mockResolvedValueOnce(buildVerdictLlmResponse([
                    { claim_id: 'c1', verdict: 'CONFIRMED', confidence: 90 },
                    { claim_id: 'c2', verdict: 'CONFIRMED', confidence: 88 },
                ]));

            const cascadeOutcome = runCascadeTail(buildDraftedContext());
            await vi.runAllTimersAsync();
            const finalContext = await cascadeOutcome;

            expect(generateContentMock).toHaveBeenCalledTimes(2);
            expect(finalContext.cascade.degradations).toEqual([]);
            expect(recordLlmCallMock).toHaveBeenCalledTimes(2);
            expect(recordLlmCallMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 'api_error' }));
            expect(recordLlmCallMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 'ok' }));
        } finally {
            vi.useRealTimers();
        }
    });

    it('anhaltender Verifier-429: drei Backoff-Versuche, kein vierter Sofort-Retry, dann verifier_api_error', async () => {
        vi.useFakeTimers();
        try {
            generateContentMock.mockRejectedValue(new ApiError({ message: 'RESOURCE_EXHAUSTED', status: 429 }));

            const cascadeOutcome = runCascadeTail(buildDraftedContext());
            await vi.runAllTimersAsync();
            const finalContext = await cascadeOutcome;

            expect(generateContentMock).toHaveBeenCalledTimes(3);
            expect(finalContext.cascade.degradations).toEqual(['verifier_api_error']);
            expect(finalContext.issues).toHaveLength(2);
            expect(finalContext.cascade.integrityScore).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('recovers when the retry succeeds after one failed verifier attempt', async () => {
        generateContentMock
            .mockRejectedValueOnce(new Error('transient Vertex hiccup'))
            .mockResolvedValueOnce(buildVerdictLlmResponse([
                { claim_id: 'c1', verdict: 'CONFIRMED', confidence: 92 },
                { claim_id: 'c2', verdict: 'CONFIRMED', confidence: 84 },
            ]));

        const finalContext = await runCascadeTail(buildDraftedContext());

        expect(finalContext.cascade.degradations).toEqual([]);
        expect(finalContext.cascade.integrityScore).toBe(89);
        expect(finalContext.issues.map((survivingIssue) => survivingIssue.confidence)).toEqual([92, 84]);
    });

    // 3.x-JSON-Degeneration (M1-Nachzügler 2026-08-28): syntaktisch valides
    // JSON ohne verdicts-Array. Vorher maskierte sich das als "alle Claims
    // UNCERTAIN" mit Telemetrie ok — Voll-Eskalation statt Retry.
    it('heals a degenerate verdicts response (valid JSON, no array) via the batch retry', async () => {
        generateContentMock
            .mockResolvedValueOnce({
                text: JSON.stringify({ summary: 'all claims look fine' }),
                usageMetadata: { promptTokenCount: 200, cachedContentTokenCount: 0, candidatesTokenCount: 20 },
            })
            .mockResolvedValueOnce(buildVerdictLlmResponse([
                { claim_id: 'c1', verdict: 'CONFIRMED', confidence: 92 },
                { claim_id: 'c2', verdict: 'CONFIRMED', confidence: 84 },
            ]));

        const finalContext = await runCascadeTail(buildDraftedContext());

        expect(generateContentMock).toHaveBeenCalledTimes(2);
        expect(finalContext.cascade.degradations).toEqual([]);
        expect(finalContext.cascade.escalationClaimIds).toEqual([]);
        // Jeder Versuch schreibt seine eigene Telemetrie-Zeile (Monitoring).
        expect(recordLlmCallMock).toHaveBeenCalledWith(
            expect.objectContaining({ phase: 'verify', status: 'parse_error' }),
        );
        expect(recordLlmCallMock).toHaveBeenCalledWith(
            expect.objectContaining({ phase: 'verify', status: 'ok' }),
        );
    });

    it('degrades to the unfiltered draft when both verifier attempts degenerate', async () => {
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({ verdicts: 'none' }),
            usageMetadata: { promptTokenCount: 200, cachedContentTokenCount: 0, candidatesTokenCount: 20 },
        });

        const finalContext = await runCascadeTail(buildDraftedContext());

        expect(generateContentMock).toHaveBeenCalledTimes(2);
        expect(finalContext.cascade.degradations).toEqual(['verifier_parse_error']);
        expect(finalContext.issues).toHaveLength(2);
        expect(finalContext.cascade.integrityScore).toBeNull();
    });

    it('downgrades escalation-marked issues when the Pro budget is exhausted', async () => {
        generateContentMock.mockResolvedValueOnce(buildVerdictLlmResponse([
            { claim_id: 'c1', verdict: 'UNCERTAIN', confidence: 40 },
            { claim_id: 'c2', verdict: 'CONFIRMED', confidence: 85 },
        ]));
        consumeProEscalationBudgetMock.mockResolvedValue(false);

        const finalContext = await runCascadeTail(buildDraftedContext());

        expect(generateContentMock).toHaveBeenCalledTimes(1);
        expect(finalContext.cascade.escalated).toBe(false);
        expect(finalContext.cascade.degradations).toEqual(['pro_budget_exhausted']);
        expect(recordLlmCallMock).toHaveBeenCalledWith(
            expect.objectContaining({ phase: 'escalate_targeted', status: 'skipped_budget' }),
        );

        const [downgradedIssue, confirmedIssue] = finalContext.issues;
        expect(downgradedIssue.severity).toBe('WARNING');
        expect(downgradedIssue.critique).toContain('remained uncertain');
        expect(confirmedIssue.confidence).toBe(85);
    });

    it('keeps the verified flash results when the Pro API fails twice', async () => {
        generateContentMock
            .mockResolvedValueOnce(buildVerdictLlmResponse([
                { claim_id: 'c1', verdict: 'UNCERTAIN', confidence: 45 },
                { claim_id: 'c2', verdict: 'CONFIRMED', confidence: 88 },
            ]))
            .mockRejectedValueOnce(new Error('Pro quota exceeded upstream'))
            .mockRejectedValueOnce(new Error('Pro quota exceeded upstream'));

        const finalContext = await runCascadeTail(buildDraftedContext());

        expect(generateContentMock).toHaveBeenCalledTimes(3);
        expect(finalContext.cascade.escalated).toBe(false);
        expect(finalContext.cascade.degradations).toEqual(['pro_api_error']);
        expect(finalContext.issues[0].severity).toBe('WARNING');
        expect(finalContext.cascade.integrityScore).not.toBeNull();
    });

    it('Latenz-Guard: ein Deadline-Abbruch der Eskalation wird NICHT wiederholt — ein Call, dann pro_api_error', async () => {
        // Das SDK bricht den fetch ueber seinen eigenen AbortController ab,
        // sobald unser AbortSignal.timeout feuert: DOMException 'AbortError'.
        // Ein zweiter 150-s-Langlaeufer wuerde das Routen-Budget verbrauchen,
        // das die Deadline schuetzt (SPEC §8, Eskalations-Zeile).
        generateContentMock
            .mockResolvedValueOnce(buildVerdictLlmResponse([
                { claim_id: 'c1', verdict: 'UNCERTAIN', confidence: 45 },
                { claim_id: 'c2', verdict: 'CONFIRMED', confidence: 88 },
            ]))
            .mockRejectedValueOnce(new DOMException('This operation was aborted', 'AbortError'));

        const finalContext = await runCascadeTail(buildDraftedContext());

        expect(generateContentMock).toHaveBeenCalledTimes(2);
        expect(finalContext.cascade.escalated).toBe(false);
        expect(finalContext.cascade.degradations).toEqual(['pro_api_error']);
        expect(finalContext.issues[0].severity).toBe('WARNING');
        expect(recordLlmCallMock).toHaveBeenCalledWith(
            expect.objectContaining({ phase: 'escalate_targeted', status: 'api_error' }),
        );
    });

    it('escalates a flash-refuted CRITICAL to Pro and keeps it when Pro confirms', async () => {
        generateContentMock
            .mockResolvedValueOnce(buildVerdictLlmResponse([
                { claim_id: 'c1', verdict: 'REFUTED', confidence: 80 },
                { claim_id: 'c2', verdict: 'CONFIRMED', confidence: 85 },
            ]))
            .mockResolvedValueOnce(buildVerdictLlmResponse([
                { claim_id: 'c1', verdict: 'CONFIRMED', confidence: 90 },
            ]));

        const finalContext = await runCascadeTail(buildDraftedContext());

        expect(finalContext.cascade.escalated).toBe(true);
        expect(finalContext.issues).toHaveLength(2);
        expect(finalContext.issues[0].severity).toBe('CRITICAL');
        expect(finalContext.issues[0].confidence).toBe(90);
        expect(finalContext.cascade.integrityScore).toBe(88);
        expect(recordLlmCallMock).toHaveBeenCalledWith(
            expect.objectContaining({
                phase: 'verify',
                status: 'ok',
                verdictDetails: expect.arrayContaining([
                    expect.objectContaining({ claimId: 'c1', verdict: 'REFUTED' }),
                ]),
            }),
        );
    });

    it('lets a Pro verdict override the flash verdict on the golden path', async () => {
        generateContentMock
            .mockResolvedValueOnce(buildVerdictLlmResponse([
                { claim_id: 'c1', verdict: 'UNCERTAIN', confidence: 40 },
                { claim_id: 'c2', verdict: 'CONFIRMED', confidence: 80 },
            ]))
            .mockResolvedValueOnce(buildVerdictLlmResponse([
                { claim_id: 'c1', verdict: 'REFUTED', confidence: 95 },
            ]));

        const finalContext = await runCascadeTail(buildDraftedContext());

        expect(finalContext.cascade.escalated).toBe(true);
        expect(finalContext.cascade.degradations).toEqual([]);
        expect(finalContext.issues).toHaveLength(1);
        expect(finalContext.issues[0].exactQuote).toBe('catch (e) {}');
        expect(finalContext.cascade.integrityScore).toBe(80);

        const overriddenVerdict = finalContext.cascade.verdicts.find(
            (verdictEntry) => verdictEntry.claimId === 'c1',
        );
        expect(overriddenVerdict?.phase).toBe('pro-verify');
        expect(overriddenVerdict?.verdict).toBe('REFUTED');
    });

    it('skips the entire verification tail for a clean draft', async () => {
        const cleanContext = buildPipelineContext({ reviewableFiles: [buildPullRequestFile()] });

        const finalContext = await runCascadeTail(cleanContext);

        expect(generateContentMock).not.toHaveBeenCalled();
        expect(finalContext.cascade.integrityScore).toBe(100);
    });
});
