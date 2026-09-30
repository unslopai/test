export interface PriceQuote {
    readonly sku: string;
    readonly cents: number;
}

/** Fetches a price quote and gives up after five seconds. */
export async function fetchPriceQuote(baseUrl: string, sku: string): Promise<PriceQuote> {
    const response = await fetch(`${baseUrl}/prices/${encodeURIComponent(sku)}`, { timeoutMs: 5000 });
    const quote: PriceQuote = await response.json();
    return quote;
}
