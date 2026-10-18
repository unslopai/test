/**
 * Hinweiszeilen für degradierte Läufe — EINE Formulierung je Fall für
 * Check-Run-Summary, GitHub-Review-Body und CLI:
 *  - Stufen, die der Deadline Guard aus Zeitgründen übersprungen oder
 *    abgebrochen hat (DEADLINE_GUARD_SPEC.md §3.4);
 *  - Dateien, deren Draft-Batch gescheitert ist (LARGE_DIFF_RECALL_SPEC
 *    Option A, Degradation `draft_partial`);
 *  - ein ausgefallener Pre-Scan in einem Lauf ohne Modell-Review
 *    (LANGUAGE_COVERAGE_SPEC §6.2) und neben einer Modell-Review
 *    (Kampagne große PRs 2026-09-30; seit 2026-10-03 auch in CLI, MCP und
 *    Extension über `result.prescan` der Poll-Route, die Extension mit einer
 *    Kopie samt Parity-Test in prescanNotice.ts).
 * Weder ein Zeit-Skip noch ein halber Draft noch ein ausgefallener Pre-Scan
 * darf auf irgendeiner Fläche wie ein vollständiger Lauf aussehen.
 */
import type { DraftFailureReason, SkippedStage } from './index.js';

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

const DRAFT_FAILURE_CLAUSES: Readonly<Record<DraftFailureReason, string>> = {
    // Vertex hält die Antwort nicht-deterministisch zurück (unslopai/test#50:
    // `promptFeedback.blockReason` SAFETY auf einem lsass-Dump-Skript, auch mit
    // Safety-Settings OFF/BLOCK_NONE) — ein Re-Run kann helfen, muss aber nicht.
    content_filter: " because the model provider's content filter withheld the answer",
    empty_answer: ' because the model returned an empty answer',
};

/**
 * null = jeder Draft-Batch lief, keine Zeile. Sonst werden ALLE nicht
 * geprüften Dateien genannt — eine gekürzte Liste wäre eine stille Auslassung.
 * Die Pfade stammen aus dem Diff; Terminal-Ausgaben sanitizen sie vorher.
 * Der Grund steht nur im Satz, wenn er belegt ist (`DraftFailureReason`).
 */
export function formatDraftPartialNotice(
    unreviewedFiles: readonly string[] | undefined,
    failureReason?: DraftFailureReason,
): string | null {
    if (!unreviewedFiles || unreviewedFiles.length === 0) return null;
    const fileNoun = unreviewedFiles.length === 1 ? 'file' : 'files';
    const failureClause = failureReason ? DRAFT_FAILURE_CLAUSES[failureReason] : '';
    return `Reduced coverage: the AI review failed on ${unreviewedFiles.length} ${fileNoun}${failureClause} — `
        + `not reviewed: ${unreviewedFiles.join(', ')}.`;
}

/** Wo ein Lauf ohne Modell-Review stattfand: im PR (voller Dateiinhalt) oder auf einem hochgeladenen Diff. */
export type DeterministicOnlySurface = 'pull_request' | 'local_diff';

const DETERMINISTIC_ONLY_NOTICES: Readonly<Record<DeterministicOnlySurface, string>> = {
    pull_request: 'Deterministic checks only: this pull request changes no file of a type the model review '
        + 'reads, so no model reviewed it.',
    // CLI, Extension und MCP laden nur den Diff hoch: ohne Dateiinhalt laufen
    // keine AST- und Config-Regeln (LANGUAGE_COVERAGE_SPEC §4.2: 7 statt 27 von 69).
    // Ausnahme: eine neue Datei, deren ganzer Inhalt im Diff steht (new-file-content.ts).
    local_diff: 'Deterministic checks only: this diff changes no file of a type the model review reads, '
        + 'so no model reviewed it. New files the server could rebuild from the diff got the AST and config rules '
        + 'too; on all other files only the regex and registry rules ran, because those rules need a pull request.',
};

/**
 * EINE Formulierung dafür, dass kein Modell gelesen hat und warum
 * (LANGUAGE_COVERAGE_SPEC §6.2) — für Check Run, PR-Kommentar und die
 * gespeicherte Summary, die CLI, Extension und MCP anzeigen.
 */
