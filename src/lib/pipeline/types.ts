/**
 * Core-Typen für die Pluggable Pipeline Engine.
 *
 * Definiert den Vertrag, den jeder PipelineStep erfüllen muss,
 * sowie den durchlaufenden PipelineContext und die Konfiguration.
 */
import type { PullRequestFile } from '@/lib/github';
import type { RepoAuthMode } from '@/lib/repo-auth';
import type { StepTiming } from '@/lib/pipeline/step-timeline';
import type { PrescanConfig, PrescanStats } from '@unslop/prescan';
import type {
    DeepLaneDegradation,
    DraftFailureReason,
    IssueOccurrence,
    IssueVerification,
    ScanDeepLane,
    Severity,
    SkippedStage,
} from '@unslop/shared';
import type { RepoContextPackage, RepoContextStatus } from '@unslop/shared/repo-context';
import type { ImportResolutionMaterial } from '@/lib/pipeline/draft-batch-imports';

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
    /** Fix-Hinweis als Prosa (Shared ScanIssue.fixAdvice): nie als `suggestion`, nie angewendet. */
    readonly fixAdvice?: string;
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
    /**
     * Nur am Sammelfinding des E4-Deckels (`prescan-hit-cap.ts`): jede
     * Fundstelle, für die es steht, der eigene Anker zuerst. Die Prescan-Dedupe
     * und jede Zählung lesen daraus die tatsächlichen Treffer statt eines
     * Eintrags (LANGUAGE_COVERAGE_SPEC §6.2). Landet mit dem Issue in
     * `review_jobs.result`; der Shared-Contract kennt das Feld nicht.
     */
    readonly cappedHits?: readonly PrescanHitLocation[];
    /**
     * Nur an Condition-12-Befunden (REPO_CONTEXT_SPEC §7.1): die Kontextdatei
     * des Pakets, auf die sich der Befund stützt, und seine Art. Grundlage der
     * festen Verifier-Frage; landet mit dem Issue in `review_jobs.result`.
     */
    readonly repoMismatch?: RepositoryMismatchEvidence;
}

/** Geschlossene Liste aus REPO_CONTEXT_SPEC §7.1. */
type RepositoryMismatchKind =
    | 'schema'
    | 'manifest'
    | 'removed_api'
    | 'unloaded_entry'
    | 'in_memory_state'
    | 'second_database';

interface RepositoryMismatchEvidence {
    /** Pfad eines Abschnitts im Kontextpaket des Calls (server-validiert). */
    readonly contextPath: string;
    readonly mismatchKind: RepositoryMismatchKind;
}

