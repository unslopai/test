/**
 * Shared Pipeline Utilities.
 *
 * Enthält Hilfsfunktionen die von mehreren Pipeline-Steps genutzt werden.
 * Extrahiert aus dem ehemaligen monolithischen worker.ts.
 */
import { extractErrorMessage } from '@/lib/errors';
import { parseHunkRanges, isLineWithinHunks } from '@/lib/pipeline/diff-utils';
import type { PullRequestFile, PullRequestReviewComment } from '@/lib/github';
import type { PipelineIssue, TokenUsage } from '@/lib/pipeline/types';

// =============================================================================
// Token Telemetry
// =============================================================================

/** Minimale strukturelle Sicht auf Gemini usageMetadata (alle Felder optional). */
interface GeminiUsageMetadata {
    promptTokenCount?: number;
    cachedContentTokenCount?: number;
    candidatesTokenCount?: number;
}

/** Extrahiert die Token-Zähler eines Gemini-Calls in das interne TokenUsage-Format. */
export function extractTokenUsage(
    usageMetadata: GeminiUsageMetadata | undefined,
    model: string,
): TokenUsage {
    return {
        promptTokens: usageMetadata?.promptTokenCount ?? 0,
        cachedTokens: usageMetadata?.cachedContentTokenCount ?? 0,
        outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
        model,
    };
}

// =============================================================================
// JSON Parsing
// =============================================================================

/**
 * Parst eine LLM-Modellantwort als JSON mit strukturierten Fehlermeldungen.
 *
 * @param rawText - Der rohe Text der Modellantwort
 * @param context - Kontext-Label für die Fehlermeldung (z.B. 'Reviewer')
 * @returns Das geparste Objekt
 * @throws Error wenn der Text leer oder kein valides JSON ist
 */
export function parseModelJson<T>(rawText: string, context: string): T {
    const trimmedText = rawText.trim();
    if (!trimmedText) {
        throw new Error(`[${context}] Modellantwort ist leer.`);
    }

    try {
        return JSON.parse(trimmedText) as T;
    } catch (parseError: unknown) {
        const responsePreview = trimmedText.substring(0, 500);
        throw new Error(
            `[${context}] Modellantwort ist kein gültiges JSON: ${extractErrorMessage(parseError)}. ` +
            `Response-Preview: ${responsePreview}`,
        );
    }
}

// =============================================================================
// File Filtering
// =============================================================================

const REVIEWABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

const IGNORED_PATHS = [
    'node_modules/', 'package-lock.json', '.next/',
    '.git/', 'dist/', 'build/', '.env',
];

/**
 * Prüft ob eine Datei reviewbar ist (Code-Dateien, keine Binärdateien/Configs).
 */
