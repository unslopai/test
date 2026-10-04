/**
 * Regression-Tests für den Settings-PUT-Validator.
 *
 * Hintergrund: der Validator ist eine Allowlist. Jeder Step und jeder
 * Config-Block, der dort fehlt, wird bei JEDEM Speichern still verworfen —
 * der User sieht "gespeichert", verliert aber Konfiguration. Genau das ist
 * mit `pre-scanner` und dem `prescan`-Block passiert (gefunden 2026-07-20).
 *
 * Der Validator ist modul-privat; getestet wird er über die PUT-Route mit
 * gemockter Auth/DB — das ist die Grenze, die der Kunde tatsächlich trifft.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PIPELINE_CONFIG } from '@/lib/pipeline/defaults';
import { ALL_CONDITION_IDS } from '@/lib/pipeline/conditions';

// Die Route ist operator-gated (OPERATOR_SETTINGS_SPEC.md D4) — ohne diesen
// Eintrag würde jeder PUT hier als 404 enden, bevor der Validator läuft.
process.env.OPERATOR_USER_IDS = 'owner-under-test';

/** Was der Client an .update() übergibt — die persistierte Repo-Zeile. */
interface PersistedRepoUpdate {
    readonly pipeline_config: Record<string, unknown>;
}

const { updateMock, eqRepoMock, eqUserMock, getUserMock } = vi.hoisted(() => {
    // .update().eq().eq().select('id').single() — das .select().single() macht
    // den Row-Match sichtbar (kein stilles 200 mehr, D9).
    const eqUser = vi.fn(() => ({
        select: () => ({ single: () => Promise.resolve({ data: { id: 'repo-under-test' }, error: null }) }),
    }));
    const eqRepo = vi.fn(() => ({ eq: eqUser }));
    const update = vi.fn<(repoUpdate: PersistedRepoUpdate) => { eq: typeof eqRepo }>(() => ({ eq: eqRepo }));
    return {
        updateMock: update,
        eqRepoMock: eqRepo,
        eqUserMock: eqUser,
        getUserMock: vi.fn(() => Promise.resolve({ data: { user: { id: 'owner-under-test' } }, error: null })),
    };
});

vi.mock('@/lib/supabase/server', () => ({
    createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));
vi.mock('@/lib/supabase', () => ({
    supabase: { from: () => ({ update: updateMock, select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) }) },
}));

const { PUT } = await import('./route');

afterAll(() => {
    delete process.env.OPERATOR_USER_IDS;
});

/** Die Config, die tatsächlich in die DB geschrieben wurde. */
function persistedConfig(): Record<string, unknown> {
    const [firstUpdateCall] = updateMock.mock.calls;
    if (!firstUpdateCall) {
        throw new Error('Es wurde keine pipeline_config persistiert — der PUT hat die Zeile nie geschrieben.');
    }
    return firstUpdateCall[0].pipeline_config;
}

function buildPutRequest(configBody: Record<string, unknown>): Request {
    return new Request('http://localhost/api/repos/repo-under-test/settings', {
        method: 'PUT',
        body: JSON.stringify(configBody),
    });
}

const ROUTE_PARAMS = { params: Promise.resolve({ id: 'repo-under-test' }) };

describe('PUT /api/repos/[id]/settings — validator allowlist', () => {
    beforeEach(() => {
        updateMock.mockClear();
        eqRepoMock.mockClear();
        eqUserMock.mockClear();
    });

    it('keeps pre-scanner in enabledStepIds instead of silently stripping it', async () => {
        const response = await PUT(buildPutRequest({
            enabledStepIds: [...DEFAULT_PIPELINE_CONFIG.enabledStepIds],
            activeConditionIds: [...ALL_CONDITION_IDS],
            overrideSmartDetection: false,
        }), ROUTE_PARAMS);

        expect(response.status).toBe(200);
        expect(persistedConfig().enabledStepIds).toContain('pre-scanner');
    });

    it('preserves the prescan config block across a save', async () => {
        const prescanBlock = {
            ruleOverrides: { 'MAINT-003': false },
            shortCircuit: { mode: 'critical', minCriticalFindings: 3 },
            registryChecks: true,
        };

        await PUT(buildPutRequest({
            enabledStepIds: [...DEFAULT_PIPELINE_CONFIG.enabledStepIds],
            activeConditionIds: [...ALL_CONDITION_IDS],
            overrideSmartDetection: false,
            prescan: prescanBlock,
        }), ROUTE_PARAMS);

        expect(persistedConfig().prescan).toEqual(prescanBlock);
    });

    it('still rejects unknown step ids', async () => {
        await PUT(buildPutRequest({
            enabledStepIds: ['diff-loader', 'crypto-miner'],
            activeConditionIds: [],
            overrideSmartDetection: false,
        }), ROUTE_PARAMS);

        expect(persistedConfig().enabledStepIds).toEqual(['diff-loader']);
    });

    it('omits prescan entirely when the client sends none (no empty-object noise)', async () => {
        await PUT(buildPutRequest({
            enabledStepIds: ['diff-loader'],
            activeConditionIds: [],
            overrideSmartDetection: false,
        }), ROUTE_PARAMS);

        expect(persistedConfig()).not.toHaveProperty('prescan');
    });

    it('accepts minIntegrityScore on the 0-100 scale (Slop Score Gating, Upcoming §6)', async () => {
        await PUT(buildPutRequest({
            enabledStepIds: ['diff-loader'],
            activeConditionIds: [],
            overrideSmartDetection: false,
            cascade: { minIntegrityScore: 85 },
        }), ROUTE_PARAMS);

        expect(persistedConfig().cascade).toEqual({ minIntegrityScore: 85 });
    });

    it('drops a minIntegrityScore above the 100er-Skala instead of persisting a silent no-op', async () => {
        await PUT(buildPutRequest({
            enabledStepIds: ['diff-loader'],
            activeConditionIds: [],
            overrideSmartDetection: false,
            cascade: { minIntegrityScore: 150 },
        }), ROUTE_PARAMS);

        // 150 würde im Worker still auf den Default zurückfallen — der
        // Validator lässt es gar nicht erst in die DB.
        expect(persistedConfig()).not.toHaveProperty('cascade');
    });
});
