/**
 * Job-Uhr des Deadline Guards (DEADLINE_GUARD_SPEC.md §3.1, §5): Restzeit,
 * Call-Deadlines je Rolle, Budget-Zuordnung von Abbrüchen und die Invariante
 * Budget ≤ maxDuration der drei Job-Routen.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    DEFAULT_JOB_BUDGET_MS,
    ESCALATION_CALL_DEADLINE_MS,
    JOB_ROUTE_MAX_DURATION_MS,
    buildJobClock,
    hasBudgetForCall,
    isJobBudgetExhausted,
    markStageSkippedForTime,
    remainingLlmMs,
    resolveCallDeadlineMs,
    resolveJobBudgetMs,
    resolveWatchdogFireAtMs,
} from '@/lib/pipeline/deadline';
import { buildPipelineContext } from '@/lib/pipeline/testing/context-fixture';

const INVOCATION_START_MS = 1_000_000;
const fixedClock = (clockReadingMs: number) => () => clockReadingMs;

/** Routen, deren after()-Callback processReviewJob ausführt (D11). */
const JOB_ROUTE_FILES = [
    'src/app/api/webhook/route.ts',
    'src/app/api/cli/scan/route.ts',
    'src/app/api/cli/pr/review/route.ts',
];

function readMaxDurationSeconds(routeFile: string): number {
    const routeSource = readFileSync(join(process.cwd(), routeFile), 'utf-8');
    const maxDurationMatch = /export const maxDuration = (\d+);/.exec(routeSource);
    if (!maxDurationMatch) throw new Error(`${routeFile} deklariert kein literales maxDuration`);
    return Number(maxDurationMatch[1]);
}

describe('Job-Budget', () => {
    it('fällt ohne oder mit ungültiger Env auf das Hobby-Budget zurück', () => {
        expect(resolveJobBudgetMs(undefined)).toBe(300_000);
        expect(resolveJobBudgetMs('not-a-number')).toBe(300_000);
        expect(resolveJobBudgetMs('10000')).toBe(300_000);
        expect(resolveJobBudgetMs('240000')).toBe(240_000);
    });

    it('deckelt ein zu hohes Env auf die maxDuration der Routen (sonst feuerte der Watchdog nie)', () => {
        expect(resolveJobBudgetMs('800000')).toBe(JOB_ROUTE_MAX_DURATION_MS);
    });

    it.each(JOB_ROUTE_FILES)('JOB_ROUTE_MAX_DURATION_MS entspricht dem maxDuration-Literal von %s', (routeFile) => {
        expect(JOB_ROUTE_MAX_DURATION_MS).toBe(1000 * readMaxDurationSeconds(routeFile));
        expect(DEFAULT_JOB_BUDGET_MS).toBeLessThanOrEqual(JOB_ROUTE_MAX_DURATION_MS);
    });
});

describe('Job-Uhr', () => {
    it('LLM-Deadline = Invocation-Start + Budget − 30 s Reserve, Watchdog bei − 15 s', () => {
        const jobClock = buildJobClock(INVOCATION_START_MS, 300_000);

        expect(jobClock.deadlineAtMs).toBe(INVOCATION_START_MS + 270_000);
        expect(resolveWatchdogFireAtMs(INVOCATION_START_MS, 300_000)).toBe(INVOCATION_START_MS + 285_000);
    });

    it('Restzeit sinkt mit der Uhr und wird negativ, wenn die Deadline gerissen ist', () => {
        const jobClock = buildJobClock(INVOCATION_START_MS, 300_000);

        expect(remainingLlmMs(jobClock, fixedClock(INVOCATION_START_MS + 146_000))).toBe(124_000);
        expect(remainingLlmMs(jobClock, fixedClock(INVOCATION_START_MS + 280_000))).toBe(-10_000);
    });

    it('ohne Budget (Harness) ist die Restzeit unendlich', () => {
        expect(remainingLlmMs({ deadlineAtMs: null })).toBe(Number.POSITIVE_INFINITY);
    });
});

