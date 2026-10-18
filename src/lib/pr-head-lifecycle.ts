/**
 * PR-Lebenszyklus der Webhook-Jobs je Head-Commit (GITHUB_APP_SPEC.md §4.9).
 *
 * Zwei Lücken aus der Kampagne „große reale PRs“ (LARGE_PR_CAMPAIGN.md R11/R12):
 *  - Reopen auf unverändertem Head fuhr einen zweiten, identischen Review samt
 *    Second-Opinion-Eskalation (unslopai/test#37).
 *  - Nach einem Push lief der Job des überholten Commits zu Ende und hinterließ
 *    ein Check-Ergebnis zu Code, den es im PR nicht mehr gibt (unslopai/test#36).
 *
 * Der Abbruch ist kooperativ und läuft über den Job-Status in der DB: der
 * Webhook stellt den überholten Job auf 'error' (Marker `[superseded]`), der
 * Runner liest den Status vor jedem Step (`isJobStillProcessing`), und der
 * Persister schreibt ohnehin nur aus 'processing' heraus (DEADLINE_GUARD_SPEC
 * D9). Ein eigener Status hätte den CHECK-Constraint und jeden Status-Leser
 * geändert; der Marker folgt dem Muster von `[review_timeout]`.
 */
import { supabase } from '@/lib/supabase';
import { extractErrorMessage } from '@/lib/errors';
import { getInstallationToken } from '@/lib/github-app';
import { completeGatekeeperCheckRun } from '@/lib/check-run';
import type { CheckRunResult } from '@/lib/check-run';

/** Server-gesetzter Präfix in review_jobs.error_message eines abgelösten Jobs. */
export const SUPERSEDED_MARKER = '[superseded] ';

const SHORT_SHA_LENGTH = 7;

/**
 * Nur diese Actions können denselben Head zweimal liefern, ohne dass jemand
 * einen neuen Review verlangt hat: `reopened` nach Schließen und eine erneut
 * zugestellte `opened`-Delivery. `synchronize` trägt immer einen neuen Head,
 * und `rerequested` (Re-Run-Button) ist ein ausdrücklicher Wunsch (§4.8).
 */
const HEAD_DEDUPE_ACTIONS: ReadonlySet<string> = new Set(['opened', 'reopened']);

export function isHeadDedupeAction(prAction: string): boolean {
    return HEAD_DEDUPE_ACTIONS.has(prAction);
}

/** Ein Head-Commit eines PRs in einer Tenant-Zeile von `repositories`. */
export interface PullRequestHead {
    readonly repositoryId: string;
    readonly prNumber: number;
    readonly headSha: string;
}

function shortenSha(commitSha: string): string {
    return commitSha.slice(0, SHORT_SHA_LENGTH);
}

// =============================================================================
// Dedupe: derselbe Head wurde schon vollständig geprüft
// =============================================================================

/**
 * Wiederverwendbar ist nur ein `done`-Job ohne Degradation: ein Zeit-Skip, ein
 * halber Draft oder ein ausgefallener Pre-Scan haben den Commit nicht ganz
 * geprüft, ein zweiter Lauf kann mehr sehen. Fehlen die Felder (Jobs vor dem
 * Deadline Guard), gilt der Job als nicht belegbar vollständig [ARCH-002].
 */
function isCompleteReviewRow(latestJobRow: unknown): latestJobRow is { id: string } {
    if (typeof latestJobRow !== 'object' || latestJobRow === null) return false;
    const degradations: unknown = Reflect.get(latestJobRow, 'degradations');
    return typeof Reflect.get(latestJobRow, 'id') === 'string'
        && Reflect.get(latestJobRow, 'status') === 'done'
        && Array.isArray(degradations)
        && degradations.length === 0
        && Reflect.get(latestJobRow, 'prescan_degraded') !== true;
}

/**
 * Liefert die ID des Jobs, dessen Check und PR-Review für diesen Head weiter
 * gelten, sonst null. Maßgeblich ist der JÜNGSTE abgeschlossene Webhook-Job des
 * Heads: sein Check ist der, den GitHub am Commit zeigt. Ist er gescheitert,
 * gereapt oder degradiert, läuft der neue Job wie bisher.
 *
 * Ein Lookup-Fehler führt bewusst zum neuen Review: ein doppelter Lauf ist
 * teurer, ein ausgelassener Review wäre falsch.
 */
