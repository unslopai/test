/**
 * Typed error contract (MCP_SPEC.md §6, D12).
 *
 * Every failure returns a typed code, a single-sentence human instruction,
 * and an optional URL. Quota/entitlement/connection state rides in these
 * errors instead of a standalone status tool. The server's wire strings are
 * flat (`{ error: '<code>' }`); HTTP status alone cannot distinguish
 * payment_required from trial_exhausted (both 402), so the mapping switches
 * on the body string — normative per §6.
 */
import { ApiError, SecretUploadBlockedError } from '@unslop/shared/node';

export type UnslopErrorCode =
    | 'not_authenticated'
    | 'payment_required'
    | 'trial_exhausted'
    | 'quota_exceeded'
    | 'repository_not_connected'
    | 'github_app_required'
    // Phase-2-/Phase-3-Ergänzungen zum §6-Vokabular (in ROADMAP als Spec-Amendment notiert):
    | 'github_admin_required'
    | 'pr_not_found'
    | 'finding_not_found'
    | 'not_a_git_repo'
    | 'no_origin_remote'
    | 'no_merge_base'
    | 'secret_detected'
    | 'diff_too_large'
    | 'no_changes'
    | 'job_stalled'
    | 'model_unavailable'
    | 'upstream_unavailable';

export interface UnslopToolError {
    readonly code: UnslopErrorCode;
    /** Written for a human, relayed verbatim by the agent. */
    readonly message: string;
    readonly actionUrl?: string;
    readonly retryable: boolean;
}

/** Minimal structural tool-result shape — keeps tool modules SDK-agnostic (§3.2 seam). */
export interface McpToolResult {
    // Die Index-Signatur verlangt das CallToolResult des MCP SDK (Passthrough-Felder).
    [passthroughKey: string]: unknown;
    content: { type: 'text'; text: string }[];
    isError?: boolean;
}

export function toolErrorResult(toolError: UnslopToolError): McpToolResult {
    return {
        content: [{ type: 'text', text: JSON.stringify({ error: toolError }, null, 2) }],
        isError: true,
    };
}

export function localToolError(
    code: UnslopErrorCode,
    message: string,
    retryable = false,
): UnslopToolError {
    return { code, message, retryable };
}

/**
 * Terminal poll failure (`{status:'error', error:'<code>'}`) → typed tool
 * error. One mapping for unslop_scan and unslop_get_result. Both named codes
 * are transient server states an agent may retry; `model_unavailable` asks
 * for a pause first (Vertex capacity after the server's own retries).
 */
export function pollFailureToToolError(wireError: string | undefined): UnslopToolError {
    if (wireError === 'job_stalled') {
        return localToolError('job_stalled', 'The scan did not complete. Run `unslop_scan` again.', true);
    }
    if (wireError === 'model_unavailable') {
        return localToolError(
            'model_unavailable',
            'The AI model is temporarily out of capacity. Wait about a minute, then run `unslop_scan` again.',
            true,
        );
    }
    return localToolError('upstream_unavailable', `The scan failed on the server. (${wireError ?? 'unknown_error'})`, true);
}

const FALLBACK_RETRY_AFTER_SECONDS = 3600;

/** Basis-URLs, die in Fehlermeldungen verlinkt werden. */
interface ErrorLinkContext {
    readonly billingUrl: string;
    readonly dashboardUrl: string;
}

interface WireErrorRule {
    readonly httpStatus: number;
    /** undefined = matcht jeden Body-Code dieses Status (Wildcard, ans Ende der Status-Gruppe). */
    readonly wireCode?: string;
    readonly buildError: (links: ErrorLinkContext) => UnslopToolError;
}

