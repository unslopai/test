/**
 * Typed Insert-Helper für review_job_llm_calls (SPEC.md §5).
 *
 * Jeder LLM-Call der Cascade schreibt seine Telemetrie-Zeile SOFORT nach
 * dem Call (auch bei Fehlern) — so überlebt die Unit-Economics-Datenbasis
 * jeden späteren Step-Crash. Ein fehlgeschlagener Telemetrie-Insert darf
 * umgekehrt NIE den Kunden-Review abbrechen (Graceful Degradation, D10):
 * Recovery = Review läuft weiter, der Verlust wird strukturiert geloggt.
 */
import { supabase } from '@/lib/supabase';
import type { CacheStatus } from '@/lib/pipeline/context-cache';
import type { ModelResponseDiagnostics } from '@/lib/pipeline/helpers';
import type { ClaimVerdict, TokenUsage } from '@/lib/pipeline/types';

export type LlmCallPhase =
    | 'draft'
    | 'verify'
    | 'escalate_targeted'
    | 'escalate_full'
    /** Pro-Zweitmeinung auf einem Datei-Subset (LLM_LANE_QUALITY_SPEC §4.5, Migration 044). */
    | 'escalate_second_opinion';
export type LlmCallStatus =
    | 'ok'
    | 'parse_error'
    | 'api_error'
    | 'skipped_budget'
    /** Mangels Job-Budget nicht gestartet (DEADLINE_GUARD_SPEC D12, Migration 048). */
    | 'skipped_deadline';

export interface LlmCallRecord {
    readonly jobId: string;
    readonly repoId: string | null;
    readonly phase: LlmCallPhase;
    readonly model: string;
    readonly status: LlmCallStatus;
    readonly tokenUsage?: TokenUsage;
    readonly latencyMs?: number;
    /** Wie der Call den Explicit Context Cache genutzt hat (PROMPT_CACHING_SPEC §5). */
    readonly cacheStatus?: CacheStatus;
    readonly claimsTotal?: number;
    readonly claimsConfirmed?: number;
    readonly claimsRefuted?: number;
    readonly claimsUncertain?: number;
    /** Vollständige Verdicts des Calls — Audit-Grundlage für False Refutations. */
    readonly verdictDetails?: readonly ClaimVerdict[];
    /** finishReason, Block-Grund und geblockte Kategorien (Migration 054); fehlt ohne Antwort (api_error, skipped_*). */
    readonly responseDiagnostics?: ModelResponseDiagnostics;
}

/** PostgREST: Spalte nicht im Schema-Cache — hier: Migration 054 noch nicht angewendet. */
const MISSING_COLUMN_ERROR_CODE = 'PGRST204';

export async function recordLlmCall(callRecord: LlmCallRecord): Promise<void> {
    const baseRow = {
        job_id: callRecord.jobId,
        repo_id: callRecord.repoId,
        phase: callRecord.phase,
        model: callRecord.model,
        status: callRecord.status,
        prompt_tokens: callRecord.tokenUsage?.promptTokens ?? null,
        cached_tokens: callRecord.tokenUsage?.cachedTokens ?? null,
        output_tokens: callRecord.tokenUsage?.outputTokens ?? null,
        latency_ms: callRecord.latencyMs ?? null,
        cache_status: callRecord.cacheStatus ?? null,
        claims_total: callRecord.claimsTotal ?? null,
        claims_confirmed: callRecord.claimsConfirmed ?? null,
        claims_refuted: callRecord.claimsRefuted ?? null,
        claims_uncertain: callRecord.claimsUncertain ?? null,
        verdicts: callRecord.verdictDetails ?? null,
    };
    const responseDiagnostics = callRecord.responseDiagnostics;
    const telemetryRow = responseDiagnostics
        ? {
            ...baseRow,
            finish_reason: responseDiagnostics.finishReason,
            block_reason: responseDiagnostics.blockReason,
            safety_categories: responseDiagnostics.safetyCategories.length > 0
                ? responseDiagnostics.safetyCategories
                : null,
        }
        : baseRow;

    let { error: telemetryInsertError } = await supabase.from('review_job_llm_calls').insert(telemetryRow);
    if (telemetryInsertError?.code === MISSING_COLUMN_ERROR_CODE && telemetryRow !== baseRow) {
        // Kosten und Status sind die Unit-Economics-Basis, die Diagnose nur ein
        // Zusatz: vor Migration 054 lieber die Zeile ohne sie als gar keine.
        console.warn(
            `[LlmCallLog] Diagnose-Spalten fehlen (Migration 054 nicht angewendet) — Zeile ohne sie ` +
            `(Job ${callRecord.jobId}, Phase ${callRecord.phase}): ${telemetryInsertError.message}`,
        );
        ({ error: telemetryInsertError } = await supabase.from('review_job_llm_calls').insert(baseRow));
    }

    if (telemetryInsertError) {
        console.error(
            `[LlmCallLog] Telemetrie-Zeile verloren (Job ${callRecord.jobId}, ` +
            `Phase ${callRecord.phase}, Modell ${callRecord.model}): ` +
            `${telemetryInsertError.message} — Review läuft ohne diese Zeile weiter.`,
        );
    }
}
