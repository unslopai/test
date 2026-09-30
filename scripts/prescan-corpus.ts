/**
 * Korpus-Harness für den Pre-Scanner (0 Token, LANGUAGE_COVERAGE_SPEC §4.4,
 * Gate G1): lässt `runPrescan` über die Nicht-JS/TS-Dateien eines
 * Verzeichnisses laufen, jede Datei als vollständig neu hinzugefügt. Das
 * entspricht einem PR, der diese Dateien neu anlegt. Registry-Lookups laufen
 * live. Wie der Webhook-Pfad (`companion-loader.ts`) gibt der Harness die
 * Manifeste der npm-Workspaces als Begleitdateien mit.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/prescan-corpus.ts \
 *       --root <dir> --label <name> --out <report.json> [--max-files 400]
 *
 * Die Ausgabe nennt jede CRITICAL-Fundstelle aus SEC-035 und jede auf einer
 * Markdown-Datei einzeln: das sind die beiden Zahlen, die G1 auf 0 verlangt.
 */
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_PRESCAN_CONFIG, runPrescan } from '@unslop/prescan';
import type { PrescanCompanionFile, PrescanFile } from '@unslop/prescan';

const CORPUS_EXTENSIONS = new Set([
    '.py', '.go', '.java', '.c', '.h', '.tf', '.yaml', '.yml', '.json', '.toml',
    '.ps1', '.sh', '.sql', '.md', '.css', '.html',
]);
const CORPUS_BASENAMES = new Set(['Dockerfile', 'go.mod', 'requirements.txt']);
const SKIPPED_SEGMENTS = ['node_modules', '.git', 'dist', 'build', '.next', 'vendor', 'results'];
const FILES_PER_SCAN = 25;
const MAX_FILE_BYTES = DEFAULT_PRESCAN_CONFIG.maxFileBytes;

interface CorpusFinding {
    readonly ruleId: string;
    readonly severity: string;
    readonly path: string;
    readonly line: number;
    readonly exactQuote: string;
}

function readFlag(flagName: string, fallbackValue?: string): string {
    const flagIndex = process.argv.indexOf(flagName);
    const flagValue = flagIndex >= 0 ? process.argv[flagIndex + 1] : fallbackValue;
    if (!flagValue) throw new Error(`Pflicht-Flag fehlt: ${flagName}`);
    return flagValue;
}

function collectCorpusPaths(rootDir: string, currentDir: string, collected: string[]): void {
    for (const dirEntry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        if (SKIPPED_SEGMENTS.includes(dirEntry.name)) continue;
        const absolutePath = path.join(currentDir, dirEntry.name);
        if (dirEntry.isDirectory()) {
            collectCorpusPaths(rootDir, absolutePath, collected);
        } else if (
            (CORPUS_EXTENSIONS.has(path.extname(dirEntry.name).toLowerCase()) || CORPUS_BASENAMES.has(dirEntry.name))
            && dirEntry.name !== 'package-lock.json'
            && fs.statSync(absolutePath).size <= MAX_FILE_BYTES
        ) {
            collected.push(path.relative(rootDir, absolutePath).split(path.sep).join('/'));
        }
    }
}

function toAddedFile(rootDir: string, relativePath: string): PrescanFile {
    const fileContent = fs.readFileSync(path.join(rootDir, relativePath), 'utf-8').replace(/\r\n/g, '\n');
    const contentLines = fileContent.split('\n');
    return {
        path: relativePath,
        patch: `@@ -0,0 +1,${contentLines.length} @@\n${contentLines.map((line) => `+${line}`).join('\n')}`,
        content: fileContent,
    };
}

/** Manifeste der npm-Workspaces (`<dir>/*` und feste Pfade), wie sie der Webhook-Pfad als Begleitdateien lädt. */
function loadWorkspaceManifests(rootDir: string): PrescanCompanionFile[] {
    const rootManifestPath = path.join(rootDir, 'package.json');
    if (!fs.existsSync(rootManifestPath)) return [];
    const rootManifest: unknown = JSON.parse(fs.readFileSync(rootManifestPath, 'utf-8'));
    const declaredWorkspaces = typeof rootManifest === 'object' && rootManifest !== null && 'workspaces' in rootManifest
        ? rootManifest.workspaces
        : [];
    const workspacePatterns = Array.isArray(declaredWorkspaces)
        ? declaredWorkspaces.filter((pattern): pattern is string => typeof pattern === 'string')
        : [];

    const workspaceDirs = workspacePatterns.flatMap((workspacePattern) => {
        if (!workspacePattern.endsWith('/*')) return [workspacePattern];
        const parentDir = workspacePattern.slice(0, -2);
        if (!fs.existsSync(path.join(rootDir, parentDir))) return [];
        return fs.readdirSync(path.join(rootDir, parentDir), { withFileTypes: true })
            .filter((dirEntry) => dirEntry.isDirectory())
            .map((dirEntry) => `${parentDir}/${dirEntry.name}`);
    });
    return workspaceDirs
        .map((workspaceDir) => `${workspaceDir}/package.json`)
        .filter((manifestPath) => fs.existsSync(path.join(rootDir, manifestPath)))
        .map((manifestPath) => ({
            path: manifestPath,
            content: fs.readFileSync(path.join(rootDir, manifestPath), 'utf-8'),
        }));
}