describe('Call-Deadline je Rolle (§3.2)', () => {
    const deadlineAtMs = INVOCATION_START_MS + 270_000;

    it('Draft und Verifier bekommen das volle Restbudget', () => {
        const midJobClock = fixedClock(INVOCATION_START_MS + 20_000);

        expect(resolveCallDeadlineMs('draft', deadlineAtMs, midJobClock)).toBe(250_000);
        expect(resolveCallDeadlineMs('verifier', deadlineAtMs, midJobClock)).toBe(250_000);
    });

    it('Eskalation bekommt min(150 s, Restbudget)', () => {
        expect(resolveCallDeadlineMs('escalation', deadlineAtMs, fixedClock(INVOCATION_START_MS)))
            .toBe(ESCALATION_CALL_DEADLINE_MS);
        expect(resolveCallDeadlineMs('escalation', deadlineAtMs, fixedClock(INVOCATION_START_MS + 200_000)))
            .toBe(70_000);
    });

    it('ohne Restbudget ist die Deadline 0 statt negativ', () => {
        expect(resolveCallDeadlineMs('draft', deadlineAtMs, fixedClock(deadlineAtMs + 5_000))).toBe(0);
    });

    it('ohne Job-Budget: nur die Eskalation behält ihren eigenen Deckel', () => {
        expect(resolveCallDeadlineMs('draft', null)).toBeNull();
        expect(resolveCallDeadlineMs('verifier', null)).toBeNull();
        expect(resolveCallDeadlineMs('escalation', null)).toBe(ESCALATION_CALL_DEADLINE_MS);
    });
});

describe('Abbruch-Zuordnung (D14)', () => {
    const jobClock = { deadlineAtMs: INVOCATION_START_MS + 270_000 };

    it('ein Abbruch an der Job-Deadline zählt als Budget-Erschöpfung', () => {
        expect(isJobBudgetExhausted(jobClock, fixedClock(INVOCATION_START_MS + 269_500))).toBe(true);
    });

    it('ein Abbruch am 150-s-Deckel mit reichlich Restzeit zählt nicht als Budget-Erschöpfung', () => {
        expect(isJobBudgetExhausted(jobClock, fixedClock(INVOCATION_START_MS + 170_000))).toBe(false);
    });
});

describe('Stufenschwellen und Zeit-Skips (D4/D6)', () => {
    const jobClock = { deadlineAtMs: INVOCATION_START_MS + 270_000 };
    const withRemaining = (remainingMs: number) => fixedClock(INVOCATION_START_MS + 270_000 - remainingMs);

    it.each([
        ['escalate_second_opinion', 80_000],
        ['escalate_targeted', 60_000],
        ['verify', 40_000],
    ] as const)('%s startet erst ab %i ms Rest', (telemetryPhase, thresholdMs) => {
        expect(hasBudgetForCall(jobClock, telemetryPhase, 0, withRemaining(thresholdMs))).toBe(true);
        expect(hasBudgetForCall(jobClock, telemetryPhase, 0, withRemaining(thresholdMs - 1))).toBe(false);
    });

    it('der Draft startet mit jedem Rest > 0, aber nie ohne Rest', () => {
        expect(hasBudgetForCall(jobClock, 'draft', 0, withRemaining(1))).toBe(true);
        expect(hasBudgetForCall(jobClock, 'draft', 0, withRemaining(0))).toBe(false);
    });

    it('die Backoff-Wartezeit zählt gegen das Budget eines Retrys', () => {
        expect(hasBudgetForCall(jobClock, 'verify', 6_000, withRemaining(45_000))).toBe(false);
    });

    it('markiert Degradation und Stufe genau einmal', () => {
        const onceSkipped = markStageSkippedForTime(buildPipelineContext(), 'escalation');
        const twiceSkipped = markStageSkippedForTime(markStageSkippedForTime(onceSkipped, 'escalation'), 'second_opinion');

        expect(twiceSkipped.cascade.degradations).toEqual(['time_budget_exhausted']);
        expect(twiceSkipped.cascade.skippedStages).toEqual(['escalation', 'second_opinion']);
    });
});
