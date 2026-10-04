/**
 * Unit Tests: Abbau einer GitHub-App-Installation (GITHUB_APP_SPEC D8,
 * LEGAL_PAGES_SPEC §4a.2).
 *
 * Kern-Invarianten: beim Entfernen aus der GitHub App werden die Code-Skelette
 * deaktiviert (vorher blieben sie aktiv), und zwar BEVOR die Repos von der
 * Installation gelöst werden; ein schon im Dashboard getrenntes Repo behält
 * seinen Zeitstempel, damit die 30-Tage-Löschfrist nicht neu startet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findStep, hasStep } from '@/lib/testing/supabase-recorder';
import type { RecordedQuery } from '@/lib/testing/supabase-recorder';

const supabaseRecorder = await vi.hoisted(async () => {
    const { createSupabaseRecorder } = await import('@/lib/testing/supabase-recorder');
    return createSupabaseRecorder();
});

const fetchInstallationRepositoriesMock = vi.hoisted(() =>
    vi.fn<typeof import('@/lib/github').fetchInstallationRepositories>());

vi.mock('@/lib/supabase', () => ({ supabase: supabaseRecorder.client }));
vi.mock('@/lib/github', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/github')>(),
    fetchInstallationRepositories: fetchInstallationRepositoriesMock,
}));
vi.mock('@/lib/github-app', () => ({
    fetchInstallationAccount: vi.fn(),
    getInstallationToken: vi.fn(() => Promise.resolve('installation-token')),
    invalidateInstallationToken: vi.fn(),
}));
vi.mock('@/lib/installation-ownership', () => ({
    isReauthenticationNeeded: vi.fn(),
    proveInstallationOwnership: vi.fn(),
}));
vi.mock('@/lib/repo-auth', () => ({ resolveGithubToken: vi.fn() }));

const {
    handleInstallationEvent,
    handleInstallationReposEvent,
    syncInstallationRepositories,
} = await import('@/lib/app-installation');

const INSTALLATION_ID_UNDER_TEST = 4711;
const DETACHED_AT_UNDER_TEST = '2026-09-30T12:00:00.000Z';

function isOperation(recordedQuery: RecordedQuery, table: string, operation: string): boolean {
    return recordedQuery.table === table && findStep(recordedQuery, operation) !== undefined;
}

/** Die Repos der Installation; alle übrigen Abfragen gelingen ohne Daten. */
function respondWithAttachedRepositories(repositoryIds: readonly string[]): void {
    supabaseRecorder.respond = (recordedQuery) => (isOperation(recordedQuery, 'repositories', 'select')
        ? { data: repositoryIds.map((repositoryId) => ({ id: repositoryId })), error: null }
        : { data: [], error: null });
}

function operationOrder(): string[] {
    return supabaseRecorder.queries.map((recordedQuery) => {
        const operation = recordedQuery.steps[0]?.method ?? 'unknown';
        return `${recordedQuery.table}.${operation}`;
    });
}

