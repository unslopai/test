/**
 * API-Key Machine-Auth für CLI/IDE/CI (SPEC.md §3.3).
 *
 * Key-Format: usk_<43 Zeichen base64url> (32 Zufallsbytes).
 * Gespeichert wird ausschließlich der SHA-256-Hex-Hash; der Klartext-Key
 * ist nur im Create-Response sichtbar. Rate-Limiting läuft atomar in
 * Postgres (consume_api_key_rate_limit, Fixed Window pro Key).
 */
import { createHash, randomBytes } from 'crypto';
import { supabase } from '@/lib/supabase';

const API_KEY_PREFIX = 'usk_';
const API_KEY_RANDOM_BYTES = 32;
/** Zeichen des Klartext-Keys, die im Dashboard zur Wiedererkennung angezeigt werden. */
const KEY_PREFIX_DISPLAY_LENGTH = 12;

const RATE_LIMIT_WINDOW_SECONDS = 3600;
const DEFAULT_SCANS_PER_WINDOW = 30;

// =============================================================================
// Key-Erzeugung
// =============================================================================

export interface GeneratedApiKey {
    /** Klartext — wird dem User genau einmal angezeigt. */
    readonly plaintextKey: string;
    readonly keyHash: string;
    readonly keyPrefix: string;
}

export function generateApiKey(): GeneratedApiKey {
    const plaintextKey = API_KEY_PREFIX + randomBytes(API_KEY_RANDOM_BYTES).toString('base64url');
    return {
        plaintextKey,
        keyHash: hashApiKey(plaintextKey),
        keyPrefix: plaintextKey.substring(0, KEY_PREFIX_DISPLAY_LENGTH),
    };
}

export function hashApiKey(plaintextKey: string): string {
    return createHash('sha256').update(plaintextKey, 'utf-8').digest('hex');
}

// =============================================================================
// Request-Auth
// =============================================================================

export interface ResolvedApiKey {
    readonly keyId: string;
    readonly userId: string;
}

/**
 * Liest den x-api-key Header und löst ihn auf einen User auf.
 * Gibt null zurück bei fehlendem, unbekanntem oder widerrufenem Key.
 */
export async function resolveApiKey(request: Request): Promise<ResolvedApiKey | null> {
    const presentedKey = request.headers.get('x-api-key');
    if (!presentedKey || !presentedKey.startsWith(API_KEY_PREFIX)) {
        return null;
    }

    const { data: keyRow, error: lookupError } = await supabase
        .from('api_keys')
        .select('id, user_id, revoked_at')
        .eq('key_hash', hashApiKey(presentedKey))
        .single();

    if (lookupError || !keyRow || keyRow.revoked_at) {
        return null;
    }

    // Fire-and-forget: last_used_at ist Anzeige-Metadatum, kein Auth-Kriterium.
    void supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyRow.id)
        .then(({ error: touchError }) => {
            if (touchError) console.warn('[ApiKeys] last_used_at Update fehlgeschlagen:', touchError.message);
        });

    return { keyId: keyRow.id, userId: keyRow.user_id };
}

// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * Verbraucht einen Request aus dem Fixed-Window-Kontingent des Keys.
 * true = Request erlaubt, false = Limit erschöpft (429 senden).
 */
export async function consumeRateLimit(keyId: string): Promise<boolean> {
    const scansPerWindow = parseScansPerWindow(process.env.CLI_SCAN_RATE_LIMIT);

    const { data: requestAllowed, error: rateLimitError } = await supabase.rpc(
        'consume_api_key_rate_limit',
        {
            target_key_id: keyId,
            window_seconds: RATE_LIMIT_WINDOW_SECONDS,
            max_requests: scansPerWindow,
        },
    );

    if (rateLimitError) {
        // Fail-closed: ohne funktionierendes Limit keine anonym skalierbaren LLM-Kosten.
        console.error('[ApiKeys] Rate-Limit-RPC fehlgeschlagen:', rateLimitError.message);
        return false;
    }

    return requestAllowed === true;
}

export function rateLimitRetryAfterSeconds(): number {
    return RATE_LIMIT_WINDOW_SECONDS;
}

function parseScansPerWindow(rawValue: string | undefined): number {
    const parsedValue = Number.parseInt(rawValue ?? '', 10);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_SCANS_PER_WINDOW;
}

// =============================================================================
// Interner Service-Auth (Worker/Health-Endpoints)
// =============================================================================

/**
 * Prüft den x-internal-secret Header gegen WORKER_INTERNAL_SECRET.
 * Fail-closed: ohne konfiguriertes Secret ist der Zugriff immer verweigert.
 */
export function hasValidInternalSecret(request: Request): boolean {
    const configuredSecret = process.env.WORKER_INTERNAL_SECRET;
    if (!configuredSecret) {
        console.error('[ApiKeys] WORKER_INTERNAL_SECRET ist nicht konfiguriert — Zugriff verweigert.');
        return false;
    }
    return request.headers.get('x-internal-secret') === configuredSecret;
}
