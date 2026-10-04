/**
 * Liest oder setzt die projektweite Vertex-CacheConfig (Implicit Caching).
 *
 * Hintergrund: Google aktiviert am 2026-10-15 "Durable Caching" für implicit
 * caching auf Gemini 3.x. Implizit gecachte Requests, also auch die Diffs mit
 * Kundencode, lägen dann bis zu 24 h verschlüsselt auf Datenträgern statt nur
 * im Arbeitsspeicher. Datenschutzerklärung und AVV versprechen "im
 * Arbeitsspeicher" (LEGAL_PAGES_SPEC E9). Deshalb der Opt-out auf EPHEMERAL.
 *
 * Bewusst NICHT disableCache: true. Das schaltet laut Doku GenAI caching
 * insgesamt ab und könnte den expliziten Cache (Regel-Prefix, ~50 % der
 * Input-Kosten) mitnehmen.
 *
 * Stand 2026-09-29: das Feld retentionConfig lehnen v1 und v1beta1 noch mit
 * 400 "Unknown name" ab, obwohl Googles Mail es nennt. --set-ephemeral
 * wiederholen, bis es greift.
 *
 *   npx tsx scripts/vertex-cache-config.ts --read
 *   npx tsx scripts/vertex-cache-config.ts --set-ephemeral
 */
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

dotenv.config({ path: '.env.local' });

const API_VERSIONS = ['v1', 'v1beta1'] as const;
const CONFIG_HOST = 'europe-west3-aiplatform.googleapis.com';

interface VertexProjectContext {
    readonly projectId: string;
    readonly authClient: Awaited<ReturnType<GoogleAuth['getClient']>>;
}

async function createProjectContext(): Promise<VertexProjectContext> {
    const projectId = process.env.GOOGLE_PROJECT_ID;
    const encodedServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
    if (!projectId || !encodedServiceAccount) {
        throw new Error('GOOGLE_PROJECT_ID oder GOOGLE_SERVICE_ACCOUNT_BASE64 fehlt in .env.local');
    }
    const credentials = JSON.parse(Buffer.from(encodedServiceAccount, 'base64').toString('utf8'));
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    return { projectId, authClient: await auth.getClient() };
}

function cacheConfigUrl(context: VertexProjectContext, apiVersion: string): string {
    return `https://${CONFIG_HOST}/${apiVersion}/projects/${context.projectId}/cacheConfig`;
}

async function readCacheConfig(context: VertexProjectContext): Promise<void> {
    const readResponse = await context.authClient.request({ url: cacheConfigUrl(context, 'v1beta1'), method: 'GET' });
    console.log(JSON.stringify(readResponse.data));
}

async function setEphemeralRetention(context: VertexProjectContext): Promise<boolean> {
    const ephemeralConfig = {
        name: `projects/${context.projectId}/cacheConfig`,
        disableCache: false,
        retentionConfig: { retentionType: 'EPHEMERAL' },
    };
    for (const apiVersion of API_VERSIONS) {
        try {
            const patchResponse = await context.authClient.request({
                url: cacheConfigUrl(context, apiVersion),
                method: 'PATCH',
                data: ephemeralConfig,
            });
            console.log(`${apiVersion} PATCH ${patchResponse.status}`, JSON.stringify(patchResponse.data));
            return true;
        } catch (patchError) {
            const errorResponse = (patchError as { response?: { status?: number; data?: { error?: { message?: string } } } }).response;
            console.log(`${apiVersion} PATCH ${errorResponse?.status}: ${errorResponse?.data?.error?.message ?? String(patchError)}`);
        }
    }
    return false;
}

async function main(): Promise<void> {
    const mode = process.argv[2];
    if (mode !== '--read' && mode !== '--set-ephemeral') {
        console.error('Aufruf: npx tsx scripts/vertex-cache-config.ts --read | --set-ephemeral');
        process.exit(2);
    }
    const context = await createProjectContext();
    if (mode === '--set-ephemeral') {
        const applied = await setEphemeralRetention(context);
        if (!applied) process.exitCode = 1;
    }
    await readCacheConfig(context);
}

main().catch((scriptError) => {
    console.error(scriptError);
    process.exit(1);
});
