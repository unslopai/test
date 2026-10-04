/**
 * Golden-Diff Replay-Rig — fährt die ECHTE Router-Cascade (SPEC.md §11).
 *
 * Jeder Fixture-Diff läuft durch dieselben Steps wie ein Kunden-PR:
 * complexity-router -> draft-reviewer -> claim-verifier -> escalation-reviewer
 * -> integrity-scorer. Gemessen wird, was für die Unit Economics zählt:
 *
 *  1. Eskalationsrate: Anteil der Claims/Jobs, die das teure Pro-Modell sehen
 *  2. Kosten pro Job (Flash + Pro kombiniert), aggregiert aus der
 *     review_job_llm_calls-Telemetrie — dieselbe Quelle wie das spätere
 *     Unit-Economics-Dashboard. Preise kommen live aus der Cloud Billing API.
 *  3. Review-Qualität: Überleben die erwarteten Findings die Verifikation?
 *     Ein widerlegtes Erwartungs-Finding ist eine False Refutation und faellt
 *     hier auf — genau der Fehler, der in PR #13 unbemerkt blieb.
 *
 * Aufruf:
 *   npx tsx scripts/replay-golden-diffs.ts                         # Report nach stdout + last-run.json
 *   npx tsx scripts/replay-golden-diffs.ts --out baseline.json     # Baseline-Capture
 *   npx tsx scripts/replay-golden-diffs.ts --compare baseline.json # Kosten-Delta
 *   npx tsx scripts/replay-golden-diffs.ts --keep                  # Jobs/Telemetrie in der DB behalten
 *
 * Exit-Codes: 0 = Parität ok, 1 = erwartetes Finding fehlt/widerlegt, 2 = Infrastruktur-Fehler.
 *
 * WARNUNG: Das Rig ruft echte LLMs auf und verbraucht echtes Pro-Eskalations-
 * Budget des Dogfooding-Users. RAG bleibt bewusst aus (reproduzierbare Baseline).
 *
 * HINWEIS: Dieses Modul wird von scripts/replay-golden-diffs.ts dynamisch
 * geladen, NACHDEM dort die .env.local geladen wurde — die Supabase- und
 * Vertex-Clients lesen ihre Credentials bereits beim Import.
 */
import * as fs from 'fs';
import * as path from 'path';

import { supabase } from '@/lib/supabase';
import { ALL_CONDITION_IDS } from '@/lib/pipeline/conditions';
import { DEFAULT_CASCADE_CONFIG, INITIAL_CASCADE_STATE } from '@/lib/pipeline/defaults';
import { DEFAULT_PRESCAN_CONFIG } from '@unslop/prescan';
import { MODEL_DRAFT, MODEL_ESCALATION, MODEL_VERIFIER } from '@/lib/pipeline/models';
import { complexityRouterStep } from '@/lib/pipeline/steps/complexity-router-step';
import { draftReviewerStep } from '@/lib/pipeline/steps/draft-reviewer-step';
import { claimVerifierStep } from '@/lib/pipeline/steps/claim-verifier-step';
import { escalationReviewerStep } from '@/lib/pipeline/steps/escalation-reviewer-step';
import { integrityScorerStep } from '@/lib/pipeline/steps/integrity-scorer-step';
import {
    PricingUnavailableError,
    calculateCallCostUsd,
    fetchVertexPricing,
} from './vertex-pricing';
import type { PricingLookup } from './vertex-pricing';
import type { PullRequestFile } from '@/lib/github';
import type { PipelineContext } from '@/lib/pipeline/types';

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures', 'golden-diffs');
const CASCADE_MODELS = [MODEL_DRAFT, MODEL_VERIFIER, MODEL_ESCALATION];

// =============================================================================
// Types
// =============================================================================

interface ExpectedFinding {
    readonly path: string;
    /** Alternativen mit '|' getrennt, z.B. "Condition 1|MAINT-001". */
    readonly ruleContains: string;
}

