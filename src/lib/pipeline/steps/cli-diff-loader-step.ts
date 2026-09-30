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

        const uploadedDiff = (jobRow.payload as { diff?: string }).diff;
        if (!uploadedDiff) {
            throw new Error(`CLI-Job ${context.jobId} enthält keinen Diff im Payload.`);
        }

        const parsedFiles = parseUnifiedDiff(uploadedDiff);
        const candidateFiles = parsedFiles.filter((file) => isReviewableFile(file.filename));
        const { trimmedFiles: reviewableFiles, omittedFilePaths } = trimReviewableFiles(candidateFiles);

        if (reviewableFiles.length === 0) {
            return {
                ...context,
                prFiles: parsedFiles,
                omittedFiles: omittedFilePaths,
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
            omittedFiles: omittedFilePaths,
            promptConfig: {
                ...context.promptConfig,
                filePaths: reviewableFiles.map((file) => file.filename),
            },
        };
    },
};

// =============================================================================
// Unified-Diff Parsing (git diff Ausgabe)
// =============================================================================

const DIFF_FILE_HEADER_PATTERN = /^diff --git a\/(.+?) b\/(.+)$/;

/**
 * Parst eine `git diff`-Ausgabe in PullRequestFile-Objekte.
 * Pro Datei: Pfad (b-Seite; a-Seite bei Löschungen), Status und Hunk-Inhalt.
 */
export function parseUnifiedDiff(rawDiff: string): PullRequestFile[] {
    const diffLines = rawDiff.split('\n');
    const parsedFiles: PullRequestFile[] = [];
    let currentFile: PullRequestFile | null = null;
    let currentPatchLines: string[] = [];

    const finalizeCurrentFile = (): void => {
        if (currentFile) {
            currentFile.patch = currentPatchLines.join('\n');
            parsedFiles.push(currentFile);
        }
        currentPatchLines = [];
    };

    for (const diffLine of diffLines) {
        const headerMatch = DIFF_FILE_HEADER_PATTERN.exec(diffLine);

        if (headerMatch) {
            finalizeCurrentFile();
            currentFile = {
                sha: '',
                filename: headerMatch[2],
                status: 'modified',
                additions: 0,
                deletions: 0,
                changes: 0,
            };
            continue;
        }

        if (!currentFile) continue;

        if (diffLine.startsWith('new file mode')) {
            currentFile.status = 'added';
        } else if (diffLine.startsWith('deleted file mode')) {
            currentFile.status = 'removed';
        } else if (diffLine.startsWith('@@') || currentPatchLines.length > 0) {
            // Ab dem ersten Hunk-Header gehört alles zum Patch;
            // Metadaten-Zeilen davor (index, ---, +++) werden verworfen.
            currentPatchLines.push(diffLine);
            if (diffLine.startsWith('+') && !diffLine.startsWith('+++')) currentFile.additions++;
            if (diffLine.startsWith('-') && !diffLine.startsWith('---')) currentFile.deletions++;
        }
    }

    finalizeCurrentFile();
    return parsedFiles;
}
