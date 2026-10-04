/**
 * Job-Uhr des Deadline Guards (DEADLINE_GUARD_SPEC.md §3.1).
 *
 * Jeder Review-Job läuft in der Invocation der Route, die ihn angenommen hat,
 * und teilt sich deren `maxDuration` (Vercel Hobby: 300 s). Ohne Uhr wusste
 * keine Stufe, wie viel davon übrig ist — Job e409926e wurde nach einem
 * 146-s-Draft hart gekillt und blieb für immer `processing`. Hier liegt die
 * EINZIGE Stelle, die die verbleibende LLM-Zeit berechnet; alle Konstanten
 * sind Messwerte, keine Config (D4).
 */
import { isCallBudgetRefusal, isCallDeadlineFailure } from '@/lib/pipeline/vertex-retry';
import type { CascadeRole } from '@/lib/pipeline/models';
import type { LlmCallPhase } from '@/lib/telemetry/llm-call-log';
import type { PipelineContext, SkippableStage } from '@/lib/pipeline/types';

/**
 * `maxDuration` der drei Job-Routen in ms — MUSS den Literalen in webhook,
 * cli/scan und cli/pr/review entsprechen (Next.js liest sie statisch;
 * deadline.test.ts erzwingt die Gleichheit). Ein Pro-Upgrade hebt beides
 * in EINEM Commit an.
 */
export const JOB_ROUTE_MAX_DURATION_MS = 300_000;

/** Default-Budget = die volle `maxDuration` der Job-Routen (D2). */
export const DEFAULT_JOB_BUDGET_MS = JOB_ROUTE_MAX_DURATION_MS;

/**
 * Reserve nach dem letzten LLM-Call: Scorer, Reporter (Kommentar-Fetch +
 * Upsert), Persister (inkl. Reroll-Lookup) und Check-Run-Abschluss (D2).
 */
export const POST_LLM_RESERVE_MS = 30_000;

/**
 * Der Watchdog feuert 15 s vor dem Plattform-Kill: LLM-Calls enden schon bei
 * −30 s, die 15 s bleiben für markJobError + Token-Fetch + failCheckRun (D9).
 */
export const WATCHDOG_SLACK_MS = 15_000;

/** Startschwellen je Stufe (D4) — gemessen, siehe Spec §2. */
export const SECOND_OPINION_MIN_MS = 80_000;
export const TARGETED_ESCALATION_MIN_MS = 60_000;
export const VERIFIER_BATCH_MIN_MS = 40_000;

/** Pro-direct-Fallback auf einen zweiten (Flash-)Draft nur mit so viel Rest (D5). */
export const DRAFT_FALLBACK_MIN_MS = 90_000;

/**
 * Latenz-Guard der Eskalations-Rolle (MODEL_STRATEGY_2026-08 §1h): ein Job
 * kann ZWEI Eskalations-Calls ziehen (targeted + Second Opinion). Gemessen
 * (Probe 2026-09-17, r20 pro-direct, 3.8 medium, 15 Calls): Ø 45 s, max 72 s;
 * unter `high` Ø 164 s. Seit dem Deadline Guard gilt min(150 s, Restbudget).
 */
export const ESCALATION_CALL_DEADLINE_MS = 150_000;

/** Nach dieser Differenz gilt ein Abbruch als vom Job-Budget verursacht (D14). */
const BUDGET_ABORT_TOLERANCE_MS = 1_000;

export type ClockNow = () => number;

/** Die Uhr eines Jobs; `deadlineAtMs = null` = kein Budget (Benchmark-/Replay-Harness). */
export interface JobClock {
    readonly jobStartedAtMs: number;
    readonly deadlineAtMs: number | null;
}

/**
 * Budget aus `UNSLOP_JOB_BUDGET_MS`; ungültig oder leer ⇒ Default. Nie über
 * der `maxDuration` der Routen: ein zu hohes Env ließe den Watchdog erst
 * NACH dem Plattform-Kill feuern — also nie.
 */
export function resolveJobBudgetMs(configuredBudget: string | undefined = process.env.UNSLOP_JOB_BUDGET_MS): number {
    const parsedBudgetMs = Number.parseInt(configuredBudget ?? '', 10);
    const validBudgetMs = Number.isFinite(parsedBudgetMs) && parsedBudgetMs > POST_LLM_RESERVE_MS
        ? parsedBudgetMs
        : DEFAULT_JOB_BUDGET_MS;
    return Math.min(validBudgetMs, JOB_ROUTE_MAX_DURATION_MS);
}

/** D1/D2: die Uhr startet am Handler-Einstieg der Route, nicht im after()-Callback. */
export function buildJobClock(invocationStartedAtMs: number, jobBudgetMs: number): JobClock {
    return {
        jobStartedAtMs: invocationStartedAtMs,
        deadlineAtMs: invocationStartedAtMs + jobBudgetMs - POST_LLM_RESERVE_MS,
    };
}

/** Zeitpunkt, an dem der Watchdog den Job als `review_timeout` beendet (D9). */
export function resolveWatchdogFireAtMs(invocationStartedAtMs: number, jobBudgetMs: number): number {
    return invocationStartedAtMs + jobBudgetMs - WATCHDOG_SLACK_MS;
}

