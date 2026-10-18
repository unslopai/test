/**
 * runPrescan — Orchestrierung des deterministischen Pre-Scanners.
 *
 * Pro Datei: Sprach-Erkennung → billige Engines zuerst (regex, config) →
 * tree-sitter → ESLint; Registry-Checks (Netzwerk) über alle Dateien am Ende.
 * Whole-File-Analyse, Added-Line-Reporting (§7.2); zwei Fehler-Ebenen (§7.5):
 * hier die innere (pro Datei × Engine → skippedChecks), die äußere liegt im
 * Pipeline-Step (Soft-Launch Fail-Safe Gate §5.4).
 */
import { readFileSync } from 'node:fs';
import * as nodePath from 'node:path';
import { extractAddedLines, extractNewFileLinesFromPatch } from './diff/added-lines';
import { detectLanguage, hasTreeSitterGrammar, isTestFile } from './language';
import type { PrescanLanguage } from './language';
import { isNextConfigPath, runConfigFileChecks } from './engines/config';
import { runEslintEngine } from './engines/eslint-engine';
import { runRegexEngine } from './engines/regex-engine';
import { runRegistryEngine } from './engines/registry-engine';
import { readPackageJsonName } from './engines/registry/package-json-deps';
import { runTreeSitterEngine } from './engines/tree-sitter-engine';
import { IMPLEMENTED_RULE_IDS } from './rules/registry';
import type { RegistryEngineFile } from './engines/registry-engine';
import type {
    PrescanCompanionFile,
    PrescanConfig,
    PrescanEngineVersions,
    PrescanFile,
    PrescanFinding,
    PrescanInput,
    PrescanPorts,
    PrescanResult,
    SkippedCheck,
    SkippedFile,
} from './types';

export * from './types';
export { DEFAULT_PRESCAN_CONFIG, resolvePrescanConfig } from './config';
export { RULE_REGISTRY, IMPLEMENTED_RULE_IDS } from './rules/registry';
export { detectLanguage, isDeterministicLaneFile, isTestFile } from './language';
export { extractAddedLines } from './diff/added-lines';
export { shannonEntropy } from './engines/regex-engine';

export const PRESCAN_CORE_VERSION = '0.5.0';

interface FileScanState {
    readonly config: PrescanConfig;
    readonly enabledRuleIds: ReadonlySet<string>;
    /** Alle sichtbaren `next.config.*` (Diff + Begleitdateien) für SEC-019. */
    readonly nextConfigs: readonly PrescanCompanionFile[];
    readonly findings: PrescanFinding[];
    readonly skippedChecks: SkippedCheck[];
    readonly filesSkipped: SkippedFile[];
    readonly registryFiles: RegistryEngineFile[];
    filesScanned: number;
}

export async function runPrescan(
    input: PrescanInput,
    config: PrescanConfig,
    ports: PrescanPorts = {},
): Promise<PrescanResult> {
    const clock = ports.now ?? Date.now;
    const startedAt = clock();
    const rulesDisabled = IMPLEMENTED_RULE_IDS.filter((ruleId) => config.ruleOverrides[ruleId] === false);
    const enabledRuleIds = new Set(IMPLEMENTED_RULE_IDS.filter((ruleId) => config.ruleOverrides[ruleId] !== false));

    const scanState: FileScanState = {
        config,
        enabledRuleIds,
        nextConfigs: collectNextConfigs(input),
        findings: [],
        skippedChecks: [],
        filesSkipped: [],
        registryFiles: [],
        filesScanned: 0,
    };

    for (const file of input.files) {
        if (clock() - startedAt > config.totalBudgetMs) {
            // Budget erschöpft: verbleibende Dateien LAUT überspringen — eine
            // übersprungene Datei wird nie als clean gemeldet (§7.4).
            scanState.filesSkipped.push({ path: file.path, reason: 'budget-exhausted' });
            continue;
        }
        await scanSingleFile(scanState, file);
        ports.onFileScanned?.(file.path);
    }

    if (config.registryChecks && enabledRuleIds.has('SEC-035')) {
        const registryResult = await runRegistryEngine(
            scanState.registryFiles, ports, { firstPartyPackages: collectWorkspacePackageNames(input) },
        );
        scanState.findings.push(...registryResult.findings);
        scanState.skippedChecks.push(...registryResult.skippedChecks);
    }

    const reportableFindings = dedupeFindings(
        scanState.findings.filter((finding) => enabledRuleIds.has(finding.ruleId)),
    );

    return {
        findings: reportableFindings,
        filesScanned: scanState.filesScanned,
        filesSkipped: scanState.filesSkipped,
        skippedChecks: scanState.skippedChecks,
        rulesEvaluated: enabledRuleIds.size,
        rulesDisabled,
        durationMs: clock() - startedAt,
        engineVersions: resolveEngineVersions(),
    };
}

