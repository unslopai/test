/**
 * unslop_connect_repo-Tests (MCP_SPEC.md §3.5, Phase 2): Status-Poll bis
 * 'active', 409 already_connected als Erfolg, Admin-Refusal als typed error,
 * Ingestion-Fehler und Budget-Ablauf ehrlich gemeldet.
 */
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@unslop/shared/node';
import { runConnectRepoTool } from './connect-repo.js';
import type { ToolDeps } from '../tool-deps.js';

function buildDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
    return {
        api: {
            submitScan: vi.fn(),
            fetchScanStatus: vi.fn(),
            connectRepo: vi.fn().mockResolvedValue(undefined),
            fetchRepoStatus: vi.fn().mockResolvedValue('active'),
            submitPrReview: vi.fn(),
            resolveFinding: vi.fn(),
        },
        resolveRepoContext: vi.fn() as unknown as ToolDeps['resolveRepoContext'],
        resolveRepoIdentity: () => ({
            ok: true,
            gitRoot: 'C:/fixtures/widgets',
            repoFullName: 'acme/widgets',
            headSha: 'b'.repeat(40),
        }),
        buildDiff: vi.fn() as unknown as ToolDeps['buildDiff'],
        buildContextPackage: vi.fn().mockResolvedValue(null),
        baseUrl: 'https://unslop.codes',
        rerollLimit: 3,
        waitMs: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function parseResultBody(toolResultText: string): Record<string, unknown> {
    return JSON.parse(toolResultText) as Record<string, unknown>;
}

describe('unslop_connect_repo', () => {
    it('connects and reports active once the status poll lands', async () => {
        const fetchRepoStatusMock = vi.fn()
            .mockResolvedValueOnce('syncing')
            .mockResolvedValueOnce('active');
        const deps = buildDeps();
        const depsWithPoll = {
            ...deps,
            api: { ...deps.api, fetchRepoStatus: fetchRepoStatusMock },
        };

        const toolResult = await runConnectRepoTool(depsWithPoll, {});

        expect(toolResult.isError).toBeUndefined();
        const connectOutcome = parseResultBody(toolResult.content[0].text);
        expect(connectOutcome.repoFullName).toBe('acme/widgets');
        expect(connectOutcome.status).toBe('active');
        expect(depsWithPoll.api.connectRepo).toHaveBeenCalledWith('acme/widgets');
    });

    it('treats 409 already_connected as success and reports the current status', async () => {
        const deps = buildDeps();
        const depsAlreadyConnected = {
            ...deps,
            api: {
                ...deps.api,
                connectRepo: vi.fn().mockRejectedValue(new ApiError('already_connected', 409)),
            },
        };

        const toolResult = await runConnectRepoTool(depsAlreadyConnected, {});

        expect(toolResult.isError).toBeUndefined();
        expect(parseResultBody(toolResult.content[0].text).status).toBe('active');
    });

    it('surfaces a missing GitHub admin permission as github_admin_required', async () => {
        const deps = buildDeps();
        const depsWithoutAdmin = {
            ...deps,
            api: {
                ...deps.api,
                connectRepo: vi.fn().mockRejectedValue(new ApiError('admin_permission_required', 403)),
            },
        };

        const toolResult = await runConnectRepoTool(depsWithoutAdmin, {});

        expect(toolResult.isError).toBe(true);
        const errorBody = parseResultBody(toolResult.content[0].text) as { error?: { code: string } };
        expect(errorBody.error?.code).toBe('github_admin_required');
    });

    it('reports a failed ingestion as a retryable error, not as success', async () => {
        const deps = buildDeps();
        const depsWithFailedIngestion = {
            ...deps,
            api: { ...deps.api, fetchRepoStatus: vi.fn().mockResolvedValue('error') },
        };

        const toolResult = await runConnectRepoTool(depsWithFailedIngestion, {});

        expect(toolResult.isError).toBe(true);
        const errorBody = parseResultBody(toolResult.content[0].text) as { error?: { code: string; retryable: boolean } };
        expect(errorBody.error?.code).toBe('upstream_unavailable');
        expect(errorBody.error?.retryable).toBe(true);
    });

    it('returns the last status with a re-check hint when the 180s budget elapses', async () => {
        const deps = buildDeps();
        const depsStillSyncing = {
            ...deps,
            api: { ...deps.api, fetchRepoStatus: vi.fn().mockResolvedValue('syncing') },
        };

        const toolResult = await runConnectRepoTool(depsStillSyncing, {});

        expect(toolResult.isError).toBeUndefined();
        const connectOutcome = parseResultBody(toolResult.content[0].text);
        expect(connectOutcome.status).toBe('syncing');
        expect(connectOutcome.nextStep).toContain('again');
    });

    it('maps an identity failure onto the typed error contract', async () => {
        const deps = buildDeps({
            resolveRepoIdentity: () => ({ ok: false, failureKind: 'no_origin_remote', detail: 'no origin' }),
        });

        const toolResult = await runConnectRepoTool(deps, {});

        const errorBody = parseResultBody(toolResult.content[0].text) as { error?: { code: string } };
        expect(errorBody.error?.code).toBe('no_origin_remote');
    });
});
