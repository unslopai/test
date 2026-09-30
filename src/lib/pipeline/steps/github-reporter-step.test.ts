/**
 * Unit Tests: GitHub-Reporter — REQUEST_CHANGES mit COMMENT-Fallback.
 *
 * Kern-Invariante: Der Gatekeeper-Block landet IMMER im PR. Lehnt GitHub
 * REQUEST_CHANGES ab, weil wir per OAuth als PR-Autor selbst posten (422),
 * wird derselbe Review als COMMENT wiederholt — inklusive Inline-Comments.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubApiError } from '@/lib/github';
import { githubReporterStep } from '@/lib/pipeline/steps/github-reporter-step';
import {
    buildCascadeState,
    buildPipelineContext,
    buildPullRequestFile,
    buildReviewIssue,
} from '@/lib/pipeline/testing/context-fixture';
import type { createPullRequestReview, postPRComment, updateCheckRun } from '@/lib/github';

// Die Mocks tragen die echten Signaturen — sonst wären mock.calls[n] leere
// Tupel und die Assertions auf Body/Event würden nicht typgeprüft.
const {
    createPullRequestReviewMock,
    fetchReviewCommentsMock,
    postPRCommentMock,
    updateCheckRunMock,
    commentMapUpsertMock,
} = vi.hoisted(() => ({
    createPullRequestReviewMock: vi.fn<typeof createPullRequestReview>(),
    fetchReviewCommentsMock: vi.fn<typeof import('@/lib/github').fetchReviewComments>(),
    postPRCommentMock: vi.fn<typeof postPRComment>(),
    updateCheckRunMock: vi.fn<typeof updateCheckRun>(),
    commentMapUpsertMock: vi.fn(),
}));

vi.mock('@/lib/github', async (importOriginal) => {
    const actualGithubModule = await importOriginal<typeof import('@/lib/github')>();
    return {
        ...actualGithubModule,
        createPullRequestReview: createPullRequestReviewMock,
        fetchReviewComments: fetchReviewCommentsMock,
        postPRComment: postPRCommentMock,
        updateCheckRun: updateCheckRunMock,
    };
});
// Comment-Map-Grenze (MCP_SPEC §4.3): from('finding_comments').upsert(rows, …)
vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({ upsert: commentMapUpsertMock }),
    },
}));

const POSTED_REVIEW_ID_UNDER_TEST = 4711;

function resetReporterMocks(): void {
    createPullRequestReviewMock.mockReset();
    createPullRequestReviewMock.mockResolvedValue(POSTED_REVIEW_ID_UNDER_TEST);
    fetchReviewCommentsMock.mockReset();
    fetchReviewCommentsMock.mockResolvedValue([]);
    postPRCommentMock.mockClear();
    updateCheckRunMock.mockReset();
    updateCheckRunMock.mockResolvedValue(undefined);
    commentMapUpsertMock.mockReset();
    commentMapUpsertMock.mockResolvedValue({ error: null });
}

/** Kontext mit genau einem verankerten Finding (Patch deckt Zeile 42 ab). */
function buildReportableContext() {
    const reviewedFile = buildPullRequestFile({
        patch: '@@ -40,3 +40,5 @@\n+const data = fetchData();',
    });
    return buildPipelineContext({
        issues: [buildReviewIssue({ line: 42, endLine: 42, confidence: 91 })],
        // Anker-Basis des Reporters ist prFiles (Prescan findet auch in
        // Dateien außerhalb des LLM-Reviews); reviewableFiles ⊆ prFiles.
        prFiles: [reviewedFile],
        reviewableFiles: [reviewedFile],
        reviewSummary: 'Generic naming detected.',
        githubToken: 'token-under-test',
        cascade: buildCascadeState({ integrityScore: 91, verdicts: [] }),
    });
}

function buildSelfAuthoredRejection(): GitHubApiError {
    return new GitHubApiError(
        422,
        '/repos/unslopai/test/pulls/13/reviews',
        '{"message":"Unprocessable Entity: Can not request changes on your own pull request"}',
    );
}