function isGateRelevant(finding: CorpusFinding): boolean {
    return finding.severity === 'CRITICAL' && (finding.ruleId === 'SEC-035' || finding.path.toLowerCase().endsWith('.md'));
}

function extensionKey(relativePath: string): string {
    const basename = path.basename(relativePath);
    return CORPUS_BASENAMES.has(basename) ? basename : path.extname(basename).toLowerCase();
}

interface CorpusScan {
    readonly findings: readonly CorpusFinding[];
    readonly totalDurationMs: number;
    readonly maxScanDurationMs: number;
}

/** Scannt die Dateien in 25er-Gruppen, wie ein PR mit vielen neuen Dateien. */
async function scanCorpus(rootDir: string, selectedPaths: readonly string[]): Promise<CorpusScan> {
    const companionFiles = loadWorkspaceManifests(rootDir);
    const findings: CorpusFinding[] = [];
    let totalDurationMs = 0;
    let maxScanDurationMs = 0;
    for (let offset = 0; offset < selectedPaths.length; offset += FILES_PER_SCAN) {
        const scanFiles = selectedPaths.slice(offset, offset + FILES_PER_SCAN)
            .map((relativePath) => toAddedFile(rootDir, relativePath));
        const prescanResult = await runPrescan({ files: scanFiles, companionFiles }, DEFAULT_PRESCAN_CONFIG);
        totalDurationMs += prescanResult.durationMs;
        maxScanDurationMs = Math.max(maxScanDurationMs, prescanResult.durationMs);
        findings.push(...prescanResult.findings.map((finding) => ({
            ruleId: finding.ruleId,
            severity: finding.severity,
            path: finding.path,
            line: finding.line,
            exactQuote: finding.exactQuote.slice(0, 160),
        })));
    }
    return { findings, totalDurationMs, maxScanDurationMs };
}

function countByKey(groupKeys: readonly string[]): Map<string, number> {
    const countsByKey = new Map<string, number>();
    for (const groupKey of groupKeys) {
        countsByKey.set(groupKey, (countsByKey.get(groupKey) ?? 0) + 1);
    }
    return countsByKey;
}

interface CorpusSelection {
    readonly corpusLabel: string;
    readonly candidateCount: number;
    readonly selectedPaths: readonly string[];
}

function printCorpusSummary(corpusSelection: CorpusSelection, corpusScan: CorpusScan): void {
    const { findings } = corpusScan;
    const filesByExtension = countByKey(corpusSelection.selectedPaths.map(extensionKey));
    const findingsByExtensionAndRule = countByKey(
        findings.map((finding) => `${extensionKey(finding.path)} ${finding.ruleId} ${finding.severity}`),
    );

    console.log(`Korpus ${corpusSelection.corpusLabel}: ${corpusSelection.selectedPaths.length} Dateien `
        + `(von ${corpusSelection.candidateCount} Kandidaten), ${findings.length} Findings, `
        + `Prescan gesamt ${corpusScan.totalDurationMs} ms, langsamster 25er-Scan ${corpusScan.maxScanDurationMs} ms`);
    console.log('Dateien je Typ:', JSON.stringify(Object.fromEntries(filesByExtension)));
    for (const [groupKey, findingCount] of [...findingsByExtensionAndRule.entries()].sort()) {
        console.log(`  ${groupKey}: ${findingCount}`);
    }

    const gateFindings = findings.filter(isGateRelevant);
    console.log(`G1: ${gateFindings.filter((finding) => finding.ruleId === 'SEC-035').length} CRITICAL aus SEC-035, `
        + `${gateFindings.filter((finding) => finding.path.toLowerCase().endsWith('.md')).length} CRITICAL auf .md`);
    for (const gateFinding of gateFindings) {
        console.log(`  ${gateFinding.ruleId} ${gateFinding.path}:${gateFinding.line} | ${gateFinding.exactQuote}`);
    }
}

function writeCorpusReport(reportPath: string, corpusSelection: CorpusSelection, corpusScan: CorpusScan): void {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
        capturedAt: new Date().toISOString(),
        corpusLabel: corpusSelection.corpusLabel,
        fileCount: corpusSelection.selectedPaths.length,
        filesByExtension: Object.fromEntries(countByKey(corpusSelection.selectedPaths.map(extensionKey))),
        totalDurationMs: corpusScan.totalDurationMs,
        maxScanDurationMs: corpusScan.maxScanDurationMs,
        findings: corpusScan.findings,
    }, null, 2));
    console.log(`Report geschrieben: ${reportPath}`);
}

async function main(): Promise<void> {
    const rootDir = path.resolve(readFlag('--root'));
    const corpusLabel = readFlag('--label');
    const reportPath = readFlag('--out');
    const maxFiles = Number(readFlag('--max-files', '400'));

    const corpusPaths: string[] = [];
    collectCorpusPaths(rootDir, rootDir, corpusPaths);
    const corpusSelection: CorpusSelection = {
        corpusLabel,
        candidateCount: corpusPaths.length,
        selectedPaths: corpusPaths.sort().slice(0, maxFiles),
    };

    const corpusScan = await scanCorpus(rootDir, corpusSelection.selectedPaths);
    printCorpusSummary(corpusSelection, corpusScan);
    writeCorpusReport(reportPath, corpusSelection, corpusScan);
}

main().catch((corpusError: unknown) => {
    console.error('[prescan-corpus] Fehler:', corpusError);
    process.exitCode = 2;
});
