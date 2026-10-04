/**
 * Unit Tests: Draft-Reviewer — Modellwahl und pro-direct-Resilienz.
 *
 * Auf der pro-direct-Route IST der Draft der komplette Review. Faellt das
 * Pro-Modell aus, muss der Job auf die Flash-Kaskade zurückfallen statt zu
 * sterben (D10) — sonst reisst ein Modell-Ausfall den PR-Check des Kunden.
 */
import { ApiError } from '@google/genai';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftReviewerStep } from '@/lib/pipeline/steps/draft-reviewer-step';
import { ALL_CONDITION_IDS } from '@/lib/pipeline/conditions';
import { DEFAULT_CASCADE_CONFIG } from '@/lib/pipeline/defaults';
import { buildCombinedDiff } from '@/lib/pipeline/helpers';
import { MODEL_DRAFT, MODEL_ESCALATION } from '@/lib/pipeline/models';
import { buildAlreadyFlaggedSection, buildProtocolBlock } from '@/lib/pipeline/prompt-builder';
import { ModelUnavailableError } from '@/lib/pipeline/vertex-retry';
import {
    buildCascadeState,
    buildPipelineContext,
    buildPullRequestFile,
    buildReviewIssue,
} from '@/lib/pipeline/testing/context-fixture';
import type { PipelineContext } from '@/lib/pipeline/types';

