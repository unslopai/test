/**
 * RepoContextLoaderStep — baut das deterministische Kontextpaket des Jobs
 * (REPO_CONTEXT_SPEC §5.1, Stufe 1a/1b). Kein AI-Call.
 *
 * PR-Jobs: Auswahlregeln aus `@unslop/shared/repo-context` gegen die
 * GitHub-API am Head-SHA. Lokale Diff-Jobs (CLI, Extension, MCP): das vom
 * Client gebaute Paket, das der CliDiffLoaderStep aus dem Job-Payload
 * genommen (und dort schon durch Pfadliste und Größe ersetzt) hat; hier wird
 * es validiert, begrenzt und durch den Secret-Filter geschickt.
 *
 * Der Step läuft immer direkt vor dem Draft (der Worker hängt ihn ein, er
 * steht in keiner `enabledStepIds`-Liste); sein Schalter ist
 * `pipeline_config.repoContext.enabled`.
 *
 * Ein Fehlschlag ist nie ein Job-Fehler: die Review läuft ohne Paket weiter
 * und trägt die Degradation `repo_context_unavailable` (Spec §9.2). Der
 * Abruf hat eine eigene Zeitgrenze und nimmt dem Draft nie das Budget.
 */
import { GitHubApiError } from '@/lib/github';
import { remainingLlmMs } from '@/lib/pipeline/deadline';
import { GITHUB_CONTEXT_MAX_FILE_READS, createGitHubContextReader } from '@/lib/pipeline/repo-context-github';
import {
    buildRepoContextPackage,
    enforceContextLimits,
    parseUploadedContextPackage,
    summarizeRepoContext,
} from '@unslop/shared/repo-context';
import { containsSecretLine } from '@unslop/shared/secret-filter';
import type { RepoContextPackage } from '@unslop/shared/repo-context';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

/** Eigene Zeitgrenze des Abrufs (Spec §6.1). */
const CONTEXT_LOAD_TIMEOUT_MS = 10_000;
/** So viel LLM-Budget muss nach dem Abruf mindestens bleiben; darunter wird gar nicht erst geladen. */
const MIN_LLM_BUDGET_AFTER_LOAD_MS = 60_000;

class ContextLoadTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`Kontextpaket nicht innerhalb von ${timeoutMs} ms geladen.`);
        this.name = 'ContextLoadTimeoutError';
    }
}

export const repoContextLoaderStep: PipelineStep = {
    id: 'repo-context-loader',
    displayName: 'Repository Context Loader',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        // Ein hochgeladenes Paket verlässt den Kontext in jedem Fall hier, auch
        // wenn es nicht benutzt wird: kein späterer Step soll es weitertragen.
        const { uploadedContextPackage, ...contextWithoutUpload } = context;
        const forwardedContext: PipelineContext = contextWithoutUpload;
        if (context.shouldAbort || context.llmSkipped) return forwardedContext;
        if (!context.repoContextConfig.enabled || context.reviewableFiles.length === 0) return forwardedContext;

        if (uploadedContextPackage !== undefined) return adoptUploadedPackage(forwardedContext, uploadedContextPackage);
        // Lokale Diff-Jobs alter Clients: kein Paket, kein Token — Review wie bisher (Spec §9.1).
        if (!context.githubToken || !context.headSha) return forwardedContext;
        return loadPackageFromGitHub(forwardedContext);
    },
};

// =============================================================================
// App-Pfad: GitHub-API am Head-SHA
// =============================================================================

