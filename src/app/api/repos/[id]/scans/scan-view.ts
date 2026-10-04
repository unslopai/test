/**
 * Strukturelles Mapping persistierter review_jobs auf die Kunden-Scan-Sicht
 * (DASHBOARD_UX_SPEC.md §4). `result` ist JSON aus der DB und wird hier an
 * der Grenze geparst, nie blind gecastet [ARCH-002] — dasselbe Prinzip wie
 * toScanResult im CLI-Poll-Endpoint, aber für die Dashboard-DTOs.
 *
 * Verdict-Semantik (§3): 'neutral' deckt alles ab, was KEIN Urteil ist —
 * nicht-terminale Jobs, Fehler-Läufe und nothing_reviewed-Läufe (der
 * Honesty-Marker aus dem ResultPersister). Ein has_slop-Widerspruch
 * (has_slop true, aber 0 parsebare Issues) bleibt 'slop' — lieber ein
 * Befund ohne Details als ein falsches "kein Slop".
 */

export type ScanVerdict = 'clean' | 'slop' | 'neutral';

export interface ScanIssueView {
    readonly rule: string;
    readonly path: string;
    readonly line: number;
    readonly severity: 'CRITICAL' | 'WARNING';
    readonly critique: string;
    /** Lane des Findings: deterministischer Pre-Scan oder LLM-Kaskade. */
    readonly source: 'prescan' | 'llm';
    /** Verbalized Confidence 0-100 der Cascade-Verifikation; null = keine. */
    readonly confidence: number | null;
}

export interface ScanView {
    readonly id: string;
    readonly prNumber: number | null;
    readonly prUrl: string | null;
    readonly createdAt: string;
    readonly status: string;
    readonly verdict: ScanVerdict;
    readonly integrityScore: number | null;
    readonly issueCount: number;
    readonly issues: readonly ScanIssueView[];
}

/** Kompakte Zeilen-Sicht für die Repo-Liste (§4.2, `last_scan`). */
export interface LastScanView {
    readonly createdAt: string;
    readonly verdict: ScanVerdict;
    readonly issueCount: number;
}

/** Die Spalten, die die Scan-Historie aus review_jobs liest [DATA-001]. */
export interface ReviewJobRow {
    readonly id: string;
    readonly created_at: string;
    readonly status: string;
    readonly pr_number: number | null;
    readonly pr_url: string | null;
    readonly integrity_score: number | null;
    readonly result: unknown;
}

// =============================================================================
// Issue-Parsing (ARCH-002)
// =============================================================================

function readField(candidate: object, fieldName: string): unknown {
    return Reflect.get(candidate, fieldName);
}

/**
 * Parst genau EIN Issue-Element strukturell. Elemente ohne die vier
 * Pflichtfelder (rule, path, line, critique) werden verworfen statt als
 * halb-definierte Objekte ins UI zu laufen; unbekannte Severity degradiert
 * auf WARNING (nie stillschweigend auf CRITICAL hoch).
 */
function parseScanIssue(rawIssue: unknown): ScanIssueView | null {
    if (typeof rawIssue !== 'object' || rawIssue === null) {
        return null;
    }

    const rule = readField(rawIssue, 'rule');
    const path = readField(rawIssue, 'path');
    const line = readField(rawIssue, 'line');
    const critique = readField(rawIssue, 'critique');

    if (typeof rule !== 'string' || typeof path !== 'string'
        || typeof line !== 'number' || typeof critique !== 'string') {
        return null;
    }

    const severity = readField(rawIssue, 'severity');
    const issueSource = readField(rawIssue, 'source');
    const confidence = readField(rawIssue, 'confidence');

    return {
        rule,
        path,
        line,
        severity: severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        critique,
        source: issueSource === 'pre-scanner' ? 'prescan' : 'llm',
        confidence: typeof confidence === 'number' ? confidence : null,
    };
}

export function parseScanIssues(rawIssues: unknown): ScanIssueView[] {
    if (!Array.isArray(rawIssues)) {
        return [];
    }
    return rawIssues
        .map(parseScanIssue)
        .filter((issue): issue is ScanIssueView => issue !== null);
}

// =============================================================================
// Verdict
// =============================================================================

