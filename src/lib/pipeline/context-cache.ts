/**
 * Vertex Explicit Context Cache — Lifecycle & Call-Executor
 * (PROMPT_CACHING_SPEC §4.3, §6).
 *
 * EIN Cache pro (model × schemaVersion × lawContentHash × ecosystems ×
 * conditionIds) bedient Draft-Reviewer UND Claim-Verifier: der Cache hält den
 * geteilten Layer-1-Prefix als systemInstruction, die Varianten-Protokolle
 * (Layer 2) stehen uncached am Anfang der Request-Contents (Phase-A-Receipt
 * F1: ein Request mit cachedContent darf KEIN eigenes systemInstruction tragen).
 *
 * Lifecycle (D4/D9): lazy create on miss, sliding TTL — gebumpt nur, wenn
 * weniger als die halbe Lebenszeit übrig ist. Registry ist die Tabelle
 * vertex_context_caches; Invalidierung ist reine Hash-Rotation (D7).
 *
 * Fehler-Semantik (D8): recreate once, dann Inline-Fallback. Caching darf
 * NIEMALS einen Job scheitern lassen — jeder Fehler hier degradiert zum
 * vollwertigen uncached Prompt (identischer Text, buildPrompt-Parität).
 */
import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';
import {
    CASCADE_TEMPERATURE,
    isGlobalEndpointModel,
    resolveThinkingConfig,
    resolveVertexClientForModel,
} from '@/lib/pipeline/models';
import type { CascadeRole } from '@/lib/pipeline/models';
import { resolveCallDeadlineMs } from '@/lib/pipeline/deadline';
import {
    PROMPT_CACHE_SCHEMA_VERSION,
    buildCachedPrefix,
    buildProtocolBlock,
} from '@/lib/pipeline/prompt-builder';
import type { PromptVariant } from '@/lib/pipeline/prompt-builder';
import type { RenderedLaw } from '@/lib/law';
import type { PromptConfig } from '@/lib/pipeline/types';
import type { GenerateContentResponse } from '@google/genai';

// =============================================================================
// Types & Constants
// =============================================================================

export type CacheStatus = 'explicit_hit' | 'explicit_created' | 'inline' | 'inline_fallback';

export interface CacheKeyInputs {
    readonly model: string;
    readonly lawContentHash: string;
    /** null = Erkennung nie gelaufen → eigener Key-Bestandteil 'unfiltered'. */
    readonly detectedEcosystems: readonly string[] | null;
    readonly activeConditionIds: readonly string[];
}

export interface CachedPromptPlan {
    readonly mode: 'cached';
    readonly vertexCacheName: string;
    readonly cacheKey: string;
    readonly cacheStatus: 'explicit_hit' | 'explicit_created';
}

export interface InlinePromptPlan {
    readonly mode: 'inline';
    readonly cacheStatus: 'inline' | 'inline_fallback';
}

export type PromptPlan = CachedPromptPlan | InlinePromptPlan;

/**
 * Alles, was ein Flash-Call zum Ausführen braucht: die beiden Prompt-Layer
 * plus den aufgelösten Cache-Plan. Von Steps EINMAL pro Job aufgelöst und an
 * alle Calls durchgereicht.
 */
export interface FlashPromptEnvelope {
    readonly cachedPrefix: string;
    readonly protocolBlock: string;
    readonly plan: PromptPlan;
    readonly keyInputs: CacheKeyInputs;
    /** Rolle des Calls — bestimmt Thinking-Level und Call-Deadline, nie den Cache-Key. */
    readonly role: CascadeRole;
    /** Job-Deadline für LLM-Calls (DEADLINE_GUARD_SPEC §3.2); null = kein Job-Budget. */
    readonly deadlineAtMs: number | null;
}

export interface EnvelopeCallResult {
    readonly generateResponse: GenerateContentResponse;
    /** Was der Call TATSÄCHLICH genutzt hat (Plan kann per D8 degradieren). */
    readonly effectiveCacheStatus: CacheStatus;
}