const { generateContentMock, recordLlmCallMock } = vi.hoisted(() => ({
    generateContentMock: vi.fn(),
    recordLlmCallMock: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/vertex', () => ({
    getVertexClient: () => ({ models: { generateContent: generateContentMock } }),
    getVertexEuClient: () => ({ models: { generateContent: generateContentMock } }),
    getVertexGlobalClient: () => ({ models: { generateContent: generateContentMock } }),
}));
vi.mock('@/lib/telemetry/llm-call-log', () => ({ recordLlmCall: recordLlmCallMock }));
vi.mock('@/lib/law', () => ({
    fetchRenderedLawBlock: () => Promise.resolve({
        lawBlock: '', lawContentHash: 'law-test-hash', ruleIds: ['SEC-001'],
    }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

// Kill-Switch (PROMPT_CACHING_SPEC D10): diese Suite prüft Modellwahl und
// Resilienz über den Inline-Pfad; der Cache-Pfad hat seine eigene Suite.
process.env.VERTEX_CONTEXT_CACHE_DISABLED = '1';
afterAll(() => {
    delete process.env.VERTEX_CONTEXT_CACHE_DISABLED;
});

function buildDraftLlmResponse(summary: string) {
    return {
        text: JSON.stringify({
            has_slop: true,
            issues: [{
                rule: 'Condition 1 (Silent Error Swallowing)',
                severity: 'CRITICAL',
                path: 'src/lib/example.ts',
                line: 42,
                end_line: 42,
                exact_quote: 'catch (e) {}',
                critique: 'Empty catch block.',
                confidence: 88,
            }],
            summary,
        }),
        usageMetadata: { promptTokenCount: 500, cachedContentTokenCount: 0, candidatesTokenCount: 120 },
    };
}

function buildDraftContext(route: 'flash-cascade' | 'pro-direct') {
    return buildPipelineContext({
        combinedDiff: '=== FILE: src/lib/example.ts (modified) ===\n+catch (e) {}',
        reviewableFiles: [buildPullRequestFile()],
        cascade: buildCascadeState({ route, escalated: route === 'pro-direct' }),
        // Die Manifest-Validierung akzeptiert nur Conditions, die im Prompt
        // standen — die Fixtures zitieren Condition 1, also müssen die
        // Conditions hier aktiv sein (prod: pipeline_config.activeConditionIds).
        promptConfig: {
            activeConditionIds: ALL_CONDITION_IDS,
            filePaths: ['src/lib/example.ts'],
            overrideSmartDetection: false,
        },
    });
}

describe('draftReviewerStep', () => {
    beforeEach(() => {
        generateContentMock.mockReset();
        recordLlmCallMock.mockClear();
    });

    it('drafts on the flash model for the standard route', async () => {
        generateContentMock.mockResolvedValue(buildDraftLlmResponse('flash review'));

        const draftedContext = await draftReviewerStep.execute(buildDraftContext('flash-cascade'));

        expect(generateContentMock.mock.calls[0][0].model).toBe(MODEL_DRAFT);
        expect(draftedContext.issues).toHaveLength(1);
        // Auf der Flash-Route liefert erst der blinde Verifier die Confidence.
        expect(draftedContext.issues[0].confidence).toBeUndefined();
    });

    it('drafts on the pro model and keeps its self-reported confidence on pro-direct', async () => {
        generateContentMock.mockResolvedValue(buildDraftLlmResponse('pro review'));

        const draftedContext = await draftReviewerStep.execute(buildDraftContext('pro-direct'));

        expect(generateContentMock.mock.calls[0][0].model).toBe(MODEL_ESCALATION);
        expect(draftedContext.issues[0].confidence).toBe(88);
        expect(recordLlmCallMock).toHaveBeenCalledWith(
            expect.objectContaining({ phase: 'escalate_full', model: MODEL_ESCALATION, status: 'ok' }),
        );
    });

    it('falls back to the flash cascade when the pro draft returns unparsable JSON', async () => {
        generateContentMock
            .mockResolvedValueOnce({
                text: '{"has_slop": true, "issues": [], "summary": "pro"}\n}',
                usageMetadata: { promptTokenCount: 10, cachedContentTokenCount: 0, candidatesTokenCount: 5 },
            })
            .mockResolvedValueOnce(buildDraftLlmResponse('flash fallback'));

        const draftedContext = await draftReviewerStep.execute(buildDraftContext('pro-direct'));

        // Die überzählige Klammer ist jetzt tolerierbar — der Pro-Draft überlebt.
        expect(generateContentMock).toHaveBeenCalledTimes(1);
        expect(draftedContext.cascade.route).toBe('pro-direct');
        expect(draftedContext.reviewSummary).toBe('pro');
    });

    it('heilt eine einmalige JSON-Degeneration per Retry (3.x-Familienbug, parse_error+ok-Telemetrie)', async () => {
        // Beobachtet 2026-08-26 auf gemini-3.6-flash (r17, r02): syntaktisch
        // valides JSON, aber ohne issues-Feld — nicht-deterministisch, der
        // identische zweite Call ist clean.
        generateContentMock
            .mockResolvedValueOnce({
                text: '{"has_slop": false, "summary": "degeneriert"}',
                usageMetadata: { promptTokenCount: 10, cachedContentTokenCount: 0, candidatesTokenCount: 5 },
            })
            .mockResolvedValueOnce(buildDraftLlmResponse('geheilt'));

        const draftedContext = await draftReviewerStep.execute(buildDraftContext('flash-cascade'));

        expect(generateContentMock).toHaveBeenCalledTimes(2);
        expect(draftedContext.reviewSummary).toBe('geheilt');
        expect(draftedContext.issues).toHaveLength(1);
        expect(recordLlmCallMock).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'parse_error', model: MODEL_DRAFT }),
        );
        expect(recordLlmCallMock).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'ok', model: MODEL_DRAFT }),
        );
    });

    it('doppelte Degeneration auf pro-direct: Retry, dann Flash-Fallback statt undefined.map', async () => {
        const degenerateResponse = {
            text: '{"has_slop": false, "summary": "degeneriert"}',
            usageMetadata: { promptTokenCount: 10, cachedContentTokenCount: 0, candidatesTokenCount: 5 },
        };
        generateContentMock
            .mockResolvedValueOnce(degenerateResponse)
            .mockResolvedValueOnce(degenerateResponse)
            .mockResolvedValueOnce(buildDraftLlmResponse('flash fallback'));

        const draftedContext = await draftReviewerStep.execute(buildDraftContext('pro-direct'));

        expect(generateContentMock).toHaveBeenCalledTimes(3);
        expect(draftedContext.cascade.route).toBe('flash-cascade');
        expect(draftedContext.cascade.degradations).toEqual(['pro_api_error']);
        expect(draftedContext.reviewSummary).toBe('flash fallback');
        expect(recordLlmCallMock).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'parse_error', model: MODEL_ESCALATION }),
        );
    });

    describe('Vertex-Kapazität (429) auf dem Draft-Call — F5-Befund Job e49caffe', () => {
        const buildCapacityError = () => new ApiError({
            message: '{"error":{"code":429,"message":"Resource exhausted. Please try again later.","status":"RESOURCE_EXHAUSTED"}}',
            status: 429,
        });

        beforeEach(() => {
            vi.useFakeTimers();
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('heilt einen transienten 429 per Backoff-Retry statt den Job zu killen (api_error+ok-Telemetrie)', async () => {
            generateContentMock
                .mockRejectedValueOnce(buildCapacityError())
                .mockResolvedValueOnce(buildDraftLlmResponse('nach Backoff'));

            const draftOutcome = draftReviewerStep.execute(buildDraftContext('flash-cascade'));
            await vi.runAllTimersAsync();
            const draftedContext = await draftOutcome;

            expect(generateContentMock).toHaveBeenCalledTimes(2);
            expect(draftedContext.reviewSummary).toBe('nach Backoff');
            expect(recordLlmCallMock).toHaveBeenCalledTimes(2);
            expect(recordLlmCallMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 'api_error' }));
            expect(recordLlmCallMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 'ok' }));
        });

        it('ein anhaltender 429 endet nach drei Versuchen als ModelUnavailableError (stabiler Client-Code)', async () => {
            generateContentMock.mockRejectedValue(buildCapacityError());

            const draftOutcome = draftReviewerStep.execute(buildDraftContext('flash-cascade'));
            const rejectionAssertion = expect(draftOutcome).rejects.toBeInstanceOf(ModelUnavailableError);
            await vi.runAllTimersAsync();
            await rejectionAssertion;

            expect(generateContentMock).toHaveBeenCalledTimes(3);
            expect(recordLlmCallMock).toHaveBeenCalledTimes(3);
        });

        it('pro-direct: erschöpfte Pro-Kapazität fällt wie jeder Pro-Fehler auf die Flash-Kaskade zurück (A7)', async () => {
            generateContentMock
                .mockRejectedValueOnce(buildCapacityError())
                .mockRejectedValueOnce(buildCapacityError())
                .mockRejectedValueOnce(buildCapacityError())
                .mockResolvedValueOnce(buildDraftLlmResponse('flash fallback'));

            const draftOutcome = draftReviewerStep.execute(buildDraftContext('pro-direct'));
            await vi.runAllTimersAsync();
            const draftedContext = await draftOutcome;

            expect(generateContentMock).toHaveBeenCalledTimes(4);
            expect(draftedContext.cascade.route).toBe('flash-cascade');
            expect(draftedContext.cascade.degradations).toEqual(['pro_api_error']);
        });
    });

    it('injects the <already_flagged> section into the user prompt when prescan findings exist (§5.1)', async () => {
        generateContentMock.mockResolvedValue(buildDraftLlmResponse('flash review'));
        const contextWithPrescanFindings = buildPipelineContext({
            combinedDiff: '=== FILE: src/native/buffer.c (modified) ===\n+strcpy(dst, src);',
            reviewableFiles: [buildPullRequestFile()],
            prescanIssues: [buildReviewIssue({
                rule: 'SEC-029 (Banned libc API)',
                path: 'src/native/buffer.c',
                line: 12,
                source: 'pre-scanner',
            })],
        });

        await draftReviewerStep.execute(contextWithPrescanFindings);

        const sentUserPrompt = generateContentMock.mock.calls[0][0].contents as string;
        expect(sentUserPrompt).toContain('<already_flagged>');
        expect(sentUserPrompt).toContain('- (SEC-029, src/native/buffer.c, line 12)');
        // Der Diff folgt NACH der Sektion — die Findings sind Kontext, kein Ersatz.
        expect(sentUserPrompt).toContain('=== NEW CODE (Pull Request Diff) ===');
        // Cache-Contract: die Sektion darf NIE im System-Prompt landen.
        const sentSystemPrompt = generateContentMock.mock.calls[0][0].config.systemInstruction as string;
        expect(sentSystemPrompt).not.toContain('<already_flagged>');
    });

    it('sends protocol block plus bare diff when the prescan lane is empty', async () => {
        generateContentMock.mockResolvedValue(buildDraftLlmResponse('flash review'));
        const bareContext = buildDraftContext('flash-cascade');

        await draftReviewerStep.execute(bareContext);

        // Layer 2 (Task-Protokoll) steht am Anfang der Contents, der Diff
        // unverändert am Ende (PROMPT_CACHING_SPEC §4.1).
        const sentContents = generateContentMock.mock.calls[0][0].contents as string;
        expect(sentContents.startsWith('=== TASK PROTOCOL:')).toBe(true);
        expect(sentContents.endsWith(bareContext.combinedDiff)).toBe(true);
    });

    it('drops issues with invented rule ids or out-of-hunk lines at the parse boundary (§12)', async () => {
        // Fixture-Hunk: neue Zeilen 40-44. Nur das erste Issue ist valide;
        // die anderen tragen eine erfundene Rule-ID bzw. eine halluzinierte Zeile.
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({
                has_slop: true,
                issues: [
                    {
                        rule: 'SEC-001 (security)', severity: 'CRITICAL', path: 'src/lib/example.ts',
                        line: 42, end_line: 42, exact_quote: 'catch (e) {}', critique: 'Valid finding.',
                    },
                    {
                        rule: 'SEC-999 (invented)', severity: 'CRITICAL', path: 'src/lib/example.ts',
                        line: 42, end_line: 42, exact_quote: 'x', critique: 'Unknown rule id.',
                    },
                    {
                        rule: 'Condition 1 (Silent Error Swallowing)', severity: 'WARNING', path: 'src/lib/example.ts',
                        line: 999, end_line: 999, exact_quote: 'x', critique: 'Line outside every hunk.',
                    },
                ],
                summary: 'mixed validity',
            }),
            usageMetadata: { promptTokenCount: 500, cachedContentTokenCount: 0, candidatesTokenCount: 120 },
        });

        const draftedContext = await draftReviewerStep.execute(buildDraftContext('flash-cascade'));

        expect(draftedContext.issues).toHaveLength(1);
        expect(draftedContext.issues[0].rule).toBe('SEC-001 (security)');
    });

    it('aggregiert gleiche Rule+File-Vorkommen zu EINEM Finding mit occurrences (ROADMAP §7)', async () => {
        // Fixture-Hunk: neue Zeilen 40-44. Drei Vorkommen derselben Condition
        // in derselben Datei plus ein Finding einer anderen Regel.
        const buildEmojiIssue = (issueLine: number, quote: string) => ({
            rule: 'Condition 1 (Silent Error Swallowing)', severity: 'WARNING', path: 'src/lib/example.ts',
            line: issueLine, end_line: issueLine, exact_quote: quote, critique: 'Swallowed error.',
        });
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({
                has_slop: true,
                issues: [
                    buildEmojiIssue(42, 'catch (e) {}'),
                    buildEmojiIssue(40, 'catch (err) {}'),
                    buildEmojiIssue(44, 'catch {}'),
                    {
                        rule: 'SEC-001 (security)', severity: 'CRITICAL', path: 'src/lib/example.ts',
                        line: 41, end_line: 41, exact_quote: 'const token = "x";', critique: 'Hardcoded token.',
                    },
                ],
                summary: 'repeated pattern',
            }),
            usageMetadata: { promptTokenCount: 500, cachedContentTokenCount: 0, candidatesTokenCount: 120 },
        });

        const draftedContext = await draftReviewerStep.execute(buildDraftContext('flash-cascade'));

        expect(draftedContext.issues).toHaveLength(2);
        const [aggregatedIssue, singleIssue] = draftedContext.issues;
        expect(aggregatedIssue.occurrences).toEqual([
            { line: 40, endLine: 40, exactQuote: 'catch (err) {}' },
            { line: 42, endLine: 42, exactQuote: 'catch (e) {}' },
            { line: 44, endLine: 44, exactQuote: 'catch {}' },
        ]);
        // Anker = erstes Vorkommen (Finding-ID-/Apply-Contract).
        expect(aggregatedIssue.line).toBe(40);
        expect(aggregatedIssue.exactQuote).toBe('catch (err) {}');
        expect(singleIssue.rule).toBe('SEC-001 (security)');
        expect(singleIssue.occurrences).toBeUndefined();
    });

    it('skips the draft call entirely when the short-circuit fired (§5.3)', async () => {
        const shortCircuitedContext = buildPipelineContext({ llmSkipped: true });

        const passedThroughContext = await draftReviewerStep.execute(shortCircuitedContext);

        expect(passedThroughContext).toBe(shortCircuitedContext);
        expect(generateContentMock).not.toHaveBeenCalled();
    });

    it('falls back to the flash cascade when the pro model is unavailable', async () => {
        generateContentMock
            .mockRejectedValueOnce(new Error('404 Publisher model not found'))
            .mockResolvedValueOnce(buildDraftLlmResponse('flash fallback'));

        const draftedContext = await draftReviewerStep.execute(buildDraftContext('pro-direct'));

        expect(generateContentMock).toHaveBeenCalledTimes(2);
        expect(generateContentMock.mock.calls[1][0].model).toBe(MODEL_DRAFT);
        expect(draftedContext.cascade.route).toBe('flash-cascade');
        expect(draftedContext.cascade.escalated).toBe(false);
        expect(draftedContext.cascade.degradations).toEqual(['pro_api_error']);
        expect(draftedContext.reviewSummary).toBe('flash fallback');
        // Nach dem Fallback verifiziert die Kaskade normal weiter -> keine
        // self-reported Confidence aus dem Draft.
        expect(draftedContext.issues[0].confidence).toBeUndefined();
    });
});