interface FixtureReplayResult {
    readonly fixture: string;
    readonly jobId: string;
    readonly route: string;
    readonly draftFindingCount: number;
    readonly survivingFindingCount: number;
    readonly refutedFindingCount: number;
    readonly verifiedClaimCount: number;
    readonly escalatedClaimCount: number;
    readonly escalated: boolean;
    readonly integrityScore: number | null;
    readonly degradations: readonly string[];
    /** Erwartete Findings, die der Draft gar nicht erst gefunden hat. */
    readonly missingExpected: readonly string[];
    /** Erwartete Findings, die der Verifier widerlegt hat (False Refutation). */
    readonly refutedExpected: readonly string[];
    readonly survivingFindings: readonly string[];
}

interface TokenTotals {
    readonly promptTokens: number;
    readonly cachedTokens: number;
    readonly outputTokens: number;
}

interface JobCost {
    readonly jobId: string;
    readonly costUsd: number | null;
    readonly flashCostUsd: number | null;
    readonly proCostUsd: number | null;
    /** Tokens sind die preisunabhängige Messgröße — Kosten = Preis x Tokens. */
    readonly flashTokens: TokenTotals;
    readonly proTokens: TokenTotals;
}

interface ReplayReport {
    readonly capturedAt: string;
    readonly models: { readonly draft: string; readonly verifier: string; readonly escalation: string };
    readonly fixtures: readonly FixtureReplayResult[];
    readonly claimEscalationRatePercent: number;
    readonly jobEscalationRatePercent: number;
    readonly falsePositiveSuppressionRatePercent: number;
    readonly medianJobCostUsd: number | null;
    readonly meanJobCostUsd: number | null;
    readonly totalCostUsd: number | null;
    readonly pricingAvailable: boolean;
    readonly pricingNote: string;
    readonly parityPassed: boolean;
}

// =============================================================================
// Fixture Loading
// =============================================================================

/**
 * Fixture-Format: "=== FILE: <pfad> (<status>) ===" gefolgt vom Patch.
 * Die Fixtures haben CRLF-Zeilenenden — ein \n-only-Regex verfehlt den Header
 * und degradiert den Dateinamen still, was den Scope-Post-Filter danach
 * React-Findings verwerfen lässt. Deshalb wird der Header strikt geparst und
 * ein Fehlschlag laut gemeldet statt weggeschluckt.
 */
function parseFixtureFiles(fixtureName: string, combinedDiff: string): PullRequestFile[] {
    const fileSections = combinedDiff.split(/^=== FILE: /m).filter((section) => section.trim().length > 0);

    return fileSections.map((fileSection) => {
        const headerMatch = /^(.+?) \((\w+)\) ===\r?\n([\s\S]*)$/.exec(fileSection);
        if (!headerMatch) {
            throw new Error(
                `Fixture ${fixtureName}: Datei-Header nicht parsebar. ` +
                `Erwartet "=== FILE: <pfad> (<status>) ===".`,
            );
        }

        return {
            sha: 'replay-fixture',
            filename: headerMatch[1].trim(),
            status: 'modified',
            additions: 0,
            deletions: 0,
            changes: 0,
            patch: headerMatch[3],
        };
    });
}

// =============================================================================
// Cascade Execution
// =============================================================================

/**
 * Legt eine echte review_jobs-Zeile an — die Telemetrie-Inserts der Steps
 * haben einen Fremdschlüssel auf sie. Der Payload markiert die Zeile als
 * Replay, damit sie nie mit Kunden-Jobs verwechselt wird.
 */
async function createReplayJob(fixtureName: string): Promise<string> {
    const { data: insertedJob, error: insertError } = await supabase
        .from('review_jobs')
        .insert({
            payload: { replay: true, fixture: fixtureName },
            status: 'processing',
            source: 'manual',
        })
        .select('id')
        .single();

    if (insertError || !insertedJob) {
        throw new Error(`Replay-Job konnte nicht angelegt werden: ${insertError?.message}`);
    }
    return insertedJob.id as string;
}

/** Der Dogfooding-User, dessen Pro-Eskalations-Budget das Rig verbraucht. */
async function resolveBudgetOwnerUserId(): Promise<string> {
    const { data: accountRow, error: lookupError } = await supabase
        .from('billing_accounts')
        .select('owner_user_id, status')
        .in('status', ['trialing', 'active', 'complimentary'])
        .limit(1)
        .maybeSingle();

    if (lookupError || !accountRow) {
        throw new Error(
            'Kein berechtigter billing_accounts-Eintrag gefunden — ohne ihn wird jede ' +
            'Pro-Eskalation als "Budget erschöpft" degradiert und die Messung wäre wertlos.',
        );
    }
    return accountRow.owner_user_id as string;
}

