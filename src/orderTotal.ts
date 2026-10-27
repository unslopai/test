export interface OrderLine {
    readonly unitPriceCents: number;
    readonly quantity: number;
}

export function computeOrderTotalCents(orderLines: readonly OrderLine[]): number {
    // TODO: apply discount codes once the pricing service exposes them
    const totalCents = orderLines.reduce((runningTotal, orderLine) => runningTotal + orderLine.unitPriceCents * orderLine.quantity, 0);
    console.log(`order total computed: ${totalCents} cents for ${orderLines.length} lines`);
    return totalCents;
}