export function isReviewableFile(filename: string): boolean {
    if (IGNORED_PATHS.some((ignoredPath) => filename.includes(ignoredPath))) {
        return false;
    }
    return REVIEWABLE_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

// =============================================================================
// Diff Building
// =============================================================================

/**
 * Baut den kombinierten Diff-String für den Reviewer zusammen.
 * Jede Datei wird mit einem Header markiert, gefolgt vom Patch.
 */
export function buildCombinedDiff(files: readonly PullRequestFile[]): string {
    return files
        .map((file) => `=== FILE: ${file.filename} (${file.status}) ===\n${file.patch ?? ''}`)
        .join('\n\n');
}

// =============================================================================
// GitHub Comment Formatting
// =============================================================================

export interface PartitionedIssues {
    /** Issues, deren Zeilen in einem Diff-Hunk liegen — als Inline-Comment postbar. */
    readonly anchoredIssues: readonly PipelineIssue[];
    /** Issues außerhalb aller Hunks (LLM-Halluzination der Zeilennummer) — nur im Body. */
    readonly unanchoredIssues: readonly PipelineIssue[];
}

/**
 * Teilt Issues danach, ob GitHub sie als Inline-Comment akzeptieren würde:
 * die Datei muss im PR sein UND die Zeile(n) innerhalb eines Diff-Hunks liegen.
 * Ein einziger Out-of-Hunk-Comment lässt GitHub sonst den GESAMTEN Review ablehnen.
 */
export function partitionIssuesByAnchor(
    issues: readonly PipelineIssue[],
    prFiles: readonly PullRequestFile[],
): PartitionedIssues {
    const hunksByFile = new Map(
        prFiles.map((file) => [file.filename, parseHunkRanges(file.patch ?? '')]),
    );

    const anchoredIssues: PipelineIssue[] = [];
    const unanchoredIssues: PipelineIssue[] = [];

    for (const issue of issues) {
        const fileHunks = hunksByFile.get(issue.path);
        const isAnchored = fileHunks !== undefined
            && isLineWithinHunks(issue.line, fileHunks)
            && isLineWithinHunks(issue.endLine, fileHunks);

        (isAnchored ? anchoredIssues : unanchoredIssues).push(issue);
    }

    return { anchoredIssues, unanchoredIssues };
}

/**
 * Konvertiert verankerte PipelineIssues in GitHub PR Inline-Comments.
 * Erwartet bereits via partitionIssuesByAnchor validierte Issues.
 */
export function buildInlineComments(
    anchoredIssues: readonly PipelineIssue[],
): PullRequestReviewComment[] {
    return anchoredIssues.map((issue) => mapIssueToPrComment(issue));
}

function mapIssueToPrComment(issue: PipelineIssue): PullRequestReviewComment {
    const severityIcon = issue.severity === 'CRITICAL' ? '\uD83D\uDEA8' : '\u26A0\uFE0F';

    const commentBodyParts = [
        `${severityIcon} **${issue.rule}** (${issue.severity})`,
        '',
        issue.critique,
    ];

    if (issue.fixedCodeSnippet) {
        commentBodyParts.push(
            '',
            '\uD83D\uDCA1 **Suggested fix** (1-click commit):',
            '```suggestion',
            issue.fixedCodeSnippet,
            '```',
        );
    }

    const isMultiLine = issue.endLine > issue.line;

    const prComment: PullRequestReviewComment = {
        path: issue.path,
        line: isMultiLine ? issue.endLine : issue.line,
        side: 'RIGHT',
        body: commentBodyParts.join('\n'),
    };

    if (isMultiLine) {
        prComment.start_line = issue.line;
        prComment.start_side = 'RIGHT';
    }

    return prComment;
}

/**
 * Formatiert die Review-Zusammenfassung als Markdown für den PR-Body.
 * Unverankerte Findings erscheinen NUR hier (sie können nicht inline gepostet
 * werden); ausgelassene Dateien werden als "not reviewed" ausgewiesen.
 */
export function formatReviewSummary(
    issues: readonly PipelineIssue[],
    summaryText: string,
    unanchoredIssues: readonly PipelineIssue[] = [],
    omittedFiles: readonly string[] = [],
): string {
    const criticalCount = issues.filter((issue) => issue.severity === 'CRITICAL').length;
    const warningCount = issues.filter((issue) => issue.severity === 'WARNING').length;

    const markdownLines = [
        '## \uD83D\uDEE1\uFE0F Anti-Slop Gatekeeper Review',
        '',
        `**Result:** ${issues.length} issue(s) found`,
        '',
    ];

    if (criticalCount > 0) {
        markdownLines.push(`- \uD83D\uDEA8 **${criticalCount} CRITICAL**`);
    }
    if (warningCount > 0) {
        markdownLines.push(`- \u26A0\uFE0F **${warningCount} WARNING**`);
    }

    markdownLines.push('', '---', '', `**Summary:** ${summaryText}`);

    if (unanchoredIssues.length > 0) {
        markdownLines.push('', '### Findings outside the diff (no inline anchor)', '');
        for (const issue of unanchoredIssues) {
            const severityIcon = issue.severity === 'CRITICAL' ? '🚨' : '⚠️';
            markdownLines.push(
                `- ${severityIcon} **${issue.rule}** — \`${issue.path}:${issue.line}\` — ${issue.critique}`,
            );
        }
    }

    if (omittedFiles.length > 0) {
        markdownLines.push('', '### Not reviewed (size cap exceeded)', '');
        for (const omittedFile of omittedFiles) {
            markdownLines.push(`- \`${omittedFile}\``);
        }
    }

    return markdownLines.join('\n');
}
