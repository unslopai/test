/**
 * Golden-Diff Replay-Rig — misst Token-Verbrauch und Review-Qualität.
 *
 * Schickt jeden Fixture-Diff aus fixtures/golden-diffs/ durch den echten
 * Reviewer-Prompt (reviewer_diff, alle Conditions) und prüft:
 *  1. Findings-Parität gegen expected.json (Qualitäts-Regression)
 *  2. Token-Verbrauch inkl. cachedContentTokenCount (Caching-Nachweis)
 *  3. Effektive Kosten pro Diff (Unit Economics)
 *
 * Aufruf:
 *   npx tsx scripts/replay-golden-diffs.ts                        # Report nach stdout + last-run.json
 *   npx tsx scripts/replay-golden-diffs.ts --out baseline.json    # Report-Datei benennen (Baseline-Capture)
 *   npx tsx scripts/replay-golden-diffs.ts --compare baseline.json # Kosten-Delta gegen früheren Report
 *
 * Exit-Codes: 0 = Parität ok, 1 = erwartetes Finding fehlt, 2 = Infrastruktur-Fehler.
 *
 * HINWEIS: Standalone-Runner (tsx), lädt .env.local. Kein RAG/DB-Zugriff —
 * bewusst hermetisch, damit die Baseline reproduzierbar bleibt.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { buildPrompt, filterIssuesByScope } from '@/lib/pipeline/prompt-builder';
import { parseModelJson, extractTokenUsage } from '@/lib/pipeline/helpers';
import { ALL_CONDITION_IDS } from '@/lib/pipeline/conditions';
import type { PipelineIssue } from '@/lib/pipeline/types';

// =============================================================================
// Config
// =============================================================================

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures', 'golden-diffs');
const REVIEWER_MODEL = 'gemini-2.5-flash';

/** Vertex-Preise für gemini-2.5-flash in USD pro 1M Tokens (Stand 2026-07). */
const PRICE_PER_MILLION = {
    input: 0.30,
    cachedInput: 0.075,
    output: 2.50,
} as const;

// =============================================================================
// Types
// =============================================================================

interface ExpectedFinding {
    readonly path: string;
    /** Alternativen mit '|' getrennt, z.B. "Condition 1|MAINT-001" (Condition vs. Law-Attribution). */
    readonly ruleContains: string;
}

/** Prüft ob eine Regel-Referenz eine der '|'-Alternativen enthält. */
function ruleMatchesExpectation(foundRule: string, expectedRule: string): boolean {
    return expectedRule.split('|').some((alternative) => foundRule.includes(alternative));
}

interface LlmReplayIssue {
    rule: string;
    severity: string;
    path: string;
    line: number;
    critique: string;
}

interface LlmReplayResponse {
    has_slop: boolean;
    issues: LlmReplayIssue[];
    summary: string;
}

interface FixtureReport {
    readonly fixture: string;
    readonly promptTokens: number;
    readonly cachedTokens: number;
    readonly outputTokens: number;
    readonly effectiveCostUsd: number;
    readonly foundRules: readonly string[];
    readonly missingExpected: readonly string[];
    readonly unexpectedFindings: readonly string[];
}

interface ReplayReport {
    readonly capturedAt: string;
    readonly model: string;
    readonly fixtures: readonly FixtureReport[];
    readonly totalEffectiveCostUsd: number;
    readonly parityPassed: boolean;
}

// =============================================================================
// Replay
// =============================================================================

