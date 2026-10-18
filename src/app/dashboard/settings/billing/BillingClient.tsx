'use client';

/**
 * Billing-UI: Status anzeigen, Trial starten (→ Stripe Checkout),
 * Abo verwalten (→ Stripe Billing Portal). Zero Payment-UI (SPEC S4).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface BillingStatus {
    readonly entitled: boolean;
    readonly status: string;
    readonly planName: string | null;
    readonly trialEndsAt: string | null;
    readonly currentPeriodEnd: string | null;
    readonly cancelAtPeriodEnd: boolean;
    readonly hasStripeCustomer: boolean;
    readonly usage: { readonly scansThisMonth: number; readonly scansPerMonth: number } | null;
}

export function BillingClient() {
    const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const fetchStatus = useCallback(async (abortSignal?: AbortSignal): Promise<BillingStatus> => {
        const response = await fetch('/api/billing/status', { signal: abortSignal });
        if (!response.ok) throw new Error('Could not load billing status.');
        return await response.json() as BillingStatus;
    }, []);

    useEffect(() => {
        const abortController = new AbortController();

        void fetchStatus(abortController.signal)
            .then((statusResponse) => setBillingStatus(statusResponse))
            .catch((fetchError: unknown) => {
                if (fetchError instanceof Error && fetchError.name === 'AbortError') return;
                setLoadError('Could not load billing status.');
            });

        return () => abortController.abort();
    }, [fetchStatus]);

    async function redirectTo(endpoint: '/api/billing/checkout' | '/api/billing/portal') {
        setIsRedirecting(true);
        try {
            const response = await fetch(endpoint, { method: 'POST' });
            if (!response.ok) {
                setLoadError('Could not open the billing page. Try again.');
                return;
            }
            const { url } = await response.json() as { url: string };
            window.location.assign(url);
        } finally {
            setIsRedirecting(false);
        }
    }

    return (
        <main className="min-h-screen bg-gray-950 text-white p-8">
            <div className="max-w-2xl mx-auto">
                <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">
                    ← Dashboard
                </Link>
                <h1 className="text-2xl font-bold mt-4 mb-2">Billing</h1>
                <p className="text-gray-400 mb-6 text-sm">
                    Scans require an active subscription or trial. Payment and invoices are handled by Stripe.
                </p>

                {loadError && <p className="text-red-400 mb-4">{loadError}</p>}

                {billingStatus && (
                    <div className="bg-gray-900 border border-gray-800 rounded p-5 mb-6">
                        <p className="text-sm text-gray-400">Current plan</p>
                        <p className="text-lg font-semibold mt-1">{describeStatus(billingStatus)}</p>

                        {billingStatus.usage && (
                            <p className="text-sm text-gray-400 mt-3">
                                {billingStatus.usage.scansThisMonth} / {billingStatus.usage.scansPerMonth} scans
                                used this month
                            </p>
                        )}

                        {billingStatus.entitled && billingStatus.cancelAtPeriodEnd && (
                            <p className="text-sm text-yellow-400 mt-3">
                                ⚠️ Cancellation scheduled — access ends {formatDate(billingStatus.trialEndsAt ?? billingStatus.currentPeriodEnd)}.
                                Use “Manage billing” to renew before then.
                            </p>
                        )}

                        <div className="mt-5 flex gap-3">
                            {!billingStatus.entitled && (
                                <button
                                    onClick={() => void redirectTo('/api/billing/checkout')}
                                    disabled={isRedirecting}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium"
                                >
                                    {billingStatus.hasStripeCustomer ? 'Resubscribe' : 'Start 14-day trial'}
                                </button>
                            )}
                            {billingStatus.hasStripeCustomer && (
                                <button
                                    onClick={() => void redirectTo('/api/billing/portal')}
                                    disabled={isRedirecting}
                                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium"
                                >
                                    Manage billing
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

function describeStatus(billingStatus: BillingStatus): string {
    switch (billingStatus.status) {
        case 'none':
            return 'No subscription — scans are paused';
        case 'trialing':
            return `${billingStatus.planName} — trial until ${formatDate(billingStatus.trialEndsAt)}`;
        case 'active':
            return `${billingStatus.planName} — active, renews ${formatDate(billingStatus.currentPeriodEnd)}`;
        case 'past_due':
            return 'Payment failed — scans are paused until the card is updated';
        case 'canceled':
            return 'Subscription ended — resubscribe to resume scans';
        case 'complimentary':
            return 'Complimentary access';
        default:
            return `${billingStatus.status} — scans are paused`;
    }
}

function formatDate(isoTimestamp: string | null): string {
    return isoTimestamp ? new Date(isoTimestamp).toLocaleDateString() : '—';
}
