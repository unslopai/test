/**
 * Schattenlauf der Modell-Review auf echten Pull Requests oeffentlicher Repos
 * (LANGUAGE_COVERAGE_SPEC §6.4, Gate G8).
 *
 * Die Rule-Recall-Fixtures messen, ob gepflanzte Verstoesse gefunden werden.
 * Sie sagen nichts darueber, wie oft die Modell-Review auf echtem Code einer
 * neuen Sprache falschen Alarm schlaegt. Dieser Lauf faehrt die echte Kaskade
 * (Router, Draft, Verifier, Scorer) ueber die Diffs einer festen PR-Liste und
 * schreibt jedes ueberlebende Finding mit Zitat und Kritik in einen Report.
 * Das Urteil „Fehlalarm oder nicht“ faellt danach ein Mensch, nicht das Skript.
 *
 * Aufruf:
 *   npx tsx scripts/shadow-run.ts --list <prs.json> --plan      # 0 Token: Dateien, Tokens, Route je PR
 *   npx tsx scripts/shadow-run.ts --list <prs.json> --detect    # 0 Token: Oekosystem-Erkennung je Repo
 *   npx tsx scripts/shadow-run.ts --list <prs.json> --llm-extensions .py,.java --out <report.json>
 *
 * Wie in Produktion: Dateifilter `isReviewableFile` mit dem Review-Umfang des
 * Laufs, Groessen-Cap `trimReviewableFiles`, Law-Filter mit den Oekosystemen
 * des Repos aus der Liste. Anders als in Produktion: kein RAG, keine Reference
 * Practices, kein Job-Budget, kein Pre-Scan — und nie eine Eskalation. Ein PR
 * ueber der Router-Heuristik liefe in Produktion pro-direct; er wird hier nicht
 * gefahren, sondern als `skipped` gemeldet.
 *
 * WARNUNG: echte LLM-Calls. Die Jobs bleiben fuer `benchmark-cost.ts` in der DB.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';

import { parseUnifiedDiff } from '@/lib/pipeline/steps/cli-diff-loader-step';
import { DEFAULT_CASCADE_CONFIG } from '@/lib/pipeline/defaults';
import { trimReviewableFiles } from '@/lib/pipeline/diff-utils';
import { detectRepoEcosystems } from '@/lib/pipeline/ecosystem-detection';
import { buildCombinedDiff, isReviewableFile } from '@/lib/pipeline/helpers';
import {
    parseLlmExtensionsFlag,
    readCliFlag,
    resolveBudgetOwnerUserId,
    runCascadeLane,
} from './rule-recall-benchmark';
import type { SuppressedEscalation } from './rule-recall-benchmark';
import type { PullRequestFile } from '@/lib/github';
import type { PipelineIssue } from '@/lib/pipeline/types';

const CHARS_PER_TOKEN_ESTIMATE = 4;
const GITHUB_FETCH_HEADERS = { 'User-Agent': 'unslop-shadow-run' };

// =============================================================================
// PR-Liste (strukturell validiert: die Datei ist externer Input)
// =============================================================================

interface ShadowPullRequest {
    readonly language: string;
    readonly repo: string;
    readonly pr: number;
    /** Wie `repositories.detected_ecosystems`; null = Erkennung nie gelaufen. */
    readonly detectedEcosystems: readonly string[] | null;
}

function parseEcosystemList(rawEcosystems: unknown, entryLabel: string): readonly string[] | null {
    if (rawEcosystems === null) return null;
    if (Array.isArray(rawEcosystems) && rawEcosystems.every((ecosystem) => typeof ecosystem === 'string')) {
        return rawEcosystems;
    }
    throw new Error(`${entryLabel}: detectedEcosystems muss null oder eine String-Liste sein.`);
}

