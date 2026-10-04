/**
 * State-Detection-Tests gegen echte Wegwerf-Repos (VSCODE_UX_SPEC §6.1,
 * ROADMAP §8): die Basis-Zustände NOT_A_REPO / NO_ORIGIN / READY entstehen
 * in `evaluateBaseState` (vscode-gebunden) ausschließlich aus den hier
 * getesteten GitFacts — genau dafür wurde gitFacts.ts vscode-frei faktoriert.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    collectGitFacts,
    initGitRepository,
    originRefsPresent,
    parseRepoFullName,
    repoHasCommits,
} from './gitFacts';

function runGitInFixture(gitArgs: readonly string[], cwd: string): void {
    execFileSync('git', [...gitArgs], { cwd, encoding: 'utf-8' });
}

let fixtureRoot: string;
let plainDirectory: string;
let noOriginRepo: string;
let sshOriginRepo: string;
let httpsOriginRepo: string;

beforeAll(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unslop-git-facts-'));
    plainDirectory = path.join(fixtureRoot, 'plain');
    noOriginRepo = path.join(fixtureRoot, 'no-origin');
    sshOriginRepo = path.join(fixtureRoot, 'ssh-origin');
    httpsOriginRepo = path.join(fixtureRoot, 'https-origin');

    fs.mkdirSync(plainDirectory);
    for (const repoDir of [noOriginRepo, sshOriginRepo, httpsOriginRepo]) {
        fs.mkdirSync(repoDir);
        runGitInFixture(['init', '-b', 'main'], repoDir);
    }
    runGitInFixture(['remote', 'add', 'origin', 'git@github.com:acme/widgets.git'], sshOriginRepo);
    runGitInFixture(['remote', 'add', 'origin', 'https://github.com/acme/widgets.git'], httpsOriginRepo);
});

afterAll(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('collectGitFacts — state detection from scratch folders (§6.1)', () => {
    it('reports a plain folder as not a git repo (NOT_A_REPO input)', async () => {
        const gitFacts = await collectGitFacts(plainDirectory);

        expect(gitFacts).toEqual({ isGitRepo: false, originFullName: null, repoRoot: null });
    });

    it('reports a repo without an origin remote (NO_ORIGIN input)', async () => {
        const gitFacts = await collectGitFacts(noOriginRepo);

        expect(gitFacts.isGitRepo).toBe(true);
        expect(gitFacts.originFullName).toBeNull();
        expect(gitFacts.repoRoot).not.toBeNull();
    });

    it('resolves an SSH origin to owner/name (READY input)', async () => {
        const gitFacts = await collectGitFacts(sshOriginRepo);

        expect(gitFacts.isGitRepo).toBe(true);
        expect(gitFacts.originFullName).toBe('acme/widgets');
        // git meldet den Toplevel mit Forward-Slashes — Vergleich normalisiert.
        expect(path.resolve(gitFacts.repoRoot ?? '').toLowerCase())
            .toBe(path.resolve(sshOriginRepo).toLowerCase());
    });

    it('resolves an HTTPS origin to owner/name (READY input)', async () => {
        const gitFacts = await collectGitFacts(httpsOriginRepo);

        expect(gitFacts.originFullName).toBe('acme/widgets');
    });

    it('resolves facts from a nested subfolder of the repo', async () => {
        const nestedDir = path.join(sshOriginRepo, 'src', 'lib');
        fs.mkdirSync(nestedDir, { recursive: true });

        const gitFacts = await collectGitFacts(nestedDir);

        expect(gitFacts.isGitRepo).toBe(true);
        expect(gitFacts.originFullName).toBe('acme/widgets');
        expect(path.resolve(gitFacts.repoRoot ?? '').toLowerCase())
            .toBe(path.resolve(sshOriginRepo).toLowerCase());
    });
});

describe('initGitRepository — one-click init (§3.2 amendment)', () => {
    it('turns a plain folder into a repo without origin (NOT_A_REPO → NO_ORIGIN input)', async () => {
        const initTarget = path.join(fixtureRoot, 'init-target');
        fs.mkdirSync(initTarget);

        expect(await initGitRepository(initTarget)).toBe(true);

        const gitFacts = await collectGitFacts(initTarget);
        expect(gitFacts.isGitRepo).toBe(true);
        expect(gitFacts.originFullName).toBeNull();
    });

    it('reports failure for a folder that does not exist', async () => {
        expect(await initGitRepository(path.join(fixtureRoot, 'does-not-exist'))).toBe(false);
    });
});

describe('repoHasCommits — unborn-HEAD probe (§4.2 Create Initial Commit)', () => {
    it('is false for an unborn repo and for a plain folder', async () => {
        expect(await repoHasCommits(noOriginRepo)).toBe(false);
        expect(await repoHasCommits(plainDirectory)).toBe(false);
    });

    it('is true once an initial commit exists', async () => {
        const committedRepo = path.join(fixtureRoot, 'committed');
        fs.mkdirSync(committedRepo);
        runGitInFixture(['init', '-b', 'main'], committedRepo);
        runGitInFixture(['config', 'user.email', 'fixture@unslop.test'], committedRepo);
        runGitInFixture(['config', 'user.name', 'Fixture'], committedRepo);
        fs.writeFileSync(path.join(committedRepo, 'seed.ts'), 'export const seed = 1;\n');
        runGitInFixture(['add', '.'], committedRepo);
        runGitInFixture(['commit', '-m', 'initial'], committedRepo);

        expect(await repoHasCommits(committedRepo)).toBe(true);
    });
});

describe('originRefsPresent — post-fetch masked-404 probe (§4.2)', () => {
    it('is false while no remote-tracking refs exist (remote configured or not)', async () => {
        expect(await originRefsPresent(noOriginRepo)).toBe(false);
        expect(await originRefsPresent(sshOriginRepo)).toBe(false);
    });

    it('is true once a push has created refs/remotes/origin/*', { timeout: 15_000 }, async () => {
        const bareOrigin = path.join(fixtureRoot, 'probe-origin.git');
        const pushedRepo = path.join(fixtureRoot, 'probe-pushed');
        runGitInFixture(['init', '--bare', '-b', 'main', bareOrigin], fixtureRoot);
        fs.mkdirSync(pushedRepo);
        runGitInFixture(['init', '-b', 'main'], pushedRepo);
        runGitInFixture(['config', 'user.email', 'fixture@unslop.test'], pushedRepo);
        runGitInFixture(['config', 'user.name', 'Fixture'], pushedRepo);
        fs.writeFileSync(path.join(pushedRepo, 'seed.ts'), 'export const seed = 1;\n');
        runGitInFixture(['add', '.'], pushedRepo);
        runGitInFixture(['commit', '-m', 'initial'], pushedRepo);
        runGitInFixture(['remote', 'add', 'origin', bareOrigin], pushedRepo);
        runGitInFixture(['push', 'origin', 'main'], pushedRepo);

        expect(await originRefsPresent(pushedRepo)).toBe(true);
    });
});

describe('parseRepoFullName', () => {
    it('parses SSH remotes with and without .git suffix', () => {
        expect(parseRepoFullName('git@github.com:acme/widgets.git')).toBe('acme/widgets');
        expect(parseRepoFullName('git@github.com:acme/widgets')).toBe('acme/widgets');
    });

    it('parses HTTPS remotes incl. trailing slash and http scheme', () => {
        expect(parseRepoFullName('https://github.com/acme/widgets.git')).toBe('acme/widgets');
        expect(parseRepoFullName('https://github.com/acme/widgets/')).toBe('acme/widgets');
        expect(parseRepoFullName('http://github.com/acme/widgets')).toBe('acme/widgets');
    });

    it('keeps subgroup paths intact (owner/group/name)', () => {
        expect(parseRepoFullName('https://gitlab.example.com/acme/tools/widgets.git'))
            .toBe('acme/tools/widgets');
    });

    it('returns null for URLs that are neither SSH nor HTTP(S)', () => {
        expect(parseRepoFullName('file:///C:/repos/widgets')).toBeNull();
        expect(parseRepoFullName('not a url at all')).toBeNull();
        expect(parseRepoFullName('')).toBeNull();
    });
});
