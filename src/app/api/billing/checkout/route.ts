/**
 * POST /api/billing/checkout — erstellt eine Stripe-Checkout-Session (SPEC §7.1).
 *
 * Trial nur beim allerersten Abo (S2: Karte upfront, kein zweiter Trial).
 * subscription_data.metadata.user_id macht jedes Subscription-Webhook-Event
 * selbstbeschreibend (Webhook-Handler braucht keine Stripe-API-Calls).
 * KEIN payment_method_types — Stripe wählt Zahlungsmethoden dynamisch.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { getStripeClient } from '@/lib/billing/stripe';

const TRIAL_PERIOD_DAYS = 14;

export async function POST() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const proPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
    const appBaseUrl = process.env.APP_BASE_URL;
    if (!proPriceId || !appBaseUrl) {
        console.error('[BillingCheckout] STRIPE_PRICE_PRO_MONTHLY oder APP_BASE_URL fehlt.');
        return NextResponse.json({ error: 'billing_not_configured' }, { status: 500 });
    }

    const { data: billingRow } = await supabaseAdmin
        .from('billing_customers')
        .select('stripe_customer_id, stripe_subscription_id, status')
        .eq('user_id', user.id)
        .maybeSingle();

    if (billingRow && ['trialing', 'active', 'complimentary'].includes(billingRow.status)) {
        return NextResponse.json({ error: 'already_subscribed' }, { status: 409 });
    }

    // Trial nur, wenn der User noch NIE ein Abo hatte (S2).
    const isFirstSubscription = !billingRow?.stripe_subscription_id;

    try {
        const checkoutSession = await getStripeClient().checkout.sessions.create({
            mode: 'subscription',
            line_items: [{ price: proPriceId, quantity: 1 }],
            client_reference_id: user.id,
            ...(billingRow?.stripe_customer_id
                ? {
                    customer: billingRow.stripe_customer_id,
                    // Pflicht bei Bestandskunden mit automatic_tax/tax_id_collection:
                    // die im Checkout eingegebene Adresse/Name am Customer speichern.
                    customer_update: { address: 'auto' as const, name: 'auto' as const },
                }
                : { customer_email: user.email }),
            subscription_data: {
                metadata: { user_id: user.id },
                ...(isFirstSubscription ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
            },
            payment_method_collection: 'always',
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            billing_address_collection: 'required',
            success_url: `${appBaseUrl}/dashboard/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appBaseUrl}/dashboard/settings/billing?checkout=cancelled`,
        });

        return NextResponse.json({ url: checkoutSession.url });
    } catch (stripeError: unknown) {
        console.error('[BillingCheckout] Session-Erstellung fehlgeschlagen:', (stripeError as Error).message);
        return NextResponse.json({ error: 'checkout_failed' }, { status: 502 });
    }
}
