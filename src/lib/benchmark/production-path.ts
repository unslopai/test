/**
 * Produktionspfad des Rule-Recall-Benchmarks (LANGUAGE_COVERAGE_SPEC §7.1).
 *
 * Der Runner gab bis 2026-09-30 jede Fixture-Datei an das Modell. In
 * Produktion filtert der Diff-Loader mit `isReviewableFile`, und ein PR ohne
 * reviewbare Datei bricht ab, bevor der Pre-Scanner läuft. Dieses Modul
 * entscheidet für eine Fixture, welche Dateien welche Lane erreichen — mit
 * demselben Filter wie `diff-loader-step.ts`, damit der Benchmark den Pfad
 * misst, den der Webhook fährt.
 */
import { isReviewableFile } from '@/lib/pipeline/helpers';
import type { PullRequestFile } from '@/lib/github';

/** Welche Lane eine Datei in Produktion erreicht. */
export type ProductionLane = 'model-and-prescan' | 'prescan-only' | 'not-scanned';

export interface ProductionPathPlan {
    /** Dateien, die das Modell liest. Leer heißt: der Job bricht ab. */
    readonly reviewableFiles: readonly PullRequestFile[];
    /** Dateien, die der Pre-Scanner sieht. */
    readonly prescanFiles: readonly PullRequestFile[];
    readonly aborted: boolean;
}

/** Bisheriger Runner-Modus (`--bypass-filter`): jede Datei erreicht beide Lanes. */
export function planModelPotentialPath(fixtureFiles: readonly PullRequestFile[]): ProductionPathPlan {
    return { reviewableFiles: fixtureFiles, prescanFiles: fixtureFiles, aborted: false };
}

export function planProductionPath(fixtureFiles: readonly PullRequestFile[]): ProductionPathPlan {
    const reviewableFiles = fixtureFiles.filter((fixtureFile) => isReviewableFile(fixtureFile.filename));
    const aborted = reviewableFiles.length === 0;
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
