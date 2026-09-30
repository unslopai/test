/**
 * Shared Pipeline Utilities.
 *
 * Enthält Hilfsfunktionen die von mehreren Pipeline-Steps genutzt werden.
 * Extrahiert aus dem ehemaligen monolithischen worker.ts.
 */
import { createHash } from 'node:crypto';
import { formatOccurrenceLineRefs } from '@unslop/shared/occurrence-format';
import { AI_GENERATED_MARKER, AI_GENERATED_NOTICE, isAiGeneratedFinding } from '@/lib/ai-disclosure';
import { extractErrorMessage } from '@/lib/errors';
import { buildHunkRangesByFile, isLineWithinHunks } from '@/lib/pipeline/diff-utils';
import { normalizeBareRuleId, subtractPrescanOverlaps } from '@/lib/pipeline/finding-aggregation';
import { countHitsBySeverity } from '@/lib/pipeline/prescan-hit-cap';
import type { PullRequestFile, PullRequestReviewComment } from '@/lib/github';
import type { PipelineContext, PipelineIssue, TokenUsage } from '@/lib/pipeline/types';

export { normalizeBareRuleId };

// =============================================================================
// Prescan-Merge (pre_scanner_design.md §5.1)
// =============================================================================

/**
 * Merge-Punkt der beiden Issue-Lanes — Konsumenten: github-reporter,
 * result-persister, der Check-Run-Abschluss des Workers und die finale
 * Summary des Integrity-Scorers (zählt nur, SPEC.md §12.4 A12a). Verdicts
 * wenden Scorer und claim-verifier weiter NUR auf context.issues an
 * (PROC-001: deterministische Findings werden nie LLM-re-judged).
 *
 * Kollidiert ein LLM-Issue mit einem deterministischen Finding (gleiche Datei,
 * überlappender Zeilenbereich, gleiche Rule-ID im Rule-String), gewinnt das
 * deterministische Finding. Bei aggregierten LLM-Issues (ROADMAP §7) fällt
 * nur das kollidierende VORKOMMEN weg, nicht das ganze Aggregat
 * (subtractPrescanOverlaps in finding-aggregation.ts).
 */
export function collectReportableIssues(context: PipelineContext): PipelineIssue[] {
    const llmIssuesWithoutDuplicates = context.issues
        .map((llmIssue) => subtractPrescanOverlaps(llmIssue, context.prescanIssues))
        .filter((remainingIssue): remainingIssue is PipelineIssue => remainingIssue !== null);
    return assignFindingIds([...context.prescanIssues, ...llmIssuesWithoutDuplicates]);
}

// =============================================================================
// Stable Finding-IDs (MCP_SPEC.md §4.2)
// =============================================================================

/**
 * Vergibt die stabile 16-Zeichen-Finding-ID:
 * sha256(bareRuleId \0 path \0 exactQuote \0 occurrenceOrdinal).slice(0, 16).
 *
 * Zeilennummern fließen bewusst NICHT ein (Edits oberhalb eines Findings
 * verschieben jede Zeile darunter). occurrenceOrdinal ist 0-basiert in
 * Listen-Reihenfolge und disambiguiert identische Quotes in einer Datei.
 * Deterministisch — die Prescan-Lane bekommt im Partial (§4.1) und im
 * Endergebnis dieselben IDs, weil sie in beiden Listen vorne steht.
 */
export function assignFindingIds(issues: readonly PipelineIssue[]): PipelineIssue[] {
    const occurrenceCounters = new Map<string, number>();
    return issues.map((issue) => {
        const identityKey = `${normalizeBareRuleId(issue.rule)}\0${issue.path}\0${issue.exactQuote}`;
        const occurrenceOrdinal = occurrenceCounters.get(identityKey) ?? 0;
        occurrenceCounters.set(identityKey, occurrenceOrdinal + 1);
        const findingId = createHash('sha256')
            .update(`${identityKey}\0${occurrenceOrdinal}`)
            .digest('hex')
            .slice(0, 16);
        return { ...issue, id: findingId };
    });
}