describe('githubReporterStep', () => {
    beforeEach(() => {
        resetReporterMocks();
    });

    it('posts findings as REQUEST_CHANGES when GitHub accepts it', async () => {
        await githubReporterStep.execute(buildReportableContext());

        expect(createPullRequestReviewMock).toHaveBeenCalledTimes(1);
        expect(createPullRequestReviewMock.mock.calls[0][6]).toBe('REQUEST_CHANGES');
    });

    it('falls back to COMMENT with an identical body when the PR is self-authored', async () => {
        createPullRequestReviewMock.mockRejectedValueOnce(buildSelfAuthoredRejection());

        await githubReporterStep.execute(buildReportableContext());

        expect(createPullRequestReviewMock).toHaveBeenCalledTimes(2);

        const [requestChangesCall, commentFallbackCall] = createPullRequestReviewMock.mock.calls;
        expect(requestChangesCall[6]).toBe('REQUEST_CHANGES');
        expect(commentFallbackCall[6]).toBe('COMMENT');

        // Body und Inline-Comments müssen identisch bleiben — der Kunde darf
        // durch den Fallback keine Findings verlieren.
        expect(commentFallbackCall[4]).toBe(requestChangesCall[4]);
        expect(commentFallbackCall[4]).toContain('Cognitive Integrity Score: 91/100');
        // Das Issue trägt keinen Verifikationsstatus (Fixture ohne Verdict) —
        // die Bilanz darf dann keine Blind-Verifikation behaupten (SPEC §6).
        expect(commentFallbackCall[4]).toContain('1 finding: 1 could not be independently verified');
        expect(commentFallbackCall[4]).not.toContain('Every finding survived');
        expect(commentFallbackCall[5]).toEqual(requestChangesCall[5]);
        expect(commentFallbackCall[5]).toHaveLength(1);
    });

    it('nennt die aus Zeitgründen übersprungenen Stufen statt des generischen Satzes (DEADLINE_GUARD_SPEC §3.4)', async () => {
        const timeSkippedContext = {
            ...buildReportableContext(),
            cascade: buildCascadeState({
                integrityScore: 91,
                degradations: ['time_budget_exhausted'],
                skippedStages: ['second_opinion', 'escalation'],
            }),
        };

        await githubReporterStep.execute(timeSkippedContext);

        const postedBody = String(createPullRequestReviewMock.mock.calls[0][4]);
        expect(postedBody).toContain('Reduced confidence: time budget exhausted — skipped: second opinion, escalation.');
        expect(postedBody).not.toContain('Reduced confidence mode');
    });

    it('nennt die Dateien eines gescheiterten Draft-Batches im Review-Body (draft_partial, LARGE_DIFF_RECALL_SPEC §9)', async () => {
        const partialDraftContext = {
            ...buildReportableContext(),
            cascade: buildCascadeState({
                integrityScore: null,
                degradations: ['draft_partial'],
                draftUnreviewedFiles: ['src/lib/alpha.ts', 'src/lib/__tests__/beta_helper.ts'],
            }),
        };

        await githubReporterStep.execute(partialDraftContext);

        const postedBody = String(createPullRequestReviewMock.mock.calls[0][4]);
        expect(postedBody).toContain('Cognitive Integrity Score: n/a');
        expect(postedBody).toContain(
            '⚠️ Reduced coverage: the AI review failed on 2 files — not reviewed: src/lib/alpha.ts, src/lib/__tests__/beta_helper.ts.',
        );
        expect(postedBody).not.toContain('Reduced confidence mode');
        // Beide Hinweise koexistieren, wenn Zeit-Skip UND halber Draft zusammenkommen.
        await githubReporterStep.execute({
            ...partialDraftContext,
            cascade: buildCascadeState({
                integrityScore: null,
                degradations: ['draft_partial', 'time_budget_exhausted'],
                skippedStages: ['verifier'],
                draftUnreviewedFiles: ['src/lib/alpha.ts'],
            }),
        });
        const combinedBody = String(createPullRequestReviewMock.mock.calls[1][4]);
        expect(combinedBody).toContain('Reduced confidence: time budget exhausted');
        expect(combinedBody).toContain('Reduced coverage: the AI review failed on 1 file — not reviewed: src/lib/alpha.ts.');
    });

    it('behauptet keine Eskalation, wenn nur die Second Opinion ein stärkeres Modell gerufen hat', async () => {
        const secondOpinionContext = {
            ...buildReportableContext(),
            cascade: buildCascadeState({ integrityScore: 95, escalated: true, escalationReason: 'second_opinion' }),
        };

        await githubReporterStep.execute(secondOpinionContext);

        const postedBody = String(createPullRequestReviewMock.mock.calls[0][4]);
        expect(postedBody).toContain('a stronger model re-reviewed under-reported files as a second opinion');
        expect(postedBody).not.toContain('low-confidence findings were escalated');
    });

    it('rethrows unrelated GitHub failures instead of masking them as a fallback', async () => {
        const permissionFailure = new GitHubApiError(
            403, '/repos/unslopai/test/pulls/13/reviews', '{"message":"Resource not accessible"}',
        );
        createPullRequestReviewMock.mockRejectedValueOnce(permissionFailure);

        await expect(githubReporterStep.execute(buildReportableContext()))
            .rejects.toThrow(permissionFailure);

        expect(createPullRequestReviewMock).toHaveBeenCalledTimes(1);
    });

    it('posts a clean-diff review as COMMENT without needing the fallback', async () => {
        const cleanContext = buildPipelineContext({
            reviewableFiles: [buildPullRequestFile()],
            cascade: buildCascadeState({ integrityScore: 100 }),
        });

        await githubReporterStep.execute(cleanContext);

        expect(createPullRequestReviewMock).toHaveBeenCalledTimes(1);
        expect(createPullRequestReviewMock.mock.calls[0][6]).toBe('COMMENT');
    });

    // Check Runs gehören dem Worker (nach der Persistenz), nicht dem Reporter:
    // der Reporter ist abschaltbar, und ein Fehler beim Check-Run-Abschluss darf
    // das bereits gepostete Review nicht mehr aus der DB kippen.
    it('never touches check runs — that is the worker\'s job', async () => {
        await githubReporterStep.execute(buildReportableContext());

        expect(updateCheckRunMock).not.toHaveBeenCalled();
    });
});