describe('draftReviewerStep — Deadline Guard (DEADLINE_GUARD_SPEC D5)', () => {
    const deadlineAbort = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');

    function buildBudgetedDraftContext(route: 'flash-cascade' | 'pro-direct', remainingMs: number) {
        return { ...buildDraftContext(route), deadlineAtMs: Date.now() + remainingMs };
    }

    beforeEach(() => {
        generateContentMock.mockReset();
        recordLlmCallMock.mockClear();
    });

    it('ein Draft-Abbruch an der Job-Deadline endet als ReviewTimeoutError (Client-Code review_timeout)', async () => {
        generateContentMock.mockRejectedValue(deadlineAbort());

        await expect(draftReviewerStep.execute(buildBudgetedDraftContext('flash-cascade', 120_000)))
            .rejects.toMatchObject({ name: 'ReviewTimeoutError' });
        expect(recordLlmCallMock).toHaveBeenCalledWith(expect.objectContaining({ phase: 'draft', status: 'api_error' }));
    });

    it('ohne Restbudget startet kein Draft-Call', async () => {
        await expect(draftReviewerStep.execute(buildBudgetedDraftContext('flash-cascade', -1_000)))
            .rejects.toMatchObject({ name: 'ReviewTimeoutError' });
        expect(generateContentMock).not.toHaveBeenCalled();
    });

    it('pro-direct mit 100 s Rest nach dem Abbruch: der Flash-Fallback läuft', async () => {
        generateContentMock
            .mockRejectedValueOnce(deadlineAbort())
            .mockResolvedValueOnce(buildDraftLlmResponse('flash fallback'));

        const draftedContext = await draftReviewerStep.execute(buildBudgetedDraftContext('pro-direct', 100_000));

        expect(generateContentMock.mock.calls[1][0].model).toBe(MODEL_DRAFT);
        expect(draftedContext.cascade.route).toBe('flash-cascade');
    });

    it('pro-direct mit nur 60 s Rest: kein Flash-Fallback, sondern review_timeout', async () => {
        generateContentMock.mockRejectedValueOnce(deadlineAbort());

        await expect(draftReviewerStep.execute(buildBudgetedDraftContext('pro-direct', 60_000)))
            .rejects.toMatchObject({ name: 'ReviewTimeoutError' });
        expect(generateContentMock).toHaveBeenCalledTimes(1);
    });

    it('pro-direct mit wenig Rest und einem Nicht-Zeit-Fehler behält den ehrlichen Fehlercode', async () => {
        generateContentMock.mockRejectedValueOnce(new Error('invalid argument'));

        await expect(draftReviewerStep.execute(buildBudgetedDraftContext('pro-direct', 60_000)))
            .rejects.toThrow('invalid argument');
        expect(generateContentMock).toHaveBeenCalledTimes(1);
    });

    it('ein Nicht-Deadline-Fehler bleibt unverändert (kein falsches review_timeout)', async () => {
        generateContentMock.mockRejectedValue(new Error('invalid argument'));

        await expect(draftReviewerStep.execute(buildBudgetedDraftContext('flash-cascade', 120_000)))
            .rejects.toThrow('invalid argument');
    });
});

