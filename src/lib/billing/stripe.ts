/**
 * Stripe-Client-Factory (Server-only).
 * Keine explizite apiVersion: das SDK pinnt die zu seinen Types passende
 * Version selbst — ein manueller String kann nur davon abweichen.
 */
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
    if (!stripeClient) {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            throw new Error('STRIPE_SECRET_KEY ist nicht konfiguriert.');
        }
        stripeClient = new Stripe(secretKey);
    }
    return stripeClient;
}
