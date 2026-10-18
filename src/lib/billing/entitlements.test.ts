/**
 * Unit Tests: Trial-Schranke im Entitlement-Layer.
 *
 * Kern-Invarianten:
 *  - Jeder Quota-Aufruf reicht das Trial-Limit an die RPC durch. Fehlt es,
 *    verbrennt ein Trial-Nutzer das volle Bezahl-Kontingent und kündigt.
 *  - Ein erschöpftes Trial ist von einem Rate-Limit unterscheidbar (Paywall
 *    statt "kommt gleich wieder").
 *  - Fail-closed: RPC-Fehler blockieren, sie erlauben nie.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    consumeProEscalationBudget,
    consumeScanQuota,
    resolveEntitlement,
} from '@/lib/billing/entitlements';

const { rpcMock, maybeSingleMock } = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    maybeSingleMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
    supabase: {
        rpc: rpcMock,
        from: () => ({
            select: () => ({
                eq: () => ({ maybeSingle: maybeSingleMock }),
            }),
        }),
    },
}));

const PRO_PLAN = {
    displayName: 'Pro',
    scansPerHour: 60,
    scansPerMonth: 500,
    maxActiveRepos: 10,
    maxApiKeys: 10,
    proEscalationsPerMonth: 50,
    trialScans: 100,
    trialProEscalations: 5,
};

/** Simuliert den Members-Join: eine Membership mit genestetem Account (§5.1). */
function mockBillingAccount(status: string): void {
    maybeSingleMock.mockResolvedValue({
        data: { billing_accounts: { status, paddle_price_id: 'comp' } },
        error: null,
    });
}

describe('consumeScanQuota', () => {
    beforeEach(() => {
        rpcMock.mockReset();
    });

    it('grants webhook scans the FULL window limits (the reserved lane, D10)', async () => {
        rpcMock.mockResolvedValue({ data: 'allowed', error: null });

        const quotaOutcome = await consumeScanQuota('user-under-test', PRO_PLAN, 'webhook');

        expect(quotaOutcome).toBe('allowed');
        expect(rpcMock).toHaveBeenCalledWith('consume_scan_quota', {
            target_user_id: 'user-under-test',
            hourly_max: 60,
            monthly_max: 500,
            trial_max: 100,
        });
    });

    // MCP_SPEC.md §10: DER Kern-Test der Reservierung. Bei Stunden-Stand 48
    // ist die CLI/MCP-Lane (Limit 48) erschöpft, während ein Webhook-Review
    // (Limit 60) noch durchgeht — der Agent kann das PR-Gate nicht brechen.
    it.each(['cli', 'mcp'] as const)(
        'reduces the window limits by the 20%% webhook reserve for source %s',
        async (nonWebhookSource) => {
            rpcMock.mockResolvedValue({ data: 'allowed', error: null });

            await consumeScanQuota('user-under-test', PRO_PLAN, nonWebhookSource);

            expect(rpcMock).toHaveBeenCalledWith('consume_scan_quota', {
                target_user_id: 'user-under-test',
                hourly_max: 48,
                monthly_max: 400,
                trial_max: 100,
            });
        },
    );

    it('never reduces the trial lifetime cap — it is an allowance, not a window', async () => {
        rpcMock.mockResolvedValue({ data: 'allowed', error: null });

        await consumeScanQuota('user-under-test', PRO_PLAN, 'mcp');

        const [, rpcParams] = rpcMock.mock.calls[0] as [string, Record<string, number>];
        expect(rpcParams.trial_max).toBe(100);
    });

    it('surfaces an exhausted trial as its own outcome, not as a rate limit', async () => {
        rpcMock.mockResolvedValue({ data: 'trial_exhausted', error: null });

        expect(await consumeScanQuota('user-under-test', PRO_PLAN, 'cli')).toBe('trial_exhausted');
    });

    it('maps a spent window quota to quota_exceeded', async () => {
        rpcMock.mockResolvedValue({ data: 'quota_exceeded', error: null });

        expect(await consumeScanQuota('user-under-test', PRO_PLAN, 'cli')).toBe('quota_exceeded');
    });

    it('blocks fail-closed when the RPC errors', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

        expect(await consumeScanQuota('user-under-test', PRO_PLAN, 'cli')).toBe('quota_exceeded');
    });

    it('blocks fail-closed on an unknown RPC answer', async () => {
        rpcMock.mockResolvedValue({ data: 'something_new', error: null });

        expect(await consumeScanQuota('user-under-test', PRO_PLAN, 'cli')).toBe('quota_exceeded');
    });
});

describe('consumeProEscalationBudget', () => {
    beforeEach(() => {
        rpcMock.mockReset();
        maybeSingleMock.mockReset();
    });

    it('passes the trial escalation cap for a trialing customer', async () => {
        mockBillingAccount('trialing');
        rpcMock.mockResolvedValue({ data: true, error: null });

        const budgetGranted = await consumeProEscalationBudget('user-under-test');

        expect(budgetGranted).toBe(true);
        expect(rpcMock).toHaveBeenCalledWith('consume_pro_escalation_quota', {
            target_user_id: 'user-under-test',
            monthly_max: 50,
            trial_max: 5,
        });
    });

    it('denies the budget when the trial escalation cap is spent', async () => {
        mockBillingAccount('trialing');
        rpcMock.mockResolvedValue({ data: false, error: null });

        expect(await consumeProEscalationBudget('user-under-test')).toBe(false);
    });

    it('never calls the RPC for a customer without an entitlement', async () => {
        maybeSingleMock.mockResolvedValue({ data: null, error: null });

        expect(await consumeProEscalationBudget('user-under-test')).toBe(false);
        expect(rpcMock).not.toHaveBeenCalled();
    });
});

describe('resolveEntitlement', () => {
    beforeEach(() => {
        maybeSingleMock.mockReset();
    });

    it('flags a trialing customer as trial', async () => {
        mockBillingAccount('trialing');

        const entitlement = await resolveEntitlement('user-under-test');

        expect(entitlement.entitled).toBe(true);
        expect(entitlement.entitled && entitlement.isTrial).toBe(true);
    });

    it('does not flag an active customer as trial', async () => {
        mockBillingAccount('active');

        const entitlement = await resolveEntitlement('user-under-test');

        expect(entitlement.entitled && entitlement.isTrial).toBe(false);
    });

    it('refuses a canceled customer', async () => {
        mockBillingAccount('canceled');

        const entitlement = await resolveEntitlement('user-under-test');

        expect(entitlement.entitled).toBe(false);
    });

    it("treats a never-subscribed account (status 'none') as no subscription", async () => {
        mockBillingAccount('none');

        const entitlement = await resolveEntitlement('user-under-test');

        expect(entitlement.entitled).toBe(false);
        expect(!entitlement.entitled && entitlement.reason).toBe('no_subscription');
    });

    it("refuses a paused subscription as inactive", async () => {
        mockBillingAccount('paused');

        const entitlement = await resolveEntitlement('user-under-test');

        expect(entitlement.entitled).toBe(false);
        expect(!entitlement.entitled && entitlement.reason).toBe('subscription_inactive');
    });
});
