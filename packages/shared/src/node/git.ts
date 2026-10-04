/**
 * Git interaction: repo detection, origin → owner/name, default branch,
 * merge-base and diff generation (tracked changes incl. uncommitted).
 *
 * Verschoben aus packages/cli/src/git.ts (MCP_SPEC.md §3.1). Additiv für den
 * MCP-Server: optionales `cwd` pro Funktion (der MCP-Prozess läuft nicht im
 * Repo), Pfad-Filter für computeDiff und Dirty-Erkennung. Ohne `cwd` ist das
 * Verhalten byte-identisch zum bisherigen CLI-Code.
 */
import { execFileSync } from 'node:child_process';

export class GitError extends Error {}

function runGit(gitArgs: readonly string[], cwd?: string): string {
    try {
        return execFileSync('git', [...gitArgs], {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'pipe'],
            ...(cwd ? { cwd } : {}),
        }).trim();
    } catch (gitError: unknown) {
        const stderr = (gitError as { stderr?: string }).stderr ?? '';
        throw new GitError(`git ${gitArgs[0]} failed: ${stderr.trim() || String(gitError)}`);
    }
}

export function assertInsideWorkTree(cwd?: string): void {
    try {
        runGit(['rev-parse', '--is-inside-work-tree'], cwd);
    } catch {
        throw new GitError('Not inside a git work tree. Run unslop from within your repository.');
    }
}

/** Wurzelverzeichnis des Work Trees (git macht den Walk-up selbst). */
export function resolveGitRoot(cwd?: string): string {
    try {
        return runGit(['rev-parse', '--show-toplevel'], cwd);
    } catch {
        throw new GitError('Not inside a git work tree.');
    }
}

/** Parses the origin URL (SSH or HTTPS) into "owner/name". */
export function resolveRepoFullName(cwd?: string): string {
    const originUrl = runGit(['remote', 'get-url', 'origin'], cwd);

    const sshMatch = /^git@[^:]+:(.+?)(?:\.git)?$/.exec(originUrl);
    if (sshMatch) return sshMatch[1];

    const httpsMatch = /^https?:\/\/[^/]+\/(.+?)(?:\.git)?\/?$/.exec(originUrl);
    if (httpsMatch) return httpsMatch[1];

    throw new GitError(`Cannot parse repository name from origin URL: ${originUrl}`);
}

/**
 * Determines the base for the diff:
 * merge-base of HEAD and the given reference (default: origin/<default branch>).
 */
export function resolveMergeBase(explicitBaseRef: string | null, cwd?: string): string {
    assertHeadExists(cwd);
    const baseRef = explicitBaseRef ?? `origin/${resolveDefaultBranch(cwd)}`;
    try {
        return runGit(['merge-base', 'HEAD', baseRef], cwd);
    } catch {
        throw new GitError(diagnoseMergeBaseFailure(baseRef, cwd));
    }
}

/** GitHub masks private repos as "not found" to the wrong account; a dangling
 * local-path origin yields "does not appear to be a git repository". Offline
 * failures ("Could not resolve host", "Failed to connect") match neither. */
const REMOTE_NOT_FOUND_PATTERN =
    /repository not found|does not appear to be a git repository|could not read from remote repository/i;

/**
 * Differentiated merge-base diagnosis (VSCODE_UX_SPEC §4.2, states Z1–Z5).
 * Runs ONLY in the failure path — the happy path stays zero-network. Each
 * state's message carries a stable marker phrase the VS Code extension maps
 * to its curing action; an unclassifiable probe (e.g. offline) degrades to
 * the generic fetch-first fallback instead of guessing.
 */
function diagnoseMergeBaseFailure(baseRef: string, cwd?: string): string {
    const failurePrefix = `Cannot compute merge-base with '${baseRef}'`;
    const genericFallback =
        `${failurePrefix}. Fetch the remote first, or pass an explicit base via --base <ref>.`;

    // Z5 (local check, no network): the base ref resolves, so the merge-base
    // failed for lack of a common ancestor — fetching again cannot cure that.
    if (probeGit(['rev-parse', '--verify', '--quiet', baseRef], cwd).exitCode === 0) {
        return `${failurePrefix}: '${baseRef}' exists locally but shares no history with HEAD — ` +
            "'origin' points at an unrelated repository. Check the origin URL (git remote -v), " +
            'or pass an explicit base via --base <ref>.';
    }
    // Remote probing only makes sense for origin-tracking refs.
    if (!baseRef.startsWith('origin/')) return genericFallback;

    const remoteProbe = probeGit(['ls-remote', '--exit-code', '--heads', 'origin'], cwd);
    // Z1: the remote has branches that simply aren't fetched locally yet.
    if (remoteProbe.exitCode === 0 && remoteProbe.stdout.length > 0) {
        return `${failurePrefix}: the remote has branches that are not fetched locally yet. ` +
            'Fetch the remote first, or pass an explicit base via --base <ref>.';
    }
    // Z2: the remote answered but lists zero branches — nothing was ever pushed.
    if (remoteProbe.exitCode === 2 || remoteProbe.exitCode === 0) {
        return `${failurePrefix}: the 'origin' remote is empty — this branch has never been pushed. ` +
            'Push the branch first (git push -u origin <branch>), or pass an explicit base via --base <ref>.';
    }
    // Z3/Z4: "not found" is deliberately ambiguous on GitHub — the repo may not
    // exist yet, or it is private and the active account cannot see it.
    if (REMOTE_NOT_FOUND_PATTERN.test(remoteProbe.stderr)) {
        return `${failurePrefix}: the 'origin' repository was reported as not found — either it does not ` +
            'exist yet (publish it first), or it is private and the active GitHub account cannot see it ' +
            "(GitHub masks private repositories as 'not found' to the wrong account). " +
            'Check which account your git credentials use, then scan again.';
    }
    return genericFallback;
}

