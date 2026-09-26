/**
 * Companion-Loader-Tests (v4, SEC-019): welche Verzeichnisse durchsucht
 * werden und wie 404 („existiert nicht“) von Fehlern („unlesbar“) getrennt
 * bleibt — die Ehrlichkeits-Invariante des PrescanCompanionFile-Vertrags.
 */
import { describe, expect, it, vi } from 'vitest';
import { githubFetch } from '@/lib/github';
import { loadCompanionFiles, nextConfigDirectories } from '@/lib/prescan/companion-loader';
import type { CompanionGitHubPort } from '@/lib/prescan/companion-loader';

vi.mock('@/lib/github', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/github')>(),
    githubFetch: vi.fn(),
}));

const PARAMS = { githubToken: 'ghs_token', repoFullName: 'unslopai/test33', headSha: 'abc1234' };

function buildPort(overrides: Partial<CompanionGitHubPort> = {}): CompanionGitHubPort {
    return {
        listDirectory: vi.fn(async () => [{ name: 'next.config.ts', isFile: true }, { name: 'package.json', isFile: true }]),
        readFile: vi.fn(async () => 'export default { reactStrictMode: true };'),
        ...overrides,
    };
}

describe('nextConfigDirectories', () => {
    it('targets the middleware directory and, for src/, its parent — nothing for other files', () => {
        expect(nextConfigDirectories(['middleware.ts', 'src/lib/service.ts'])).toEqual(['']);
        expect(nextConfigDirectories(['src/proxy.ts'])).toEqual(['src', '']);
        expect(nextConfigDirectories(['apps/web/src/middleware.js'])).toEqual(['apps/web/src', 'apps/web']);
        expect(nextConfigDirectories(['src/lib/service.ts', 'README.md'])).toEqual([]);
    });
});

describe('loadCompanionFiles', () => {
    it('returns the next.config files it finds with their content', async () => {
        const port = buildPort();
        const companions = await loadCompanionFiles({ ...PARAMS, scannedPaths: ['apps/web/middleware.ts'] }, port);

        expect(companions).toEqual([{ path: 'apps/web/next.config.ts', content: 'export default { reactStrictMode: true };' }]);
        expect(port.listDirectory).toHaveBeenCalledWith('apps/web');
        expect(port.readFile).toHaveBeenCalledWith('apps/web/next.config.ts');
    });

    it('treats a 404 directory or an absent config as non-existent (no entry at all)', async () => {
        const noDirectory = buildPort({ listDirectory: vi.fn(async () => null) });
        expect(await loadCompanionFiles({ ...PARAMS, scannedPaths: ['middleware.ts'] }, noDirectory)).toEqual([]);

        const noConfig = buildPort({ listDirectory: vi.fn(async () => [{ name: 'package.json', isFile: true }]) });
        expect(await loadCompanionFiles({ ...PARAMS, scannedPaths: ['middleware.ts'] }, noConfig)).toEqual([]);
    });

    it('marks listing or read failures as unreadable (content null) instead of dropping them', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const listingFails = buildPort({ listDirectory: vi.fn(async () => { throw new Error('rate limited'); }) });
        expect(await loadCompanionFiles({ ...PARAMS, scannedPaths: ['middleware.ts'] }, listingFails))
            .toEqual([{ path: 'next.config.*', content: null }]);

        const readFails = buildPort({ readFile: vi.fn(async () => { throw new Error('timeout'); }) });
        expect(await loadCompanionFiles({ ...PARAMS, scannedPaths: ['middleware.ts'] }, readFails))
            .toEqual([{ path: 'next.config.ts', content: null }]);
        warnSpy.mockRestore();
    });

    it('marks a next.config that is not a regular file (symlink, submodule) as unreadable, without reading it', async () => {
        const port = buildPort({ listDirectory: vi.fn(async () => [{ name: 'next.config.mjs', isFile: false }]) });
        expect(await loadCompanionFiles({ ...PARAMS, scannedPaths: ['middleware.ts'] }, port))
            .toEqual([{ path: 'next.config.mjs', content: null }]);
        expect(port.readFile).not.toHaveBeenCalled();
    });

    it('does nothing without a GitHub token (CLI jobs) or without a Next middleware in the diff', async () => {
        const port = buildPort();
        expect(await loadCompanionFiles({ ...PARAMS, githubToken: '', scannedPaths: ['middleware.ts'] }, port)).toEqual([]);
        expect(await loadCompanionFiles({ ...PARAMS, scannedPaths: ['src/app/page.tsx'] }, port)).toEqual([]);
        expect(port.listDirectory).not.toHaveBeenCalled();
    });
});

describe('loadCompanionFiles — default GitHub port', () => {
    it('treats a truncated directory listing (1000-entry cap) as unknown and sends a timeout signal', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const truncatedListing = Array.from({ length: 1000 }, (_, entryIndex) => ({ name: `file-${entryIndex}.ts`, type: 'file' }));
        vi.mocked(githubFetch).mockResolvedValueOnce(truncatedListing);

        expect(await loadCompanionFiles({ ...PARAMS, scannedPaths: ['middleware.ts'] }))
            .toEqual([{ path: 'next.config.*', content: null }]);
        expect(vi.mocked(githubFetch).mock.calls[0][2]?.signal).toBeInstanceOf(AbortSignal);
        warnSpy.mockRestore();
    });
});
