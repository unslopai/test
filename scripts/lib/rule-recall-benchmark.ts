/**
 * Rule-Recall Benchmark — faehrt die ECHTE Router-Cascade ueber die
 * synthetischen Fixtures in fixtures/rule-recall/ und misst pro Golden-
 * Standard-Regel drei Groessen, die der 9-Diff-Replay nicht liefert:
 *
 *  1. Rule Recall:      Findet der Draft-Reviewer die gepflanzte Verletzung?
 *  2. Verifier Survival: Ueberlebt das Finding den blinden Claim-Verifier
 *                        (eine False Refutation faellt hier auf)?
 *  3. Clean Precision:   Loesen Negativ-Kontrollen (saubere Diffs) KEINE
 *                        CRITICAL-False-Positives aus?
 *
 * Jede Fixture ist ein Bundle mit per-File gepflanzter Regel und einem
 * `detectedEcosystems`-Wert, der das Dynamic Law Filtering exakt wie in
 * Produktion steuert. Grosse Bundles (>15 Dateien) routen pro-direct und
 * testen die Attention-Decay-Hypothese auf dem echten Pro-Pfad.
 *
 * Aufruf:
 *   npx tsx scripts/rule-recall-benchmark.ts
 *   npx tsx scripts/rule-recall-benchmark.ts --only r03           # Substring-Filter
 *   npx tsx scripts/rule-recall-benchmark.ts --out results/x.json # Report-Ziel
 *   npx tsx scripts/rule-recall-benchmark.ts --keep               # Jobs in DB behalten
 *   npx tsx scripts/rule-recall-benchmark.ts --cascade heuristicMaxDiffTokens=1,heuristicMaxFiles=1
 *                                                                 # CascadeConfig-Override (Force-Pro-Experimente,
 *                                                                 # LLM_LANE_QUALITY_SPEC §3.1); landet im Report-JSON
 *   npx tsx scripts/rule-recall-benchmark.ts --runs 3             # jede Fixture N-mal (Stabilitaet pro Regel)
 *   npx tsx scripts/rule-recall-benchmark.ts --bypass-filter      # Modell-Potenzial: jede Datei ans Modell
 *   npx tsx scripts/rule-recall-benchmark.ts --bypass-filter --ecosystems polyglot
 *                                                                 # Fixtures mit polyglotEcosystems im Manifest
 *                                                                 # laufen mit dem Law-Filter eines polyglotten Repos
 *
 * Zwei Pfade (LANGUAGE_COVERAGE_SPEC §7.1):
 *  - Produktionspfad (Default): das Modell bekommt nur, was `isReviewableFile`
 *    durchlaesst; eine Fixture ohne reviewbare Datei bekommt wie im Webhook nur
 *    den Pre-Scan (Route `deterministic`) oder bricht ab (nur Prosa).
 *  - Modell-Potenzial (`--bypass-filter`): jede Fixture-Datei erreicht das
 *    Modell. Das ist der Modus aller Laeufe bis 2026-09-30.
 * Jeder Report nennt seinen Pfad und zaehlt die Treffer getrennt nach der
 * Lane, die die Datei in Produktion erreicht.
 *
 * WARNUNG: echte LLM-Calls, echtes Pro-Eskalations-Budget des Dogfooding-Users.
 * RAG/Practices bleiben aus (reproduzierbare Baseline, wie im Replay-Rig).
 *
 * Exit-Codes: 0 = kein Regel-Miss, keine False Refutation, keine CRITICAL-FP
 *             auf Negativ-Kontrollen; 1 = mindestens einer davon; 2 = Infra.
 */
import * as fs from 'fs';
import * as path from 'path';

import { supabase } from '@/lib/supabase';
import {
    parseFixtureDiff,
    validateManifest,
} from '@/lib/benchmark/rule-recall-manifest';
import type {
    ExcludedRule,
    ParsedFixtureFile,
    RuleRecallManifest,
} from '@/lib/benchmark/rule-recall-manifest';
import {
    planModelPotentialPath,
    planProductionPath,
    resolveProductionLane,
} from '@/lib/benchmark/production-path';
import type { ProductionLane, ProductionPathPlan } from '@/lib/benchmark/production-path';
import { ALL_CONDITION_IDS } from '@/lib/pipeline/conditions';
import { buildCombinedDiff } from '@/lib/pipeline/helpers';
import { DEFAULT_CASCADE_CONFIG, INITIAL_CASCADE_STATE } from '@/lib/pipeline/defaults';
import { DEFAULT_PRESCAN_CONFIG, runPrescan } from '@unslop/prescan';
import type { PrescanFile } from '@unslop/prescan';
import { MODEL_DRAFT, MODEL_ESCALATION, MODEL_VERIFIER } from '@/lib/pipeline/models';
import { complexityRouterStep } from '@/lib/pipeline/steps/complexity-router-step';
import { draftReviewerStep } from '@/lib/pipeline/steps/draft-reviewer-step';
import { claimVerifierStep } from '@/lib/pipeline/steps/claim-verifier-step';
import { escalationReviewerStep } from '@/lib/pipeline/steps/escalation-reviewer-step';
import { secondOpinionReviewerStep } from '@/lib/pipeline/steps/second-opinion-reviewer-step';
import { integrityScorerStep } from '@/lib/pipeline/steps/integrity-scorer-step';
import type { PullRequestFile } from '@/lib/github';
import type { CascadeConfig, PipelineContext } from '@/lib/pipeline/types';

