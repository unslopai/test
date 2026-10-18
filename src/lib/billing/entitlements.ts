/**
 * Entitlement-Auflösung + Quota-Verbrauch (PADDLE_SPEC.md §5.1).
 *
 * Liest ausschließlich den lokalen billing_accounts-Mirror — nie die
 * Paddle-API (P1). Fail-closed: jeder Fehler bedeutet "nicht berechtigt" (P2).
 * Kein Account / Status außerhalb ENTITLED_STATUSES / unbekannter Price = 0 Scans.
 *
 * Öffentliche Signaturen sind EINGEFROREN (§5.1) — mit EINER bewussten
 * Ausnahme: MCP_SPEC.md §4.6 hebt den Freeze für consumeScanQuota auf, das
 * einen dritten Parameter `source` erhält (Webhook-Reservierung, D10). Alle
 * übrigen Gate-Aufrufer bleiben unverändert. Der Account wird intern über
 * billing_account_members aufgelöst (1 User = 1 Account, Unique-Index macht
 * den Join eindeutig).
 *
 * Trial-Schranke: Trial-Nutzer haben ein eigenes, hartes Lifetime-Kontingent
 * (plan.trialScans / plan.trialProEscalations). Erzwungen wird es in den
 * Quota-RPCs — atomar im selben UPDATE wie die Fenster-Zähler, damit
 * parallele Serverless-Invocations es nicht überlaufen können (P3).
 */
import { supabase } from '@/lib/supabase';
import { isEntitledStatus, resolvePlanEntitlements } from '@/lib/billing/plan-config';
import type { PlanEntitlements } from '@/lib/billing/plan-config';
import { unwrapAccountEmbed } from '@/lib/billing/accounts';

export type EntitlementResult =
    | {
        readonly entitled: true;
        readonly plan: PlanEntitlements;
        readonly status: string;
        /** true = Trial-Kontingent gilt (nicht das volle Plan-Kontingent). */
        readonly isTrial: boolean;
    }
    | { readonly entitled: false; readonly reason: 'no_subscription' | 'subscription_inactive' | 'unknown_plan' };

export async function resolveEntitlement(userId: string): Promise<EntitlementResult> {
    const { data: membershipRow, error: lookupError } = await supabase
        .from('billing_account_members')
        .select('billing_accounts(status, paddle_price_id)')
        .eq('user_id', userId)
        .maybeSingle();

    if (lookupError) {
        console.error('[Entitlements] Lookup fehlgeschlagen (fail-closed):', lookupError.message);
        return { entitled: false, reason: 'no_subscription' };
    }

    const billingAccount = unwrapAccountEmbed(membershipRow?.billing_accounts);
    // Kein Account ODER Account ohne jemals gestartetes Abo (§4.1: 'none')
    // = wie bisher "kein Abo".
    if (!billingAccount || billingAccount.status === 'none') {
        return { entitled: false, reason: 'no_subscription' };
    }
    if (!isEntitledStatus(billingAccount.status)) {
        return { entitled: false, reason: 'subscription_inactive' };
    }

    const plan = resolvePlanEntitlements(billingAccount.paddle_price_id);
    if (!plan) {
        console.error(`[Entitlements] Unbekannte paddle_price_id '${billingAccount.paddle_price_id}' — fail-closed.`);
        return { entitled: false, reason: 'unknown_plan' };
    }

    return {
        entitled: true,
        plan,
        status: billingAccount.status,
        isTrial: billingAccount.status === 'trialing',
    };
}

/**
 * Ergebnis eines Scan-Quota-Verbrauchs.
 * 'trial_exhausted' ist bewusst von 'quota_exceeded' getrennt: Ein erschöpftes
 * Trial ist eine Paywall (Upgrade nötig, 402), kein temporäres Rate-Limit (429,
 * "kommt gleich wieder"). Der Grund kommt atomar aus der RPC — die Fenster- und
 * Trial-Zähler dürfen zur Klassifikation nicht separat nachgelesen werden.
 */
export type ScanQuotaOutcome = 'allowed' | 'quota_exceeded' | 'trial_exhausted';

