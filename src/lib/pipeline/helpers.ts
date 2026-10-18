/**
 * Shared Pipeline Utilities.
 *
 * Enthält Hilfsfunktionen die von mehreren Pipeline-Steps genutzt werden.
 * Extrahiert aus dem ehemaligen monolithischen worker.ts.
 */
import { extractErrorMessage } from '@/lib/errors';
import type { PullRequestFile, PullRequestReviewComment } from '@/lib/github';
import type { PipelineIssue } from '@/lib/pipeline/types';

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

/**
 * Konvertiert PipelineIssues in GitHub PR Inline-Comments.
 * Filtert auf Dateien die tatsächlich im PR enthalten sind.
 */
export function buildInlineComments(
    issues: readonly PipelineIssue[],
    prFiles: readonly PullRequestFile[],
): PullRequestReviewComment[] {
    const prFileSet = new Set(prFiles.map((file) => file.filename));

    return issues
        .filter((issue) => prFileSet.has(issue.path))
        .map((issue) => mapIssueToPrComment(issue));
}

function mapIssueToPrComment(issue: PipelineIssue): PullRequestReviewComment {
    const severityIcon = issue.severity === 'KRITISCH' ? '\uD83D\uDEA8' : '\u26A0\uFE0F';

    const commentBodyParts = [
        `${severityIcon} **${issue.rule}** (${issue.severity})`,
        '',
        issue.germanCritique,
    ];

    if (issue.fixedCodeSnippet) {
        commentBodyParts.push(
            '',
            '\uD83D\uDCA1 **Fix-Vorschlag** (1-Click Commit):',
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
 */
export function formatReviewSummary(
    issues: readonly PipelineIssue[],
    summaryText: string,
): string {
    const kritischCount = issues.filter((issue) => issue.severity === 'KRITISCH').length;
    const warnungCount = issues.filter((issue) => issue.severity === 'WARNUNG').length;

    const markdownLines = [
        '## \uD83D\uDEE1\uFE0F Anti-Slop Gatekeeper Review',
        '',
        `**Ergebnis:** ${issues.length} Issue(s) gefunden`,
        '',
    ];

    if (kritischCount > 0) {
        markdownLines.push(`- \uD83D\uDEA8 **${kritischCount} KRITISCH**`);
    }
    if (warnungCount > 0) {
        markdownLines.push(`- \u26A0\uFE0F **${warnungCount} WARNUNG**`);
    }

    markdownLines.push('', '---', '', `**Zusammenfassung:** ${summaryText}`);

    return markdownLines.join('\n');
}
