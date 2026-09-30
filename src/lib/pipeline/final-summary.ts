/**
 * Finale Review-Summary aus dem Endzustand (SPEC.md §12.4 A12a).
 *
 * Die Draft-Summary ist LLM-Freitext über die Draft-Findings. Sobald der
 * Integrity-Scorer ein Draft-Finding verwirft oder herabstuft, beschreibt sie
 * einen Zustand, den das veröffentlichte Ergebnis nicht mehr hat — Job
 * f2c676ba meldete "Found 1 critical issue" neben 0 CRITICAL im Ergebnis.
 * Einen LLM-Satz kann man nicht korrigieren, nur ersetzen: dann gilt ein
 * Template, das aus denselben Issues zählt wie Reporter und Persister.
 *
 * Zweite Quelle desselben Widerspruchs (LANGUAGE_COVERAGE_SPEC §5, Befund b):
 * die Modell-Summary kennt die Findings des Pre-Scanners nicht. Job 3f26b2da
 * speicherte "No AI slop found." neben einem CRITICAL aus dem Pre-Scanner.
 * `resolvePublishedSummary` ist deshalb die einzige Stelle, aus der Persister
 * und Reporter ihre Summary beziehen.
 */
import { resolveReviewOutcome } from '@/lib/pipeline/review-scope';
import type { PipelineContext, PipelineIssue } from '@/lib/pipeline/types';

/** Summary eines Laufs ohne jedes Finding. */
export const CLEAN_REVIEW_SUMMARY = 'No AI slop found.';

/** Beginn jeder Template-Summary: sie zählt bereits alle meldbaren Issues beider Lanes. */
const FINAL_STATE_PREFIX = 'Final result:';

/** A5: jedes Draft-Finding verworfen und auch sonst nichts zu melden. */
export const ALL_REFUTED_SUMMARY =
    'All draft findings were refuted during independent blind verification — no confirmed AI slop.';

/** Was die Verdict-Anwendung an Draft-Findings verändert hat. */
export interface VerdictOutcomeCounts {
    readonly refutedCount: number;
    readonly downgradedCount: number;
}

/**
 * Die Draft-Summary bleibt nur gültig, wenn jedes Draft-Finding mit
 * unveränderter Severity überlebt hat. Die Verdict-Anwendung erhält die
 * Reihenfolge, deshalb reicht der paarweise Severity-Vergleich.
 */
export function haveDraftFindingsChanged(
    draftIssuesBefore: readonly PipelineIssue[],
    draftIssuesAfter: readonly PipelineIssue[],
): boolean {
    if (draftIssuesBefore.length !== draftIssuesAfter.length) return true;
    return draftIssuesBefore.some(
        (draftIssue, issueIndex) => draftIssue.severity !== draftIssuesAfter[issueIndex].severity,
    );
}

/**
 * Template-Summary aus den meldbaren Issues (Prescan- + LLM-Lane, wie
 * `collectReportableIssues` sie liefert). Invariante: keine Severity und keine
 * Zahl, die das veröffentlichte `issues[]` nicht enthält.
 */
export function buildFinalStateSummary(
    reportableIssues: readonly PipelineIssue[],
    verdictOutcome: VerdictOutcomeCounts,
): string {
    if (reportableIssues.length === 0) return ALL_REFUTED_SUMMARY;

    const criticalCount = reportableIssues.filter((reportableIssue) => reportableIssue.severity === 'CRITICAL').length;
    const warningCount = reportableIssues.length - criticalCount;
    const summarySentences = [
        `${FINAL_STATE_PREFIX} ${criticalCount} critical and ${warningCount} warning ${pluralizeFinding(warningCount)}.`,
    ];
    if (verdictOutcome.downgradedCount > 0) {
        summarySentences.push(
            `${describeDraftFindings(verdictOutcome.downgradedCount)} downgraded to warning `
            + 'because verification stayed uncertain or the escalation was skipped.',
        );
    }
    if (verdictOutcome.refutedCount > 0) {
        summarySentences.push(
            `${describeDraftFindings(verdictOutcome.refutedCount)} refuted by independent verification and removed.`,
        );
    }
    return summarySentences.join(' ');
}