// =============================================================================
// Datei-Scan (innere Fail-Safe-Ebene: pro Datei × Engine)
// =============================================================================

async function scanSingleFile(scanState: FileScanState, file: PrescanFile): Promise<void> {
    const language = detectLanguage(file.path);
    const addedLines = extractAddedLines(file.patch);
    if (addedLines.size === 0) return;

    if (file.content !== null && byteLengthOf(file.content) > scanState.config.maxFileBytes) {
        scanState.filesSkipped.push({ path: file.path, reason: 'size-cap' });
        return;
    }

    scanState.filesScanned += 1;
    const lineTexts = file.content !== null
        ? buildFullContentLineMap(file.content)
        : extractNewFileLinesFromPatch(file.patch);

    runEngineSafely(scanState, file.path, 'regex', () => {
        const regexFindings = runRegexEngine({ path: file.path, language, lines: lineTexts });
        scanState.findings.push(...filterToAddedLines(regexFindings, addedLines));
    });

    scanState.registryFiles.push({
        path: file.path,
        language,
        addedLineTexts: restrictLineMap(lineTexts, addedLines),
        lineTexts: needsLineContext(file.path, language) ? lineTexts : undefined,
    });

    if (file.content === null) {
        // Patch-only Degraded Mode (§7.1): AST-/Config-Regeln brauchen die
        // ganze Datei — ehrlich als übersprungen protokollieren.
        scanState.skippedChecks.push({ ruleId: '*', reason: 'patch-only-input', path: file.path });
        return;
    }
    const fullContent = file.content;

    runEngineSafely(scanState, file.path, 'config', () => {
        const configResult = runConfigFileChecks({
            path: file.path, language, source: fullContent, nextConfigs: scanState.nextConfigs,
        });
        scanState.findings.push(...filterToAddedLines(configResult.findings, addedLines));
        scanState.skippedChecks.push(...configResult.skippedChecks);
    });
    if (!hasTreeSitterGrammar(language)) return;

    await runEngineSafelyAsync(scanState, file.path, 'tree-sitter', async () => {
        const astFindings = await runTreeSitterEngine({
            path: file.path,
            language,
            source: fullContent,
            isTestFile: isTestFile(file.path),
        });
        scanState.findings.push(...filterToAddedLines(astFindings, addedLines));
    });

    if (language === 'typescript' || language === 'tsx' || language === 'javascript') {
        runEngineSafely(scanState, file.path, 'eslint', () => {
            const eslintFindings = runEslintEngine({
                path: file.path,
                language,
                source: fullContent,
                isTestFile: isTestFile(file.path),
            });
            scanState.findings.push(...filterToAddedLines(eslintFindings, addedLines));
        });
    }
}

function runEngineSafely(scanState: FileScanState, path: string, engineName: string, engineRun: () => void): void {
    try {
        engineRun();
    } catch (engineError: unknown) {
        recordEngineFailure(scanState, path, engineName, engineError);
    }
}

async function runEngineSafelyAsync(
    scanState: FileScanState,
    path: string,
    engineName: string,
    engineRun: () => Promise<void>,
): Promise<void> {
    try {
        await engineRun();
    } catch (engineError: unknown) {
        recordEngineFailure(scanState, path, engineName, engineError);
    }
}

function recordEngineFailure(scanState: FileScanState, path: string, engineName: string, engineError: unknown): void {
    const errorMessage = engineError instanceof Error ? engineError.message : String(engineError);
    console.error(`[Prescan] Engine ${engineName} failed for ${path}: ${errorMessage}`);
    scanState.skippedChecks.push({ ruleId: '*', reason: `${engineName}-error: ${errorMessage}`, path });
}

// =============================================================================
// Added-Line-Filter & Helfer
// =============================================================================

/** Ein Finding überlebt, wenn [line, endLine] die Added-Line-Menge schneidet
 *  oder es file-level ist (dann auf die erste Added-Line verankert, §7.2). */