const INLINE_PLAN: InlinePromptPlan = { mode: 'inline', cacheStatus: 'inline' };

/**
 * Call-Deadline (DEADLINE_GUARD_SPEC §3.2): JEDER LLM-Call bekommt ein
 * Signal aus dem Restbudget des Jobs, die Eskalations-Rolle zusätzlich ihren
 * 150-s-Latenz-Guard (deadline.ts). Das bewusste Gegenteil der früheren Regel
 * "Draft und Verifier haben keine Deadline": ein Draft, der den Plattform-Kill
 * reißt, liefert ebenfalls keinen Review — nur einen ewig hängenden Job (e409926e).
 * Das Signal entsteht PRO VERSUCH zum Call-Zeitpunkt, damit auch ein Retry
 * (Backoff, Cache-Recreate) nie über die Deadline hinaus läuft.
 */
function resolveCallAbortSignal(envelope: FlashPromptEnvelope): AbortSignal | undefined {
    const callDeadlineMs = resolveCallDeadlineMs(envelope.role, envelope.deadlineAtMs);
    return callDeadlineMs === null ? undefined : AbortSignal.timeout(callDeadlineMs);
}

/**
 * V0.3-Receipt (MODEL_MIGRATION_SPEC, 2026-08-26): Minimum auf der
 * 3.x-Generation ist 4.096 Tokens ("The minimum token count to start
 * explicit caching is 4096"), nicht 1.024 wie bei 2.5 (F2). Guard in
 * Zeichen (≈ Tokens × 4), auf das höhere Minimum ausgelegt — der echte
 * Law-Prefix liegt mit ~19k Tokens weit darüber; der 2.5-Legacy-Pfad
 * verliert dadurch praktisch nichts.
 */
const MIN_CACHEABLE_PREFIX_CHARS = 16384;
const CONTEXT_CACHE_SAFETY_MARGIN_MS = 120_000;
const DEFAULT_TTL_SECONDS = 3600;

function resolveTtlSeconds(): number {
    const configuredTtl = Number.parseInt(process.env.VERTEX_CACHE_TTL_SECONDS ?? '', 10);
    return Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : DEFAULT_TTL_SECONDS;
}

function isCacheDisabledByEnv(): boolean {
    const killSwitchValue = process.env.VERTEX_CONTEXT_CACHE_DISABLED;
    return killSwitchValue === '1' || killSwitchValue === 'true';
}

// =============================================================================
// Cache Key (§4.3)
// =============================================================================

export function computeCacheKey(keyInputs: CacheKeyInputs): string {
    const canonicalKeyPayload = JSON.stringify({
        model: keyInputs.model,
        schemaVersion: PROMPT_CACHE_SCHEMA_VERSION,
        lawContentHash: keyInputs.lawContentHash,
        ecosystems: buildEcosystemsKey(keyInputs.detectedEcosystems),
        conditionIds: [...keyInputs.activeConditionIds].sort(),
    });
    return createHash('sha256').update(canonicalKeyPayload, 'utf-8').digest('hex');
}

function buildEcosystemsKey(detectedEcosystems: readonly string[] | null): string {
    // Leere Erkennung rendert seit dem []-Fix (law.ts) denselben ungefilterten
    // Block wie null — derselbe Key verhindert ein inhaltsgleiches Duplikat.
    return detectedEcosystems === null || detectedEcosystems.length === 0
        ? 'unfiltered'
        : [...detectedEcosystems].sort().join(',');
}

function buildConditionsKey(activeConditionIds: readonly string[]): string {
    return [...activeConditionIds].sort().join(',');
}

// =============================================================================
// Envelope Resolution (Step-Eingang)
// =============================================================================