/**
 * Die veröffentlichte Summary: nie ein Satz, dem das veröffentlichte
 * `issues[]` widerspricht.
 *
 *  - Nur deterministisch geprüft (LANGUAGE_COVERAGE_SPEC §6.2): der Satz, dass
 *    kein Modell gelesen hat und warum, dann das Ergebnis des Pre-Scanners.
 *    Auch ohne Finding nie der Clean-Satz.
 *  - Kein Finding: die Modell-Summary, sonst der Clean-Satz.
 *  - Short-Circuit (`llmSkipped`): der Pre-Scanner-Step hat die Summary selbst
 *    geschrieben, sie nennt seine Findings schon.
 *  - Template-Summary (A12a): zählt bereits beide Lanes.
 *  - Sonst: der Modell-Text gilt nur für Findings der LLM-Lane. Die
 *    deterministischen Findings kommen als eigener Satz dazu; hat das Modell
 *    nichts gemeldet, ersetzt dieser Satz den Clean-Text.
 */
export function resolvePublishedSummary(
    context: SummaryContext,
    reportableIssues: readonly PipelineIssue[],
): string {
    if (resolveReviewOutcome(context) === 'deterministic_only') {
        return buildDeterministicOnlySummary(context, reportableIssues);
    }
    if (reportableIssues.length === 0) return context.reviewSummary || CLEAN_REVIEW_SUMMARY;

    const deterministicIssues = reportableIssues.filter((reportableIssue) => reportableIssue.source === 'pre-scanner');
    const modelFindingCount = reportableIssues.length - deterministicIssues.length;
    const modelSummary = context.reviewSummary.trim();
    if (context.llmSkipped || modelSummary.startsWith(FINAL_STATE_PREFIX)) return modelSummary;
    if (deterministicIssues.length === 0) return modelSummary || buildFinalStateSummary(reportableIssues, NO_VERDICT_CHANGES);

    const deterministicSentence = describeDeterministicFindings(deterministicIssues);
    return modelFindingCount > 0 && modelSummary.length > 0
        ? `${modelSummary} ${deterministicSentence}`
        : `${deterministicSentence} The model review reported no further findings.`;
}

type SummaryContext = Pick<
    PipelineContext,
    'reviewSummary' | 'llmSkipped' | 'shouldAbort' | 'deterministicOnlyReason' | 'prescanStats'
>;

/** "<Grund>. The deterministic pre-scanner found … / checked N files and found nothing." */
export function buildDeterministicOnlySummary(
    context: Pick<PipelineContext, 'deterministicOnlyReason' | 'prescanStats'>,
    reportableIssues: readonly PipelineIssue[],
): string {
    const filesScanned = context.prescanStats?.filesScanned ?? 0;
    const resultSentence = reportableIssues.length > 0
        ? describeDeterministicFindings(reportableIssues)
        : `The pre-scanner checked ${filesScanned} ${filesScanned === 1 ? 'file' : 'files'} and found nothing.`;
    return `${context.deterministicOnlyReason ?? ''} ${resultSentence}`.trim();
}

const NO_VERDICT_CHANGES: VerdictOutcomeCounts = { refutedCount: 0, downgradedCount: 0 };

/** "The deterministic pre-scanner found 1 critical and 2 warning findings." */
function describeDeterministicFindings(deterministicIssues: readonly PipelineIssue[]): string {
    const criticalCount = deterministicIssues.filter((deterministicIssue) => deterministicIssue.severity === 'CRITICAL').length;
    const warningCount = deterministicIssues.length - criticalCount;
    return `The deterministic pre-scanner found ${criticalCount} critical and ${warningCount} warning `
        + `${pluralizeFinding(warningCount)}.`;
}

function pluralizeFinding(findingCount: number): string {
    return findingCount === 1 ? 'finding' : 'findings';
}

/** "1 draft finding was" / "3 draft findings were" */
function describeDraftFindings(findingCount: number): string {
    const auxiliaryVerb = findingCount === 1 ? 'was' : 'were';
    return `${findingCount} draft ${pluralizeFinding(findingCount)} ${auxiliaryVerb}`;
}