function buildReplayContext(
    jobId: string,
    ownerUserId: string,
    combinedDiff: string,
    fixtureFiles: readonly PullRequestFile[],
): PipelineContext {
    return {
        jobId,
        repoFullName: 'replay/golden-diffs',
        prNumber: 0,
        headSha: '',
        githubToken: '',
        // Die Replay-Rig spricht nie mit GitHub: kein Token, kein Check Run.
        authMode: 'oauth',
        repositoryId: null,
        ownerUserId,
        prFiles: fixtureFiles,
        reviewableFiles: fixtureFiles,
        combinedDiff,
        omittedFiles: [],
        issues: [],
        reviewSummary: '',
        // RAG bleibt aus: der Evidence-Block variiert pro Repo und würde die
        // Baseline unreproduzierbar machen (Prompt-Variante reviewer_diff).
        ragPromptSection: '',
        // Practices und Law-Filter ebenfalls aus (detectedEcosystems: null =
        // ungefilterter Law-Block) — gleiche Reproduzierbarkeits-Begründung.
        practicesPromptSection: '',
        detectedEcosystems: null,
        promptConfig: {
            activeConditionIds: ALL_CONDITION_IDS,
            filePaths: fixtureFiles.map((fixtureFile) => fixtureFile.filename),
            overrideSmartDetection: false,
        },
        tokenUsage: null,
        cascade: INITIAL_CASCADE_STATE,
        cascadeConfig: DEFAULT_CASCADE_CONFIG,
        // Replay misst die LLM-Cascade — der deterministische Pre-Scanner
        // läuft hier nicht (Baseline bleibt Prescan-frei reproduzierbar).
        prescanConfig: DEFAULT_PRESCAN_CONFIG,
        prescanIssues: [],
        prescanStats: null,
        llmSkipped: false,
        shouldAbort: false,
    };
}

async function replayFixture(
    fixtureName: string,
    combinedDiff: string,
    expectedFindings: readonly ExpectedFinding[],
    ownerUserId: string,
): Promise<FixtureReplayResult> {
    const fixtureFiles = parseFixtureFiles(fixtureName, combinedDiff);
    const jobId = await createReplayJob(fixtureName);
    const initialContext = buildReplayContext(jobId, ownerUserId, combinedDiff, fixtureFiles);

    const routedContext = await complexityRouterStep.execute(initialContext);
    const draftedContext = await draftReviewerStep.execute(routedContext);
    const verifiedContext = await claimVerifierStep.execute(draftedContext);
    const escalatedContext = await escalationReviewerStep.execute(verifiedContext);
    const scoredContext = await integrityScorerStep.execute(escalatedContext);

    return buildFixtureResult(fixtureName, jobId, expectedFindings, draftedContext, scoredContext);
}

function buildFixtureResult(
    fixtureName: string,
    jobId: string,
    expectedFindings: readonly ExpectedFinding[],
    draftedContext: PipelineContext,
    scoredContext: PipelineContext,
): FixtureReplayResult {
    const draftIssues = draftedContext.issues;
    const survivingIssues = scoredContext.issues;

    const missingExpected = expectedFindings
        .filter((expected) => !matchesAnyIssue(expected, draftIssues))
        .map(describeExpectation);

    // Vom Draft gefunden, aber nach der Verifikation verschwunden = widerlegt.
    const refutedExpected = expectedFindings
        .filter((expected) => matchesAnyIssue(expected, draftIssues) && !matchesAnyIssue(expected, survivingIssues))
        .map(describeExpectation);

    return {
        fixture: fixtureName,
        jobId,
        route: scoredContext.cascade.route,
        draftFindingCount: draftIssues.length,
        survivingFindingCount: survivingIssues.length,
        refutedFindingCount: draftIssues.length - survivingIssues.length,
        verifiedClaimCount: scoredContext.cascade.verdicts.length,
        escalatedClaimCount: scoredContext.cascade.escalationClaimIds.length,
        escalated: scoredContext.cascade.escalated,
        integrityScore: scoredContext.cascade.integrityScore,
        degradations: scoredContext.cascade.degradations,
        missingExpected,
        refutedExpected,
        survivingFindings: survivingIssues.map(
            (survivingIssue) => `${survivingIssue.rule} @ ${survivingIssue.path}:${survivingIssue.line}`,
        ),
    };
}

