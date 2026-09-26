/**
 * Registry-Engine-Tests — SEC-035/036 mit injiziertem fetch + Cache-Port.
 * Ehrlichkeits-Invariante: Netzwerkfehler ≠ 404 (blocked, nie Finding/Pass).
 */
import { describe, expect, it, vi } from 'vitest';
import { runRegistryEngine } from './registry-engine';
import type { RegistryEngineFile } from './registry-engine';
import type { RegistryCachePort } from '../types';

function buildFile(overrides: Partial<RegistryEngineFile> & { addedLineTexts: ReadonlyMap<number, string> }): RegistryEngineFile {
    return {
        path: 'src/service.ts',
        language: 'typescript',
        ...overrides,
    };
}

function jsFileWithImport(importLine: string): RegistryEngineFile {
    return buildFile({ addedLineTexts: new Map([[3, importLine]]) });
}

function buildFetchReturning(status: number) {
    return vi.fn(async () => ({ status, ok: status >= 200 && status < 300 })) as unknown as typeof fetch;
}

describe('runRegistryEngine — lookup transport (live OOM 2026-08-23)', () => {
    it('probes with HEAD and never fetches a packument body on a plain 200/404', async () => {
        const headFetch = buildFetchReturning(200);
        await runRegistryEngine([jsFileWithImport("import { z } from 'zod';")], { fetchImpl: headFetch });

        const fetchMock = vi.mocked(headFetch);
        expect(fetchMock).toHaveBeenCalled();
        for (const [, init] of fetchMock.mock.calls) {
            expect(init?.method).toBe('HEAD');
        }
    });

    it('falls back to GET on 405 and cancels the body immediately', async () => {
        const cancelMock = vi.fn(async () => undefined);
        const fallbackFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => (
            init?.method === 'HEAD'
                ? { status: 405, ok: false, body: null }
                : { status: 404, ok: false, body: { cancel: cancelMock } }
        )) as unknown as typeof fetch;

        const registryResult = await runRegistryEngine(
            [jsFileWithImport("import { helper } from 'definitely-not-a-real-pkg-xyz';")],
            { fetchImpl: fallbackFetch },
        );

        expect(cancelMock).toHaveBeenCalled();
        expect(registryResult.findings.map((finding) => finding.ruleId)).toContain('SEC-035');
    });
});

