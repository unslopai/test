/**
 * Worker-Logik für die Anti-Slop Review Pipeline.
 *
 * Unterstützt zwei Modi:
 * 1. Manueller Review (processJob): Raw-Code direkt analysieren (prozedural)
 * 2. PR-Review (processReviewJob): Pipeline-basierter PR-Review mit konfigurierbaren Steps
 */
import { supabase } from '@/lib/supabase';
import { getVertexClient } from '@/lib/vertex';
import { extractErrorMessage } from '@/lib/errors';
import { decryptToken } from '@/lib/crypto';
import { ALL_CONDITION_IDS } from '@/lib/pipeline/conditions';
import { buildPrompt } from '@/lib/pipeline/prompt-builder';
import { parseModelJson, extractTokenUsage } from '@/lib/pipeline/helpers';
import { runPipeline } from '@/lib/pipeline/runner';
import { DEFAULT_PIPELINE_CONFIG } from '@/lib/pipeline/defaults';
import { diffLoaderStep } from '@/lib/pipeline/steps/diff-loader-step';
import { cliDiffLoaderStep } from '@/lib/pipeline/steps/cli-diff-loader-step';
import { ragLoaderStep } from '@/lib/pipeline/steps/rag-loader-step';
import { aiReviewerStep } from '@/lib/pipeline/steps/ai-reviewer-step';
import { githubReporterStep } from '@/lib/pipeline/steps/github-reporter-step';
import { resultPersisterStep } from '@/lib/pipeline/steps/result-persister-step';
import type { PipelineContext, PipelineStep, PipelineConfig, TokenUsage } from '@/lib/pipeline/types';

// =============================================================================
// Interfaces (Raw-Code Review)
// =============================================================================

interface ReviewIssue {
    rule: string;
    severity: 'CRITICAL' | 'WARNING';
    start_line: number;
    end_line: number;
    exact_quote: string;
    critique: string;
}

interface ReviewerOutput {
    has_slop: boolean;
    issues: ReviewIssue[];
    summary: string;
}

interface JobPayload {
    code?: string;
    filename?: string;
    language?: string;
    repo_full_name?: string;
    pr_number?: number;
    pr_url?: string;
    pr_head_sha?: string;
    action?: string;
    [key: string]: unknown;
}

// =============================================================================
// Step Registry
// =============================================================================

