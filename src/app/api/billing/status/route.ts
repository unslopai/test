/**
 * GET /api/billing/status — Abo-Status für die Billing-UI (SPEC §7.3).
 * Liest ausschließlich den lokalen Mirror — nie die Stripe-API.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { resolvePlanEntitlements } from '@/lib/billing/plan-config';

export async function GET() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { data: billingRow } = await supabaseAdmin
        .from('billing_customers')
        .select('status, price_id, trial_ends_at, current_period_end, cancel_at_period_end, month_request_count, stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (!billingRow) {
        return NextResponse.json({
            entitled: false,
            status: 'none',
            planName: null,
            hasStripeCustomer: false,
        });
    }

    const plan = resolvePlanEntitlements(billingRow.price_id);
    const entitled = ['trialing', 'active', 'complimentary'].includes(billingRow.status) && plan !== null;

    return NextResponse.json({
        entitled,
        status: billingRow.status,
        planName: plan?.displayName ?? null,
        trialEndsAt: billingRow.trial_ends_at,
        currentPeriodEnd: billingRow.current_period_end,
        cancelAtPeriodEnd: billingRow.cancel_at_period_end === true,
        hasStripeCustomer: billingRow.stripe_customer_id !== null,
        usage: plan
            ? { scansThisMonth: billingRow.month_request_count, scansPerMonth: plan.scansPerMonth }
            : null,
    });
}
