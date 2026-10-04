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
import { MODEL_DRAFT, MODEL_ESCALATION } from '@/lib/pipeline/models';
import { buildAlreadyFlaggedSection } from '@/lib/pipeline/prompt-builder';
import { ModelUnavailableError } from '@/lib/pipeline/vertex-retry';
import {
    buildCascadeState,
    buildPipelineContext,
    buildPullRequestFile,
    buildReviewIssue,
} from '@/lib/pipeline/testing/context-fixture';

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
