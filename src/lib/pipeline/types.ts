/**
 * Core-Typen für die Pluggable Pipeline Engine.
 *
 * Definiert den Vertrag, den jeder PipelineStep erfüllen muss,
 * sowie den durchlaufenden PipelineContext und die Konfiguration.
 */
import type { PullRequestFile } from '@/lib/github';
import type { RepoAuthMode } from '@/lib/repo-auth';
import type { PrescanConfig, PrescanStats } from '@unslop/prescan';
import type { IssueOccurrence, IssueVerification, Severity, SkippedStage } from '@unslop/shared';

// =============================================================================
// Issue Types
// =============================================================================

/** Alias auf den Shared-Contract — eine Quelle für Backend, CLI und Extension. */
type IssueSeverity = Severity;

/**
 * Gemeinsames Issue-Format, das jeder PipelineStep produzieren kann.
 * Mappt 1:1 auf das GitHub Inline-Comment Format.
 */
interface PipelineIssue {
    /**
     * Stabile Finding-ID (MCP_SPEC.md §4.2). Optional, weil Steps Issues ohne
     * ID erzeugen — vergeben wird sie ausschließlich von assignFindingIds an
     * den zwei Sites collectReportableIssues und Prescan-Partial-Write (§4.1).
     */
    readonly id?: string;
    readonly rule: string;
    readonly severity: IssueSeverity;
    readonly path: string;
    readonly line: number;
    readonly endLine: number;
    readonly exactQuote: string;
    readonly critique: string;
    readonly fixedCodeSnippet?: string;
    /** Welcher PipelineStep dieses Issue erzeugt hat. */
    readonly source: string;
    /** Verbalized Confidence 0-100 aus der Cascade-Verifikation (SPEC.md §6). */
    readonly confidence?: number;
    /**
     * Verifikationsstatus (Shared-Contract, SPEC.md §6). Vergibt der
     * integrity-scorer für die LLM-Lane und der pre-scanner ('deterministic')
     * für seine Lane; Basis der ehrlichen Score-Tagline in CLI/Extension/GitHub.
     */
    readonly verification?: IssueVerification;
    /**
     * Aggregations-Contract (Shared ScanIssue.occurrences): gesetzt NUR wenn
     * dieses Issue ≥ 2 Vorkommen derselben Regel in derselben Datei bündelt.
     * line/endLine/exactQuote spiegeln dann das erste Vorkommen — Anker für
     * Finding-ID, Apply-Contract und den GitHub-Inline-Comment.
     */
    readonly occurrences?: readonly IssueOccurrence[];
}

// =============================================================================
// Router Cascade (SPEC.md §4.3)
// =============================================================================

/** Blindes Verifikations-Urteil zu genau einem Claim (= Draft-Issue). */
interface ClaimVerdict {
    /** Stabile per-Job-Referenz auf das Draft-Issue (z.B. 'c1'). */
    readonly claimId: string;
    readonly verificationQuestion: string;
    readonly blindAnswer: string;
    readonly verdict: 'CONFIRMED' | 'REFUTED' | 'UNCERTAIN';
    /** Verbalized Confidence 0-100. */
    readonly confidence: number;
    readonly phase: 'flash-verify' | 'pro-verify';
}

type CascadeRoute = 'flash-cascade' | 'pro-direct';

type CascadeDegradation =
    | 'pro_budget_exhausted'
    | 'pro_api_error'
    | 'verifier_parse_error'
    | 'verifier_api_error'
    /** D8 (PROMPT_CACHING_SPEC §6.3): Explicit-Cache-Pfad fiel auf inline zurück. */
    | 'cache_fallback'
    /** DEADLINE_GUARD_SPEC D6: mindestens eine Stufe lief wegen des Job-Budgets nicht (voll). */
    | 'time_budget_exhausted'
    /**
     * LARGE_DIFF_RECALL_SPEC Option A: mindestens ein paralleler Draft-Batch
     * ist gescheitert, die übrigen zählen; die nicht geprüften Dateien stehen
     * in `draftUnreviewedFiles`, der Score ist null.
     */
    | 'draft_partial';