export interface PromptEnvelopeRequest {
    readonly variant: PromptVariant;
    readonly promptConfig: PromptConfig;
    readonly renderedLaw: RenderedLaw;
    readonly detectedEcosystems: readonly string[] | null;
    readonly model: string;
    readonly role: CascadeRole;
    readonly deadlineAtMs: number | null;
}

/**
 * Löst den kompletten Prompt-Envelope für einen Flash-Call auf: Layer 1 + 2
 * rendern, Cache-Plan bestimmen. Jeder Fehler im Cache-Pfad degradiert zu
 * 'inline' — nie zum Job-Fehler.
 */
export async function resolveFlashPromptEnvelope(
    envelopeRequest: PromptEnvelopeRequest,
): Promise<FlashPromptEnvelope> {
    const { promptConfig, renderedLaw } = envelopeRequest;
    const cachedPrefix = buildCachedPrefix(promptConfig, renderedLaw.lawBlock);
    const keyInputs: CacheKeyInputs = {
        model: envelopeRequest.model,
        lawContentHash: renderedLaw.lawContentHash,
        detectedEcosystems: envelopeRequest.detectedEcosystems,
        activeConditionIds: promptConfig.activeConditionIds,
    };

    return {
        cachedPrefix,
        protocolBlock: buildProtocolBlock(envelopeRequest.variant),
        keyInputs,
        role: envelopeRequest.role,
        deadlineAtMs: envelopeRequest.deadlineAtMs,
        plan: await resolveContextCache(cachedPrefix, keyInputs),
    };
}

/**
 * Inline-Envelope für global-only-Modelle (Pro-Rollback, A/B-Overrides):
 * die Explicit Caches sind location-gebunden, der Envelope läuft uncached.
 */
export function buildInlineEnvelope(envelopeRequest: PromptEnvelopeRequest): FlashPromptEnvelope {
    const { promptConfig, renderedLaw } = envelopeRequest;
    return {
        cachedPrefix: buildCachedPrefix(promptConfig, renderedLaw.lawBlock),
        protocolBlock: buildProtocolBlock(envelopeRequest.variant),
        plan: INLINE_PLAN,
        role: envelopeRequest.role,
        deadlineAtMs: envelopeRequest.deadlineAtMs,
        keyInputs: {
            model: envelopeRequest.model,
            lawContentHash: renderedLaw.lawContentHash,
            detectedEcosystems: null,
            activeConditionIds: promptConfig.activeConditionIds,
        },
    };
}

/**
 * Der eine Einstieg für ALLE Cascade-Steps (D3: Client und Cache folgen dem
 * Modell, nicht der Rolle): eu-Modelle laufen über den Explicit Cache —
 * Draft, Verifier UND eine Flash-Eskalation teilen sich pro Job denselben
 * Cache-Key, weil er nur Modell × Law × Ökosysteme × Conditions enthält;
 * global-only-Modelle (Pro) laufen inline.
 */
export function resolvePromptEnvelope(
    envelopeRequest: PromptEnvelopeRequest,
): Promise<FlashPromptEnvelope> {
    return isGlobalEndpointModel(envelopeRequest.model)
        ? Promise.resolve(buildInlineEnvelope(envelopeRequest))
        : resolveFlashPromptEnvelope(envelopeRequest);
}

// =============================================================================
// Cache Resolution (§6.1)
// =============================================================================