export function formatDeterministicOnlyNotice(surface: DeterministicOnlySurface): string {
    return DETERMINISTIC_ONLY_NOTICES[surface];
}

/**
 * Belegte Ursache eines Pre-Scan-Ausfalls (Spiegel von `PrescanDegradedCause`
 * in @unslop/prescan; dieses Package hängt von keinem anderen ab).
 */
export type PrescanFailureCause = 'payload_too_large';

const NO_MODEL_CLAUSE = 'no model reviews it because it changes no file of a type the model review reads';

/**
 * Der Pre-Scan war die einzige Prüfung eines Laufs ohne Modell-Review und ist
 * ausgefallen (Fail-Safe-Pfad des Steps). Das ist kein „nichts zu prüfen“: es
 * gab prüfbare Dateien, geprüft wurde keine.
 *
 * Kein Rat zum Re-Run, solange niemand weiß, ob er hilft: bei HTTP 413
 * (Body über dem Plattform-Limit, unslopai/test#35) scheitert derselbe Change
 * sicher wieder, und das sagt der Satz. Ein Speicher-Kill kommt am Worker als
 * gewöhnlicher HTTP 500 an und ist damit eine unbekannte Ursache.
 */
export function formatPrescanFailedNotice(failureCause?: PrescanFailureCause): string {
    if (failureCause === 'payload_too_large') {
        return 'Not reviewed: the deterministic pre-scanner failed on this change because the scan request '
            + `exceeded its size limit (HTTP 413), and ${NO_MODEL_CLAUSE}. Nothing was checked; re-running `
            + 'the review fails the same way.';
    }
    return `Not reviewed: the deterministic pre-scanner failed on this change, and ${NO_MODEL_CLAUSE}. `
        + 'Nothing was checked.';
}

/**
 * So viele Dateien ohne Pre-Scan nennt der Hinweis beim Namen. Check-Summary
 * und Review-Body fassen bei GitHub rund 65 000 Zeichen; läuft ein sehr großer
 * PR in das Batch-Zeitbudget, können Hunderte Dateien fehlen. Die ganze Liste
 * steht in `result.prescan.unscannedFiles`.
 */
const MAX_NAMED_UNSCANNED_FILES = 50;

/**
 * Der Pre-Scan ist ausgefallen, das Modell hat aber gelesen: der Review
 * erscheint sonst vollständig, obwohl die deterministischen Regeln fehlen und
 * Dateien außerhalb der Modell-Review ungeprüft bleiben. null = Pre-Scan lief
 * oder ist für das Repo abgeschaltet, keine Zeile. Beleg: unslopai/test#29,
 * Prescan-Route HTTP 500 nach Speicher-Kill, Review ohne Hinweis
 * (docs/benchmarks/LARGE_PR_CAMPAIGN.md). Kein Rat zum Re-Run: bei
 * Speicher-Kill und HTTP 413 scheitert derselbe PR wieder.
 *
 * Seit dem Datei-Batching kann auch nur ein Teil ausfallen: `unscannedFiles`
 * sind die Dateien der gescheiterten oder übersprungenen Batches, die
 * Findings der übrigen Batches stehen im Review.
 */
export function formatPrescanUnavailableNotice(
    prescanDegraded: boolean | undefined,
    unscannedFiles?: readonly string[],
): string | null {
    if (prescanDegraded !== true) return null;
    if (unscannedFiles && unscannedFiles.length > 0) {
        const fileNoun = unscannedFiles.length === 1 ? 'file' : 'files';
        const namedFiles = unscannedFiles.slice(0, MAX_NAMED_UNSCANNED_FILES);
        const unnamedCount = unscannedFiles.length - namedFiles.length;
        // Die Auslassung steht im Satz, nie still: die Zahl vorn zählt alle Dateien.
        const unnamedNote = unnamedCount > 0 ? `, and ${unnamedCount} more (full list in the job result)` : '';
        return `Reduced coverage: the deterministic pre-scanner failed on ${unscannedFiles.length} ${fileNoun} — `
            + `not checked by it: ${namedFiles.join(', ')}${unnamedNote}.`;
    }
    return 'Reduced coverage: the deterministic pre-scanner failed on this change — only the model review ran, '
        + 'and files it does not read were not checked.';
}
