/**
 * POST /api/stripe/webhook — Stripe-Events → billing_customers-Mirror (SPEC §7.4).
 *
 * Design: Der Checkout setzt subscription_data.metadata.user_id, dadurch trägt
 * JEDES customer.subscription.*-Event die User-Zuordnung in sich. Der Handler
 * upsertet per user_id — keine Stripe-API-Calls, keine Event-Reihenfolge-Races,
 * idempotent bei Replays (Upsert mit identischen Werten).
 *
 * Signatur-Verifikation über den Raw-Body ist PFLICHT — unverifizierte
 * Payloads werden nie gelesen.
 */
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeClient } from '@/lib/billing/stripe';
import { supabase } from '@/lib/supabase';

const SUBSCRIPTION_EVENT_TYPES = new Set([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
]);

export async function POST(request: Request) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('[StripeWebhook] STRIPE_WEBHOOK_SECRET fehlt — Event abgelehnt.');
        return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 });
    }

    const rawBody = await request.text();
    const signatureHeader = request.headers.get('stripe-signature') ?? '';

    let stripeEvent: Stripe.Event;
    try {
        stripeEvent = getStripeClient().webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
    } catch (verificationError: unknown) {
        console.warn('[StripeWebhook] Ungültige Signatur:', (verificationError as Error).message);
        return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
    }

    if (SUBSCRIPTION_EVENT_TYPES.has(stripeEvent.type)) {
        const subscription = stripeEvent.data.object as Stripe.Subscription;
        await upsertFromSubscription(subscription, stripeEvent.type);
    } else if (stripeEvent.type === 'checkout.session.completed') {
        // Zuordnung läuft über subscription.metadata.user_id — hier nur Protokoll.
        const checkoutSession = stripeEvent.data.object as Stripe.Checkout.Session;
        console.log(
            `[StripeWebhook] Checkout abgeschlossen: user=${checkoutSession.client_reference_id} ` +
            `customer=${checkoutSession.customer}`,
        );
    } else {
        console.log(`[StripeWebhook] Ignoriertes Event: ${stripeEvent.type}`);
    }

    return NextResponse.json({ received: true });
}

// =============================================================================
// Subscription → Mirror
// =============================================================================

async function upsertFromSubscription(
    subscription: Stripe.Subscription,
    eventType: string,
): Promise<void> {
    const userId = subscription.metadata?.user_id;
    if (!userId) {
        // Ack (200), sonst retried Stripe ein Event, das nie verarbeitbar wird.
        console.error(
            `[StripeWebhook] ${eventType} ohne metadata.user_id (sub=${subscription.id}) — ignoriert. ` +
            'Checkout-Sessions MÜSSEN subscription_data.metadata.user_id setzen.',
        );
        return;
    }

    const mirroredStatus = eventType === 'customer.subscription.deleted' ? 'canceled' : subscription.status;
    const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
    const currentPeriodEnd = subscription.items?.data?.[0]?.current_period_end ?? null;

    const { error: upsertError } = await supabase
        .from('billing_customers')
        .upsert(
            {
                user_id: userId,
                stripe_customer_id: typeof subscription.customer === 'string'
                    ? subscription.customer
                    : subscription.customer?.id ?? null,
                stripe_subscription_id: subscription.id,
                price_id: priceId,
                status: mirroredStatus,
                trial_ends_at: toIsoTimestamp(subscription.trial_end),
                current_period_end: toIsoTimestamp(currentPeriodEnd),
                cancel_at_period_end: subscription.cancel_at_period_end === true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
        );

    if (upsertError) {
        // 500 => Stripe retried das Event automatisch — gewollt bei DB-Hickups.
        console.error('[StripeWebhook] Mirror-Upsert fehlgeschlagen:', upsertError.message);
        throw new Error(`billing_customers upsert failed: ${upsertError.message}`);
    }

    console.log(`[StripeWebhook] ${eventType}: user=${userId} status=${mirroredStatus} price=${priceId}`);
}

function toIsoTimestamp(unixSeconds: number | null | undefined): string | null {
    return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}