/** Verbleibende LLM-Zeit; ohne Budget unendlich. Die einzige Stelle, die die Uhr liest. */
export function remainingLlmMs(jobClock: Pick<JobClock, 'deadlineAtMs'>, nowMs: ClockNow = Date.now): number {
    if (jobClock.deadlineAtMs === null) return Number.POSITIVE_INFINITY;
    return jobClock.deadlineAtMs - nowMs();
}

/**
 * Call-Deadline in ms für einen LLM-Call (§3.2); null = keine Deadline.
 * Draft und Verifier bekommen das Restbudget, die Eskalation zusätzlich
 * ihren eigenen 150-s-Deckel. Nie negativ: ein Call ohne Rest bricht sofort ab.
 */
export function resolveCallDeadlineMs(
    role: CascadeRole,
    deadlineAtMs: number | null,
    nowMs: ClockNow = Date.now,
): number | null {
    const remainingMs = Math.max(0, remainingLlmMs({ deadlineAtMs }, nowMs));
    const roleCapMs = role === 'escalation' ? ESCALATION_CALL_DEADLINE_MS : Number.POSITIVE_INFINITY;
    const callDeadlineMs = Math.min(remainingMs, roleCapMs);
    return Number.isFinite(callDeadlineMs) ? callDeadlineMs : null;
}

/**
 * D14: war das Job-Budget (und nicht der 150-s-Deckel der Eskalation) die
 * greifende Grenze? Zum Abbruchzeitpunkt ist dann praktisch nichts mehr übrig.
 */
export function isJobBudgetExhausted(jobClock: Pick<JobClock, 'deadlineAtMs'>, nowMs: ClockNow = Date.now): boolean {
    return remainingLlmMs(jobClock, nowMs) <= BUDGET_ABORT_TOLERANCE_MS;
}

/**
 * Startschwelle je Telemetrie-Phase — gilt für den ersten Versuch UND für
 * jeden Retry (§3.2). Draft und Pro-direct-Draft starten mit jedem Rest > 0 (D4).
 */
const START_THRESHOLD_BY_PHASE: Readonly<Record<LlmCallPhase, number>> = {
    draft: 0,
    escalate_full: 0,
    verify: VERIFIER_BATCH_MIN_MS,
    escalate_targeted: TARGETED_ESCALATION_MIN_MS,
    escalate_second_opinion: SECOND_OPINION_MIN_MS,
};

/** Reicht das Budget nach `delayMs` Wartezeit noch für einen Call dieser Phase? */
export function hasBudgetForCall(
    jobClock: Pick<JobClock, 'deadlineAtMs'>,
    telemetryPhase: LlmCallPhase,
    delayMs = 0,
    nowMs: ClockNow = Date.now,
): boolean {
    const requiredMs = Math.max(START_THRESHOLD_BY_PHASE[telemetryPhase], 1);
    return remainingLlmMs(jobClock, nowMs) - delayMs >= requiredMs;
}

/**
 * D14: hat das Job-Budget den Call beendet — per Abbruch an der Deadline
 * oder per verweigertem Retry? Ein Abbruch am eigenen 150-s-Deckel der
 * Eskalation mit reichlich Restzeit ist dagegen ein API-Fehler wie bisher.
 */
export function isTimeBudgetFailure(
    callFailure: unknown,
    jobClock: Pick<JobClock, 'deadlineAtMs'>,
    nowMs: ClockNow = Date.now,
): boolean {
    if (isCallBudgetRefusal(callFailure)) return true;
    return isCallDeadlineFailure(callFailure) && isJobBudgetExhausted(jobClock, nowMs);
}

/** D6: Degradation `time_budget_exhausted` + Stufe in `skippedStages`, beides idempotent. */
export function markStageSkippedForTime(context: PipelineContext, skippedStage: SkippableStage): PipelineContext {
    const { degradations, skippedStages } = context.cascade;
    return {
        ...context,
        cascade: {
            ...context.cascade,
            degradations: degradations.includes('time_budget_exhausted')
                ? degradations
                : [...degradations, 'time_budget_exhausted'],
            skippedStages: skippedStages.includes(skippedStage)
                ? skippedStages
                : [...skippedStages, skippedStage],
        },
    };
}

/** Der Draft konnte nicht in der Restzeit fertig werden (D5) — Client-Code `review_timeout`. */
export class ReviewTimeoutError extends Error {
    constructor(detail: string, options?: { cause?: unknown }) {
        super(`Review-Zeitbudget erschöpft: ${detail}`, options);
        this.name = 'ReviewTimeoutError';
    }
}

/** Der Watchdog hat den Job vor dem Plattform-Kill beendet (D9) — Client-Code `review_timeout`. */
export class JobTimeoutError extends Error {
    constructor(jobId: string, jobBudgetMs: number) {
        super(`Job ${jobId} hat das Budget von ${jobBudgetMs} ms vor der Report-Phase überschritten (Watchdog).`);
        this.name = 'JobTimeoutError';
    }
}