function parseShadowPullRequest(rawEntry: unknown, entryIndex: number): ShadowPullRequest {
    const entryLabel = `PR-Liste, Eintrag ${entryIndex}`;
    if (!rawEntry || typeof rawEntry !== 'object') throw new Error(`${entryLabel}: kein Objekt.`);
    const { language, repo, pr, detectedEcosystems } = rawEntry as Record<string, unknown>;
    if (typeof language !== 'string' || typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
        throw new Error(`${entryLabel}: language und repo ("owner/name") fehlen oder sind ungueltig.`);
    }
    if (typeof pr !== 'number' || !Number.isInteger(pr) || pr < 1) {
        throw new Error(`${entryLabel}: pr muss eine positive ganze Zahl sein.`);
    }
    return { language, repo, pr, detectedEcosystems: parseEcosystemList(detectedEcosystems, entryLabel) };
}

function loadShadowPullRequests(listPath: string): ShadowPullRequest[] {
    const rawList: unknown = JSON.parse(fs.readFileSync(listPath, 'utf-8'));
    if (!Array.isArray(rawList) || rawList.length === 0) {
        throw new Error(`${listPath}: erwartet wird eine nicht leere Liste von PRs.`);
    }
    return rawList.map((rawEntry, entryIndex) => parseShadowPullRequest(rawEntry, entryIndex));
}

// =============================================================================
// Diff laden und wie der Diff-Loader filtern
// =============================================================================

interface ShadowDiffPlan {
    readonly diffSha256: string;
    readonly changedFiles: readonly PullRequestFile[];
    readonly reviewableFiles: readonly PullRequestFile[];
    readonly omittedFilePaths: readonly string[];
    readonly estimatedDiffTokens: number;
    /** true = Produktion wuerde pro-direct routen; der Schattenlauf faehrt den PR nicht. */
    readonly exceedsRouterHeuristic: boolean;
}

async function fetchText(resourceUrl: string): Promise<string> {
    const response = await fetch(resourceUrl, { headers: GITHUB_FETCH_HEADERS });
    if (!response.ok) throw new Error(`${resourceUrl} antwortet mit HTTP ${response.status}.`);
    return await response.text();
}

async function planShadowDiff(
    shadowPullRequest: ShadowPullRequest,
    llmExtensions: readonly string[],
): Promise<ShadowDiffPlan> {
    const rawDiff = await fetchText(`https://github.com/${shadowPullRequest.repo}/pull/${shadowPullRequest.pr}.diff`);
    const changedFiles = parseUnifiedDiff(rawDiff.replace(/\r\n/g, '\n'));
    const candidateFiles = changedFiles.filter(
        (changedFile) => changedFile.patch && isReviewableFile(changedFile.filename, llmExtensions),
    );
    const { trimmedFiles: reviewableFiles, omittedFilePaths } = trimReviewableFiles(candidateFiles);
    const estimatedDiffTokens = Math.ceil(buildCombinedDiff(reviewableFiles).length / CHARS_PER_TOKEN_ESTIMATE);
    return {
        diffSha256: createHash('sha256').update(rawDiff, 'utf-8').digest('hex'),
        changedFiles,
        reviewableFiles,
        omittedFilePaths,
        estimatedDiffTokens,
        exceedsRouterHeuristic: estimatedDiffTokens > DEFAULT_CASCADE_CONFIG.heuristicMaxDiffTokens
            || reviewableFiles.length > DEFAULT_CASCADE_CONFIG.heuristicMaxFiles,
    };
}

// =============================================================================
// Lauf
// =============================================================================

type ShadowFinding = Pick<
    PipelineIssue,
    'rule' | 'severity' | 'path' | 'line' | 'exactQuote' | 'critique' | 'source'
>;

interface ShadowRunResult extends ShadowPullRequest {
    readonly diffSha256: string;
    readonly changedFileCount: number;
    readonly reviewableFileCount: number;
    readonly omittedFilePaths: readonly string[];
    readonly estimatedDiffTokens: number;
    readonly status: 'reviewed' | 'skipped' | 'errored';
    /** Grund eines `skipped` oder `errored`. */
    readonly statusReason?: string;
    readonly jobId: string;
    readonly route: string;
    readonly suppressedEscalations: readonly SuppressedEscalation[];
    readonly findings: readonly ShadowFinding[];
}

