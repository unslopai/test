/**
 * Wire-Contract zwischen pre-scanner-step (HTTP-Client) und
 * POST /api/internal/prescan (Standalone-Invocation).
 *
 * Warum es diesen Vertrag gibt (ROADMAP §1b, OOM 2026-07-20): web-tree-sitter,
 * bis zu 9 Grammatiken, ESLint und @typescript-eslint/parser bleiben nach dem
 * Scan auf Modulebene resident. Im selben Serverless-Instance wie der Vertex-
 * Client stirbt der NÄCHSTE Step (draft-reviewer) am Memory-Ceiling. Die
 * Engines laufen deshalb in einer eigenen Invocation; hier nur Typen und die
 * strukturelle Validierung beider Richtungen [ARCH-002] — dieses Modul
 * importiert @unslop/prescan ausschließlich als Typ und zieht damit KEINE
 * Engine in den Worker-Modulgraphen.
 */
import type {
    EngineId,
    PrescanCompanionFile,
    PrescanConfig,
    PrescanEngineVersions,
    PrescanFile,
    PrescanFinding,
    PrescanResult,
    PrescanSeverity,
    SkippedCheck,
    SkippedFile,
} from '@unslop/prescan';

export const INTERNAL_PRESCAN_PATH = '/api/internal/prescan';
export const INTERNAL_SECRET_HEADER = 'x-internal-secret';

export interface InternalPrescanRequest {
    readonly files: readonly PrescanFile[];
    /** Begleitdateien (v4, SEC-019): vom Worker bei headSha beschafft, nie selbst gescannt. */
    readonly companionFiles?: readonly PrescanCompanionFile[];
    readonly prescanConfig: PrescanConfig;
    /** Nur für Log-Korrelation — die Engines brauchen weder Repo noch SHA. */
    readonly repoFullName: string;
    readonly headSha: string;
}

/** Validierte Request-Hülle; die Config bleibt roh (siehe parseInternalPrescanRequest). */
export interface ParsedInternalPrescanRequest {
    readonly files: readonly PrescanFile[];
    readonly companionFiles: readonly PrescanCompanionFile[];
    readonly rawPrescanConfig: unknown;
    readonly repoFullName: string;
    readonly headSha: string;
}

export type InternalPrescanErrorKind = 'not-configured' | 'timeout' | 'http' | 'invalid-response';

