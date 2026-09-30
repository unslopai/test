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
 * Oberfläche ein anderes Urteil zeigt als die andere.
 */
import { isDeterministicLaneFile } from '@unslop/prescan/language';
import { formatDeterministicOnlyNotice } from '@unslop/shared/degradation-notice';
import type { DeterministicOnlySurface } from '@unslop/shared/degradation-notice';
import type { ScanOutcome } from '@unslop/shared';
import type { PullRequestFile } from '@/lib/github';
import type { PipelineContext } from '@/lib/pipeline/types';

/** Generierte/vendored Pfade, die nie deterministisch gescannt werden. */
const PRESCAN_IGNORED_PATH_PATTERN = /(^|\/)(node_modules|dist|build|\.next|\.git)\/|package-lock\.json$|\.min\.(js|css)$/;

const SIZE_CAP_ABORT_REASON = 'All changed code files exceed the review size cap.';
const NO_REVIEWABLE_FILES_REASONS: Readonly<Record<DeterministicOnlySurface, string>> = {
    pull_request: 'No reviewable code files in this pull request.',
    local_diff: 'No reviewable code files in this diff.',
};

/** Eine Datei, die der Pre-Scanner überhaupt ansieht: mit Patch, nicht generiert. */
export function isPrescanScannable(changedFile: PullRequestFile): boolean {
    return changedFile.patch !== undefined && !PRESCAN_IGNORED_PATH_PATTERN.test(changedFile.filename);
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
 * `deterministic_only` verlangt einen tatsächlich gelaufenen Pre-Scan: ist der
 * Step für das Repo abgeschaltet (`prescanStats === null`) oder degradiert,
 * hat niemand etwas geprüft.
 */
export function resolveReviewOutcome(
    context: Pick<PipelineContext, 'shouldAbort' | 'deterministicOnlyReason' | 'prescanStats'>,
): ScanOutcome {
    if (context.shouldAbort) return 'nothing_reviewed';
    if (context.deterministicOnlyReason === undefined) return 'reviewed';
    const prescanCompleted = context.prescanStats !== null && !context.prescanStats.degraded;
    return prescanCompleted ? 'deterministic_only' : 'nothing_reviewed';
}