export async function resolveContextCache(
    cachedPrefix: string,
    keyInputs: CacheKeyInputs,
): Promise<PromptPlan> {
    if (isCacheDisabledByEnv()) return INLINE_PLAN;
    if (cachedPrefix.length < MIN_CACHEABLE_PREFIX_CHARS) {
        console.warn(
            `[ContextCache] Prefix nur ${cachedPrefix.length} Zeichen (< ${MIN_CACHEABLE_PREFIX_CHARS}) — ` +
            'unter dem Vertex-Minimum, Call läuft inline.',
        );
        return INLINE_PLAN;
    }

    const cacheKey = computeCacheKey(keyInputs);
    try {
        const registeredCache = await findValidRegisteredCache(cacheKey);
        if (registeredCache) {
            await extendCacheLifetimeIfNeeded(cacheKey, keyInputs.model, registeredCache);
            return {
                mode: 'cached',
                vertexCacheName: registeredCache.vertex_cache_name,
                cacheKey,
                cacheStatus: 'explicit_hit',
            };
        }
        return await createAndRegisterCache(cachedPrefix, keyInputs, cacheKey);
    } catch (cacheResolutionError: unknown) {
        console.error(
            `[ContextCache] Auflösung fehlgeschlagen (Key ${cacheKey.substring(0, 12)}…) — ` +
            'Call läuft inline weiter:',
            cacheResolutionError instanceof Error ? cacheResolutionError.message : cacheResolutionError,
        );
        return { mode: 'inline', cacheStatus: 'inline_fallback' };
    }
}

interface RegisteredCacheRow {
    readonly vertex_cache_name: string;
    readonly expires_at: string;
}

/** DB-Lookup mit Safety-Margin: ein fast abgelaufener Cache zählt als Miss. */
async function findValidRegisteredCache(cacheKey: string): Promise<RegisteredCacheRow | null> {
    const { data: cacheRow, error: lookupError } = await supabase
        .from('vertex_context_caches')
        .select('vertex_cache_name, expires_at')
        .eq('cache_key', cacheKey)
        .maybeSingle();

    if (lookupError) {
        throw new Error(`Registry-Lookup fehlgeschlagen: ${lookupError.message}`);
    }
    if (!cacheRow || typeof cacheRow.vertex_cache_name !== 'string') return null;

    const remainingLifetimeMs = new Date(cacheRow.expires_at).getTime() - Date.now();
    return remainingLifetimeMs > CONTEXT_CACHE_SAFETY_MARGIN_MS ? cacheRow : null;
}

/**
 * D9: TTL-Bump nur unter halber Restlaufzeit. last_used_at wird bei JEDEM
 * Hit aktualisiert (Receipt-Grundlage §10-B). Beides non-fatal: ein
 * fehlgeschlagener Bump kostet nur Lebenszeit, nie den Discount dieses
 * Calls — der Cache existiert ja noch.
 */
async function extendCacheLifetimeIfNeeded(
    cacheKey: string,
    cacheModel: string,
    registeredCache: RegisteredCacheRow,
): Promise<void> {
    const ttlSeconds = resolveTtlSeconds();
    const remainingLifetimeMs = new Date(registeredCache.expires_at).getTime() - Date.now();
    let needsTtlBump = remainingLifetimeMs < (ttlSeconds * 1000) / 2;

    if (needsTtlBump) {
        try {
            // Location-Bindung: der Bump muss auf demselben Client laufen,
            // auf dem der Cache lebt (D3 — Client folgt dem Modell).
            await resolveVertexClientForModel(cacheModel).caches.update({
                name: registeredCache.vertex_cache_name,
                config: { ttl: `${ttlSeconds}s` },
            });
        } catch (ttlBumpError: unknown) {
            // Recovery: expires_at NICHT verlängern — die Registry behält die
            // alte Wahrheit, der nächste Scan versucht den Bump erneut oder
            // läuft in die reguläre Miss-/Recreate-Logik.
            needsTtlBump = false;
            console.error(
                `[ContextCache] TTL-Bump fehlgeschlagen (Key ${cacheKey.substring(0, 12)}…) — ` +
                'Hit bleibt nutzbar, Restlaufzeit unverändert:',
                ttlBumpError instanceof Error ? ttlBumpError.message : ttlBumpError,
            );
        }
    }

    const { error: registryUpdateError } = await supabase
        .from('vertex_context_caches')
        .update({
            last_used_at: new Date().toISOString(),
            ...(needsTtlBump
                ? { expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString() }
                : {}),
        })
        .eq('cache_key', cacheKey);

    if (registryUpdateError) {
        console.error(
            `[ContextCache] Registry-Update nach Hit fehlgeschlagen (Key ${cacheKey.substring(0, 12)}…): ` +
            `${registryUpdateError.message} — Cache bleibt nutzbar, nur die Buchführung hinkt.`,
        );
    }
}