const RULE_RECALL_DIR = path.join(process.cwd(), 'fixtures', 'rule-recall');

// =============================================================================
// Manifest types (geteilt mit dem Offline-Vitest-Guard)
// =============================================================================

type ManifestEntry = RuleRecallManifest[string];
type ExpectedFinding = ManifestEntry['expected'][number];

interface IssueLike {
    readonly rule: string;
    readonly path: string;
    readonly line: number;
    readonly severity: string;
}

// =============================================================================
// Result types
// =============================================================================

interface PlantedRuleResult {
    readonly bundle: string;
    readonly path: string;
    readonly ruleContains: string;
    readonly caughtByDraft: boolean;
    /** Deterministische Lane: vom Pre-Scanner gefangen (verifier-exempt). */
    readonly caughtByPrescan: boolean;
    /** Pro-Zweitmeinung (LLM_LANE_QUALITY_SPEC §4) — additiv zum Draft. */
    readonly caughtBySecondOpinion: boolean;
    readonly survivedVerifier: boolean;
    /** Lane, die diese Datei in Produktion erreicht — unabhaengig vom Pfad des Laufs. */
    readonly productionLane: ProductionLane;
}

/** Welchen Pfad ein Lauf gefahren ist (LANGUAGE_COVERAGE_SPEC §7.1). */
type BenchmarkPathMode = 'production' | 'model-potential';

interface BenchmarkRunOptions {
    readonly pathMode: BenchmarkPathMode;
    /** --ecosystems polyglot: Manifest-Feld polyglotEcosystems ersetzt detectedEcosystems. */
    readonly usePolyglotEcosystems: boolean;
    readonly cascadeConfig: CascadeConfig;
    /** null ⇔ --prescan-only: die LLM-Kaskade laeuft nicht. */
    readonly ownerUserId: string | null;
}

interface FixtureResult {
    readonly fixture: string;
    readonly jobId: string;
    readonly route: string;
    readonly negativeControl: boolean;
    readonly fileCount: number;
    readonly draftFindingCount: number;
    readonly survivingFindingCount: number;
    readonly prescanFindingCount: number;
    readonly prescanDurationMs: number;
    readonly integrityScore: number | null;
    readonly planted: readonly PlantedRuleResult[];
    /** Nur Negativ-Kontrollen: ueberlebende Findings (unerwartet), beide Lanes. */
    readonly falsePositives: readonly { rule: string; path: string; severity: string; lane: 'llm' | 'prescan' }[];
    /** Gesetzt, wenn die Fixture an einem transienten Infra-/Modellfehler starb. */
    readonly error?: string;
    /** Nur bei --runs N > 1: 1-basierter Wiederholungsindex des Laufs. */
    readonly runIndex?: number;
}

// =============================================================================
// Fixture parsing (LF-Fixtures, CRLF-tolerant wie das Replay-Rig)
// =============================================================================