describe('runRegistryEngine — SEC-035', () => {
    it('flags a 404 npm import as CRITICAL with the lookup URL as evidence', async () => {
        const registryResult = await runRegistryEngine(
            [jsFileWithImport("import { helper } from 'left-padz-ultra';")],
            { fetchImpl: buildFetchReturning(404) },
        );

        expect(registryResult.findings).toHaveLength(1);
        expect(registryResult.findings[0].ruleId).toBe('SEC-035');
        expect(registryResult.findings[0].severity).toBe('CRITICAL');
        expect(registryResult.findings[0].explanation).toContain('registry.npmjs.org/left-padz-ultra');
    });

    it('reports nothing for existing packages (200)', async () => {
        const registryResult = await runRegistryEngine(
            [jsFileWithImport("import { z } from 'zod';")],
            { fetchImpl: buildFetchReturning(200) },
        );
        expect(registryResult.findings).toHaveLength(0);
        expect(registryResult.skippedChecks).toHaveLength(0);
    });

    it('records network failures as skippedChecks — never as finding or pass', async () => {
        const failingFetch = vi.fn(async () => { throw new Error('ETIMEDOUT'); }) as unknown as typeof fetch;
        const registryResult = await runRegistryEngine(
            [jsFileWithImport("import { helper } from 'some-real-package';")],
            { fetchImpl: failingFetch },
        );

        expect(registryResult.findings).toHaveLength(0);
        expect(registryResult.skippedChecks).toHaveLength(1);
        expect(registryResult.skippedChecks[0].ruleId).toBe('SEC-035');
        expect(registryResult.skippedChecks[0].reason).toContain('registry-timeout');
    });

    it('skips node builtins, relative paths, alias imports and scoped imports', async () => {
        const unreachableFetch = vi.fn(async () => { throw new Error('must not be called'); }) as unknown as typeof fetch;
        const registryResult = await runRegistryEngine(
            [buildFile({
                addedLineTexts: new Map([
                    [1, "import fs from 'fs';"],
                    [2, "import { helper } from './local-helper';"],
                    [3, "import { law } from '@/lib/law';"],
                    [4, "import { shared } from '@unslop/shared';"],
                    [5, "const aliasImport = `import { applySecurityHeaders } from '${specifier}';`;"],
                ]),
            })],
            { fetchImpl: unreachableFetch },
        );
        expect(unreachableFetch).not.toHaveBeenCalled();
        expect(registryResult.findings).toHaveLength(0);
    });

    it('skips Python stdlib and first-party modules (path heuristic)', async () => {
        const unreachableFetch = vi.fn(async () => { throw new Error('must not be called'); }) as unknown as typeof fetch;
        const registryResult = await runRegistryEngine(
            [buildFile({
                path: 'src/billing/invoices.py',
                language: 'python',
                addedLineTexts: new Map([
                    [1, 'import os'],
                    [2, 'from billing import tax_rates'],
                ]),
            })],
            { fetchImpl: unreachableFetch },
        );
        expect(unreachableFetch).not.toHaveBeenCalled();
        expect(registryResult.findings).toHaveLength(0);
    });

    it('checks scoped packages when they are declared in package.json', async () => {
        const notFoundFetch = buildFetchReturning(404);
        const registryResult = await runRegistryEngine(
            [buildFile({
                path: 'package.json',
                language: 'json',
                addedLineTexts: new Map([[12, '    "@hallucinated/sdk": "^1.0.0",']]),
            })],
            { fetchImpl: notFoundFetch },
        );
        expect(registryResult.findings).toHaveLength(1);
        expect(registryResult.findings[0].ruleId).toBe('SEC-035');
    });

    it('serves fresh 404s from the cache without fetching', async () => {
        const unreachableFetch = vi.fn(async () => { throw new Error('must not be called'); }) as unknown as typeof fetch;
        const cachePort: RegistryCachePort = {
            read: vi.fn(async () => ({ packageExists: false, checkedAt: new Date().toISOString() })),
            write: vi.fn(async () => undefined),
        };

        const registryResult = await runRegistryEngine(
            [jsFileWithImport("import { helper } from 'left-padz-ultra';")],
            { fetchImpl: unreachableFetch, registryCache: cachePort },
        );

        expect(unreachableFetch).not.toHaveBeenCalled();
        expect(registryResult.findings).toHaveLength(1);
    });

    it('resolves a package once per scan, but still flags every location (memo, ROADMAP §1b Run 11)', async () => {
        const notFoundFetch = buildFetchReturning(404);
        const missingCachePort: RegistryCachePort = {
            read: vi.fn(async () => null),
            write: vi.fn(async () => undefined),
        };
        const duplicateImportFiles = [
            buildFile({ path: 'src/checkout.ts', addedLineTexts: new Map([[3, "import { pad } from 'left-padz-ultra';"]]) }),
            buildFile({ path: 'src/invoice.ts', addedLineTexts: new Map([[9, "import { pad } from 'left-padz-ultra';"]]) }),
        ];

        const registryResult = await runRegistryEngine(
            duplicateImportFiles,
            { fetchImpl: notFoundFetch, registryCache: missingCachePort },
        );

        expect(vi.mocked(missingCachePort.read)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(notFoundFetch)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(missingCachePort.write)).toHaveBeenCalledTimes(1);
        expect(registryResult.findings.map((finding) => finding.path).sort()).toEqual(['src/checkout.ts', 'src/invoice.ts']);
    });

    it('refetches when a cached 404 is older than one hour (slopsquatting window)', async () => {
        const staleCheckedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const cachePort: RegistryCachePort = {
            read: vi.fn(async () => ({ packageExists: false, checkedAt: staleCheckedAt })),
            write: vi.fn(async () => undefined),
        };
        const nowExistsFetch = buildFetchReturning(200);

        const registryResult = await runRegistryEngine(
            [jsFileWithImport("import { helper } from 'freshly-published';")],
            { fetchImpl: nowExistsFetch, registryCache: cachePort },
        );

        expect(nowExistsFetch).toHaveBeenCalledTimes(1);
        expect(registryResult.findings).toHaveLength(0);
        expect(cachePort.write).toHaveBeenCalledWith('npm', 'freshly-published', true);
    });
});