/** Welche Oberfläche einen Scan verbraucht (MCP_SPEC.md §4.6). */
export type ScanSource = 'cli' | 'mcp' | 'webhook';

/**
 * Webhook-Reservierung (D10): CLI-/MCP-Scans sehen nur 80% der Fenster-Limits,
 * damit der Agent eines Entwicklers nie die Quota erschöpfen kann, die die
 * PR-Reviews des Teams gated. Kein RPC-Change — die reduzierten Limits werden
 * hier im TS-Wrapper berechnet und durchgereicht.
 */
const WEBHOOK_RESERVE_FRACTION = 0.2;

interface EffectiveScanLimits {
    readonly hourlyMax: number;
    readonly monthlyMax: number;
}

function resolveEffectiveLimits(plan: PlanEntitlements, source: ScanSource): EffectiveScanLimits {
    if (source === 'webhook') {
        return { hourlyMax: plan.scansPerHour, monthlyMax: plan.scansPerMonth };
    }
    return {
        hourlyMax: Math.floor(plan.scansPerHour * (1 - WEBHOOK_RESERVE_FRACTION)),
        monthlyMax: Math.floor(plan.scansPerMonth * (1 - WEBHOOK_RESERVE_FRACTION)),
    };
}

/**
 * Verbraucht einen Scan aus den Quotas des Users: Stunden- und Monats-Fenster
 * und — solange der Status 'trialing' ist — dem harten Trial-Lifetime-Kontingent.
 * Das Trial-Kontingent wird bewusst NICHT reserviert-reduziert: es ist eine
 * Lifetime-Allowance, kein Fenster (MCP_SPEC.md §4.6).
 */
export async function consumeScanQuota(
    userId: string,
    plan: PlanEntitlements,
    source: ScanSource,
): Promise<ScanQuotaOutcome> {
    const effectiveLimits = resolveEffectiveLimits(plan, source);
    const { data: quotaOutcome, error: quotaError } = await supabase.rpc('consume_scan_quota', {
        target_user_id: userId,
        hourly_max: effectiveLimits.hourlyMax,
        monthly_max: effectiveLimits.monthlyMax,
        trial_max: plan.trialScans,
    });

    if (quotaError) {
        // Fail-closed: ohne funktionierendes Limit keine unkontrollierten LLM-Kosten.
        console.error('[Entitlements] Quota-RPC fehlgeschlagen (fail-closed):', quotaError.message);
        return 'quota_exceeded';
    }

    return quotaOutcome === 'allowed' || quotaOutcome === 'trial_exhausted'
        ? quotaOutcome
        : 'quota_exceeded';
}

export function quotaRetryAfterSeconds(): number {
    return 3600; // Stunden-Fenster; das Monats-Fenster kommuniziert die API-Antwort nicht separat.
}

/**
 * Verbraucht eine Pro-Eskalation aus dem Monats-Budget des Users (SPEC.md §7)
 * bzw. aus dem viel kleineren Trial-Lifetime-Budget.
 * Wird max. einmal pro Job aufgerufen, unmittelbar vor dem ersten Pro-Call.
 * false = Budget erschöpft ODER nicht entitled — der Job degradiert dann auf
 * Flash-only (Graceful Degradation), er schlägt NIE deswegen fehl.
 */
export async function consumeProEscalationBudget(userId: string): Promise<boolean> {
    const entitlement = await resolveEntitlement(userId);
    if (!entitlement.entitled) {
        return false;
    }

    const { data: escalationAllowed, error: budgetError } = await supabase.rpc(
        'consume_pro_escalation_quota',
        {
            target_user_id: userId,
            monthly_max: entitlement.plan.proEscalationsPerMonth,
            trial_max: entitlement.plan.trialProEscalations,
        },
    );

    if (budgetError) {
        // Fail-closed: ohne funktionierendes Budget keine unkontrollierten Pro-Kosten.
        console.error('[Entitlements] Escalation-Budget-RPC fehlgeschlagen (fail-closed):', budgetError.message);
        return false;
    }

    return escalationAllowed === true;
}