function describeSkipReason(diffPlan: ShadowDiffPlan): string | null {
    if (diffPlan.reviewableFiles.length === 0) return 'keine Datei erreicht die Modell-Review';
    if (diffPlan.exceedsRouterHeuristic) return 'ueber der Router-Heuristik: Produktion wuerde pro-direct routen';
    return null;
}

function buildUnreviewedResult(
    shadowPullRequest: ShadowPullRequest,
    diffPlan: ShadowDiffPlan,
    outcome: Pick<ShadowRunResult, 'status' | 'statusReason'>,
): ShadowRunResult {
    return {
        ...shadowPullRequest,
        diffSha256: diffPlan.diffSha256,
        changedFileCount: diffPlan.changedFiles.length,
        reviewableFileCount: diffPlan.reviewableFiles.length,
        omittedFilePaths: diffPlan.omittedFilePaths,
        estimatedDiffTokens: diffPlan.estimatedDiffTokens,
        ...outcome,
        jobId: '',
        route: 'none',
        suppressedEscalations: [],
        findings: [],
    };
}

function toShadowFinding(survivingIssue: PipelineIssue): ShadowFinding {
    return {
        rule: survivingIssue.rule,
        severity: survivingIssue.severity,
        path: survivingIssue.path,
        line: survivingIssue.line,
        exactQuote: survivingIssue.exactQuote,
        critique: survivingIssue.critique,
        source: survivingIssue.source,
    };
}

async function reviewShadowPullRequest(
    shadowPullRequest: ShadowPullRequest,
    llmExtensions: readonly string[],
    ownerUserId: string,
): Promise<ShadowRunResult> {
    const diffPlan = await planShadowDiff(shadowPullRequest, llmExtensions);
    const skipReason = describeSkipReason(diffPlan);
    if (skipReason !== null) {
        return buildUnreviewedResult(shadowPullRequest, diffPlan, { status: 'skipped', statusReason: skipReason });
    }

    try {
        const cascadeLane = await runCascadeLane(
            `shadow:${shadowPullRequest.repo}#${shadowPullRequest.pr}`,
            {
                fixtureFiles: diffPlan.changedFiles,
                reviewableFiles: diffPlan.reviewableFiles,
                detectedEcosystems: shadowPullRequest.detectedEcosystems,
            },
            { ownerUserId, cascadeConfig: DEFAULT_CASCADE_CONFIG, llmExtensions, allowEscalation: false },
        );
        return {
            ...buildUnreviewedResult(shadowPullRequest, diffPlan, { status: 'reviewed' }),
            jobId: cascadeLane.jobId,
            route: cascadeLane.route,
            suppressedEscalations: cascadeLane.suppressedEscalations,
            findings: cascadeLane.survivingIssues.map(toShadowFinding),
        };
    } catch (cascadeFailure: unknown) {
        // Ein transienter Modellfehler auf EINEM PR darf die uebrigen Ergebnisse
        // nicht vernichten: der PR steht als errored im Report, und der
        // Exit-Code des Laufs faellt auf 1.
        const failureMessage = cascadeFailure instanceof Error ? cascadeFailure.message : String(cascadeFailure);
        console.error(`[shadow] ${shadowPullRequest.repo}#${shadowPullRequest.pr} — FEHLER: ${failureMessage}`);
        return buildUnreviewedResult(shadowPullRequest, diffPlan, { status: 'errored', statusReason: failureMessage });
    }
}

// =============================================================================
// Modi ohne Token
// =============================================================================

async function printPlan(shadowPullRequests: readonly ShadowPullRequest[], llmExtensions: readonly string[]): Promise<void> {
    for (const shadowPullRequest of shadowPullRequests) {
        const diffPlan = await planShadowDiff(shadowPullRequest, llmExtensions);
        console.log(
            `${shadowPullRequest.language.padEnd(7)} ${`${shadowPullRequest.repo}#${shadowPullRequest.pr}`.padEnd(40)} `
            + `Dateien ${diffPlan.reviewableFiles.length}/${diffPlan.changedFiles.length}, `
            + `~${diffPlan.estimatedDiffTokens} Tokens, ${describeSkipReason(diffPlan) ?? 'flash-cascade'}`,
        );
    }
}