interface GitProbeOutcome {
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
}

/**
 * Non-throwing git runner for the diagnosis path: exit code and stderr ARE the
 * result here. ALL credential prompts are disabled: GIT_TERMINAL_PROMPT for
 * the terminal, GCM_INTERACTIVE for the Git Credential Manager's GUI window —
 * without the latter, a probe against a path with no stored credential (e.g.
 * after `credential.useHttpPath true`) pops a blocking "Connect to GitHub"
 * dialog out of nowhere (F5 finding 2026-08-31). A credential-less probe now
 * fails silently instead, degrading the diagnosis to the generic fallback.
 */
function probeGit(gitArgs: readonly string[], cwd?: string): GitProbeOutcome {
    try {
        const probeStdout = execFileSync('git', [...gitArgs], {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
            ...(cwd ? { cwd } : {}),
        });
        return { exitCode: 0, stdout: probeStdout.trim(), stderr: '' };
    } catch (probeError: unknown) {
        const probeFailure = probeError as { status?: number; stdout?: string; stderr?: string };
        return {
            exitCode: typeof probeFailure.status === 'number' ? probeFailure.status : -1,
            stdout: (probeFailure.stdout ?? '').trim(),
            stderr: (probeFailure.stderr ?? '').trim(),
        };
    }
}

/**
 * Unborn HEAD (fresh `git init`, zero commits): every merge-base attempt fails
 * on HEAD itself, and `branch --show-current` still names the unborn branch —
 * without this guard the fallback below would emit the fetch-first error,
 * which no amount of fetching can cure (F5 receipt 2026-08-10, ROADMAP §3).
 */
function assertHeadExists(cwd?: string): void {
    try {
        runGit(['rev-parse', '--verify', 'HEAD'], cwd);
    } catch {
        throw new GitError(
            'This repository has no commits yet — create an initial commit first, then scan again.',
        );
    }
}

function resolveDefaultBranch(cwd?: string): string {
    try {
        // e.g. "origin/main" — set by clone; repairable via `git remote set-head origin -a`.
        const originHead = runGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], cwd);
        return originHead.replace(/^origin\//, '');
    } catch {
        for (const fallbackBranch of ['main', 'master']) {
            try {
                runGit(['rev-parse', '--verify', `origin/${fallbackBranch}`], cwd);
                return fallbackBranch;
            } catch {
                // try the next candidate
            }
        }
        // Freshly published repo: the push succeeded, but the remote-tracking
        // refs may not exist locally yet. The current branch name lets
        // resolveMergeBase try `origin/<branch>` and fail with its actionable
        // fetch-first message instead of this dead end. Empty on detached HEAD.
        const currentBranch = currentLocalBranch(cwd);
        if (currentBranch) return currentBranch;
        throw new GitError(
            'Cannot determine the default branch (no origin/HEAD, origin/main, or origin/master). ' +
            'Pass an explicit base via --base <ref>.',
        );
    }
}

function currentLocalBranch(cwd?: string): string {
    try {
        return runGit(['branch', '--show-current'], cwd);
    } catch {
        return '';
    }
}

/**
 * Produces the diff of tracked changes (committed + staged + unstaged)
 * against the merge-base. Untracked files are NOT included
 * (workaround: `git add -N <file>`). CRLF is normalized to LF.
 * `pathFilters` schränkt auf repo-relative Pfade ein (MCP `paths`, §3.5) —
 * kann den Diff nur verengen, nie erweitern.
 */
export function computeDiff(
    mergeBaseSha: string,
    cwd?: string,
    pathFilters?: readonly string[],
): string {
    const diffArgs = ['diff', '--no-color', '--no-ext-diff', '-U3', mergeBaseSha];
    if (pathFilters && pathFilters.length > 0) {
        diffArgs.push('--', ...pathFilters);
    }
    const rawDiff = runGit(diffArgs, cwd);
    return rawDiff.replace(/\r\n/g, '\n');
}

export function resolveHeadSha(cwd?: string): string {
    return runGit(['rev-parse', 'HEAD'], cwd);
}

/** true, wenn Staged/Unstaged-Änderungen an getrackten Dateien existieren. */
export function isWorkingTreeDirty(cwd?: string): boolean {
    return runGit(['status', '--porcelain', '--untracked-files=no'], cwd).length > 0;
}