async function replayFixture(
    fixtureName: string,
    combinedDiff: string,
    expectedFindings: readonly ExpectedFinding[],
    lawBlock: string,
): Promise<FixtureReport> {
    const { getVertexClient } = await import('@/lib/vertex');

    const filePaths = extractFixtureFilePaths(combinedDiff);
    const promptConfig = {
        activeConditionIds: ALL_CONDITION_IDS,
        filePaths,
        overrideSmartDetection: false,
    };
    // Stabiler Prefix: identische systemInstruction über alle Fixtures (Cache-Nachweis).
    const systemPrompt = buildPrompt('reviewer_diff', promptConfig, lawBlock);

    const vertexClient = getVertexClient();
    const response = await vertexClient.models.generateContent({
        model: REVIEWER_MODEL,
        contents: combinedDiff,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
        },
    });

    const reviewOutput = parseModelJson<LlmReplayResponse>(response.text ?? '', `Replay:${fixtureName}`);
    const usage = extractTokenUsage(response.usageMetadata, REVIEWER_MODEL);

    // Scope-Post-Filter wie im AiReviewerStep anwenden (PR-weite Scopes).
    const scopedIssues = filterIssuesByScope(
        reviewOutput.issues.map((issue) => toPipelineIssue(issue)),
        promptConfig,
    );

    const missingExpected = expectedFindings
        .filter((expected) => !scopedIssues.some(
            (issue) => issue.path === expected.path && ruleMatchesExpectation(issue.rule, expected.ruleContains),
        ))
        .map((expected) => `${expected.ruleContains} @ ${expected.path}`);

    const unexpectedFindings = scopedIssues
        .filter((issue) => !expectedFindings.some(
            (expected) => issue.path === expected.path && ruleMatchesExpectation(issue.rule, expected.ruleContains),
        ))
        .map((issue) => `${issue.rule} @ ${issue.path}:${issue.line}`);

    return {
        fixture: fixtureName,
        promptTokens: usage.promptTokens,
        cachedTokens: usage.cachedTokens,
        outputTokens: usage.outputTokens,
        effectiveCostUsd: calculateEffectiveCost(usage.promptTokens, usage.cachedTokens, usage.outputTokens),
        foundRules: scopedIssues.map((issue) => `${issue.rule} @ ${issue.path}:${issue.line}`),
        missingExpected,
        unexpectedFindings,
    };
}

/** Hebt eine Replay-Antwort auf das PipelineIssue-Format für den Post-Filter. */
function toPipelineIssue(replayIssue: LlmReplayIssue): PipelineIssue {
    return {
        rule: replayIssue.rule,
        severity: replayIssue.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        path: replayIssue.path,
        line: replayIssue.line,
        endLine: replayIssue.line,
        exactQuote: '',
        critique: replayIssue.critique,
        source: 'replay-rig',
    };
}

function calculateEffectiveCost(promptTokens: number, cachedTokens: number, outputTokens: number): number {
    const uncachedPromptTokens = Math.max(0, promptTokens - cachedTokens);
    return (
        (uncachedPromptTokens * PRICE_PER_MILLION.input +
            cachedTokens * PRICE_PER_MILLION.cachedInput +
            outputTokens * PRICE_PER_MILLION.output) / 1_000_000
    );
}

/** Extrahiert Dateipfade aus den `=== FILE: <pfad> (<status>) ===` Headern. */
function extractFixtureFilePaths(combinedDiff: string): string[] {
    const headerPattern = /^=== FILE: (.+?) \(\w+\) ===$/gm;
    const filePaths: string[] = [];
    let headerMatch: RegExpExecArray | null;
    while ((headerMatch = headerPattern.exec(combinedDiff)) !== null) {
        filePaths.push(headerMatch[1]);
    }
    return filePaths;
}

// =============================================================================
// Reporting
// =============================================================================

function printReport(report: ReplayReport): void {
    console.log(`\n=== Golden-Diff Replay (${report.model}, ${report.capturedAt}) ===\n`);
    console.log('Fixture                        | Prompt  | Cached  | Output | Cost (USD)');
    console.log('-------------------------------|---------|---------|--------|-----------');

    for (const fixtureReport of report.fixtures) {
        console.log(
            `${fixtureReport.fixture.padEnd(30)} | ` +
            `${String(fixtureReport.promptTokens).padStart(7)} | ` +
            `${String(fixtureReport.cachedTokens).padStart(7)} | ` +
            `${String(fixtureReport.outputTokens).padStart(6)} | ` +
            `${fixtureReport.effectiveCostUsd.toFixed(6)}`,
        );
    }

    console.log(`\nTotal effective cost: $${report.totalEffectiveCostUsd.toFixed(6)}`);

    for (const fixtureReport of report.fixtures) {
        if (fixtureReport.missingExpected.length > 0) {
            console.log(`\n❌ ${fixtureReport.fixture} — MISSING expected findings:`);
            fixtureReport.missingExpected.forEach((missing) => console.log(`   - ${missing}`));
        }
        if (fixtureReport.unexpectedFindings.length > 0) {
            console.log(`\nℹ️  ${fixtureReport.fixture} — additional findings (not in expected.json):`);
            fixtureReport.unexpectedFindings.forEach((extra) => console.log(`   - ${extra}`));
        }
    }

    console.log(`\nParity: ${report.parityPassed ? '✅ PASSED' : '❌ FAILED'}`);
}

