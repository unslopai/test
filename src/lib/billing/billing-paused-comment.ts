/**
 * Gate-Kommentare für das GitHub-Webhook-Gate (STRIPE_SPEC S10).
 *
 * Wird gepostet, wenn ein PR-Review übersprungen wird (keine Subscription
 * oder Quota erschöpft) — genau EINMAL pro PR und Grund (Marker-Dedupe über
 * die Kommentar-Liste). Fehler beim Posten sind nie fatal: das Gate hat den
 * LLM-Call bereits verhindert; der Kommentar ist nur Kommunikation.
 */
import { listPRComments, postPRComment } from '@/lib/github';
import { resolveGithubToken } from '@/lib/worker';

const PAUSED_MARKER = '<!-- unslop-billing-paused -->';
const QUOTA_MARKER = '<!-- unslop-quota-exceeded -->';

export async function postBillingPausedCommentOnce(
    repoOwnerUserId: string,
    repoFullName: string,
    prNumber: number,
): Promise<void> {
    const billingUrl = `${process.env.APP_BASE_URL ?? ''}/dashboard/settings/billing`;
    await postGateCommentOnce(repoOwnerUserId, repoFullName, prNumber, PAUSED_MARKER,
        `${PAUSED_MARKER}\n⚠️ **Anti-Slop Gatekeeper is paused** — the repository owner has no active ` +
        `subscription or trial, so this pull request was not reviewed.\n\n` +
        `Resume reviews at ${billingUrl}.`);
}

export async function postQuotaExceededCommentOnce(
    repoOwnerUserId: string,
    repoFullName: string,
    prNumber: number,
): Promise<void> {
    await postGateCommentOnce(repoOwnerUserId, repoFullName, prNumber, QUOTA_MARKER,
        `${QUOTA_MARKER}\n⚠️ **Anti-Slop Gatekeeper: scan quota exhausted** — this pull request was not ` +
        `reviewed because the plan's scan quota (hourly or monthly) is used up. ` +
        `Reviews resume automatically when the quota window resets.`);
}

async function postGateCommentOnce(
    repoOwnerUserId: string,
    repoFullName: string,
    prNumber: number,
    dedupeMarker: string,
    commentBody: string,
): Promise<void> {
    try {
        const githubToken = await resolveGithubToken(repoOwnerUserId);

        const existingComments = await listPRComments(githubToken, repoFullName, prNumber);
        if (existingComments.some((comment) => comment.body.includes(dedupeMarker))) {
            console.log(`[BillingGate] Kommentar (${dedupeMarker}) existiert bereits auf ${repoFullName}#${prNumber}.`);
            return;
        }

        await postPRComment(githubToken, repoFullName, prNumber, commentBody);
        console.log(`[BillingGate] Kommentar (${dedupeMarker}) gepostet auf ${repoFullName}#${prNumber}.`);
    } catch (commentError: unknown) {
        console.error(
            `[BillingGate] Gate-Kommentar fehlgeschlagen (${repoFullName}#${prNumber}):`,
            (commentError as Error).message,
        );
    }
}