/** §6-Mapping als Daten; find() nimmt den ERSTEN Treffer — Wildcards stehen hinter spezifischen Codes. */
const WIRE_ERROR_RULES: readonly WireErrorRule[] = [
    {
        httpStatus: 401,
        wireCode: 'github_token_missing',
        buildError: (links) => ({
            code: 'not_authenticated',
            message: 'unslop has no GitHub token for your account. Sign in to the unslop dashboard once to link GitHub.',
            actionUrl: links.dashboardUrl,
            retryable: false,
        }),
    },
    {
        httpStatus: 401,
        buildError: () => ({
            code: 'not_authenticated',
            message: 'unslop is not signed in. Run `unslop login` in a terminal.',
            retryable: false,
        }),
    },
    {
        httpStatus: 402,
        wireCode: 'trial_quota_exhausted',
        buildError: (links) => ({
            code: 'trial_exhausted',
            message: `The unslop trial scan allowance is used up. Upgrade at ${links.billingUrl}`,
            actionUrl: links.billingUrl,
            retryable: false,
        }),
    },
    {
        httpStatus: 402,
        buildError: (links) => ({
            code: 'payment_required',
            message: `unslop has no active subscription. Start one at ${links.billingUrl}`,
            actionUrl: links.billingUrl,
            retryable: false,
        }),
    },
    {
        httpStatus: 403,
        wireCode: 'admin_permission_required',
        buildError: () => ({
            code: 'github_admin_required',
            message: 'You need GitHub admin permission on this repository to connect it.',
            retryable: false,
        }),
    },
    {
        httpStatus: 404,
        wireCode: 'repository_not_connected',
        buildError: () => ({
            code: 'repository_not_connected',
            message: 'This repository is not connected to unslop. Call `unslop_connect_repo` first.',
            retryable: false,
        }),
    },
    {
        httpStatus: 404,
        wireCode: 'repo_not_found_on_github',
        buildError: () => ({
            code: 'repository_not_connected',
            message: 'GitHub does not report this repository for your account, so unslop cannot connect it.',
            retryable: false,
        }),
    },
    {
        httpStatus: 404,
        wireCode: 'pr_not_found',
        buildError: () => ({
            code: 'pr_not_found',
            message: 'This pull request was not found on GitHub. Check the PR number.',
            retryable: false,
        }),
    },
    {
        httpStatus: 404,
        wireCode: 'finding_not_found',
        buildError: () => ({
            code: 'finding_not_found',
            message: 'No recent unslop finding matches this id for this repository. Use an id from a current scan or PR review.',
            retryable: false,
        }),
    },
    {
        httpStatus: 409,
        wireCode: 'github_app_required',
        buildError: () => ({
            code: 'github_app_required',
            message: 'This repository uses the legacy OAuth connection. Install the unslop GitHub App to review PRs from here.',
            retryable: false,
        }),
    },
    {
        httpStatus: 409,
        wireCode: 'repo_limit_reached',
        buildError: (links) => ({
            code: 'payment_required',
            message: `Your plan's active-repository limit is reached. Disconnect a repository or upgrade at ${links.billingUrl}`,
            actionUrl: links.billingUrl,
            retryable: false,
        }),
    },
    {
        httpStatus: 422,
        wireCode: 'diff_too_large',
        buildError: () => ({
            code: 'diff_too_large',
            message: 'The diff is larger than the 300 KB limit. Narrow the scan with `paths`.',
            retryable: false,
        }),
    },
];

/**
 * Maps a wire failure (ApiError from @unslop/shared/node) onto the §6 codes.
 * Unknown wire codes degrade to upstream_unavailable carrying the raw code —
 * honest, and the only §6 code that fits "the server said something new".
 */
export function mapApiError(apiFailure: unknown, baseUrl: string): UnslopToolError {
    // Netzwerkgrenzen-Refusal aus submitScan (ROADMAP §13). Die Message ist
    // material-frei (nur Ort + Musterklasse) und darf verbatim durchgereicht
    // werden. Nicht retryable: derselbe Payload wird wieder blocken.
    if (apiFailure instanceof SecretUploadBlockedError) {
        return { code: 'secret_detected', message: apiFailure.message, retryable: false };
    }
    if (!(apiFailure instanceof ApiError)) {
        return {
            code: 'upstream_unavailable',
            message: `unslop is unreachable right now. (${(apiFailure as Error).message})`,
            retryable: true,
        };
    }

    const wireCode = apiFailure.message;

    if (apiFailure.httpStatus === 429) {
        const retryAfterSeconds = apiFailure.retryAfterSeconds ?? FALLBACK_RETRY_AFTER_SECONDS;
        const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
        return {
            code: 'quota_exceeded',
            message: `Scan quota reached. It resets in ${retryAfterMinutes} minutes.`,
            retryable: true,
        };
    }

    const matchedRule = WIRE_ERROR_RULES.find((wireErrorRule) =>
        wireErrorRule.httpStatus === apiFailure.httpStatus
        && (wireErrorRule.wireCode === undefined || wireErrorRule.wireCode === wireCode));

    if (matchedRule) {
        return matchedRule.buildError({
            billingUrl: `${baseUrl}/dashboard/settings/billing`,
            dashboardUrl: `${baseUrl}/dashboard`,
        });
    }

    return {
        code: 'upstream_unavailable',
        message: `unslop is unreachable right now. (${wireCode})`,
        retryable: apiFailure.httpStatus === null || apiFailure.httpStatus >= 500,
    };
}
