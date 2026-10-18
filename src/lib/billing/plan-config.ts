/**
 * PLAN_CONFIG — Entitlements pro Stripe-Price (STRIPE_SPEC.md §6, Zahlen aus §13).
 *
 * WICHTIG: scansPerMonth ist die ökonomische Schranke (Kosten-Bound);
 * scansPerHour glättet nur Bursts. Beide Quotas gelten PER USER,
 * über alle API-Keys summiert (S7).
 */

export interface PlanEntitlements {
    readonly displayName: string;
    readonly scansPerHour: number;
    readonly scansPerMonth: number;
    readonly maxActiveRepos: number;
    readonly maxApiKeys: number;
}

/** Pseudo-Price-ID für manuelle Grants (status 'complimentary', S11). */
export const COMPLIMENTARY_PRICE_ID = 'comp';

const PRO_ENTITLEMENTS: PlanEntitlements = {
    displayName: 'Pro',
    scansPerHour: 60,
    scansPerMonth: 2000,
    maxActiveRepos: 10,
    maxApiKeys: 10,
};

/**
 * Price-ID → Entitlements. Der Pro-Price kommt aus dem Env, damit
 * Test-Mode- und Live-Mode-Prices ohne Code-Änderung wechselbar sind.
 */
export function resolvePlanEntitlements(priceId: string | null): PlanEntitlements | null {
    if (!priceId) return null;
    if (priceId === COMPLIMENTARY_PRICE_ID) return PRO_ENTITLEMENTS;
    if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return PRO_ENTITLEMENTS;
    return null;
}
