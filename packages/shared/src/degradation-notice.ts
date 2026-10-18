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
 *  - ein fehlendes oder gekürztes Repo-Kontextpaket (REPO_CONTEXT_SPEC §9.2).
 *  - ein tiefer Pass, der nicht (ganz) lief (REPO_CONTEXT_SPEC §14.9).
 *  - eine zweite Draft-Runde, die nicht (ganz) lief (SPEC.md §12.5.2).
 * Weder ein Zeit-Skip noch ein halber Draft noch ein ausgefallener Pre-Scan
 * darf auf irgendeiner Fläche wie ein vollständiger Lauf aussehen.
 */
import type { DeepLaneDegradation, DraftFailureReason, ScanResult, SkippedStage } from './index.js';
import type { RepoContextStatus } from './repo-context.js';

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

/**
 * Zweite Draft-Runde (SPEC.md §12.5.2, je Repo eingeschaltet): lief sie für
 * mindestens einen Batch nicht (`draft_round2_skipped_deadline`) oder
 * scheiterte (`draft_round2_failed`), sagt der Satz das — die erste Runde und
 * die Verifikation liefen voll. null = Runde lief überall oder war aus.
 */
export function formatDraftRound2Notice(degradations: readonly string[] | undefined): string | null {
    if (!degradations) return null;
    if (degradations.includes('draft_round2_skipped_deadline')) {
        return 'Reduced coverage: the second review pass was skipped for part of this change because too little time was left; '
            + 'the first pass and the verification ran in full.';
    }
    if (degradations.includes('draft_round2_failed')) {
        return 'Reduced coverage: the second review pass failed for part of this change; the first pass and the verification ran in full.';
    }
    return null;
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

/** So viele ausgelassene Kontextdateien nennt der Hinweis beim Namen; die ganze Liste steht im Job-Ergebnis. */
const MAX_NAMED_CONTEXT_OMISSIONS = 20;

/**
 * Repo-Kontextpaket (REPO_CONTEXT_SPEC §9.2): kam keines zustande
 * (Degradation `repo_context_unavailable`), lief die Review nur auf dem Diff
 * und sagt das; wurde es gekürzt, nennt der Satz die weggelassenen Dateien.
 * null = Paket vollständig, für das Repo abgeschaltet oder vom Client nicht
 * mitgeliefert, keine Zeile.
 */
export function formatRepoContextNotice(
    contextStatus: RepoContextStatus | undefined,
    omittedPaths?: readonly string[],
): string | null {
    if (contextStatus === 'unavailable') {
        return 'Reduced coverage: the repository context could not be loaded, so this review saw only the diff '
            + 'and did not check it against the manifests, schema or entry point of the repository.';
    }
    if (contextStatus !== 'loaded' || !omittedPaths || omittedPaths.length === 0) return null;
    const namedPaths = omittedPaths.slice(0, MAX_NAMED_CONTEXT_OMISSIONS);
    const unnamedCount = omittedPaths.length - namedPaths.length;
    const unnamedNote = unnamedCount > 0 ? `, and ${unnamedCount} more (full list in the job result)` : '';
    const fileNoun = omittedPaths.length === 1 ? 'file' : 'files';
    return `Reduced coverage: the repository context left out ${omittedPaths.length} ${fileNoun} `
        + `(too large, over budget, unreadable or withheld by the secret filter) — not checked against: ${namedPaths.join(', ')}${unnamedNote}.`;
}

/** Grund je Degradation des tiefen Passes; die Reihenfolge bestimmt, welcher Grund zuerst steht. */
const DEEP_LANE_REASONS: readonly (readonly [DeepLaneDegradation, string])[] = [
    ['deep_lane_no_files', 'this upload carries only the diff, not the whole changed files it needs'],
    ['deep_lane_unavailable', 'its model was unavailable (capacity or quota)'],
    ['deep_lane_timeout', 'it ran out of time'],
    ['deep_lane_skipped_deadline', 'too little time was left to run it'],
    ['deep_lane_partial', 'part of the change was over its cost cap'],
    ['deep_lane_failed', 'it failed'],
];

/** So viele ungeprüfte Dateien nennt der Hinweis beim Namen; die ganze Liste steht im Job-Ergebnis. */
const MAX_NAMED_DEEP_LANE_FILES = 20;

/**
 * Tiefer Pass (REPO_CONTEXT_SPEC §14.9): null = er lief vollständig oder gar
 * nicht (Schalter aus), keine Zeile. Sonst nennt der Satz alle Gründe und die
 * Dateien, die er nicht geprüft hat. Der übrige Review ist davon unberührt.
 */
export function formatDeepLaneNotice(
    degradations: readonly DeepLaneDegradation[] | undefined,
    unreviewedFiles?: readonly string[],
): string | null {
    if (!degradations || degradations.length === 0) return null;
    const reasons = DEEP_LANE_REASONS
        .filter(([laneDegradation]) => degradations.includes(laneDegradation))
        .map(([, reasonText]) => reasonText);
    const fileList = unreviewedFiles ?? [];
    if (fileList.length === 0) return `Reduced coverage: the deep review pass did not run fully because ${reasons.join('; ')}.`;
    const namedFiles = fileList.slice(0, MAX_NAMED_DEEP_LANE_FILES);
    const unnamedCount = fileList.length - namedFiles.length;
    const unnamedNote = unnamedCount > 0 ? `, and ${unnamedCount} more (full list in the job result)` : '';
    const fileNoun = fileList.length === 1 ? 'file' : 'files';
    return `Reduced coverage: the deep review pass did not check ${fileList.length} ${fileNoun} because ${reasons.join('; ')} — `
        + `not checked by it: ${namedFiles.join(', ')}${unnamedNote}.`;
}

/**
 * Der Review steht auf GitHub, aber die Zuordnung seiner Inline-Kommentare zu
 * den Befunden fehlt (Degradation `report_incomplete`, SPEC.md §8): ein
 * Schritt nach dem Post ist gescheitert. Der Review selbst ist vollständig.
 * null = Bericht vollständig, keine Zeile.
 */
export function formatReportIncompleteNotice(degradations: readonly string[] | undefined): string | null {
    if (!degradations?.includes('report_incomplete')) return null;
    return 'Incomplete report: the review was posted, but its comments could not be linked to the findings, '
        + 'so dismissing a finding will not resolve its review thread on GitHub.';
}

/**
 * Teilabdeckung: ein Teil des Laufs hat Dateien nicht geprüft (Pre-Scan ganz
 * oder je Batch ausgefallen, Draft-Batch gescheitert). Dieselbe Bedingung wie
 * `hasIncompleteCoverage` im Server (`review-scope.ts`), nach der der Check
 * Run statt grün „No AI slop found“ neutral „No findings, review incomplete“
 * zeigt. CLI und Extension zeigen dann kein grünes Häkchen (ROADMAP §1,
 * Befund 2026-10-03). Ein Zeit-Skip, ein fehlendes Kontextpaket oder ein
 * degradierter tiefer Pass senken die Sicherheit, nicht die Abdeckung der
 * Regel-Review: sie stehen als Hinweiszeile da, ändern das Urteil aber nicht.
 */
export function hasIncompleteCoverage(
    scanResult: Pick<ScanResult, 'prescan' | 'draftUnreviewedFiles'>,
): boolean {
    return scanResult.prescan?.degraded === true || (scanResult.draftUnreviewedFiles?.length ?? 0) > 0;
}

/** Die Felder eines Modell-Laufs, aus denen die Hinweiszeilen entstehen. */
export type DegradationFields = Pick<
    ScanResult,
    'skippedStages' | 'draftUnreviewedFiles' | 'draftFailureReason' | 'prescan' | 'repoContext' | 'degradations' | 'deepLane'
>;

/**
 * Alle Hinweiszeilen eines Modell-Laufs: Zeit-Skip, halber Draft, Pre-Scan,
 * Repo-Kontext, zweite Draft-Runde (aus `degradations`), tiefer Pass,
 * unvollständiger Bericht (aus `degradations`, zuletzt: er entsteht erst nach
 * dem Review-Post). Dieselbe
 * Reihenfolge wie Check-Summary (`worker.ts`) und PR-Review-Text
 * (`github-reporter-step.ts`); deren Tests vergleichen mit dieser Liste. Der
 * Pre-Scan steht neben dem halben Draft, weil beide die Abdeckung
 * unvollständig machen (`hasIncompleteCoverage`).
 * `cleanPath` bereinigt Pfade, die über die Leitung kamen (CLI: ANSI/OSC).
 */
export function listDegradationNotices(
    scanResult: DegradationFields,
    cleanPath: (receivedPath: string) => string = (receivedPath) => receivedPath,
): string[] {
    return [
        formatTimeBudgetNotice(scanResult.skippedStages),
        formatDraftPartialNotice((scanResult.draftUnreviewedFiles ?? []).map(cleanPath), scanResult.draftFailureReason),
        formatPrescanUnavailableNotice(scanResult.prescan?.degraded, (scanResult.prescan?.unscannedFiles ?? []).map(cleanPath)),
        formatRepoContextNotice(scanResult.repoContext?.status, (scanResult.repoContext?.omittedPaths ?? []).map(cleanPath)),
        formatDraftRound2Notice(scanResult.degradations),
        formatDeepLaneNotice(scanResult.deepLane?.degradations, (scanResult.deepLane?.unreviewedFiles ?? []).map(cleanPath)),
        formatReportIncompleteNotice(scanResult.degradations),
    ].filter((degradationNotice): degradationNotice is string => degradationNotice !== null);
}

/**
 * Gemischter Diff (LANGUAGE_COVERAGE_SPEC §6.2, Stufe 2): welche geänderten
 * Quellcode-Dateitypen kein Modell gelesen hat, weil sie nicht im
 * Review-Umfang liegen. Der Server hängt den Satz an die veröffentlichte
 * Summary (`describeFilesWithoutModelReview`); CLI und Extension holen ihn mit
 * `findUnreadFileTypesNotice` wieder heraus, damit er auch neben einem
 * sauberen Ergebnis steht (ROADMAP §3, Explainability).
 */
export function formatUnreadFileTypesNotice(unreadFileCount: number, fileTypeLabels: readonly string[]): string {
    return `No model read ${unreadFileCount} changed ${unreadFileCount === 1 ? 'file' : 'files'} `
        + `of ${fileTypeLabels.length === 1 ? 'this type' : 'these types'}: ${fileTypeLabels.join(', ')}.`;
}

/** Der Satz aus `formatUnreadFileTypesNotice`, verankert am Ende der Summary. */
const UNREAD_FILE_TYPES_NOTICE_PATTERN = /No model read \d+ changed files? of (?:this type|these types): [^\n]*\.$/;

/** null = die Summary trägt den Satz nicht (jede Datei lag im Review-Umfang). */
export function findUnreadFileTypesNotice(publishedSummary: string): string | null {
    return UNREAD_FILE_TYPES_NOTICE_PATTERN.exec(publishedSummary.trimEnd())?.[0] ?? null;
}