function matchesAnyIssue(
    expected: ExpectedFinding,
    issues: readonly { rule: string; path: string }[],
): boolean {
    return issues.some((issue) =>
        issue.path === expected.path
        && expected.ruleContains.split('|').some((ruleAlternative) => issue.rule.includes(ruleAlternative)),
    );
}

function describeExpectation(expected: ExpectedFinding): string {
    return `${expected.ruleContains} @ ${expected.path}`;
}

// =============================================================================
// Kosten aus der Telemetrie (dieselbe Quelle wie das Unit-Economics-Dashboard)
// =============================================================================

async function aggregateJobCosts(
    jobIds: readonly string[],
    pricing: PricingLookup,
): Promise<JobCost[]> {
    const { data: telemetryRows, error: telemetryError } = await supabase
        .from('review_job_llm_calls')
        .select('job_id, model, prompt_tokens, cached_tokens, output_tokens')
        .in('job_id', [...jobIds]);

    if (telemetryError) {
        throw new Error(`Telemetrie konnte nicht gelesen werden: ${telemetryError.message}`);
    }

    return jobIds.map((jobId) => {
        const jobCalls = (telemetryRows ?? []).filter((telemetryRow) => telemetryRow.job_id === jobId);
        const isProCall = (model: string) => model === MODEL_ESCALATION;
        const isFlashCall = (model: string) => model !== MODEL_ESCALATION;

        const flashCostUsd = sumCallCosts(jobCalls, pricing, isFlashCall);
        const proCostUsd = sumCallCosts(jobCalls, pricing, isProCall);
        const costUsd = flashCostUsd === null && proCostUsd === null
            ? null
            : (flashCostUsd ?? 0) + (proCostUsd ?? 0);

        return {
            jobId,
            costUsd,
            flashCostUsd,
            proCostUsd,
            flashTokens: sumTokens(jobCalls, isFlashCall),
            proTokens: sumTokens(jobCalls, isProCall),
        };
    });
}

function sumTokens(
    jobCalls: readonly TelemetryRow[],
    modelFilter: (model: string) => boolean,
): TokenTotals {
    return jobCalls
        .filter((jobCall) => modelFilter(jobCall.model))
        .reduce<TokenTotals>(
            (totals, jobCall) => ({
                promptTokens: totals.promptTokens + (jobCall.prompt_tokens ?? 0),
                cachedTokens: totals.cachedTokens + (jobCall.cached_tokens ?? 0),
                outputTokens: totals.outputTokens + (jobCall.output_tokens ?? 0),
            }),
            { promptTokens: 0, cachedTokens: 0, outputTokens: 0 },
        );
}

interface TelemetryRow {
    readonly model: string;
    readonly prompt_tokens: number | null;
    readonly cached_tokens: number | null;
    readonly output_tokens: number | null;
}

/** null = für mindestens ein beteiligtes Modell fehlt der offizielle Preis. */
function sumCallCosts(
    jobCalls: readonly TelemetryRow[],
    pricing: PricingLookup,
    modelFilter: (model: string) => boolean,
): number | null {
    const relevantCalls = jobCalls.filter((jobCall) => modelFilter(jobCall.model));
    if (relevantCalls.length === 0) return null;

    let accumulatedCost = 0;
    for (const jobCall of relevantCalls) {
        const callCost = calculateCallCostUsd(
            pricing.get(jobCall.model),
            jobCall.prompt_tokens ?? 0,
            jobCall.cached_tokens ?? 0,
            jobCall.output_tokens ?? 0,
        );
        if (callCost === null) return null;
        accumulatedCost += callCost;
    }
    return accumulatedCost;
}

