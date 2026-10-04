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
 */
import { describe, expect, it } from 'vitest';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const credentialsPresent = Boolean(supabaseUrl && anonKey);

/** Postgres-Fehlercode fuer "insufficient_privilege". */
const INSUFFICIENT_PRIVILEGE = '42501';

/**
 * Tabellen, die fuer BEIDE Client-Rollen dicht sein muessen. `repositories`
 * fehlt bewusst: authenticated braucht dort SELECT fuers Realtime-Abo des
 * Dashboards (Migration 038) — der anon-Pfad wird separat geprueft.
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
    {
        name: 'match_code_chunks',
        arguments: { query_embedding: '[0.1,0.2]', match_threshold: 0.5, match_count: 1 },
    },
    // Migration 038 revoked BEIDE Ueberladungen — ohne den repo-scoped Eintrag
    // waere ein Grant-Regress auf ihr fuer diesen Guard unsichtbar.
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

/** Erzwingt: die Antwort ist eine Privilegien-Ablehnung, kein leeres Ergebnis. */
async function expectPrivilegeDenied(response: Response, relationName: string): Promise<void> {
    const errorBody = await readPostgrestError(response);

    expect(
        response.status,
        `${relationName}: HTTP ${response.status}. Status 200 bedeutet, dass das Grant fuer anon `
        + 'wieder existiert — dann schuetzt nur noch die Abwesenheit einer RLS-Policy. '
        + 'Grant entziehen (siehe Migration 038), nicht die Policy nachruesten.',
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

        it('verweigert anon auch repositories (authenticated behaelt SELECT fuer Realtime)', async () => {
            const restResponse = await fetch(
                `${supabaseUrl}/rest/v1/repositories?select=full_name&limit=1`,
                { headers: anonHeaders() },
            );

            await expectPrivilegeDenied(restResponse, 'repositories');
        });
    },
);
