/**
 * Was vom Kontextpaket im Job-Ergebnis steht (REPO_CONTEXT_SPEC §6.5, §12):
 * Pfadliste, Größe, Auslassungen und Ladezeit — nie der Inhalt. Zusammen mit
 * `review_job_llm_calls.repo_context_tokens` sind die Mehrkosten des Pakets
 * je PR damit nachrechenbar, ohne dass Repo-Inhalt gespeichert wird.
 */
import { summarizeRepoContext } from '@unslop/shared/repo-context';
import type { RepoContextOmission, RepoContextStatus } from '@unslop/shared/repo-context';
import type { PipelineContext, RepoContextState } from '@/lib/pipeline/types';

/** `review_jobs.result.repo_context` (snake_case wie der Rest des Result-Blobs). */
export interface PersistedRepoContext {
    readonly status: RepoContextStatus;
    readonly paths: readonly string[];
    /** Tokens des ganzen Pakets (Schätzung chars/4); je Call steht der Wert in der Telemetrie. */
    readonly estimated_tokens: number;
    readonly bytes: number;
    readonly omissions: readonly RepoContextOmission[];
    readonly max_tokens: number;
    readonly load_ms: number | null;
    readonly unavailable_reason: string | null;
}

/**
 * Auslassungen für den Nutzer-Hinweis. `not_selected` (ältere Migrationen
 * jenseits des Schema-Deckels) steht im Ergebnis, aber nicht im Hinweis: das
 * ist die Regel, keine Kürzung dieses Laufs.
 */
export function listOmittedContextPaths(repoContext: RepoContextState): string[] {
    return (repoContext.contextPackage?.omissions ?? [])
        .filter((contextOmission) => contextOmission.reason !== 'not_selected')
        .map((contextOmission) => contextOmission.path);
}

export function buildPersistedRepoContext(
    context: Pick<PipelineContext, 'repoContext' | 'repoContextConfig'>,
): PersistedRepoContext {
    const { repoContext, repoContextConfig } = context;
    const contextSummary = repoContext.contextPackage ? summarizeRepoContext(repoContext.contextPackage) : null;
    return {
        status: repoContext.status,
        paths: contextSummary?.paths ?? [],
        estimated_tokens: contextSummary?.estimatedTokens ?? 0,
        bytes: contextSummary?.bytes ?? 0,
        omissions: contextSummary?.omissions ?? [],
        max_tokens: repoContextConfig.maxTokens,
        load_ms: repoContext.loadMs,
        unavailable_reason: repoContext.unavailableReason,
    };
}
