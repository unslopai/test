/**
 * Default Pipeline-Konfiguration.
 *
 * Wird verwendet wenn ein Repository keine eigene pipeline_config hat
 * (z.B. bei neu verbundenen Repos). Dient auch als "Reset to Defaults"-Baseline.
 */
import { ALL_CONDITION_IDS } from '@/lib/pipeline/conditions';
import type { CascadeConfig, CascadeState, PipelineConfig } from '@/lib/pipeline/types';

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
