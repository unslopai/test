/**
 * Review-Umfang eines Jobs ohne reviewbare Datei (LANGUAGE_COVERAGE_SPEC §6.2,
 * Stufe 1).
 *
 * Bis 2026-09-30 brach ein PR ohne JS/TS-Datei ab, bevor der Pre-Scanner lief.
 * Jetzt gilt: enthält er mindestens eine Datei der deterministischen Lane,
 * läuft der Pre-Scanner, die LLM-Steps bleiben aus (`llmSkipped`), und das
 * Ergebnis heißt auf jeder Oberfläche „nur deterministische Prüfung“. Docs-only
 * und alles ohne sprachspezifische Regel bleibt „Nothing to review“ (E3).
 *
 * Beide Diff-Loader entscheiden hier, und Persister, Reporter und Check Run
 * lesen das Ergebnis über `resolveReviewOutcome` — eine Stelle, damit keine
 * Oberfläche ein anderes Urteil zeigt als die andere. Den Grund zu „nichts
 * geprüft“ liefert ebenso eine Stelle, `describeNothingReviewed`.
 */
import { isDeterministicLaneFile } from '@unslop/prescan/language';
import { formatDeterministicOnlyNotice, formatPrescanFailedNotice } from '@unslop/shared/degradation-notice';
import type { DeterministicOnlySurface } from '@unslop/shared/degradation-notice';
import type { PrescanStats, SkippedFile } from '@unslop/prescan';
import type { ScanOutcome } from '@unslop/shared';
import type { PullRequestFile } from '@/lib/github';
import type { PipelineContext } from '@/lib/pipeline/types';

/** Generierte/vendored Pfade, die nie deterministisch gescannt werden. */
const PRESCAN_IGNORED_PATH_PATTERN = /(^|\/)(node_modules|dist|build|\.next|\.git)\/|\.min\.(js|css)$/;

/**
 * Lockfiles (LANGUAGE_COVERAGE_SPEC §6.2): vom Paketmanager erzeugt, voller
 * Hashes und aufgelöster Versionen. Ein Renovate-PR nur mit Lockfiles ist
 * „Nothing to review“, kein Lauf der deterministischen Lane — und die
 * universellen Regex-Regeln sollen keine Integritäts-Hashes lesen.
 */
const LOCKFILE_NAMES: ReadonlySet<string> = new Set([
    'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb',
    'poetry.lock', 'Pipfile.lock', 'Cargo.lock', 'go.sum', 'composer.lock', 'Gemfile.lock',
]);

const SIZE_CAP_ABORT_REASON = 'All changed code files exceed the review size cap.';
const NO_REVIEWABLE_FILES_REASONS: Readonly<Record<DeterministicOnlySurface, string>> = {
    pull_request: 'No reviewable code files in this pull request.',
    local_diff: 'No reviewable code files in this diff.',
};
const DEFAULT_NOTHING_REVIEWED_REASON = 'No reviewable files in this pull request.';

/** Eine Datei, die der Pre-Scanner überhaupt ansieht: mit Patch, nicht generiert, kein Lockfile. */
export function isPrescanScannable(changedFile: PullRequestFile): boolean {
    return changedFile.patch !== undefined
        && !PRESCAN_IGNORED_PATH_PATTERN.test(changedFile.filename)
        && !isLockfile(changedFile.filename);
}

function isLockfile(filePath: string): boolean {
    return LOCKFILE_NAMES.has(filePath.split('/').pop() ?? '');
}

/**
 * Kill-Switch (LANGUAGE_COVERAGE_SPEC §6.3): `UNSLOP_PRESCAN_ONLY_REVIEW=off`
 * stellt das Verhalten vor Stufe 1 wieder her, ohne Deploy. Gelesen wird zur
 * Laufzeit, damit der Schalter mit dem nächsten Job greift.
 */
export function isPrescanOnlyReviewEnabled(): boolean {
    return process.env.UNSLOP_PRESCAN_ONLY_REVIEW !== 'off';
}

function hasDeterministicLaneFile(changedFiles: readonly PullRequestFile[]): boolean {
    return changedFiles.some((changedFile) => changedFile.status !== 'removed'
        && isPrescanScannable(changedFile)
        && isDeterministicLaneFile(changedFile.filename));
}

export interface UnreviewableDiffInput {
    readonly changedFiles: readonly PullRequestFile[];
    /** Dateien, die der Größen-Cap aus der LLM-Lane genommen hat. */
    readonly omittedFilePaths: readonly string[];
    readonly surface: DeterministicOnlySurface;
}

/** Der Teil des Kontexts, den ein Diff ohne reviewbare Datei festlegt. */
export type UnreviewableDiffPlan = Pick<
    PipelineContext,
    'shouldAbort' | 'abortReason' | 'llmSkipped' | 'deterministicOnlyReason'
>;