export async function findReusableReviewJob(pullRequestHead: PullRequestHead): Promise<string | null> {
    const { data: latestJobRow, error: lookupError } = await supabase
        .from('review_jobs')
        .select('id, status, degradations:result->degradations, prescan_degraded:result->prescan->degraded')
        .eq('repository_id', pullRequestHead.repositoryId)
        .eq('pr_number', pullRequestHead.prNumber)
        .eq('source', 'webhook')
        .eq('payload->>pr_head_sha', pullRequestHead.headSha)
        .in('status', ['done', 'error'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lookupError) {
        console.error(
            `[PrHeadLifecycle] Dedupe-Lookup für PR #${pullRequestHead.prNumber} `
            + `(${shortenSha(pullRequestHead.headSha)}) fehlgeschlagen — Review läuft: ${lookupError.message}`,
        );
        return null;
    }

    return isCompleteReviewRow(latestJobRow) ? latestJobRow.id : null;
}

// =============================================================================
// Ablösung: ein neuer Head überholt laufende Jobs desselben PRs
// =============================================================================

/** Ein abgelöster Job; `checkRunId` null = er hatte (noch) keinen Check Run. */
export interface SupersededJob {
    readonly jobId: string;
    readonly checkRunId: number | null;
}

function parseSupersededJobRow(supersededRow: unknown): SupersededJob | null {
    if (typeof supersededRow !== 'object' || supersededRow === null) return null;
    const jobId: unknown = Reflect.get(supersededRow, 'id');
    const checkRunId: unknown = Reflect.get(supersededRow, 'check_run_id');
    if (typeof jobId !== 'string') return null;
    return { jobId, checkRunId: typeof checkRunId === 'number' ? checkRunId : null };
}

/**
 * Stellt jeden noch nicht abgeschlossenen Webhook-Job desselben PRs auf dem
 * VORGÄNGER-Head der Delivery auf 'error' + `[superseded]`. Fertige Jobs
 * (`done`/`error`) bleiben unangetastet: ihr Check hängt am alten Commit.
 *
 * Bewusst „Vorgänger“ (`before` der Delivery) statt „jeder andere Head“:
 * Deliveries können sich überholen oder erneut zugestellt werden, und eine
 * verspätete Delivery von Commit A darf den Job des neueren Commits B nicht
 * beenden. Ihr Vorgänger ist nie B.
 *
 * Zurück kommen nur die Zeilen, die dieses UPDATE wirklich umgestellt hat —
 * wie beim Reaper schließt nur ihr Umsteller den Check. Ein DB-Fehler lässt
 * den alten Job weiterlaufen wie vor dieser Änderung; der neue Review startet
 * trotzdem.
 */
export async function supersedeOutdatedJobs(
    newHead: PullRequestHead,
    previousHeadSha: string,
): Promise<readonly SupersededJob[]> {
    const { data: supersededRows, error: supersedeError } = await supabase
        .from('review_jobs')
        .update({
            status: 'error',
            error_message: `${SUPERSEDED_MARKER}Superseded by ${shortenSha(newHead.headSha)}`,
            updated_at: new Date().toISOString(),
        })
        .eq('repository_id', newHead.repositoryId)
        .eq('pr_number', newHead.prNumber)
        .eq('source', 'webhook')
        .in('status', ['pending', 'processing'])
        .eq('payload->>pr_head_sha', previousHeadSha)
        .select('id, check_run_id');

    if (supersedeError) {
        console.error(
            `[PrHeadLifecycle] Ablösung der Jobs von PR #${newHead.prNumber} durch `
            + `${shortenSha(newHead.headSha)} fehlgeschlagen — alte Jobs laufen weiter: ${supersedeError.message}`,
        );
        return [];
    }

    const supersededJobs = (supersededRows ?? [])
        .map(parseSupersededJobRow)
        .filter((supersededJob): supersededJob is SupersededJob => supersededJob !== null);
    if (supersededJobs.length > 0) {
        console.log(
            `[PrHeadLifecycle] PR #${newHead.prNumber}: ${supersededJobs.length} Job(s) durch `
            + `${shortenSha(newHead.headSha)} abgelöst (${supersededJobs.map((supersededJob) => supersededJob.jobId).join(', ')}).`,
        );
    }
    return supersededJobs;
}

/**
 * `cancelled` statt `neutral`: `neutral` heißt in diesem Produkt „geprüft,
 * nichts Blockierendes“ oder „unvollständig geprüft“ — beides wäre ein Urteil
 * über Code, den es im PR nicht mehr gibt. `cancelled` zeigt GitHub am alten
 * Commit als abgebrochen, ohne Befund.
 */
export function buildSupersededCheckRunResult(newHeadSha: string): CheckRunResult {
    return {
        conclusion: 'cancelled',
        title: 'Review superseded',
        summary: `Superseded by ${shortenSha(newHeadSha)}. A newer commit was pushed to this pull request `
            + 'before this review finished, so it was stopped. The result is on the check of the newer commit.',
    };
}

/**
 * Schließt die Check Runs abgelöster Jobs. Best effort je Check: der Job-Status
 * steht bereits, und ein weiterer Check wartet womöglich noch.
 */
export async function closeSupersededCheckRuns(
    installationId: number,
    repoFullName: string,
    supersededJobs: readonly SupersededJob[],
    newHeadSha: string,
): Promise<void> {
    const openCheckRunIds = supersededJobs
        .map((supersededJob) => supersededJob.checkRunId)
        .filter((checkRunId): checkRunId is number => checkRunId !== null);
    if (openCheckRunIds.length === 0) return;

    const supersededResult = buildSupersededCheckRunResult(newHeadSha);
    for (const checkRunId of openCheckRunIds) {
        try {
            const installationToken = await getInstallationToken(installationId);
            await completeGatekeeperCheckRun(installationToken, repoFullName, checkRunId, supersededResult);
        } catch (checkRunError: unknown) {
            console.error(
                `[PrHeadLifecycle] Check Run ${checkRunId} für ${repoFullName} konnte nicht als `
                + `superseded geschlossen werden: ${extractErrorMessage(checkRunError)}`,
            );
        }
    }
}

// =============================================================================
// Prüfpunkt des Runners
// =============================================================================

/**
 * Liest den Job-Status für den Prüfpunkt vor jedem Pipeline-Step. false = der
 * Job wurde von außen beendet (abgelöst oder gereapt) und darf keinen weiteren
 * Step starten. Ein Lesefehler lässt die Pipeline weiterlaufen: der Persister
 * schreibt ohnehin nur aus 'processing' heraus, ein falsches Ergebnis kann so
 * nicht entstehen — nur ein unnötiger Call.
 */
export async function isJobStillProcessing(jobId: string): Promise<boolean> {
    const { data: jobStatusRow, error: statusError } = await supabase
        .from('review_jobs')
        .select('status')
        .eq('id', jobId)
        .maybeSingle();

    if (statusError) {
        console.error(`[PrHeadLifecycle] Status von Job ${jobId} nicht lesbar — Pipeline läuft weiter: ${statusError.message}`);
        return true;
    }
    return jobStatusRow?.status === 'processing';
}
