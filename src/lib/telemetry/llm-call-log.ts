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
import type { ClaimVerdict, TokenUsage } from '@/lib/pipeline/types';

export type LlmCallPhase =
    | 'draft'
    | 'verify'
    | 'escalate_targeted'
    | 'escalate_full'
    /** Pro-Zweitmeinung auf einem Datei-Subset (LLM_LANE_QUALITY_SPEC §4.5, Migration 044). */
    | 'escalate_second_opinion';
export type LlmCallStatus = 'ok' | 'parse_error' | 'api_error' | 'skipped_budget';

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
}

export async function recordLlmCall(callRecord: LlmCallRecord): Promise<void> {
    const { error: telemetryInsertError } = await supabase
        .from('review_job_llm_calls')
        .insert({
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
        });

    if (telemetryInsertError) {
        console.error(
            `[LlmCallLog] Telemetrie-Zeile verloren (Job ${callRecord.jobId}, ` +
            `Phase ${callRecord.phase}, Modell ${callRecord.model}): ` +
            `${telemetryInsertError.message} — Review läuft ohne diese Zeile weiter.`,
        );
    }
}
