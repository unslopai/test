/**
 * Worker-Logik für die Anti-Slop Review Pipeline.
 *
 * Ein Einstiegspunkt: processReviewJob — der pipeline-basierte Review für
 * Webhook- und CLI-Jobs. Der frühere prozedurale Raw-Code-Pfad (processJob /
 * runReviewer / runFixer) war nur über einen internen Endpoint erreichbar und
 * wurde von keinem Produkt-Pfad je befüllt; er ist ersatzlos entfernt.
 */
import { supabase } from '@/lib/supabase';
import { extractErrorMessage } from '@/lib/errors';
import { buildJobErrorMessage, classifyJobFailure } from '@/lib/job-failure';
import { resolveRepoAccessToken } from '@/lib/repo-auth';
import { getInstallationToken } from '@/lib/github-app';
import { completeGatekeeperCheckRun, deriveReviewConclusion } from '@/lib/check-run';
import { runPipeline } from '@/lib/pipeline/runner';
import { DEFAULT_PIPELINE_CONFIG, INITIAL_CASCADE_STATE, resolveCascadeConfig } from '@/lib/pipeline/defaults';
// Subpath-Import mit Absicht: der Index zieht alle Scan-Engines (tree-sitter,
// ESLint) in den Worker-Modulgraphen — genau der OOM-Pfad aus ROADMAP §1b.
import { resolvePrescanConfig } from '@unslop/prescan/config';
import { collectReportableIssues } from '@/lib/pipeline/helpers';
import { diffLoaderStep } from '@/lib/pipeline/steps/diff-loader-step';
import { cliDiffLoaderStep } from '@/lib/pipeline/steps/cli-diff-loader-step';
import { preScannerStep } from '@/lib/pipeline/steps/pre-scanner-step';
import { ragLoaderStep } from '@/lib/pipeline/steps/rag-loader-step';
import { complexityRouterStep } from '@/lib/pipeline/steps/complexity-router-step';
import { draftReviewerStep } from '@/lib/pipeline/steps/draft-reviewer-step';
import { claimVerifierStep } from '@/lib/pipeline/steps/claim-verifier-step';
import { escalationReviewerStep } from '@/lib/pipeline/steps/escalation-reviewer-step';
import { secondOpinionReviewerStep } from '@/lib/pipeline/steps/second-opinion-reviewer-step';
import { integrityScorerStep } from '@/lib/pipeline/steps/integrity-scorer-step';
import { githubReporterStep } from '@/lib/pipeline/steps/github-reporter-step';
import { resultPersisterStep } from '@/lib/pipeline/steps/result-persister-step';
import type { CheckRunResult } from '@/lib/check-run';
import type { JobFailureCode } from '@/lib/job-failure';
import type { CascadeConfig, PipelineContext, PipelineStep, PipelineConfig, RepoAuthMode } from '@/lib/pipeline/types';

// =============================================================================
// Interfaces
// =============================================================================

interface JobPayload {
    repo_full_name?: string;
    pr_number?: number;
    pr_url?: string;
    pr_head_sha?: string;
    action?: string;
    /** Nur bei lokalen Diff-Jobs (CLI-Scan, MCP-Scan) gesetzt. */
    diff?: string;
    [key: string]: unknown;
}

// =============================================================================
// Step Registry
// =============================================================================

const STEP_REGISTRY: ReadonlyMap<string, PipelineStep> = new Map([
    [diffLoaderStep.id, diffLoaderStep],
    [cliDiffLoaderStep.id, cliDiffLoaderStep],
    [preScannerStep.id, preScannerStep],
    [ragLoaderStep.id, ragLoaderStep],
    [complexityRouterStep.id, complexityRouterStep],
    [draftReviewerStep.id, draftReviewerStep],
    [claimVerifierStep.id, claimVerifierStep],
    [escalationReviewerStep.id, escalationReviewerStep],
    [secondOpinionReviewerStep.id, secondOpinionReviewerStep],
    [integrityScorerStep.id, integrityScorerStep],
    [githubReporterStep.id, githubReporterStep],
    [resultPersisterStep.id, resultPersisterStep],
]);

/**
 * Feste Pipeline für CLI-Scans: Diff kommt aus dem Payload statt von GitHub,
 * kein GitHub-Reporter (es gibt keinen PR). Conditions/Smart-Detection kommen
 * weiterhin aus der Repo-Config (promptConfig).
 */