function parseFixtureFiles(fixtureName: string, combinedDiff: string): PullRequestFile[] {
    const sections = combinedDiff.split(/^=== FILE: /m).filter((section) => section.trim().length > 0);
    return sections.map((section) => {
        const headerMatch = /^(.+?) \((\w+)\) ===\r?\n([\s\S]*)$/.exec(section);
        if (!headerMatch) {
            throw new Error(`Fixture ${fixtureName}: Datei-Header nicht parsebar.`);
        }
        return {
            sha: 'rule-recall-fixture',
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
// Deterministische Prescan-Lane (Zero-Token; identische Engines wie Produktion)
// =============================================================================

interface PrescanLaneResult {
    readonly issues: readonly IssueLike[];
    readonly durationMs: number;
}

/**
 * Fixture-Patches sind vollstaendige Neu-Dateien (ein Hunk ab +1) — daraus
 * laesst sich der volle Dateiinhalt exakt rekonstruieren, den die AST-/
 * Config-Engines brauchen. Alles andere liefert ehrlich null (Degraded Mode).
 */
function reconstructFullContent(patch: string): string | null {
    const patchLines = patch.replace(/\r\n/g, '\n').split('\n');
    if (!/^@@ -\d+(?:,\d+)? \+1(?:,\d+)? @@/.test(patchLines[0] ?? '')) return null;
    if (patchLines.slice(1).some((line) => line.startsWith('@@'))) return null;

    const contentLines = patchLines.slice(1)
        .filter((line) => !line.startsWith('-') && line !== '\\ No newline at end of file')
        .map((line) => (line.startsWith('+') || line.startsWith(' ') ? line.substring(1) : line));
    return contentLines.join('\n');
}

async function runPrescanLane(fixtureFiles: readonly PullRequestFile[]): Promise<PrescanLaneResult> {
    const prescanFiles: PrescanFile[] = fixtureFiles.map((fixtureFile) => ({
        path: fixtureFile.filename,
        patch: (fixtureFile.patch ?? '').replace(/\r\n/g, '\n'),
        content: reconstructFullContent(fixtureFile.patch ?? ''),
    }));

    const prescanResult = await runPrescan({ files: prescanFiles }, DEFAULT_PRESCAN_CONFIG);
    return {
        issues: prescanResult.findings.map((finding) => ({
            rule: `${finding.ruleId} (${finding.ruleTitle})`,
            path: finding.path,
            line: finding.line,
            severity: finding.severity,
        })),
        durationMs: prescanResult.durationMs,
    };
}

// =============================================================================
// Cascade wiring (identisch zum Replay-Rig, RAG/Practices aus)
// =============================================================================

async function createBenchmarkJob(fixtureName: string): Promise<string> {
    const { data: insertedJob, error: insertError } = await supabase
        .from('review_jobs')
        .insert({
            payload: { rule_recall_benchmark: true, fixture: fixtureName },
            status: 'processing',
            source: 'manual',
        })
        .select('id')
        .single();
    if (insertError || !insertedJob) {
        throw new Error(`Benchmark-Job konnte nicht angelegt werden: ${insertError?.message}`);
    }
    return insertedJob.id as string;
}

async function resolveBudgetOwnerUserId(): Promise<string> {
    const { data: accountRow, error: lookupError } = await supabase
        .from('billing_accounts')
        .select('owner_user_id, status')
        .in('status', ['trialing', 'active', 'complimentary'])
        .limit(1)
        .maybeSingle();
    if (lookupError || !accountRow) {
        throw new Error(
            'Kein berechtigter billing_accounts-Eintrag — ohne ihn degradiert jede ' +
            'Pro-Eskalation als "Budget erschoepft" und die Messung waere wertlos.',
        );
    }
    return accountRow.owner_user_id as string;
}

interface CascadeInput {
    readonly fixtureFiles: readonly PullRequestFile[];
    readonly reviewableFiles: readonly PullRequestFile[];
    readonly detectedEcosystems: readonly string[] | null;
}

function buildContext(
    jobId: string,
    ownerUserId: string,
    cascadeInput: CascadeInput,
    cascadeConfig: CascadeConfig,
): PipelineContext {
    const { fixtureFiles, reviewableFiles, detectedEcosystems } = cascadeInput;
    return {
        jobId,
        repoFullName: 'rule-recall/benchmark',
        prNumber: 0,
        headSha: '',
        githubToken: '',
        authMode: 'oauth',
        repositoryId: null,
        ownerUserId,
        prFiles: fixtureFiles,
        reviewableFiles,
        // Wie diff-loader-step.ts: der Diff entsteht aus den reviewbaren Dateien.
        combinedDiff: buildCombinedDiff(reviewableFiles),
        omittedFiles: [],
        issues: [],
        reviewSummary: '',
        ragPromptSection: '',
        practicesPromptSection: '',
        // Der EINZIGE bewusste Unterschied zum Replay-Rig: das Dynamic Law
        // Filtering wird pro Fixture realistisch gesteuert, statt global aus.
        detectedEcosystems,
        promptConfig: {
            activeConditionIds: ALL_CONDITION_IDS,
            filePaths: reviewableFiles.map((reviewableFile) => reviewableFile.filename),
            overrideSmartDetection: false,
        },
        // Kein Job-Budget: der Harness misst Recall und Latenz ungedeckelt
        // (DEADLINE_GUARD_SPEC §3.1) — die Deadline-Pfade haben eigene Unit-Tests.
        jobStartedAtMs: Date.now(),
        deadlineAtMs: null,
        tokenUsage: null,
        cascade: INITIAL_CASCADE_STATE,
        cascadeConfig,
        prescanConfig: DEFAULT_PRESCAN_CONFIG,
        prescanIssues: [],
        prescanStats: null,
        llmSkipped: false,
        shouldAbort: false,
    };
}

function matchesAnyIssue(expected: ExpectedFinding, issues: readonly IssueLike[]): boolean {
    return issues.some((issue) =>
        issue.path === expected.path
        && expected.ruleContains.split('|').some((alt) => issue.rule.includes(alt)),
    );
}

interface CascadeLaneResult {
    readonly jobId: string;
    readonly route: string;
    readonly draftIssues: readonly IssueLike[];
    readonly secondOpinionIssues: readonly IssueLike[];
    readonly survivingIssues: readonly IssueLike[];
    readonly integrityScore: number | null;
}

async function runCascadeLane(
    fixtureName: string,
    cascadeInput: CascadeInput,
    ownerUserId: string,
    cascadeConfig: CascadeConfig,
): Promise<CascadeLaneResult> {
    const jobId = await createBenchmarkJob(fixtureName);

    const initial = buildContext(jobId, ownerUserId, cascadeInput, cascadeConfig);
    const routed = await complexityRouterStep.execute(initial);
    const drafted = await draftReviewerStep.execute(routed);
    const verified = await claimVerifierStep.execute(drafted);
    const escalated = await escalationReviewerStep.execute(verified);
    const secondOpined = await secondOpinionReviewerStep.execute(escalated);
    const scored = await integrityScorerStep.execute(secondOpined);

    return {
        jobId,
        route: scored.cascade.route,
        draftIssues: drafted.issues as unknown as IssueLike[],
        // Eigene Lane statt in "Draft" versteckt: der A/B-Vergleich gegen die
        // Referenz (reiner Flash-Draft) bleibt sonst nicht interpretierbar.
        secondOpinionIssues: secondOpined.issues
            .filter((issue) => issue.source === 'second-opinion-reviewer') as unknown as IssueLike[],
        survivingIssues: scored.issues as unknown as IssueLike[],
        integrityScore: scored.cascade.integrityScore,
    };
}

/** Law-Filter-Eingang einer Fixture: mit --ecosystems polyglot die Manifest-Variante, sonst der Standardwert. */
function resolveFixtureEcosystems(
    manifestEntry: ManifestEntry,
    usePolyglotEcosystems: boolean,
): readonly string[] | null {
    return usePolyglotEcosystems && manifestEntry.polyglotEcosystems
        ? manifestEntry.polyglotEcosystems
        : manifestEntry.detectedEcosystems;
}

function resolveRoute(cascadeLane: CascadeLaneResult | null, pathPlan: ProductionPathPlan): string {
    if (pathPlan.aborted) return 'aborted';
    if (pathPlan.reviewableFiles.length === 0) return 'deterministic';
    return cascadeLane?.route ?? 'prescan-only';
}

async function runFixture(
    fixtureName: string,
    manifestEntry: ManifestEntry,
    runOptions: BenchmarkRunOptions,
): Promise<FixtureResult> {
    const combinedDiff = fs.readFileSync(path.join(RULE_RECALL_DIR, fixtureName), 'utf-8');
    const fixtureFiles = parseFixtureFiles(fixtureName, combinedDiff);
    const productionPlan = planProductionPath(fixtureFiles);
    const pathPlan = runOptions.pathMode === 'production' ? productionPlan : planModelPotentialPath(fixtureFiles);

    const prescanLane = await runPrescanLane(pathPlan.prescanFiles);
    // Wie im Webhook: ohne reviewbare Datei laeuft keine Kaskade.
    const cascadeLane = runOptions.ownerUserId === null || pathPlan.reviewableFiles.length === 0
        ? null
        : await runCascadeLane(
            fixtureName,
            {
                fixtureFiles,
                reviewableFiles: pathPlan.reviewableFiles,
                detectedEcosystems: resolveFixtureEcosystems(manifestEntry, runOptions.usePolyglotEcosystems),
            },
            runOptions.ownerUserId,
            runOptions.cascadeConfig,
        );

    const draftIssues = cascadeLane?.draftIssues ?? [];
    const survivingIssues = cascadeLane?.survivingIssues ?? [];

    const planted: PlantedRuleResult[] = manifestEntry.expected.map((expected) => ({
        bundle: fixtureName,
        path: expected.path,
        ruleContains: expected.ruleContains,
        caughtByDraft: matchesAnyIssue(expected, draftIssues),
        caughtByPrescan: matchesAnyIssue(expected, prescanLane.issues),
        caughtBySecondOpinion: matchesAnyIssue(expected, cascadeLane?.secondOpinionIssues ?? []),
        survivedVerifier: matchesAnyIssue(expected, survivingIssues),
        productionLane: resolveProductionLane(expected.path, productionPlan),
    }));

    // Auf Negativ-Kontrollen ist JEDES Finding ein False Positive — aus beiden Lanes.
    const falsePositives = manifestEntry.negativeControl
        ? [
            ...survivingIssues.map((issue) => ({
                rule: issue.rule, path: issue.path, severity: issue.severity, lane: 'llm' as const,
            })),
            ...prescanLane.issues.map((issue) => ({
                rule: issue.rule, path: issue.path, severity: issue.severity, lane: 'prescan' as const,
            })),
        ]
        : [];

    return {
        fixture: fixtureName,
        jobId: cascadeLane?.jobId ?? '',
        route: resolveRoute(cascadeLane, pathPlan),
        negativeControl: manifestEntry.negativeControl,
        fileCount: fixtureFiles.length,
        draftFindingCount: draftIssues.length,
        survivingFindingCount: survivingIssues.length,
        prescanFindingCount: prescanLane.issues.length,
        prescanDurationMs: prescanLane.durationMs,
        integrityScore: cascadeLane?.integrityScore ?? null,
        planted,
        falsePositives,
    };
}

// =============================================================================
// Reporting
// =============================================================================

function readCliFlag(flagName: string): string | null {
    const flagIndex = process.argv.indexOf(flagName);
    return flagIndex >= 0 && process.argv[flagIndex + 1] ? process.argv[flagIndex + 1] : null;
}

/**
 * --cascade key=value,key=value — Experiment-Overrides der CascadeConfig
 * (LLM_LANE_QUALITY_SPEC §3.1). Bewusst STRIKT statt resolveCascadeConfig:
 * ein vertippter Key darf nicht stumm auf den Default zurueckfallen und ein
 * Force-Pro-Experiment als Normal-Lauf maskieren.
 */
function parseCascadeOverrides(rawOverrides: string | null): Partial<CascadeConfig> {
    if (!rawOverrides) return {};
    const validKeys = new Set(Object.keys(DEFAULT_CASCADE_CONFIG));
    const parsedOverrides: Record<string, number> = {};
    for (const assignment of rawOverrides.split(',').filter((entry) => entry.length > 0)) {
        const [overrideKey, rawValue] = assignment.split('=');
        const numericValue = Number(rawValue);
        if (!validKeys.has(overrideKey) || rawValue === undefined || !Number.isFinite(numericValue)) {
            throw new Error(
                `--cascade: "${assignment}" ist kein gueltiges key=Zahl-Paar ` +
                `(gueltige Keys: ${[...validKeys].join(', ')}).`,
            );
        }
        parsedOverrides[overrideKey] = numericValue;
    }
    return parsedOverrides as Partial<CascadeConfig>;
}

/** --ecosystems polyglot — einziger gueltiger Wert; ein Tippfehler darf nicht still den Standard fahren. */
function parseEcosystemsFlag(rawEcosystems: string | null): boolean {
    if (rawEcosystems === null) return false;
    if (rawEcosystems !== 'polyglot') {
        throw new Error(`--ecosystems: "${rawEcosystems}" ist ungueltig (einziger Wert: polyglot).`);
    }
    return true;
}

/** --runs N — Wiederholungen pro Fixture (Default 1, muss ganzzahlig >= 1 sein). */
function parseRunsPerFixture(rawRuns: string | null): number {
    if (rawRuns === null) return 1;
    const parsedRuns = Number(rawRuns);
    if (!Number.isInteger(parsedRuns) || parsedRuns < 1) {
        throw new Error(`--runs: "${rawRuns}" ist keine ganze Zahl >= 1.`);
    }
    return parsedRuns;
}

/**
 * Stabilitaets-Uebersicht bei --runs > 1: pro gepflanzter Regel, wie oft jede
 * Lane sie ueber die N Laeufe gefangen hat (x/N) — die N=1-Flake-Frage aus
 * der Benchmark-Hygiene (§16) direkt im Report beantwortet.
 */
function printStabilityByRule(results: readonly FixtureResult[], runsPerFixture: number): void {
    const tallies = new Map<string, { draftHits: number; prescanHits: number; secondOpinionHits: number; observed: number }>();
    for (const planted of results.flatMap((result) => result.planted)) {
        const ruleKey = `${planted.ruleContains} @ ${planted.path} (${planted.bundle})`;
        const tally = tallies.get(ruleKey)
            ?? { draftHits: 0, prescanHits: 0, secondOpinionHits: 0, observed: 0 };
        tally.observed += 1;
        if (planted.caughtByDraft) tally.draftHits += 1;
        if (planted.caughtByPrescan) tally.prescanHits += 1;
        if (planted.caughtBySecondOpinion) tally.secondOpinionHits += 1;
        tallies.set(ruleKey, tally);
    }
    console.log(`\n--- Stabilitaet pro Regel (${runsPerFixture} Laeufe) ---`);
    for (const [ruleKey, tally] of [...tallies.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        console.log(
            `   draft ${tally.draftHits}/${tally.observed} | prescan ${tally.prescanHits}/${tally.observed}` +
            ` | secop ${tally.secondOpinionHits}/${tally.observed}` +
            `${tally.observed < runsPerFixture ? ' | (Laeufe teilweise errored)' : ''} — ${ruleKey}`,
        );
    }
}

function pct(part: number, whole: number): string {
    return whole === 0 ? 'n/a' : `${((part / whole) * 100).toFixed(1)}%`;
}

const PATH_MODE_LABELS: Readonly<Record<BenchmarkPathMode, string>> = {
    production: 'PRODUKTIONSPFAD (Filter wie diff-loader; ohne reviewbare Datei nur Pre-Scan oder Abbruch)',
    'model-potential': 'MODELL-POTENZIAL (--bypass-filter: jede Datei erreicht das Modell)',
};

const PRODUCTION_LANE_LABELS: Readonly<Record<ProductionLane, string>> = {
    'model-and-prescan': 'Modell + Pre-Scan',
    'prescan-only': 'nur Pre-Scan',
    'not-scanned': 'keine Lane (Abbruch)',
};

function isCaughtByAnyLane(planted: PlantedRuleResult): boolean {
    return planted.caughtByDraft || planted.caughtByPrescan || planted.caughtBySecondOpinion;
}

/**
 * Treffer getrennt nach der Lane, die die Datei in Produktion erreicht. Im
 * Modell-Potenzial-Lauf zeigt das, welcher Teil der Zahl auf Dateien beruht,
 * die das Modell in Produktion nicht liest.
 */
function printRecallByProductionLane(allPlanted: readonly PlantedRuleResult[]): void {
    console.log('\n--- Treffer nach Produktions-Lane der Datei ---');
    for (const productionLane of Object.keys(PRODUCTION_LANE_LABELS) as ProductionLane[]) {
        const plantedInLane = allPlanted.filter((planted) => planted.productionLane === productionLane);
        const caughtInLane = plantedInLane.filter(isCaughtByAnyLane);
        console.log(
            `${PRODUCTION_LANE_LABELS[productionLane].padEnd(22)} ${caughtInLane.length}/${plantedInLane.length}`
            + ` (${pct(caughtInLane.length, plantedInLane.length)})`,
        );
    }
}

function printReport(results: readonly FixtureResult[], prescanOnly: boolean, pathMode: BenchmarkPathMode): boolean {
    const allPlanted = results.flatMap((result) => result.planted);
    const caught = allPlanted.filter((planted) => planted.caughtByDraft);
    const prescanCaught = allPlanted.filter((planted) => planted.caughtByPrescan);
    const secondOpinionCaught = allPlanted.filter((planted) => planted.caughtBySecondOpinion);
    // Kombiniert: Draft ODER deterministische Lane ODER Pro-Zweitmeinung
    // (Prescan-Findings sind verifier-exempt, Second-Opinion-Findings verdict-los).
    const combinedCaught = allPlanted.filter(
        (planted) => planted.caughtByDraft || planted.caughtByPrescan || planted.caughtBySecondOpinion,
    );
    const survivedCombined = allPlanted.filter((planted) => planted.survivedVerifier || planted.caughtByPrescan);
    const negativeControls = results.filter((result) => result.negativeControl);
    const criticalFps = negativeControls.flatMap((result) =>
        result.falsePositives.filter((fp) => fp.severity === 'CRITICAL'),
    );
    const warningFps = negativeControls.flatMap((result) =>
        result.falsePositives.filter((fp) => fp.severity !== 'CRITICAL'),
    );

    console.log(`\n=== Rule-Recall Benchmark (${new Date().toISOString()})${prescanOnly ? ' — PRESCAN-ONLY' : ''} ===`);
    console.log(`Pfad: ${PATH_MODE_LABELS[pathMode]}`);
    if (!prescanOnly) {
        console.log(`Draft/Verify: ${MODEL_DRAFT} / ${MODEL_VERIFIER} | Escalation: ${MODEL_ESCALATION}`);
    }
    console.log('');

    printFixtureTable(results);
    printAggregates({
        allPlanted, caught, prescanCaught, secondOpinionCaught, combinedCaught, survivedCombined,
        negativeControls, criticalFps, warningFps, prescanOnly,
    });
    printRecallByProductionLane(allPlanted);

    // Gating: prescan-only misst nur die deterministische Lane — Misses der
    // LLM-Regeln sind dort erwartbar und gaten nicht.
    // Im Produktionspfad liest das Modell nur reviewbare Dateien: ein Miss auf
    // einer Datei ohne Modell-Lane ist dort der gemessene Ist-Zustand, kein Fehler.
    const combinedMisses = allPlanted.filter(
        (planted) => !isCaughtByAnyLane(planted)
            && (pathMode === 'model-potential' || planted.productionLane === 'model-and-prescan'),
    );
    if (!prescanOnly && combinedMisses.length > 0) {
        console.log(`\n[MISS] Weder Draft noch Prescan fanden diese gepflanzten Regeln:`);
        for (const miss of combinedMisses) {
            console.log(`   - ${miss.ruleContains} @ ${miss.path} (${miss.bundle})`);
        }
    }

    const falseRefutations = allPlanted.filter((planted) => planted.caughtByDraft && !planted.survivedVerifier);
    if (falseRefutations.length > 0) {
        console.log(`\n[FALSE REFUTATION] Draft fand es, Verifier verwarf es:`);
        for (const refuted of falseRefutations) {
            console.log(`   - ${refuted.ruleContains} @ ${refuted.path} (${refuted.bundle})`);
        }
    }

    if (criticalFps.length > 0) {
        console.log(`\n[FALSE POSITIVE] CRITICAL-Findings auf Negativ-Kontrollen:`);
        for (const fp of criticalFps) {
            console.log(`   - [${fp.lane}] ${fp.rule} @ ${fp.path}`);
        }
    }

    const errored = results.filter((result) => result.error);
    if (errored.length > 0) {
        console.log(`\n[ERRORED] Fixtures mit Infra-/Modellfehler (Recall unbekannt, nicht bewertet):`);
        for (const result of errored) {
            console.log(`   - ${result.fixture}: ${(result.error ?? '').split('\n')[0]}`);
        }
    }

    const clean = (prescanOnly || (combinedMisses.length === 0 && falseRefutations.length === 0))
        && criticalFps.length === 0 && errored.length === 0;
    console.log(`\nBenchmark: ${clean ? 'PASSED' : 'FAILED'}`);
    return clean;
}

function printFixtureTable(results: readonly FixtureResult[]): void {
    console.log('Fixture                          | Route        | Files | Planted | Draft | Prescan | SecOp | Survived | Score');
    console.log('---------------------------------|--------------|-------|---------|-------|---------|-------|----------|------');
    for (const result of results) {
        const plantedCount = result.planted.length;
        const draftHits = result.planted.filter((planted) => planted.caughtByDraft).length;
        const prescanHits = result.planted.filter((planted) => planted.caughtByPrescan).length;
        const secondOpinionHits = result.planted.filter((planted) => planted.caughtBySecondOpinion).length;
        const survivedHits = result.planted
            .filter((planted) => planted.survivedVerifier || planted.caughtByPrescan).length;
        const label = result.negativeControl ? '(neg-ctrl)' : `${survivedHits}/${plantedCount}`;
        const fixtureLabel = result.runIndex ? `${result.fixture} #${result.runIndex}` : result.fixture;
        console.log(
            `${fixtureLabel.padEnd(32)} | ` +
            `${result.route.padEnd(12)} | ` +
            `${String(result.fileCount).padStart(5)} | ` +
            `${String(plantedCount || '-').padStart(7)} | ` +
            `${String(result.negativeControl ? '-' : draftHits).padStart(5)} | ` +
            `${String(result.negativeControl ? '-' : prescanHits).padStart(7)} | ` +
            `${String(result.negativeControl ? '-' : secondOpinionHits).padStart(5)} | ` +
            `${label.padStart(8)} | ` +
            `${String(result.integrityScore ?? 'n/a').padStart(5)}`,
        );
    }
}

interface AggregateNumbers {
    readonly allPlanted: readonly PlantedRuleResult[];
    readonly caught: readonly PlantedRuleResult[];
    readonly prescanCaught: readonly PlantedRuleResult[];
    readonly secondOpinionCaught: readonly PlantedRuleResult[];
    readonly combinedCaught: readonly PlantedRuleResult[];
    readonly survivedCombined: readonly PlantedRuleResult[];
    readonly negativeControls: readonly FixtureResult[];
    readonly criticalFps: readonly { severity: string }[];
    readonly warningFps: readonly { severity: string }[];
    readonly prescanOnly: boolean;
}

function printAggregates(numbers: AggregateNumbers): void {
    const total = numbers.allPlanted.length;
    console.log('\n--- Aggregate ---');
    console.log(`Planted violations:     ${total}`);
    if (!numbers.prescanOnly) {
        console.log(`Draft recall:           ${numbers.caught.length}/${total} (${pct(numbers.caught.length, total)})`);
    }
    console.log(`Prescan recall:         ${numbers.prescanCaught.length}/${total} (${pct(numbers.prescanCaught.length, total)})`);
    if (!numbers.prescanOnly && numbers.secondOpinionCaught.length > 0) {
        console.log(`Second-opinion recall:  ${numbers.secondOpinionCaught.length}/${total} (${pct(numbers.secondOpinionCaught.length, total)})`);
    }
    if (!numbers.prescanOnly) {
        console.log(`Combined recall:        ${numbers.combinedCaught.length}/${total} (${pct(numbers.combinedCaught.length, total)})`);
        console.log(`Surviving (combined):   ${numbers.survivedCombined.length}/${total} (${pct(numbers.survivedCombined.length, total)})`);
    }
    console.log(`Negative controls:      ${numbers.negativeControls.length} fixtures`);
    console.log(`  CRITICAL false pos:   ${numbers.criticalFps.length}`);
    console.log(`  WARNING false pos:    ${numbers.warningFps.length} (non-gating at --fail-on critical)`);
}

async function deleteJobs(jobIds: readonly string[]): Promise<void> {
    const { error: deleteError } = await supabase.from('review_jobs').delete().in('id', [...jobIds]);
    if (deleteError) {
        console.warn(`[benchmark] Aufraeumen fehlgeschlagen: ${deleteError.message}`);
    }
}

// =============================================================================
// Main
// =============================================================================

/**
 * Preflight: dieselbe Struktur-/Vollstaendigkeitspruefung wie der Vitest-Guard,
 * BEVOR echte LLM-Tokens ausgegeben werden. Zusaetzlich ein Live-Drift-Check
 * des Inventar-Snapshots gegen golden_standards (nur Warnung — der Benchmark
 * misst die Regeln, die der Prompt tatsaechlich rendert).
 */
async function preflight(manifest: RuleRecallManifest): Promise<void> {
    const inventoryFile = JSON.parse(
        fs.readFileSync(path.join(RULE_RECALL_DIR, 'rules-inventory.json'), 'utf-8'),
    ) as { rules: { rule_id: string; has_explanation: boolean }[] };
    const excludedFile = JSON.parse(
        fs.readFileSync(path.join(RULE_RECALL_DIR, 'excluded-rules.json'), 'utf-8'),
    ) as { excluded: ExcludedRule[] };

    const parsedFixtures: Record<string, ParsedFixtureFile[]> = {};
    for (const fixtureName of Object.keys(manifest)) {
        parsedFixtures[fixtureName] = parseFixtureDiff(
            fixtureName,
            fs.readFileSync(path.join(RULE_RECALL_DIR, fixtureName), 'utf-8'),
        );
    }

    const validation = validateManifest(manifest, parsedFixtures, {
        detectableRuleIds: inventoryFile.rules
            .filter((rule) => rule.has_explanation)
            .map((rule) => rule.rule_id),
        excludedRules: excludedFile.excluded,
    });
    if (validation.errors.length > 0 || validation.uncoveredRuleIds.length > 0) {
        throw new Error(
            `Fixture-Preflight fehlgeschlagen:\n` +
            [...validation.errors, ...validation.uncoveredRuleIds.map((r) => `Regel ohne Fixture: ${r}`)]
                .map((line) => `  - ${line}`).join('\n'),
        );
    }
    console.log(
        `[benchmark] Preflight ok: ${validation.plantedRuleIds.length} Regeln gepflanzt, ` +
        `${excludedFile.excluded.length} begruendet ausgeschlossen.`,
    );

    const { data: liveRules, error: liveError } = await supabase
        .from('golden_standards')
        .select('rule_id');
    if (liveError) {
        console.warn(`[benchmark] Live-Drift-Check nicht moeglich: ${liveError.message}`);
        return;
    }
    const snapshotIds = new Set(inventoryFile.rules.map((rule) => rule.rule_id));
    const liveIds = new Set((liveRules ?? []).map((row) => row.rule_id as string));
    const drift = [
        ...[...liveIds].filter((ruleId) => !snapshotIds.has(ruleId)).map((r) => `neu in DB: ${r}`),
        ...[...snapshotIds].filter((ruleId) => !liveIds.has(ruleId)).map((r) => `nicht mehr in DB: ${r}`),
    ];
    if (drift.length > 0) {
        console.warn(`[benchmark] WARNUNG — rules-inventory.json driftet: ${drift.join(', ')}`);
    }
}

export async function runRuleRecallBenchmark(): Promise<void> {
    const manifestPath = path.join(RULE_RECALL_DIR, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error('manifest.json fehlt in fixtures/rule-recall/.');
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as RuleRecallManifest;
    await preflight(manifest);

    // --only akzeptiert Komma-Listen von Substrings (z.B. --only r05,r07,r13,r17).
    const onlyFilter = readCliFlag('--only');
    const onlyPatterns = onlyFilter ? onlyFilter.split(',').filter((pattern) => pattern.length > 0) : null;
    const fixtureNames = Object.keys(manifest)
        .filter((name) => (onlyPatterns ? onlyPatterns.some((pattern) => name.includes(pattern)) : true))
        .sort();
    if (fixtureNames.length === 0) {
        throw new Error(`Keine passenden Fixtures (Filter: ${onlyFilter ?? 'kein'}).`);
    }

    // --prescan-only: nur die deterministische Lane — keine LLM-Calls, keine DB-Jobs.
    const prescanOnly = process.argv.includes('--prescan-only');
    const cascadeOverrides = parseCascadeOverrides(readCliFlag('--cascade'));
    const runsPerFixture = parseRunsPerFixture(readCliFlag('--runs'));
    const cascadeConfig: CascadeConfig = { ...DEFAULT_CASCADE_CONFIG, ...cascadeOverrides };
    const pathMode: BenchmarkPathMode = process.argv.includes('--bypass-filter') ? 'model-potential' : 'production';
    const usePolyglotEcosystems = parseEcosystemsFlag(readCliFlag('--ecosystems'));
    const ownerUserId = prescanOnly ? null : await resolveBudgetOwnerUserId();
    const runOptions: BenchmarkRunOptions = { pathMode, usePolyglotEcosystems, cascadeConfig, ownerUserId };
    console.log(`[benchmark] Pfad: ${PATH_MODE_LABELS[pathMode]}`);
    if (usePolyglotEcosystems) {
        console.log('[benchmark] --ecosystems polyglot: Fixtures mit polyglotEcosystems laufen mit dem Law-Filter eines polyglotten Repos.');
    }
    if (ownerUserId) console.log(`[benchmark] Pro-Budget-Owner: ${ownerUserId}`);
    if (Object.keys(cascadeOverrides).length > 0) {
        console.log(`[benchmark] EXPERIMENT — CascadeConfig-Overrides: ${JSON.stringify(cascadeOverrides)}`);
    }
    console.log(
        `[benchmark] ${fixtureNames.length} Fixtures${prescanOnly ? ' (prescan-only)' : ''}` +
        `${runsPerFixture > 1 ? ` × ${runsPerFixture} Laeufe` : ''}\n`,
    );

    const results: FixtureResult[] = [];
    for (let runIndex = 1; runIndex <= runsPerFixture; runIndex++) {
        for (const fixtureName of fixtureNames) {
            const runLabel = runsPerFixture > 1 ? `${fixtureName} [Lauf ${runIndex}]` : fixtureName;
            console.log(`[benchmark] ${runLabel} ...`);
            const runIndexField = runsPerFixture > 1 ? { runIndex } : {};
            try {
                const fixtureResult = await runFixture(fixtureName, manifest[fixtureName], runOptions);
                results.push({ ...fixtureResult, ...runIndexField });
            } catch (fixtureError: unknown) {
                // Ein transienter Modell-/Infra-Fehler auf EINER Fixture darf nicht
                // die restlichen 19 Ergebnisse vernichten (INFRA-002-Haltung): die
                // Fixture wird als errored vermerkt und der Lauf geht weiter. Der
                // finale Exit-Code faellt trotzdem auf 1, damit der Fehler nicht
                // als sauberer Durchlauf durchrutscht.
                const message = fixtureError instanceof Error ? fixtureError.message : String(fixtureError);
                console.log(`[benchmark] ${runLabel} — FEHLER, übersprungen: ${message.split('\n')[0]}`);
                results.push({
                    fixture: fixtureName,
                    jobId: '',
                    route: 'errored',
                    negativeControl: manifest[fixtureName].negativeControl,
                    fileCount: 0,
                    draftFindingCount: 0,
                    survivingFindingCount: 0,
                    prescanFindingCount: 0,
                    prescanDurationMs: 0,
                    integrityScore: null,
                    planted: [],
                    falsePositives: [],
                    error: message,
                    ...runIndexField,
                });
            }
        }
    }

    const clean = printReport(results, prescanOnly, pathMode);
    if (runsPerFixture > 1) {
        printStabilityByRule(results, runsPerFixture);
    }

    const outPath = readCliFlag('--out') ?? path.join(RULE_RECALL_DIR, 'results', 'last-run.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({
        capturedAt: new Date().toISOString(),
        models: { draft: MODEL_DRAFT, verifier: MODEL_VERIFIER, escalation: MODEL_ESCALATION },
        // Experiment-Kennzeichnung (LLM_LANE_QUALITY_SPEC §3.1): ein Force-Pro-
        // Ergebnis darf nie als Normal-Lauf lesbar sein.
        cascadeOverrides: Object.keys(cascadeOverrides).length > 0 ? cascadeOverrides : null,
        runsPerFixture,
        // LANGUAGE_COVERAGE_SPEC §7.1: ein Modell-Potenzial-Ergebnis darf nie
        // als Produktionspfad lesbar sein.
        pathMode,
        ecosystems: usePolyglotEcosystems ? 'polyglot' : 'manifest',
        results,
    }, null, 2));
    console.log(`\nReport geschrieben: ${outPath}`);

    if (process.argv.includes('--keep')) {
        console.log('[benchmark] --keep: Jobs bleiben in der DB.');
    } else {
        await deleteJobs(results.map((result) => result.jobId).filter((jobId) => jobId !== ''));
        console.log('[benchmark] Benchmark-Jobs entfernt.');
    }

    process.exitCode = clean ? 0 : 1;
}