// =============================================================================
// Token Telemetry
// =============================================================================

/** Minimale strukturelle Sicht auf Gemini usageMetadata (alle Felder optional). */
interface GeminiUsageMetadata {
    promptTokenCount?: number;
    cachedContentTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
}

/**
 * Extrahiert die Token-Zähler eines Gemini-Calls in das interne TokenUsage-Format.
 * outputTokens ist abrechnungstreu: Vertex berechnet Thinking-Tokens zum
 * Output-Preis, sie stehen aber NICHT in candidatesTokenCount, sondern separat
 * in thoughtsTokenCount (Befund 2026-09-03: bis dahin fehlten sie in jeder
 * Kostenrechnung — bei 3.x-Modellen mit Thinking-Default ein Vielfaches der
 * sichtbaren Antwort).
 */
export function extractTokenUsage(
    usageMetadata: GeminiUsageMetadata | undefined,
    model: string,
): TokenUsage {
    const answerTokens = usageMetadata?.candidatesTokenCount ?? 0;
    const thoughtTokens = usageMetadata?.thoughtsTokenCount ?? 0;
    return {
        promptTokens: usageMetadata?.promptTokenCount ?? 0,
        cachedTokens: usageMetadata?.cachedContentTokenCount ?? 0,
        outputTokens: answerTokens + thoughtTokens,
        model,
    };
}

/**
 * Addiert einen weiteren LLM-Call auf die Job-Aggregat-Summe.
 * model = Modell des letzten Calls — in der Cascade ist das per Konstruktion
 * das "primäre" Modell des Endergebnisses (Pro wenn eskaliert, sonst Flash).
 */
export function addTokenUsage(
    currentUsage: TokenUsage | null,
    additionalUsage: TokenUsage,
): TokenUsage {
    if (!currentUsage) return additionalUsage;
    return {
        promptTokens: currentUsage.promptTokens + additionalUsage.promptTokens,
        cachedTokens: currentUsage.cachedTokens + additionalUsage.cachedTokens,
        outputTokens: currentUsage.outputTokens + additionalUsage.outputTokens,
        model: additionalUsage.model,
    };
}

// =============================================================================
// JSON Parsing
// =============================================================================

/**
 * Parst eine LLM-Modellantwort als JSON mit strukturierten Fehlermeldungen.
 *
 * Robuste Validation Boundary (ARCH-002): Modellantworten sind untrusted Input.
 * Selbst mit responseMimeType 'application/json' hängen Modelle Müll an das
 * Objekt — gemini-3.1-pro-preview etwa eine überzählige schließende Klammer,
 * andere Modelle Markdown-Fences oder Fließtext. Deshalb wird das erste
 * ausbalancierte JSON-Objekt extrahiert statt der ganze Text geparst.
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

    const jsonCandidate = extractFirstBalancedJson(trimmedText) ?? trimmedText;

    try {
        return JSON.parse(jsonCandidate) as T;
    } catch (parseError: unknown) {
        const repairedValue = parseWithStringRepairs<T>(trimmedText, jsonCandidate);
        if (repairedValue !== null) return repairedValue;
        const responsePreview = trimmedText.substring(0, 500);
        throw new Error(
            `[${context}] Modellantwort ist kein gültiges JSON: ${extractErrorMessage(parseError)}. ` +
            `Response-Preview: ${responsePreview}`,
        );
    }
}

/**
 * Konservative Reparaturen INNERHALB von String-Literalen, bevor die ganze
 * Modellantwort (und in Produktion der ganze Review-Job) verworfen wird —
 * sonst nichts anfassen. Zwei bekannte Gemini-Fehlermodi:
 *
 * 1. ROHE Steuerzeichen (literales Tab oder \n), wenn tab-eingerückter
 *    Quellcode in `exact_quote`/`critique` zitiert wird (Go, Makefiles,
 *    tab-eingerücktes C) — die JSON-Spec verbietet unescaptes U+0000–U+001F.
 * 2. UNESCAPTE Anführungszeichen, wenn der zitierte Code selbst `"` enthält
 *    (JSX `className="x"`, String-Literale). gemini-3.8-flash vergisst das
 *    Escaping nicht-deterministisch (Probe 2026-09-17, r20 pro-direct: 2 von 4
 *    Calls, finishReason STOP, Klammern balanciert — es ist KEIN Abbruch).
 *
 * Die Quote-Reparatur läuft vor der Steuerzeichen-Reparatur, weil erst sie die
 * String-Grenzen richtigstellt, auf denen die zweite aufsetzt. Da ein
 * verirrtes `"` auch den Balanced-Scanner (extractFirstBalancedJson) täuschen
 * kann, wird jede Reparatur sowohl auf dem Kandidaten als auch auf dem vollen
 * Text versucht. null = keine Reparatur half; der Aufrufer wirft dann den
 * Originalfehler, der aussagekräftiger ist.
 */
