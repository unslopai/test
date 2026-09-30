/**
 * Shared Findings-Contract — Single Source of Truth für Backend, CLI und IDE-Extension.
 *
 * Bewusst NUR Typen (keine Runtime-Exports): Consumer können type-only
 * importieren, wodurch tsc-Builds ohne Bundler auskommen.
 */

/** Schweregrad eines Findings. Bestimmt CI-Gating (--fail-on) und IDE-Diagnostic-Level. */
export type Severity = 'CRITICAL' | 'WARNING';

/**
 * Ein einzelnes Vorkommen eines aggregierten Findings (ROADMAP §7, Finding-
 * Aggregation pro Rule+File): dieselbe Regel, dieselbe Datei, eine weitere
 * Fundstelle. Zeilen sind server-validiert (Diff-Hunk-Manifest); exactQuote
 * ist modell-authored und damit untrusted wie ScanIssue.exactQuote.
 */
export interface IssueOccurrence {
    /** 1-basierte Startzeile in der NEUEN Dateiversion. */
    readonly line: number;
    readonly endLine: number;
    readonly exactQuote: string;
}

/**
 * Verifikationsstatus eines Findings nach der Cascade (SPEC.md §6):
 * - 'confirmed': blind re-verifiziert und bestätigt.
 * - 'uncertain': der Verifier blieb unschlüssig — Finding auf WARNING
 *   downgraded, confidence fest 50 (ein unentschiedenes Urteil ist ein
 *   Münzwurf, NICHT die Verifier-Zahl "100 % sicher, dass unklar").
 * - 'self_reported': nur die Eigen-Konfidenz des Reviewer-Modells, keine
 *   Blind-Verifikation (pro-direct, Second Opinion).
 * - 'unverified': die Verifikation lief nicht zu Ende (Eskalation
 *   übersprungen, Verifier degradiert).
 * - 'deterministic': Pre-Scanner-Regel, keine LLM-Behauptung.
 * Fehlt bei Ergebnissen vor 2026-09-17; Clients werten das als 'unverified'.
 */
export type IssueVerification = 'confirmed' | 'uncertain' | 'self_reported' | 'unverified' | 'deterministic';

/** Ein einzelnes Review-Finding, wie es Clients (CLI/IDE/MCP) konsumieren. */
export interface ScanIssue {
    /**
     * Stabile 16-Zeichen-Finding-ID (MCP_SPEC.md §4.2):
     * sha256(bareRuleId \0 path \0 exactQuote \0 occurrenceOrdinal).slice(0, 16).
     * Zeilennummern fließen bewusst NICHT ein. Jobs, die vor Migration 034
     * persistiert wurden, liefern das Feld nicht — neue Ergebnisse immer.
     */
    readonly id: string;
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
    /**
     * Aggregations-Contract (ROADMAP §7): gesetzt NUR wenn dieses Finding ≥ 2
     * Vorkommen derselben Regel in derselben Datei bündelt — dann listet das
     * Array ALLE Vorkommen aufsteigend nach Zeile, und line/endLine/exactQuote
     * spiegeln das erste Element (Anker für Apply-Contract und Finding-ID).
     * Fehlt bei Einzel-Findings und bei Ergebnissen vor dem Aggregations-Release.
     */
    readonly occurrences?: readonly IssueOccurrence[];
    /** Verifikationsstatus (siehe IssueVerification); Basis der Score-Tagline. */
    readonly verification?: IssueVerification;
}

/**
 * Ehrlichkeits-Diskriminator eines Scan-Ergebnisses (ROADMAP §3):
 * 'reviewed' = mindestens eine Datei wurde tatsächlich geprüft;
 * 'nothing_reviewed' = die Pipeline hat 0 Dateien geprüft (Size-Cap, kein
 * reviewbarer Diff, Abort). hasSlop:false ist dann KEIN Clean-Urteil und
 * darf nie als "No slop ✓" gerendert werden.
 */
export type ScanOutcome = 'reviewed' | 'nothing_reviewed';

/** Stufen, die der Deadline Guard übersprungen oder abgebrochen hat (DEADLINE_GUARD_SPEC D6). */
export type SkippedStage = 'second_opinion' | 'escalation' | 'verifier';

/** Gesamtergebnis eines Scans, wie es die Polling-API zurückgibt. */
export interface ScanResult {
    readonly hasSlop: boolean;
    readonly issues: readonly ScanIssue[];
    readonly summary: string;
    readonly filesReviewed: number;
    readonly outcome: ScanOutcome;
    /** Wegen des Review-Size-Caps ausgelassene Dateipfade (auch bei outcome 'reviewed' befüllt). */
    readonly omittedFiles: readonly string[];
    /**
     * Cognitive Integrity Score 0-100: wie sicher die Kaskade sich bei diesen
     * Findings ist (nicht: wie gut der Code ist). null = Verifikation war nicht
     * verfügbar, kein ehrlicher Score möglich.
     */
    readonly cognitiveIntegrityScore: number | null;
    /**
     * Degradationen der Kaskade (z.B. `time_budget_exhausted`, `verifier_api_error`).
     * Additiv: fehlt bei Ergebnissen vor 2026-09-26 und bei Partials.
     */
    readonly degradations?: readonly string[];
    /** Aus Zeitgründen übersprungene Stufen; leer/fehlend = alles lief. */
    readonly skippedStages?: readonly SkippedStage[];
    /**
     * Dateien, die der AI-Review nicht gesehen hat, weil ihr Draft-Batch
     * scheiterte (Degradation `draft_partial`, LARGE_DIFF_RECALL_SPEC
     * Option A). Additiv: fehlt bei Ergebnissen vor 2026-09-29.
     */
    readonly draftUnreviewedFiles?: readonly string[];
}

/** Lebenszyklus eines review_jobs-Eintrags. */
export type JobStatus = 'pending' | 'processing' | 'done' | 'error';

/** Antwort von POST /api/cli/scan. */
export interface ScanSubmitResponse {
    readonly jobId: string;
}

/**
 * Sichtbare Phase eines Scans (MCP_SPEC.md §4.1):
 * submitted = noch kein Teilergebnis, deterministic = Prescan-Partial liegt
 * vor (LLM läuft noch), complete = terminales Ergebnis persistiert.
 */
export type ScanPhase = 'submitted' | 'deterministic' | 'complete';

/**
 * Deterministische Re-roll-Eskalation (MCP_SPEC.md §4.5) — additiv, nie ein
 * Gate: die Findings werden trotzdem vollständig geliefert.
 */
export interface RerollNotice {
    readonly attempts: number;
    /** Normalisierte bare Rule-IDs der weiterhin offenen Findings. */
    readonly persistentRules: readonly string[];
    readonly message: string;
}

/** Antwort von GET /api/cli/scan/[jobId] — additiv erweitert (MCP_SPEC.md §4.1). */
export interface ScanPollResponse {
    readonly status: JobStatus;
    readonly phase: ScanPhase;
    readonly result?: ScanResult;
    /** Prescan-Teilergebnis, solange status 'processing' und phase 'deterministic'. */
    readonly partialResult?: ScanResult;
    readonly rerollNotice?: RerollNotice;
    /**
     * Stabiler Fehlercode bei status 'error' — nie Server-Detailtext:
     * `job_stalled` (5-Minuten-Stall), `model_unavailable` (Vertex-Kapazität
     * nach den server-seitigen Retries, transient), `review_timeout`
     * (Zeitlimit der Plattform, DEADLINE_GUARD_SPEC D5/D9) oder `server_error`.
     */
    readonly error?: string;
}
