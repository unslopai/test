/**
 * Datei-Batch-Chunking des Draft-Reviewers (LARGE_DIFF_RECALL_SPEC Option A,
 * Bau-Entscheid 2026-09-29: 20k-Batches, Spec §9).
 *
 * Reine Funktionen ohne I/O: Token-Schätzung, greedy Packen der
 * reviewableFiles in Diff-Reihenfolge und das Zuschneiden der
 * <already_flagged>-Tupel auf einen Batch. Die Orchestrierung (parallele
 * Reviewer-Pässe, Vereinigung, `draft_partial`) lebt im draft-reviewer-step.
 */
import { buildCombinedDiff } from '@/lib/pipeline/helpers';
import type { PullRequestFile } from '@/lib/github';
import type { PipelineIssue } from '@/lib/pipeline/types';

/** Grobe Token-Schätzung (chars/4) — dieselbe Heuristik wie der complexity-router (D12). */
const CHARS_PER_TOKEN_ESTIMATE = 4;

export interface DraftBatch {
    /** 0-basiert in Diff-Reihenfolge — für Logs; die Telemetrie kennt (noch) keinen chunk_index. */
    readonly batchIndex: number;
    readonly files: readonly PullRequestFile[];
    /** Diff-Text des Batches im Produktionsformat (`=== FILE: … ===`, helpers.ts). */
    readonly diffText: string;
    readonly estimatedTokens: number;
}

export function estimateDiffTokens(diffText: string): number {
    return Math.ceil(diffText.length / CHARS_PER_TOKEN_ESTIMATE);
}

/**
 * null = EIN Draft-Call wie bisher: der Diff liegt unter der Batch-Grenze,
 * oder das Packen ergäbe ohnehin nur einen Batch (eine überlange Datei, die
 * allein den Diff ausmacht). Sonst mindestens zwei Batches.
 */
export function resolveDraftBatches(
    reviewableFiles: readonly PullRequestFile[],
    combinedDiff: string,
    batchMaxTokens: number,
): readonly DraftBatch[] | null {
    if (estimateDiffTokens(combinedDiff) <= batchMaxTokens) return null;
    const draftBatches = packFilesIntoDraftBatches(reviewableFiles, batchMaxTokens);
    return draftBatches.length > 1 ? draftBatches : null;
}

/**
 * Greedy in Diff-Reihenfolge: eine Datei kommt in den offenen Batch, solange
 * dessen Schätzung die Grenze nicht reißt, sonst beginnt ein neuer. Eine
 * Datei über der Grenze steht allein — Dateien werden nie zerschnitten, weil
 * exactQuote-Anker und Zeilennummern am ganzen Patch hängen (diff-utils.ts).
 * Gezählt wird der Diff-Text inklusive `=== FILE: … ===`-Header, also das,
 * was der Prompt tatsächlich trägt.
 */
export function packFilesIntoDraftBatches(
    reviewableFiles: readonly PullRequestFile[],
    batchMaxTokens: number,
): DraftBatch[] {
    const packedBatches: PullRequestFile[][] = [];
    let openBatch: PullRequestFile[] = [];
    let openBatchTokens = 0;

    for (const reviewableFile of reviewableFiles) {
        const fileTokens = estimateDiffTokens(buildCombinedDiff([reviewableFile]));
        if (openBatch.length > 0 && openBatchTokens + fileTokens > batchMaxTokens) {
            packedBatches.push(openBatch);
            openBatch = [];
            openBatchTokens = 0;
        }
        openBatch.push(reviewableFile);
        openBatchTokens += fileTokens;
    }
    if (openBatch.length > 0) packedBatches.push(openBatch);

    return packedBatches.map((batchFiles, batchIndex) => toDraftBatch(batchFiles, batchIndex));
}

function toDraftBatch(batchFiles: readonly PullRequestFile[], batchIndex: number): DraftBatch {
    const diffText = buildCombinedDiff(batchFiles);
    return { batchIndex, files: batchFiles, diffText, estimatedTokens: estimateDiffTokens(diffText) };
}

/**
 * <already_flagged>-Tupel nur für die Dateien des Batches: Tupel fremder
 * Dateien wären für diesen Call Rauschen und könnten das Modell auf Pfade
 * verweisen, die es gar nicht sieht.
 */
export function selectPrescanIssuesForBatch(
    prescanIssues: readonly PipelineIssue[],
    batchFiles: readonly PullRequestFile[],
): PipelineIssue[] {
    const batchPaths = new Set(batchFiles.map((batchFile) => batchFile.filename));
    return prescanIssues.filter((prescanIssue) => batchPaths.has(prescanIssue.path));
}
