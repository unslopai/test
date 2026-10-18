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
    /**
     * Geschätzte Tokens des Repo-Kontextpakets in DIESEM Call (Migration 055):
     * der Paket-Abschnitt im Draft-Prompt bzw. die Kontextausschnitte im
     * Verifier-Prompt. Sie sind Teil von `prompt_tokens`; die Spalte macht die
     * Mehrkosten des Pakets je Call nachrechenbar. 0 oder fehlend = kein Paket.
     */
    readonly repoContextTokens?: number;
}

/** PostgREST: Spalte nicht im Schema-Cache — hier: Migration 054 oder 055 noch nicht angewendet. */
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
    // Kosten und Status sind die Unit-Economics-Basis, Diagnose (054) und
    // Paket-Tokens (055) nur ein Zusatz. Fehlt eine Spalte, fällt die Zeile
    // stufenweise zurück: erst ohne die jüngste Migration, dann ohne beide —
    // lieber eine Zeile ohne Zusatz als gar keine.
    const fallbackRows = buildFallbackRows(baseRow, callRecord);
    let { error: telemetryInsertError } = await supabase.from('review_job_llm_calls').insert(fallbackRows[0]);
    for (const narrowerRow of fallbackRows.slice(1)) {
        if (telemetryInsertError?.code !== MISSING_COLUMN_ERROR_CODE) break;
        console.warn(
            `[LlmCallLog] Zusatz-Spalten fehlen (Migration 054 oder 055 nicht angewendet) — Zeile ohne sie ` +
            `(Job ${callRecord.jobId}, Phase ${callRecord.phase}): ${telemetryInsertError.message}`,
        );
        ({ error: telemetryInsertError } = await supabase.from('review_job_llm_calls').insert(narrowerRow));
    }

    if (telemetryInsertError) {
        console.error(
            `[LlmCallLog] Telemetrie-Zeile verloren (Job ${callRecord.jobId}, ` +
            `Phase ${callRecord.phase}, Modell ${callRecord.model}): ` +
            `${telemetryInsertError.message} — Review läuft ohne diese Zeile weiter.`,
        );
    }
}

/**
 * Die Zeile in abnehmender Breite: mit allen Zusatz-Spalten, ohne die der
 * jüngsten Migration (055), ohne alle. Gleiche Stufen entfallen, sodass ein
 * Call ohne Zusatz genau einen Versuch hat.
 */
function buildFallbackRows(baseRow: Record<string, unknown>, callRecord: LlmCallRecord): Record<string, unknown>[] {
    const diagnosticColumns = buildDiagnosticColumns(callRecord);
    const contextColumns = callRecord.repoContextTokens
        ? { repo_context_tokens: callRecord.repoContextTokens }
        : {};
    const candidateRows = [
        { ...baseRow, ...diagnosticColumns, ...contextColumns },
        { ...baseRow, ...diagnosticColumns },
        baseRow,
    ];
    return candidateRows.filter((candidateRow, rowIndex) => rowIndex === 0
        || Object.keys(candidateRow).length < Object.keys(candidateRows[rowIndex - 1]).length);
}

/** Spalten aus Migration 054; nur gesetzt, wenn der Call eine Antwort hatte. */
function buildDiagnosticColumns(callRecord: LlmCallRecord): Record<string, unknown> {
    const responseDiagnostics = callRecord.responseDiagnostics;
    if (!responseDiagnostics) return {};
    return {
        finish_reason: responseDiagnostics.finishReason,
        block_reason: responseDiagnostics.blockReason,
        safety_categories: responseDiagnostics.safetyCategories.length > 0
            ? responseDiagnostics.safetyCategories
            : null,
    };
}