/** Stufen, die der Deadline Guard übersprungen oder abgebrochen hat (D6) — Wire-Typ aus dem Shared-Contract. */
type SkippableStage = SkippedStage;

type EscalationReason =
    | 'complexity_heuristic'
    | 'uncertain_claims'
    | 'critical_low_confidence'
    /** Second-Opinion-Trigger (LLM_LANE_QUALITY_SPEC §4.2) hat Pro gerufen. */
    | 'second_opinion';

/** Durchlaufender Zustand der Router Cascade, angereichert von jedem Cascade-Step. */
interface CascadeState {
    readonly route: CascadeRoute;
    readonly estimatedDiffTokens: number;
    readonly verdicts: readonly ClaimVerdict[];
    /** Claim-IDs, die der escalation-reviewer per Pro nachprüfen muss. */
    readonly escalationClaimIds: readonly string[];
    readonly escalated: boolean;
    readonly escalationReason: EscalationReason | null;
    /** null = Verifikation degradiert, kein ehrlicher Score möglich. */
    readonly integrityScore: number | null;
    readonly degradations: readonly CascadeDegradation[];
    /** Vom Deadline Guard übersprungene/abgebrochene Stufen; leer = alles lief. */
    readonly skippedStages: readonly SkippableStage[];
    /**
     * Dateien gescheiterter Draft-Batches (Degradation `draft_partial`), in
     * Diff-Reihenfolge; leer = der Draft hat jede reviewbare Datei gesehen.
     */
    readonly draftUnreviewedFiles: readonly string[];
}

/** Schwellenwerte der Cascade — pro Repo in pipeline_config.cascade (SPEC.md §7). */
interface CascadeConfig {
    /** CRITICAL-Issues unter dieser Confidence werden eskaliert. */
    readonly confidenceThreshold: number;
    /** Geschätzte Diff-Tokens, ab denen direkt pro-direct geroutet wird. */
    readonly heuristicMaxDiffTokens: number;
    /** Reviewbare Dateien, ab denen direkt pro-direct geroutet wird. */
    readonly heuristicMaxFiles: number;
    /**
     * Kosten-Deckel: Diffs über dieser Token-Schätzung gehen NIE als
     * Pro-Volldurchlauf raus, egal wie komplex sie sind. Die Pro-Kosten pro Job
     * skalieren linear mit der Diff-Größe; ohne diese Schranke bestimmt allein
     * das 300-KB-Diff-Cap den Worst Case und frisst die Marge eines Kunden,
     * der systematisch riesige PRs öffnet.
     */
    readonly proDirectMaxDiffTokens: number;
    /** Max. Claims pro Verifier-Call; darüber wird gechunkt. */
    readonly verifierBatchCap: number;
    /**
     * Datei-Batch-Chunking des Drafts (LARGE_DIFF_RECALL_SPEC Option A,
     * Bau-Entscheid 2026-09-29: 20k, 12k an Gate 4 verworfen): liegt die
     * Token-Schätzung des Diffs darüber, fährt der Draft parallele Batches
     * mit je höchstens so vielen geschätzten Tokens. Darunter bleibt der
     * Draft-Request byte-identisch zum Einzel-Call. Bewusst getrennt von
     * `heuristicMaxDiffTokens` (Routing) — zwei Fragen, zwei Schrauben.
     */
    readonly draftBatchMaxTokens: number;
    /**
     * Slop Score Gating: liegt der finale Cognitive Integrity Score STRIKT
     * unter diesem Wert, schließt der GitHub-Check als `failure` ab.
     * 0 = Gate deaktiviert (Default — der Score ist nie < 0). Ein null-Score
     * (Verifikation degradiert) löst das Gate bewusst nicht aus: es gibt
     * keinen ehrlichen Score, und die Degradation ist separat sichtbar.
     */
    readonly minIntegrityScore: number;
}

