/**
 * unslop_resolve_finding-Tests (MCP_SPEC.md §3.5, Phase 3): Ledger-Ergebnis
 * mit ehrlichem githubResolved, HEAD-SHA-Weitergabe, finding_not_found-Mapping,
 * Identity-Failure.
 */
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@unslop/shared/node';
import { runResolveFindingTool } from './resolve-finding.js';
import type { ToolDeps } from '../tool-deps.js';

const FINDING_ID_UNDER_TEST = 'a1b2c3d4e5f60718';
const VALID_RATIONALE = 'The cast is validated one call upstream by the zod schema boundary.';
const HEAD_SHA_UNDER_TEST = 'b'.repeat(40);

function buildDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
    return {
        api: {
            submitScan: vi.fn(),
            fetchScanStatus: vi.fn(),
            connectRepo: vi.fn(),
            fetchRepoStatus: vi.fn(),
            submitPrReview: vi.fn(),
            resolveFinding: vi.fn().mockResolvedValue({
                ledgerId: 'ledger-row-under-test',
                githubResolved: true,
            }),
        },
        resolveRepoContext: vi.fn() as unknown as ToolDeps['resolveRepoContext'],
        resolveRepoIdentity: () => ({
            ok: true,
            gitRoot: 'C:/fixtures/widgets',
            repoFullName: 'acme/widgets',
            headSha: HEAD_SHA_UNDER_TEST,
        }),
        buildDiff: vi.fn() as unknown as ToolDeps['buildDiff'],
        buildContextPackage: vi.fn().mockResolvedValue(null),
        baseUrl: 'https://unslop.codes',
        rerollLimit: 3,
        waitMs: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function parseResultBody(toolResultText: string): Record<string, unknown> {
    return JSON.parse(toolResultText) as Record<string, unknown>;
}

describe('unslop_resolve_finding', () => {
    it('submits the dismissal with the local HEAD sha and reports the ledger id', async () => {
        const deps = buildDeps();

        const toolResult = await runResolveFindingTool(deps, {
            findingId: FINDING_ID_UNDER_TEST,
            rationale: VALID_RATIONALE,
            prNumber: 14,
        });

        expect(toolResult.isError).toBeUndefined();
        const resolutionOutcome = parseResultBody(toolResult.content[0].text);
        expect(resolutionOutcome.ledgerId).toBe('ledger-row-under-test');
        expect(resolutionOutcome.githubResolved).toBe(true);
        expect(resolutionOutcome.note).toContain('permanently recorded');
        expect(deps.api.resolveFinding).toHaveBeenCalledWith({
            repoFullName: 'acme/widgets',
            findingId: FINDING_ID_UNDER_TEST,
            rationale: VALID_RATIONALE,
            prNumber: 14,
            commitSha: HEAD_SHA_UNDER_TEST,
        });
    });

    it('passes the honest skip reason through for out-of-hunk findings', async () => {
        const deps = buildDeps();
        const depsWithSkip = {
            ...deps,
            api: {
                ...deps.api,
                resolveFinding: vi.fn().mockResolvedValue({
                    ledgerId: 'ledger-row-under-test',
                    githubResolved: false,
                    githubSkippedReason: 'no_inline_comment',
                }),
            },
        };

        const toolResult = await runResolveFindingTool(depsWithSkip, {
            findingId: FINDING_ID_UNDER_TEST,
            rationale: VALID_RATIONALE,
            prNumber: 14,
        });

        const resolutionOutcome = parseResultBody(toolResult.content[0].text);
        expect(resolutionOutcome.githubResolved).toBe(false);
        expect(resolutionOutcome.githubSkippedReason).toBe('no_inline_comment');
    });

    it('omits commitSha when the repository has no resolvable HEAD', async () => {
        const deps = buildDeps({
            resolveRepoIdentity: () => ({
                ok: true,
                gitRoot: 'C:/fixtures/widgets',
                repoFullName: 'acme/widgets',
                headSha: null,
            }),
        });

        await runResolveFindingTool(deps, {
            findingId: FINDING_ID_UNDER_TEST,
            rationale: VALID_RATIONALE,
        });

        expect(deps.api.resolveFinding).toHaveBeenCalledWith({
            repoFullName: 'acme/widgets',
            findingId: FINDING_ID_UNDER_TEST,
            rationale: VALID_RATIONALE,
        });
    });

    it('maps 404 finding_not_found onto the dedicated typed error', async () => {
        const deps = buildDeps();
        const depsWithUnknownFinding = {
            ...deps,
            api: {
                ...deps.api,
                resolveFinding: vi.fn().mockRejectedValue(new ApiError('finding_not_found', 404)),
            },
        };

        const toolResult = await runResolveFindingTool(depsWithUnknownFinding, {
            findingId: FINDING_ID_UNDER_TEST,
            rationale: VALID_RATIONALE,
        });

        expect(toolResult.isError).toBe(true);
        const errorBody = parseResultBody(toolResult.content[0].text) as { error?: { code: string } };
        expect(errorBody.error?.code).toBe('finding_not_found');
    });

    it('maps an identity failure onto the typed error contract', async () => {
        const deps = buildDeps({
            resolveRepoIdentity: () => ({ ok: false, failureKind: 'not_a_git_repo', detail: 'not a repo' }),
        });

        const toolResult = await runResolveFindingTool(deps, {
            findingId: FINDING_ID_UNDER_TEST,
            rationale: VALID_RATIONALE,
        });

        const errorBody = parseResultBody(toolResult.content[0].text) as { error?: { code: string } };
        expect(errorBody.error?.code).toBe('not_a_git_repo');
    });
});
