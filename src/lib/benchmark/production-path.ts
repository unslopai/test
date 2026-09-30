/**
 * Produktionspfad des Rule-Recall-Benchmarks (LANGUAGE_COVERAGE_SPEC §7.1).
 *
 * Der Runner gab bis 2026-09-30 jede Fixture-Datei an das Modell. In
 * Produktion filtert der Diff-Loader mit `isReviewableFile`. Ein PR ohne
 * reviewbare Datei bekommt seit Stufe 1 einen Pre-Scan ohne Modell, wenn er
 * eine Datei der deterministischen Lane enthält, sonst bricht er ab. Dieses
 * Modul entscheidet für eine Fixture, welche Dateien welche Lane erreichen —
 * mit demselben Filter und derselben Entscheidung (`planUnreviewableDiff`) wie
 * `diff-loader-step.ts`, damit der Benchmark den Pfad misst, den der Webhook fährt.
 */
import { isReviewableFile } from '@/lib/pipeline/helpers';
import { planUnreviewableDiff } from '@/lib/pipeline/review-scope';
import type { PullRequestFile } from '@/lib/github';

/** Welche Lane eine Datei in Produktion erreicht. */
export type ProductionLane = 'model-and-prescan' | 'prescan-only' | 'not-scanned';

export interface ProductionPathPlan {
    /** Dateien, die das Modell liest. Leer heißt: keine LLM-Kaskade. */
    readonly reviewableFiles: readonly PullRequestFile[];
    /** Dateien, die der Pre-Scanner sieht. */
    readonly prescanFiles: readonly PullRequestFile[];
    /** true = „Nothing to review“: weder Modell noch Pre-Scanner laufen. */
    readonly aborted: boolean;
}

/** Bisheriger Runner-Modus (`--bypass-filter`): jede Datei erreicht beide Lanes. */
export function planModelPotentialPath(fixtureFiles: readonly PullRequestFile[]): ProductionPathPlan {
    return { reviewableFiles: fixtureFiles, prescanFiles: fixtureFiles, aborted: false };
}

export function planProductionPath(fixtureFiles: readonly PullRequestFile[]): ProductionPathPlan {
    const reviewableFiles = fixtureFiles.filter((fixtureFile) => isReviewableFile(fixtureFile.filename));
    const aborted = reviewableFiles.length === 0 && planUnreviewableDiff({
        changedFiles: fixtureFiles, omittedFilePaths: [], surface: 'pull_request',
    }).shouldAbort;
    return { reviewableFiles, prescanFiles: aborted ? [] : fixtureFiles, aborted };
}

export function resolveProductionLane(filePath: string, productionPlan: ProductionPathPlan): ProductionLane {
    if (productionPlan.reviewableFiles.some((reviewableFile) => reviewableFile.filename === filePath)) {
        return 'model-and-prescan';
    }
    return productionPlan.prescanFiles.some((prescanFile) => prescanFile.filename === filePath)
        ? 'prescan-only'
        : 'not-scanned';
}
