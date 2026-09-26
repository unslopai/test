/**
 * Tests für POST /api/internal/prescan — Auth-Gate (fail-closed), Payload-
 * Validierung an der Systemgrenze [ARCH-002] und die Fehlerabbildung, auf die
 * sich das Fail-Safe Gate des pre-scanner-steps verlässt (5xx ⇒ degraded).
 * Die Engines selbst werden gemockt: das Package hat eigene Tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrescanResult } from '@unslop/prescan';

const { runPrescanMock } = vi.hoisted(() => ({ runPrescanMock: vi.fn() }));

vi.mock('@unslop/prescan', () => ({ runPrescan: runPrescanMock }));
vi.mock('@/lib/prescan/registry-cache', () => ({ supabaseRegistryCache: { label: 'registry-cache-stub' } }));

const { POST } = await import('@/app/api/internal/prescan/route');

const ROUTE_URL = 'http://localhost:3000/api/internal/prescan';
const INTERNAL_SECRET = 'test-internal-secret';

const VALID_BODY = {
    files: [{ path: 'src/a.ts', content: 'const a = 1;', patch: '@@ -0,0 +1 @@\n+const a = 1;' }],
    prescanConfig: { registryChecks: false, totalBudgetMs: 1000 },
    repoFullName: 'unslopai/test33',
    headSha: 'abc1234def',
};

const ENGINE_RESULT: PrescanResult = {
    findings: [],
    filesScanned: 1,
    filesSkipped: [],
    skippedChecks: [],
    rulesEvaluated: 42,
    rulesDisabled: [],
    durationMs: 12,
    engineVersions: { prescanCore: '0.1.0', treeSitter: 't', grammars: 'g', eslint: 'e' },
};

function buildRequest(body: unknown, secret: string | null = INTERNAL_SECRET): Request {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (secret !== null) headers['x-internal-secret'] = secret;
    return new Request(ROUTE_URL, {
        method: 'POST',
        headers,
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

describe('POST /api/internal/prescan — auth gate', () => {
    beforeEach(() => {
        runPrescanMock.mockReset();
        vi.stubEnv('WORKER_INTERNAL_SECRET', INTERNAL_SECRET);
    });
    afterEach(() => vi.unstubAllEnvs());

    it('returns 503 and never scans when WORKER_INTERNAL_SECRET is unset (fail-closed)', async () => {
        vi.stubEnv('WORKER_INTERNAL_SECRET', '');

        const response = await POST(buildRequest(VALID_BODY));

        expect(response.status).toBe(503);
        expect(runPrescanMock).not.toHaveBeenCalled();
    });

    it('returns 401 on a missing or wrong secret', async () => {
        expect((await POST(buildRequest(VALID_BODY, null))).status).toBe(401);
        expect((await POST(buildRequest(VALID_BODY, 'wrong'))).status).toBe(401);
        expect(runPrescanMock).not.toHaveBeenCalled();
    });
});

describe('POST /api/internal/prescan — payload + result contract', () => {
    beforeEach(() => {
        runPrescanMock.mockReset();
        vi.stubEnv('WORKER_INTERNAL_SECRET', INTERNAL_SECRET);
    });
    afterEach(() => vi.unstubAllEnvs());

    it('runs the engines with validated files and resolved config, returns the PrescanResult', async () => {
        runPrescanMock.mockResolvedValue(ENGINE_RESULT);

        const response = await POST(buildRequest(VALID_BODY));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(ENGINE_RESULT);
        const [engineInput, resolvedConfig, ports] = runPrescanMock.mock.calls[0];
        expect(engineInput).toEqual({ files: VALID_BODY.files });
        // resolvePrescanConfig: feldweiser Fallback — gesetzte Felder bleiben, Rest Default.
        expect(resolvedConfig).toMatchObject({ registryChecks: false, totalBudgetMs: 1000, maxFileBytes: 262144 });
        expect(ports).toMatchObject({ registryCache: { label: 'registry-cache-stub' } });
        expect(typeof ports.onFileScanned).toBe('function');
    });

    it('rejects malformed JSON and structurally invalid payloads with 400', async () => {
        expect((await POST(buildRequest('{not json'))).status).toBe(400);
        expect((await POST(buildRequest({ ...VALID_BODY, files: 'nope' }))).status).toBe(400);
        expect((await POST(buildRequest({ ...VALID_BODY, files: [{ path: 'a', content: 42, patch: '' }] }))).status).toBe(400);
        expect((await POST(buildRequest({ ...VALID_BODY, headSha: undefined }))).status).toBe(400);
        expect(runPrescanMock).not.toHaveBeenCalled();
    });

    it('maps an engine crash to 500 with the error message (the step degrades on it)', async () => {
        runPrescanMock.mockRejectedValue(new Error('WASM grammar failed to load'));

        const response = await POST(buildRequest(VALID_BODY));

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'WASM grammar failed to load' });
    });
});