function parseWithStringRepairs<T>(trimmedText: string, jsonCandidate: string): T | null {
    const repairStrategies: ReadonlyArray<(jsonText: string) => string> = [
        escapeControlCharsInsideStrings,
        (jsonText) => escapeControlCharsInsideStrings(escapeUnescapedQuotesInsideStrings(jsonText)),
    ];
    const repairSources = jsonCandidate === trimmedText ? [trimmedText] : [jsonCandidate, trimmedText];

    for (const repairStrategy of repairStrategies) {
        for (const repairSource of repairSources) {
            const repairedText = repairStrategy(repairSource);
            if (repairedText === repairSource) continue;
            const repairedCandidate = extractFirstBalancedJson(repairedText) ?? repairedText;
            try {
                return JSON.parse(repairedCandidate) as T;
            } catch {
                // Diese Kombination half nicht — nächste Strategie/Quelle.
            }
        }
    }
    return null;
}

/**
 * Escapt Anführungszeichen, die INNERHALB eines JSON-String-Literals stehen,
 * aber nicht escaped sind. Ein `"` gilt nur dann als String-Ende, wenn nach
 * optionalem Whitespace ein struktureller Fortsetzer folgt: `:` (Key-Ende),
 * `}` / `]` (Container-Ende), das Textende, oder `,` gefolgt von `{`, `[`
 * oder dem nächsten Key (`"ident":`). Jedes andere `"` gehört zum Inhalt.
 *
 * Contract-Annahme: die Cascade-Antworten (Reviewer, Verdicts) sind Objekte
 * mit String-/Zahl-/Boolean-Werten und Arrays VON OBJEKTEN — Arrays aus
 * nackten Strings (`["a", "b"]`) gibt es dort nicht; nur für sie wäre die
 * Heuristik blind. Idempotent auf gültigem JSON.
 */
function escapeUnescapedQuotesInsideStrings(jsonText: string): string {
    let repairedText = '';
    let isInsideString = false;
    let isEscaped = false;

    for (let scanIndex = 0; scanIndex < jsonText.length; scanIndex += 1) {
        const currentChar = jsonText[scanIndex];
        if (isEscaped) {
            isEscaped = false;
            repairedText += currentChar;
            continue;
        }
        if (currentChar === '\\') {
            isEscaped = true;
            repairedText += currentChar;
            continue;
        }
        if (currentChar !== '"') {
            repairedText += currentChar;
            continue;
        }
        if (!isInsideString) {
            isInsideString = true;
            repairedText += currentChar;
            continue;
        }
        if (quoteClosesJsonString(jsonText, scanIndex)) {
            isInsideString = false;
            repairedText += currentChar;
        } else {
            repairedText += '\\"';
        }
    }

    return repairedText;
}

const JSON_KEY_AHEAD_PATTERN = /^"[A-Za-z_][A-Za-z0-9_]*"\s*:/;

