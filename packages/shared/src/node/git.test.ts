/**
 * Git-Helper-Tests (MCP_SPEC.md §10) gegen ECHTE Wegwerf-Repos in Temp-
 * Verzeichnissen: Merge-Base-Auflösung, Detached HEAD, fehlendes Origin,
 * leerer Diff, Pfad-Filter und Dirty-Erkennung.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    GitError,
    computeDiff,
    isWorkingTreeDirty,
    resolveGitRoot,
    resolveHeadSha,
    resolveMergeBase,
    resolveRepoFullName,
} from './git.js';

function runGitInFixture(gitArgs: readonly string[], cwd: string): string {
    return execFileSync('git', [...gitArgs], { cwd, encoding: 'utf-8' }).trim();
}

let fixtureRoot: string;
let connectedRepo: string;
let orphanRepo: string;
let populatedBareOrigin: string;

/** Init + user config + one committed seed file — the smallest usable repo. */
function createRepoWithCommit(repoPath: string): void {
    fs.mkdirSync(repoPath);
    runGitInFixture(['init', '-b', 'main'], repoPath);
    runGitInFixture(['config', 'user.email', 'fixture@unslop.test'], repoPath);
    runGitInFixture(['config', 'user.name', 'Fixture'], repoPath);
    fs.writeFileSync(path.join(repoPath, 'seed.ts'), 'export const seed = 1;\n');
    runGitInFixture(['add', '.'], repoPath);
    runGitInFixture(['commit', '-m', 'seed commit'], repoPath);
}

/**
 * connectedRepo: ein Repo mit origin/main-Ref (per Push in ein lokales Bare-
 * Repo), dessen origin-URL danach auf eine GitHub-SSH-URL umgestellt wird —
 * so sind Merge-Base UND repoFullName ohne Netz testbar.
 */
beforeAll(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unslop-git-fixture-'));
    const bareOrigin = path.join(fixtureRoot, 'origin.git');
    populatedBareOrigin = bareOrigin;
    connectedRepo = path.join(fixtureRoot, 'connected');
    orphanRepo = path.join(fixtureRoot, 'orphan');

    runGitInFixture(['init', '--bare', '-b', 'main', bareOrigin], fixtureRoot);

    fs.mkdirSync(connectedRepo);
    runGitInFixture(['init', '-b', 'main'], connectedRepo);
    runGitInFixture(['config', 'user.email', 'fixture@unslop.test'], connectedRepo);
    runGitInFixture(['config', 'user.name', 'Fixture'], connectedRepo);
    fs.writeFileSync(path.join(connectedRepo, 'tracked-one.ts'), 'export const alpha = 1;\n');
    fs.writeFileSync(path.join(connectedRepo, 'tracked-two.ts'), 'export const beta = 2;\n');
    runGitInFixture(['add', '.'], connectedRepo);
    runGitInFixture(['commit', '-m', 'initial state'], connectedRepo);
    runGitInFixture(['remote', 'add', 'origin', bareOrigin], connectedRepo);
    runGitInFixture(['push', 'origin', 'main'], connectedRepo);
    runGitInFixture(['remote', 'set-url', 'origin', 'git@github.com:acme/widgets.git'], connectedRepo);

    fs.mkdirSync(orphanRepo);
    runGitInFixture(['init', '-b', 'main'], orphanRepo);
    runGitInFixture(['config', 'user.email', 'fixture@unslop.test'], orphanRepo);
    runGitInFixture(['config', 'user.name', 'Fixture'], orphanRepo);
    fs.writeFileSync(path.join(orphanRepo, 'lonely.ts'), 'export const lonely = true;\n');
    runGitInFixture(['add', '.'], orphanRepo);
    runGitInFixture(['commit', '-m', 'orphan commit'], orphanRepo);
});

