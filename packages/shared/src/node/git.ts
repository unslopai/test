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
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export class GitError extends Error {}

/** Output ceiling of one git call; beyond it execFileSync fails with ENOBUFS. */
const GIT_OUTPUT_BUFFER_BYTES = 10 * 1024 * 1024;

/** Extra process input for a single git call (temporary index, pathspec list on stdin). */
interface GitCallOptions {
    readonly env?: Readonly<Record<string, string>>;
    readonly stdinText?: string;
    /** `-z` output: a leading space belongs to the first path and must survive. */
    readonly keepWhitespace?: boolean;
}

function runGit(gitArgs: readonly string[], cwd?: string, callOptions: GitCallOptions = {}): string {
    try {
        const gitOutput = execFileSync('git', [...gitArgs], {
            encoding: 'utf-8',
            maxBuffer: GIT_OUTPUT_BUFFER_BYTES,
            stdio: [callOptions.stdinText === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
            ...(callOptions.stdinText === undefined ? {} : { input: callOptions.stdinText }),
            ...(callOptions.env ? { env: { ...process.env, ...callOptions.env } } : {}),
            ...(cwd ? { cwd } : {}),
        });
        return callOptions.keepWhitespace ? gitOutput : gitOutput.trim();
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

export interface DiffOptions {
    /**
     * Also diff untracked files that `.gitignore` does not exclude, as new
     * files (CLI and VS Code extension). A freshly generated file is the most
     * common AI-code case; without this the scan said "Nothing reviewed".
     */
    readonly includeUntracked?: boolean;
}

/**
 * Produces the diff of tracked changes (committed + staged + unstaged)
 * against the merge-base, plus — with `includeUntracked` — untracked,
 * non-ignored files as new files. They are part of the same diff string, so
 * the secret filter and the upload limit cover them like any other change.
 * CRLF is normalized to LF.
 * `pathFilters` schränkt auf repo-relative Pfade ein (MCP `paths`, §3.5) —
 * kann den Diff nur verengen, nie erweitern.
 */
export function computeDiff(
    mergeBaseSha: string,
    cwd?: string,
    pathFilters?: readonly string[],
    diffOptions: DiffOptions = {},
): string {
    const diffArgs = ['diff', '--no-color', '--no-ext-diff', '-U3', mergeBaseSha];
    if (pathFilters && pathFilters.length > 0) {
        diffArgs.push('--', ...pathFilters);
    }
    const untrackedPaths = diffOptions.includeUntracked ? listUntrackedFiles(cwd, pathFilters) : [];
    if (untrackedPaths.length === 0) {
        return runGit(diffArgs, cwd).replace(/\r\n/g, '\n');
    }
    assertUntrackedFilesFitBuffer(untrackedPaths, resolveGitRoot(cwd));
    return diffWithIntentToAdd(diffArgs, untrackedPaths, cwd).replace(/\r\n/g, '\n');
}

/**
 * Untracked, non-ignored files, repo-root-relative (the same form `git diff`
 * prints). Listed from `cwd` so `pathFilters` mean the same as for `git diff`;
 * `:/` widens the unfiltered listing to the whole work tree. Entries ending in
 * `/` are nested repositories — not content of this one, and `git add -N`
 * rejects them.
 */
function listUntrackedFiles(cwd?: string, pathFilters?: readonly string[]): string[] {
    const pathspecs = pathFilters && pathFilters.length > 0 ? pathFilters : [':/'];
    const listOutput = runGit(
        ['ls-files', '--others', '--exclude-standard', '--full-name', '-z', '--', ...pathspecs],
        cwd,
        { keepWhitespace: true },
    );
    return listOutput.split('\0').filter((untrackedPath) => untrackedPath.length > 0 && !untrackedPath.endsWith('/'));
}

/**
 * Untracked content beyond this size cannot become an uploadable diff anyway
 * (MAX_DIFF_UPLOAD_BYTES is far lower), but it would overflow the git output
 * buffer and abort with a cryptic ENOBUFS. Typical cause: `node_modules/`,
 * build output or a data dump without a `.gitignore` entry.
 */
const UNTRACKED_BYTES_CEILING = 8 * 1024 * 1024;

function assertUntrackedFilesFitBuffer(untrackedPaths: readonly string[], gitRoot: string): void {
    let untrackedBytes = 0;
    for (const untrackedPath of untrackedPaths) {
        untrackedBytes += fs.lstatSync(path.join(gitRoot, untrackedPath), { throwIfNoEntry: false })?.size ?? 0;
        if (untrackedBytes > UNTRACKED_BYTES_CEILING) {
            throw new GitError(
                `${untrackedPaths.length} untracked file(s) hold more than ${UNTRACKED_BYTES_CEILING / (1024 * 1024)} MB `
                + `(e.g. ${untrackedPath}); the scan includes untracked files that .gitignore does not exclude. `
                + 'Add generated files, dependencies or data dumps to .gitignore, then scan again.',
            );
        }
    }
}

/**
 * The documented `git add -N` workaround, applied to a throwaway COPY of the
 * index: the user's real index (staging area) is never touched. Literal
 * pathspecs, so no file name is read as glob or pathspec magic. Without a
 * real index (a `--no-checkout` clone) the scratch index starts empty, which
 * is what git itself would diff against.
 */
function diffWithIntentToAdd(diffArgs: readonly string[], untrackedPaths: readonly string[], cwd?: string): string {
    const realIndexPath = path.resolve(cwd ?? process.cwd(), runGit(['rev-parse', '--git-path', 'index'], cwd));
    const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unslop-index-'));
    try {
        const scratchIndexPath = path.join(scratchDir, 'index');
        if (fs.existsSync(realIndexPath)) fs.copyFileSync(realIndexPath, scratchIndexPath);
        const scratchIndexEnv = { GIT_INDEX_FILE: scratchIndexPath };
        runGit(
            ['add', '--intent-to-add', '--pathspec-from-file=-', '--pathspec-file-nul'],
            resolveGitRoot(cwd),
            { env: { ...scratchIndexEnv, GIT_LITERAL_PATHSPECS: '1' }, stdinText: untrackedPaths.join('\0') },
        );
        return runGit(diffArgs, cwd, { env: scratchIndexEnv });
    } finally {
        fs.rmSync(scratchDir, { recursive: true, force: true });
    }
}

export function resolveHeadSha(cwd?: string): string {
    return runGit(['rev-parse', 'HEAD'], cwd);
}

/**
 * true, wenn Staged/Unstaged-Änderungen an getrackten Dateien existieren —
 * mit `includeUntracked` auch, wenn nicht ignorierte untracked Dateien
 * existieren (die scannt das CLI mit, und ihr Inhalt liegt nicht in git).
 */
export function isWorkingTreeDirty(cwd?: string, dirtyOptions: DiffOptions = {}): boolean {
    const untrackedMode = dirtyOptions.includeUntracked ? '--untracked-files=all' : '--untracked-files=no';
    return runGit(['status', '--porcelain', untrackedMode], cwd).length > 0;
}

/**
 * Tracked plus untracked, non-ignored files, repo-root-relative with forward
 * slashes: the path list the repository context rules select from
 * (REPO_CONTEXT_SPEC §9 1b).
 */
export function listWorkTreeFiles(cwd?: string): string[] {
    const listOutput = runGit(
        ['ls-files', '--cached', '--others', '--exclude-standard', '--full-name', '-z', '--', ':/'],
        cwd,
        { keepWhitespace: true },
    );
    return [...new Set(listOutput.split('\0').filter((listedPath) => listedPath.length > 0 && !listedPath.endsWith('/')))];
}

export interface WorkTreeGrepHit {
    readonly path: string;
    readonly line: number;
}

const GREP_HIT_PATTERN = /^(.+?):(\d+):/;

/**
 * Whole-word, fixed-string search over tracked and untracked files. `git grep`
 * exits 1 without a match; that is an empty result, not a failure. Any other
 * non-zero exit throws.
 */
export function grepWordInWorkTree(searchWord: string, cwd?: string): WorkTreeGrepHit[] {
    const grepProbe = probeGit(
        ['grep', '-n', '-w', '-F', '-I', '--untracked', '--full-name', '-e', searchWord, '--', ':/'], cwd,
    );
    if (grepProbe.exitCode === 1) return [];
    if (grepProbe.exitCode !== 0) throw new GitError(`git grep failed: ${grepProbe.stderr || grepProbe.exitCode}`);
    return grepProbe.stdout.split('\n').flatMap((grepLine) => {
        const hitMatch = GREP_HIT_PATTERN.exec(grepLine);
        return hitMatch ? [{ path: hitMatch[1], line: Number.parseInt(hitMatch[2], 10) }] : [];
    });
}
