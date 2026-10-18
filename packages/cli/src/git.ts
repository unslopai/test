/**
 * Git-Interaktion: Repo-Erkennung, origin → owner/name, Default-Branch,
 * Merge-Base und Diff-Erzeugung (tracked Changes inkl. uncommitted).
 */
import { execFileSync } from 'node:child_process';

export class GitError extends Error {}

function runGit(gitArgs: readonly string[]): string {
    try {
        return execFileSync('git', [...gitArgs], {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
    } catch (gitError: unknown) {
        const stderr = (gitError as { stderr?: string }).stderr ?? '';
        throw new GitError(`git ${gitArgs[0]} failed: ${stderr.trim() || String(gitError)}`);
    }
}

export function assertInsideWorkTree(): void {
    try {
        runGit(['rev-parse', '--is-inside-work-tree']);
    } catch {
        throw new GitError('Not inside a git work tree. Run unslop from within your repository.');
    }
}

/** Parst die origin-URL (SSH oder HTTPS) zu "owner/name". */
export function resolveRepoFullName(): string {
    const originUrl = runGit(['remote', 'get-url', 'origin']);

    const sshMatch = /^git@[^:]+:(.+?)(?:\.git)?$/.exec(originUrl);
    if (sshMatch) return sshMatch[1];

    const httpsMatch = /^https?:\/\/[^/]+\/(.+?)(?:\.git)?\/?$/.exec(originUrl);
    if (httpsMatch) return httpsMatch[1];

    throw new GitError(`Cannot parse repository name from origin URL: ${originUrl}`);
}

/**
 * Ermittelt die Basis für den Diff:
 * Merge-Base von HEAD und der angegebenen Referenz (Default: origin/<default branch>).
 */
export function resolveMergeBase(explicitBaseRef: string | null): string {
    const baseRef = explicitBaseRef ?? `origin/${resolveDefaultBranch()}`;
    try {
        return runGit(['merge-base', 'HEAD', baseRef]);
    } catch {
        throw new GitError(
            `Cannot compute merge-base with '${baseRef}'. ` +
            'Fetch the remote first, or pass an explicit base via --base <ref>.',
        );
    }
}

function resolveDefaultBranch(): string {
    try {
        // z.B. "origin/main" — gesetzt durch clone; via `git remote set-head origin -a` reparierbar.
        const originHead = runGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
        return originHead.replace(/^origin\//, '');
    } catch {
        for (const fallbackBranch of ['main', 'master']) {
            try {
                runGit(['rev-parse', '--verify', `origin/${fallbackBranch}`]);
                return fallbackBranch;
            } catch {
                // nächsten Kandidaten probieren
            }
        }
        throw new GitError(
            'Cannot determine the default branch (no origin/HEAD, origin/main, or origin/master). ' +
            'Pass an explicit base via --base <ref>.',
        );
    }
}

/**
 * Erzeugt den Diff der tracked Changes (committed + staged + unstaged)
 * gegen die Merge-Base. Untracked Dateien sind NICHT enthalten
 * (Workaround: `git add -N <file>`). CRLF wird zu LF normalisiert.
 */
export function computeDiff(mergeBaseSha: string): string {
    const rawDiff = runGit(['diff', '--no-color', '--no-ext-diff', '-U3', mergeBaseSha]);
    return rawDiff.replace(/\r\n/g, '\n');
}

export function resolveHeadSha(): string {
    return runGit(['rev-parse', 'HEAD']);
}
