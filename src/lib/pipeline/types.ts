/**
 * Core-Typen für die Pluggable Pipeline Engine.
 *
 * Definiert den Vertrag, den jeder PipelineStep erfüllen muss,
 * sowie den durchlaufenden PipelineContext und die Konfiguration.
 */
import type { PullRequestFile } from '@/lib/github';
import type { Severity } from '@unslop/shared';

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
    readonly repositoryId: string | null;
    /** PR-Diff-Daten (werden vom DiffLoaderStep befüllt) */
    readonly prFiles: readonly PullRequestFile[];
    readonly reviewableFiles: readonly PullRequestFile[];
    readonly combinedDiff: string;
    /** Dateien, die wegen Größen-Caps nicht reviewt wurden (Summary-Hinweis). */
    readonly omittedFiles: readonly string[];
    /** Akkumulierte Findings aller bisherigen Steps */
    readonly issues: readonly PipelineIssue[];
    /** LLM-generierte Zusammenfassung der Findings */
    readonly reviewSummary: string;
    /** RAG-Kontext (wird vom RagLoaderStep befüllt) */
    readonly ragPromptSection: string;
    /** Prompt-Konfiguration für den AI-Reviewer */
    readonly promptConfig: PromptConfig;
    /** Token-Verbrauch des Reviewer-Calls (wird vom AiReviewerStep befüllt). */
    readonly tokenUsage: TokenUsage | null;
    /** Ob die Pipeline nach diesem Step abbrechen soll. */
    readonly shouldAbort: boolean;
    readonly abortReason?: string;
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
}

export type {
    IssueSeverity,
    TokenUsage,
    PipelineIssue,
    PromptConfig,
    PipelineContext,
    PipelineStep,
    PipelineConfig,
};
