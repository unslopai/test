'use client';

/**
 * Settings Client — per-repository pipeline configuration (OPERATOR-ONLY).
 *
 * Internal operator tool since OPERATOR_SETTINGS_SPEC.md (D1/D5): all copy is
 * deliberately hardcoded English and NOT in the i18n catalogs — next-intl
 * ships every catalog namespace into each customer's client bundle. The step
 * vocabulary (the architecture this page must not leak) lives server-side in
 * step-catalog.ts and arrives as a prop. Documented exception to the catalog
 * rule (i18n_Spec §6): internal surface, no customer-facing UI copy.
 *
 * Communicates with GET/PUT /api/repos/[id]/settings (operator-gated, D4).
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CONDITION_REGISTRY, SELECTABLE_CONDITION_IDS } from '@/lib/pipeline/conditions';
import type { ReviewCondition } from '@/lib/pipeline/conditions';
// `import type` ONLY: the catalog values (blueprint vocabulary) must stay out
// of this client chunk — the server page passes them as a prop (D5/V3).
import type { StepDefinition } from './step-catalog';

// =============================================================================
// Types
// =============================================================================

interface SettingsClientProps {
    repoId: string;
    fullName: string;
    /**
     * Server-provided step catalog (canonical pipeline order). Travels only in
     * the RSC payload of the operator-gated page, never in a static chunk.
     */
    availableSteps: readonly StepDefinition[];
}

/**
 * Client-side mirror of PipelineConfig. `cascade`/`prescan`/`reviewScope`/`repoContext` are pass-through
 * blocks the 3-field UI never renders — they must survive Save AND Reset
 * untouched (dropping them on save was the original prescan-loss bug; dropping
 * them on reset was the two-click path back into the parked prod OOM, D10).
 */
interface PipelineConfigState {
    enabledStepIds: string[];
    activeConditionIds: string[];
    overrideSmartDetection: boolean;
    cascade?: Record<string, number>;
    prescan?: unknown;
    reviewScope?: unknown;
    repoContext?: unknown;
}

type LoadState = 'loading' | 'loaded' | 'error' | 'saving';

/** Detached copy so state mutations can never alias the saved snapshot. */
function cloneConfig(config: PipelineConfigState): PipelineConfigState {
    return {
        ...config,
        enabledStepIds: [...config.enabledStepIds],
        activeConditionIds: [...config.activeConditionIds],
        ...(config.cascade ? { cascade: { ...config.cascade } } : {}),
    };
}

// =============================================================================
// Component
// =============================================================================

