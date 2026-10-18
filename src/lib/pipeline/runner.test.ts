/**
 * Runner-Kopplung an den Watchdog (DEADLINE_GUARD_SPEC.md D9): Abbruch vor
 * dem nächsten Step, genau ein Report-Phasen-Signal vor Reporter/Persister.
 */
import { describe, expect, it, vi } from 'vitest';
import { PipelineCancelledError, runPipeline } from '@/lib/pipeline/runner';
import { buildPipelineContext } from '@/lib/pipeline/testing/context-fixture';
import type { PipelineContext, PipelineStep } from '@/lib/pipeline/types';

vi.mock('@/lib/memory-log', () => ({ logMemory: vi.fn() }));

function buildRecordingStep(stepId: string, executedStepIds: string[]): PipelineStep {
    return {
        id: stepId,
        displayName: stepId,
        execute: async (stepInput: PipelineContext) => {
            executedStepIds.push(stepId);
            return stepInput;
        },
    };
}

describe('runPipeline — Watchdog-Hooks', () => {
    it('meldet die Report-Phase genau einmal, direkt vor dem Reporter', async () => {
        const executedStepIds: string[] = [];
        const phaseSignalOrder: string[] = [];
        const reportSteps = ['draft-reviewer', 'github-reporter', 'result-persister']
            .map((stepId) => buildRecordingStep(stepId, executedStepIds));

        await runPipeline(buildPipelineContext(), reportSteps, {
            isCancelled: () => false,
            onPostLlmPhase: () => phaseSignalOrder.push(`signal-after:${executedStepIds.join(',')}`),
        });

        expect(phaseSignalOrder).toEqual(['signal-after:draft-reviewer']);
        expect(executedStepIds).toEqual(['draft-reviewer', 'github-reporter', 'result-persister']);
    });

    it('meldet die Report-Phase auch ohne Reporter (CLI-Pipeline: Persister ist terminal)', async () => {
        const onPostLlmPhase = vi.fn();
        const cliSteps = ['integrity-scorer', 'result-persister'].map((stepId) => buildRecordingStep(stepId, []));

        await runPipeline(buildPipelineContext(), cliSteps, { isCancelled: () => false, onPostLlmPhase });

        expect(onPostLlmPhase).toHaveBeenCalledTimes(1);
    });

    it('startet nach einem Watchdog-Timeout keinen weiteren Step', async () => {
        const executedStepIds: string[] = [];
        let watchdogFired = false;
        const firingStep: PipelineStep = {
            id: 'claim-verifier',
            displayName: 'claim-verifier',
            execute: async (stepInput: PipelineContext) => {
                watchdogFired = true;
                return stepInput;
            },
        };

        const cancelledRun = runPipeline(
            buildPipelineContext(),
            [firingStep, buildRecordingStep('github-reporter', executedStepIds)],
            { isCancelled: () => watchdogFired, onPostLlmPhase: vi.fn() },
        );

        await expect(cancelledRun).rejects.toBeInstanceOf(PipelineCancelledError);
        expect(executedStepIds).toEqual([]);
    });
});