function filterToAddedLines(
    findings: readonly PrescanFinding[],
    addedLines: ReadonlySet<number>,
): PrescanFinding[] {
    const firstAddedLine = Math.min(...addedLines);

    return findings.flatMap((finding) => {
        if (finding.fileLevel) {
            return [{ ...finding, line: firstAddedLine, endLine: firstAddedLine }];
        }
        for (let candidateLine = finding.line; candidateLine <= finding.endLine; candidateLine += 1) {
            if (addedLines.has(candidateLine)) return [finding];
        }
        return [];
    });
}

function dedupeFindings(findings: readonly PrescanFinding[]): PrescanFinding[] {
    const seenKeys = new Set<string>();
    return findings.filter((finding) => {
        const dedupeKey = `${finding.ruleId}:${finding.path}:${finding.line}`;
        if (seenKeys.has(dedupeKey)) return false;
        seenKeys.add(dedupeKey);
        return true;
    });
}

function buildFullContentLineMap(content: string): ReadonlyMap<number, string> {
    const lineMap = new Map<number, string>();
    content.split('\n').forEach((lineText, lineIndex) => {
        lineMap.set(lineIndex + 1, lineText);
    });
    return lineMap;
}

function restrictLineMap(
    lineTexts: ReadonlyMap<number, string>,
    addedLines: ReadonlySet<number>,
): ReadonlyMap<number, string> {
    const restrictedMap = new Map<number, string>();
    for (const lineNumber of addedLines) {
        const lineText = lineTexts.get(lineNumber);
        if (lineText !== undefined) restrictedMap.set(lineNumber, lineText);
    }
    return restrictedMap;
}

/** Diff-eigene `next.config.*` (mit Inhalt) + vom Aufrufer beschaffte Begleitdateien. */
function collectNextConfigs(input: PrescanInput): PrescanCompanionFile[] {
    const diffConfigs = input.files
        .filter((file) => isNextConfigPath(file.path) && file.content !== null)
        .map((file) => ({ path: file.path, content: file.content }));
    const companionConfigs = (input.companionFiles ?? [])
        .filter((companion) => !isPackageManifestPath(companion.path));
    return [...diffConfigs, ...companionConfigs];
}

function isPackageManifestPath(filePath: string): boolean {
    return (filePath.split('/').pop() ?? '') === 'package.json';
}

/** Dateien, deren Registry-Kandidaten Kontext über Zeilengrenzen brauchen. */
function needsLineContext(filePath: string, language: PrescanLanguage): boolean {
    return language === 'python' || filePath.endsWith('pyproject.toml') || isPackageManifestPath(filePath);
}

/**
 * Namen der Pakete, die das Repo selbst stellt: jede package.json im Diff und
 * jede, die der Aufrufer als Begleitdatei mitgibt (Workspace-Manifeste). Ein
 * solcher Name in einem Dependency-Abschnitt ist kein Registry-Kandidat.
 */
function collectWorkspacePackageNames(input: PrescanInput): ReadonlySet<string> {
    const manifestTexts = [...input.files, ...(input.companionFiles ?? [])]
        .filter((manifestFile) => isPackageManifestPath(manifestFile.path))
        .map((manifestFile) => manifestFile.content);
    const packageNames = new Set<string>();
    for (const manifestText of manifestTexts) {
        const packageName = manifestText === null ? null : readPackageJsonName(manifestText);
        if (packageName !== null) packageNames.add(packageName);
    }
    return packageNames;
}

function byteLengthOf(content: string): number {
    return new TextEncoder().encode(content).length;
}

function resolveEngineVersions(): PrescanEngineVersions {
    // fs-Read statt require: ein dynamisches require(`${pkg}/package.json`)
    // würde Turbopack zu Bundle-Versuchen verleiten (siehe tree-sitter-engine).
    const readVersion = (packageName: string): string => {
        try {
            const manifestPath = nodePath.join(process.cwd(), 'node_modules', packageName, 'package.json');
            return (JSON.parse(readFileSync(manifestPath, 'utf-8')) as { version: string }).version;
        } catch {
            return 'unknown';
        }
    };
    return {
        prescanCore: PRESCAN_CORE_VERSION,
        treeSitter: readVersion('web-tree-sitter'),
        grammars: readVersion('tree-sitter-wasms'),
        eslint: readVersion('eslint'),
    };
}
