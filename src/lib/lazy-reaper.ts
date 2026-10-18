/**
 * Lazy Reaping (DEADLINE_GUARD_SPEC.md D10): der Stale-Job-Reaper läuft
 * nebenbei aus Webhook, CLI-Poll und Dashboard statt aus einem Cron.
 *
 * Warum: der `crons`-Block ist auf Vercel Hobby nicht deploybar und
 * `CRON_SECRET` nicht gesetzt (ROADMAP §1) — ein vom Plattform-Kill
 * getroffener Job blieb deshalb für immer `processing`. Jetzt räumt ihn der
 * nächste Webhook, Poll oder Dashboard-Aufruf ab.
 *
 * Gedrosselt auf einen Lauf pro Minute und Instanz: das MCP pollt alle 2 s,
 * ungedrosselt wäre jeder Poll ein Scan aller Tenants plus GitHub-Calls.
 * Fire-and-forget via after(): der Aufrufer wartet nie darauf.
 */
import { after } from 'next/server';
import { extractErrorMessage } from '@/lib/errors';
import { reapStaleJobs } from '@/lib/stale-jobs';
import type { ReapOutcome } from '@/lib/stale-jobs';

export const LAZY_REAP_MIN_INTERVAL_MS = 60_000;

export type LazyReapTrigger = 'webhook' | 'cli-poll' | 'dashboard';

interface LazyReapDependencies {
    readonly reap: () => Promise<ReapOutcome>;
    readonly scheduleAfterResponse: (backgroundTask: () => Promise<void>) => void;
    readonly nowMs: () => number;
}

export type LazyReapScheduler = (trigger: LazyReapTrigger) => void;

export function createLazyReapScheduler(dependencies: LazyReapDependencies): LazyReapScheduler {
    let lastScheduledAtMs = Number.NEGATIVE_INFINITY;

    return (trigger) => {
        const currentMs = dependencies.nowMs();
        if (currentMs - lastScheduledAtMs < LAZY_REAP_MIN_INTERVAL_MS) return;
        lastScheduledAtMs = currentMs;
        dependencies.scheduleAfterResponse(() => runLazyReap(dependencies.reap, trigger));
    };
}

/**
 * Best effort mit lautem Log: ein gescheiterter Lauf hat nichts verändert
 * (der Reaper setzt Jobs nur einzeln und statusgesichert), und der nächste
 * Trigger versucht es nach spätestens einer Minute erneut — das ist die
 * Recovery. Den auslösenden Request darf er nie beeinflussen.
 */
async function runLazyReap(reap: () => Promise<ReapOutcome>, trigger: LazyReapTrigger): Promise<void> {
    try {
        const reapOutcome = await reap();
        if (reapOutcome.reaped > 0 || reapOutcome.failures.length > 0) {
            console.log(
                `[LazyReaper] Trigger ${trigger}: ${reapOutcome.reaped} Job(s) abgeräumt, `
                + `${reapOutcome.checkRunsClosed} Check Run(s) geschlossen, `
                + `${reapOutcome.failures.length} Fehler${formatFailures(reapOutcome.failures)}`,
            );
        }
    } catch (reapFailure: unknown) {
        console.error(
            `[LazyReaper] Trigger ${trigger}: Reaper-Lauf fehlgeschlagen, nächster Trigger versucht es erneut — `
            + extractErrorMessage(reapFailure),
        );
    }
}

function formatFailures(failures: readonly string[]): string {
    return failures.length > 0 ? ` (${failures.join('; ')})` : '';
}

/** Die Prod-Instanz: eine Drossel pro Serverless-Instanz. */
export const scheduleLazyReap: LazyReapScheduler = createLazyReapScheduler({
    reap: () => reapStaleJobs(),
    scheduleAfterResponse: (backgroundTask) => after(backgroundTask),
    nowMs: Date.now,
});