export default function SettingsClient({ repoId, fullName, availableSteps }: SettingsClientProps) {
    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [configState, setConfigState] = useState<PipelineConfigState>({
        enabledStepIds: [],
        activeConditionIds: [],
        overrideSmartDetection: false,
    });
    /**
     * Snapshot of the last state confirmed by the server (GET or PUT response).
     * "Reset" restores THIS — not the factory default, which would re-enable
     * the pre-scanner on unslopai/test and bring back the parked OOM (D10).
     */
    const [lastSavedConfig, setLastSavedConfig] = useState<PipelineConfigState | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fetchConfig = useCallback(async (signal?: AbortSignal) => {
        const response = await fetch(`/api/repos/${repoId}/settings`, { signal });
        const responseBody = await response.json();
        if (!response.ok) throw new Error(responseBody.error ?? 'Settings could not be loaded.');
        return responseBody.config as PipelineConfigState;
    }, [repoId]);

    useEffect(() => {
        const controller = new AbortController();

        void fetchConfig(controller.signal)
            .then((loadedConfig) => {
                setConfigState(loadedConfig);
                setLastSavedConfig(cloneConfig(loadedConfig));
                setLoadState('loaded');
            })
            .catch((fetchError: unknown) => {
                if (fetchError instanceof Error && fetchError.name === 'AbortError') return;
                setErrorMessage(fetchError instanceof Error ? fetchError.message : 'Load error');
                setLoadState('error');
            });

        return () => controller.abort();
    }, [fetchConfig]);

    const handleSave = async () => {
        setLoadState('saving');
        setErrorMessage(null);

        try {
            const response = await fetch(`/api/repos/${repoId}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configState),
            });

            const responseBody = await response.json();
            if (!response.ok) throw new Error(responseBody.error ?? 'Saving failed.');
            // The server response is the persisted truth (validator may have
            // filtered) — it becomes both the visible state and the new
            // reset snapshot.
            const savedConfig = responseBody.config as PipelineConfigState;
            setConfigState(savedConfig);
            setLastSavedConfig(cloneConfig(savedConfig));
            setLoadState('loaded');
        } catch (saveError: unknown) {
            setErrorMessage(saveError instanceof Error ? saveError.message : 'Save error');
            setLoadState('loaded');
        }
    };

    /** Discards unsaved edits by restoring the last server-confirmed snapshot. */
    const handleReset = () => {
        if (!lastSavedConfig) return;
        setConfigState(cloneConfig(lastSavedConfig));
    };

    /**
     * Toggles a step and restores the canonical order.
     * A simple append would put a re-enabled step at the END of the pipeline —
     * the pre-scanner would then run after the reporter instead of before the
     * RAG loader, and the diff loader no longer first at all.
     */
    const toggleStep = (stepId: string) => {
        setConfigState((prev) => {
            const nextStepIds = new Set(prev.enabledStepIds);
            if (!nextStepIds.delete(stepId)) {
                nextStepIds.add(stepId);
            }
            return {
                ...prev,
                enabledStepIds: availableSteps
                    .map((step) => step.id)
                    .filter((availableStepId) => nextStepIds.has(availableStepId)),
            };
        });
    };

    const toggleCondition = (conditionId: string) => {
        setConfigState((prev) => ({
            ...prev,
            activeConditionIds: prev.activeConditionIds.includes(conditionId)
                ? prev.activeConditionIds.filter((existingId) => existingId !== conditionId)
                : [...prev.activeConditionIds, conditionId],
        }));
    };

    const macroConditions = SELECTABLE_CONDITION_IDS
        .map((conditionId) => CONDITION_REGISTRY.get(conditionId))
        .filter((condition): condition is ReviewCondition => condition !== undefined && condition.category === 'macro');

    const reactConditions = SELECTABLE_CONDITION_IDS
        .map((conditionId) => CONDITION_REGISTRY.get(conditionId))
        .filter((condition): condition is ReviewCondition => condition !== undefined && condition.category === 'react_nextjs');

    if (loadState === 'loading') {
        return (
            <div className="min-h-screen bg-surface text-ink flex items-center justify-center">
                <div className="flex items-center gap-3 text-ink-muted">
                    <LoadingSpinner />
                    Loading settings…
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface text-ink">
            <header className="border-b border-edge bg-surface-raised/80 backdrop-blur">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
                    <div>
                        <Link href="/dashboard" className="text-sm text-ink-muted hover:text-ink transition">&larr; Dashboard</Link>
                        <h1 className="text-xl font-bold tracking-tight mt-1">
                            {fullName}
                            <span className="ml-2 rounded bg-warn/10 px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase text-warn">
                                Operator
                            </span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleReset}
                            title="Discard unsaved edits and restore the last saved configuration"
                            className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-overlay"
                        >
                            Reset to saved
                        </button>
                        <button
                            onClick={() => { void handleSave(); }}
                            disabled={loadState === 'saving'}
                            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink transition hover:bg-accent/85 disabled:opacity-50"
                        >
                            {loadState === 'saving' ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-6 py-8 space-y-8">
                {errorMessage && (
                    <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                        {errorMessage}
                    </div>
                )}

                <PipelineStepsSection
                    availableSteps={availableSteps}
                    enabledStepIds={configState.enabledStepIds}
                    onToggle={toggleStep}
                />

                <SmartDetectionSection
                    isOverridden={configState.overrideSmartDetection}
                    onToggle={() => setConfigState((prev) => ({ ...prev, overrideSmartDetection: !prev.overrideSmartDetection }))}
                />

                <ConditionsSection
                    title="Macro & Structural Conditions"
                    conditions={macroConditions}
                    activeConditionIds={configState.activeConditionIds}
                    onToggle={toggleCondition}
                />

                <ConditionsSection
                    title="React & Next.js Conditions"
                    conditions={reactConditions}
                    activeConditionIds={configState.activeConditionIds}
                    onToggle={toggleCondition}
                />
            </main>
        </div>
    );
}

// =============================================================================
// Sub-Components
// =============================================================================

function PipelineStepsSection({
    availableSteps,
    enabledStepIds,
    onToggle,
}: {
    availableSteps: readonly StepDefinition[];
    enabledStepIds: readonly string[];
    onToggle: (stepId: string) => void;
}) {
    return (
        <section>
            <h2 className="text-lg font-semibold mb-3">Pipeline Steps</h2>
            <p className="text-sm text-ink-muted mb-4">
                Enable or disable individual steps of the review pipeline.
            </p>
            <div className="space-y-2">
                {availableSteps.map((step) => (
                    <label
                        key={step.id}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 transition cursor-pointer ${
                            enabledStepIds.includes(step.id)
                                ? 'border-accent/40 bg-accent/5'
                                : 'border-edge bg-surface-raised hover:border-ink-muted/40'
                        } ${step.required ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        <div className="min-w-0 flex-1">
                            <span className="font-medium text-sm">{step.label}</span>
                            {step.required && (
                                <span className="ml-2 rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-muted">
                                    Required
                                </span>
                            )}
                            <p className="text-xs text-ink-muted mt-0.5">{step.description}</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={enabledStepIds.includes(step.id)}
                            disabled={step.required}
                            onChange={() => onToggle(step.id)}
                            className="h-4 w-4 accent-accent"
                        />
                    </label>
                ))}
            </div>
        </section>
    );
}

function SmartDetectionSection({
    isOverridden,
    onToggle,
}: {
    isOverridden: boolean;
    onToggle: () => void;
}) {
    return (
        <section>
            <h2 className="text-lg font-semibold mb-3">Smart Context Detection</h2>
            <label
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition cursor-pointer ${
                    isOverridden
                        ? 'border-warn/40 bg-warn/5'
                        : 'border-edge bg-surface-raised hover:border-ink-muted/40'
                }`}
            >
                <div className="min-w-0 flex-1">
                    <span className="font-medium text-sm">Override scope filter</span>
                    <p className="text-xs text-ink-muted mt-0.5">
                        {isOverridden
                            ? 'All enabled conditions are applied regardless of file extensions.'
                            : 'Conditions are filtered automatically by file extension (e.g. no React check for .cpp).'}
                    </p>
                </div>
                <input
                    type="checkbox"
                    checked={isOverridden}
                    onChange={onToggle}
                    className="h-4 w-4 accent-warn"
                />
            </label>
        </section>
    );
}

function ConditionsSection({
    title,
    conditions,
    activeConditionIds,
    onToggle,
}: {
    title: string;
    conditions: readonly ReviewCondition[];
    activeConditionIds: readonly string[];
    onToggle: (conditionId: string) => void;
}) {
    return (
        <section>
            <h2 className="text-lg font-semibold mb-3">{title}</h2>
            <div className="space-y-2">
                {conditions.map((condition) => {
                    const isActive = activeConditionIds.includes(condition.id);
                    return (
                        <label
                            key={condition.id}
                            className={`flex items-center justify-between rounded-xl border px-4 py-3 transition cursor-pointer ${
                                isActive
                                    ? 'border-accent/40 bg-accent/5'
                                    : 'border-edge bg-surface-raised hover:border-ink-muted/40'
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] font-mono text-ink-muted">
                                        {condition.id}
                                    </span>
                                    <span className="font-medium text-sm">{condition.name}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                    {condition.scopes.map((scope) => (
                                        <span
                                            key={scope}
                                            className="rounded-full bg-surface-overlay/50 px-2 py-0.5 text-[10px] text-ink-muted"
                                        >
                                            {scope}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={() => onToggle(condition.id)}
                                className="h-4 w-4 accent-accent"
                            />
                        </label>
                    );
                })}
            </div>
        </section>
    );
}

function LoadingSpinner() {
    return (
        <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}