/** Eine Fundstelle eines Pre-Scanner-Treffers, dateiübergreifend (anders als IssueOccurrence). */
interface PrescanHitLocation {
    readonly path: string;
    readonly line: number;
    readonly endLine: number;
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
    | 'draft_partial'
    /**
     * REPO_CONTEXT_SPEC §9.2: das Kontextpaket kam nicht zustande (Abruf
     * gescheitert, Zeitgrenze, ungültiger Upload). Die Review lief nur auf dem
     * Diff; Condition 12 meldet dann nichts. Kein Einfluss auf den Score.
     */
    | 'repo_context_unavailable'
    /**
     * SPEC.md §12.5.2: mindestens ein Batch bekam keine zweite Draft-Runde, weil
     * danach keine 60 s LLM-Restbudget vor dem Verifier geblieben wären. Die
     * erste Runde zählt voll; kein Einfluss auf den Score.
     */
    | 'draft_round2_skipped_deadline'
    /**
     * SPEC.md §12.5.2: die zweite Draft-Runde mindestens eines Batches ist
     * gescheitert (API-, Parse- oder leere Antwort). Die erste Runde zählt
     * voll; kein Einfluss auf den Score.
     */
    | 'draft_round2_failed'
    /**
     * SPEC.md §8: der Review steht auf GitHub, aber ein Schritt danach im
     * Reporter scheiterte (Nachladen der Kommentar-IDs oder Schreiben der
     * Finding-Map, MCP_SPEC §4.3). Ergebnis und Check laufen weiter; ein
     * aufgelöster Befund schließt seinen Review-Thread dann nicht. Kein
     * Einfluss auf den Score.
     */
    | 'report_incomplete'
    /**
     * REPO_CONTEXT_SPEC §14.9: der tiefe Pass lief nicht (ganz). Kein Einfluss
     * auf den Score; Gründe und Dateien zusätzlich in `deepLane`.
     */
    | DeepLaneDegradation;

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
    /** Belegter Grund zu `draftUnreviewedFiles` (leere/zurückgehaltene Antwort); null = keiner bzw. gemischt. */
    readonly draftFailureReason: DraftFailureReason | null;
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
    /** Abrechnungstreu: Antwort plus Thinking. */
    readonly outputTokens: number;
    /**
     * Der Thinking-Anteil von `outputTokens` (Migration 065), keine zweite
     * Summe; null = der Anbieter liefert die Zahl nicht (Claude; Gemini ohne Thinking).
     */
    readonly thoughtsTokens: number | null;
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
    /** Review-Umfang aus pipeline_config.reviewScope (Default, Repo-Config und Env-Rollback aufgelöst). */
    readonly reviewScopeConfig: ReviewScopeConfig;
    /** Dauer je abgeschlossenem Step, vom Runner geführt (DEADLINE_GUARD_SPEC §3.7). */
    readonly stepTimings: readonly StepTiming[];
    /** Repo-Kontext aus pipeline_config.repoContext (Schalter und Token-Obergrenze, mit Defaults gemerged). */
    readonly repoContextConfig: RepoContextConfig;
    /** Kontextpaket des Jobs (RepoContextLoaderStep); der Inhalt wird nie persistiert. */
    readonly repoContext: RepoContextState;
    /**
     * Vom Client hochgeladenes Paket, roh aus dem Job-Payload (CliDiffLoaderStep).
     * Fehlt bei PR-Jobs und alten Clients; validiert es der RepoContextLoaderStep.
     */
    readonly uploadedContextPackage?: unknown;
    /** Zeilen des Modell-Diffs, in denen der serverseitige Secret-Filter Material ersetzt hat. */
    readonly secretRedactions: readonly SecretRedaction[];
    /** Tiefer Pass aus pipeline_config.deepLane (Schalter, Deckel, Deadline, mit Defaults gemerged). */
    readonly deepLaneConfig: DeepLaneConfig;
    /**
     * Ergebnis des tiefen Passes (REPO_CONTEXT_SPEC §14) — EIGENE Befund-Spur:
     * `deepLane.issues` fließen nie in `issues`, also nie in Verifier,
     * Eskalation oder Score; zusammengeführt wird erst in collectReportableIssues.
     */
    readonly deepLane: DeepLaneState;
    /**
     * Die laufende Lane zwischen Draft-Step (Start) und deep-lane-join
     * (Abschluss). Nie persistiert; fehlt, wenn keine Lane läuft.
     */
    readonly deepLaneRun?: DeepLaneRun;
    /**
     * Material für die Import-Kanten des Draft-Batchings (SPEC.md §12.5.1):
     * Head-Inhalt der geänderten Dateien und tsconfig/jsconfig/go.mod, vom
     * Pre-Scanner-Step mitgeladen. Fehlt es, zählen nur die Import-Zeilen im
     * Patch und relative Pfade. Nie persistiert.
     */
    readonly importResolution?: ImportResolutionMaterial;
    /** Zweite Draft-Runde aus pipeline_config.draftSecondRound (Schalter mit Default und Kill-Switch aufgelöst). */
    readonly draftSecondRoundConfig: DraftSecondRoundConfig;
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
    /**
     * Review-Umfang (LANGUAGE_COVERAGE_SPEC §6.3) — strukturell durchgereicht,
     * die Feld-Validierung macht resolveReviewScopeConfig.
     */
    readonly reviewScope?: unknown;
    /**
     * Repo-Kontext (REPO_CONTEXT_SPEC §12 Frage 2) — strukturell durchgereicht,
     * die Feld-Validierung macht resolveRepoContextConfig.
     */
    readonly repoContext?: unknown;
    /**
     * Tiefer Pass (REPO_CONTEXT_SPEC §14.8) — strukturell durchgereicht, die
     * Feld-Validierung macht resolveDeepLaneConfig.
     */
    readonly deepLane?: unknown;
    /**
     * Zweite Draft-Runde (SPEC.md §12.5.2) — strukturell durchgereicht, die
     * Feld-Validierung macht resolveDraftSecondRoundConfig.
     */
    readonly draftSecondRound?: unknown;
}

/** Schalter der zweiten Draft-Runde mit Negativliste (SPEC.md §12.5.2). */
interface DraftSecondRoundConfig {
    /** false = je Batch nur eine Draft-Runde wie vor 2026-10-11. */
    readonly enabled: boolean;
}