/**
 * `deterministicOnly` (LANGUAGE_COVERAGE_SPEC §6.2): kein Modell hat gelesen.
 * Findings des Pre-Scanners sind echt und bleiben 'slop'; ohne Findings ist
 * der Lauf aber kein 'clean', sondern 'neutral'.
 */
export function deriveScanVerdict(input: {
    readonly status: string;
    readonly nothingReviewed: boolean;
    readonly deterministicOnly?: boolean;
    readonly hasSlop: boolean;
    readonly issueCount: number;
}): ScanVerdict {
    if (input.status !== 'done' || input.nothingReviewed) {
        return 'neutral';
    }
    if (input.hasSlop || input.issueCount > 0) return 'slop';
    return input.deterministicOnly ? 'neutral' : 'clean';
}

// =============================================================================
// Job → DTO
// =============================================================================

/** Strukturelle Sicht auf das persistierte result-Blob (ARCH-002). */
interface ParsedResultBlob {
    readonly hasSlop: boolean;
    readonly nothingReviewed: boolean;
    readonly deterministicOnly: boolean;
    readonly issues: readonly ScanIssueView[];
}

function parseResultBlob(rawResult: unknown): ParsedResultBlob {
    if (typeof rawResult !== 'object' || rawResult === null) {
        return { hasSlop: false, nothingReviewed: false, deterministicOnly: false, issues: [] };
    }

    const review = readField(rawResult, 'review');
    const reviewObject = typeof review === 'object' && review !== null ? review : {};

    return {
        hasSlop: readField(reviewObject, 'has_slop') === true,
        nothingReviewed: readField(rawResult, 'nothing_reviewed') === true,
        deterministicOnly: readField(rawResult, 'deterministic_only') === true,
        issues: parseScanIssues(readField(reviewObject, 'issues')),
    };
}

export function mapReviewJobToScanView(jobRow: ReviewJobRow): ScanView {
    const parsedResult = parseResultBlob(jobRow.result);

    return {
        id: jobRow.id,
        prNumber: jobRow.pr_number,
        prUrl: jobRow.pr_url,
        createdAt: jobRow.created_at,
        status: jobRow.status,
        verdict: deriveScanVerdict({
            status: jobRow.status,
            nothingReviewed: parsedResult.nothingReviewed,
            deterministicOnly: parsedResult.deterministicOnly,
            hasSlop: parsedResult.hasSlop,
            issueCount: parsedResult.issues.length,
        }),
        integrityScore: jobRow.integrity_score,
        issueCount: parsedResult.issues.length,
        issues: parsedResult.issues,
    };
}

// =============================================================================
// Embed → last_scan (§4.2)
// =============================================================================

/**
 * Mappt das PostgREST-Embed `review_jobs(created_at, status, nothing_reviewed,
 * review)` (lateral order/limit 1) auf das `last_scan`-Feld der Repo-Liste.
 * Das Embed liefert pro Repo ein Array mit höchstens einem Element; alles
 * strukturell Unerwartete wird zu null ("nie gescannt" bleibt der ehrliche
 * Default, nie ein erfundenes Urteil).
 */
export function mapLastScan(embeddedJobRows: unknown): LastScanView | null {
    if (!Array.isArray(embeddedJobRows) || embeddedJobRows.length === 0) {
        return null;
    }

    const latestJob = embeddedJobRows[0];
    if (typeof latestJob !== 'object' || latestJob === null) {
        return null;
    }

    const createdAt = readField(latestJob, 'created_at');
    const status = readField(latestJob, 'status');
    if (typeof createdAt !== 'string' || typeof status !== 'string') {
        return null;
    }

    const review = readField(latestJob, 'review');
    const reviewObject = typeof review === 'object' && review !== null ? review : {};
    const issueCount = parseScanIssues(readField(reviewObject, 'issues')).length;

    return {
        createdAt,
        verdict: deriveScanVerdict({
            status,
            nothingReviewed: readField(latestJob, 'nothing_reviewed') === true,
            deterministicOnly: readField(latestJob, 'deterministic_only') === true,
            hasSlop: readField(reviewObject, 'has_slop') === true,
            issueCount,
        }),
        issueCount,
    };
}
