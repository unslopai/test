/**
 * Second-Opinion-Trigger (LLM_LANE_QUALITY_SPEC §4.2) — pure, LLM-frei.
 *
 * Deterministische Signale für Draft-Under-Reporting, auf die der
 * second-opinion-reviewer einen gezielten Pro-Review fährt:
 *   T1 "test-gap":          test-lastiger Diff, aber keine Lane fand dort etwas
 *   T2 "prescan-divergence": Prescan hat Findings, der Draft gar keine
 *                            (der 928-Zeilen-Honesty-Fall vom 2026-08-23)
 *
 * Bewusst KEIN "0 Findings auf großem Diff"-Trigger: der würde auf jedem
 * sauberen großen PR feuern — Kosten und FP-Risiko genau dort, wo der
 * Reviewer recht hatte.
 */
import type { PullRequestFile } from '@/lib/github';
import type { PipelineContext } from '@/lib/pipeline/types';

/** Trigger-Schwellen — Code-Konstanten wie REFERENCE_PRACTICE_GATES (Tuning via Telemetrie + Deploy). */
export const SECOND_OPINION_GATES = {
    /** T1: Anteil Test-Dateien an den reviewable Files, ab dem der Diff als test-lastig gilt. */
    testFileShareThreshold: 0.5,
    /** T2: Prescan-Findings, ab denen ein 0-Findings-Draft als Divergenz gilt. */
    divergenceMinPrescanFindings: 3,
    /** Obergrenze des Subset-Prompts in geschätzten Tokens (chars/4, wie der Router). */
    maxSubsetTokens: 12000,
} as const;

const CHARS_PER_TOKEN_ESTIMATE = 4;

export type SecondOpinionReason = 'test-gap' | 'prescan-divergence';

export interface SecondOpinionTrigger {
    readonly reasons: readonly SecondOpinionReason[];
    /** Datei-Subset, das Pro reviewen soll (bereits auf maxSubsetTokens gedeckelt). */
    readonly targetFiles: readonly PullRequestFile[];
    /** Dateien, die dem Token-Deckel zum Opfer fielen (ehrlich geloggt, nie still). */
    readonly truncatedFileCount: number;
}

// =============================================================================
// Test-Datei-Klassifikator
// =============================================================================

/** `foo.test.ts`, `foo.spec.tsx`, `foo_test.go`, `foo_test.py` — aber nie `attest.go`. */
const TEST_FILE_BASENAME_PATTERN = /(\.(test|spec)\.[^./]+|_test\.(go|py))$/;
/** Pfad-Segmente, die exakt Test-Verzeichnisse sind — `src/testing/` zählt bewusst nicht. */
const TEST_DIRECTORY_SEGMENT_PATTERN = /(^|\/)(__tests__|tests?)\//;

export function isTestFilePath(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const baseName = normalizedPath.split('/').pop() ?? '';
    return TEST_FILE_BASENAME_PATTERN.test(baseName)
        || (baseName.startsWith('test_') && baseName.endsWith('.py'))
        || TEST_DIRECTORY_SEGMENT_PATTERN.test(normalizedPath);
}

// =============================================================================
// Trigger-Auswertung
// =============================================================================

export function evaluateSecondOpinionTrigger(context: PipelineContext): SecondOpinionTrigger | null {
    const reasons: SecondOpinionReason[] = [];
    const targetFileNames = new Set<string>();

    const uncoveredTestFiles = collectUncoveredTestFiles(context);
    if (uncoveredTestFiles.length > 0) {
        reasons.push('test-gap');
        uncoveredTestFiles.forEach((file) => targetFileNames.add(file.filename));
    }

    if (hasPrescanDivergence(context)) {
        reasons.push('prescan-divergence');
        context.reviewableFiles.forEach((file) => targetFileNames.add(file.filename));
    }

    if (reasons.length === 0) return null;

    const orderedTargets = context.reviewableFiles.filter((file) => targetFileNames.has(file.filename));
    const { cappedFiles, truncatedFileCount } = capFilesByTokenBudget(orderedTargets);
    if (cappedFiles.length === 0) return null;

    return { reasons, targetFiles: cappedFiles, truncatedFileCount };
}

