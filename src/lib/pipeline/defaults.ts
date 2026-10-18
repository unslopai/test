/**
 * Default Pipeline-Konfiguration.
 *
 * Wird verwendet wenn ein Repository keine eigene pipeline_config hat
 * (z.B. bei neu verbundenen Repos). Dient auch als "Reset to Defaults"-Baseline.
 */
import { ALL_CONDITION_IDS } from '@/lib/pipeline/conditions';
import { REPOSITORY_MISMATCH_CONDITION_ID } from '@/lib/pipeline/repository-mismatch';
import { DEFAULT_REPO_CONTEXT_MAX_TOKENS } from '@unslop/shared/repo-context';
import type {
    CascadeConfig,
    CascadeState,
    PipelineConfig,
    RepoContextConfig,
    RepoContextState,
    ReviewScopeConfig,
} from '@/lib/pipeline/types';

export const DEFAULT_PIPELINE_CONFIG: Readonly<PipelineConfig> = {
    enabledStepIds: [
        'diff-loader',
        // On by default hinter dem Soft-Launch Fail-Safe Gate (pre_scanner_design.md §5.4):
        // ein Prescan-Fehler degradiert nie unter das Vor-Prescan-Verhalten.
        'pre-scanner',
        'rag-loader',
        'complexity-router',
        'draft-reviewer',
        'claim-verifier',
        'escalation-reviewer',
        // Pro-Zweitmeinung bei Draft-Under-Reporting (LLM_LANE_QUALITY_SPEC §4);
        // wie beim pre-scanner gilt: persistierte Alt-Configs ohne diese ID
        // bekommen den Step erst mit einem Config-Update (Worker filtert unbekannte IDs).
        'second-opinion-reviewer',
        'integrity-scorer',
        'github-reporter',
    ],
    activeConditionIds: ALL_CONDITION_IDS,
    overrideSmartDetection: false,
};

/**
 * Endungen, die per `reviewScope.llmExtensions` in die Modell-Review dürfen:
 * nur Sprachen, die die Gates G6–G9 gefahren haben (LANGUAGE_COVERAGE_SPEC
 * §6.4; Python und Java in §6.5, Go, C/C++, Terraform und PowerShell in §6.6).
 * Eine Endung außerhalb dieser Liste wird aus jeder Repo-Config verworfen.
 */
export const GATED_LLM_EXTENSIONS: readonly string[] = [
    '.py', '.java', '.go', '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.tf', '.ps1', '.psm1',
];

/**
 * Review-Umfang ohne Repo-Config (LANGUAGE_COVERAGE_SPEC §6.3). Die Liste
 * nennt, was die Modell-Review zusätzlich zu JS/TS liest.
 *
 * Default ist, wer G6–G9 bestanden hat: Python (Spec §6.5), Go und PowerShell
 * (Spec §6.6). Java, C/C++ und Terraform reißen G8: im Schattenlauf vom
 * 2026-10-03 standen auf je 10 echten PRs 1, 1 und 5 falsche CRITICALs, sechs
 * davon HAL-002 auf APIs, die jünger sind als das Wissen der Modelle. Sie
 * bleiben je Repo einschaltbar. Wer diese Liste ändert, zieht im selben Commit
 * die Texte nach, die den Umfang nennen (Spec §7.2).
 */
export const DEFAULT_REVIEW_SCOPE_CONFIG: Readonly<ReviewScopeConfig> = {
    llmExtensions: ['.py', '.go', '.ps1', '.psm1'],
};

/**
 * Globaler Rollback ohne Deploy (Muster `UNSLOP_ESCALATION_LEGACY_PRO`):
 * `UNSLOP_LLM_LANE_JSTS_ONLY=1` übersteuert Default und jede Repo-Config.
 * Zur Laufzeit gelesen, greift mit dem nächsten Job.
 */
export function isLlmLaneRestrictedToJsTs(): boolean {
    return process.env.UNSLOP_LLM_LANE_JSTS_ONLY === '1';
}

/**
 * Löst `pipeline_config.reviewScope` gegen Default und Env-Rollback auf.
 * Fehlt der Block oder ist er kaputt, gilt der Default; eine gültige Liste
 * (auch die leere: nur JS/TS) ersetzt ihn. Unbekannte Endungen fallen heraus —
 * eine kaputte Repo-Config darf nie einen Job töten.
 */
export function resolveReviewScopeConfig(rawReviewScope: unknown): ReviewScopeConfig {
    if (isLlmLaneRestrictedToJsTs()) return { llmExtensions: [] };
    const configuredExtensions = readConfiguredLlmExtensions(rawReviewScope);
    if (configuredExtensions === null) return DEFAULT_REVIEW_SCOPE_CONFIG;
    return {
        llmExtensions: GATED_LLM_EXTENSIONS.filter(
            (gatedExtension) => configuredExtensions.includes(gatedExtension),
        ),
    };
}

