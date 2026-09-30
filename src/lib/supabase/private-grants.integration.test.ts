/**
 * Guard gegen die Rueckkehr von SECURITY_AUDIT_REPORT.md Finding 3.
 *
 * Der anon-Key ist oeffentlich (NEXT_PUBLIC_ im Browser-Bundle). Vor Migration
 * 038 war der einzige Schutz der IP-Tabellen die ABWESENHEIT einer RLS-Policy —
 * das table-level SELECT-Grant bestand weiter. Genau EINE permissive Policy
 * haette den Golden-Standards-Korpus weltlesbar gemacht.
 *
 * Der entscheidende Unterschied, den dieser Test misst:
 *   HTTP 200 []            = Grant vorhanden, nur keine Policy  -> ZERBRECHLICH
 *   HTTP 401/403 (42501)   = Grant entzogen                     -> KORREKT
 * Ein leeres Array ist deshalb ein FEHLSCHLAG, kein Erfolg.
 *
 * Dies ist der einzige Test, der das echte Remote-Projekt anspricht (INFRA-001:
 * es gibt keinen lokalen Stack). Ohne Credentials im Env ueberspringt er sich
 * selbst, damit `npm test` hermetisch bleibt; in CI werden sie injiziert.
 *
 * Seit Migration 050 (SERVER_AUDIT_2026-09.md L9) prueft ein zweiter Block die
 * SPALTENRECHTE von `authenticated` auf repositories: nur id, github_repo_id,
 * status und updated_at sind lesbar, webhook_secret und pipeline_config
 * antworten 42501. Er braucht zusaetzlich SUPABASE_JWT_SECRET (Legacy-JWT-
 * Secret, Dashboard -> Settings -> API), um sich einen Session-JWT zu praegen:
 * der Login ist reines GitHub-OAuth, einen Passwort-Nutzer gibt es nicht.
 */