describe('GitHub-App-Abbau deaktiviert die Code-Skelette', () => {
    beforeEach(() => {
        supabaseRecorder.reset();
        vi.useFakeTimers({ now: Date.parse(DETACHED_AT_UNDER_TEST) });
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('installation.deleted: Chunks deaktivieren, dann Repos lösen, dann Installation markieren', async () => {
        respondWithAttachedRepositories(['repo-a', 'repo-b']);

        await handleInstallationEvent({
            action: 'deleted',
            installationId: INSTALLATION_ID_UNDER_TEST,
            accountLogin: 'acme',
            accountType: 'Organization',
        });

        expect(operationOrder()).toEqual([
            'repositories.select',
            'code_chunks.update',
            'repositories.update',
            'repositories.update',
            'github_app_installations.update',
        ]);

        const [attachedLookup, chunkUpdate, deactivateUpdate, releaseUpdate] = supabaseRecorder.queries;
        expect(hasStep(attachedLookup, 'eq', ['installation_id', INSTALLATION_ID_UNDER_TEST])).toBe(true);
        expect(findStep(chunkUpdate, 'update')?.args).toEqual([{ deactivated_at: DETACHED_AT_UNDER_TEST }]);
        expect(hasStep(chunkUpdate, 'in', ['repository_id', ['repo-a', 'repo-b']])).toBe(true);
        expect(findStep(deactivateUpdate, 'update')?.args).toEqual([
            { status: 'deactivated', installation_id: null, updated_at: DETACHED_AT_UNDER_TEST },
        ]);
        // status ist nullable: eine NULL-Zeile muss ebenfalls deaktiviert werden.
        expect(hasStep(deactivateUpdate, 'or', ['status.is.null,status.neq.deactivated'])).toBe(true);
        // Schon getrennte Repos: nur die Referenz, kein neuer Zeitstempel.
        expect(findStep(releaseUpdate, 'update')?.args).toEqual([{ installation_id: null }]);
    });

    it('installation_repositories.removed: beschränkt Lookup und Updates auf die entfernten Repos', async () => {
        respondWithAttachedRepositories(['repo-a']);

        await handleInstallationReposEvent({
            action: 'removed',
            installationId: INSTALLATION_ID_UNDER_TEST,
            removedRepoIds: [9001],
        });

        const repositoryQueries = supabaseRecorder.queries
            .filter((recordedQuery) => recordedQuery.table === 'repositories');
        expect(repositoryQueries).toHaveLength(3);
        for (const repositoryQuery of repositoryQueries) {
            expect(hasStep(repositoryQuery, 'in', ['github_repo_id', [9001]])).toBe(true);
        }
        const chunkUpdate = supabaseRecorder.queries
            .find((recordedQuery) => recordedQuery.table === 'code_chunks');
        expect(chunkUpdate && hasStep(chunkUpdate, 'in', ['repository_id', ['repo-a']])).toBe(true);
    });

    it('ein Event ohne entfernte Repos fasst die Datenbank nicht an', async () => {
        await handleInstallationReposEvent({
            action: 'removed',
            installationId: INSTALLATION_ID_UNDER_TEST,
            removedRepoIds: [],
        });

        expect(supabaseRecorder.queries).toEqual([]);
    });

    it('scheitert die Chunk-Deaktivierung, bleiben die Repos an der Installation (Webhook-Retry findet sie wieder)', async () => {
        supabaseRecorder.respond = (recordedQuery) => {
            if (isOperation(recordedQuery, 'repositories', 'select')) return { data: [{ id: 'repo-a' }], error: null };
            if (recordedQuery.table === 'code_chunks') return { data: null, error: { message: 'statement timeout' } };
            return { data: [], error: null };
        };

        await expect(handleInstallationEvent({
            action: 'deleted',
            installationId: INSTALLATION_ID_UNDER_TEST,
            accountLogin: 'acme',
            accountType: 'Organization',
        })).rejects.toThrow('Code-Chunks konnten nicht deaktiviert werden: statement timeout');

        expect(operationOrder()).toEqual(['repositories.select', 'code_chunks.update']);
    });

    it.each([
        ['das Deaktivieren', 'status'],
        ['das Nullen der Referenz bei schon getrennten Repos', 'release'],
    ])('wirft, wenn %s scheitert', async (_stepLabel, failingStep) => {
        supabaseRecorder.respond = (recordedQuery) => {
            if (isOperation(recordedQuery, 'repositories', 'select')) return { data: [{ id: 'repo-a' }], error: null };
            const updatePayload = findStep(recordedQuery, 'update')?.args[0];
            const isStatusUpdate = JSON.stringify(updatePayload ?? {}).includes('"status"');
            const isFailingUpdate = recordedQuery.table === 'repositories'
                && updatePayload !== undefined
                && isStatusUpdate === (failingStep === 'status');
            return isFailingUpdate ? { data: null, error: { message: 'deadlock detected' } } : { data: [], error: null };
        };

        await expect(handleInstallationEvent({
            action: 'deleted',
            installationId: INSTALLATION_ID_UNDER_TEST,
            accountLogin: 'acme',
            accountType: 'Organization',
        })).rejects.toThrow('deadlock detected');

        // Die Installation wird erst nach den Repos als gelöscht markiert.
        expect(operationOrder()).not.toContain('github_app_installations.update');
    });

    it('ein Repo-Sync setzt updated_at nicht: die 30-Tage-Frist getrennter Repos startet nicht neu', async () => {
        fetchInstallationRepositoriesMock.mockResolvedValue([
            { id: 9001, full_name: 'acme/widgets', default_branch: 'main' },
        ]);
        supabaseRecorder.respond = (recordedQuery) => (isOperation(recordedQuery, 'repositories', 'select')
            ? {
                data: [{ id: 'repo-a', github_repo_id: 9001, full_name: 'acme/widgets', webhook_id: null, status: 'deactivated' }],
                error: null,
            }
            : { data: [], error: null });

        await syncInstallationRepositories(INSTALLATION_ID_UNDER_TEST, 'user-under-test');

        const adoptionUpdate = supabaseRecorder.queries
            .find((recordedQuery) => isOperation(recordedQuery, 'repositories', 'update'));
        expect(adoptionUpdate).toBeDefined();
        expect(adoptionUpdate && findStep(adoptionUpdate, 'update')?.args).toEqual([
            { installation_id: INSTALLATION_ID_UNDER_TEST },
        ]);
    });

    it('installation.suspend lässt Repos und Chunks unangetastet (D8)', async () => {
        await handleInstallationEvent({
            action: 'suspend',
            installationId: INSTALLATION_ID_UNDER_TEST,
            accountLogin: 'acme',
            accountType: 'Organization',
        });

        expect(operationOrder()).toEqual(['github_app_installations.update']);
    });
});