afterAll(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('git helpers against a real repository', () => {
    it('parses the SSH origin URL into owner/name', () => {
        expect(resolveRepoFullName(connectedRepo)).toBe('acme/widgets');
    });

    it('parses an HTTPS origin URL too', () => {
        runGitInFixture(['remote', 'set-url', 'origin', 'https://github.com/acme/widgets.git'], connectedRepo);
        expect(resolveRepoFullName(connectedRepo)).toBe('acme/widgets');
        runGitInFixture(['remote', 'set-url', 'origin', 'git@github.com:acme/widgets.git'], connectedRepo);
    });

    it('throws GitError for a repository without an origin remote', () => {
        expect(() => resolveRepoFullName(orphanRepo)).toThrow(GitError);
    });

    it('resolves the merge-base against origin/main via the fallback branch probe', () => {
        const mergeBaseSha = resolveMergeBase(null, connectedRepo);
        expect(mergeBaseSha).toBe(resolveHeadSha(connectedRepo));
    });

    it('names the real problem on an unborn HEAD (0 commits), even with a dangling origin', () => {
        // The test3 state from the 2026-08-10 F5 pass: fresh init, publish added
        // a remote but never committed — fetching cannot cure this, so the
        // fetch-first message (and the [Fetch Remote] button) must not appear.
        const unbornRepo = path.join(fixtureRoot, 'unborn');
        fs.mkdirSync(unbornRepo);
        runGitInFixture(['init', '-b', 'master'], unbornRepo);
        runGitInFixture(['remote', 'add', 'origin', 'https://github.com/acme/ghost.git'], unbornRepo);

        expect(() => resolveMergeBase(null, unbornRepo)).toThrow(/no commits yet/);
        expect(() => resolveMergeBase(null, unbornRepo)).not.toThrow(/Fetch the remote first/);
    });

    it('falls back to the current branch without origin refs → actionable merge-base error', () => {
        // Freshly published repo before the remote-tracking refs exist: the
        // default branch resolves to the local branch, so the user gets an
        // actionable merge-base diagnosis instead of the default-branch dead
        // end. (orphanRepo has no origin remote at all, so the Z1–Z5 probe
        // classifies it as not-found — the differentiated states have their
        // own describe block below.)
        expect(() => resolveMergeBase(null, orphanRepo))
            .toThrow(/Cannot compute merge-base with 'origin\/main'/);
    });

    it('throws the default-branch error on a detached HEAD without origin refs', () => {
        const headSha = runGitInFixture(['rev-parse', 'HEAD'], orphanRepo);
        runGitInFixture(['checkout', '--detach', headSha], orphanRepo);
        try {
            expect(() => resolveMergeBase(null, orphanRepo))
                .toThrow(/Cannot determine the default branch/);
        } finally {
            runGitInFixture(['checkout', 'main'], orphanRepo);
        }
    });

    it('produces an empty diff for an unchanged working tree', () => {
        const mergeBaseSha = resolveMergeBase(null, connectedRepo);
        expect(computeDiff(mergeBaseSha, connectedRepo)).toBe('');
        expect(isWorkingTreeDirty(connectedRepo)).toBe(false);
    });

    it('diffs uncommitted tracked changes, honours path filters, and reports dirty', () => {
        fs.writeFileSync(path.join(connectedRepo, 'tracked-one.ts'), 'export const alpha = 111;\n');
        fs.writeFileSync(path.join(connectedRepo, 'tracked-two.ts'), 'export const beta = 222;\n');
        const mergeBaseSha = resolveMergeBase(null, connectedRepo);

        const fullDiff = computeDiff(mergeBaseSha, connectedRepo);
        expect(fullDiff).toContain('tracked-one.ts');
        expect(fullDiff).toContain('tracked-two.ts');

        const narrowedDiff = computeDiff(mergeBaseSha, connectedRepo, ['tracked-one.ts']);
        expect(narrowedDiff).toContain('tracked-one.ts');
        expect(narrowedDiff).not.toContain('tracked-two.ts');

        expect(isWorkingTreeDirty(connectedRepo)).toBe(true);

        runGitInFixture(['checkout', '--', '.'], connectedRepo);
    });

    it('resolves the git root from a nested subdirectory (walk-up)', () => {
        const nestedDir = path.join(connectedRepo, 'deeply', 'nested');
        fs.mkdirSync(nestedDir, { recursive: true });

        const resolvedRoot = resolveGitRoot(nestedDir);

        expect(path.resolve(resolvedRoot).toLowerCase()).toBe(path.resolve(connectedRepo).toLowerCase());
    });

    it('still resolves the merge-base on a detached HEAD', () => {
        const headSha = resolveHeadSha(connectedRepo);
        runGitInFixture(['checkout', '--detach', headSha], connectedRepo);
        try {
            expect(resolveMergeBase(null, connectedRepo)).toBe(headSha);
        } finally {
            runGitInFixture(['checkout', 'main'], connectedRepo);
        }
    });

    it('throws GitError for a directory that is not a work tree', () => {
        expect(() => resolveGitRoot(fixtureRoot)).toThrow(GitError);
    });
});

/**
 * Differentiated merge-base diagnostics (VSCODE_UX_SPEC §4.2, Z1–Z5): every
 * failure state gets the message that names its actual cure — the 2026-08-31
 * F5 pass showed the old blanket fetch-first advice misleading users whose
 * remedy was pushing, publishing, or switching accounts. The ls-remote probe
 * runs only in the failure path; local remotes keep these tests offline.
 */
describe('resolveMergeBase failure diagnosis (Z1–Z5)', () => {
    it('Z1: remote has refs that are not fetched locally → fetch-first message', () => {
        const unfetchedRepo = path.join(fixtureRoot, 'z1-unfetched');
        createRepoWithCommit(unfetchedRepo);
        runGitInFixture(['remote', 'add', 'origin', populatedBareOrigin], unfetchedRepo);

        expect(() => resolveMergeBase(null, unfetchedRepo))
            .toThrow(/not fetched locally yet.*Fetch the remote first/);
        expect(() => resolveMergeBase(null, unfetchedRepo)).not.toThrow(/never been pushed/);
    });

    it('Z2: remote exists but is empty (never pushed) → push-first message, no fetch advice', () => {
        const emptyBareOrigin = path.join(fixtureRoot, 'z2-empty-origin.git');
        runGitInFixture(['init', '--bare', '-b', 'main', emptyBareOrigin], fixtureRoot);
        const unpushedRepo = path.join(fixtureRoot, 'z2-unpushed');
        createRepoWithCommit(unpushedRepo);
        runGitInFixture(['remote', 'add', 'origin', emptyBareOrigin], unpushedRepo);

        expect(() => resolveMergeBase(null, unpushedRepo)).toThrow(/has never been pushed/);
        expect(() => resolveMergeBase(null, unpushedRepo)).not.toThrow(/Fetch the remote first/);
    });

    it('Z3/Z4: remote reported as not found → explains both missing repo and masked 404', () => {
        const ghostRepo = path.join(fixtureRoot, 'z3-ghost');
        createRepoWithCommit(ghostRepo);
        runGitInFixture(
            ['remote', 'add', 'origin', path.join(fixtureRoot, 'does-not-exist.git')],
            ghostRepo,
        );

        expect(() => resolveMergeBase(null, ghostRepo))
            .toThrow(/does not exist yet.*masks private repositories/);
        expect(() => resolveMergeBase(null, ghostRepo)).not.toThrow(/Fetch the remote first/);
    });

    it('Z5: fetched origin shares no history with HEAD → unrelated-history message, no fetch loop', () => {
        const unrelatedRepo = path.join(fixtureRoot, 'z5-unrelated');
        createRepoWithCommit(unrelatedRepo);
        runGitInFixture(['remote', 'add', 'origin', populatedBareOrigin], unrelatedRepo);
        runGitInFixture(['fetch', 'origin'], unrelatedRepo);

        expect(() => resolveMergeBase(null, unrelatedRepo)).toThrow(/shares no history with HEAD/);
        expect(() => resolveMergeBase(null, unrelatedRepo)).not.toThrow(/Fetch the remote first/);
    });

    it('degrades to the generic fetch-first fallback when the remote probe is unreachable', () => {
        // Connection refused on a closed local port — the offline/unreachable
        // shape without real network dependency.
        const unreachableRepo = path.join(fixtureRoot, 'offline');
        createRepoWithCommit(unreachableRepo);
        runGitInFixture(
            ['remote', 'add', 'origin', 'https://127.0.0.1:1/unreachable/repo.git'],
            unreachableRepo,
        );

        expect(() => resolveMergeBase(null, unreachableRepo))
            .toThrow(/Cannot compute merge-base with 'origin\/main'\. Fetch the remote first/);
    }, 20_000);

    it('keeps the generic fallback for a non-origin explicit base (no remote probe)', () => {
        expect(() => resolveMergeBase('upstream/main', connectedRepo))
            .toThrow(/Cannot compute merge-base with 'upstream\/main'\. Fetch the remote first/);
    });
});