interface GitTreeResponse {
    readonly treePaths: readonly string[];
    readonly truncated: boolean;
}

function parseGitTreeResponse(rawResponse: unknown, repo: string): GitTreeResponse {
    if (!rawResponse || typeof rawResponse !== 'object' || !('tree' in rawResponse) || !Array.isArray(rawResponse.tree)) {
        throw new Error(`${repo}: Tree-Antwort ohne tree-Liste.`);
    }
    const treePaths = rawResponse.tree.flatMap((treeEntry: unknown) =>
        (treeEntry && typeof treeEntry === 'object' && 'path' in treeEntry && typeof treeEntry.path === 'string'
            ? [treeEntry.path]
            : []));
    return { treePaths, truncated: 'truncated' in rawResponse && rawResponse.truncated === true };
}

/** Dieselbe Erkennung wie beim Ingest, auf dem Default-Branch von heute. */
async function printDetectedEcosystems(shadowPullRequests: readonly ShadowPullRequest[]): Promise<void> {
    const repos = [...new Set(shadowPullRequests.map((shadowPullRequest) => shadowPullRequest.repo))];
    for (const repo of repos) {
        const rawTree: unknown = JSON.parse(
            await fetchText(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`),
        );
        const { treePaths, truncated } = parseGitTreeResponse(rawTree, repo);
        const detectedEcosystems = await detectRepoEcosystems(
            treePaths,
            (manifestPath) => fetchText(`https://raw.githubusercontent.com/${repo}/HEAD/${manifestPath}`),
        );
        console.log(
            `${repo}: ${JSON.stringify(detectedEcosystems)} (${treePaths.length} Pfade`
            + `${truncated ? ', Tree von GitHub gekuerzt' : ''})`,
        );
    }
}

// =============================================================================
// Entry
// =============================================================================

export async function runShadowRun(): Promise<void> {
    const listPath = readCliFlag('--list');
    if (listPath === null) throw new Error('--list <prs.json> fehlt.');
    const shadowPullRequests = loadShadowPullRequests(listPath);
    const llmExtensions = parseLlmExtensionsFlag(readCliFlag('--llm-extensions'));

    if (process.argv.includes('--detect')) return await printDetectedEcosystems(shadowPullRequests);
    if (process.argv.includes('--plan')) return await printPlan(shadowPullRequests, llmExtensions);

    const outPath = readCliFlag('--out');
    if (outPath === null) throw new Error('--out <report.json> fehlt.');
    const ownerUserId = await resolveBudgetOwnerUserId();
    console.log(`[shadow] ${shadowPullRequests.length} PRs, Modell-Review liest zusaetzlich zu JS/TS: ${llmExtensions.join(', ') || 'nichts'}; keine Eskalation.`);

    const shadowResults: ShadowRunResult[] = [];
    for (const shadowPullRequest of shadowPullRequests) {
        console.log(`[shadow] ${shadowPullRequest.repo}#${shadowPullRequest.pr} ...`);
        shadowResults.push(await reviewShadowPullRequest(shadowPullRequest, llmExtensions, ownerUserId));
        // Nach jedem PR schreiben: ein abgebrochener Lauf verliert keine bezahlten Ergebnisse.
        fs.writeFileSync(outPath, JSON.stringify({
            capturedAt: new Date().toISOString(),
            llmExtensions,
            escalation: 'disabled',
            results: shadowResults,
        }, null, 2));
    }

    const criticalCount = shadowResults
        .flatMap((shadowResult) => shadowResult.findings)
        .filter((shadowFinding) => shadowFinding.severity === 'CRITICAL').length;
    const erroredCount = shadowResults.filter((shadowResult) => shadowResult.status === 'errored').length;
    console.log(`[shadow] Report: ${outPath} — ${criticalCount} CRITICAL zu sichten, ${erroredCount} PRs mit Fehler.`);
    process.exitCode = erroredCount > 0 ? 1 : 0;
}
