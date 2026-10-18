/**
 * Dependency bundle injected into every tool handler (MCP_SPEC.md §3.2):
 * handlers never touch credentials, process.cwd(), or the filesystem directly.
 */
import type { UnslopApiClient } from './unslop-client.js';
import type { RepoContextResolution, RepoIdentityResolution } from './repo-context.js';

export interface ToolDeps {
    readonly api: UnslopApiClient;
    readonly resolveRepoContext: (explicitRepoPath?: string) => RepoContextResolution;
    /** Nur Identität (gitRoot + repoFullName) — für connect/review_pr, die keinen Merge-Base brauchen. */
    readonly resolveRepoIdentity: (explicitRepoPath?: string) => RepoIdentityResolution;
    readonly buildDiff: (
        gitRoot: string,
        mergeBaseSha: string,
        pathFilters?: readonly string[],
    ) => string;
    readonly baseUrl: string;
    readonly rerollLimit: number;
    readonly waitMs: (durationMs: number) => Promise<void>;
}
