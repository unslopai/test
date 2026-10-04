/**
 * Reaper für hängengebliebene Review-Jobs.
 *
 * WARUM DAS EXTERN LAUFEN MUSS: Wird die Lambda-Instanz hart beendet — OOM-Kill
 * oder Plattform-Timeout — läuft KEIN catch und kein finally mehr. Der Job bleibt
 * für immer auf 'processing' und sein Check Run für immer auf 'in_progress'. Ist
 * der Check als `required` konfiguriert, blockiert er den PR dauerhaft. Nur ein
 * Prozess außerhalb der gestorbenen Instanz kann das aufräumen.
 *
 * Die reine Auswahl-Logik ist bewusst von der IO getrennt, damit sie ohne DB
 * testbar ist.
 *
 * Seit dem Deadline Guard (D10) läuft der Reaper zusätzlich lazy aus
 * Webhook, CLI-Poll und Dashboard (lazy-reaper.ts) — dann auch mehrfach
 * parallel. Er liest mit der Service-Role ALLE Tenants: bewusste Ausnahme
 * von DATA-001 für diesen Hintergrundpfad, der dem auslösenden User nichts
 * zurückgibt.
 */
import { supabase } from '@/lib/supabase';
import { extractErrorMessage } from '@/lib/errors';
import { getInstallationToken } from '@/lib/github-app';
import { completeGatekeeperCheckRun } from '@/lib/check-run';
import { FAILED_CHECK_RUN_COPY } from '@/lib/job-failure';
import { STALE_JOB_ERROR_MESSAGE, selectStaleJobs } from '@/lib/stale-jobs-selection';
import type { StaleJobCandidate } from '@/lib/stale-jobs-selection';

export interface ReapOutcome {
    readonly scanned: number;
    readonly reaped: number;
    readonly checkRunsClosed: number;
    readonly failures: readonly string[];
}

export async function reapStaleJobs(nowMs: number = Date.now()): Promise<ReapOutcome> {
    const { data: jobRows, error: fetchError } = await supabase
        .from('review_jobs')
        .select('id, updated_at, check_run_id, payload, repositories(full_name, installation_id)')
        .eq('status', 'processing');

    if (fetchError) {
        throw new Error(`Stale-Job-Lookup fehlgeschlagen: ${fetchError.message}`);
    }

    const candidates: StaleJobCandidate[] = (jobRows ?? []).map((jobRow) => {
        const repository = normalizeRepositoryRelation(jobRow.repositories);
        const payload = (jobRow.payload ?? {}) as { repo_full_name?: unknown };
        return {
            id: jobRow.id as string,
            updatedAt: jobRow.updated_at as string,
            checkRunId: (jobRow.check_run_id as number | null) ?? null,
            repoFullName: repository?.full_name
                ?? (typeof payload.repo_full_name === 'string' ? payload.repo_full_name : null),
            installationId: repository?.installation_id ?? null,
        };
    });

    const staleJobs = selectStaleJobs(candidates, nowMs);
    const failures: string[] = [];
    let reapedCount = 0;
    let checkRunsClosed = 0;

    for (const staleJob of staleJobs) {
        const { data: reapedRows, error: updateError } = await supabase
            .from('review_jobs')
            .update({
                status: 'error',
                error_message: STALE_JOB_ERROR_MESSAGE,
                updated_at: new Date(nowMs).toISOString(),
            })
            .eq('id', staleJob.id)
            // Statusfilter gegen die Race mit einem Job, der genau jetzt doch
            // noch fertig wird: dann greift das UPDATE schlicht nicht.
            .eq('status', 'processing')
            // Nur wer die Zeile wirklich umgestellt hat, schließt den Check —
            // zwei parallele Lazy-Reaper dürfen ihn nie doppelt schließen.
            .select('id');

        if (updateError) {
            failures.push(`Job ${staleJob.id}: ${updateError.message}`);
            continue;
        }
        if (!reapedRows || reapedRows.length === 0) {
            continue;
        }
        reapedCount += 1;

        if (await closeAbandonedCheckRun(staleJob)) {
            checkRunsClosed += 1;
        }
    }

    return {
        scanned: candidates.length,
        reaped: reapedCount,
        checkRunsClosed,
        failures,
    };
}

/**
 * Ein fehlgeschlagener Check-Run-Abschluss darf den Reaper nicht stoppen — der
 * Job-Status ist zu diesem Zeitpunkt bereits korrekt, und ein weiterer stale Job
 * wartet womöglich noch.
 */
async function closeAbandonedCheckRun(staleJob: StaleJobCandidate): Promise<boolean> {
    if (staleJob.checkRunId === null || staleJob.installationId === null || !staleJob.repoFullName) {
        return false;
    }

    try {
        const installationToken = await getInstallationToken(staleJob.installationId);
        await completeGatekeeperCheckRun(
            installationToken,
            staleJob.repoFullName,
            staleJob.checkRunId,
            // Öffentlich am PR: dieselbe englische Timeout-Copy wie Worker und
            // Watchdog, nie der interne Detailtext (ROADMAP §15).
            FAILED_CHECK_RUN_COPY.review_timeout,
        );
        return true;
    } catch (checkRunError: unknown) {
        console.error(
            `[StaleJobs] Check Run ${staleJob.checkRunId} für ${staleJob.repoFullName} `
            + `konnte nicht geschlossen werden: ${extractErrorMessage(checkRunError)}`,
        );
        return false;
    }
}

interface RepositoryRelation {
    readonly full_name: string | null;
    readonly installation_id: number | null;
}

/** PostgREST liefert die Relation je nach Kardinalität als Objekt oder Array. */
function normalizeRepositoryRelation(relation: unknown): RepositoryRelation | null {
    const relationNode = Array.isArray(relation) ? relation[0] : relation;
    if (!relationNode || typeof relationNode !== 'object') return null;

    const { full_name: fullName, installation_id: installationId } =
        relationNode as Record<string, unknown>;

    return {
        full_name: typeof fullName === 'string' ? fullName : null,
        installation_id: typeof installationId === 'number' ? installationId : null,
    };
}
