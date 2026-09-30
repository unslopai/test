/**
 * Registry-Engine — Package-Existenz-Checks (SEC-035/036).
 *
 * Die einzige Regel-Klasse mit Netzwerk: ein Registry-404 ist ein Fakt, kein
 * Urteil. Ehrlichkeits-Disziplin (INFRA-002): Netzwerkfehler/Timeout ≠ 404 —
 * sie landen als skippedChecks, nie als Finding und nie als Pass.
 *
 * False-Positive-Guards (Monorepos/First-Party-Code):
 *  - Import-abgeleitete npm-Kandidaten überspringen @scoped-Pakete (private
 *    Registries/Workspaces sind vom öffentlichen npm aus unsichtbar; Squatting
 *    eines Scopes erfordert Scope-Ownership). Manifest-Kandidaten werden
 *    IMMER geprüft — ein 404-Paket in package.json ist starke Evidenz.
 *  - Modulnamen, die als Pfadsegment im Diff vorkommen (src/myapp/… ⇒ myapp),
 *    gelten als First-Party und werden übersprungen.
 *  - Python-Importe (LANGUAGE_COVERAGE_SPEC §4.4): Standardbibliothek,
 *    Docstring-Zeilen und Fließtext sind keine Kandidaten. Ein 404 auf einen
 *    Import-Namen ist nur WARNING, weil Import- und Distributionsname
 *    auseinanderfallen können und lokale Module außerhalb des Diffs unsichtbar sind.
 *  - package.json: nur Zeilen in Dependency-Abschnitten, keine Workspace-Pakete.
 */
import { RULE_REGISTRY } from '../rules/registry';
import { extractPackageJsonDependency } from './registry/package-json-deps';
import { extractPyprojectCandidates } from './registry/pyproject-deps';
import { collectPythonStringBlockLines, extractPythonImportRoot } from './registry/python-imports';
import type { PrescanLanguage } from '../language';
import type {
    PrescanFinding,
    PrescanPorts,
    RegistryCachePort,
    RegistryId,
    SkippedCheck,
} from '../types';

const EXISTS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** 404s nur 1 h cachen: genau das Slopsquatting-Fenster (§6.3). */
const NOT_EXISTS_TTL_MS = 60 * 60 * 1000;
const LOOKUP_TIMEOUT_MS = 3000;
const LOOKUP_CONCURRENCY = 4;

