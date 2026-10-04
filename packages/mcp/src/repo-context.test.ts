/**
 * Repo-Resolution-Tests (MCP_SPEC.md §3.3/§10) gegen echte Wegwerf-Repos:
 * Walk-up zur Git-Root, repoPath-Override, und jeder der vier Failure-States
 * als Wert (nie als Exception).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { resolveRepoContext } from './repo-context.js';

// Echte Wegwerf-Repos (init, commit, push in ein temporäres Origin) brauchen
// isoliert ~4 s pro Test und rissen unter voller Worker-Parallelität das
// 5-s-Test-Timeout (ROADMAP §8) — analog zum globalen hookTimeout.
vi.setConfig({ testTimeout: 30_000 });

function runGitInFixture(gitArgs: readonly string[], cwd: string): string {
    return execFileSync('git', [...gitArgs], { cwd, encoding: 'utf-8' }).trim();
}

let fixtureRoot: string;
let fullRepo: string;
let noOriginRepo: string;
let noMergeBaseRepo: string;
let plainDirectory: string;

beforeAll(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unslop-repo-context-'));
    const bareOrigin = path.join(fixtureRoot, 'origin.git');
    fullRepo = path.join(fixtureRoot, 'full');
    noOriginRepo = path.join(fixtureRoot, 'no-origin');
    noMergeBaseRepo = path.join(fixtureRoot, 'no-merge-base');
    plainDirectory = path.join(fixtureRoot, 'plain');
    fs.mkdirSync(plainDirectory);

    runGitInFixture(['init', '--bare', '-b', 'main', bareOrigin], fixtureRoot);

    for (const repoDir of [fullRepo, noOriginRepo, noMergeBaseRepo]) {
        fs.mkdirSync(repoDir);
        runGitInFixture(['init', '-b', 'main'], repoDir);
        runGitInFixture(['config', 'user.email', 'fixture@unslop.test'], repoDir);
        runGitInFixture(['config', 'user.name', 'Fixture'], repoDir);
        fs.writeFileSync(path.join(repoDir, 'module.ts'), 'export const value = 1;\n');
        runGitInFixture(['add', '.'], repoDir);
        runGitInFixture(['commit', '-m', 'initial state'], repoDir);
    }

    runGitInFixture(['remote', 'add', 'origin', bareOrigin], fullRepo);
    runGitInFixture(['push', 'origin', 'main'], fullRepo);
    runGitInFixture(['remote', 'set-url', 'origin', 'git@github.com:acme/widgets.git'], fullRepo);

    // Origin-URL gesetzt, aber keine origin/*-Refs ⇒ kein Merge-Base ermittelbar.
    runGitInFixture(['remote', 'add', 'origin', 'git@github.com:acme/unreachable.git'], noMergeBaseRepo);
});

afterAll(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('resolveRepoContext (MCP_SPEC §3.3)', () => {
    it('resolves the full context for a connected repository via repoPath', () => {
        const resolution = resolveRepoContext(fullRepo);

        expect(resolution.ok).toBe(true);
        if (!resolution.ok) return;
        expect(path.resolve(resolution.context.gitRoot).toLowerCase())
            .toBe(path.resolve(fullRepo).toLowerCase());
        expect(resolution.context.repoFullName).toBe('acme/widgets');
        expect(resolution.context.mergeBase).toMatch(/^[0-9a-f]{40}$/);
        expect(resolution.context.headSha).toBe(resolution.context.mergeBase);
        expect(resolution.context.isDirty).toBe(false);
    });

    it('walks up to the git root from a nested repoPath', () => {
        const nestedDir = path.join(fullRepo, 'src', 'lib');
        fs.mkdirSync(nestedDir, { recursive: true });

        const resolution = resolveRepoContext(nestedDir);

        expect(resolution.ok).toBe(true);
        if (!resolution.ok) return;
        expect(path.resolve(resolution.context.gitRoot).toLowerCase())
            .toBe(path.resolve(fullRepo).toLowerCase());
    });

    it('reports isDirty for uncommitted tracked changes', () => {
        fs.writeFileSync(path.join(fullRepo, 'module.ts'), 'export const value = 2;\n');
        try {
            const resolution = resolveRepoContext(fullRepo);
            expect(resolution.ok && resolution.context.isDirty).toBe(true);
        } finally {
            runGitInFixture(['checkout', '--', '.'], fullRepo);
        }
    });

    it('fails with not_a_git_repo for a plain directory', () => {
        const resolution = resolveRepoContext(plainDirectory);

        expect(resolution).toMatchObject({ ok: false, failureKind: 'not_a_git_repo' });
    });

    it('fails with not_a_git_repo for a nonexistent repoPath', () => {
        const resolution = resolveRepoContext(path.join(fixtureRoot, 'does-not-exist'));

        expect(resolution).toMatchObject({ ok: false, failureKind: 'not_a_git_repo' });
    });

    it('fails with no_origin_remote when origin is missing', () => {
        const resolution = resolveRepoContext(noOriginRepo);

        expect(resolution).toMatchObject({ ok: false, failureKind: 'no_origin_remote' });
    });

    it('fails with detached_or_no_merge_base when no origin refs exist', () => {
        const resolution = resolveRepoContext(noMergeBaseRepo);

        expect(resolution).toMatchObject({ ok: false, failureKind: 'detached_or_no_merge_base' });
    });
});
