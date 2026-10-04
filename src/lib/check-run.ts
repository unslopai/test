/**
 * Der Gatekeeper-Check-Run (GITHUB_APP_SPEC.md §4.7).
 *
 * Nur im App-Modus: Check Runs darf ausschließlich eine GitHub App erstellen,
 * ein User-OAuth-Token bekommt darauf eine 403. Der Check-Name ist konstant —
 * nur so lässt er sich in den Branch-Protection-Rules als `required check`
 * verankern.
 *
 * Gating-Regel: `failure` bei mindestens einem CRITICAL-Finding — oder, wenn
 * das Repo Slop Score Gating aktiviert hat, bei einem Integrity Score strikt
 * unter der Schwelle. WARNINGs allein blockieren nie — ein Gatekeeper, der
 * jeden Stilhinweis zum Merge-Blocker macht, wird abgeschaltet.
 */
import { createCheckRun, updateCheckRun } from '@/lib/github';
import { extractErrorMessage } from '@/lib/errors';
import type { CheckRunConclusion } from '@/lib/github';
import type { PipelineIssue } from '@/lib/pipeline/types';

export const GATEKEEPER_CHECK_NAME = 'Anti-Slop Gatekeeper';

export interface CheckRunResult {
    readonly conclusion: CheckRunConclusion;
    readonly title: string;
    readonly summary: string;
}

/**
 * Die Detail-URL des Checks. undefined, wenn keine absolute Basis-URL bekannt
 * ist: GitHub lehnt eine relative details_url mit 422 ab — der Check käme dann
 * gar nicht zustande, statt nur ohne Link.
 */
function resolveDetailsUrl(): string | undefined {
    const appBaseUrl = process.env.APP_BASE_URL;
    return appBaseUrl?.startsWith('http') ? `${appBaseUrl}/dashboard` : undefined;
}

/**
 * Eröffnet den Check Run, sobald der Job angenommen ist — der PR-Autor sieht
 * sofort, dass der Gatekeeper läuft, statt bis zu 300s auf ein leeres Feld zu starren.
 *
 * Best effort: scheitert das Anlegen, läuft der Review trotzdem (null = kein
 * Check Run für diesen Job). Der Fehler wird laut geloggt, weil ein als
 * `required` konfigurierter Check dann ausbleibt.
 */
export async function startGatekeeperCheckRun(
    installationToken: string,
    repoFullName: string,
    headSha: string,
): Promise<number | null> {
    try {
        const openedCheckRun = await createCheckRun(installationToken, repoFullName, {
            name: GATEKEEPER_CHECK_NAME,
            headSha,
            status: 'in_progress',
            detailsUrl: resolveDetailsUrl(),
            output: {
                title: 'Reviewing for AI slop…',
                summary: 'The Anti-Slop Gatekeeper is analyzing the changes in this pull request.',
            },
        });

        return openedCheckRun.id;
    } catch (checkRunError: unknown) {
        console.error(
            `[CheckRun] Konnte Check Run für ${repoFullName} nicht anlegen `
            + `(Review läuft ohne Check): ${extractErrorMessage(checkRunError)}`,
        );
        return null;
    }
}

/**
 * Schließt den Check Run ab. Wirft bei Fehlern — ein Check, der still in
 * 'in_progress' hängen bleibt, blockiert den PR des Kunden dauerhaft und darf
 * deshalb nicht weggeschluckt werden [MAINT-001].
 */
export async function completeGatekeeperCheckRun(
    installationToken: string,
    repoFullName: string,
    checkRunId: number,
    checkRunResult: CheckRunResult,
): Promise<void> {
    await updateCheckRun(installationToken, repoFullName, checkRunId, {
        status: 'completed',
        conclusion: checkRunResult.conclusion,
        output: {
            title: checkRunResult.title,
            summary: checkRunResult.summary,
        },
    });

    console.log(
        `[CheckRun] ${repoFullName} Check ${checkRunId} abgeschlossen: ${checkRunResult.conclusion}.`,
    );
}

