/**
 * POST /api/billing/portal — erstellt eine Billing-Portal-Session (SPEC §7.2).
 * Karten-Update, Kündigung und Rechnungs-PDFs laufen komplett bei Stripe.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { getStripeClient } from '@/lib/billing/stripe';

export async function POST() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { data: billingRow } = await supabaseAdmin
        .from('billing_customers')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (!billingRow?.stripe_customer_id) {
        return NextResponse.json({ error: 'no_stripe_customer' }, { status: 404 });
    }

    try {
        const portalSession = await getStripeClient().billingPortal.sessions.create({
            customer: billingRow.stripe_customer_id,
            return_url: `${process.env.APP_BASE_URL}/dashboard/settings/billing`,
        });
        return NextResponse.json({ url: portalSession.url });
    } catch (stripeError: unknown) {
        console.error('[BillingPortal] Session-Erstellung fehlgeschlagen:', (stripeError as Error).message);
        return NextResponse.json({ error: 'portal_failed' }, { status: 502 });
    }
}
