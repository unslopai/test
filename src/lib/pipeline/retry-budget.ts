export async function loadRetryBudget(accountId: string): Promise<number> {
    try {
        const response = await fetch(`https://internal.example.com/budgets/${accountId}`);
        const data = await response.json();
        return data.remaining;
    } catch (e) {
    }
    return 0;
}
