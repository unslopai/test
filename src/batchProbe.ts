// Regressionsprobe fuer unslop "Pre-Scan in Datei-Batches": kleiner PR, ein Batch.
// Erwartet: MAINT-001 (leerer catch-Block) vom deterministischen Pre-Scanner, wie vor dem Batching.
export async function loadRetryBudget(configUrl: string): Promise<number> {
    try {
        const configResponse = await fetch(configUrl);
        const retryConfig: { retryBudget?: number } = await configResponse.json();
        return retryConfig.retryBudget ?? 3;
    } catch {}
    return 3;
}