import { createHmac, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const credentialsPresent = Boolean(supabaseUrl && anonKey);

/** Postgres-Fehlercode fuer "insufficient_privilege". */
const INSUFFICIENT_PRIVILEGE = '42501';

/**
 * Tabellen, die fuer BEIDE Client-Rollen dicht sein muessen. `repositories`
 * fehlt bewusst: authenticated behaelt dort ein SELECT auf vier Spalten fuers
 * Realtime-Abo des Dashboards (Migration 038, seit 050 spaltenweise) — der
 * anon-Pfad und die Spaltenrechte werden separat geprueft.
 */
const PRIVATE_TABLES: readonly string[] = [
    'golden_standards',
    'reference_practices',
    'code_chunks',
    'prescan_registry_cache',
    'review_jobs',
    'review_job_llm_calls',
    'vertex_context_caches',
    'api_keys',
    'github_tokens',
    'github_app_installations',
    'billing_accounts',
    'billing_account_members',
    'finding_comments',
    'finding_suppressions',
];

/**
 * RPCs, die ausschliesslich der Service-Role-Client aufrufen darf.
 *
 * Die Argumente muessen NAMENTLICH stimmen, auch wenn die Werte Unsinn sind:
 * PostgREST loest die Ueberladung ueber die Parameternamen auf und antwortet
 * sonst mit PGRST202 ("function not found in schema cache") — das waere ein
 * Fehlschlag aus dem falschen Grund und wuerde einen echten Grant-Regress
 * verdecken. Die Privilegienpruefung greift vor der Funktionsausfuehrung,
 * die Werte werden daher nie ausgewertet.
 */
const PRIVATE_RPCS: readonly { readonly name: string; readonly arguments: Record<string, unknown> }[] = [
    {
        name: 'match_golden_standards',
        arguments: { query_embedding: '[0.1,0.2]', match_threshold: 0.5, match_count: 1 },
    },
    {
        name: 'match_reference_practices',
        arguments: { query_embedding: '[0.1,0.2]', target_ecosystem: 'react', match_threshold: 0.5, match_count: 1 },
    },
    // Seit Migration 051 gibt es nur noch den repo-gefilterten Overload; die
    // mandantenblinde 3-Parameter-Variante ist gedroppt und antwortet PGRST202
    // statt 42501 — deshalb hier nicht mehr gelistet.
    {
        name: 'match_code_chunks',
        arguments: {
            query_embedding: '[0.1,0.2]',
            target_repository_id: '00000000-0000-0000-0000-000000000000',
            match_threshold: 0.5,
            match_count: 1,
        },
    },
    {
        name: 'consume_scan_quota',
        arguments: {
            target_user_id: '00000000-0000-0000-0000-000000000000',
            hourly_max: 1,
            monthly_max: 1,
            trial_max: 1,
        },
    },
    {
        name: 'consume_pro_escalation_quota',
        arguments: { target_user_id: '00000000-0000-0000-0000-000000000000', monthly_max: 1, trial_max: 1 },
    },
];

interface PostgrestErrorBody {
    readonly code?: string;
    readonly message?: string;
}

/** Strukturelle Sicht auf den Response-Body [ARCH-002] — nie blind casten. */
async function readPostgrestError(response: Response): Promise<PostgrestErrorBody> {
    const rawBody: unknown = await response.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') return {};

    const bodyFields = rawBody as Record<string, unknown>;
    return {
        ...(typeof bodyFields.code === 'string' ? { code: bodyFields.code } : {}),
        ...(typeof bodyFields.message === 'string' ? { message: bodyFields.message } : {}),
    };
}

function anonHeaders(): Record<string, string> {
    return {
        apikey: anonKey!,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
    };
}

type ClientRole = 'anon' | 'authenticated';

/** Erzwingt: die Antwort ist eine Privilegien-Ablehnung, kein leeres Ergebnis. */
async function expectPrivilegeDenied(
    response: Response,
    relationName: string,
    clientRole: ClientRole = 'anon',
): Promise<void> {
    const errorBody = await readPostgrestError(response);

    expect(
        response.status,
        `${relationName}: HTTP ${response.status}. Status 200 bedeutet, dass das Grant fuer ${clientRole} `
        + 'wieder existiert — dann schuetzt nur noch die Abwesenheit einer RLS-Policy. '
        + 'Grant entziehen (siehe Migrationen 038/050), nicht die Policy nachruesten.',
    ).not.toBe(200);

    expect(
        errorBody.code,
        `${relationName}: erwartet wurde Fehlercode ${INSUFFICIENT_PRIVILEGE}, empfangen: `
        + `${errorBody.code ?? 'kein Code'} (${errorBody.message ?? 'keine Message'}).`,
    ).toBe(INSUFFICIENT_PRIVILEGE);
}

describe.skipIf(!credentialsPresent)(
    'Supabase private grants — anon darf die IP-Tabellen nicht einmal anfassen (Audit Finding 3)',
    () => {
        it.each(PRIVATE_TABLES)('verweigert anon jedes SELECT auf %s', async (tableName) => {
            const restResponse = await fetch(
                `${supabaseUrl}/rest/v1/${tableName}?select=*&limit=1`,
                { headers: anonHeaders() },
            );

            await expectPrivilegeDenied(restResponse, tableName);
        });

        it.each(PRIVATE_RPCS)('verweigert anon den Aufruf von $name', async (privateRpc) => {
            const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/${privateRpc.name}`, {
                method: 'POST',
                headers: anonHeaders(),
                body: JSON.stringify(privateRpc.arguments),
            });

            await expectPrivilegeDenied(rpcResponse, `rpc/${privateRpc.name}`);
        });

        it('verweigert anon auch repositories (authenticated behaelt vier Spalten fuer Realtime, Migration 050)', async () => {
            const restResponse = await fetch(
                `${supabaseUrl}/rest/v1/repositories?select=full_name&limit=1`,
                { headers: anonHeaders() },
            );

            await expectPrivilegeDenied(restResponse, 'repositories');
        });
    },
);

// =============================================================================
// Spaltenrechte von authenticated auf repositories (Audit L9, Migration 050)
// =============================================================================

const jwtSecret = process.env.SUPABASE_JWT_SECRET;
const authenticatedGuardPossible = credentialsPresent && Boolean(jwtSecret);

/** Die vier Spalten aus Migration 050 — das Realtime-Abo liest id, github_repo_id, status. */
const REPOSITORY_COLUMNS_GRANTED = 'id,github_repo_id,status,updated_at';
/** Die beiden Spalten, deren Sichtbarkeit L9 ausgemacht hat, plus die Wildcard. */
const REPOSITORY_SELECTS_DENIED: readonly string[] = ['webhook_secret', 'pipeline_config', '*'];
const SESSION_JWT_LIFETIME_SECONDS = 300;

/**
 * Session-JWT, wie GoTrue ihn ausstellt, nur ohne Login: HS256 mit dem Legacy-
 * JWT-Secret des Projekts. `sub` ist ein zufaelliger Nutzer ohne eigene Zeilen:
 * gemessen werden Spaltenrechte (42501 vs. 200), nicht die Policy — fuer die
 * erlaubten Spalten ist `200 []` das erwartete Ergebnis.
 */
function mintAuthenticatedSessionJwt(signingSecret: string): string {
    const issuedAtSeconds = Math.floor(Date.now() / 1000);
    const encodedHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const encodedClaims = Buffer.from(JSON.stringify({
        aud: 'authenticated',
        role: 'authenticated',
        sub: randomUUID(),
        iat: issuedAtSeconds,
        exp: issuedAtSeconds + SESSION_JWT_LIFETIME_SECONDS,
    })).toString('base64url');
    const hmacSignature = createHmac('sha256', signingSecret)
        .update(`${encodedHeader}.${encodedClaims}`)
        .digest('base64url');
    return `${encodedHeader}.${encodedClaims}.${hmacSignature}`;
}

function authenticatedHeaders(sessionJwt: string): Record<string, string> {
    return { ...anonHeaders(), Authorization: `Bearer ${sessionJwt}` };
}

describe.skipIf(!authenticatedGuardPossible)(
    'Supabase repositories — authenticated liest nur die vier Realtime-Spalten (Audit L9, Migration 050)',
    () => {
        let sessionJwt = '';
        beforeAll(() => {
            sessionJwt = mintAuthenticatedSessionJwt(jwtSecret!);
        });

        it.each(REPOSITORY_SELECTS_DENIED)('verweigert authenticated select=%s', async (selectClause) => {
            const restResponse = await fetch(
                `${supabaseUrl}/rest/v1/repositories?select=${selectClause}&limit=1`,
                { headers: authenticatedHeaders(sessionJwt) },
            );

            await expectPrivilegeDenied(restResponse, `repositories?select=${selectClause}`, 'authenticated');
        });

        it('erlaubt authenticated die vier gewaehrten Spalten (200, RLS-gefiltert)', async () => {
            const restResponse = await fetch(
                `${supabaseUrl}/rest/v1/repositories?select=${REPOSITORY_COLUMNS_GRANTED}&limit=1`,
                { headers: authenticatedHeaders(sessionJwt) },
            );
            const responseBody: unknown = await restResponse.json();

            expect(
                restResponse.status,
                `repositories?select=${REPOSITORY_COLUMNS_GRANTED}: HTTP ${restResponse.status} — ein 42501 hier `
                + 'heisst, das Spalten-Grant aus Migration 050 fehlt und das Dashboard-Realtime-Abo bekommt "Error 401".',
            ).toBe(200);
            expect(Array.isArray(responseBody), 'PostgREST antwortet mit einer (ggf. leeren) Zeilenliste').toBe(true);
        });
    },
);
