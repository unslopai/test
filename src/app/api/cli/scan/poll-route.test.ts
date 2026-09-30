/**
 * Tests für GET /api/cli/scan/[jobId] — Phasen-Contract (MCP_SPEC.md §4.1/§10):
 * processing+partial ⇒ deterministic, processing ohne Partial ⇒ submitted,
 * done ⇒ complete; 5-Minuten-Stall bleibt job_stalled; Re-roll-Notice (§4.5)
 * nur ab der Client-Schwelle, 0 deaktiviert.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveApiKeyMock, jobSingleMock, repoSingleMock } = vi.hoisted(() => ({
    resolveApiKeyMock: vi.fn(),
    jobSingleMock: vi.fn(),
    repoSingleMock: vi.fn(),
}));

vi.mock('@/lib/api-keys', () => ({ resolveApiKey: resolveApiKeyMock }));
vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: (tableName: string) => {
            if (tableName === 'review_jobs') {
                return {
                    select: () => ({
                        eq: () => ({ in: () => ({ single: jobSingleMock }) }),
                    }),
                };
            }
            // repositories (Ownership-Check)
            return { select: () => ({ eq: () => ({ eq: () => ({ single: repoSingleMock }) }) }) };
        },
    },
}));

const scheduleLazyReapMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/lazy-reaper', () => ({ scheduleLazyReap: scheduleLazyReapMock }));

const { GET } = await import('./[jobId]/route');

function buildPollRequest(): Request {
    return new Request('http://localhost/api/cli/scan/job-under-test');
}

const ROUTE_PARAMS = { params: Promise.resolve({ jobId: 'job-under-test' }) };

interface JobRowOverrides {
    status?: string;
    result?: unknown;
    partial_result?: unknown;
    reroll_count?: number;
    reroll_limit?: number | null;
    updated_at?: string;
    error_message?: string | null;
}

function mockJobRow(overrides: JobRowOverrides = {}): void {
    jobSingleMock.mockResolvedValue({
        data: {
            id: 'job-under-test',
            status: 'processing',
            result: null,
            partial_result: null,
            reroll_count: 0,
            reroll_limit: null,
            error_message: null,
            repository_id: 'repo-under-test',
            updated_at: new Date().toISOString(),
            ...overrides,
        },
        error: null,
    });
}

const PERSISTED_RESULT_FIXTURE = {
    review: {
        has_slop: true,
        issues: [
            { id: 'a'.repeat(16), rule: 'ARCH-002 (Strict Validation Boundary)', severity: 'CRITICAL' },
            { id: 'b'.repeat(16), rule: 'MAINT-001 (Empty catch)', severity: 'WARNING' },
        ],
        summary: 'Two violations found.',
    },
    files_reviewed: 3,
    cognitive_integrity_score: 91,
};

describe('GET /api/cli/scan/[jobId] — phase contract (MCP_SPEC §4.1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveApiKeyMock.mockResolvedValue({ id: 'api-key-under-test', userId: 'user-under-test' });
        repoSingleMock.mockResolvedValue({ data: { id: 'repo-under-test' }, error: null });
    });

    it("serves the prescan partial as phase 'deterministic' while processing", async () => {
        mockJobRow({
            partial_result: {
                phase: 'deterministic',
                review: { has_slop: true, issues: [{ id: 'c'.repeat(16), rule: 'SEC-029 (Banned libc API)' }], summary: '1 deterministic findings; LLM analysis running.' },
            },
        });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.status).toBe('processing');
        expect(pollResponse.phase).toBe('deterministic');
        expect(pollResponse.partialResult.issues).toHaveLength(1);
        expect(pollResponse.partialResult.hasSlop).toBe(true);
        expect(pollResponse.result).toBeUndefined();
    });

    it("reports phase 'submitted' while processing without a partial", async () => {
        mockJobRow();

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse).toEqual({ status: 'processing', phase: 'submitted' });
    });

    it("reports phase 'complete' with the mapped result when done", async () => {
        mockJobRow({ status: 'done', result: PERSISTED_RESULT_FIXTURE });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.status).toBe('done');
        expect(pollResponse.phase).toBe('complete');
        expect(pollResponse.result.cognitiveIntegrityScore).toBe(91);
        expect(pollResponse.result.issues[0].id).toBe('a'.repeat(16));
        expect(pollResponse.result.outcome).toBe('reviewed');
        expect(pollResponse.rerollNotice).toBeUndefined();
    });

    it("marks an aborted zero-files run as outcome 'nothing_reviewed' with the omitted files (ROADMAP §3)", async () => {
        mockJobRow({
            status: 'done',
            result: {
                review: { has_slop: false, issues: [], summary: 'All changed code files exceed the review size cap.' },
                files_reviewed: 0,
                nothing_reviewed: true,
                omitted_files: ['src/lib/huge-a.ts', 'src/lib/huge-b.ts'],
                cognitive_integrity_score: null,
            },
        });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.result.outcome).toBe('nothing_reviewed');
        expect(pollResponse.result.hasSlop).toBe(false);
        expect(pollResponse.result.filesReviewed).toBe(0);
        expect(pollResponse.result.omittedFiles).toEqual(['src/lib/huge-a.ts', 'src/lib/huge-b.ts']);
        expect(pollResponse.result.summary).toBe('All changed code files exceed the review size cap.');
    });

    it("derives 'nothing_reviewed' for legacy terminal blobs without the marker (files_reviewed 0)", async () => {
        // Jobs, die vor dem Ehrlichkeits-Fix persistiert wurden, tragen weder
        // nothing_reviewed noch omitted_files — 0 geprüfte Dateien dürfen sich
        // trotzdem nie als geprüfter Clean-Scan ausgeben.
        mockJobRow({
            status: 'done',
            result: {
                review: { has_slop: false, issues: [], summary: 'All changed code files exceed the review size cap.' },
                files_reviewed: 0,
                cognitive_integrity_score: null,
            },
        });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.result.outcome).toBe('nothing_reviewed');
        expect(pollResponse.result.omittedFiles).toEqual([]);
    });

    it("keeps a genuine clean scan (files reviewed, zero issues) as outcome 'reviewed'", async () => {
        mockJobRow({
            status: 'done',
            result: {
                review: { has_slop: false, issues: [], summary: 'No AI slop found.' },
                files_reviewed: 3,
                nothing_reviewed: false,
                omitted_files: [],
                cognitive_integrity_score: 97,
            },
        });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.result.outcome).toBe('reviewed');
        expect(pollResponse.result.hasSlop).toBe(false);
        expect(pollResponse.result.filesReviewed).toBe(3);
    });

    it("never marks a prescan partial as 'nothing_reviewed' — it is not a verdict", async () => {
        // Der Partial-Blob kennt kein files_reviewed; der Zero-Fallback gilt
        // nur für terminale Ergebnisse.
        mockJobRow({
            partial_result: {
                phase: 'deterministic',
                review: { has_slop: false, issues: [], summary: '0 deterministic findings; LLM analysis running.' },
            },
        });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.status).toBe('processing');
        expect(pollResponse.partialResult.outcome).toBe('reviewed');
    });

    it('returns a stable server_error code for a failed job, never the raw error_message (ROADMAP §15)', async () => {
        // error_message kann eine Vorschau der Modellantwort tragen, die der
        // Diff-Autor mitbestimmt. Selbst wenn sie in der Zeile steht, darf sie
        // die Antwort nie erreichen.
        const attackerControlledPreview = 'SECRET-LEAK-CANARY Response-Preview: {"verdicts":[{"blind_answer":"…"}]}';
        mockJobRow({ status: 'error', error_message: attackerControlledPreview });

        const rawResponse = await GET(buildPollRequest(), ROUTE_PARAMS);
        const pollResponse = await rawResponse.json();

        expect(pollResponse.status).toBe('error');
        expect(pollResponse.error).toBe('server_error');
        // Kein Fragment des Modelltexts irgendwo in der serialisierten Antwort.
        expect(JSON.stringify(pollResponse)).not.toContain('SECRET-LEAK-CANARY');
        expect(JSON.stringify(pollResponse)).not.toContain('Response-Preview');
    });

    it('reicht Zeit-Skips des Deadline Guards durch und verwirft unbekannte Stufen (DEADLINE_GUARD_SPEC D6)', async () => {
        mockJobRow({
            status: 'done',
            result: {
                ...PERSISTED_RESULT_FIXTURE,
                degradations: ['time_budget_exhausted'],
                skipped_stages: ['second_opinion', 'injected_stage'],
            },
        });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.result.degradations).toEqual(['time_budget_exhausted']);
        expect(pollResponse.result.skippedStages).toEqual(['second_opinion']);
        // Ohne Feld im Blob (Alt-Ergebnis) eine leere Liste, nie undefined.
        expect(pollResponse.result.draftUnreviewedFiles).toEqual([]);
    });

    it('reicht die Dateien gescheiterter Draft-Batches durch und verwirft Nicht-Listen (draft_partial, LARGE_DIFF_RECALL_SPEC §9)', async () => {
        mockJobRow({
            status: 'done',
            result: {
                ...PERSISTED_RESULT_FIXTURE,
                degradations: ['draft_partial'],
                draft_unreviewed_files: ['src/lib/alpha.ts', 'src/lib/beta.ts'],
            },
        });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.result.degradations).toEqual(['draft_partial']);
        expect(pollResponse.result.draftUnreviewedFiles).toEqual(['src/lib/alpha.ts', 'src/lib/beta.ts']);

        mockJobRow({
            status: 'done',
            result: { ...PERSISTED_RESULT_FIXTURE, draft_unreviewed_files: 'src/lib/alpha.ts' },
        });
        const malformedResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();
        expect(malformedResponse.result.draftUnreviewedFiles).toEqual([]);
    });

    it('plant nach erfolgreicher Key-Prüfung ein Lazy Reaping ein (DEADLINE_GUARD_SPEC D10)', async () => {
        mockJobRow();

        await GET(buildPollRequest(), ROUTE_PARAMS);

        expect(scheduleLazyReapMock).toHaveBeenCalledWith('cli-poll');
    });

    it('ein ungültiger API-Key löst kein Lazy Reaping aus', async () => {
        resolveApiKeyMock.mockResolvedValue(null);

        const pollResponse = await GET(buildPollRequest(), ROUTE_PARAMS);

        expect(pollResponse.status).toBe(401);
        expect(scheduleLazyReapMock).not.toHaveBeenCalled();
    });

    it('meldet einen Review-Timeout als review_timeout — ohne den Rohtext', async () => {
        mockJobRow({
            status: 'error',
            error_message: '[review_timeout] Review-Zeitbudget erschöpft: Draft-Call an der Job-Deadline abgebrochen',
        });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse).toEqual({ status: 'error', phase: 'submitted', error: 'review_timeout' });
    });

    it('meldet eine erschöpfte Modell-Kapazität als model_unavailable — ohne den Rohtext', async () => {
        mockJobRow({
            status: 'error',
            error_message: '[model_unavailable] ReviewerPass/draft/gemini-3.6-flash: Modell nach 3 Versuchen nicht verfügbar — {"error":{"code":429}}',
        });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse).toEqual({ status: 'error', phase: 'submitted', error: 'model_unavailable' });
    });

    it('still reports job_stalled for a processing job older than 5 minutes', async () => {
        mockJobRow({ updated_at: new Date(Date.now() - 6 * 60 * 1000).toISOString() });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.status).toBe('error');
        expect(pollResponse.error).toBe('job_stalled');
    });

    it('answers 404 job_not_found when the repository belongs to another user', async () => {
        mockJobRow();
        repoSingleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

        const rawResponse = await GET(buildPollRequest(), ROUTE_PARAMS);

        expect(rawResponse.status).toBe(404);
        expect(await rawResponse.json()).toEqual({ error: 'job_not_found' });
    });
});

describe('GET /api/cli/scan/[jobId] — reroll notice (MCP_SPEC §4.5)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveApiKeyMock.mockResolvedValue({ id: 'api-key-under-test', userId: 'user-under-test' });
        repoSingleMock.mockResolvedValue({ data: { id: 'repo-under-test' }, error: null });
    });

    it('renders the notice at the default threshold with the persistent bare rule ids', async () => {
        mockJobRow({ status: 'done', result: PERSISTED_RESULT_FIXTURE, reroll_count: 3, reroll_limit: null });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.rerollNotice.attempts).toBe(4);
        expect(pollResponse.rerollNotice.persistentRules).toEqual(['ARCH-002', 'MAINT-001']);
        expect(pollResponse.rerollNotice.message).toContain('scanned this code 4 times');
        expect(pollResponse.rerollNotice.message).toContain('ARCH-002, MAINT-001');
        // Die Findings bleiben trotz Notice vollständig enthalten (D5).
        expect(pollResponse.result.issues).toHaveLength(2);
    });

    it('stays silent below the threshold', async () => {
        mockJobRow({ status: 'done', result: PERSISTED_RESULT_FIXTURE, reroll_count: 2, reroll_limit: null });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.rerollNotice).toBeUndefined();
    });

    it('honours a client-configured threshold from the payload', async () => {
        mockJobRow({ status: 'done', result: PERSISTED_RESULT_FIXTURE, reroll_count: 1, reroll_limit: 1 });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.rerollNotice.attempts).toBe(2);
    });

    it('never renders a notice with rerollLimit 0, regardless of the count', async () => {
        mockJobRow({ status: 'done', result: PERSISTED_RESULT_FIXTURE, reroll_count: 10, reroll_limit: 0 });

        const pollResponse = await (await GET(buildPollRequest(), ROUTE_PARAMS)).json();

        expect(pollResponse.rerollNotice).toBeUndefined();
    });
});
