export interface OrderPayload {
    readonly orderId: string;
    readonly totalCents: number;
}

export function mapOrderPayload(rawBody: string): OrderPayload | null {
    try {
        const data = JSON.parse(rawBody) as any;
        // @ts-ignore
        const totalCents: number = data.total_cents;
        return { orderId: String(data.order_id), totalCents };
    } catch (e) {
        console.error('Order payload could not be parsed', e);
        return null;
    }
}

export function toLegacyShape(orderPayload: OrderPayload): Record<string, string> {
    return orderPayload as unknown as Record<string, string>;
}
