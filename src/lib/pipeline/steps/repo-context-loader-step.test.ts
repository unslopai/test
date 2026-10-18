/**
 * Unit Tests: RepoContextLoaderStep (REPO_CONTEXT_SPEC §9 1a/1b, §9.2).
 * GitHub wird über `fetch` gestubbt; der Step selbst spricht mit keiner Datenbank.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { repoContextLoaderStep } from '@/lib/pipeline/steps/repo-context-loader-step';
import { buildPipelineContext, buildPullRequestFile } from '@/lib/pipeline/testing/context-fixture';
import type { PipelineContext } from '@/lib/pipeline/types';

const HEAD_SHA = 'f00dfeed';
const SCHEMA_SQL = 'create table contact_messages (id serial primary key);';

function jsonResponse(responseBody: unknown, status = 200): Response {
    return new Response(JSON.stringify(responseBody), { status });
}

/** GitHub am Head-SHA: ein Tree mit Manifest und Schema, Contents als base64. */
function stubGitHub(requestedUrls: string[], contentsStatus = 200): void {
    vi.stubGlobal('fetch', vi.fn((requestUrl: string) => {
        requestedUrls.push(requestUrl);
        if (requestUrl.includes('/git/trees/')) {
            return Promise.resolve(jsonResponse({
                truncated: false,
                tree: [
                    { path: 'web/package.json', type: 'blob', size: 40 },
                    { path: 'db/schema.sql', type: 'blob', size: 60 },
                    { path: 'web/app/api/contact/route.ts', type: 'blob', size: 80 },
                ],
            }));
        }
        if (contentsStatus !== 200) return Promise.resolve(jsonResponse({ message: 'rate limited' }, contentsStatus));
        const fileText = requestUrl.includes('schema.sql') ? SCHEMA_SQL : '{"name":"web","dependencies":{"pg":"^8"}}';
        return Promise.resolve(jsonResponse({ encoding: 'base64', content: Buffer.from(fileText).toString('base64') }));
    }));
}

function buildPrContext(overrides: Partial<PipelineContext> = {}): PipelineContext {
    return buildPipelineContext({
        githubToken: 'installation-token-under-test',
        headSha: HEAD_SHA,
        reviewableFiles: [buildPullRequestFile({ filename: 'web/app/api/contact/route.ts', status: 'added' })],
        ...overrides,
    });
}

const UPLOADED_PACKAGE = {
    sections: [
        { kind: 'schema', path: 'db/schema.sql', content: SCHEMA_SQL, relatedPaths: [] },
        { kind: 'manifest', path: 'deploy/package.json', content: 'API_KEY="abcdefghijklmnop"', relatedPaths: [] },
        { kind: 'changed_file', path: 'config/.env.example', content: 'PORT=3000', relatedPaths: [] },
    ],
    omissions: [],
};

describe('repoContextLoaderStep', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('baut das Paket im App-Pfad aus Tree und Contents am Head-SHA', async () => {
        const requestedUrls: string[] = [];
        stubGitHub(requestedUrls);

        const loadedContext = await repoContextLoaderStep.execute(buildPrContext());

        expect(loadedContext.repoContext.status).toBe('loaded');
        expect(loadedContext.repoContext.contextPackage?.sections.map((contextSection) => contextSection.path))
            .toEqual(expect.arrayContaining(['web/package.json', 'db/schema.sql']));
        expect(requestedUrls[0]).toContain(`/git/trees/${HEAD_SHA}?recursive=1`);
        const contentsUrls = requestedUrls.filter((requestedUrl) => requestedUrl.includes('/contents/'));
        expect(contentsUrls.length).toBeGreaterThan(0);
        expect(contentsUrls.every((contentsUrl) => contentsUrl.endsWith(`?ref=${HEAD_SHA}`))).toBe(true);
        expect(loadedContext.cascade.degradations).toEqual([]);
    });

    it('läuft bei einem gescheiterten Abruf ohne Paket weiter und meldet repo_context_unavailable', async () => {
        stubGitHub([], 403);

        const degradedContext = await repoContextLoaderStep.execute(buildPrContext());

        expect(degradedContext.repoContext).toMatchObject({
            status: 'unavailable', contextPackage: null, unavailableReason: 'http_403',
        });
        expect(degradedContext.cascade.degradations).toEqual(['repo_context_unavailable']);
        expect(degradedContext.shouldAbort).toBe(false);
    });

    it('lädt nicht, wenn das Job-Budget dem Draft sonst fehlen würde', async () => {
        const requestedUrls: string[] = [];
        stubGitHub(requestedUrls);

        const degradedContext = await repoContextLoaderStep.execute(buildPrContext({ deadlineAtMs: Date.now() + 30_000 }));

        expect(requestedUrls).toEqual([]);
        expect(degradedContext.repoContext.unavailableReason).toBe('no_time_budget');
        expect(degradedContext.cascade.degradations).toEqual(['repo_context_unavailable']);
    });

    it('ruft GitHub nicht und trägt kein hochgeladenes Paket weiter, wenn der Repo-Kontext abgeschaltet ist', async () => {
        const requestedUrls: string[] = [];
        stubGitHub(requestedUrls);

        const untouchedContext = await repoContextLoaderStep.execute(buildPrContext({
            repoContextConfig: { enabled: false, maxTokens: 8_000 },
            repoContext: { status: 'disabled', contextPackage: null, loadMs: null, unavailableReason: null },
            uploadedContextPackage: UPLOADED_PACKAGE,
        }));

        expect(requestedUrls).toEqual([]);
        expect(untouchedContext.repoContext.status).toBe('disabled');
        expect(untouchedContext.uploadedContextPackage).toBeUndefined();
    });

    it('übernimmt ein hochgeladenes Paket ohne Abschnitte mit Secret-Treffer und ohne .env-Dateien', async () => {
        const loadedContext = await repoContextLoaderStep.execute(buildPipelineContext({
            reviewableFiles: [buildPullRequestFile()],
            uploadedContextPackage: UPLOADED_PACKAGE,
        }));

        expect(loadedContext.repoContext.contextPackage?.sections.map((contextSection) => contextSection.path))
            .toEqual(['db/schema.sql']);
        expect(loadedContext.repoContext.contextPackage?.omissions)
            .toContainEqual({ kind: 'manifest', path: 'deploy/package.json', reason: 'secret' });
        expect(loadedContext.uploadedContextPackage).toBeUndefined();
    });

    it('wertet ein kaputtes hochgeladenes Paket als nicht verfügbar', async () => {
        const degradedContext = await repoContextLoaderStep.execute(buildPipelineContext({
            reviewableFiles: [buildPullRequestFile()],
            uploadedContextPackage: { sections: 'not-a-list' },
        }));

        expect(degradedContext.repoContext.unavailableReason).toBe('invalid_upload');
        expect(degradedContext.cascade.degradations).toEqual(['repo_context_unavailable']);
    });
});