describe('buildAlreadyFlaggedSection', () => {
    it('renders one (ruleId, path, line) tuple per prescan finding', () => {
        const flaggedSection = buildAlreadyFlaggedSection([
            buildReviewIssue({ rule: 'SEC-029 (Banned libc API)', path: 'src/native/buffer.c', line: 12 }),
            buildReviewIssue({ rule: 'MAINT-001 (Empty catch/except block)', path: 'src/lib/sync.ts', line: 88 }),
        ]);

        expect(flaggedSection).toContain('<already_flagged>');
        expect(flaggedSection).toContain('- (SEC-029, src/native/buffer.c, line 12)');
        expect(flaggedSection).toContain('- (MAINT-001, src/lib/sync.ts, line 88)');
        expect(flaggedSection.endsWith('</already_flagged>')).toBe(true);
    });

    it('returns an empty string for an empty lane — the user prompt stays untouched', () => {
        expect(buildAlreadyFlaggedSection([])).toBe('');
    });
});

// =============================================================================
// Datei-Batch-Chunking (LARGE_DIFF_RECALL_SPEC Option A, Bau-Entscheid §9)
// =============================================================================

describe('draftReviewerStep — Datei-Batch-Chunking (LARGE_DIFF_RECALL_SPEC Option A)', () => {
    const alphaFile = buildPullRequestFile({ filename: 'src/lib/alpha.ts', patch: '@@ -40,3 +40,5 @@\n+catch (e) {} // alpha' });
    const betaFile = buildPullRequestFile({ filename: 'src/lib/beta.ts', patch: '@@ -40,3 +40,5 @@\n+catch (e) {} // beta' });
    const ALPHA_HEADER = '=== FILE: src/lib/alpha.ts (modified) ===';
    const BETA_HEADER = '=== FILE: src/lib/beta.ts (modified) ===';
    /** Beide Dateien zusammen ~40 geschätzte Tokens: Grenze 30 ⇒ zwei Batches, Grenze 1000 ⇒ ein Call. */
    const SPLITTING_BATCH_LIMIT = 30;
    const GENEROUS_BATCH_LIMIT = 1000;
    const deadlineAbort = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');

    function buildTwoFileContext(batchMaxTokens: number, overrides: Partial<PipelineContext> = {}) {
        const reviewableFiles = [alphaFile, betaFile];
        return buildPipelineContext({
            reviewableFiles,
            combinedDiff: buildCombinedDiff(reviewableFiles),
            cascadeConfig: { ...DEFAULT_CASCADE_CONFIG, draftBatchMaxTokens: batchMaxTokens },
            promptConfig: {
                activeConditionIds: ALL_CONDITION_IDS,
                filePaths: reviewableFiles.map((file) => file.filename),
                overrideSmartDetection: false,
            },
            ...overrides,
        });
    }

    function buildBatchLlmResponse(issuePath: string | null, summary: string) {
        return {
            text: JSON.stringify({
                has_slop: issuePath !== null,
                issues: issuePath === null ? [] : [{
                    rule: 'Condition 1 (Silent Error Swallowing)', severity: 'CRITICAL', path: issuePath,
                    line: 42, end_line: 42, exact_quote: 'catch (e) {}', critique: `Empty catch block in ${issuePath}.`,
                }],
                summary,
            }),
            usageMetadata: { promptTokenCount: 500, cachedContentTokenCount: 0, candidatesTokenCount: 120 },
        };
    }

    /** Antwortet je nach Batch-Inhalt — die Reihenfolge paralleler Calls ist keine Zusage. */
    function respondByBatch(alphaResponse: () => Promise<unknown>, betaResponse: () => Promise<unknown>): void {
        generateContentMock.mockImplementation((request: { contents: string }) => (
            request.contents.includes(ALPHA_HEADER) ? alphaResponse() : betaResponse()
        ));
    }

    function sentContents(callIndex: number): string {
        return generateContentMock.mock.calls[callIndex][0].contents as string;
    }

    function sentContentsFor(fileHeader: string): string {
        const matchingCall = generateContentMock.mock.calls.find((sentCall) => String(sentCall[0].contents).includes(fileHeader));
        if (!matchingCall) throw new Error(`Kein Call mit ${fileHeader}`);
        return matchingCall[0].contents as string;
    }

    beforeEach(() => {
        generateContentMock.mockReset();
        recordLlmCallMock.mockClear();
    });

    it('fährt über der Grenze einen PARALLELEN Pass pro Batch mit batch-gefiltertem <already_flagged> und vereinigt die Issues in Diff-Reihenfolge', async () => {
        let inFlightCalls = 0;
        let maxInFlightCalls = 0;
        const respondAfter = async (delayMs: number, response: unknown): Promise<unknown> => {
            inFlightCalls += 1;
            maxInFlightCalls = Math.max(maxInFlightCalls, inFlightCalls);
            await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
            inFlightCalls -= 1;
            return response;
        };
        // Alpha antwortet LANGSAMER als Beta — die Issue-Reihenfolge folgt trotzdem dem Diff.
        respondByBatch(
            () => respondAfter(40, buildBatchLlmResponse('src/lib/alpha.ts', 'alpha review')),
            () => respondAfter(5, buildBatchLlmResponse('src/lib/beta.ts', 'beta review')),
        );
        const batchedContext = buildTwoFileContext(SPLITTING_BATCH_LIMIT, {
            prescanIssues: [
                buildReviewIssue({ rule: 'SEC-029 (Banned libc API)', path: 'src/lib/alpha.ts', line: 12, source: 'pre-scanner' }),
                buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', path: 'src/lib/beta.ts', line: 13, source: 'pre-scanner' }),
            ],
        });

        const draftedContext = await draftReviewerStep.execute(batchedContext);

        expect(generateContentMock).toHaveBeenCalledTimes(2);
        expect(maxInFlightCalls, 'beide Batch-Calls liefen gleichzeitig').toBe(2);
        const alphaPrompt = sentContentsFor(ALPHA_HEADER);
        expect(alphaPrompt).not.toContain(BETA_HEADER);
        expect(alphaPrompt).toContain('- (SEC-029, src/lib/alpha.ts, line 12)');
        expect(alphaPrompt).not.toContain('src/lib/beta.ts, line 13');
        const betaPrompt = sentContentsFor(BETA_HEADER);
        expect(betaPrompt).not.toContain(ALPHA_HEADER);
        expect(betaPrompt).toContain('- (MAINT-001, src/lib/beta.ts, line 13)');
        expect(betaPrompt).not.toContain('src/lib/alpha.ts, line 12');
        // Gleicher Envelope: beide Calls tragen denselben Layer-1-Prefix (hier inline).
        expect(generateContentMock.mock.calls[0][0].config.systemInstruction)
            .toBe(generateContentMock.mock.calls[1][0].config.systemInstruction);

        expect(draftedContext.issues.map((issue) => issue.path)).toEqual(['src/lib/alpha.ts', 'src/lib/beta.ts']);
        expect(draftedContext.reviewSummary).toBe('alpha review beta review');
        expect(draftedContext.tokenUsage?.promptTokens).toBe(1000);
        expect(draftedContext.cascade.degradations).toEqual([]);
        expect(draftedContext.cascade.draftUnreviewedFiles).toEqual([]);
        // Telemetrie: eine draft-Zeile pro Batch, wie heute pro Call.
        expect(recordLlmCallMock).toHaveBeenCalledTimes(2);
        expect(recordLlmCallMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ phase: 'draft', status: 'ok' }));
        expect(recordLlmCallMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ phase: 'draft', status: 'ok' }));
    });

    it('unter der Grenze bleibt der Draft-Request byte-identisch zum Einzel-Call (Evidence, Practices, alle Prescan-Tupel, ganzer Diff)', async () => {
        generateContentMock.mockResolvedValue(buildBatchLlmResponse(null, 'No AI slop found.'));
        const prescanIssues = [
            buildReviewIssue({ rule: 'SEC-029 (Banned libc API)', path: 'src/lib/alpha.ts', line: 12, source: 'pre-scanner' }),
            buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', path: 'src/lib/beta.ts', line: 13, source: 'pre-scanner' }),
        ];
        const singleCallContext = buildTwoFileContext(GENEROUS_BATCH_LIMIT, {
            ragPromptSection: '=== EVIDENCE (Local Repo Context) ===\nexport function fetchData(): Data;',
            practicesPromptSection: '=== REFERENCE PRACTICES ===\nPrefer explicit error handling.',
            prescanIssues,
        });

        const draftedContext = await draftReviewerStep.execute(singleCallContext);

        expect(generateContentMock).toHaveBeenCalledTimes(1);
        // Exakt die Komposition von vor dem Chunking: Protokoll, Sektionen, NEW-CODE-Marker, combinedDiff.
        const expectedContents = `${buildProtocolBlock('reviewer_rag')}\n\n`
            + `${singleCallContext.ragPromptSection}\n\n`
            + `${singleCallContext.practicesPromptSection}\n\n`
            + `${buildAlreadyFlaggedSection(prescanIssues)}`
            + `\n\n\n=== NEW CODE (Pull Request Diff) ===\n${singleCallContext.combinedDiff}`;
        expect(sentContents(0)).toBe(expectedContents);
        expect(draftedContext.cascade.degradations).toEqual([]);
        expect(draftedContext.cascade.draftUnreviewedFiles).toEqual([]);
    });

    it('pro-direct chunkt nicht: ein Call auf dem Eskalations-Modell mit dem ganzen Diff (Spec §5)', async () => {
        generateContentMock.mockResolvedValue(buildBatchLlmResponse('src/lib/beta.ts', 'pro review'));
        const proDirectContext = buildTwoFileContext(SPLITTING_BATCH_LIMIT, {
            cascade: buildCascadeState({ route: 'pro-direct', escalated: true }),
        });

        const draftedContext = await draftReviewerStep.execute(proDirectContext);

        expect(generateContentMock).toHaveBeenCalledTimes(1);
        expect(generateContentMock.mock.calls[0][0].model).toBe(MODEL_ESCALATION);
        expect(sentContents(0)).toContain(ALPHA_HEADER);
        expect(sentContents(0)).toContain(BETA_HEADER);
        expect(draftedContext.cascade.route).toBe('pro-direct');
    });

    it('jeder Batch-Call trägt das Budget-Signal des Deadline Guards (§3.2)', async () => {
        respondByBatch(
            () => Promise.resolve(buildBatchLlmResponse(null, 'No AI slop found.')),
            () => Promise.resolve(buildBatchLlmResponse(null, 'No AI slop found.')),
        );

        await draftReviewerStep.execute(buildTwoFileContext(SPLITTING_BATCH_LIMIT, { deadlineAtMs: Date.now() + 120_000 }));

        expect(generateContentMock).toHaveBeenCalledTimes(2);
        for (const sentCall of generateContentMock.mock.calls) {
            expect(sentCall[0].config.abortSignal).toBeInstanceOf(AbortSignal);
            expect(sentCall[0].config.abortSignal.aborted).toBe(false);
        }
    });

    it('draft_partial: ein gescheiterter Batch degradiert, die übrigen zählen, die Dateien werden genannt', async () => {
        // Real beobachtet (Spec §3.5): Vertex 500 INTERNAL nach > 60 s, kein Retry nach A11.
        respondByBatch(
            () => Promise.reject(new Error('500 INTERNAL nach 70 s')),
            () => Promise.resolve(buildBatchLlmResponse('src/lib/beta.ts', 'beta review')),
        );

        const draftedContext = await draftReviewerStep.execute(buildTwoFileContext(SPLITTING_BATCH_LIMIT));

        expect(draftedContext.issues.map((issue) => issue.path)).toEqual(['src/lib/beta.ts']);
        expect(draftedContext.cascade.degradations).toEqual(['draft_partial']);
        expect(draftedContext.cascade.draftUnreviewedFiles).toEqual(['src/lib/alpha.ts']);
        expect(draftedContext.reviewSummary).toBe('beta review');
        expect(draftedContext.tokenUsage?.promptTokens).toBe(500);
        expect(recordLlmCallMock).toHaveBeenCalledWith(expect.objectContaining({ phase: 'draft', status: 'api_error' }));
        expect(recordLlmCallMock).toHaveBeenCalledWith(expect.objectContaining({ phase: 'draft', status: 'ok' }));
    });

    it('ein Deadline-Abbruch nur EINES Batches ist draft_partial, kein review_timeout des Jobs', async () => {
        respondByBatch(
            () => Promise.reject(deadlineAbort()),
            () => Promise.resolve(buildBatchLlmResponse('src/lib/beta.ts', 'beta review')),
        );

        const draftedContext = await draftReviewerStep.execute(
            buildTwoFileContext(SPLITTING_BATCH_LIMIT, { deadlineAtMs: Date.now() + 120_000 }),
        );

        expect(draftedContext.cascade.degradations).toEqual(['draft_partial']);
        expect(draftedContext.cascade.draftUnreviewedFiles).toEqual(['src/lib/alpha.ts']);
    });

    it('die Summary eines Batches ohne Findings verwässert die der anderen nicht', async () => {
        respondByBatch(
            () => Promise.resolve(buildBatchLlmResponse(null, 'No AI slop found.')),
            () => Promise.resolve(buildBatchLlmResponse('src/lib/beta.ts', 'beta review')),
        );
        const draftedContext = await draftReviewerStep.execute(buildTwoFileContext(SPLITTING_BATCH_LIMIT));
        expect(draftedContext.reviewSummary).toBe('beta review');

        generateContentMock.mockReset();
        respondByBatch(
            () => Promise.resolve(buildBatchLlmResponse(null, 'Nothing here.')),
            () => Promise.resolve(buildBatchLlmResponse(null, 'Nothing there.')),
        );
        const cleanContext = await draftReviewerStep.execute(buildTwoFileContext(SPLITTING_BATCH_LIMIT));
        expect(cleanContext.issues).toEqual([]);
        expect(cleanContext.reviewSummary).toBe('No AI slop found.');
    });

    it('scheitern ALLE Batches, gilt das Verhalten des Einzel-Drafts: der erste Fehler in Diff-Reihenfolge propagiert', async () => {
        respondByBatch(
            () => Promise.reject(new Error('alpha down')),
            () => Promise.reject(new Error('beta down')),
        );

        await expect(draftReviewerStep.execute(buildTwoFileContext(SPLITTING_BATCH_LIMIT))).rejects.toThrow('alpha down');
        expect(recordLlmCallMock).toHaveBeenCalledTimes(2);
        expect(recordLlmCallMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ phase: 'draft', status: 'api_error' }));
        expect(recordLlmCallMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ phase: 'draft', status: 'api_error' }));
    });

    it('scheitern alle Batches und einer am Job-Budget, endet der Draft als review_timeout (D5)', async () => {
        respondByBatch(
            () => Promise.reject(new Error('alpha down')),
            () => Promise.reject(deadlineAbort()),
        );

        await expect(draftReviewerStep.execute(
            buildTwoFileContext(SPLITTING_BATCH_LIMIT, { deadlineAtMs: Date.now() + 120_000 }),
        )).rejects.toMatchObject({ name: 'ReviewTimeoutError' });
    });
});