async function loadPackageFromGitHub(context: PipelineContext): Promise<PipelineContext> {
    const loadStartedAtMs = Date.now();
    const loadTimeoutMs = Math.min(CONTEXT_LOAD_TIMEOUT_MS, remainingLlmMs(context) - MIN_LLM_BUDGET_AFTER_LOAD_MS);
    if (loadTimeoutMs <= 0) return markContextUnavailable(context, 'no_time_budget', null);

    const abortController = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutReached = new Promise<never>((_resolve, rejectOnTimeout) => {
        timeoutHandle = setTimeout(() => rejectOnTimeout(new ContextLoadTimeoutError(loadTimeoutMs)), loadTimeoutMs);
    });

    try {
        const contextPackage = await Promise.race([
            buildRepoContextPackage({
                changedFiles: context.reviewableFiles.map((reviewableFile) => ({
                    path: reviewableFile.filename,
                    status: reviewableFile.status,
                    patch: reviewableFile.patch,
                })),
                reader: createGitHubContextReader({
                    githubToken: context.githubToken,
                    repoFullName: context.repoFullName,
                    headSha: context.headSha,
                    abortSignal: abortController.signal,
                }),
                maxTokens: context.repoContextConfig.maxTokens,
                maxFileReads: GITHUB_CONTEXT_MAX_FILE_READS,
                containsSecret: containsSecretLine,
            }),
            timeoutReached,
        ]);
        return adoptPackage(context, contextPackage, Date.now() - loadStartedAtMs);
    } catch (loadFailure: unknown) {
        // Kein Swallowing (MAINT-001): Grund im Log, Degradation im Ergebnis und
        // auf jeder Oberfläche; die Review läuft auf dem Diff weiter.
        console.error(
            `[RepoContext] Kontextpaket nicht geladen (Job ${context.jobId}, ${context.repoFullName}@${context.headSha}) — `
            + 'repo_context_unavailable:',
            loadFailure instanceof Error ? loadFailure.message : loadFailure,
        );
        return markContextUnavailable(context, classifyLoadFailure(loadFailure), Date.now() - loadStartedAtMs);
    } finally {
        clearTimeout(timeoutHandle);
        // Nach Erfolg ein No-op; nach Zeitgrenze oder einem gescheiterten Abruf
        // beendet es die übrigen laufenden Abrufe (Sekundärlimit).
        abortController.abort();
    }
}

/** Stabiler Server-Code für Ergebnis und Auswertung, nie der rohe Fehlertext. */
function classifyLoadFailure(loadFailure: unknown): string {
    if (loadFailure instanceof ContextLoadTimeoutError) return 'timeout';
    if (loadFailure instanceof GitHubApiError) return `http_${loadFailure.status}`;
    if (loadFailure instanceof Error && loadFailure.name === 'AbortError') return 'timeout';
    return 'load_error';
}

// =============================================================================
// Lokale Oberflächen: hochgeladenes Paket
// =============================================================================

function adoptUploadedPackage(context: PipelineContext, uploadedContextPackage: unknown): PipelineContext {
    const uploadedPackage = parseUploadedContextPackage(uploadedContextPackage);
    if (!uploadedPackage) {
        console.error(`[RepoContext] Hochgeladenes Kontextpaket ungültig (Job ${context.jobId}) — repo_context_unavailable.`);
        return markContextUnavailable(context, 'invalid_upload', null);
    }
    return adoptPackage(
        context,
        enforceContextLimits(uploadedPackage, context.repoContextConfig.maxTokens, containsSecretLine),
        null,
    );
}

// =============================================================================
// Kontext-Übergänge
// =============================================================================

function adoptPackage(context: PipelineContext, contextPackage: RepoContextPackage, loadMs: number | null): PipelineContext {
    const contextSummary = summarizeRepoContext(contextPackage);
    console.log(
        `[RepoContext] ${contextPackage.sections.length} Abschnitte, ~${contextSummary.estimatedTokens} Tokens `
        + `(Obergrenze ${context.repoContextConfig.maxTokens}), ${contextPackage.omissions.length} ausgelassen`
        + `${loadMs === null ? '' : `, ${loadMs} ms`} (Job ${context.jobId}).`,
    );
    return {
        ...context,
        repoContext: { status: 'loaded', contextPackage, loadMs, unavailableReason: null },
    };
}

function markContextUnavailable(
    context: PipelineContext,
    unavailableReason: string,
    loadMs: number | null,
): PipelineContext {
    return {
        ...context,
        repoContext: { status: 'unavailable', contextPackage: null, loadMs, unavailableReason },
        cascade: {
            ...context.cascade,
            degradations: [...context.cascade.degradations, 'repo_context_unavailable'],
        },
    };
}
