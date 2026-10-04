/**
 * Unit Tests: Explicit-Context-Cache-Lifecycle & D8-Fallback
 * (PROMPT_CACHING_SPEC §6, §9).
 *
 * Kern-Invarianten: Kill-Switch und Min-Size-Guard erzwingen inline; ein
 * Registry-Hit bumpt die TTL nur unter halber Restlaufzeit; ein cached Call
 * trägt NIE ein request-seitiges systemInstruction (Phase-A-Receipt F1);
 * jeder Cache-Fehler degradiert über recreate-once zu inline — nie zum
 * Job-Fehler.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    computeCacheKey,
    resolveContextCache,
    runEnvelopeGenerateContent,
} from '@/lib/pipeline/context-cache';
import type { CacheKeyInputs, FlashPromptEnvelope } from '@/lib/pipeline/context-cache';

const {
    maybeSingleMock,
    updateMock,
    upsertMock,
    deleteEqMock,
    cachesCreateMock,
    cachesUpdateMock,
    euCachesCreateMock,
    generateContentMock,
} = vi.hoisted(() => {
    const hoistedUpdateEqMock = vi.fn(() => Promise.resolve({ error: null }));
    return {
        maybeSingleMock: vi.fn(),
        // Signatur deklariert das Update-Payload (für mock.calls-Typing);
        // die Implementierung braucht es nicht — sie liefert nur die eq-Chain.
        updateMock: vi.fn<(updatePayload: Record<string, unknown>) => { eq: typeof hoistedUpdateEqMock }>(
            () => ({ eq: hoistedUpdateEqMock }),
        ),
        upsertMock: vi.fn(() => Promise.resolve({ error: null })),
        deleteEqMock: vi.fn(() => Promise.resolve({ error: null })),
        cachesCreateMock: vi.fn(),
        cachesUpdateMock: vi.fn(() => Promise.resolve({ expireTime: 'irrelevant' })),
        euCachesCreateMock: vi.fn(),
        generateContentMock: vi.fn(),
    };
});

vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
            update: updateMock,
            upsert: upsertMock,
            delete: () => ({ eq: deleteEqMock }),
        }),
    },
}));
vi.mock('@/lib/vertex', () => ({
    getVertexClient: () => ({
        caches: { create: cachesCreateMock, update: cachesUpdateMock },
        models: { generateContent: generateContentMock },
    }),
    // Eigener create-Mock: die D3-Tests unterscheiden darüber, auf WELCHEM
    // Client (west3 vs. eu-Multiregion) ein Cache angelegt wurde.
    getVertexEuClient: () => ({
        caches: { create: euCachesCreateMock, update: cachesUpdateMock },
        models: { generateContent: generateContentMock },
    }),
    getVertexGlobalClient: () => ({ models: { generateContent: generateContentMock } }),
}));

// Über dem V0.3-Minimum (16.384 Zeichen ≈ 4.096 Tokens der 3.x-Generation).
const CACHEABLE_PREFIX = 'P'.repeat(20_000);

const BASE_KEY_INPUTS: CacheKeyInputs = {
    model: 'gemini-2.5-flash',
    lawContentHash: 'law-hash-a',
    detectedEcosystems: ['nextjs', 'react'],
    activeConditionIds: ['COND-001', 'COND-002'],
};

function buildCachedEnvelope(cacheStatus: 'explicit_hit' | 'explicit_created' = 'explicit_hit'): FlashPromptEnvelope {
    return {
        cachedPrefix: CACHEABLE_PREFIX,
        protocolBlock: '=== TASK PROTOCOL: TEST ===',
        keyInputs: BASE_KEY_INPUTS,
        role: 'draft',
        plan: {
            mode: 'cached',
            vertexCacheName: 'projects/p/locations/l/cachedContents/existing',
            cacheKey: computeCacheKey(BASE_KEY_INPUTS),
            cacheStatus,
        },
    };
}

function buildRegistryRow(remainingSeconds: number) {
    return {
        data: {
            vertex_cache_name: 'projects/p/locations/l/cachedContents/registered',
            expires_at: new Date(Date.now() + remainingSeconds * 1000).toISOString(),
        },
        error: null,
    };
}

function buildCreatedVertexCache() {
    return {
        name: 'projects/p/locations/l/cachedContents/fresh',
        usageMetadata: { totalTokenCount: 15_000 },
        expireTime: new Date(Date.now() + 3600_000).toISOString(),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERTEX_CONTEXT_CACHE_DISABLED;
    delete process.env.VERTEX_CACHE_TTL_SECONDS;
    generateContentMock.mockResolvedValue({ text: '{}', usageMetadata: {} });
});

// =============================================================================
// computeCacheKey (§4.3)
// =============================================================================

describe('computeCacheKey', () => {
    it('ist deterministisch und unabhängig von der Reihenfolge der Ökosysteme/Conditions', () => {
        const reorderedInputs: CacheKeyInputs = {
            ...BASE_KEY_INPUTS,
            detectedEcosystems: ['react', 'nextjs'],
            activeConditionIds: ['COND-002', 'COND-001'],
        };

        expect(computeCacheKey(reorderedInputs)).toBe(computeCacheKey(BASE_KEY_INPUTS));
    });

    it.each([
        ['lawContentHash', { lawContentHash: 'law-hash-b' }],
        ['model', { model: 'gemini-2.5-flash-lite' }],
        ['ecosystems', { detectedEcosystems: ['python'] }],
        ['conditions', { activeConditionIds: ['COND-001'] }],
    ] as const)('rotiert bei geändertem %s', (_dimension, keyInputOverride) => {
        const rotatedKey = computeCacheKey({ ...BASE_KEY_INPUTS, ...keyInputOverride });

        expect(rotatedKey).not.toBe(computeCacheKey(BASE_KEY_INPUTS));
    });

    it('behandelt null (nie erkannt) und leere Erkennung als denselben Key', () => {
        // Seit dem []-Fix (law.ts, Clean-Scan-Anomalie 2026-08-10) rendern
        // beide denselben ungefilterten Law-Block — getrennte Keys würden nur
        // ein inhaltsgleiches Cache-Duplikat erzeugen.
        const neverDetectedKey = computeCacheKey({ ...BASE_KEY_INPUTS, detectedEcosystems: null });
        const emptyDetectionKey = computeCacheKey({ ...BASE_KEY_INPUTS, detectedEcosystems: [] });

        expect(neverDetectedKey).toBe(emptyDetectionKey);
    });
});

// =============================================================================
// resolveContextCache (§6.1)
// =============================================================================

describe('resolveContextCache', () => {
    it('Kill-Switch erzwingt inline ohne jeden DB- oder Vertex-Zugriff', async () => {
        process.env.VERTEX_CONTEXT_CACHE_DISABLED = '1';

        const resolvedPlan = await resolveContextCache(CACHEABLE_PREFIX, BASE_KEY_INPUTS);

        expect(resolvedPlan).toEqual({ mode: 'inline', cacheStatus: 'inline' });
        expect(maybeSingleMock).not.toHaveBeenCalled();
        expect(cachesCreateMock).not.toHaveBeenCalled();
    });

    it('Min-Size-Guard (V0.3: 4.096 Tokens auf 3.x) erzwingt inline für zu kleine Prefixe', async () => {
        const undersizedPrefix = 'x'.repeat(1_000);

        const resolvedPlan = await resolveContextCache(undersizedPrefix, BASE_KEY_INPUTS);

        expect(resolvedPlan).toEqual({ mode: 'inline', cacheStatus: 'inline' });
        expect(cachesCreateMock).not.toHaveBeenCalled();
    });

    it('junger Registry-Hit: explicit_hit ohne TTL-Bump, last_used_at wird gepflegt', async () => {
        maybeSingleMock.mockResolvedValue(buildRegistryRow(3_000));

        const resolvedPlan = await resolveContextCache(CACHEABLE_PREFIX, BASE_KEY_INPUTS);

        expect(resolvedPlan).toMatchObject({ mode: 'cached', cacheStatus: 'explicit_hit' });
        expect(cachesUpdateMock).not.toHaveBeenCalled();
        const registryUpdatePayload = updateMock.mock.calls[0][0];
        expect(registryUpdatePayload.last_used_at).toBeDefined();
        expect(registryUpdatePayload.expires_at).toBeUndefined();
    });

    it('alter Registry-Hit (< halbe TTL): PATCH auf volle TTL + expires_at-Update (D9)', async () => {
        maybeSingleMock.mockResolvedValue(buildRegistryRow(1_200));

        const resolvedPlan = await resolveContextCache(CACHEABLE_PREFIX, BASE_KEY_INPUTS);

        expect(resolvedPlan).toMatchObject({ mode: 'cached', cacheStatus: 'explicit_hit' });
        expect(cachesUpdateMock).toHaveBeenCalledWith({
            name: 'projects/p/locations/l/cachedContents/registered',
            config: { ttl: '3600s' },
        });
        const registryUpdatePayload = updateMock.mock.calls[0][0];
        expect(registryUpdatePayload.expires_at).toBeDefined();
    });

    it('fast abgelaufene Registry-Zeile (< Safety-Margin) zählt als Miss', async () => {
        maybeSingleMock.mockResolvedValue(buildRegistryRow(60));
        cachesCreateMock.mockResolvedValue(buildCreatedVertexCache());

        const resolvedPlan = await resolveContextCache(CACHEABLE_PREFIX, BASE_KEY_INPUTS);

        expect(resolvedPlan).toMatchObject({ mode: 'cached', cacheStatus: 'explicit_created' });
        expect(cachesCreateMock).toHaveBeenCalledTimes(1);
    });

    it('Miss: Cache anlegen, Registry-Upsert mit Key-Feldern (explicit_created)', async () => {
        maybeSingleMock.mockResolvedValue({ data: null, error: null });
        cachesCreateMock.mockResolvedValue(buildCreatedVertexCache());

        const resolvedPlan = await resolveContextCache(CACHEABLE_PREFIX, BASE_KEY_INPUTS);

        expect(resolvedPlan).toMatchObject({
            mode: 'cached',
            cacheStatus: 'explicit_created',
            vertexCacheName: 'projects/p/locations/l/cachedContents/fresh',
        });
        expect(cachesCreateMock).toHaveBeenCalledWith(expect.objectContaining({
            model: 'gemini-2.5-flash',
            config: expect.objectContaining({ systemInstruction: CACHEABLE_PREFIX, ttl: '3600s' }),
        }));
        expect(upsertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                cache_key: computeCacheKey(BASE_KEY_INPUTS),
                vertex_cache_name: 'projects/p/locations/l/cachedContents/fresh',
                law_content_hash: 'law-hash-a',
                ecosystems_key: 'nextjs,react',
                cached_token_count: 15_000,
            }),
            { onConflict: 'cache_key' },
        );
    });

    it('D3 (MODEL_MIGRATION_SPEC): ein 3.6-Cache entsteht auf dem eu-Multiregion-Client, nicht auf west3', async () => {
        maybeSingleMock.mockResolvedValue({ data: null, error: null });
        euCachesCreateMock.mockResolvedValue(buildCreatedVertexCache());

        const euKeyInputs: CacheKeyInputs = { ...BASE_KEY_INPUTS, model: 'gemini-3.6-flash' };
        const resolvedPlan = await resolveContextCache(CACHEABLE_PREFIX, euKeyInputs);

        expect(resolvedPlan).toMatchObject({ mode: 'cached', cacheStatus: 'explicit_created' });
        expect(euCachesCreateMock).toHaveBeenCalledWith(expect.objectContaining({
            model: 'gemini-3.6-flash',
        }));
        expect(cachesCreateMock).not.toHaveBeenCalled();
    });

    it('VERTEX_CACHE_TTL_SECONDS überschreibt die Default-TTL', async () => {
        process.env.VERTEX_CACHE_TTL_SECONDS = '900';
        maybeSingleMock.mockResolvedValue({ data: null, error: null });
        cachesCreateMock.mockResolvedValue(buildCreatedVertexCache());

        await resolveContextCache(CACHEABLE_PREFIX, BASE_KEY_INPUTS);

        expect(cachesCreateMock).toHaveBeenCalledWith(expect.objectContaining({
            config: expect.objectContaining({ ttl: '900s' }),
        }));
    });

    it('Create-Fehler degradiert zu inline_fallback — nie ein Throw', async () => {
        maybeSingleMock.mockResolvedValue({ data: null, error: null });
        cachesCreateMock.mockRejectedValue(new Error('429 quota exceeded'));

        const resolvedPlan = await resolveContextCache(CACHEABLE_PREFIX, BASE_KEY_INPUTS);

        expect(resolvedPlan).toEqual({ mode: 'inline', cacheStatus: 'inline_fallback' });
    });

    it('fehlgeschlagener TTL-Bump ist non-fatal — der Hit bleibt cached, expires_at unverändert', async () => {
        maybeSingleMock.mockResolvedValue(buildRegistryRow(1_200));
        cachesUpdateMock.mockRejectedValueOnce(new Error('503 backend'));

        const resolvedPlan = await resolveContextCache(CACHEABLE_PREFIX, BASE_KEY_INPUTS);

        expect(resolvedPlan).toMatchObject({ mode: 'cached', cacheStatus: 'explicit_hit' });
        const registryUpdatePayload = updateMock.mock.calls[0][0];
        expect(registryUpdatePayload.expires_at).toBeUndefined();
        expect(registryUpdatePayload.last_used_at).toBeDefined();
    });
});

// =============================================================================
// runEnvelopeGenerateContent (§6.2, D8)
// =============================================================================

describe('runEnvelopeGenerateContent', () => {
    it('cached: config.cachedContent gesetzt, KEIN systemInstruction (F1), Protokoll + Tail als Contents', async () => {
        const callResult = await runEnvelopeGenerateContent(buildCachedEnvelope(), 'DYNAMIC TAIL');

        expect(callResult.effectiveCacheStatus).toBe('explicit_hit');
        const sentRequest = generateContentMock.mock.calls[0][0];
        expect(sentRequest.config.cachedContent).toBe('projects/p/locations/l/cachedContents/existing');
        expect(sentRequest.config.systemInstruction).toBeUndefined();
        expect(sentRequest.contents).toBe('=== TASK PROTOCOL: TEST ===\n\nDYNAMIC TAIL');
    });

    it('Latenz-Guard: NUR die Eskalations-Rolle bekommt eine Call-Deadline (AbortSignal), Draft/Verifier nicht', async () => {
        await runEnvelopeGenerateContent({ ...buildCachedEnvelope(), role: 'escalation' }, 'TAIL');
        await runEnvelopeGenerateContent({ ...buildCachedEnvelope(), role: 'draft' }, 'TAIL');
        await runEnvelopeGenerateContent(
            { ...buildCachedEnvelope(), role: 'verifier', plan: { mode: 'inline', cacheStatus: 'inline' } },
            'TAIL',
        );

        const [escalationRequest, draftRequest, verifierRequest] = generateContentMock.mock.calls.map(
            (callArguments) => callArguments[0],
        );
        expect(escalationRequest.config.abortSignal).toBeInstanceOf(AbortSignal);
        expect(escalationRequest.config.abortSignal.aborted).toBe(false);
        expect(draftRequest.config.abortSignal).toBeUndefined();
        expect(verifierRequest.config.abortSignal).toBeUndefined();
    });

    it('inline: systemInstruction = Layer 1, identische Contents', async () => {
        const inlineEnvelope: FlashPromptEnvelope = {
            ...buildCachedEnvelope(),
            plan: { mode: 'inline', cacheStatus: 'inline' },
        };

        const callResult = await runEnvelopeGenerateContent(inlineEnvelope, 'DYNAMIC TAIL');

        expect(callResult.effectiveCacheStatus).toBe('inline');
        const sentRequest = generateContentMock.mock.calls[0][0];
        expect(sentRequest.config.systemInstruction).toBe(CACHEABLE_PREFIX);
        expect(sentRequest.config.cachedContent).toBeUndefined();
        expect(sentRequest.contents).toBe('=== TASK PROTOCOL: TEST ===\n\nDYNAMIC TAIL');
    });

    it('D8: Cache-404 → Registry-Delete, recreate once, cached Retry (explicit_created)', async () => {
        generateContentMock
            .mockRejectedValueOnce(new Error('404 NOT_FOUND: CachedContent not found'))
            .mockResolvedValueOnce({ text: '{}', usageMetadata: {} });
        cachesCreateMock.mockResolvedValue(buildCreatedVertexCache());

        const callResult = await runEnvelopeGenerateContent(buildCachedEnvelope(), 'TAIL');

        expect(callResult.effectiveCacheStatus).toBe('explicit_created');
        expect(deleteEqMock).toHaveBeenCalled();
        const retriedRequest = generateContentMock.mock.calls[1][0];
        expect(retriedRequest.config.cachedContent).toBe('projects/p/locations/l/cachedContents/fresh');
    });

    it('D8: scheitert auch der Recreate → Inline-Fallback (inline_fallback, systemInstruction gesetzt)', async () => {
        generateContentMock
            .mockRejectedValueOnce(new Error('404 NOT_FOUND: CachedContent not found'))
            .mockResolvedValueOnce({ text: '{}', usageMetadata: {} });
        cachesCreateMock.mockRejectedValue(new Error('429 quota'));

        const callResult = await runEnvelopeGenerateContent(buildCachedEnvelope(), 'TAIL');

        expect(callResult.effectiveCacheStatus).toBe('inline_fallback');
        const fallbackRequest = generateContentMock.mock.calls[1][0];
        expect(fallbackRequest.config.systemInstruction).toBe(CACHEABLE_PREFIX);
        expect(fallbackRequest.config.cachedContent).toBeUndefined();
    });

    it('Nicht-Cache-Fehler propagieren unverändert in die Step-Semantik', async () => {
        generateContentMock.mockRejectedValue(new Error('429 Resource exhausted'));

        await expect(runEnvelopeGenerateContent(buildCachedEnvelope(), 'TAIL')).rejects.toThrow(
            '429 Resource exhausted',
        );
        expect(cachesCreateMock).not.toHaveBeenCalled();
        expect(generateContentMock).toHaveBeenCalledTimes(1);
    });
});