// =============================================================================
// App-Modus (Bot-Identität): Check Run trägt das Gating, nicht REQUEST_CHANGES
// =============================================================================

describe('githubReporterStep (GitHub App mode)', () => {
    beforeEach(() => {
        resetReporterMocks();
    });

    it('posts findings as COMMENT — REQUEST_CHANGES is never attempted as the bot', async () => {
        const appContext = buildPipelineContext({
            authMode: 'app',
            githubToken: 'installation-token-under-test',
            issues: [buildReviewIssue({ line: 42, endLine: 42 })],
            reviewableFiles: [buildPullRequestFile()],
            reviewSummary: 'Generic naming detected.',
            cascade: buildCascadeState({ integrityScore: 88 }),
        });

        await githubReporterStep.execute(appContext);

        expect(createPullRequestReviewMock).toHaveBeenCalledTimes(1);
        expect(createPullRequestReviewMock.mock.calls[0][6]).toBe('COMMENT');
    });
});

// =============================================================================
// Comment-Map-Persistenz (MCP_SPEC §4.3, Phase 3)
// =============================================================================

describe('githubReporterStep — finding_comments persistence', () => {
    beforeEach(() => {
        resetReporterMocks();
    });

    interface FindingCommentRow {
        job_id: string;
        finding_id: string;
        pr_number: number;
        github_comment_id: number | null;
    }

    function capturedCommentRows(): FindingCommentRow[] {
        return commentMapUpsertMock.mock.calls[0][0] as FindingCommentRow[];
    }

    it('embeds the finding marker, maps the posted comment id, and persists the row', async () => {
        await githubReporterStep.execute(buildReportableContext());

        const [postedInlineComment] = createPullRequestReviewMock.mock.calls[0][5];
        const markerMatch = /<!-- unslop-finding:([0-9a-f]{16}) -->/.exec(postedInlineComment.body);
        expect(markerMatch).not.toBeNull();
        const markedFindingId = markerMatch![1];

        // Der Nachschlag liefert den Comment samt Marker-Body zurück …
        fetchReviewCommentsMock.mockResolvedValue([{ id: 777001, body: postedInlineComment.body }]);
        commentMapUpsertMock.mockClear();
        await githubReporterStep.execute(buildReportableContext());

        // … und die Map trägt die GitHub-Comment-ID am richtigen Finding.
        expect(commentMapUpsertMock).toHaveBeenCalledTimes(1);
        expect(capturedCommentRows()).toEqual([{
            job_id: 'job-under-test',
            repository_id: 'repo-under-test',
            pr_number: 7,
            finding_id: markedFindingId,
            github_comment_id: 777001,
        }]);
    });

    it('persists out-of-hunk findings with a null github_comment_id (§4.3)', async () => {
        const contextWithUnanchoredIssue = buildPipelineContext({
            // prFiles ohne passenden Hunk ⇒ das Finding ist unverankert.
            issues: [buildReviewIssue({ line: 999, endLine: 999 })],
            prFiles: [buildPullRequestFile()],
            reviewableFiles: [buildPullRequestFile()],
            reviewSummary: 'Out-of-hunk finding.',
            githubToken: 'token-under-test',
        });

        await githubReporterStep.execute(contextWithUnanchoredIssue);

        expect(capturedCommentRows()).toHaveLength(1);
        expect(capturedCommentRows()[0].github_comment_id).toBeNull();
    });

    it('does not fail the job when the comment-map persistence errors (fail-soft)', async () => {
        commentMapUpsertMock.mockResolvedValue({ error: { message: 'permission denied' } });

        await expect(githubReporterStep.execute(buildReportableContext())).resolves.toBeDefined();
    });

    it('still persists rows (all null) when the review id is unreadable', async () => {
        createPullRequestReviewMock.mockResolvedValue(null);

        await githubReporterStep.execute(buildReportableContext());

        expect(fetchReviewCommentsMock).not.toHaveBeenCalled();
        expect(capturedCommentRows()[0].github_comment_id).toBeNull();
    });
});
