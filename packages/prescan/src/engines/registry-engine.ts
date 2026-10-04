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
 */
import { RULE_REGISTRY } from '../rules/registry';
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

const PYTHON_STDLIB = new Set([
    'abc', 'argparse', 'array', 'asyncio', 'base64', 'bisect', 'builtins', 'calendar', 'collections',
    'concurrent', 'configparser', 'contextlib', 'copy', 'csv', 'ctypes', 'dataclasses', 'datetime',
    'decimal', 'difflib', 'dis', 'email', 'enum', 'errno', 'functools', 'gc', 'getpass', 'glob',
    'gzip', 'hashlib', 'heapq', 'hmac', 'html', 'http', 'importlib', 'inspect', 'io', 'ipaddress',
    'itertools', 'json', 'logging', 'math', 'mimetypes', 'multiprocessing', 'operator', 'os',
    'pathlib', 'pickle', 'platform', 'pprint', 'queue', 'random', 're', 'secrets', 'select',
    'shlex', 'shutil', 'signal', 'site', 'socket', 'sqlite3', 'ssl', 'stat', 'statistics',
    'string', 'struct', 'subprocess', 'sys', 'tempfile', 'textwrap', 'threading', 'time',
    'tomllib', 'traceback', 'types', 'typing', 'unittest', 'urllib', 'uuid', 'venv', 'warnings',
    'weakref', 'xml', 'zipfile', 'zoneinfo',
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
}

const JS_IMPORT_PATTERN = /(?:from\s+|require\s*\(\s*|import\s*\(\s*)["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/;
const PYTHON_IMPORT_PATTERN = /^\s*(?:from\s+([A-Za-z_][\w.]*)\s+import|import\s+([A-Za-z_][\w.]*))/;
const RUST_USE_PATTERN = /^\s*(?:pub\s+)?use\s+([a-z_][a-z0-9_]*)(?:::|;|\s)/;
const CARGO_DEPENDENCY_PATTERN = /^([a-zA-Z0-9_-]+)\s*=/;
const REQUIREMENTS_PATTERN = /^([A-Za-z0-9][A-Za-z0-9._-]*)/;
const HF_PRETRAINED_PATTERN = /(?:from_pretrained|hf_hub_download|snapshot_download)\s*\(\s*["']([\w.-]+\/[\w.-]+)["']/;

export function extractPackageCandidates(files: readonly RegistryEngineFile[]): PackageCandidate[] {
    const firstPartyNames = collectFirstPartyNames(files);
    const candidates: PackageCandidate[] = [];

    for (const file of files) {
        for (const [lineNumber, lineText] of file.addedLineTexts) {
            candidates.push(...extractCandidatesFromLine(file, lineNumber, lineText, firstPartyNames));
        }
    }

    return dedupeCandidates(candidates);
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
    file: RegistryEngineFile,
    lineNumber: number,
    lineText: string,
    firstPartyNames: ReadonlySet<string>,
): PackageCandidate[] {
    const baseCandidate = { path: file.path, line: lineNumber, lineText };
    const candidates: PackageCandidate[] = [];

    const hfMatch = HF_PRETRAINED_PATTERN.exec(lineText);
    if (hfMatch) {
        candidates.push({ ...baseCandidate, registry: 'hf-hub', packageName: hfMatch[1], fromManifest: false });
    }

    const importedPackage = extractImportedPackage(file, lineText, firstPartyNames);
    if (importedPackage) {
        candidates.push({ ...baseCandidate, ...importedPackage, fromManifest: false });
    }

    const manifestPackage = extractManifestPackage(file, lineText);
    if (manifestPackage) {
        candidates.push({ ...baseCandidate, ...manifestPackage, fromManifest: true });
    }

    return candidates;
}

function extractImportedPackage(
    file: RegistryEngineFile,
    lineText: string,
    firstPartyNames: ReadonlySet<string>,
): { registry: RegistryId; packageName: string } | null {
    switch (file.language) {
        case 'typescript':
        case 'tsx':
        case 'javascript': {
            const importMatch = JS_IMPORT_PATTERN.exec(lineText);
            const importTarget = importMatch?.[1] ?? importMatch?.[2];
            const npmPackage = importTarget ? normalizeNpmImport(importTarget, firstPartyNames) : null;
            return npmPackage ? { registry: 'npm', packageName: npmPackage } : null;
        }
        case 'python': {
            const importMatch = PYTHON_IMPORT_PATTERN.exec(lineText);
            const moduleName = (importMatch?.[1] ?? importMatch?.[2])?.split('.')[0];
            const isCheckable = moduleName !== undefined
                && !PYTHON_STDLIB.has(moduleName)
                && !firstPartyNames.has(moduleName.toLowerCase());
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
    if (NODE_BUILTINS.has(rootPackage) || firstPartyNames.has(rootPackage.toLowerCase())) return null;
    return rootPackage;
}

function extractManifestPackage(
    file: RegistryEngineFile,
    lineText: string,
): { registry: RegistryId; packageName: string } | null {
    const fileName = file.path.split('/').pop() ?? '';

    if (fileName === 'package.json') {
        const dependencyMatch = /^\s*"(@?[A-Za-z0-9._/-]+)"\s*:\s*"[^"]*"\s*,?\s*$/.exec(lineText);
        const isDependencyShaped = dependencyMatch !== null
            && !/^(name|version|description|main|types|license|type|private|scripts|exports|engines|packageManager|homepage|repository|author|files|bin|workspaces)$/.test(dependencyMatch[1]);
        return isDependencyShaped ? { registry: 'npm', packageName: dependencyMatch[1] } : null;
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
): Promise<RegistryEngineResult> {
    const candidates = extractPackageCandidates(files);
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

function buildRegistryFinding(ruleId: string, candidate: PackageCandidate): PrescanFinding {
    const descriptor = RULE_REGISTRY.get(ruleId);
    const lookupUrl = REGISTRY_URL_BUILDERS[candidate.registry](candidate.packageName);

    return {
        ruleId,
        ruleTitle: descriptor?.title ?? ruleId,
        severity: descriptor?.severity ?? 'CRITICAL',
        path: candidate.path,
        line: candidate.line,
        endLine: candidate.line,
        exactQuote: candidate.lineText.trim().substring(0, 200),
        explanation: `${descriptor?.explanation ?? ''} (verified 404: ${lookupUrl})`,
        engine: 'registry',
        fileLevel: false,
    };
}