/** Schalter und Kostenbremse des Kontextpakets (REPO_CONTEXT_SPEC §12, Auflage Wirtschaftlichkeit). */
interface RepoContextConfig {
    /** false = kein Paket, kein Abruf, keine Condition 12 für dieses Repo. */
    readonly enabled: boolean;
    /** Token-Obergrenze des Pakets je Draft-Call; was nicht passt, fällt ganz weg und wird genannt. */
    readonly maxTokens: number;
}

interface RepoContextState {
    readonly status: RepoContextStatus;
    readonly contextPackage: RepoContextPackage | null;
    /** Dauer von Abruf und Bau in ms; null = nicht versucht. */
    readonly loadMs: number | null;
    /**
     * Dauer der Condition-12-Lane (getrennter Call je Draft-Batch, inkl.
     * Retries) in ms (REPO_CONTEXT_SPEC §9.5); null = kein Call gelaufen.
     */
    readonly reviewMs: number | null;
    /**
     * Server-Code zum Status `unavailable` (z. B. `timeout`, `http_404`, nach
     * dem Split auch `context_review_failed`); nie Fremdtext.
     */
    readonly unavailableReason: string | null;
}

/** Schalter, Kosten-Deckel und Zeitgrenze des tiefen Passes (REPO_CONTEXT_SPEC §14.8). */
interface DeepLaneConfig {
    /** false (Default) = kein Datei-Abruf, kein Call. */
    readonly enabled: boolean;
    /** Deckel je PR in USD Liste, vorab aus den Token-Schätzungen der Batches. */
    readonly maxCostUsd: number;
    /** Obergrenze der Lane-Deadline; es gilt min(diese, LLM-Restbudget beim Start). */
    readonly deadlineMs: number;
}

/** Was der Verifier a-lite mit den Finder-Befunden gemacht hat (§14.4); gepostet wird nur `confirmed`. */
interface DeepLaneCounts {
    readonly findings: number;
    /** An der Boundary verworfen (Pfad außerhalb des Batches, ungültige Zeile). */
    readonly invalid: number;
    readonly confirmed: number;
    readonly uncertain: number;
    readonly refuted: number;
    /** Ohne Urteil (Verify gescheitert, nicht gestartet oder Claim fehlte in der Antwort). */
    readonly unverified: number;
}

interface DeepLaneState {
    readonly status: ScanDeepLane['status'];
    /** CONFIRMED-Befunde, vor der Dedupe gegen Regelbefunde (die macht collectReportableIssues). */
    readonly issues: readonly PipelineIssue[];
    readonly degradations: readonly DeepLaneDegradation[];
    /** Dateien übersprungener oder gescheiterter Batches, in Diff-Reihenfolge. */
    readonly unreviewedFiles: readonly string[];
    readonly counts: DeepLaneCounts;
    /** Listenkosten aller Calls der Lane in USD (Telemetrie je Call in review_job_llm_calls.cost_usd). */
    readonly costUsd: number;
    /** Dauer vom Start bis zum Ende der Lane; null = keine Lane gelaufen. */
    readonly laneMs: number | null;
}

/** Ergebnis einer Lane, bevor der Join-Step es in den Kontext legt. */
type DeepLaneOutcome = Omit<DeepLaneState, 'status'>;

/** Handle auf die laufende Lane: die Promise wirft nie, `cancel` bricht alle Calls ab. */
interface DeepLaneRun {
    readonly outcome: Promise<DeepLaneOutcome>;
    readonly cancel: () => void;
}

/** Eine redigierte Zeile: Datei, Zeile und Musterklassen, nie das Material. */
interface SecretRedaction {
    readonly path: string;
    /** 1-basierte Zeile der neuen Datei; null bei einer entfernten Zeile. */
    readonly line: number | null;
    readonly patternClasses: readonly string[];
}

/** Welche Dateien die Modell-Review liest (LANGUAGE_COVERAGE_SPEC §6.3). */
interface ReviewScopeConfig {
    /**
     * Endungen, die die Modell-Review ZUSÄTZLICH zu JS/TS liest, z. B. `.py`.
     * Leer heißt: nur JS/TS.
     */
    readonly llmExtensions: readonly string[];
}

export type {
    DraftSecondRoundConfig,
    DeepLaneConfig,
    DeepLaneCounts,
    DeepLaneOutcome,
    DeepLaneRun,
    DeepLaneState,
    ReviewScopeConfig,
    RepoContextConfig,
    RepoContextState,
    RepositoryMismatchEvidence,
    RepositoryMismatchKind,
    SecretRedaction,
    IssueSeverity,
    RepoAuthMode,
    TokenUsage,
    PipelineIssue,
    PrescanHitLocation,
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