function skipJsonWhitespace(jsonText: string, fromIndex: number): number {
    let scanIndex = fromIndex;
    while (scanIndex < jsonText.length && /\s/.test(jsonText[scanIndex])) scanIndex += 1;
    return scanIndex;
}

/** Folgt auf das `"` an quoteIndex ein struktureller Fortsetzer (s. o.)? */
function quoteClosesJsonString(jsonText: string, quoteIndex: number): boolean {
    const nextIndex = skipJsonWhitespace(jsonText, quoteIndex + 1);
    if (nextIndex >= jsonText.length) return true;
    const nextChar = jsonText[nextIndex];
    if (nextChar === ':' || nextChar === '}' || nextChar === ']') return true;
    if (nextChar !== ',') return false;

    const afterCommaIndex = skipJsonWhitespace(jsonText, nextIndex + 1);
    const afterCommaChar = jsonText[afterCommaIndex];
    if (afterCommaChar === '{' || afterCommaChar === '[') return true;
    return JSON_KEY_AHEAD_PATTERN.test(jsonText.substring(afterCommaIndex, afterCommaIndex + 80));
}

/**
 * Escapt rohe Steuerzeichen (U+0000–U+001F) NUR innerhalb von JSON-String-
 * Literalen zu ihrer gültigen Escape-Form. Text außerhalb von Strings
 * (Whitespace zwischen Tokens) bleibt unberührt, damit die Struktur unverändert
 * bleibt. Nutzt denselben String-/Escape-Zustandsautomaten wie der
 * Balanced-Scanner. Idempotent auf bereits gültigem JSON (dort stehen keine
 * rohen Steuerzeichen in Strings), gibt dann den Input unverändert zurück.
 */
function escapeControlCharsInsideStrings(jsonText: string): string {
    const controlCharEscapes: Record<string, string> = {
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
    };

    let result = '';
    let isInsideString = false;
    let isEscaped = false;

    for (const currentChar of jsonText) {
        if (isEscaped) {
            isEscaped = false;
            result += currentChar;
            continue;
        }
        if (currentChar === '\\') {
            isEscaped = true;
            result += currentChar;
            continue;
        }
        if (currentChar === '"') {
            isInsideString = !isInsideString;
            result += currentChar;
            continue;
        }

        if (isInsideString && currentChar.charCodeAt(0) < 0x20) {
            result += controlCharEscapes[currentChar]
                ?? `\\u${currentChar.charCodeAt(0).toString(16).padStart(4, '0')}`;
            continue;
        }
        result += currentChar;
    }

    return result;
}

/**
 * Schneidet das erste vollständige JSON-Objekt/-Array aus einem Text.
 * Klammern innerhalb von Strings (und escapte Anführungszeichen) zählen nicht
 * mit — sonst würde ein "{" in einer Critique die Balance zerstören.
 * null = kein Start-Delimiter gefunden.
 */
function extractFirstBalancedJson(rawText: string): string | null {
    const openingIndex = findFirstJsonDelimiter(rawText);
    if (openingIndex === -1) return null;

    const closingDelimiter = rawText[openingIndex] === '{' ? '}' : ']';
    const openingDelimiter = rawText[openingIndex];

    let nestingDepth = 0;
    let isInsideString = false;
    let isEscaped = false;

    for (let scanIndex = openingIndex; scanIndex < rawText.length; scanIndex += 1) {
        const currentChar = rawText[scanIndex];

        if (isEscaped) {
            isEscaped = false;
            continue;
        }
        if (currentChar === '\\') {
            isEscaped = true;
            continue;
        }
        if (currentChar === '"') {
            isInsideString = !isInsideString;
            continue;
        }
        if (isInsideString) continue;

        if (currentChar === openingDelimiter) nestingDepth += 1;
        if (currentChar === closingDelimiter) {
            nestingDepth -= 1;
            if (nestingDepth === 0) {
                return rawText.substring(openingIndex, scanIndex + 1);
            }
        }
    }

    return null;
}