// =============================================================================
// Token Telemetry
// =============================================================================

/**
 * Token-Verbrauch eines LLM-Calls (aus Gemini usageMetadata).
 * Grundlage für die Unit-Economics-Baseline und den Caching-Nachweis.
 */
interface TokenUsage {
    readonly promptTokens: number;
    readonly cachedTokens: number;
    readonly outputTokens: number;
    readonly model: string;
}

// =============================================================================
// Prompt Configuration
// =============================================================================

/**
 * Konfiguration, die bestimmt, welche Conditions im Prompt aktiv sind
 * und ob Smart Context Detection angewendet werden soll.
 */
interface PromptConfig {
    /** IDs der aktiv geschalteten Conditions. */
    readonly activeConditionIds: readonly string[];
    /** PR-Dateipfade für Smart Context Detection. */
    readonly filePaths: readonly string[];
    /** Wenn true, werden Scope-Filter ignoriert (alle activeConditionIds bleiben). */
    readonly overrideSmartDetection: boolean;
}

// =============================================================================
// Pipeline Context
// =============================================================================

/**
 * Der durchlaufende Kontext, den jeder Step lesen und anreichern kann.
 * Steps erzeugen neue Objekte statt den bestehenden Kontext zu mutieren.
 */
interface PipelineContext {
    /** Job-Metadaten */
    readonly jobId: string;
    readonly repoFullName: string;
    readonly prNumber: number;
    readonly headSha: string;
    readonly githubToken: string;
    /**
     * Mit welcher Identität die Pipeline gegenüber GitHub auftritt (GITHUB_APP_SPEC §3).
     * 'app' = Installation-Token (Bot), 'oauth' = User-Token.
     *
     * Der Check Run steht bewusst NICHT im Kontext: er gehört dem Worker (D12).
     * Ein Step, der ihn schließen könnte, würde den Check bei abgeschaltetem
     * Reporter hängen lassen.
     */
    readonly authMode: RepoAuthMode;
    readonly repositoryId: string | null;
    /** Handler-Einstieg der Route, die den Job angenommen hat (DEADLINE_GUARD_SPEC D1). */
    readonly jobStartedAtMs: number;
    /**
     * Bis hier müssen alle LLM-Calls fertig sein (Start + Budget − Reserve, D2).
     * null = kein Job-Budget — nur Benchmark-/Replay-Harness, nie ein Prod-Job.
     */
    readonly deadlineAtMs: number | null;
    /** Repo-Owner — Grundlage für das Pro-Eskalations-Budget (SPEC.md §7). */
    readonly ownerUserId: string;
    /** PR-Diff-Daten (werden vom DiffLoaderStep befüllt) */
    readonly prFiles: readonly PullRequestFile[];
    readonly reviewableFiles: readonly PullRequestFile[];
    readonly combinedDiff: string;
    /** Dateien, die wegen Größen-Caps nicht reviewt wurden (Summary-Hinweis). */
    readonly omittedFiles: readonly string[];
    /** Akkumulierte Findings aller bisherigen Steps */
    readonly issues: readonly PipelineIssue[];
    /**
     * Deterministische Pre-Scanner-Findings — SEPARATE Lane, die NIE in
     * buildBlindClaims einfließt (PROC-001: ein LLM darf deterministische
     * Fakten nicht re-judgen). Merge nur an Report-/Persist-Grenzen via
     * collectReportableIssues (pre_scanner_design.md §5.1).
     */
    readonly prescanIssues: readonly PipelineIssue[];
    /** Telemetrie + Ehrlichkeits-Record des Prescan-Laufs; null = nicht gelaufen. */
    readonly prescanStats: PrescanStats | null;
    /** true = LLM-Steps übersprungen (Short-Circuit, v1.1); Grund in prescanStats. */
    readonly llmSkipped: boolean;
    /** LLM-generierte Zusammenfassung der Findings */
    readonly reviewSummary: string;
    /** RAG-Kontext (wird vom RagLoaderStep befüllt) */
    readonly ragPromptSection: string;
    /**
     * Gated Reference-Practices-Sektion (RagLoaderStep, BEST_PRACTICES_PLAN §9).
     * Advisory-only und NUR für den User-Prompt des Draft-Reviewers —
     * Verifier und Escalation sehen sie strukturell nie (PROC-001).
     */
    readonly practicesPromptSection: string;
    /**
     * Repo-Ökosysteme aus `repositories.detected_ecosystems` (Ingest-Zeit).
     * null = Repo seit dem Phase-5-Feature nicht re-ingested → ungefilterter
     * Law-Block, kein Practice-Retrieval (ehrlicher Fallback).
     */
    readonly detectedEcosystems: readonly string[] | null;
    /** Prompt-Konfiguration für den AI-Reviewer */
    readonly promptConfig: PromptConfig;
    /** Aggregierter Token-Verbrauch aller LLM-Calls des Jobs (Cascade-Summe). */
    readonly tokenUsage: TokenUsage | null;
    /** Zustand der Router Cascade (SPEC.md §4). */
    readonly cascade: CascadeState;
    /** Cascade-Schwellenwerte aus pipeline_config (mit Code-Defaults gemerged). */
    readonly cascadeConfig: CascadeConfig;
    /** Prescan-Konfiguration aus pipeline_config.prescan (mit Code-Defaults gemerged). */
    readonly prescanConfig: PrescanConfig;
    /** Ob die Pipeline nach diesem Step abbrechen soll. */
    readonly shouldAbort: boolean;
    readonly abortReason?: string;
    /**
     * Gesetzt, wenn keine Datei die LLM-Lane erreicht, der Pre-Scanner aber
     * läuft (LANGUAGE_COVERAGE_SPEC §6.2): der Satz, der auf jeder Oberfläche
     * sagt, dass kein Modell gelesen hat und warum. `llmSkipped` ist dann true.
     * Das Urteil des Laufs liefert `resolveReviewOutcome`.
     */
    readonly deterministicOnlyReason?: string;
}

