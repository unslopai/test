/**
 * Hinweiszeile für Stufen, die der Deadline Guard aus Zeitgründen übersprungen
 * oder abgebrochen hat (DEADLINE_GUARD_SPEC.md §3.4). EINE Formulierung für
 * Check-Run-Summary, GitHub-Review-Body und CLI — ein Zeit-Skip darf auf keiner
 * Fläche wie ein vollständiger Lauf aussehen.
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