/**
 * Entscheidung für einen Diff, aus dem keine Datei die LLM-Lane erreicht.
 * Der Größen-Cap-Abbruch bleibt unverändert: dort gab es reviewbaren Code, er
 * war nur zu groß, und „nur deterministisch geprüft“ würde das verdecken.
 */
export function planUnreviewableDiff(unreviewableDiff: UnreviewableDiffInput): UnreviewableDiffPlan {
    const abortReason = NO_REVIEWABLE_FILES_REASONS[unreviewableDiff.surface];
    if (unreviewableDiff.omittedFilePaths.length > 0) {
        return { shouldAbort: true, abortReason: SIZE_CAP_ABORT_REASON, llmSkipped: false };
    }
    if (!isPrescanOnlyReviewEnabled() || !hasDeterministicLaneFile(unreviewableDiff.changedFiles)) {
        return { shouldAbort: true, abortReason, llmSkipped: false };
    }
    return {
        shouldAbort: false,
        // Bleibt gesetzt: läuft der Pre-Scanner für dieses Repo nicht oder
        // scheitert er, ist das der Grund des dann ehrlichen „nichts geprüft“.
        abortReason,
        llmSkipped: true,
        deterministicOnlyReason: formatDeterministicOnlyNotice(unreviewableDiff.surface),
    };
}

/**
 * Das Urteil über den Lauf, wie es jede Oberfläche zeigt.
 * `deterministic_only` verlangt einen tatsächlich gelaufenen Pre-Scan, der
 * mindestens eine Datei geprüft hat: ist der Step für das Repo abgeschaltet
 * (`prescanStats === null`), degradiert oder hat er jede Datei übersprungen
 * (z. B. über `maxFileBytes`), hat niemand etwas geprüft.
 */
export function resolveReviewOutcome(
    context: Pick<PipelineContext, 'shouldAbort' | 'deterministicOnlyReason' | 'prescanStats'>,
): ScanOutcome {
    if (context.shouldAbort) return 'nothing_reviewed';
    if (context.deterministicOnlyReason === undefined) return 'reviewed';
    return hasPrescanCheckedAFile(context.prescanStats) ? 'deterministic_only' : 'nothing_reviewed';
}

function hasPrescanCheckedAFile(prescanStats: PrescanStats | null): boolean {
    return prescanStats !== null && !prescanStats.degraded && prescanStats.filesScanned > 0;
}

/** Warum ein Lauf „nichts geprüft“ ist — `check_failed` darf keine Oberfläche als erledigt zeigen. */
export interface NothingReviewedNotice {
    readonly kind: 'nothing_to_review' | 'check_failed';
    readonly reason: string;
}

/**
 * Der Grund zu `nothing_reviewed` für Check Run, PR-Kommentar und die
 * gespeicherte Summary. Plante der Diff-Loader einen Lauf nur mit dem
 * Pre-Scanner, gab es prüfbare Dateien: „No reviewable code files“ wäre dann
 * falsch. Ein degradierter Pre-Scan ist ein Ausfall, ein Pre-Scan ohne
 * geprüfte Datei nennt die übersprungenen Dateien.
 */
export function describeNothingReviewed(
    context: Pick<PipelineContext, 'shouldAbort' | 'abortReason' | 'deterministicOnlyReason' | 'prescanStats'>,
): NothingReviewedNotice {
    const abortNotice: NothingReviewedNotice = {
        kind: 'nothing_to_review',
        reason: context.abortReason ?? DEFAULT_NOTHING_REVIEWED_REASON,
    };
    const prescanStats = context.prescanStats;
    // Abbruch im Diff-Loader, kein Plan ohne Modell, oder Step für das Repo
    // abgeschaltet (§6.3): der Abbruchgrund gilt wie vor Stufe 1.
    if (context.shouldAbort || context.deterministicOnlyReason === undefined || prescanStats === null) {
        return abortNotice;
    }
    if (prescanStats.degraded) return { kind: 'check_failed', reason: formatPrescanFailedNotice() };
    if (prescanStats.filesScanned === 0) {
        return { kind: 'nothing_to_review', reason: describeUnscannedChange(prescanStats.filesSkipped) };
    }
    return abortNotice;
}

const SKIPPED_FILE_LABELS: Readonly<Record<SkippedFile['reason'], string>> = {
    'size-cap': 'exceeds the size cap',
    'budget-exhausted': 'time budget exhausted',
    'patch-only-input': 'no file content',
};

/** "Nothing to review: … the pre-scanner checked no file (skipped: a.py, exceeds the size cap)." */
function describeUnscannedChange(filesSkipped: readonly SkippedFile[]): string {
    const scanOutcome = filesSkipped.length > 0
        ? `the pre-scanner checked no file (skipped: ${filesSkipped
            .map((skippedFile) => `${skippedFile.path}, ${SKIPPED_FILE_LABELS[skippedFile.reason]}`)
            .join('; ')}).`
        : 'the pre-scanner found no added lines to check.';
    return 'Nothing to review: this change has no TypeScript or JavaScript file for the model review, '
        + `and ${scanOutcome}`;
}