// =============================================================================
// Pipeline Step Contract
// =============================================================================

/**
 * Der Vertrag, den JEDES Pipeline-Tool erfüllen muss.
 * Steps sind zustandslos. Ihr einziger State ist der PipelineContext.
 */
interface PipelineStep {
    /** Stabiler Identifier für Dashboard-Toggles, z.B. 'ai-reviewer'. */
    readonly id: string;
    /** Anzeigename für Logs und Dashboard. */
    readonly displayName: string;
    /** Führt den Step aus und gibt einen neuen, angereicherten Kontext zurück. */
    execute(context: PipelineContext): Promise<PipelineContext>;
}

// =============================================================================
// Pipeline Configuration
// =============================================================================

/**
 * Konfiguration einer Pipeline-Instanz.
 * Repräsentiert die Dashboard-Toggles eines Users/Repos.
 */
interface PipelineConfig {
    /** Geordnete Liste der aktivierten Step-IDs. */
    readonly enabledStepIds: readonly string[];
    /** Aktive Condition-IDs für den Prompt Builder. */
    readonly activeConditionIds: readonly string[];
    /** Smart Context Detection ein/aus. */
    readonly overrideSmartDetection: boolean;
    /** Cascade-Schwellenwerte; fehlende Felder fallen auf Code-Defaults zurück. */
    readonly cascade?: Partial<CascadeConfig>;
    /**
     * Prescan-Block (§6.1) — wird nur strukturell durchgereicht; die Feld-
     * Validierung macht resolvePrescanConfig (identisch zum cascade-Muster).
     */
    readonly prescan?: unknown;
}

export type {
    IssueSeverity,
    RepoAuthMode,
    TokenUsage,
    PipelineIssue,
    PromptConfig,
    PipelineContext,
    PipelineStep,
    PipelineConfig,
    ClaimVerdict,
    CascadeRoute,
    CascadeDegradation,
    SkippableStage,
    EscalationReason,
    CascadeState,
    CascadeConfig,
};
