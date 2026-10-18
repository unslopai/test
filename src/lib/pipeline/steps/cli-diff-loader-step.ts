/**
 * CliDiffLoaderStep — Lädt den Diff aus dem Job-Payload statt von GitHub.
 *
 * CLI-Scans laden einen lokal erzeugten `git diff` (LF-normalisiert) hoch.
 * Dieser Step parst ihn in das PullRequestFile-Format, filtert reviewbare
 * Dateien und baut den combinedDiff im selben `=== FILE: ... ===`-Format
 * wie der GitHub-DiffLoader — alles Nachgelagerte bleibt unverändert.
 */
import { supabase } from '@/lib/supabase';
import { isReviewableFile, buildCombinedDiff } from '@/lib/pipeline/helpers';
import { trimReviewableFiles } from '@/lib/pipeline/diff-utils';
import { planUnreviewableDiff } from '@/lib/pipeline/review-scope';
import { redactSecretsInFiles } from '@/lib/pipeline/secret-redaction';
import { parseUnifiedDiffFiles, parseUploadedContextPackage, summarizeRepoContext } from '@unslop/shared/repo-context';
import type { PullRequestFile } from '@/lib/github';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

export const cliDiffLoaderStep: PipelineStep = {
    id: 'cli-diff-loader',
    displayName: 'CLI Diff Loader',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) return context;

        const { data: jobRow, error: jobError } = await supabase
            .from('review_jobs')
            .select('id, payload')
            .eq('id', context.jobId)
            .single();

        if (jobError || !jobRow) {
            throw new Error(`CLI-Job ${context.jobId} konnte nicht geladen werden: ${jobError?.message}`);
        }

        const jobPayload = readJobPayload(jobRow.payload);
        // Fehlt bei alten Clients; null = schon geladen und aus dem Payload entfernt.
        const uploadedContextPackage = jobPayload.context_package ?? undefined;
        // Vor jedem Früh-Return und unabhängig vom Repo-Kontext-Schalter: der
        // Paket-Inhalt liegt ab hier nur noch im Arbeitsspeicher dieses Jobs.
        if (uploadedContextPackage !== undefined) {
            await removeUploadedPackageFromPayload(context.jobId, jobPayload, uploadedContextPackage);
        }
        const uploadedDiff = jobPayload.diff;
        if (typeof uploadedDiff !== 'string' || uploadedDiff.length === 0) {
            throw new Error(`CLI-Job ${context.jobId} enthält keinen Diff im Payload.`);
        }

        const parsedFiles = parseUnifiedDiff(uploadedDiff);
        const candidateFiles = parsedFiles.filter(
            (file) => isReviewableFile(file.filename, context.reviewScopeConfig.llmExtensions),
        );
        const { trimmedFiles, omittedFilePaths } = trimReviewableFiles(candidateFiles);
        // Die Clients verweigern den Upload bei einem Treffer; der Server verlässt sich nicht darauf.
        const { redactedFiles: reviewableFiles, secretRedactions } = redactSecretsInFiles(trimmedFiles);

        if (reviewableFiles.length === 0) {
            return {
                ...context,
                prFiles: parsedFiles,
                omittedFiles: omittedFilePaths,
                uploadedContextPackage,
                ...planUnreviewableDiff({
                    changedFiles: parsedFiles, omittedFilePaths, surface: 'local_diff',
                }),
            };
        }

        console.log(
            `[CliDiffLoader] ${reviewableFiles.length}/${parsedFiles.length} Dateien reviewbar, ` +
            `${omittedFilePaths.length} wegen Größen-Cap ausgelassen.`,
        );

        return {
            ...context,
            prFiles: parsedFiles,
            reviewableFiles,
            combinedDiff: buildCombinedDiff(reviewableFiles),
            secretRedactions,
            uploadedContextPackage,
            omittedFiles: omittedFilePaths,
            promptConfig: {
                ...context.promptConfig,
                filePaths: reviewableFiles.map((file) => file.filename),
            },
        };
    },
};

// =============================================================================
// Job-Payload
// =============================================================================

/** Strukturelle Sicht auf `review_jobs.payload` [ARCH-002]: ein Objekt, sonst der leere Payload. */
function readJobPayload(rawPayload: unknown): Record<string, unknown> {
    const isPayloadObject = rawPayload !== null && typeof rawPayload === 'object' && !Array.isArray(rawPayload);
    return isPayloadObject ? Object.fromEntries(Object.entries(rawPayload)) : {};
}

/**
 * Ersetzt das hochgeladene Kontextpaket im Payload durch Pfadliste und Größe
 * (REPO_CONTEXT_SPEC §12 Frage 3), sobald der Job es gelesen hat. Bewusst hier
 * und ohne Bedingung: auch ein Job, der danach abbricht, nichts Reviewbares hat
 * oder dessen Repo den Kontext abgeschaltet hat, behält keinen Repo-Inhalt
 * jenseits des Diffs.
 *
 * Scheitert das Entfernen, läuft die Review weiter (das Paket ist geladen) und
 * der Fehler steht im Log: der Inhalt bleibt dann gespeichert, bis die Zeile
 * gelöscht wird.
 */
async function removeUploadedPackageFromPayload(
    jobId: string,
    jobPayload: Record<string, unknown>,
    uploadedContextPackage: unknown,
): Promise<void> {
    const parsedPackage = parseUploadedContextPackage(uploadedContextPackage);
    const { data: updatedRows, error: payloadWriteError } = await supabase
        .from('review_jobs')
        .update({
            payload: {
                ...jobPayload,
                context_package: null,
                context_package_summary: parsedPackage ? summarizeRepoContext(parsedPackage) : null,
            },
        })
        .eq('id', jobId)
        .select('id');
    if (payloadWriteError || (updatedRows ?? []).length === 0) {
        console.error(
            `[CliDiffLoader] Kontextpaket von Job ${jobId} nicht aus dem Payload entfernt — der Inhalt bleibt `
            + `gespeichert: ${payloadWriteError?.message ?? 'keine Zeile aktualisiert'}`,
        );
    }
}

// =============================================================================
// Unified-Diff Parsing (git diff Ausgabe)
// =============================================================================

/**
 * Parst eine `git diff`-Ausgabe in PullRequestFile-Objekte.
 * Pro Datei: Pfad (b-Seite; a-Seite bei Löschungen), Status und Hunk-Inhalt.
 * Ohne Hunk (Binärdatei, reine Modus-Änderung) bleibt `patch` undefined, wie
 * bei der GitHub-API: dann zählt die Datei weder für den Pre-Scan noch für den
 * Hinweis auf ungelesene Dateitypen.
 *
 * Der Parser selbst lebt in `@unslop/shared/repo-context`: die Clients lesen
 * aus demselben Diff die geänderten Dateien für das Kontextpaket.
 */
export function parseUnifiedDiff(rawDiff: string): PullRequestFile[] {
    return parseUnifiedDiffFiles(rawDiff).map((diffFile) => ({ sha: '', changes: 0, ...diffFile }));
}
