/**
 * Kontextpaket aus dem Arbeitsverzeichnis (REPO_CONTEXT_SPEC §9 1b) gegen ein
 * ECHTES Wegwerf-Repo: nicht committete Änderungen zählen, Aufrufer kommen
 * per `git grep`, ein Abschnitt mit Secret-Treffer fehlt und wird genannt.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { computeDiff } from './git.js';
import { buildLocalRepoContext, extractChangedSymbols } from './repo-context-local.js';

// Echte Wegwerf-Repos reißen unter voller Parallelität das 5-s-Timeout (ROADMAP §8).
vi.setConfig({ testTimeout: 30_000 });

function runGitInFixture(gitArgs: readonly string[], cwd: string): string {
    return execFileSync('git', [...gitArgs], { cwd, encoding: 'utf-8' }).trim();
}

function writeFixtureFile(repoRoot: string, repoPath: string, fileText: string): void {
    const absolutePath = path.join(repoRoot, repoPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, fileText);
}

let fixtureRoot: string;
let shopRepo: string;
let baseSha: string;

beforeAll(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unslop-local-context-'));
    shopRepo = path.join(fixtureRoot, 'shop');
    fs.mkdirSync(shopRepo);
    runGitInFixture(['init', '-b', 'main'], shopRepo);
    runGitInFixture(['config', 'user.email', 'fixture@unslop.test'], shopRepo);
    runGitInFixture(['config', 'user.name', 'Fixture'], shopRepo);
    writeFixtureFile(shopRepo, 'package.json', JSON.stringify({ name: 'shop', main: 'server.js', dependencies: { pg: '^8.12.0' } }));
    writeFixtureFile(shopRepo, 'db/schema.sql', 'create table orders (id serial primary key);\n');
    writeFixtureFile(shopRepo, 'server.js', "const { loadOrder } = require('./orders');\nloadOrder(1);\n");
    writeFixtureFile(shopRepo, 'orders.js', 'function loadOrder(orderId) {\n    return orderId;\n}\nmodule.exports = { loadOrder };\n');
    writeFixtureFile(shopRepo, 'deploy/schema.sql', "create table leaked (k text default 'ghp_abcdefghijklmnopqrstuvwxyz0123');\n");
    runGitInFixture(['add', '.'], shopRepo);
    runGitInFixture(['commit', '-m', 'seed commit'], shopRepo);
    baseSha = runGitInFixture(['rev-parse', 'HEAD'], shopRepo);
    // Nicht committet: geänderte Signatur und ein Manifest-Eintrag, den es im Commit nicht gibt.
    writeFixtureFile(shopRepo, 'orders.js', 'function loadOrder(orderId, tenantId) {\n    return [orderId, tenantId];\n}\nmodule.exports = { loadOrder };\n');
    writeFixtureFile(shopRepo, 'package.json', JSON.stringify({ name: 'shop', main: 'server.js', dependencies: { pg: '^8.12.0', zod: '^3.23.0' } }));
});

afterAll(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('buildLocalRepoContext', () => {
    it('liest den Stand auf der Platte, nennt Aufrufer und lässt die Datei mit Secret-Treffer weg', async () => {
        const workingTreeDiff = computeDiff(baseSha, shopRepo, ['orders.js']);

        const contextPackage = await buildLocalRepoContext(shopRepo, workingTreeDiff);

        const sectionByPath = new Map(contextPackage.sections.map((contextSection) => [contextSection.path, contextSection]));
        expect(sectionByPath.get('package.json')?.content).toContain('"zod"');
        expect(sectionByPath.get('db/schema.sql')?.content).toContain('create table orders');
        expect(sectionByPath.get('server.js')?.kind).toBe('entry_point');
        expect(sectionByPath.get('(files that reference changed symbols)')?.content).toBe('loadOrder: server.js:1\nloadOrder: server.js:2');
        expect(sectionByPath.has('deploy/schema.sql')).toBe(false);
        expect(contextPackage.omissions).toContainEqual({ kind: 'schema', path: 'deploy/schema.sql', reason: 'secret' });
    });
});

describe('extractChangedSymbols', () => {
    it('findet deklarierte Namen auf geänderten Zeilen bestehender Dateien, nicht in neuen Dateien', () => {
        const changedSymbols = extractChangedSymbols([
            { path: 'lib/pricing.py', status: 'modified', patch: '@@ -1 +1 @@\n-def total_price(cart):\n+def total_price(cart, tax):' },
            { path: 'lib/new.ts', status: 'added', patch: '@@ -0,0 +1 @@\n+export function brandNewHelper() {}' },
        ]);

        expect(changedSymbols).toEqual(['total_price']);
    });
});