async function createAndRegisterCache(
    cachedPrefix: string,
    keyInputs: CacheKeyInputs,
    cacheKey: string,
): Promise<CachedPromptPlan> {
    const ttlSeconds = resolveTtlSeconds();
    // D3: der Cache entsteht auf dem Client des Modells (3.6 → eu-Multiregion,
    // 2.5-Legacy → europe-west3) — Explicit Caches sind location-gebunden.
    const createdCache = await resolveVertexClientForModel(keyInputs.model).caches.create({
        model: keyInputs.model,
        config: {
            systemInstruction: cachedPrefix,
            ttl: `${ttlSeconds}s`,
            displayName: `unslop-law-${cacheKey.substring(0, 16)}`,
        },
    });

    if (!createdCache.name) {
        throw new Error('caches.create lieferte keinen Ressourcen-Namen.');
    }

    const { error: registryUpsertError } = await supabase
        .from('vertex_context_caches')
        .upsert({
            cache_key: cacheKey,
            vertex_cache_name: createdCache.name,
            model: keyInputs.model,
            prompt_schema_version: PROMPT_CACHE_SCHEMA_VERSION,
            law_content_hash: keyInputs.lawContentHash,
            ecosystems_key: buildEcosystemsKey(keyInputs.detectedEcosystems),
            conditions_key: buildConditionsKey(keyInputs.activeConditionIds),
            cached_token_count: createdCache.usageMetadata?.totalTokenCount ?? null,
            expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
            last_used_at: new Date().toISOString(),
        }, { onConflict: 'cache_key' });

    if (registryUpsertError) {
        // Der Vertex-Cache existiert, nur die Registry weiß nichts von ihm:
        // dieser Call nutzt ihn trotzdem; ohne Registry-Zeile stirbt er per TTL.
        console.error(
            `[ContextCache] Registry-Upsert fehlgeschlagen (Key ${cacheKey.substring(0, 12)}…): ` +
            `${registryUpsertError.message} — Cache wird für diesen Job genutzt, aber nicht wiederverwendet.`,
        );
    }

    console.log(
        `[ContextCache] Cache angelegt: ${createdCache.name} ` +
        `(${createdCache.usageMetadata?.totalTokenCount ?? '?'} Tokens, TTL ${ttlSeconds}s).`,
    );
    return { mode: 'cached', vertexCacheName: createdCache.name, cacheKey, cacheStatus: 'explicit_created' };
}

// =============================================================================
// Call Executor (§6.2, D8)
// =============================================================================

/**
 * Führt einen Flash-generateContent-Call gemäß Envelope aus.
 * cached: contents = Protokoll + Tail, config.cachedContent, KEIN
 * systemInstruction (F1). inline: systemInstruction = Layer 1,
 * contents = Protokoll + Tail — byte-gleiche Texte, andere Verpackung.
 */
export async function runEnvelopeGenerateContent(
    envelope: FlashPromptEnvelope,
    dynamicTail: string,
): Promise<EnvelopeCallResult> {
    if (envelope.plan.mode === 'inline') {
        return {
            generateResponse: await runInlineCall(envelope, dynamicTail),
            effectiveCacheStatus: envelope.plan.cacheStatus,
        };
    }

    try {
        return {
            generateResponse: await runCachedCall(envelope, envelope.plan.vertexCacheName, dynamicTail),
            effectiveCacheStatus: envelope.plan.cacheStatus,
        };
    } catch (cachedCallFailure: unknown) {
        if (!isCacheShapedError(cachedCallFailure)) throw cachedCallFailure;
        return retryAfterCacheFailure(envelope, dynamicTail, cachedCallFailure);
    }
}

