/**
 * Shared Findings-Contract — Single Source of Truth für Backend, CLI und IDE-Extension.
 *
 * Bewusst NUR Typen (keine Runtime-Exports): Consumer können type-only
 * importieren, wodurch tsc-Builds ohne Bundler auskommen.
 */

/** Schweregrad eines Findings. Bestimmt CI-Gating (--fail-on) und IDE-Diagnostic-Level. */
export type Severity = 'CRITICAL' | 'WARNING';

/** Ein einzelnes Review-Finding, wie es Clients (CLI/IDE) konsumieren. */
export interface ScanIssue {
    /** Regel-Referenz, z.B. 'Condition 7 (Derived State Anti-Pattern)' oder eine Law-Rule-ID. */
    readonly rule: string;
    readonly severity: Severity;
    readonly path: string;
    /** 1-basierte Startzeile in der NEUEN Dateiversion. */
    readonly line: number;
    readonly endLine: number;
    /** Wörtliches Zitat der Trigger-Zeile(n), LF-normalisiert. Anker für den Exact-Match-Apply-Contract. */
    readonly exactQuote: string;
    /** Englische Begründung des Findings. */
    readonly critique: string;
    /** Drop-in-Ersatz für die Zeilen [line, endLine]; Anwendung nur nach menschlicher Freigabe. */
    readonly fixedCodeSnippet?: string;
}

/** Gesamtergebnis eines Scans, wie es die Polling-API zurückgibt. */
export interface ScanResult {
    readonly hasSlop: boolean;
    readonly issues: readonly ScanIssue[];
    readonly summary: string;
    readonly filesReviewed: number;
}

/** Lebenszyklus eines review_jobs-Eintrags. */
export type JobStatus = 'pending' | 'processing' | 'done' | 'error';

/** Antwort von POST /api/cli/scan. */
export interface ScanSubmitResponse {
    readonly jobId: string;
}

/** Antwort von GET /api/cli/scan/[jobId]. */
export interface ScanPollResponse {
    readonly status: JobStatus;
    readonly result?: ScanResult;
    readonly error?: string;
}