/**
 * T1: test-lastiger Diff → alle Test-Dateien, in denen KEINE Lane etwas fand.
 * Bewusst per Datei statt "0 Findings insgesamt": der gemessene Draft-Blind-
 * Spot (r17: 2/7) liegt in einzelnen Test-Dateien NEBEN gefundenen — ein
 * Ganz-oder-gar-nicht-Gate würde exakt den Zielfall verfehlen (Phase-0-Lehre).
 */
function collectUncoveredTestFiles(context: PipelineContext): PullRequestFile[] {
    if (context.reviewableFiles.length === 0) return [];
    const testFiles = context.reviewableFiles.filter((file) => isTestFilePath(file.filename));
    const testFileShare = testFiles.length / context.reviewableFiles.length;
    if (testFileShare < SECOND_OPINION_GATES.testFileShareThreshold) return [];

    const pathsWithFindings = new Set(
        [...context.issues, ...context.prescanIssues].map((issue) => issue.path),
    );
    return testFiles.filter((file) => !pathsWithFindings.has(file.filename));
}

/** T2: die deterministische Lane fand deutlich etwas, der Draft gar nichts. */
function hasPrescanDivergence(context: PipelineContext): boolean {
    return context.issues.length === 0
        && context.prescanIssues.length >= SECOND_OPINION_GATES.divergenceMinPrescanFindings;
}

/** Deckelt das Subset auf maxSubsetTokens (Reihenfolge der reviewableFiles bleibt). */
function capFilesByTokenBudget(targetFiles: readonly PullRequestFile[]): {
    cappedFiles: PullRequestFile[];
    truncatedFileCount: number;
} {
    const cappedFiles: PullRequestFile[] = [];
    let estimatedTokens = 0;
    for (const targetFile of targetFiles) {
        const fileTokens = Math.ceil((targetFile.patch ?? '').length / CHARS_PER_TOKEN_ESTIMATE);
        if (estimatedTokens + fileTokens > SECOND_OPINION_GATES.maxSubsetTokens && cappedFiles.length > 0) {
            continue;
        }
        if (fileTokens > SECOND_OPINION_GATES.maxSubsetTokens) continue;
        cappedFiles.push(targetFile);
        estimatedTokens += fileTokens;
    }
    return { cappedFiles, truncatedFileCount: targetFiles.length - cappedFiles.length };
}

// =============================================================================
// Dedupe gegen bestehende Findings
// =============================================================================

/**
 * Second-Opinion-Findings, deren Regel+Datei bereits von Draft ODER Prescan
 * gemeldet ist, werden verworfen — die Second Opinion ist additiv und darf
 * keine Duplikat-Kommentare erzeugen (gleiche Disziplin wie die Prescan-Merge-
 * Dedupe an der Report-Grenze).
 */
export function dropDuplicateFindings<IssueShape extends { rule: string; path: string }>(
    candidateIssues: readonly IssueShape[],
    existingIssues: readonly { rule: string; path: string }[],
): IssueShape[] {
    const existingKeys = new Set(
        existingIssues.map((issue) => `${issue.path}::${primaryRuleToken(issue.rule)}`),
    );
    return candidateIssues.filter(
        (candidate) => !existingKeys.has(`${candidate.path}::${primaryRuleToken(candidate.rule)}`),
    );
}

/** "SEC-001 (…)" → "SEC-001", "Condition 11: …" → "Condition 11"; sonst der ganze Text. */
function primaryRuleToken(ruleText: string): string {
    const tokenMatch = /^([A-Z]{2,}-\d+|Condition \d+)/.exec(ruleText.trim());
    return tokenMatch ? tokenMatch[1] : ruleText.trim().toLowerCase();
}
