/**
 * Core-Typen des deterministischen Pre-Scanners (pre_scanner_design.md §4).
 *
 * Das Package ist bewusst frei von Supabase-/Next-Imports: alle Außenwelt-
 * Zugriffe (Registry-Cache, fetch, Uhr) kommen als injizierte Ports herein,
 * damit CLI und Extension denselben Core unverändert einbetten können.
 */

/** Identisch zum shared Severity-Contract (@unslop/shared) — lokal dupliziert,
 *  damit der Core standalone bleibt. */
export type PrescanSeverity = 'CRITICAL' | 'WARNING';

/** Welche Engine ein Finding erzeugt hat; externe Tool-IDs kommen in Phase v2 dazu. */
export type EngineId = 'tree-sitter' | 'regex' | 'eslint' | 'config' | 'registry';

/** Registries für Package-Existenz-Checks (SEC-035/036). */
export type RegistryId = 'npm' | 'pypi' | 'crates' | 'hf-hub';

/** Core-internes Finding — wird im Step 1:1 auf PipelineIssue gemappt. */
export interface PrescanFinding {
    readonly ruleId: string;
    readonly ruleTitle: string;
    readonly severity: PrescanSeverity;
    readonly path: string;
    /** 1-basiert, Koordinaten der NEUEN Dateiversion. */
    readonly line: number;
    readonly endLine: number;
    /** Der gematchte Quelltext (getrimmt, ≤200 Zeichen). */
    readonly exactQuote: string;
    /** Statisches Template pro Regel — kein LLM. */
    readonly explanation: string;
    readonly fixTemplate?: string;
    readonly engine: EngineId;
    /** File-Level-Findings werden auf die erste Added-Line der Datei verankert. */
    readonly fileLevel: boolean;
}

/** Eine zu scannende Datei. content === null ⇒ Patch-only Degraded Mode (§7.1). */
export interface PrescanFile {
    readonly path: string;
    /** Voller Dateiinhalt bei headSha; null wenn nur der Patch vorliegt (CLI-Jobs). */
    readonly content: string | null;
    /** Unified-Diff-Hunks der Datei — Quelle des Added-Line-Filters (PROC-007). */
    readonly patch: string;
}

export interface PrescanInput {
    readonly files: readonly PrescanFile[];
}

/** Ehrlichkeits-Protokoll: was NICHT geprüft wurde, mit Grund (INFRA-002). */
export interface SkippedCheck {
    /** Golden-Rule-ID oder '*' für ganze Engine-/Datei-Ausfälle. */
    readonly ruleId: string;
    readonly reason: string;
    readonly path?: string;
}

export interface SkippedFile {
    readonly path: string;
    readonly reason: 'size-cap' | 'budget-exhausted' | 'patch-only-input';
}

/** Versions-Fingerprint für Release-über-Release-Vergleichbarkeit (PROC-002). */
export interface PrescanEngineVersions {
    readonly prescanCore: string;
    readonly treeSitter: string;
    readonly grammars: string;
    readonly eslint: string;
}

/** Ergebnis eines Core-Laufs — der Step reichert es zu PrescanStats an. */
export interface PrescanResult {
    readonly findings: readonly PrescanFinding[];
    readonly filesScanned: number;
    readonly filesSkipped: readonly SkippedFile[];
    readonly skippedChecks: readonly SkippedCheck[];
    readonly rulesEvaluated: number;
    readonly rulesDisabled: readonly string[];
    readonly durationMs: number;
    readonly engineVersions: PrescanEngineVersions;
}

/** Telemetrie + Ehrlichkeits-Record eines Prescan-Laufs (persistiert, §6.4). */
export interface PrescanStats {
    readonly degraded: boolean;
    readonly degradedReason: string | null;
    readonly findingsCount: number;
    readonly criticalCount: number;
    readonly rulesEvaluated: number;
    readonly rulesDisabled: readonly string[];
    readonly filesScanned: number;
    readonly filesSkipped: readonly SkippedFile[];
    readonly skippedChecks: readonly SkippedCheck[];
    readonly llmSkipped: boolean;
    readonly durationMs: number;
    readonly engineVersions: PrescanEngineVersions | null;
}

// =============================================================================
// Konfiguration (pipeline_config.prescan, §6.1)
// =============================================================================

export interface PrescanShortCircuitConfig {
    /** 'critical' aktiviert den Zero-Token-Kurzschluss (v1.1 — default off). */
    readonly mode: 'off' | 'critical';
    readonly minCriticalFindings: number;
}

export interface PrescanConfig {
    /** Nur Overrides werden gespeichert — { 'MAINT-003': false } deaktiviert eine Regel. */
    readonly ruleOverrides: Readonly<Record<string, boolean>>;
    readonly shortCircuit: PrescanShortCircuitConfig;
    /** SEC-035/036 Netzwerk-Lookups ein/aus. */
    readonly registryChecks: boolean;
    /** Per-File Content-Cap in Bytes. */
    readonly maxFileBytes: number;
    /** Globales Wall-Clock-Budget des gesamten Scans. */
    readonly totalBudgetMs: number;
}

// =============================================================================
// Ports (injizierte Außenwelt)
// =============================================================================

export interface RegistryCacheEntry {
    readonly packageExists: boolean;
    /** ISO-Timestamp des Lookups — Grundlage der asymmetrischen TTL (§6.3). */
    readonly checkedAt: string;
}

export interface RegistryCachePort {
    read(registry: RegistryId, packageName: string): Promise<RegistryCacheEntry | null>;
    write(registry: RegistryId, packageName: string, packageExists: boolean): Promise<void>;
}

export interface PrescanPorts {
    /** Ohne Cache-Port wird jeder Lookup live gemacht (CLI-Modus). */
    readonly registryCache?: RegistryCachePort;
    /** Injizierbar für Tests; default globalThis.fetch. */
    readonly fetchImpl?: typeof fetch;
    /** Injizierbare Uhr für Budget-Messung; default Date.now. */
    readonly now?: () => number;
    /**
     * Telemetrie-Hook nach jeder gescannten Datei (Memory-Forensik der
     * Standalone-Invocation, ROADMAP §1b). Muss synchron und fehlerfrei sein.
     */
    readonly onFileScanned?: (path: string) => void;
    /**
     * Telemetrie-Hook nach jedem Registry-Kandidaten-Check (Cache-Read oder
     * Live-Lookup) — Memory-Forensik der Post-File-Phase (ROADMAP §1b, Run 11:
     * Treppe pro Read vs. Sprung am Ende). Muss synchron und fehlerfrei sein.
     */
    readonly onRegistryCandidateChecked?: (candidateKey: string) => void;
}