const NODE_BUILTINS = new Set([
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
    'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http', 'http2',
    'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 'trace_events',
    'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);

const RUST_BUILTINS = new Set(['std', 'core', 'alloc', 'crate', 'self', 'super', 'test', 'proc_macro']);

// =============================================================================
// Kandidaten-Extraktion (nur Added Lines)
// =============================================================================

interface PackageCandidate {
    readonly registry: RegistryId;
    readonly packageName: string;
    readonly path: string;
    readonly line: number;
    readonly lineText: string;
    /** Manifest-Deklarationen werden ohne FP-Guards geprüft. */
    readonly fromManifest: boolean;
}

export interface RegistryEngineFile {
    readonly path: string;
    readonly language: PrescanLanguage;
    /** Zeilennummer → Zeilentext, NUR added lines. */
    readonly addedLineTexts: ReadonlyMap<number, string>;
    /**
     * Alle bekannten Zeilen der Datei — für Dateien mit zeilenübergreifendem
     * Kontext (pyproject.toml: Tabellen-Header + Arrays, package.json:
     * Abschnitt, Python: Docstrings). Kandidaten entstehen trotzdem
     * ausschließlich für Added Lines.
     */
    readonly lineTexts?: ReadonlyMap<number, string>;
}

export interface RegistryEngineOptions {
    /** Paketnamen des eigenen Repos (Workspace-Pakete) — nie ein Registry-Befund. */
    readonly firstPartyPackages?: ReadonlySet<string>;
}

/** Was eine Datei zur Kandidaten-Extraktion beiträgt, einmal pro Datei berechnet. */
interface CandidateScope {
    readonly file: RegistryEngineFile;
    readonly lineTexts: ReadonlyMap<number, string>;
    readonly firstPartyNames: ReadonlySet<string>;
    readonly firstPartyPackages: ReadonlySet<string>;
    readonly pythonStringBlockLines: ReadonlySet<number>;
}

const JS_IMPORT_PATTERN = /(?:from\s+|require\s*\(\s*|import\s*\(\s*)["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/;
const RUST_USE_PATTERN = /^\s*(?:pub\s+)?use\s+([a-z_][a-z0-9_]*)(?:::|;|\s)/;
const CARGO_DEPENDENCY_PATTERN = /^([a-zA-Z0-9_-]+)\s*=/;
const REQUIREMENTS_PATTERN = /^([A-Za-z0-9][A-Za-z0-9._-]*)/;
/** Ein npm-Paketname; alles andere (z. B. `${specifier}` aus einem Template-Literal) ist kein Import. */
const NPM_PACKAGE_NAME_PATTERN = /^[A-Za-z0-9][\w.~-]*$/;
const HF_PRETRAINED_PATTERN = /(?:from_pretrained|hf_hub_download|snapshot_download)\s*\(\s*["']([\w.-]+\/[\w.-]+)["']/;

export function extractPackageCandidates(
    files: readonly RegistryEngineFile[],
    options: RegistryEngineOptions = {},
): PackageCandidate[] {
    const firstPartyNames = collectFirstPartyNames(files);
    const firstPartyPackages = options.firstPartyPackages ?? new Set<string>();
    const candidates: PackageCandidate[] = [];

    for (const file of files) {
        const lineTexts = file.lineTexts ?? file.addedLineTexts;
        const candidateScope: CandidateScope = {
            file,
            lineTexts,
            firstPartyNames,
            firstPartyPackages,
            pythonStringBlockLines: file.language === 'python'
                ? collectPythonStringBlockLines(lineTexts)
                : new Set<number>(),
        };
        for (const [lineNumber, lineText] of file.addedLineTexts) {
            candidates.push(...extractCandidatesFromLine(candidateScope, lineNumber, lineText));
        }
        candidates.push(...extractPyprojectManifestCandidates(file));
    }

    return dedupeCandidates(candidates);
}

/** pyproject.toml braucht Tabellen-/Array-Kontext über Zeilengrenzen — daher nicht zeilenweise. */
function extractPyprojectManifestCandidates(file: RegistryEngineFile): PackageCandidate[] {
    const isPyproject = (file.path.split('/').pop() ?? '') === 'pyproject.toml';
    if (!isPyproject || !file.lineTexts) return [];
    const addedLines = new Set(file.addedLineTexts.keys());
    return extractPyprojectCandidates(file.lineTexts, addedLines).map((candidate) => ({
        registry: 'pypi',
        packageName: candidate.packageName,
        path: file.path,
        line: candidate.line,
        lineText: candidate.lineText,
        fromManifest: true,
    }));
}

/** Pfadsegmente des Diffs = First-Party-Heuristik (src/myapp/… ⇒ 'myapp'). */
function collectFirstPartyNames(files: readonly RegistryEngineFile[]): ReadonlySet<string> {
    const firstPartyNames = new Set<string>();
    for (const file of files) {
        for (const pathSegment of file.path.split('/')) {
            const segmentWithoutExtension = pathSegment.replace(/\.[^.]+$/, '');
            if (segmentWithoutExtension) firstPartyNames.add(segmentWithoutExtension.toLowerCase());
        }
    }
    return firstPartyNames;
}

function extractCandidatesFromLine(
    candidateScope: CandidateScope,
    lineNumber: number,
    lineText: string,
): PackageCandidate[] {
    const { file } = candidateScope;
    const baseCandidate = { path: file.path, line: lineNumber, lineText };
    const candidates: PackageCandidate[] = [];

    const hfMatch = HF_PRETRAINED_PATTERN.exec(lineText);
    if (hfMatch) {
        candidates.push({ ...baseCandidate, registry: 'hf-hub', packageName: hfMatch[1], fromManifest: false });
    }

    const importedPackage = extractImportedPackage(candidateScope, lineNumber, lineText);
    if (importedPackage) {
        candidates.push({ ...baseCandidate, ...importedPackage, fromManifest: false });
    }

    const manifestPackage = extractManifestPackage(candidateScope, lineNumber, lineText);
    if (manifestPackage) {
        candidates.push({ ...baseCandidate, ...manifestPackage, fromManifest: true });
    }

    return candidates;
}

function extractImportedPackage(
    candidateScope: CandidateScope,
    lineNumber: number,
    lineText: string,
): { registry: RegistryId; packageName: string } | null {
    const { firstPartyNames } = candidateScope;
    switch (candidateScope.file.language) {
        case 'typescript':
        case 'tsx':
        case 'javascript': {
            const importMatch = JS_IMPORT_PATTERN.exec(lineText);
            const importTarget = importMatch?.[1] ?? importMatch?.[2];
            const npmPackage = importTarget ? normalizeNpmImport(importTarget, firstPartyNames) : null;
            return npmPackage ? { registry: 'npm', packageName: npmPackage } : null;
        }
        case 'python': {
            if (candidateScope.pythonStringBlockLines.has(lineNumber)) return null;
            const moduleName = extractPythonImportRoot(lineText);
            const isCheckable = moduleName !== null && !firstPartyNames.has(moduleName.toLowerCase());
            return isCheckable ? { registry: 'pypi', packageName: moduleName } : null;
        }
        case 'rust': {
            const useMatch = RUST_USE_PATTERN.exec(lineText);
            const crateName = useMatch?.[1];
            const isCheckable = crateName !== undefined
                && !RUST_BUILTINS.has(crateName)
                && !firstPartyNames.has(crateName.toLowerCase());
            return isCheckable ? { registry: 'crates', packageName: crateName.replace(/_/g, '-') } : null;
        }
        default:
            return null;
    }
}

function normalizeNpmImport(importTarget: string, firstPartyNames: ReadonlySet<string>): string | null {
    if (importTarget.startsWith('.') || importTarget.startsWith('/') || importTarget.startsWith('node:')) return null;
    if (importTarget.startsWith('@/') || importTarget.startsWith('~/')) return null;
    // FP-Guard: @scoped-Imports nur via Manifest prüfen (private Scopes).
    if (importTarget.startsWith('@')) return null;

    const rootPackage = importTarget.split('/')[0];
    if (!NPM_PACKAGE_NAME_PATTERN.test(rootPackage)) return null;
    if (NODE_BUILTINS.has(rootPackage) || firstPartyNames.has(rootPackage.toLowerCase())) return null;
    return rootPackage;
}

function extractManifestPackage(
    candidateScope: CandidateScope,
    lineNumber: number,
    lineText: string,
): { registry: RegistryId; packageName: string } | null {
    const fileName = candidateScope.file.path.split('/').pop() ?? '';

    if (fileName === 'package.json') {
        const declaredPackage = extractPackageJsonDependency(candidateScope.lineTexts, lineNumber);
        const isCheckable = declaredPackage !== null && !candidateScope.firstPartyPackages.has(declaredPackage);
        return isCheckable ? { registry: 'npm', packageName: declaredPackage } : null;
    }
    if (fileName === 'requirements.txt') {
        const requirementMatch = REQUIREMENTS_PATTERN.exec(lineText.trim());
        return requirementMatch ? { registry: 'pypi', packageName: requirementMatch[1] } : null;
    }
    if (fileName === 'Cargo.toml') {
        const cargoMatch = CARGO_DEPENDENCY_PATTERN.exec(lineText.trim());
        const isSectionHeader = lineText.trim().startsWith('[');
        return cargoMatch && !isSectionHeader ? { registry: 'crates', packageName: cargoMatch[1] } : null;
    }
    return null;
}

function dedupeCandidates(candidates: readonly PackageCandidate[]): PackageCandidate[] {
    const seenKeys = new Set<string>();
    return candidates.filter((candidate) => {
        const dedupeKey = `${candidate.registry}:${candidate.packageName}:${candidate.path}:${candidate.line}`;
        if (seenKeys.has(dedupeKey)) return false;
        seenKeys.add(dedupeKey);
        return true;
    });
}

// =============================================================================
// Lookup mit Cache + Timeout
// =============================================================================

const REGISTRY_URL_BUILDERS: Readonly<Record<RegistryId, (packageName: string) => string>> = {
    npm: (packageName) => `https://registry.npmjs.org/${encodeURIComponent(packageName).replace('%40', '@').replace('%2F', '/')}`,
    pypi: (packageName) => `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`,
    crates: (packageName) => `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}`,
    'hf-hub': (modelId) => `https://huggingface.co/api/models/${modelId}`,
};

export interface RegistryEngineResult {
    readonly findings: PrescanFinding[];
    readonly skippedChecks: SkippedCheck[];
}

export async function runRegistryEngine(
    files: readonly RegistryEngineFile[],
    ports: PrescanPorts,
    options: RegistryEngineOptions = {},
): Promise<RegistryEngineResult> {
    const candidates = extractPackageCandidates(files, options);
    const findings: PrescanFinding[] = [];
    const skippedChecks: SkippedCheck[] = [];
    // Ein Existenz-Ergebnis pro registry:packageName, geteilt über alle
    // Fundstellen: Run 11 (ROADMAP §1b) zeigte 19 Netzwerk-Reads für 13 unique
    // Packages (~12 MB RSS pro Request in der Lambda), weil der Kandidaten-
    // Dedupe bewusst path:line enthält (jede Fundstelle wird ein Finding).
    const existenceMemo: ExistenceMemo = new Map();

    const workQueue = [...candidates];
    const runWorker = async (): Promise<void> => {
        for (let candidate = workQueue.shift(); candidate; candidate = workQueue.shift()) {
            await checkCandidate(candidate, ports, findings, skippedChecks, existenceMemo);
            ports.onRegistryCandidateChecked?.(`${candidate.registry}/${candidate.packageName}`);
        }
    };
    await Promise.all(
        Array.from({ length: LOOKUP_CONCURRENCY }, () => runWorker()),
    );

    return { findings, skippedChecks };
}

/** Geteilte Existenz-Auflösungen pro `registry:packageName` (ein Scan-Lauf). */
type ExistenceMemo = Map<string, Promise<boolean | null>>;

async function checkCandidate(
    candidate: PackageCandidate,
    ports: PrescanPorts,
    findings: PrescanFinding[],
    skippedChecks: SkippedCheck[],
    existenceMemo: ExistenceMemo,
): Promise<void> {
    const ruleId = candidate.registry === 'hf-hub' ? 'SEC-036' : 'SEC-035';

    const packageExists = await resolveMemoizedExistence(candidate, ports, existenceMemo);
    if (packageExists === null) {
        // Netzwerkfehler ≠ 404: blocked, nicht clean (INFRA-002-Disziplin).
        // Pro Fundstelle gemeldet, damit keine Datei stillschweigend clean wirkt.
        skippedChecks.push({
            ruleId,
            reason: `registry-timeout: ${candidate.registry}/${candidate.packageName}`,
            path: candidate.path,
        });
        return;
    }
    if (!packageExists) {
        findings.push(buildRegistryFinding(ruleId, candidate));
    }
}

function resolveMemoizedExistence(
    candidate: PackageCandidate,
    ports: PrescanPorts,
    existenceMemo: ExistenceMemo,
): Promise<boolean | null> {
    const memoKey = `${candidate.registry}:${candidate.packageName}`;
    const memoizedResolution = existenceMemo.get(memoKey);
    if (memoizedResolution) return memoizedResolution;

    // Das Promise (nicht das Ergebnis) wird memoisiert: parallele Worker mit
    // derselben Package teilen sich so auch die laufende Auflösung.
    const resolution = resolveExistence(candidate, ports);
    existenceMemo.set(memoKey, resolution);
    return resolution;
}

/** Cache-Read → Live-Lookup → Cache-Write; genau einmal pro Package und Scan. */
async function resolveExistence(candidate: PackageCandidate, ports: PrescanPorts): Promise<boolean | null> {
    const cachedExists = await readFreshCacheEntry(ports.registryCache, candidate, ports);
    if (cachedExists !== null) return cachedExists;

    const lookupResult = await lookupPackageExists(candidate, ports);
    if (lookupResult === null) return null;

    await ports.registryCache?.write(candidate.registry, candidate.packageName, lookupResult)
        .catch(() => { /* Cache-Write-Fehler ist nie scan-relevant. */ });
    return lookupResult;
}

async function readFreshCacheEntry(
    registryCache: RegistryCachePort | undefined,
    candidate: PackageCandidate,
    ports: PrescanPorts,
): Promise<boolean | null> {
    if (!registryCache) return null;

    try {
        const cacheEntry = await registryCache.read(candidate.registry, candidate.packageName);
        if (!cacheEntry) return null;

        const entryAgeMs = (ports.now?.() ?? Date.now()) - Date.parse(cacheEntry.checkedAt);
        const applicableTtl = cacheEntry.packageExists ? EXISTS_TTL_MS : NOT_EXISTS_TTL_MS;
        return entryAgeMs <= applicableTtl ? cacheEntry.packageExists : null;
    } catch {
        return null;
    }
}

/** Registries ohne HEAD-Support antworten so; dann GET mit sofort verworfenem Body. */
const METHOD_NOT_SUPPORTED_STATUSES: ReadonlySet<number> = new Set([405, 501]);

/**
 * true/false = definitives Registry-Ergebnis; null = Netzwerk unklar.
 *
 * HEAD statt GET — bewusst (Live-OOM 2026-08-23, ROADMAP §1b): ein GET auf
 * `registry.npmjs.org/<pkg>` liefert das komplette Packument (react, recharts,
 * lucide-react: viele MB), das undici puffert, obwohl nur der Status gelesen
 * wird. 4 parallele Lookups kosteten so +240 MB RSS und killten die
 * Standalone-Invocation. Der GET-Fallback verwirft den Body sofort.
 */
async function lookupPackageExists(candidate: PackageCandidate, ports: PrescanPorts): Promise<boolean | null> {
    const fetchImpl = ports.fetchImpl ?? fetch;
    const lookupUrl = REGISTRY_URL_BUILDERS[candidate.registry](candidate.packageName);

    try {
        const headResponse = await fetchImpl(lookupUrl, buildLookupInit('HEAD'));
        if (!METHOD_NOT_SUPPORTED_STATUSES.has(headResponse.status)) {
            return interpretLookupStatus(headResponse.status, headResponse.ok);
        }
        const getResponse = await fetchImpl(lookupUrl, buildLookupInit('GET'));
        await getResponse.body?.cancel();
        return interpretLookupStatus(getResponse.status, getResponse.ok);
    } catch {
        return null;
    }
}

function buildLookupInit(method: 'HEAD' | 'GET'): RequestInit {
    return {
        method,
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
        headers: { accept: 'application/json' },
    };
}

function interpretLookupStatus(status: number, ok: boolean): boolean | null {
    if (status === 404) return false;
    if (ok) return true;
    return null;
}

/**
 * Ein 404 auf einen Python-Import-Namen beweist kein halluziniertes Paket:
 * der Name kann ein lokales Modul sein oder anders heißen als seine
 * Distribution. Deshalb WARNING mit eigenem Text; Manifest-Deklarationen
 * und alle anderen Registries bleiben beim Urteil der Regel.
 */
const PYTHON_IMPORT_EXPLANATION = 'No PyPI distribution carries the name of this imported module. '
    + 'Import names can differ from distribution names, and local modules outside this diff are '
    + 'invisible to the check. If neither the repository nor its requirements provide the module, '
    + 'the import is hallucinated and a slopsquatting target.';

function isPythonImportCandidate(candidate: PackageCandidate): boolean {
    return candidate.registry === 'pypi' && !candidate.fromManifest;
}

function buildRegistryFinding(ruleId: string, candidate: PackageCandidate): PrescanFinding {
    const descriptor = RULE_REGISTRY.get(ruleId);
    const lookupUrl = REGISTRY_URL_BUILDERS[candidate.registry](candidate.packageName);
    const isImportNameOnly = isPythonImportCandidate(candidate);
    const explanation = isImportNameOnly ? PYTHON_IMPORT_EXPLANATION : descriptor?.explanation ?? '';

    return {
        ruleId,
        ruleTitle: descriptor?.title ?? ruleId,
        severity: isImportNameOnly ? 'WARNING' : descriptor?.severity ?? 'CRITICAL',
        path: candidate.path,
        line: candidate.line,
        endLine: candidate.line,
        exactQuote: candidate.lineText.trim().substring(0, 200),
        explanation: `${explanation} (verified 404: ${lookupUrl})`,
        engine: 'registry',
        fileLevel: false,
    };
}