describe('runRegistryEngine — SEC-036 (Hugging Face)', () => {
    it('flags a 404 model id from from_pretrained', async () => {
        const registryResult = await runRegistryEngine(
            [buildFile({
                path: 'src/model_loader.py',
                language: 'python',
                addedLineTexts: new Map([
                    [8, 'model = AutoModel.from_pretrained("nonexistent-org/nonexistent-model")'],
                ]),
            })],
            { fetchImpl: buildFetchReturning(404) },
        );

        const hfFinding = registryResult.findings.find((finding) => finding.ruleId === 'SEC-036');
        expect(hfFinding?.severity).toBe('CRITICAL');
        expect(hfFinding?.explanation).toContain('huggingface.co/api/models/nonexistent-org/nonexistent-model');
    });
});

describe('runRegistryEngine — pyproject.toml manifests (v4)', () => {
    const PYPROJECT_LINES: readonly string[] = [
        '[build-system]',
        'requires = ["setuptools>=68", "wheel"]',
        '',
        '[project]',
        'name = "billing"',
        'dependencies = [',
        '    "requests>=2.31",',
        '    "hallucinated-http-kit[async]>=1.0; python_version < \'3.12\'",',
        ']',
        '',
        '[project.optional-dependencies]',
        'dev = ["pytest", "ruff"]',
        '',
        '[dependency-groups]',
        'docs = ["mkdocs", { include-group = "dev" }]',
        '',
        '[tool.poetry.dependencies]',
        'python = "^3.11"',
        'fastapi = { version = "^0.110", extras = ["all"] }',
        '',
        '[tool.poetry.group.dev.dependencies]',
        'mypy = "^1.8"',
    ];

    function pyprojectFile(addedLines: readonly number[]): RegistryEngineFile {
        const lineTexts = new Map(PYPROJECT_LINES.map((lineText, index) => [index + 1, lineText] as const));
        const addedLineTexts = new Map(addedLines.map((lineNumber) => [lineNumber, lineTexts.get(lineNumber) ?? ''] as const));
        return { path: 'services/billing/pyproject.toml', language: 'toml', addedLineTexts, lineTexts };
    }

    it('resolves declarations from every dependency table and only for added lines', async () => {
        const seenUrls: string[] = [];
        const recordingFetch = vi.fn(async (url: string | URL | Request) => {
            seenUrls.push(String(url));
            return { status: 200, ok: true };
        }) as unknown as typeof fetch;

        await runRegistryEngine([pyprojectFile([2, 7, 8, 12, 15, 19, 22])], { fetchImpl: recordingFetch });

        const checkedPackages = seenUrls.map((url) => url.replace('https://pypi.org/pypi/', '').replace('/json', '')).sort();
        expect(checkedPackages).toEqual(['fastapi', 'hallucinated-http-kit', 'mkdocs', 'mypy', 'pytest', 'requests', 'ruff', 'setuptools', 'wheel'].sort());
    });

    it('ignores the python constraint, unchanged lines and non-dependency tables', async () => {
        const seenUrls: string[] = [];
        const recordingFetch = vi.fn(async (url: string | URL | Request) => {
            seenUrls.push(String(url));
            return { status: 200, ok: true };
        }) as unknown as typeof fetch;

        await runRegistryEngine([pyprojectFile([5, 18])], { fetchImpl: recordingFetch });

        expect(seenUrls).toEqual([]);
    });

    it('flags a 404 declaration as SEC-035 with the manifest line as quote', async () => {
        const registryResult = await runRegistryEngine([pyprojectFile([8])], { fetchImpl: buildFetchReturning(404) });

        expect(registryResult.findings).toHaveLength(1);
        expect(registryResult.findings[0]).toMatchObject({ ruleId: 'SEC-035', line: 8, path: 'services/billing/pyproject.toml' });
        expect(registryResult.findings[0].exactQuote).toContain('hallucinated-http-kit');
    });
});