const CLI_PIPELINE_STEPS: readonly PipelineStep[] = [
    cliDiffLoaderStep,
    // Läuft im Patch-only Degraded Mode (kein GitHub-Token): Regex-/Registry-
    // Regeln auf Added Lines, AST-/Config-Regeln ehrlich in skippedChecks.
    preScannerStep,
    ragLoaderStep,
    complexityRouterStep,
    draftReviewerStep,
    claimVerifierStep,
    escalationReviewerStep,
    secondOpinionReviewerStep,
    integrityScorerStep,
    resultPersisterStep,
];

/**
 * Baut die Pipeline-Steps basierend auf der Konfiguration zusammen.
 * Nur aktivierte Steps werden instanziiert. Der ResultPersisterStep wird
 * immer terminal angehängt (Pflicht-Step, nicht toggelbar) — auch für
 * bestehende pipeline_configs, die ihn noch nicht kennen.
 */
function assembleSteps(config: PipelineConfig): PipelineStep[] {
    const configuredSteps = config.enabledStepIds
        .filter((stepId) => stepId !== resultPersisterStep.id)
        .map((stepId) => STEP_REGISTRY.get(stepId))
        .filter((step): step is PipelineStep => step !== undefined);

    return [...configuredSteps, resultPersisterStep];
}

// =============================================================================
// Job Processor
// =============================================================================

/**
 * Verarbeitet einen PR-basierten Review-Job via Pipeline Engine.
 *
 * Ablauf:
 * 1. Job claimen (Concurrency Guard)
 * 2. GitHub Token entschlüsseln
 * 3. Pipeline-Config laden (DB oder Default)
 * 4. Pipeline Steps zusammenbauen und ausführen
 */