/** null = kein auswertbarer `llmExtensions`-Wert in der Repo-Config. */
function readConfiguredLlmExtensions(rawReviewScope: unknown): readonly unknown[] | null {
    if (!rawReviewScope || typeof rawReviewScope !== 'object') return null;
    const configuredExtensions = 'llmExtensions' in rawReviewScope ? rawReviewScope.llmExtensions : undefined;
    return Array.isArray(configuredExtensions) ? configuredExtensions : null;
}

/**
 * Repo-Kontext ohne Repo-Config (REPO_CONTEXT_SPEC §12 Frage 2): an, mit der
 * gemessenen Token-Obergrenze je Draft-Call (Begründung an der Konstante).
 */
export const DEFAULT_REPO_CONTEXT_CONFIG: Readonly<RepoContextConfig> = {
    enabled: true,
    maxTokens: DEFAULT_REPO_CONTEXT_MAX_TOKENS,
};

/**
 * Harte Obergrenze für `repoContext.maxTokens` aus einer Repo-Config: das
 * Doppelte des Defaults. Darüber kostet ein Paket je Draft-Call mehr, als die
 * Kostenleitplanke der Spec (§10) für den ganzen PR vorsieht.
 */
export const REPO_CONTEXT_MAX_TOKENS_CEILING = 2 * DEFAULT_REPO_CONTEXT_MAX_TOKENS;

/**
 * Globaler Rollback ohne Deploy (Muster `UNSLOP_LLM_LANE_JSTS_ONLY`):
 * `UNSLOP_REPO_CONTEXT_DISABLED=1` schaltet das Paket für jeden Job ab.
 */
export function isRepoContextGloballyDisabled(): boolean {
    return process.env.UNSLOP_REPO_CONTEXT_DISABLED === '1';
}

/**
 * Löst `pipeline_config.repoContext` gegen Default und Env-Rollback auf.
 * Ungültige Einzelfelder fallen auf den Default zurück — eine kaputte
 * Repo-Config darf nie einen Job töten.
 */
export function resolveRepoContextConfig(rawRepoContext: unknown): RepoContextConfig {
    const configuredEnabled = rawRepoContext && typeof rawRepoContext === 'object' && 'enabled' in rawRepoContext
        ? rawRepoContext.enabled
        : undefined;
    const configuredMaxTokens = rawRepoContext && typeof rawRepoContext === 'object' && 'maxTokens' in rawRepoContext
        ? rawRepoContext.maxTokens
        : undefined;
    const enabledForRepo = typeof configuredEnabled === 'boolean' ? configuredEnabled : DEFAULT_REPO_CONTEXT_CONFIG.enabled;
    return {
        enabled: enabledForRepo && !isRepoContextGloballyDisabled(),
        maxTokens: Math.min(
            resolvePositiveNumber(configuredMaxTokens, DEFAULT_REPO_CONTEXT_CONFIG.maxTokens),
            REPO_CONTEXT_MAX_TOKENS_CEILING,
        ),
    };
}

/**
 * Condition 12 hat keinen eigenen Schalter: sie ist aktiv genau dann, wenn
 * der Repo-Kontext es ist. Persistierte Configs zählen ihre Conditions
 * einzeln auf und kennen COND-012 nicht (unslopai/test, 2026-10-05); ohne
 * diese Regel bliebe das Feature dort still aus.
 */
export function resolveActiveConditionIds(
    configuredConditionIds: readonly string[],
    repoContextConfig: RepoContextConfig,
): readonly string[] {
    const selectableConditionIds = configuredConditionIds.filter(
        (conditionId) => conditionId !== REPOSITORY_MISMATCH_CONDITION_ID,
    );
    return repoContextConfig.enabled
        ? [...selectableConditionIds, REPOSITORY_MISMATCH_CONDITION_ID]
        : selectableConditionIds;
}

/** Ausgangszustand vor dem RepoContextLoaderStep. */
export function buildInitialRepoContextState(repoContextConfig: RepoContextConfig): RepoContextState {
    return {
        status: repoContextConfig.enabled ? 'not_provided' : 'disabled',
        contextPackage: null,
        loadMs: null,
        unavailableReason: null,
    };
}

/**
 * PROC-009-Gates für das Reference-Practice-Retrieval (BEST_PRACTICES_PLAN §9.3).
 * Bewusst Code-Konstanten statt pipeline_config (Interview-Entscheidung §9.1):
 * Tuning läuft über Telemetrie + Deploy, nicht über Repo-Einstellungen.
 *
 * similarityFloor liegt absichtlich ÜBER dem 0.30-Smoke-Floor der Ingestion:
 * schwache Treffer sind genau die naive Injektion, die PROC-009 mit bis zu
 * −39 Punkten Korrektheit misst — Stille ist dann das richtige Ergebnis.
 */