/**
 * Ein direkt abgeschlossener Check Run für PRs, die nie in die Pipeline laufen
 * (kein Abo, Quota erschöpft, Repo nicht aktiviert).
 *
 * `action_required` statt `neutral`: der Merge soll spürbar blockiert sein, denn
 * der Gatekeeper hat diesen Diff nicht geprüft — und der Grund samt Link steht
 * im Output, statt den Kunden vor einem unerklärlich hängenden Check zu lassen (D9).
 */
export async function postBlockedCheckRun(
    installationToken: string,
    repoFullName: string,
    headSha: string,
    title: string,
    summary: string,
): Promise<void> {
    try {
        await createCheckRun(installationToken, repoFullName, {
            name: GATEKEEPER_CHECK_NAME,
            headSha,
            status: 'completed',
            conclusion: 'action_required',
            detailsUrl: resolveDetailsUrl(),
            output: { title, summary },
        });

        console.log(`[CheckRun] Blockierender Check für ${repoFullName} gepostet: ${title}.`);
    } catch (checkRunError: unknown) {
        // Das Gate hat seinen Zweck (kein LLM-Call) bereits erfüllt; der Check
        // ist Kommunikation. Ein Fehler hier darf den 200er an GitHub nicht kippen.
        console.error(
            `[CheckRun] Blockierender Check für ${repoFullName} fehlgeschlagen: `
            + extractErrorMessage(checkRunError),
        );
    }
}

/**
 * Slop Score Gating (Upcoming §6): der Check fällt auch ohne CRITICAL, wenn der
 * Cognitive Integrity Score strikt unter der Repo-Schwelle liegt.
 * `minIntegrityScore: 0` = Gate aus (Default). `integrityScore: null`
 * (Verifikation degradiert) löst das Gate bewusst NICHT aus — es gibt keinen
 * ehrlichen Score, und die Degradation ist im Review-Body separat sichtbar.
 */
export interface IntegrityGate {
    readonly integrityScore: number | null;
    readonly minIntegrityScore: number;
}

function isBelowIntegrityThreshold(integrityGate: IntegrityGate): boolean {
    return integrityGate.minIntegrityScore > 0
        && integrityGate.integrityScore !== null
        && integrityGate.integrityScore < integrityGate.minIntegrityScore;
}

/**
 * Übersetzt das Review-Ergebnis in ein Check-Run-Urteil.
 * Reihenfolge zählt: CRITICAL schlägt alles andere, dann das Score-Gate.
 */
export function deriveReviewConclusion(
    issues: readonly PipelineIssue[],
    integrityGate?: IntegrityGate,
): CheckRunResult {
    const criticalCount = issues.filter((issue) => issue.severity === 'CRITICAL').length;

    if (criticalCount > 0) {
        return {
            conclusion: 'failure',
            title: `${criticalCount} critical slop finding${criticalCount === 1 ? '' : 's'}`,
            summary: `The Anti-Slop Gatekeeper found ${criticalCount} critical and `
                + `${issues.length - criticalCount} non-critical finding(s). See the review comments.`,
        };
    }

    if (integrityGate && isBelowIntegrityThreshold(integrityGate)) {
        return {
            conclusion: 'failure',
            title: `Cognitive Integrity Score ${integrityGate.integrityScore} is below the `
                + `required minimum of ${integrityGate.minIntegrityScore}`,
            summary: 'The review completed, but its confidence score falls below the threshold '
                + 'configured for this repository (Slop Score Gating). A human review is required '
                + 'before merging.',
        };
    }

    if (issues.length > 0) {
        return {
            conclusion: 'neutral',
            title: `${issues.length} non-critical finding${issues.length === 1 ? '' : 's'}`,
            summary: 'The Anti-Slop Gatekeeper found no critical slop. '
                + 'The remaining findings are advisory and do not block the merge.',
        };
    }

    return {
        conclusion: 'success',
        title: 'No AI slop found',
        summary: 'This code meets the quality standards of the Anti-Slop Gatekeeper.',
    };
}