function median(values: readonly number[]): number | null {
    if (values.length === 0) return null;
    const sortedValues = [...values].sort((left, right) => left - right);
    const middleIndex = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
        ? (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
        : sortedValues[middleIndex];
}

// =============================================================================
// Report
// =============================================================================

function buildReport(
    fixtureResults: readonly FixtureReplayResult[],
    jobCosts: readonly JobCost[],
    pricingAvailable: boolean,
    pricingNote: string,
): ReplayReport {
    const totalClaims = fixtureResults.reduce((claimSum, result) => claimSum + result.verifiedClaimCount, 0);
    const escalatedClaims = fixtureResults.reduce((claimSum, result) => claimSum + result.escalatedClaimCount, 0);
    const escalatedJobs = fixtureResults.filter((result) => result.escalated).length;

    const totalDraftFindings = fixtureResults.reduce((findingSum, result) => findingSum + result.draftFindingCount, 0);
    const suppressedFindings = fixtureResults.reduce(
        (findingSum, result) => findingSum + result.refutedFindingCount, 0,
    );

    const resolvedCosts = jobCosts
        .map((jobCost) => jobCost.costUsd)
        .filter((costUsd): costUsd is number => costUsd !== null);

    return {
        capturedAt: new Date().toISOString(),
        models: { draft: MODEL_DRAFT, verifier: MODEL_VERIFIER, escalation: MODEL_ESCALATION },
        fixtures: fixtureResults,
        claimEscalationRatePercent: totalClaims > 0 ? (escalatedClaims / totalClaims) * 100 : 0,
        jobEscalationRatePercent: fixtureResults.length > 0 ? (escalatedJobs / fixtureResults.length) * 100 : 0,
        falsePositiveSuppressionRatePercent: totalDraftFindings > 0
            ? (suppressedFindings / totalDraftFindings) * 100
            : 0,
        medianJobCostUsd: median(resolvedCosts),
        meanJobCostUsd: resolvedCosts.length > 0
            ? resolvedCosts.reduce((costSum, costUsd) => costSum + costUsd, 0) / resolvedCosts.length
            : null,
        totalCostUsd: resolvedCosts.length > 0
            ? resolvedCosts.reduce((costSum, costUsd) => costSum + costUsd, 0)
            : null,
        pricingAvailable,
        pricingNote,
        parityPassed: fixtureResults.every(
            (result) => result.missingExpected.length === 0 && result.refutedExpected.length === 0,
        ),
    };
}

function printReport(report: ReplayReport, jobCosts: readonly JobCost[]): void {
    console.log(`\n=== Cascade Replay (${report.capturedAt}) ===`);
    console.log(`Draft/Verify: ${report.models.draft} | Escalation: ${report.models.escalation}\n`);

    console.log('Fixture                   | Route         | Draft | Kept | Refuted | Escal | Score | Cost (USD)');
    console.log('--------------------------|---------------|-------|------|---------|-------|-------|-----------');

    for (const fixtureResult of report.fixtures) {
        const jobCost = jobCosts.find((cost) => cost.jobId === fixtureResult.jobId);
        const costLabel = jobCost?.costUsd !== null && jobCost?.costUsd !== undefined
            ? jobCost.costUsd.toFixed(6)
            : 'n/a';

        console.log(
            `${fixtureResult.fixture.padEnd(25)} | ` +
            `${fixtureResult.route.padEnd(13)} | ` +
            `${String(fixtureResult.draftFindingCount).padStart(5)} | ` +
            `${String(fixtureResult.survivingFindingCount).padStart(4)} | ` +
            `${String(fixtureResult.refutedFindingCount).padStart(7)} | ` +
            `${String(fixtureResult.escalatedClaimCount).padStart(5)} | ` +
            `${String(fixtureResult.integrityScore ?? 'n/a').padStart(5)} | ` +
            `${costLabel.padStart(10)}`,
        );
    }

    printEconomics(report, jobCosts);
    printQualitySignals(report);

    console.log(`\nParity: ${report.parityPassed ? 'PASSED' : 'FAILED'}`);
}

function printEconomics(report: ReplayReport, jobCosts: readonly JobCost[]): void {
    console.log('\n--- Unit Economics ---');
    console.log(`Claim-Eskalationsrate: ${report.claimEscalationRatePercent.toFixed(1)}% der verifizierten Claims`);
    console.log(`Job-Eskalationsrate:   ${report.jobEscalationRatePercent.toFixed(1)}% der Jobs sahen das Pro-Modell`);
    console.log(`False-Positive-Suppression: ${report.falsePositiveSuppressionRatePercent.toFixed(1)}% der Draft-Findings verworfen`);

    printTokenTotals(jobCosts);

    if (!report.pricingAvailable) {
        console.log(`\nKosten: NICHT VERFÜGBAR — ${report.pricingNote}`);
        console.log('Tokens oben sind die vollständige Messgrundlage: Kosten = offizieller Preis x Tokens.');
        return;
    }

    console.log(`\nKosten pro Median-Job: $${report.medianJobCostUsd?.toFixed(6) ?? 'n/a'}`);
    console.log(`Kosten pro Mittel-Job: $${report.meanJobCostUsd?.toFixed(6) ?? 'n/a'}`);
    console.log(`Gesamt (${report.fixtures.length} Jobs): $${report.totalCostUsd?.toFixed(6) ?? 'n/a'}`);
}

/** Token-Bilanz getrennt nach Modell-Tier — die preisunabhängige Kostenbasis. */
function printTokenTotals(jobCosts: readonly JobCost[]): void {
    const flashTotals = accumulateTokenTotals(jobCosts.map((jobCost) => jobCost.flashTokens));
    const proTotals = accumulateTokenTotals(jobCosts.map((jobCost) => jobCost.proTokens));
    const jobCount = Math.max(1, jobCosts.length);

    console.log('\nTokens (Summe / Schnitt pro Job):');
    console.log(
        `  ${MODEL_DRAFT}: prompt ${flashTotals.promptTokens} (${Math.round(flashTotals.promptTokens / jobCount)}), ` +
        `cached ${flashTotals.cachedTokens}, output ${flashTotals.outputTokens} (${Math.round(flashTotals.outputTokens / jobCount)})`,
    );
    console.log(
        `  ${MODEL_ESCALATION}: prompt ${proTotals.promptTokens} (${Math.round(proTotals.promptTokens / jobCount)}), ` +
        `cached ${proTotals.cachedTokens}, output ${proTotals.outputTokens} (${Math.round(proTotals.outputTokens / jobCount)})`,
    );
}

function accumulateTokenTotals(tokenTotals: readonly TokenTotals[]): TokenTotals {
    return tokenTotals.reduce<TokenTotals>(
        (accumulated, current) => ({
            promptTokens: accumulated.promptTokens + current.promptTokens,
            cachedTokens: accumulated.cachedTokens + current.cachedTokens,
            outputTokens: accumulated.outputTokens + current.outputTokens,
        }),
        { promptTokens: 0, cachedTokens: 0, outputTokens: 0 },
    );
}

function printQualitySignals(report: ReplayReport): void {
    for (const fixtureResult of report.fixtures) {
        if (fixtureResult.missingExpected.length > 0) {
            console.log(`\n[FAIL] ${fixtureResult.fixture} — Draft fand diese erwarteten Findings NICHT:`);
            fixtureResult.missingExpected.forEach((missing) => console.log(`   - ${missing}`));
        }
        if (fixtureResult.refutedExpected.length > 0) {
            console.log(`\n[FAIL] ${fixtureResult.fixture} — FALSE REFUTATION (Draft fand es, Verifikation verwarf es):`);
            fixtureResult.refutedExpected.forEach((refuted) => console.log(`   - ${refuted}`));
        }
        if (fixtureResult.degradations.length > 0) {
            console.log(`\n[WARN] ${fixtureResult.fixture} — Degradationen: ${fixtureResult.degradations.join(', ')}`);
        }
    }
}

function printComparison(currentReport: ReplayReport, comparePath: string): void {
    const previousReport = JSON.parse(fs.readFileSync(comparePath, 'utf-8')) as ReplayReport;
    const previousCost = previousReport.totalCostUsd;
    const currentCost = currentReport.totalCostUsd;

    console.log(`\n=== Vergleich mit ${path.basename(comparePath)} (${previousReport.capturedAt}) ===`);
    if (previousCost === null || currentCost === null) {
        console.log('Kostenvergleich nicht möglich (mindestens ein Report ohne Preise).');
        return;
    }

    const costDeltaPercent = previousCost > 0 ? ((currentCost - previousCost) / previousCost) * 100 : 0;
    console.log(`Vorher: $${previousCost.toFixed(6)} | Jetzt: $${currentCost.toFixed(6)} | Delta: ${costDeltaPercent >= 0 ? '+' : ''}${costDeltaPercent.toFixed(1)}%`);
}

// =============================================================================
// Main
// =============================================================================

function readCliFlag(flagName: string): string | null {
    const flagIndex = process.argv.indexOf(flagName);
    return flagIndex >= 0 && process.argv[flagIndex + 1] ? process.argv[flagIndex + 1] : null;
}

async function resolvePricing(): Promise<{ pricing: PricingLookup; note: string }> {
    try {
        const pricing = await fetchVertexPricing(CASCADE_MODELS);
        const missingModels = CASCADE_MODELS.filter((modelId) => !pricing.has(modelId));

        if (missingModels.length > 0) {
            return {
                pricing,
                note: `Kein SKU im Billing-Katalog für: ${missingModels.join(', ')}`,
            };
        }
        return { pricing, note: 'Offizielle Preise aus der Cloud Billing Catalog API.' };
    } catch (pricingError: unknown) {
        if (pricingError instanceof PricingUnavailableError) {
            return { pricing: new Map(), note: pricingError.message };
        }
        throw pricingError;
    }
}

async function deleteReplayJobs(jobIds: readonly string[]): Promise<void> {
    // ON DELETE CASCADE räumt die Telemetrie-Zeilen mit ab.
    const { error: deleteError } = await supabase
        .from('review_jobs')
        .delete()
        .in('id', [...jobIds]);

    if (deleteError) {
        console.warn(`[Replay] Aufräumen fehlgeschlagen (Jobs bleiben in der DB): ${deleteError.message}`);
    }
}

export async function runCascadeReplay(): Promise<void> {
    const expectedByFixture = JSON.parse(
        fs.readFileSync(path.join(FIXTURES_DIR, 'expected.json'), 'utf-8'),
    ) as Record<string, ExpectedFinding[]>;

    const fixtureNames = fs.readdirSync(FIXTURES_DIR)
        .filter((fileName) => fileName.endsWith('.diff'))
        .sort();

    if (fixtureNames.length === 0) {
        throw new Error(`Keine .diff-Fixtures in ${FIXTURES_DIR} gefunden.`);
    }

    const { pricing, note: pricingNote } = await resolvePricing();
    const pricingAvailable = CASCADE_MODELS.every((modelId) => pricing.has(modelId));
    console.log(`[Replay] Preise: ${pricingNote}`);

    const ownerUserId = await resolveBudgetOwnerUserId();
    console.log(`[Replay] Pro-Budget-Owner: ${ownerUserId}`);

    const fixtureResults: FixtureReplayResult[] = [];
    for (const fixtureName of fixtureNames) {
        console.log(`\n[Replay] ${fixtureName} ...`);
        const combinedDiff = fs.readFileSync(path.join(FIXTURES_DIR, fixtureName), 'utf-8');
        fixtureResults.push(await replayFixture(
            fixtureName, combinedDiff, expectedByFixture[fixtureName] ?? [], ownerUserId,
        ));
    }

    const jobIds = fixtureResults.map((fixtureResult) => fixtureResult.jobId);
    const jobCosts = await aggregateJobCosts(jobIds, pricing);
    const report = buildReport(fixtureResults, jobCosts, pricingAvailable, pricingNote);

    printReport(report, jobCosts);

    const outPath = readCliFlag('--out') ?? path.join(FIXTURES_DIR, 'last-run.json');
    fs.writeFileSync(outPath, JSON.stringify({ ...report, jobCosts }, null, 2));
    console.log(`\nReport geschrieben: ${outPath}`);

    const comparePath = readCliFlag('--compare');
    if (comparePath) {
        printComparison(report, comparePath);
    }

    if (process.argv.includes('--keep')) {
        console.log('[Replay] --keep: Jobs und Telemetrie bleiben in der DB.');
    } else {
        await deleteReplayJobs(jobIds);
        console.log('[Replay] Replay-Jobs und ihre Telemetrie wieder entfernt.');
    }

    process.exitCode = report.parityPassed ? 0 : 1;
}
