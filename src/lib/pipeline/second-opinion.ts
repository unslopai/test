/**
 * Second-Opinion-Trigger (LLM_LANE_QUALITY_SPEC §4.2) — pure, LLM-frei.
 *
 * Deterministisches Signal für Draft-Under-Reporting, auf das der
 * second-opinion-reviewer einen gezielten Pro-Review fährt:
 *   T1 "test-gap": test-lastiger Diff, aber keine Lane fand dort etwas
 *
 * T2 "prescan-divergence" (Prescan ≥ 3, Draft 0) ist seit 2026-09-29
 * abgeschaltet (LARGE_DIFF_RECALL_SPEC §3.3, §9): der Draft bekommt die
 * Prescan-Tupel als <already_flagged> und soll sie NICHT erneut melden — auf
 * sauberem Code maß T2 damit Compliance, nicht Divergenz, und kostete pro
 * großem sauberen PR eine Pro-Eskalation (unslopai/test#16/#17: zwei
 * Eskalationen für 1 bzw. 0 Findings).
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
    /** Obergrenze des Subset-Prompts in geschätzten Tokens (chars/4, wie der Router). */
    maxSubsetTokens: 12000,
} as const;

const CHARS_PER_TOKEN_ESTIMATE = 4;

export type SecondOpinionReason = 'test-gap';

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
    const uncoveredTestFiles = collectUncoveredTestFiles(context);
    if (uncoveredTestFiles.length === 0) return null;

    const { cappedFiles, truncatedFileCount } = capFilesByTokenBudget(uncoveredTestFiles);
    if (cappedFiles.length === 0) return null;

    return { reasons: ['test-gap'], targetFiles: cappedFiles, truncatedFileCount };
}

/**
 * T1: test-lastiger Diff → alle Test-Dateien, in denen KEINE Lane etwas fand.
 * Bewusst per Datei statt "0 Findings insgesamt": der gemessene Draft-Blind-
 * Spot (r17: 2/7) liegt in einzelnen Test-Dateien NEBEN gefundenen — ein
 * Ganz-oder-gar-nicht-Gate würde exakt den Zielfall verfehlen (Phase-0-Lehre).
 * Reihenfolge = reviewableFiles (Diff-Reihenfolge).
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
