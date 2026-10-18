/**
 * Diff-Utilities — Hunk-Analyse und deterministisches Trimming (SPEC.md §4.3).
 *
 * INVARIANTE: Hinzugefügte ('+')-Zeilen werden NIEMALS inhaltlich verändert.
 * Trimming droppt ausschließlich ganze Dateien oder reine Metadaten-Zeilen —
 * exactQuote muss sowohl zum Prompt-Inhalt als auch zur echten Datei passen
 * (Anker für GitHub-Suggestions und den IDE-Apply-Contract).
 */
import type { PullRequestFile } from '@/lib/github';

// =============================================================================
// Hunk-Analyse (für Inline-Comment-Validierung)
// =============================================================================

/** Zeilenbereich eines Hunks in der NEUEN Dateiversion (1-basiert, inklusiv). */
export interface HunkRange {
    readonly newStart: number;
    readonly newEnd: number;
}

const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/**
 * Extrahiert die Zeilenbereiche (neue Dateiseite) aller Hunks eines Patches.
 * GitHub akzeptiert Inline-Comments nur auf Zeilen innerhalb dieser Bereiche.
 */
export function parseHunkRanges(patch: string): HunkRange[] {
    const hunkRanges: HunkRange[] = [];

    for (const patchLine of patch.split('\n')) {
        const headerMatch = HUNK_HEADER_PATTERN.exec(patchLine);
        if (!headerMatch) continue;

        const newStart = Number.parseInt(headerMatch[1], 10);
        const newLineCount = headerMatch[2] !== undefined ? Number.parseInt(headerMatch[2], 10) : 1;
        hunkRanges.push({ newStart, newEnd: newStart + Math.max(0, newLineCount - 1) });
    }

    return hunkRanges;
}

/** Prüft ob eine Zeilennummer (neue Dateiseite) innerhalb eines Hunks liegt. */
export function isLineWithinHunks(lineNumber: number, hunkRanges: readonly HunkRange[]): boolean {
    return hunkRanges.some((hunk) => lineNumber >= hunk.newStart && lineNumber <= hunk.newEnd);
}

// =============================================================================
// Deterministisches Trimming (kein LLM, keine Inhaltsänderung)
// =============================================================================

const MAX_PATCH_BYTES_PER_FILE = 40 * 1024;
const MAX_TOTAL_DIFF_BYTES = 300 * 1024;

/** Reine Diff-Metadaten, die dem Reviewer nichts sagen und Tokens kosten. */
const METADATA_LINE_PATTERN = /^(index [0-9a-f]+\.\.[0-9a-f]+|similarity index |dissimilarity index |old mode |new mode |Binary files )/;

export interface TrimmedDiff {
    readonly trimmedFiles: readonly PullRequestFile[];
    /** Dateien, die wegen Größen-Caps NICHT reviewt werden (für den Summary-Hinweis). */
    readonly omittedFilePaths: readonly string[];
}

/**
 * Wendet die Größen-Caps an: pro Datei 40 KB, gesamt 300 KB.
 * Übergroße Dateien werden komplett ausgelassen (nie gekürzt — eine halbe
 * Datei würde exactQuote-Anker und Zeilennummern unbrauchbar machen).
 * Reihenfolge bleibt stabil; Metadaten-Zeilen werden aus Patches entfernt.
 */
export function trimReviewableFiles(reviewableFiles: readonly PullRequestFile[]): TrimmedDiff {
    const trimmedFiles: PullRequestFile[] = [];
    const omittedFilePaths: string[] = [];
    let totalBytes = 0;

    for (const file of reviewableFiles) {
        const cleanedPatch = stripMetadataLines(file.patch ?? '');
        const patchBytes = Buffer.byteLength(cleanedPatch, 'utf-8');

        if (patchBytes > MAX_PATCH_BYTES_PER_FILE || totalBytes + patchBytes > MAX_TOTAL_DIFF_BYTES) {
            omittedFilePaths.push(file.filename);
            continue;
        }

        totalBytes += patchBytes;
        trimmedFiles.push({ ...file, patch: cleanedPatch });
    }

    return { trimmedFiles, omittedFilePaths };
}

/** Entfernt reine Metadaten-Zeilen; +/-/Kontext/@@-Zeilen bleiben unangetastet. */
function stripMetadataLines(patch: string): string {
    return patch
        .split('\n')
        .filter((patchLine) => !METADATA_LINE_PATTERN.test(patchLine))
        .join('\n');
}
