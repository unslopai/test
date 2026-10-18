/**
 * Unit Tests: Cache-Contract v2 der Zwei-Schichten-Prompt-Architektur
 * (PROMPT_CACHING_SPEC §4, §9).
 *
 * LAYER 1 (Cache-Prefix) hängt NUR von (activeConditionIds, lawBlock) ab und
 * ist byte-identisch über alle Scans eines Cache-Keys. LAYER 2 (Protokoll-
 * Blöcke) sind statische Konstanten. Dynamik (Evidence, Practices,
 * <already_flagged>, Diff) existiert ausschließlich im Tail des User-Contents.
 * Der Verifier bekommt strukturell keine Practices (PROC-001).
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildCachedPrefix,
    buildPrompt,
    buildProtocolBlock,
} from '@/lib/pipeline/prompt-builder';
import { draftReviewerStep } from '@/lib/pipeline/steps/draft-reviewer-step';
import { ALL_CONDITION_IDS } from '@/lib/pipeline/conditions';
import { buildPipelineContext, buildPullRequestFile } from '@/lib/pipeline/testing/context-fixture';
import type { PromptConfig } from '@/lib/pipeline/types';
import type { PromptVariant } from '@/lib/pipeline/prompt-builder';
import { computeCacheKey } from '@/lib/pipeline/context-cache';
import type { RepoContextPackage } from '@unslop/shared/repo-context';

const { generateContentMock } = vi.hoisted(() => ({
    generateContentMock: vi.fn(),
}));

vi.mock('@/lib/vertex', () => ({
    getVertexClient: () => ({ models: { generateContent: generateContentMock } }),
    getVertexEuClient: () => ({ models: { generateContent: generateContentMock } }),
    getVertexGlobalClient: () => ({ models: { generateContent: generateContentMock } }),
}));
vi.mock('@/lib/telemetry/llm-call-log', () => ({ recordLlmCall: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/law', () => ({
    fetchRenderedLawBlock: () => Promise.resolve({
        lawBlock: '=== THE LAW ===\nStatischer Law-Block.',
        lawContentHash: 'law-test-hash',
        ruleIds: [],
    }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

// Kill-Switch: die Step-Tests hier prüfen die TEXT-Schichten über den
// Inline-Pfad; das Cache-Verhalten selbst deckt context-cache.test.ts ab.
process.env.VERTEX_CONTEXT_CACHE_DISABLED = '1';
afterAll(() => {
    delete process.env.VERTEX_CONTEXT_CACHE_DISABLED;
});

const PROMPT_CONFIG: PromptConfig = {
    activeConditionIds: ALL_CONDITION_IDS,
    filePaths: ['src/lib/example.ts'],
    overrideSmartDetection: false,
};

const ALL_VARIANTS: readonly PromptVariant[] = ['reviewer_diff', 'reviewer_rag', 'claim_verifier'];

const PRACTICES_SECTION =
    '=== REFERENCE PRACTICES (Official Framework Documentation — ADVISORY ONLY) ===\n' +
    '[typescript] Prefer unknown over any (https://typescriptlang.org/docs)\nBody.';

function buildEmptyLlmResponse() {
    return {
        text: JSON.stringify({ has_slop: false, issues: [], summary: 'No AI slop found.' }),
        usageMetadata: { promptTokenCount: 100, cachedContentTokenCount: 0, candidatesTokenCount: 10 },
    };
}

describe('Layer 1 — Cache-Prefix (Cache-Contract v2)', () => {
    it('ist byte-identisch über wiederholte Aufrufe', () => {
        expect(buildCachedPrefix(PROMPT_CONFIG, 'LAW')).toBe(buildCachedPrefix(PROMPT_CONFIG, 'LAW'));
    });

    it('enthält Conditions und Law, aber keinerlei Varianten-Protokoll', () => {
        const cachedPrefix = buildCachedPrefix(PROMPT_CONFIG, '=== THE LAW ===\nRegeln.');

        expect(cachedPrefix).toContain('MACRO & STRUCTURAL CONDITIONS');
        expect(cachedPrefix).toContain('=== THE LAW ===');
        // Der Core KÜNDIGT den Protokoll-Block an ("Each request begins with a
        // TASK PROTOCOL block…") — enthalten darf er ihn nie (Header-Marker).
        expect(cachedPrefix).not.toContain('=== TASK PROTOCOL');
        expect(cachedPrefix).not.toContain('=== OUTPUT FORMAT ===');
        expect(cachedPrefix).not.toContain('REFERENCE PRACTICES');
    });

    it('hängt nicht von filePaths oder overrideSmartDetection ab', () => {
        const alternateConfig: PromptConfig = {
            activeConditionIds: ALL_CONDITION_IDS,
            filePaths: ['completely/other/path.py'],
            overrideSmartDetection: true,
        };

        expect(buildCachedPrefix(alternateConfig, 'LAW')).toBe(buildCachedPrefix(PROMPT_CONFIG, 'LAW'));
    });
});

describe('Layer 2 — Protokoll-Blöcke', () => {
    it('sind statische Konstanten (byte-identisch über Aufrufe)', () => {
        for (const promptVariant of ALL_VARIANTS) {
            expect(buildProtocolBlock(promptVariant)).toBe(buildProtocolBlock(promptVariant));
        }
    });

    it('beide Reviewer-Protokolle tragen den Practices-Hinweis, der Verifier nicht (PROC-001)', () => {
        expect(buildProtocolBlock('reviewer_diff')).toContain('REFERENCE PRACTICES');
        expect(buildProtocolBlock('reviewer_rag')).toContain('REFERENCE PRACTICES');
        expect(buildProtocolBlock('claim_verifier')).not.toContain('REFERENCE PRACTICES');
    });

    it('die COND-004-RAG-Interpretation lebt im RAG-Protokoll, nicht im Prefix', () => {
        expect(buildProtocolBlock('reviewer_rag')).toContain('already exists in EVIDENCE');
        expect(buildCachedPrefix(PROMPT_CONFIG, 'LAW')).not.toContain('already exists in EVIDENCE');
    });

    it('der Verifier-Block enthält kein Draft-Reviewer-Protokoll', () => {
        const verifierProtocol = buildProtocolBlock('claim_verifier');

        expect(verifierProtocol).toContain('INDEPENDENT verification auditor');
        expect(verifierProtocol).not.toContain('PULL REQUEST DIFF REVIEW');
        expect(verifierProtocol).not.toContain('fixed_code_snippet');
    });
});

describe('Inline-Parität (D8-Fallback ändert nie den Prompt-Text)', () => {
    it('buildPrompt === Layer 1 + Layer 2 für jede Variante', () => {
        for (const promptVariant of ALL_VARIANTS) {
            const composedInlinePrompt = buildPrompt(promptVariant, PROMPT_CONFIG, 'LAW');
            const expectedComposition =
                `${buildCachedPrefix(PROMPT_CONFIG, 'LAW')}\n\n${buildProtocolBlock(promptVariant)}`;

            expect(composedInlinePrompt).toBe(expectedComposition);
        }
    });
});

describe('Dynamik-Platzierung im Draft-Reviewer', () => {
    beforeEach(() => {
        generateContentMock.mockReset();
        generateContentMock.mockResolvedValue(buildEmptyLlmResponse());
    });

    it('Practices landen im Tail der Contents, der Cache-Prefix bleibt ohne sie identisch', async () => {
        const baseContext = buildPipelineContext({
            combinedDiff: '=== FILE: src/lib/example.ts (modified) ===\n+const x = 1;',
            reviewableFiles: [buildPullRequestFile()],
        });

        await draftReviewerStep.execute(baseContext);
        await draftReviewerStep.execute({ ...baseContext, practicesPromptSection: PRACTICES_SECTION });

        const [callWithout, callWith] = generateContentMock.mock.calls.map(
            (mockCall) => mockCall[0] as { contents: string; config: { systemInstruction: string } },
        );

        expect(callWithout.contents).not.toContain('REFERENCE PRACTICES (Official');
        expect(callWith.contents).toContain('REFERENCE PRACTICES (Official');
        expect(callWith.contents).toContain('=== NEW CODE (Pull Request Diff) ===');
        // Inline-Modus: systemInstruction IST der Layer-1-Prefix — byte-stabil
        // mit und ohne Practices, und frei von jeder Dynamik.
        expect(callWith.config.systemInstruction).toBe(callWithout.config.systemInstruction);
        expect(callWith.config.systemInstruction).not.toContain('REFERENCE PRACTICES');
        expect(callWith.config.systemInstruction).not.toContain('=== TASK PROTOCOL');
    });

    it('die Contents beginnen mit dem Protokoll-Block der gewählten Variante', async () => {
        const ragContext = buildPipelineContext({
            combinedDiff: '=== FILE: src/lib/example.ts (modified) ===\n+const x = 1;',
            reviewableFiles: [buildPullRequestFile()],
            ragPromptSection: '=== EVIDENCE ===\nSignaturen.',
        });

        await draftReviewerStep.execute(ragContext);

        const sentContents = generateContentMock.mock.calls[0][0].contents as string;
        expect(sentContents.startsWith(buildProtocolBlock('reviewer_rag'))).toBe(true);
        expect(sentContents).toContain('=== EVIDENCE ===');
    });
});

describe('Repo-Kontextpaket (REPO_CONTEXT_SPEC §6.3)', () => {
    const CONTEXT_PACKAGE: RepoContextPackage = {
        sections: [{
            kind: 'schema',
            path: 'db/schema.sql',
            content: 'Tables defined or altered in this file: contact_messages',
            relatedPaths: [],
        }],
        omissions: [],
        schemaCandidateCount: 1,
        pathListTruncated: false,
    };

    beforeEach(() => {
        generateContentMock.mockReset();
        generateContentMock.mockResolvedValue(buildEmptyLlmResponse());
    });

    it('steht nur im dynamischen Teil: Prefix und Cache-Key sind mit und ohne Paket identisch', async () => {
        const baseContext = buildPipelineContext({
            combinedDiff: '=== FILE: src/lib/example.ts (modified) ===\n+const x = 1;',
            reviewableFiles: [buildPullRequestFile()],
            promptConfig: PROMPT_CONFIG,
        });
        const contextWithPackage = {
            ...baseContext,
            repoContext: { status: 'loaded' as const, contextPackage: CONTEXT_PACKAGE, loadMs: 12, unavailableReason: null },
        };

        await draftReviewerStep.execute(baseContext);
        await draftReviewerStep.execute(contextWithPackage);

        const [callWithout, callWith] = generateContentMock.mock.calls.map(
            (mockCall) => mockCall[0] as { contents: string; config: { systemInstruction: string } },
        );
        expect(callWithout.contents).not.toContain('=== REPOSITORY CONTEXT (');
        expect(callWith.contents).toContain('--- [schema] db/schema.sql ---');
        expect(callWith.contents.indexOf('--- [schema] db/schema.sql ---'))
            .toBeLessThan(callWith.contents.indexOf('=== NEW CODE (Pull Request Diff) ==='));
        expect(callWith.config.systemInstruction).toBe(callWithout.config.systemInstruction);
        expect(callWith.config.systemInstruction).not.toContain('db/schema.sql');
        // Gecacht wird genau dieser Prefix (Inline-Modus: systemInstruction IST
        // Layer 1). Der Cache-Key hat konstruktiv keinen Paket-Eingang:
        // `CacheKeyInputs` kennt nur Modell, Law-Hash, Ökosysteme und Conditions.
    });

    it('der Cache-Key ändert sich mit Condition 12, also mit dem Repo-Kontext-Schalter, nicht mit dem Paket', () => {
        const keyInputs = { model: 'model-under-test', lawContentHash: 'law-test-hash', detectedEcosystems: null };
        const conditionIdsWithoutContext = ALL_CONDITION_IDS.filter((conditionId) => conditionId !== 'COND-012');

        expect(computeCacheKey({ ...keyInputs, activeConditionIds: ALL_CONDITION_IDS }))
            .not.toBe(computeCacheKey({ ...keyInputs, activeConditionIds: conditionIdsWithoutContext }));
        expect(buildCachedPrefix({ ...PROMPT_CONFIG, activeConditionIds: conditionIdsWithoutContext }, 'LAW'))
            .not.toContain('Repository Mismatch');
    });

    it('ohne Paket bleibt der Draft-Request der reine Diff', async () => {
        const baseContext = buildPipelineContext({
            combinedDiff: '=== FILE: src/lib/example.ts (modified) ===\n+const x = 1;',
            reviewableFiles: [buildPullRequestFile()],
        });

        await draftReviewerStep.execute(baseContext);

        const sentContents = generateContentMock.mock.calls[0][0].contents as string;
        expect(sentContents.endsWith(baseContext.combinedDiff)).toBe(true);
        expect(sentContents).not.toContain('=== NEW CODE (Pull Request Diff) ===');
    });
});