/**
 * D8: Registry-Zeile verwerfen, Cache EINMAL neu anlegen, cached retry;
 * schlägt auch das fehl → Inline-Fallback (nie ein Job-Fehler).
 */
async function retryAfterCacheFailure(
    envelope: FlashPromptEnvelope,
    dynamicTail: string,
    cachedCallFailure: unknown,
): Promise<EnvelopeCallResult> {
    const staleCacheKey = computeCacheKey(envelope.keyInputs);
    console.warn(
        `[ContextCache] Cache-Call fehlgeschlagen (Key ${staleCacheKey.substring(0, 12)}…) — ` +
        'recreate once, dann inline:',
        cachedCallFailure instanceof Error ? cachedCallFailure.message : cachedCallFailure,
    );

    try {
        await supabase.from('vertex_context_caches').delete().eq('cache_key', staleCacheKey);
        const recreatedPlan = await createAndRegisterCache(
            envelope.cachedPrefix, envelope.keyInputs, staleCacheKey,
        );
        return {
            generateResponse: await runCachedCall(envelope, recreatedPlan.vertexCacheName, dynamicTail),
            effectiveCacheStatus: 'explicit_created',
        };
    } catch (recreateFailure: unknown) {
        console.error(
            '[ContextCache] Recreate fehlgeschlagen — Call läuft inline (cache_fallback):',
            recreateFailure instanceof Error ? recreateFailure.message : recreateFailure,
        );
        return {
            generateResponse: await runInlineCall(envelope, dynamicTail),
            effectiveCacheStatus: 'inline_fallback',
        };
    }
}

function runCachedCall(
    envelope: FlashPromptEnvelope,
    vertexCacheName: string,
    dynamicTail: string,
): Promise<GenerateContentResponse> {
    // Caches existieren nur für Flash — der Model-Router liefert den Client
    // der Location, auf der der Cache angelegt wurde (D3: Client folgt Modell).
    return resolveVertexClientForModel(envelope.keyInputs.model).models.generateContent({
        model: envelope.keyInputs.model,
        contents: `${envelope.protocolBlock}\n\n${dynamicTail}`,
        config: {
            cachedContent: vertexCacheName,
            responseMimeType: 'application/json',
            temperature: CASCADE_TEMPERATURE,
            thinkingConfig: resolveThinkingConfig(envelope.role),
            abortSignal: resolveCallAbortSignal(envelope),
        },
    });
}

function runInlineCall(
    envelope: FlashPromptEnvelope,
    dynamicTail: string,
): Promise<GenerateContentResponse> {
    // Inline läuft auch für das Pro-Modell (Rollback-Pfad der Eskalation) —
    // der Router wählt dann den global-Client (VERTEX-001-Split bleibt gewahrt).
    return resolveVertexClientForModel(envelope.keyInputs.model).models.generateContent({
        model: envelope.keyInputs.model,
        contents: `${envelope.protocolBlock}\n\n${dynamicTail}`,
        config: {
            systemInstruction: envelope.cachedPrefix,
            responseMimeType: 'application/json',
            temperature: CASCADE_TEMPERATURE,
            thinkingConfig: resolveThinkingConfig(envelope.role),
            abortSignal: resolveCallAbortSignal(envelope),
        },
    });
}

/**
 * Cache-förmige Fehler: die API referenziert das CachedContent-Objekt
 * (404 abgelaufen/gelöscht, 403 fremde Ressource, 400 invalid). Alles andere
 * (Quota, 5xx, Netz) propagiert unverändert in die bestehende Step-Semantik.
 */
export function isCacheShapedError(callFailure: unknown): boolean {
    if (!(callFailure instanceof Error)) return false;
    const failureText = callFailure.message.toLowerCase();
    return failureText.includes('cachedcontent') || failureText.includes('cached content');
}