export const REFERENCE_PRACTICE_GATES = {
    similarityFloor: 0.45,
    topKPerEcosystem: 2,
    totalCap: 4,
    /** Budget für die gerenderte Sektion, geschätzt als ceil(chars / 4). */
    sectionTokenBudget: 1600,
} as const;

/** Cascade-Schwellenwerte (SPEC.md §7) — per Repo via pipeline_config.cascade übersteuerbar. */
export const DEFAULT_CASCADE_CONFIG: Readonly<CascadeConfig> = {
    confidenceThreshold: 70,
    heuristicMaxDiffTokens: 12000,
    heuristicMaxFiles: 15,
    // 25k Tokens deckeln den teuersten Job (~$0.06 statt ~$0.20 beim 300-KB-Cap)
    // und damit den Monats-Worst-Case pro Kunde auf einen margensicheren Wert.
    proDirectMaxDiffTokens: 25000,
    verifierBatchCap: 15,
    // Gate-Messung 2026-09-29 (LARGE_DIFF_RECALL_SPEC §3.5/§6): 20k-Batches
    // Recall 42,7 vs. 41,7/48 am Stück, max Batch 66 s, +47 % Draft-Kosten;
    // 12k reißt Gate 4 (+77 %). Greift auf flash-cascade also erst > 25k.
    draftBatchMaxTokens: 20000,
    // Slop Score Gating aus per Default: bestehende Repos dürfen durch das
    // Feature keinen neuen Merge-Blocker bekommen (opt-in via pipeline_config).
    minIntegrityScore: 0,
};

/** Ausgangszustand der Cascade vor dem complexity-router. */
export const INITIAL_CASCADE_STATE: Readonly<CascadeState> = {
    route: 'flash-cascade',
    estimatedDiffTokens: 0,
    verdicts: [],
    escalationClaimIds: [],
    escalated: false,
    escalationReason: null,
    integrityScore: null,
    degradations: [],
    skippedStages: [],
    draftUnreviewedFiles: [],
    draftFailureReason: null,
};

/**
 * Merged eine (partielle, ggf. ungültige) cascade-Config aus der DB mit den
 * Code-Defaults. Ungültige Einzelfelder fallen auf den Default zurück —
 * eine kaputte Repo-Config darf nie einen Job töten.
 */
export function resolveCascadeConfig(
    partialCascadeConfig: Partial<CascadeConfig> | undefined,
): CascadeConfig {
    return {
        confidenceThreshold: resolvePositiveNumber(
            partialCascadeConfig?.confidenceThreshold, DEFAULT_CASCADE_CONFIG.confidenceThreshold,
        ),
        heuristicMaxDiffTokens: resolvePositiveNumber(
            partialCascadeConfig?.heuristicMaxDiffTokens, DEFAULT_CASCADE_CONFIG.heuristicMaxDiffTokens,
        ),
        heuristicMaxFiles: resolvePositiveNumber(
            partialCascadeConfig?.heuristicMaxFiles, DEFAULT_CASCADE_CONFIG.heuristicMaxFiles,
        ),
        proDirectMaxDiffTokens: resolvePositiveNumber(
            partialCascadeConfig?.proDirectMaxDiffTokens, DEFAULT_CASCADE_CONFIG.proDirectMaxDiffTokens,
        ),
        verifierBatchCap: resolvePositiveNumber(
            partialCascadeConfig?.verifierBatchCap, DEFAULT_CASCADE_CONFIG.verifierBatchCap,
        ),
        draftBatchMaxTokens: resolvePositiveNumber(
            partialCascadeConfig?.draftBatchMaxTokens, DEFAULT_CASCADE_CONFIG.draftBatchMaxTokens,
        ),
        minIntegrityScore: resolveScoreThreshold(
            partialCascadeConfig?.minIntegrityScore, DEFAULT_CASCADE_CONFIG.minIntegrityScore,
        ),
    };
}

function resolvePositiveNumber(candidateValue: unknown, defaultValue: number): number {
    const isUsableNumber = typeof candidateValue === 'number'
        && Number.isFinite(candidateValue)
        && candidateValue > 0;
    return isUsableNumber ? candidateValue : defaultValue;
}

/** Score-Schwellen leben auf der 0-100-Skala; 0 ist gültig (= Gate aus). */
function resolveScoreThreshold(candidateValue: unknown, defaultValue: number): number {
    const isUsableScore = typeof candidateValue === 'number'
        && Number.isFinite(candidateValue)
        && candidateValue >= 0
        && candidateValue <= 100;
    return isUsableScore ? candidateValue : defaultValue;
}