function printComparison(currentReport: ReplayReport, comparePath: string): void {
    const previousReport = JSON.parse(fs.readFileSync(comparePath, 'utf-8')) as ReplayReport;
    const previousCost = previousReport.totalEffectiveCostUsd;
    const currentCost = currentReport.totalEffectiveCostUsd;
    const savingsPercent = previousCost > 0 ? ((previousCost - currentCost) / previousCost) * 100 : 0;

    console.log(`\n=== Comparison vs ${path.basename(comparePath)} (${previousReport.capturedAt}) ===`);
    console.log(`Previous total: $${previousCost.toFixed(6)}`);
    console.log(`Current total:  $${currentCost.toFixed(6)}`);
    console.log(`Savings:        ${savingsPercent.toFixed(1)}%`);
}

// =============================================================================
// Main
// =============================================================================

function readCliFlag(flagName: string): string | null {
    const flagIndex = process.argv.indexOf(flagName);
    return flagIndex >= 0 && process.argv[flagIndex + 1] ? process.argv[flagIndex + 1] : null;
}

async function main(): Promise<void> {
    const expectedByFixture = JSON.parse(
        fs.readFileSync(path.join(FIXTURES_DIR, 'expected.json'), 'utf-8'),
    ) as Record<string, ExpectedFinding[]>;

    const fixtureNames = fs.readdirSync(FIXTURES_DIR)
        .filter((fileName) => fileName.endsWith('.diff'))
        .sort();

    if (fixtureNames.length === 0) {
        throw new Error(`Keine .diff-Fixtures in ${FIXTURES_DIR} gefunden.`);
    }

    // Law-Block einmal laden — er ist der statische Teil des Cache-Prefixes.
    const { fetchRenderedLawBlock } = await import('@/lib/law');
    const lawBlock = await fetchRenderedLawBlock();
    console.log(`[Replay] Law-Block geladen: ${lawBlock.length} Zeichen.`);

    const fixtureReports: FixtureReport[] = [];
    for (const fixtureName of fixtureNames) {
        console.log(`[Replay] ${fixtureName}...`);
        const combinedDiff = fs.readFileSync(path.join(FIXTURES_DIR, fixtureName), 'utf-8');
        const expectedFindings = expectedByFixture[fixtureName] ?? [];
        fixtureReports.push(await replayFixture(fixtureName, combinedDiff, expectedFindings, lawBlock));
    }

    const report: ReplayReport = {
        capturedAt: new Date().toISOString(),
        model: REVIEWER_MODEL,
        fixtures: fixtureReports,
        totalEffectiveCostUsd: fixtureReports.reduce((sum, fixture) => sum + fixture.effectiveCostUsd, 0),
        parityPassed: fixtureReports.every((fixture) => fixture.missingExpected.length === 0),
    };

    printReport(report);

    const outPath = readCliFlag('--out') ?? path.join(FIXTURES_DIR, 'last-run.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nReport geschrieben: ${outPath}`);

    const comparePath = readCliFlag('--compare');
    if (comparePath) {
        printComparison(report, comparePath);
    }

    process.exitCode = report.parityPassed ? 0 : 1;
}

main().catch((mainError: unknown) => {
    console.error('[Replay] Infrastruktur-Fehler:', mainError);
    process.exitCode = 2;
});