function findFirstJsonDelimiter(rawText: string): number {
    const objectStart = rawText.indexOf('{');
    const arrayStart = rawText.indexOf('[');

    if (objectStart === -1) return arrayStart;
    if (arrayStart === -1) return objectStart;
    return Math.min(objectStart, arrayStart);
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
    const hunksByFile = buildHunkRangesByFile(prFiles);

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

/**
 * Unsichtbarer HTML-Kommentar-Marker im Comment-Body (MCP_SPEC \u00A74.3):
 * die Create-Review-Antwort liefert keine Comment-IDs, der Nachschlag \u00FCber
 * den Review-Endpoint schon \u2014 der Marker mappt die zur\u00FCckgelesenen Comments
 * deterministisch auf ihre Finding-IDs (statt fragilem Path/Line-Matching).
 */
const FINDING_MARKER_PATTERN = /<!-- unslop-finding:([0-9a-f]{16}) -->/;

export function buildFindingMarker(findingId: string): string {
    return `<!-- unslop-finding:${findingId} -->`;
}

export function parseFindingMarker(commentBody: string): string | null {
    const markerMatch = FINDING_MARKER_PATTERN.exec(commentBody);
    return markerMatch ? markerMatch[1] : null;
}

/**
 * "5 occurrences in this file: lines 12, 18, 25-28" \u2014 der Inline-Comment
 * ankert am ersten Vorkommen, die \u00FCbrigen stehen als Zeilenliste im Body
 * (EIN Kommentar pro Rule+File statt N, ROADMAP \u00A77).
 */
function buildOccurrencesLine(issue: PipelineIssue): string | null {
    if (!issue.occurrences || issue.occurrences.length < 2) return null;
    return `\uD83D\uDCCD **${issue.occurrences.length} occurrences in this file:** `
        + `lines ${formatOccurrenceLineRefs(issue.occurrences)}`;
}

function mapIssueToPrComment(issue: PipelineIssue): PullRequestReviewComment {
    const severityIcon = issue.severity === 'CRITICAL' ? '\uD83D\uDEA8' : '\u26A0\uFE0F';

    const commentBodyParts = [
        `${severityIcon} **${issue.rule}** (${issue.severity})`,
        '',
        issue.critique,
    ];

    const occurrencesLine = buildOccurrencesLine(issue);
    if (occurrencesLine) {
        commentBodyParts.push('', occurrencesLine);
    }

    if (issue.fixedCodeSnippet) {
        commentBodyParts.push(
            '',
            '\uD83D\uDCA1 **Suggested fix** (1-click commit):',
            '```suggestion',
            issue.fixedCodeSnippet,
            '```',
        );
    }

    // Nur Findings des Modells; ein Pre-Scan-Finding ist nicht KI-generiert (LEGAL_PAGES_SPEC §4a.3).
    if (isAiGeneratedFinding(issue)) {
        commentBodyParts.push('', AI_GENERATED_NOTICE, AI_GENERATED_MARKER);
    }

    if (issue.id) {
        commentBodyParts.push('', buildFindingMarker(issue.id));
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
    // Tats\u00E4chliche Treffer wie Summary und Check Run, nicht die Eintr\u00E4ge nach dem E4-Deckel.
    const { criticalCount, warningCount, totalCount } = countHitsBySeverity(issues);

    const markdownLines = [
        '## \uD83D\uDEE1\uFE0F Anti-Slop Gatekeeper Review',
        '',
        `**Result:** ${totalCount} issue(s) found`,
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
            const lineReference = issue.occurrences && issue.occurrences.length >= 2
                ? `\`${issue.path}\` — lines ${formatOccurrenceLineRefs(issue.occurrences)}`
                : `\`${issue.path}:${issue.line}\``;
            markdownLines.push(
                `- ${severityIcon} **${issue.rule}** — ${lineReference} — ${issue.critique}`,
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
