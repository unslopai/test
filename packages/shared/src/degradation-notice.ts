/**
 * Hinweiszeilen für degradierte Läufe — EINE Formulierung je Fall für
 * Check-Run-Summary, GitHub-Review-Body und CLI:
 *  - Stufen, die der Deadline Guard aus Zeitgründen übersprungen oder
 *    abgebrochen hat (DEADLINE_GUARD_SPEC.md §3.4);
 *  - Dateien, deren Draft-Batch gescheitert ist (LARGE_DIFF_RECALL_SPEC
 *    Option A, Degradation `draft_partial`).
 * Weder ein Zeit-Skip noch ein halber Draft darf auf irgendeiner Fläche wie
 * ein vollständiger Lauf aussehen.
 */
import type { SkippedStage } from './index.js';

const STAGE_LABELS: Readonly<Record<SkippedStage, string>> = {
    second_opinion: 'second opinion',
    escalation: 'escalation',
    // Der Verifier kann ganz (Schwelle vor dem ersten Batch) oder teilweise
    // (Abbruch in Batch n) fehlen — die Zeile behauptet keins von beiden.
    verifier: 'blind verification (some or all findings)',
};

/** null = keine Stufe übersprungen, keine Zeile. */
export function formatTimeBudgetNotice(skippedStages: readonly SkippedStage[] | undefined): string | null {
    if (!skippedStages || skippedStages.length === 0) return null;
    const skippedLabels = skippedStages.map((skippedStage) => STAGE_LABELS[skippedStage]);
    return `Reduced confidence: time budget exhausted — skipped: ${skippedLabels.join(', ')}.`;
}

/**
 * null = jeder Draft-Batch lief, keine Zeile. Sonst werden ALLE nicht
 * geprüften Dateien genannt — eine gekürzte Liste wäre eine stille Auslassung.
 * Die Pfade stammen aus dem Diff; Terminal-Ausgaben sanitizen sie vorher.
 */
export function formatDraftPartialNotice(unreviewedFiles: readonly string[] | undefined): string | null {
    if (!unreviewedFiles || unreviewedFiles.length === 0) return null;
    const fileNoun = unreviewedFiles.length === 1 ? 'file' : 'files';
    return `Reduced coverage: the AI review failed on ${unreviewedFiles.length} ${fileNoun} — `
        + `not reviewed: ${unreviewedFiles.join(', ')}.`;
}