export async function processReviewJob(jobId: string, userId: string) {
    console.log(`[PRWorker] Starte PR-Review Job ${jobId}...`);

    // Explizite Spalten [DATA-001] — check_run_id wird hier gelesen und muss
    // deshalb benannt sein, statt sich auf ein implizites select('*') zu verlassen.
    const { data: job, error: fetchError } = await supabase
        .from('review_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('status', 'pending')
        .select('id, payload, source, repository_id, check_run_id')
        .single();

    if (fetchError || !job) {
        console.error(`[PRWorker] Job ${jobId} nicht gefunden oder bereits verarbeitet:`, fetchError);
        return;
    }

    const payload = job.payload as JobPayload;
    // Pipeline-Wahl nach PAYLOAD-Form, nicht nach source: seit MCP_SPEC gibt es
    // unter source 'mcp' BEIDE Job-Formen — Scans mit lokalem Diff (Phase 1,
    // CLI-Pipeline ohne GitHub-I/O) und PR-Reviews ohne Diff (§4.7,
    // webhook-förmig inkl. github-reporter). source === 'cli' allein hätte
    // MCP-Scans fälschlich in den PR-Pfad geschickt.
    const isLocalDiffJob = job.source === 'cli'
        || (job.source === 'mcp' && typeof payload.diff === 'string');
    const repoFullName = payload.repo_full_name;
    const prNumber = payload.pr_number;
    const checkRunId: number | null = job.check_run_id ?? null;

    if (!repoFullName || (!prNumber && !isLocalDiffJob)) {
        await markJobError(jobId, 'Payload enthält kein repo_full_name oder pr_number.');
        return;
    }

    // Vor dem try, damit der Fehlerpfad den Check Run auch dann schließen kann,
    // wenn die Pipeline mittendrin stirbt.
    let installationId: number | null = null;

    try {
        const repoRow = await loadRepoRow(job.repository_id, repoFullName, userId);

        if (!repoRow && !isLocalDiffJob) {
            throw new Error(`Repository ${repoFullName} ist nicht (mehr) verbunden.`);
        }

        installationId = repoRow?.installationId ?? null;

        // Dual-Auth (GITHUB_APP_SPEC §3): App-Repo → Installation-Token (Bot),
        // sonst User-OAuth-Token. Lokale Diff-Jobs sprechen nie mit der GitHub API.
        // Scheitert das Installation-Token, wirft resolveRepoAccessToken — es
        // gibt bewusst KEINEN stillen Rückfall auf die User-Identität (D1).
        const repoAccess = isLocalDiffJob
            ? null
            : await resolveRepoAccessToken({ installationId, ownerUserId: userId });

        const pipelineConfig = parsePipelineConfig(repoRow?.pipelineConfig) ?? DEFAULT_PIPELINE_CONFIG;
        const steps = isLocalDiffJob ? [...CLI_PIPELINE_STEPS] : assembleSteps(pipelineConfig);

        const initialContext = buildInitialContext({
            jobId,
            repoFullName,
            prNumber: prNumber ?? 0,
            ownerUserId: userId,
            repositoryId: repoRow?.id ?? null,
            githubToken: repoAccess?.token ?? '',
            authMode: repoAccess?.mode ?? 'oauth',
            pipelineConfig,
            detectedEcosystems: repoRow?.detectedEcosystems ?? null,
        });

        const finalContext = await runPipeline(initialContext, steps);
        console.log(`[PRWorker] Job ${jobId} erfolgreich abgeschlossen.`);

        await closeCheckRun(installationId, checkRunId, finalContext);

    } catch (error: unknown) {
        console.error(`[PRWorker] Fehler bei Job ${jobId}:`, error);
        const failureMessage = buildJobErrorMessage(error);

        await markJobError(jobId, failureMessage);

        // Stirbt der Job VOR der Auth-Auflösung (z.B. transienter DB-Fehler im
        // Repo-Lookup), ist installationId hier noch null — der Check Run bliebe
        // dann ewig in 'in_progress' hängen, genau der Zustand, den D3 ausschließt.
        // Die Installation wird deshalb im Fehlerpfad notfalls nachgeladen.
        const checkRunInstallationId = installationId
            ?? await lookupInstallationId(job.repository_id, userId);

        await failCheckRun(checkRunInstallationId, checkRunId, repoFullName, classifyJobFailure(failureMessage));
    }
}

/**
 * Letzte Chance, die Installation eines Jobs zu ermitteln, dessen Repo-Lookup
 * gescheitert ist. Schlägt auch das fehl, bleibt nur der Log — der Job-Status
 * steht dann bereits auf 'error'.
 */
async function lookupInstallationId(
    repositoryId: string | null,
    ownerUserId: string,
): Promise<number | null> {
    if (!repositoryId) {
        return null;
    }

    const { data: repoRow, error: lookupError } = await supabase
        .from('repositories')
        .select('installation_id')
        .eq('id', repositoryId)
        .eq('user_id', ownerUserId)
        .maybeSingle();

    if (lookupError) {
        console.error(
            `[PRWorker] Installation für Repo ${repositoryId} nicht nachladbar — `
            + `Check Run bleibt offen: ${lookupError.message}`,
        );
        return null;
    }

    return repoRow?.installation_id ?? null;
}

/** Die Job-spezifischen Eckdaten, aus denen der Startkontext gebaut wird. */
interface InitialContextParams {
    readonly jobId: string;
    readonly repoFullName: string;
    readonly prNumber: number;
    readonly ownerUserId: string;
    readonly repositoryId: string | null;
    readonly githubToken: string;
    readonly authMode: RepoAuthMode;
    readonly pipelineConfig: PipelineConfig;
    readonly detectedEcosystems: readonly string[] | null;
}

function buildInitialContext(params: InitialContextParams): PipelineContext {
    return {
        jobId: params.jobId,
        repoFullName: params.repoFullName,
        prNumber: params.prNumber,
        headSha: '',
        githubToken: params.githubToken,
        authMode: params.authMode,
        repositoryId: params.repositoryId,
        ownerUserId: params.ownerUserId,
        prFiles: [],
        reviewableFiles: [],
        combinedDiff: '',
        omittedFiles: [],
        issues: [],
        reviewSummary: '',
        ragPromptSection: '',
        practicesPromptSection: '',
        detectedEcosystems: params.detectedEcosystems,
        promptConfig: {
            activeConditionIds: params.pipelineConfig.activeConditionIds,
            filePaths: [],
            overrideSmartDetection: params.pipelineConfig.overrideSmartDetection,
        },
        tokenUsage: null,
        cascade: INITIAL_CASCADE_STATE,
        cascadeConfig: resolveCascadeConfig(params.pipelineConfig.cascade),
        prescanConfig: resolvePrescanConfig(params.pipelineConfig.prescan),
        prescanIssues: [],
        prescanStats: null,
        llmSkipped: false,
        shouldAbort: false,
    };
}

// =============================================================================
// Shared Helpers
// =============================================================================

/** Die für Auth und Pipeline-Config relevanten Felder einer repositories-Zeile. */
interface WorkerRepoRow {
    readonly id: string;
    readonly installationId: number | null;
    readonly pipelineConfig: unknown;
    /** null = Ökosystem-Erkennung ist für dieses Repo noch nie gelaufen. */
    readonly detectedEcosystems: readonly string[] | null;
}

/**
 * Validiert detected_ecosystems strukturell an der Systemgrenze [ARCH-002].
 * Alles außer einem String-Array wird zu null (= Fallback: ungefilterter
 * Law-Block, keine Practices) — nie zu einem geratenen Wert.
 */
function parseDetectedEcosystems(rawEcosystems: unknown): readonly string[] | null {
    const isStringArray = Array.isArray(rawEcosystems)
        && rawEcosystems.every((ecosystemKey: unknown) => typeof ecosystemKey === 'string');
    return isStringArray ? rawEcosystems as string[] : null;
}

/**
 * Lädt die Repo-Zeile des Jobs — bevorzugt über review_jobs.repository_id.
 *
 * Beide Pfade filtern zwingend nach user_id [DATA-001]: `full_name` ist NICHT
 * eindeutig (zwei User dürfen dasselbe Repo verbinden), und eine fremde Zeile
 * hieße hier, mit der installation_id eines anderen Tenants zu authentifizieren.
 *
 * Ein DB-Fehler wirft, statt still `null` zu liefern: mit `installation_id =
 * null` würde die Auth-Auflösung sonst heimlich auf das User-Token zurückfallen.
 */
async function loadRepoRow(
    repositoryId: string | null,
    repoFullName: string,
    ownerUserId: string,
): Promise<WorkerRepoRow | null> {
    const repoQuery = supabase
        .from('repositories')
        .select('id, pipeline_config, installation_id, detected_ecosystems')
        .eq('user_id', ownerUserId);

    const { data: repoRow, error: repoLookupError } = repositoryId
        ? await repoQuery.eq('id', repositoryId).maybeSingle()
        : await repoQuery.eq('full_name', repoFullName).limit(1).maybeSingle();

    if (repoLookupError) {
        console.error(`[PRWorker] Repo-Lookup für ${repoFullName} fehlgeschlagen:`, repoLookupError);
        throw new Error(`Repository-Lookup fehlgeschlagen: ${repoLookupError.message}`);
    }

    if (!repoRow) {
        return null;
    }

    return {
        id: repoRow.id,
        installationId: repoRow.installation_id,
        pipelineConfig: repoRow.pipeline_config,
        detectedEcosystems: parseDetectedEcosystems(repoRow.detected_ecosystems),
    };
}

/**
 * Schließt den Check Run eines erfolgreich gelaufenen Jobs ab (D12).
 *
 * Der Abschluss liegt hier und NICHT in einem Pipeline-Step:
 *  - der github-reporter ist per pipeline_config abschaltbar; läge der Abschluss
 *    dort, bliebe der Check bei deaktiviertem Reporter für immer in
 *    'in_progress' und würde einen `required check` dauerhaft blockieren.
 *  - der ResultPersister ist zu diesem Zeitpunkt gelaufen: ein GitHub-Fehler
 *    beim Schließen darf das bereits gepostete und persistierte Review nicht
 *    nachträglich auf 'error' kippen. Deshalb best effort mit lautem Log.
 */
async function closeCheckRun(
    installationId: number | null,
    checkRunId: number | null,
    finalContext: PipelineContext,
): Promise<void> {
    if (installationId === null || checkRunId === null) {
        return;
    }

    const checkRunResult: CheckRunResult = finalContext.shouldAbort
        ? {
            conclusion: 'neutral',
            title: 'Nothing to review',
            summary: finalContext.abortReason ?? 'No reviewable files in this pull request.',
        }
        : deriveReviewConclusion(collectReportableIssues(finalContext), {
            integrityScore: finalContext.cascade.integrityScore,
            minIntegrityScore: finalContext.cascadeConfig.minIntegrityScore,
        });

    try {
        const installationToken = await getInstallationToken(installationId);
        await completeGatekeeperCheckRun(
            installationToken,
            finalContext.repoFullName,
            checkRunId,
            checkRunResult,
        );
    } catch (checkRunError: unknown) {
        console.error(
            `[PRWorker] Check Run ${checkRunId} für ${finalContext.repoFullName} konnte nicht `
            + `abgeschlossen werden (Review ist gepostet und persistiert): `
            + extractErrorMessage(checkRunError),
        );
    }
}

/**
 * Öffentlich am PR sichtbare Check-Texte je Fehlercode (ROADMAP §15): nie der
 * rohe Fehlertext, aber ehrlich genug, dass der Autor weiß, ob ein Re-run
 * reicht. `model_unavailable` = Vertex-Kapazität/5xx nach allen Retries.
 */
const FAILED_CHECK_RUN_COPY: Readonly<Record<JobFailureCode, CheckRunResult>> = {
    model_unavailable: {
        conclusion: 'failure',
        title: 'Review failed: AI model temporarily unavailable',
        summary: 'The AI model provider was temporarily out of capacity, and retries did not succeed. '
            + 'Nothing is wrong with this pull request or the repository connection — re-run this check in a minute.',
    },
    server_error: {
        conclusion: 'failure',
        title: 'Review failed',
        summary: 'The Anti-Slop Gatekeeper could not complete this review due to an internal error. '
            + 'The details are recorded in the server logs.',
    },
};

/**
 * Schließt den Check Run eines gescheiterten Jobs mit 'failure' ab.
 *
 * Ohne das bliebe der Check ewig in 'in_progress' hängen und würde einen als
 * `required` konfigurierten Check dauerhaft blockieren. Scheitert auch das
 * (z.B. weil genau das Installation-Token die Ursache war), bleibt nur der
 * strukturierte Log — der Job-Status steht zu diesem Zeitpunkt bereits auf 'error'.
 */
async function failCheckRun(
    installationId: number | null,
    checkRunId: number | null,
    repoFullName: string,
    failureCode: JobFailureCode,
): Promise<void> {
    if (installationId === null || checkRunId === null) {
        return;
    }

    try {
        const installationToken = await getInstallationToken(installationId);
        // Die Summary ist öffentlich am PR sichtbar (ROADMAP §15). Der rohe
        // Fehlertext wird bewusst NICHT interpoliert: er kann eine Vorschau der
        // Modellantwort tragen, die der PR-Autor über den Diff mitbestimmt.
        // Der Detailtext steht bereits im strukturierten Log des Worker-Catch.
        await completeGatekeeperCheckRun(
            installationToken, repoFullName, checkRunId, FAILED_CHECK_RUN_COPY[failureCode],
        );
    } catch (checkRunError: unknown) {
        console.error(
            `[PRWorker] Check Run ${checkRunId} für ${repoFullName} konnte nicht auf 'failure' `
            + `gesetzt werden: ${extractErrorMessage(checkRunError)}`,
        );
    }
}

/**
 * Setzt einen Job auf 'error' mit einer Fehlermeldung.
 */
async function markJobError(jobId: string, errorMessage: string): Promise<void> {
    await supabase
        .from('review_jobs')
        .update({
            status: 'error',
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
}

/**
 * Validiert und parst eine pipeline_config aus der DB (JSONB).
 * Gibt null zurück wenn die Struktur ungültig ist (Fallback auf Default).
 */
function parsePipelineConfig(rawConfig: unknown): PipelineConfig | null {
    if (!rawConfig || typeof rawConfig !== 'object') return null;

    const candidate = rawConfig as Record<string, unknown>;

    const hasEnabledSteps = Array.isArray(candidate.enabledStepIds)
        && candidate.enabledStepIds.every((stepId: unknown) => typeof stepId === 'string');

    const hasActiveConditions = Array.isArray(candidate.activeConditionIds)
        && candidate.activeConditionIds.every((condId: unknown) => typeof condId === 'string');

    const hasOverrideFlag = typeof candidate.overrideSmartDetection === 'boolean';

    if (!hasEnabledSteps || !hasActiveConditions || !hasOverrideFlag) {
        console.warn('[Worker] Ungültige pipeline_config in DB, verwende Default:', rawConfig);
        return null;
    }

    // cascade-/prescan-Blöcke werden nur strukturell durchgereicht — die Feld-
    // Validierung (Fallback auf Defaults) machen resolveCascadeConfig bzw.
    // resolvePrescanConfig.
    const cascadeOverrides = candidate.cascade && typeof candidate.cascade === 'object'
        ? candidate.cascade as Partial<CascadeConfig>
        : undefined;

    return {
        enabledStepIds: candidate.enabledStepIds as string[],
        activeConditionIds: candidate.activeConditionIds as string[],
        overrideSmartDetection: candidate.overrideSmartDetection as boolean,
        cascade: cascadeOverrides,
        prescan: candidate.prescan,
    };
}
