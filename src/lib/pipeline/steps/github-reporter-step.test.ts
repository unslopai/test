/**
 * Unit Tests: GitHub-Reporter — REQUEST_CHANGES mit COMMENT-Fallback.
 *
 * Kern-Invariante: Der Gatekeeper-Block landet IMMER im PR. Lehnt GitHub
 * REQUEST_CHANGES ab, weil wir per OAuth als PR-Autor selbst posten (422),
 * wird derselbe Review als COMMENT wiederholt — inklusive Inline-Comments.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    formatDeterministicOnlyNotice,
    formatPrescanUnavailableNotice,
    formatRepoContextNotice,
    formatReportIncompleteNotice,
    listDegradationNotices,
} from '@unslop/shared/degradation-notice';
import { GitHubApiError } from '@/lib/github';
import { githubReporterStep } from '@/lib/pipeline/steps/github-reporter-step';
import {
    buildCascadeState,
    buildPipelineContext,
    buildPrescanStats,
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

    it('nennt eine übersprungene zweite Draft-Runde mit eigenem Satz statt des generischen (SPEC.md §12.5.2)', async () => {
        await githubReporterStep.execute({
            ...buildReportableContext(),
            cascade: buildCascadeState({ integrityScore: 93, degradations: ['draft_round2_skipped_deadline'] }),
        });

        const postedBody = String(createPullRequestReviewMock.mock.calls[0][4]);
        expect(postedBody).toContain('Reduced coverage: the second review pass was skipped for part of this change');
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

    it('nennt den Grund eines zurückgehaltenen Drafts im selben Satz (unslopai/test#50)', async () => {
        await githubReporterStep.execute({
            ...buildReportableContext(),
            cascade: buildCascadeState({
                integrityScore: null,
                degradations: ['draft_partial'],
                draftUnreviewedFiles: ['scripts/diagnostics/collect-dump.ps1'],
                draftFailureReason: 'content_filter',
            }),
        });

        expect(String(createPullRequestReviewMock.mock.calls[0][4])).toContain(
            "⚠️ Reduced coverage: the AI review failed on 1 file because the model provider's content filter "
            + 'withheld the answer — not reviewed: scripts/diagnostics/collect-dump.ps1.',
        );
    });

    it('reiht die Hinweise wie listDegradationNotices (CLI, MCP, Extension), Pre-Scan direkt nach dem halben Draft', async () => {
        const reportableContext = buildReportableContext();
        await githubReporterStep.execute({
            ...reportableContext,
            cascade: buildCascadeState({
                integrityScore: null,
                // report_incomplete entsteht erst NACH dem Post dieses Textes und steht deshalb nur auf Check und Ergebnis.
                degradations: [
                    'draft_partial', 'time_budget_exhausted', 'repo_context_unavailable', 'draft_round2_failed', 'deep_lane_failed',
                    'report_incomplete',
                ],
                skippedStages: ['verifier'],
                draftUnreviewedFiles: ['src/lib/alpha.ts'],
            }),
            prescanStats: buildPrescanStats({ degraded: true, unscannedFiles: ['infra/main.tf'] }),
            repoContext: { ...reportableContext.repoContext, status: 'unavailable' },
            deepLane: { ...reportableContext.deepLane, status: 'degraded', degradations: ['deep_lane_failed'], unreviewedFiles: ['src/lib/gamma.ts'] },
        });

        const sharedNotices = listDegradationNotices({
            skippedStages: ['verifier'],
            draftUnreviewedFiles: ['src/lib/alpha.ts'],
            prescan: { degraded: true, unscannedFiles: ['infra/main.tf'] },
            repoContext: { status: 'unavailable', paths: [], estimatedTokens: 0, omittedPaths: [] },
            degradations: ['draft_round2_failed'],
            deepLane: { status: 'degraded', degradations: ['deep_lane_failed'], unreviewedFiles: ['src/lib/gamma.ts'] },
        });
        const postedBody = String(createPullRequestReviewMock.mock.calls[0][4]);
        const noticePositions = sharedNotices.map((sharedNotice) => postedBody.indexOf(sharedNotice));

        expect(sharedNotices).toHaveLength(6);
        expect(noticePositions).not.toContain(-1);
        expect(noticePositions).toEqual([...noticePositions].sort((left, right) => left - right));
        expect(postedBody).not.toContain(formatReportIncompleteNotice(['report_incomplete']));
    });

    it('stellt den generischen Satz zwischen Pre-Scan und Repo-Kontext (SPEC.md §8, Notice order)', async () => {
        const reportableContext = buildReportableContext();
        await githubReporterStep.execute({
            ...reportableContext,
            cascade: buildCascadeState({ integrityScore: null, degradations: ['verifier_api_error', 'repo_context_unavailable'] }),
            prescanStats: buildPrescanStats({ degraded: true }),
            repoContext: { ...reportableContext.repoContext, status: 'unavailable' },
        });

        const postedBody = String(createPullRequestReviewMock.mock.calls[0][4]);
        // Ein fehlender Satz (null) wird zum Platzhalter, den der Body nie enthält: dann -1 und rot.
        const noticePositions = [
            formatPrescanUnavailableNotice(true, []),
            'Reduced confidence mode: parts of the verification cascade were unavailable.',
            formatRepoContextNotice('unavailable'),
        ].map((expectedNotice) => postedBody.indexOf(expectedNotice ?? '<missing notice>'));

        expect(noticePositions).not.toContain(-1);
        expect(noticePositions).toEqual([...noticePositions].sort((left, right) => left - right));
    });

    it('nennt bei einem Teilausfall des Pre-Scans die Dateien ohne Pre-Scan, ohne Kursiv-Markup', async () => {
        await githubReporterStep.execute({
            ...buildReportableContext(),
            prescanStats: buildPrescanStats({
                degraded: true,
                degradedReason: '1 of 3 pre-scan batches did not run (2 files): HTTP 500',
                unscannedFiles: ['src/lib/snake_case_a.ts', 'src/lib/snake_case_b.ts'],
            }),
        });

        expect(String(createPullRequestReviewMock.mock.calls[0][4])).toContain(
            '\n⚠️ Reduced coverage: the deterministic pre-scanner failed on 2 files — '
            + 'not checked by it: src/lib/snake_case_a.ts, src/lib/snake_case_b.ts.',
        );
    });

    it('nennt einen ausgefallenen Pre-Scan neben der Modell-Review, mit und ohne Findings (unslopai/test#29)', async () => {
        const prescanFailedStats = buildPrescanStats({ degraded: true, degradedReason: 'Prescan-Route antwortete mit HTTP 500.' });
        const prescanFailedNotice = 'Reduced coverage: the deterministic pre-scanner failed on this change';

        await githubReporterStep.execute({ ...buildReportableContext(), prescanStats: prescanFailedStats });
        await githubReporterStep.execute(buildPipelineContext({
            reviewableFiles: [buildPullRequestFile()],
            cascade: buildCascadeState({ integrityScore: 100 }),
            prescanStats: prescanFailedStats,
        }));
        await githubReporterStep.execute({ ...buildReportableContext(), prescanStats: buildPrescanStats() });

        expect(String(createPullRequestReviewMock.mock.calls[0][4])).toContain(prescanFailedNotice);
        expect(String(createPullRequestReviewMock.mock.calls[1][4])).toContain(prescanFailedNotice);
        expect(String(createPullRequestReviewMock.mock.calls[2][4])).not.toContain(prescanFailedNotice);
        // Ohne Findings kein ✅ bei Teilabdeckung (Entscheidung 2026-09-30).
        expect(String(createPullRequestReviewMock.mock.calls[1][4])).toContain(
            '⚠️ **Anti-Slop Gatekeeper**: No AI slop found in the reviewed parts, but this review is incomplete.',
        );
        expect(String(createPullRequestReviewMock.mock.calls[1][4])).not.toContain('✅');
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

    it('sagt bei einem Lauf ohne Modell-Review, dass kein Modell gelesen hat — kein Häkchen, kein Score-Block', async () => {
        const deterministicOnlyContext = buildPipelineContext({
            prFiles: [buildPullRequestFile({ filename: 'services/report_job.py' })],
            llmSkipped: true,
            deterministicOnlyReason: formatDeterministicOnlyNotice('pull_request'),
            prescanStats: {
                degraded: false,
                degradedReason: null,
                findingsCount: 0,
                criticalCount: 0,
                rulesEvaluated: 42,
                rulesDisabled: [],
                filesScanned: 2,
                filesSkipped: [],
                skippedChecks: [],
                llmSkipped: true,
                durationMs: 120,
                engineVersions: null,
            },
        });

        await githubReporterStep.execute(deterministicOnlyContext);

        const postedBody = createPullRequestReviewMock.mock.calls[0][4];
        expect(postedBody).toBe(
            `ℹ️ **Anti-Slop Gatekeeper**: ${formatDeterministicOnlyNotice('pull_request')} `
            + 'The pre-scanner checked 2 files and found nothing.',
        );
        expect(createPullRequestReviewMock.mock.calls[0][6]).toBe('COMMENT');
        expect(postPRCommentMock).not.toHaveBeenCalled();
    });

    it('nennt den fehlenden Modell-Review auch neben deterministischen Findings', async () => {
        const scannedFile = buildPullRequestFile({ filename: 'services/report_job.py', patch: '@@ -0,0 +1,3 @@\n+import os\n+import hallucinated_kit\n+' });
        const deterministicFindingContext = buildPipelineContext({
            prFiles: [scannedFile],
            prescanIssues: [buildReviewIssue({
                rule: 'SEC-005 (Hardcoded secret)', path: scannedFile.filename, line: 2, endLine: 2, source: 'pre-scanner',
            })],
            llmSkipped: true,
            deterministicOnlyReason: formatDeterministicOnlyNotice('pull_request'),
            prescanStats: {
                degraded: false,
                degradedReason: null,
                findingsCount: 0,
                criticalCount: 0,
                rulesEvaluated: 42,
                rulesDisabled: [],
                filesScanned: 2,
                filesSkipped: [],
                skippedChecks: [],
                llmSkipped: true,
                durationMs: 120,
                engineVersions: null,
            },
        });

        await githubReporterStep.execute(deterministicFindingContext);

        const postedBody = createPullRequestReviewMock.mock.calls[0][4];
        expect(postedBody).toContain('so no model reviewed it. The deterministic pre-scanner found 1 critical and 0 warning findings.');
        expect(postedBody).not.toContain('Cognitive Integrity Score');
    });

    it('meldet einen ausgefallenen Pre-Scan bei vorhandenen Lane-Dateien als Ausfall — kein ✅ „No reviewable code files“', async () => {
        const degradedPrescanContext = buildPipelineContext({
            prFiles: [buildPullRequestFile({ filename: 'services/report_job.py' })],
            llmSkipped: true,
            abortReason: 'No reviewable code files in this pull request.',
            deterministicOnlyReason: formatDeterministicOnlyNotice('pull_request'),
            prescanStats: {
                degraded: true,
                degradedReason: 'internal route timeout',
                findingsCount: 0,
                criticalCount: 0,
                rulesEvaluated: 0,
                rulesDisabled: [],
                filesScanned: 0,
                filesSkipped: [],
                skippedChecks: [{ ruleId: '*', reason: 'step-failure' }],
                llmSkipped: false,
                durationMs: 0,
                engineVersions: null,
            },
        });

        await githubReporterStep.execute(degradedPrescanContext);

        const postedComment = postPRCommentMock.mock.calls[0][3];
        expect(postedComment).toMatch(/^⚠️ \*\*Anti-Slop Gatekeeper\*\*: Not reviewed: the deterministic pre-scanner failed/);
        expect(postedComment).not.toContain('✅');
        expect(postedComment).not.toContain('No reviewable code files');
        expect(createPullRequestReviewMock).not.toHaveBeenCalled();
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

    it('marks the report incomplete instead of failing the job when the comment-map persistence errors', async () => {
        commentMapUpsertMock.mockResolvedValue({ error: { message: 'permission denied' } });

        const reportedContext = await githubReporterStep.execute(buildReportableContext());

        expect(reportedContext.cascade.degradations).toEqual(['report_incomplete']);
    });

    it('marks the report incomplete when re-reading the posted comments dies on the socket (Job 0d913d83)', async () => {
        fetchReviewCommentsMock.mockRejectedValue(
            new TypeError('terminated', { cause: { code: 'UND_ERR_SOCKET', message: 'other side closed' } }),
        );

        const reportedContext = await githubReporterStep.execute(buildReportableContext());

        // Der Review steht: Ergebnis und Check laufen weiter, die Lücke steht in den Degradationen.
        expect(createPullRequestReviewMock).toHaveBeenCalledTimes(1);
        expect(commentMapUpsertMock).not.toHaveBeenCalled();
        expect(reportedContext.cascade.degradations).toEqual(['report_incomplete']);
        expect(reportedContext.issues).toHaveLength(1);
    });

    it('keeps a fully reported run free of the degradation', async () => {
        const reportedContext = await githubReporterStep.execute(buildReportableContext());

        expect(reportedContext.cascade.degradations).toEqual([]);
    });

    it('still fails the step when posting the review itself fails: no done job without a visible review', async () => {
        createPullRequestReviewMock.mockRejectedValue(new GitHubApiError(404, '/repos/unslopai/test/pulls/13/reviews', 'Not Found'));

        await expect(githubReporterStep.execute(buildReportableContext())).rejects.toBeInstanceOf(GitHubApiError);
    });

    it('still persists rows (all null) when the review id is unreadable', async () => {
        createPullRequestReviewMock.mockResolvedValue(null);

        await githubReporterStep.execute(buildReportableContext());

        expect(fetchReviewCommentsMock).not.toHaveBeenCalled();
        expect(capturedCommentRows()[0].github_comment_id).toBeNull();
    });
});

// =============================================================================
// KI-Kennzeichnung (Art. 50 Abs. 2 KI-VO, LEGAL_PAGES_SPEC §4a.3)
// =============================================================================

describe('githubReporterStep — KI-Kennzeichnung', () => {
    const AI_LABEL = '_AI-generated. Check it before you rely on it._';
    const AI_MARKER = '<!-- unslop:ai-generated -->';
    const DETERMINISTIC_ONLY_REASON = 'Deterministic checks only: this pull request changes no TypeScript or '
        + 'JavaScript file, so no model reviewed it.';
    beforeEach(() => {
        resetReporterMocks();
    });

    function postedReviewBody(): string {
        return createPullRequestReviewMock.mock.calls[0][4];
    }

    function postedInlineBodies(): string[] {
        return createPullRequestReviewMock.mock.calls[0][5].map((inlineComment) => inlineComment.body);
    }

    it('kennzeichnet Review-Body und Inline-Kommentar eines Modell-Reviews sichtbar und maschinenlesbar', async () => {
        await githubReporterStep.execute(buildReportableContext());

        expect(postedReviewBody()).toContain(AI_LABEL);
        expect(postedReviewBody().endsWith(AI_MARKER)).toBe(true);
        // Die Kopfzeile bleibt die erste Zeile: daran erkennt review-posting.ts den eigenen Review wieder.
        expect(postedReviewBody().split('\n')[0]).toBe('## 🛡️ Anti-Slop Gatekeeper Review');
        expect(postedInlineBodies()).toHaveLength(1);
        expect(postedInlineBodies()[0]).toContain(AI_LABEL);
        expect(postedInlineBodies()[0]).toContain(AI_MARKER);
    });

    it('lässt ein Pre-Scan-Finding im selben Review ohne Label, das Modell-Finding trägt es', async () => {
        const reviewedFile = buildPullRequestFile({
            patch: '@@ -40,3 +40,5 @@\n+import hallucinatedKit from "hallucinated-kit";\n+const data = fetchData();',
        });
        const mixedContext = buildPipelineContext({
            issues: [buildReviewIssue({ line: 41, endLine: 41, verification: 'confirmed' })],
            prescanIssues: [buildReviewIssue({
                rule: 'SEC-035 (Package does not exist on its registry)',
                line: 40,
                endLine: 40,
                source: 'pre-scanner',
                verification: 'deterministic',
            })],
            prFiles: [reviewedFile],
            reviewableFiles: [reviewedFile],
            reviewSummary: 'Two findings.',
            githubToken: 'token-under-test',
            cascade: buildCascadeState({ integrityScore: 91 }),
        });

        await githubReporterStep.execute(mixedContext);

        const deterministicComment = postedInlineBodies().find((inlineBody) => inlineBody.includes('SEC-035'));
        const modelComment = postedInlineBodies().find((inlineBody) => inlineBody.includes('COND-003'));
        expect(deterministicComment).toBeDefined();
        expect(deterministicComment).not.toContain('AI-generated');
        expect(deterministicComment).not.toContain(AI_MARKER);
        expect(modelComment).toContain(AI_LABEL);
        expect(modelComment).toContain(AI_MARKER);
        // Der Review als Ganzes enthält Modell-Inhalt.
        expect(postedReviewBody()).toContain(AI_MARKER);
    });

    it('kennzeichnet auch den Kommentar „No AI slop found“: das Urteil stammt vom Modell', async () => {
        const cleanContext = buildPipelineContext({
            reviewableFiles: [buildPullRequestFile()],
            cascade: buildCascadeState({ integrityScore: 100 }),
        });

        await githubReporterStep.execute(cleanContext);

        expect(postedReviewBody()).toContain('No AI slop found');
        expect(postedReviewBody()).toContain(AI_LABEL);
        expect(postedReviewBody().endsWith(AI_MARKER)).toBe(true);
    });

    it('kennzeichnet einen Lauf ohne Modell nicht: weder Body noch Inline-Kommentar (deterministic_only)', async () => {
        const scannedFile = buildPullRequestFile({
            filename: 'services/report_job.py',
            patch: '@@ -0,0 +1,3 @@\n+import os\n+import hallucinated_kit\n+',
        });
        const deterministicOnlyContext = buildPipelineContext({
            prFiles: [scannedFile],
            prescanIssues: [buildReviewIssue({
                rule: 'SEC-035 (Package does not exist on its registry)',
                path: scannedFile.filename,
                line: 2,
                endLine: 2,
                source: 'pre-scanner',
                verification: 'deterministic',
            })],
            llmSkipped: true,
            deterministicOnlyReason: DETERMINISTIC_ONLY_REASON,
            prescanStats: buildPrescanStats({ llmSkipped: true }),
        });

        await githubReporterStep.execute(deterministicOnlyContext);

        expect(postedReviewBody()).not.toContain('AI-generated');
        expect(postedReviewBody()).not.toContain(AI_MARKER);
        expect(postedInlineBodies()).toHaveLength(1);
        expect(postedInlineBodies()[0]).not.toContain('AI-generated');
        expect(postedInlineBodies()[0]).not.toContain(AI_MARKER);
    });

    it('kennzeichnet den Short-Circuit des Pre-Scanners nicht: Outcome reviewed, aber kein Modell lief', async () => {
        const reviewedFile = buildPullRequestFile({
            patch: '@@ -40,3 +40,5 @@\n+import hallucinatedKit from "hallucinated-kit";\n+const data = fetchData();',
        });
        const shortCircuitContext = buildPipelineContext({
            prescanIssues: [buildReviewIssue({
                rule: 'SEC-035 (Package does not exist on its registry)',
                line: 40,
                endLine: 40,
                source: 'pre-scanner',
                verification: 'deterministic',
            })],
            prFiles: [reviewedFile],
            reviewableFiles: [reviewedFile],
            reviewSummary: 'LLM review skipped: 1 critical structural violations found by the deterministic pre-scanner. Fix these first.',
            githubToken: 'token-under-test',
            llmSkipped: true,
            prescanStats: buildPrescanStats({ llmSkipped: true, criticalCount: 1, findingsCount: 1 }),
        });

        await githubReporterStep.execute(shortCircuitContext);

        expect(postedReviewBody()).toContain('LLM review skipped');
        expect(postedReviewBody()).not.toContain('AI-generated');
        expect(postedReviewBody()).not.toContain(AI_MARKER);
        expect(postedInlineBodies()[0]).not.toContain(AI_MARKER);
    });

    it('kennzeichnet den Hinweis „nichts geprüft“ nicht', async () => {
        const abortedContext = buildPipelineContext({
            shouldAbort: true,
            abortReason: 'No reviewable code files in this pull request.',
        });

        await githubReporterStep.execute(abortedContext);

        const postedComment = postPRCommentMock.mock.calls[0][3];
        expect(postedComment).not.toContain('AI-generated');
        expect(postedComment).not.toContain(AI_MARKER);
        expect(createPullRequestReviewMock).not.toHaveBeenCalled();
    });
});

describe('githubReporterStep — Regel-Label statt Condition-Nummer (ROADMAP §3)', () => {
    beforeEach(() => {
        resetReporterMocks();
    });

    it('labels a condition finding "COND-001 (Silent Error Swallowing)" inline and in the body, never "Condition 1"', async () => {
        const reviewedFile = buildPullRequestFile({
            patch: '@@ -40,3 +40,5 @@\n+try { syncOrders(); } catch { return []; }\n+const pending = 1;',
        });
        const conditionContext = buildPipelineContext({
            issues: [
                buildReviewIssue({ rule: 'Condition 1 (Silent Error Swallowing)', line: 41, endLine: 41 }),
                buildReviewIssue({ rule: 'Condition 1 (Silent Error Swallowing)', line: 99, endLine: 99 }),
            ],
            prFiles: [reviewedFile],
            reviewableFiles: [reviewedFile],
            reviewSummary: 'One swallowed error.',
            githubToken: 'token-under-test',
            cascade: buildCascadeState({ integrityScore: 91, verdicts: [] }),
        });

        await githubReporterStep.execute(conditionContext);

        const [inlineComment] = createPullRequestReviewMock.mock.calls[0][5];
        const reviewBody = createPullRequestReviewMock.mock.calls[0][4];
        expect(inlineComment.body).toContain('COND-001 (Silent Error Swallowing)');
        // Line 99 lies outside the hunk, so this finding lands in the review body.
        expect(reviewBody).toContain('COND-001 (Silent Error Swallowing)');
        expect(inlineComment.body).not.toContain('Condition 1');
        expect(reviewBody).not.toContain('Condition 1');
    });
});
