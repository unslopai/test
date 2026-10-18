/**
 * Entitlement-Auflösung + Quota-Verbrauch (STRIPE_SPEC.md §6/§8).
 *
 * Liest ausschließlich den lokalen billing_customers-Mirror — nie die
 * Stripe-API (S1/S5). Fail-closed: jeder Fehler bedeutet "nicht berechtigt".
 * Kein Row / Status außerhalb ENTITLED_STATUSES / unbekannter Price = 0 Scans (S2/S3).
 */
import { supabase } from '@/lib/supabase';
import { resolvePlanEntitlements } from '@/lib/billing/plan-config';
import type { PlanEntitlements } from '@/lib/billing/plan-config';

const ENTITLED_STATUSES = new Set(['trialing', 'active', 'complimentary']);

export type EntitlementResult =
    | { readonly entitled: true; readonly plan: PlanEntitlements; readonly status: string }
    | { readonly entitled: false; readonly reason: 'no_subscription' | 'subscription_inactive' | 'unknown_plan' };

export async function resolveEntitlement(userId: string): Promise<EntitlementResult> {
    const { data: billingRow, error: lookupError } = await supabase
        .from('billing_customers')
        .select('status, price_id')
        .eq('user_id', userId)
        .maybeSingle();

    if (lookupError) {
        console.error('[Entitlements] Lookup fehlgeschlagen (fail-closed):', lookupError.message);
        return { entitled: false, reason: 'no_subscription' };
    }
    if (!billingRow) {
        return { entitled: false, reason: 'no_subscription' };
    }
    if (!ENTITLED_STATUSES.has(billingRow.status)) {
        return { entitled: false, reason: 'subscription_inactive' };
    }

    const plan = resolvePlanEntitlements(billingRow.price_id);
    if (!plan) {
        console.error(`[Entitlements] Unbekannte price_id '${billingRow.price_id}' — fail-closed.`);
        return { entitled: false, reason: 'unknown_plan' };
    }

    return { entitled: true, plan, status: billingRow.status };
}

/**
 * Verbraucht einen Scan aus BEIDEN Fixed-Window-Quotas des Users (Stunde + Monat).
 * true = erlaubt; false = eines der Fenster ist erschöpft (429 senden).
 */
export async function consumeScanQuota(userId: string, plan: PlanEntitlements): Promise<boolean> {
    const { data: requestAllowed, error: quotaError } = await supabase.rpc('consume_user_scan_quota', {
        target_user_id: userId,
        hourly_max: plan.scansPerHour,
        monthly_max: plan.scansPerMonth,
    });

    if (quotaError) {
        // Fail-closed: ohne funktionierendes Limit keine unkontrollierten LLM-Kosten.
        console.error('[Entitlements] Quota-RPC fehlgeschlagen (fail-closed):', quotaError.message);
        return false;
    }

    return requestAllowed === true;
}

export function quotaRetryAfterSeconds(): number {
    return 3600; // Stunden-Fenster; das Monats-Fenster kommuniziert die API-Antwort nicht separat.
}