/** Unterscheidet "nicht erreichbar" von "hat geantwortet, aber falsch". */
export class InternalPrescanError extends Error {
    constructor(
        message: string,
        readonly kind: InternalPrescanErrorKind,
        readonly status?: number,
    ) {
        super(message);
        this.name = 'InternalPrescanError';
    }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(candidate: unknown): candidate is UnknownRecord {
    return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
}

function isString(candidate: unknown): candidate is string {
    return typeof candidate === 'string';
}

function isFiniteNumber(candidate: unknown): candidate is number {
    return typeof candidate === 'number' && Number.isFinite(candidate);
}

function isStringArray(candidate: unknown): candidate is string[] {
    return Array.isArray(candidate) && candidate.every(isString);
}

function parseArray<Item>(candidate: unknown, parseItem: (raw: unknown) => Item | null): Item[] | null {
    if (!Array.isArray(candidate)) return null;
    const items: Item[] = [];
    for (const rawItem of candidate) {
        const item = parseItem(rawItem);
        if (item === null) return null;
        items.push(item);
    }
    return items;
}

// =============================================================================
// Request (Worker → Route)
// =============================================================================

function parsePrescanFile(raw: unknown): PrescanFile | null {
    if (!isRecord(raw)) return null;
    const { path, content, patch } = raw;
    if (!isString(path) || !isString(patch)) return null;
    if (content !== null && !isString(content)) return null;
    return { path, content, patch };
}

function parseCompanionFile(raw: unknown): PrescanCompanionFile | null {
    if (!isRecord(raw)) return null;
    const { path, content } = raw;
    if (!isString(path) || (content !== null && !isString(content))) return null;
    return { path, content };
}

/**
 * Validiert die Request-Hülle. Die PrescanConfig selbst wird NICHT hier
 * geprüft: die Route reicht sie durch `resolvePrescanConfig` (feldweiser
 * Default-Fallback), das zum Engine-Package gehört und im Worker tabu ist.
 */
export function parseInternalPrescanRequest(raw: unknown): ParsedInternalPrescanRequest | null {
    if (!isRecord(raw)) return null;
    const files = parseArray(raw.files, parsePrescanFile);
    // Optional (Worker ohne das Feld bleiben gueltig); wenn vorhanden, muss es strukturell stimmen.
    const companionFiles = raw.companionFiles === undefined ? [] : parseArray(raw.companionFiles, parseCompanionFile);
    if (files === null || companionFiles === null || !isString(raw.repoFullName) || !isString(raw.headSha)) return null;
    return {
        files,
        companionFiles,
        rawPrescanConfig: raw.prescanConfig,
        repoFullName: raw.repoFullName,
        headSha: raw.headSha,
    };
}

// =============================================================================
// Response (Route → Worker)
// =============================================================================

const SEVERITIES: readonly PrescanSeverity[] = ['CRITICAL', 'WARNING'];
const ENGINE_IDS: readonly EngineId[] = ['tree-sitter', 'regex', 'eslint', 'config', 'registry'];
const SKIP_REASONS: readonly SkippedFile['reason'][] = ['size-cap', 'budget-exhausted', 'patch-only-input'];

function parseSeverity(raw: unknown): PrescanSeverity | null {
    return SEVERITIES.find((severity) => severity === raw) ?? null;
}

function parseEngineId(raw: unknown): EngineId | null {
    return ENGINE_IDS.find((engineId) => engineId === raw) ?? null;
}

function parseSkipReason(raw: unknown): SkippedFile['reason'] | null {
    return SKIP_REASONS.find((reason) => reason === raw) ?? null;
}

interface FindingStrings {
    readonly ruleId: string;
    readonly ruleTitle: string;
    readonly path: string;
    readonly exactQuote: string;
    readonly explanation: string;
}

function parseFindingStrings(raw: UnknownRecord): FindingStrings | null {
    const { ruleId, ruleTitle, path, exactQuote, explanation } = raw;
    if (!isString(ruleId) || !isString(ruleTitle) || !isString(path) || !isString(exactQuote) || !isString(explanation)) {
        return null;
    }
    return { ruleId, ruleTitle, path, exactQuote, explanation };
}

function parseFinding(raw: unknown): PrescanFinding | null {
    if (!isRecord(raw)) return null;
    const strings = parseFindingStrings(raw);
    const severity = parseSeverity(raw.severity);
    const engine = parseEngineId(raw.engine);
    const hasValidFixTemplate = raw.fixTemplate === undefined || isString(raw.fixTemplate);
    if (strings === null || severity === null || engine === null || !hasValidFixTemplate) return null;
    if (!isFiniteNumber(raw.line) || !isFiniteNumber(raw.endLine) || typeof raw.fileLevel !== 'boolean') return null;
    return {
        ...strings,
        severity,
        line: raw.line,
        endLine: raw.endLine,
        ...(isString(raw.fixTemplate) ? { fixTemplate: raw.fixTemplate } : {}),
        engine,
        fileLevel: raw.fileLevel,
    };
}

function parseSkippedCheck(raw: unknown): SkippedCheck | null {
    if (!isRecord(raw) || !isString(raw.ruleId) || !isString(raw.reason)) return null;
    if (raw.path !== undefined && !isString(raw.path)) return null;
    return { ruleId: raw.ruleId, reason: raw.reason, ...(isString(raw.path) ? { path: raw.path } : {}) };
}

function parseSkippedFile(raw: unknown): SkippedFile | null {
    if (!isRecord(raw) || !isString(raw.path)) return null;
    const reason = parseSkipReason(raw.reason);
    return reason === null ? null : { path: raw.path, reason };
}

function parseEngineVersions(raw: unknown): PrescanEngineVersions | null {
    if (!isRecord(raw)) return null;
    const { prescanCore, treeSitter, grammars, eslint } = raw;
    if (!isString(prescanCore) || !isString(treeSitter) || !isString(grammars) || !isString(eslint)) return null;
    return { prescanCore, treeSitter, grammars, eslint };
}

function parseResultCounters(raw: UnknownRecord): Pick<PrescanResult, 'filesScanned' | 'rulesEvaluated' | 'durationMs' | 'rulesDisabled'> | null {
    const { filesScanned, rulesEvaluated, durationMs, rulesDisabled } = raw;
    if (!isFiniteNumber(filesScanned) || !isFiniteNumber(rulesEvaluated) || !isFiniteNumber(durationMs)) return null;
    if (!isStringArray(rulesDisabled)) return null;
    return { filesScanned, rulesEvaluated, durationMs, rulesDisabled };
}

/** Strukturelle Validierung der Route-Antwort — ein kaputtes Feld ⇒ null (⇒ degraded). */
export function parsePrescanResult(raw: unknown): PrescanResult | null {
    if (!isRecord(raw)) return null;
    const findings = parseArray(raw.findings, parseFinding);
    const filesSkipped = parseArray(raw.filesSkipped, parseSkippedFile);
    const skippedChecks = parseArray(raw.skippedChecks, parseSkippedCheck);
    const engineVersions = parseEngineVersions(raw.engineVersions);
    const counters = parseResultCounters(raw);
    if (findings === null || filesSkipped === null || skippedChecks === null) return null;
    if (engineVersions === null || counters === null) return null;
    return { findings, filesSkipped, skippedChecks, engineVersions, ...counters };
}