const STEP_REGISTRY: ReadonlyMap<string, PipelineStep> = new Map([
    [diffLoaderStep.id, diffLoaderStep],
    [cliDiffLoaderStep.id, cliDiffLoaderStep],
    [ragLoaderStep.id, ragLoaderStep],
    [aiReviewerStep.id, aiReviewerStep],
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
    ragLoaderStep,
    aiReviewerStep,
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
// Raw-Code Reviewer & Fixer (für processJob)
// =============================================================================

/**
 * Führt den Anti-Slop Reviewer auf Raw-Code aus.
 * Nutzt den modularen PromptBuilder für dynamische Prompt-Komposition.
 */
async function runReviewer(
    code: string,
    filename?: string,
): Promise<{ review: ReviewerOutput; usage: TokenUsage }> {
    const reviewerModel = 'gemini-2.5-flash';
    const ai = getVertexClient();

    const numberedCode = code
        .split('\n')
        .map((line, lineIndex) => `${lineIndex + 1}: ${line}`)
        .join('\n');

    const userPrompt = filename
        ? `File: ${filename}\n\n${numberedCode}`
        : numberedCode;

    const systemPrompt = buildPrompt('reviewer_raw', {
        activeConditionIds: ALL_CONDITION_IDS,
        filePaths: filename ? [filename] : [],
        overrideSmartDetection: false,
    });

    const response = await ai.models.generateContent({
        model: reviewerModel,
        contents: userPrompt,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
        },
    });

    const rawResponseText = response.text ?? '';
    console.log('[Reviewer] Raw Response:', rawResponseText.substring(0, 500));

    return {
        review: parseModelJson<ReviewerOutput>(rawResponseText, 'Reviewer'),
        usage: extractTokenUsage(response.usageMetadata, reviewerModel),
    };
}

/**
 * Führt den Slop-Fixer auf Code aus, der Probleme hat.
 * Der Fixer-Prompt ist statisch (keine Conditions).
 */
async function runFixer(
    code: string,
    critique: ReviewerOutput,
): Promise<{ fixedCode: string; usage: TokenUsage }> {
    const fixerModel = 'gemini-2.5-flash';
    const ai = getVertexClient();

    const userPrompt = `CRITIQUE_JSON:\n${JSON.stringify(critique.issues, null, 2)}\n\nORIGINAL_CODE:\n${code}`;

    const fixerPrompt = buildPrompt('fixer', {
        activeConditionIds: [],
        filePaths: [],
        overrideSmartDetection: false,
    });

    const response = await ai.models.generateContent({
        model: fixerModel,
        contents: userPrompt,
        config: {
            systemInstruction: fixerPrompt,
        },
    });

    const fixedCode = response.text ?? '';
    console.log('[Fixer] Output length:', fixedCode.length, 'chars');
    return { fixedCode, usage: extractTokenUsage(response.usageMetadata, fixerModel) };
}

/** Summiert die Token-Zähler mehrerer LLM-Calls eines Jobs. */
function sumTokenUsage(usages: readonly TokenUsage[]): TokenUsage | null {
    if (usages.length === 0) return null;

    return usages.reduce((total, usage) => ({
        promptTokens: total.promptTokens + usage.promptTokens,
        cachedTokens: total.cachedTokens + usage.cachedTokens,
        outputTokens: total.outputTokens + usage.outputTokens,
        model: usage.model,
    }));
}

// =============================================================================
// Job Processors
// =============================================================================

/**
 * Verarbeitet einen manuellen Review-Job (Raw-Code).
 * Prozeduraler Flow — kein Pipeline-Kontext nötig.
 */
export async function processJob(jobId: string) {
    console.log(`[Worker] Starte Job ${jobId}...`);

    const { data: job, error: fetchError } = await supabase
        .from('review_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('status', 'pending')
        .select()
        .single();

    if (fetchError || !job) {
        console.error(`[Worker] Job ${jobId} nicht gefunden oder bereits verarbeitet:`, fetchError);
        return;
    }

    const payload = job.payload as JobPayload;

    if (!payload.code) {
        await markJobError(jobId, 'Payload enthält keinen "code" Schlüssel.');
        return;
    }

    try {
        console.log(`[Worker] Job ${jobId} — Starte Reviewer...`);
        const { review: reviewResult, usage: reviewerUsage } = await runReviewer(payload.code, payload.filename);
        console.log(`[Worker] Job ${jobId} — Reviewer fertig: ${reviewResult.issues.length} Issues, has_slop: ${reviewResult.has_slop}`);

        let fixedCode: string | null = null;
        const llmUsages: TokenUsage[] = [reviewerUsage];

        if (reviewResult.has_slop && reviewResult.issues.length > 0) {
            console.log(`[Worker] Job ${jobId} — Starte Fixer...`);
            const fixerRun = await runFixer(payload.code, reviewResult);
            fixedCode = fixerRun.fixedCode;
            llmUsages.push(fixerRun.usage);
            console.log(`[Worker] Job ${jobId} — Fixer fertig.`);
        } else {
            console.log(`[Worker] Job ${jobId} — Kein Slop gefunden, Fixer übersprungen.`);
        }

        const jobUsage = sumTokenUsage(llmUsages);

        await supabase
            .from('review_jobs')
            .update({
                status: 'done',
                result: { review: reviewResult, fixed_code: fixedCode },
                prompt_tokens: jobUsage?.promptTokens ?? null,
                cached_tokens: jobUsage?.cachedTokens ?? null,
                output_tokens: jobUsage?.outputTokens ?? null,
                model: jobUsage?.model ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);

        console.log(`[Worker] Job ${jobId} erfolgreich abgeschlossen.`);

    } catch (error: unknown) {
        console.error(`[Worker] Fehler bei Job ${jobId}:`, error);
        await markJobError(jobId, extractErrorMessage(error));
    }
}

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

    const { data: job, error: fetchError } = await supabase
        .from('review_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('status', 'pending')
        .select()
        .single();

    if (fetchError || !job) {
        console.error(`[PRWorker] Job ${jobId} nicht gefunden oder bereits verarbeitet:`, fetchError);
        return;
    }

    const payload = job.payload as JobPayload;
    const isCliJob = job.source === 'cli';
    const repoFullName = payload.repo_full_name;
    const prNumber = payload.pr_number;

    if (!repoFullName || (!prNumber && !isCliJob)) {
        await markJobError(jobId, 'Payload enthält kein repo_full_name oder pr_number.');
        return;
    }

    try {
        // CLI-Jobs sprechen nie mit der GitHub API — kein Token nötig.
        const githubToken = isCliJob ? '' : await resolveGithubToken(userId);

        const { data: repoRow } = await supabase
            .from('repositories')
            .select('id, pipeline_config')
            .eq('full_name', repoFullName)
            .single();

        const pipelineConfig = parsePipelineConfig(repoRow?.pipeline_config) ?? DEFAULT_PIPELINE_CONFIG;
        const steps = isCliJob ? [...CLI_PIPELINE_STEPS] : assembleSteps(pipelineConfig);

        const initialContext: PipelineContext = {
            jobId,
            repoFullName,
            prNumber: prNumber ?? 0,
            headSha: '',
            githubToken,
            repositoryId: repoRow?.id ?? null,
            prFiles: [],
            reviewableFiles: [],
            combinedDiff: '',
            omittedFiles: [],
            issues: [],
            reviewSummary: '',
            ragPromptSection: '',
            promptConfig: {
                activeConditionIds: pipelineConfig.activeConditionIds,
                filePaths: [],
                overrideSmartDetection: pipelineConfig.overrideSmartDetection,
            },
            tokenUsage: null,
            shouldAbort: false,
        };

        await runPipeline(initialContext, steps);
        console.log(`[PRWorker] Job ${jobId} erfolgreich abgeschlossen.`);

    } catch (error: unknown) {
        console.error(`[PRWorker] Fehler bei Job ${jobId}:`, error);
        await markJobError(jobId, extractErrorMessage(error));
    }
}

// =============================================================================
// Shared Helpers
// =============================================================================

/**
 * Entschlüsselt den GitHub Token eines Users aus der DB.
 * Exportiert für den Billing-Paused-Kommentar (Webhook-Gate).
 */
export async function resolveGithubToken(userId: string): Promise<string> {
    const { data: tokenRow, error: tokenError } = await supabase
        .from('github_tokens')
        .select('encrypted_token, token_iv, token_tag')
        .eq('user_id', userId)
        .single();

    if (tokenError || !tokenRow) {
        throw new Error('GitHub Token für diesen User nicht gefunden. Re-Login erforderlich.');
    }

    return decryptToken({
        encryptedToken: tokenRow.encrypted_token,
        iv: tokenRow.token_iv,
        tag: tokenRow.token_tag,
    });
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

    return {
        enabledStepIds: candidate.enabledStepIds as string[],
        activeConditionIds: candidate.activeConditionIds as string[],
        overrideSmartDetection: candidate.overrideSmartDetection as boolean,
    };
}
