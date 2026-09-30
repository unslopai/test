/**
 * Tests für das strukturelle review_jobs→DTO-Mapping (DASHBOARD_UX_SPEC.md
 * §4/§9.1): Issue-Parsing an der DB-Grenze [ARCH-002], Verdict-Ableitung und
 * das last_scan-Feld der Repo-Liste. Die Fixtures spiegeln die echte
 * result-Blob-Form aus dem ResultPersisterStep (live gegengeprüft am Job
 * 82339ee5, unslopai/test#15).
 */
import { describe, expect, it } from 'vitest';
import {
    deriveScanVerdict,
    mapLastScan,
    mapReviewJobToScanView,
    parseScanIssues,
} from './scan-view';

/** Realistische Issue-Elemente, wie collectReportableIssues sie persistiert. */
const PRESCAN_ISSUE = {
    id: 'f-1',
    rule: 'ASYNC-001',
    severity: 'CRITICAL',
    path: 'src/lib/worker.ts',
    line: 42,
    endLine: 44,
    exactQuote: 'await inside for-loop',
    critique: 'Sequential awaits in a loop — batch with Promise.all.',
    source: 'pre-scanner',
};

const LLM_ISSUE = {
    id: 'f-2',
    rule: 'MAINT-001',
    severity: 'WARNING',
    path: 'src/app/page.tsx',
    line: 7,
    endLine: 7,
    exactQuote: 'const data = ...',
    critique: 'Generic identifier hides intent.',
    source: 'draft-reviewer',
    confidence: 88,
};

describe('parseScanIssues (ARCH-002)', () => {
    it('maps persisted issues to the view shape incl. lane and confidence', () => {
        const parsedIssues = parseScanIssues([PRESCAN_ISSUE, LLM_ISSUE]);

        expect(parsedIssues).toEqual([
            {
                rule: 'ASYNC-001',
                path: 'src/lib/worker.ts',
                line: 42,
                severity: 'CRITICAL',
                critique: 'Sequential awaits in a loop — batch with Promise.all.',
                source: 'prescan',
                confidence: null,
            },
            {
                rule: 'MAINT-001',
                path: 'src/app/page.tsx',
                line: 7,
                severity: 'WARNING',
                critique: 'Generic identifier hides intent.',
                source: 'llm',
                confidence: 88,
            },
        ]);
    });

    it('drops structurally broken elements instead of emitting half-defined objects', () => {
        const parsedIssues = parseScanIssues([
            PRESCAN_ISSUE,
            { rule: 'X', path: 'a.ts' }, // line + critique fehlen
            'not an object',
            null,
        ]);

        expect(parsedIssues).toHaveLength(1);
    });

    it('degrades an unknown severity to WARNING, never up to CRITICAL', () => {
        const [parsedIssue] = parseScanIssues([{ ...PRESCAN_ISSUE, severity: 'MEGA' }]);
        expect(parsedIssue.severity).toBe('WARNING');
    });

    it('returns [] for non-array input', () => {
        expect(parseScanIssues(undefined)).toEqual([]);
        expect(parseScanIssues({ issues: [] })).toEqual([]);
    });
});

describe('deriveScanVerdict', () => {
    it('is neutral for every non-terminal or aborted state', () => {
        expect(deriveScanVerdict({ status: 'processing', nothingReviewed: false, hasSlop: false, issueCount: 0 })).toBe('neutral');
        expect(deriveScanVerdict({ status: 'error', nothingReviewed: false, hasSlop: false, issueCount: 0 })).toBe('neutral');
        // Honesty-Marker: ein Abort-Lauf hat NICHTS geprüft — nie 'clean'.
        expect(deriveScanVerdict({ status: 'done', nothingReviewed: true, hasSlop: false, issueCount: 0 })).toBe('neutral');
    });

    it('is clean only for a terminal run without findings', () => {
        expect(deriveScanVerdict({ status: 'done', nothingReviewed: false, hasSlop: false, issueCount: 0 })).toBe('clean');
    });

    it('is slop when has_slop OR parsed issues say so (contradictions stay slop)', () => {
        expect(deriveScanVerdict({ status: 'done', nothingReviewed: false, hasSlop: false, issueCount: 3 })).toBe('slop');
        expect(deriveScanVerdict({ status: 'done', nothingReviewed: false, hasSlop: true, issueCount: 0 })).toBe('slop');
    });
});

describe('mapReviewJobToScanView', () => {
    const DONE_JOB_ROW = {
        id: 'job-1',
        created_at: '2026-08-29T18:52:24.100484+00:00',
        status: 'done',
        pr_number: 15,
        pr_url: 'https://github.com/unslopai/test/pull/15',
        integrity_score: 62,
        result: {
            review: { has_slop: true, issues: [PRESCAN_ISSUE, LLM_ISSUE], summary: 'Slop found.' },
            files_reviewed: 3,
            nothing_reviewed: false,
            cognitive_integrity_score: 62,
        },
    };

    it('maps a terminal job with findings to a slop DTO', () => {
        const scanView = mapReviewJobToScanView(DONE_JOB_ROW);

        expect(scanView).toMatchObject({
            id: 'job-1',
            prNumber: 15,
            prUrl: 'https://github.com/unslopai/test/pull/15',
            createdAt: '2026-08-29T18:52:24.100484+00:00',
            status: 'done',
            verdict: 'slop',
            integrityScore: 62,
            issueCount: 2,
        });
        expect(scanView.issues).toHaveLength(2);
    });

    it('keeps a processing job neutral with an empty issue list', () => {
        const scanView = mapReviewJobToScanView({
            ...DONE_JOB_ROW,
            status: 'processing',
            integrity_score: null,
            result: null,
        });

        expect(scanView.verdict).toBe('neutral');
        expect(scanView.issueCount).toBe(0);
        expect(scanView.integrityScore).toBeNull();
    });
});

describe('mapLastScan (§4.2 Embed)', () => {
    it('maps the lateral embed row to the compact list view', () => {
        const lastScan = mapLastScan([{
            created_at: '2026-08-29T18:52:24.100484+00:00',
            status: 'done',
            nothing_reviewed: false,
            review: { has_slop: true, issues: [PRESCAN_ISSUE] },
        }]);

        expect(lastScan).toEqual({
            createdAt: '2026-08-29T18:52:24.100484+00:00',
            verdict: 'slop',
            issueCount: 1,
        });
    });

    it('returns null for never-scanned repos and malformed embeds — never a made-up verdict', () => {
        expect(mapLastScan([])).toBeNull();
        expect(mapLastScan(undefined)).toBeNull();
        expect(mapLastScan(['garbage'])).toBeNull();
        expect(mapLastScan([{ status: 'done' }])).toBeNull(); // created_at fehlt
    });

    it('treats a deterministic-only run without findings as neutral, with findings as slop', () => {
        const deterministicOnlyRun = { status: 'done', nothingReviewed: false, deterministicOnly: true, hasSlop: false };
        expect(deriveScanVerdict({ ...deterministicOnlyRun, issueCount: 0 })).toBe('neutral');
        expect(deriveScanVerdict({ ...deterministicOnlyRun, issueCount: 2 })).toBe('slop');
    });

    it('treats a nothing_reviewed run as neutral, not clean', () => {
        const lastScan = mapLastScan([{
            created_at: '2026-08-29T10:00:00+00:00',
            status: 'done',
            nothing_reviewed: true,
            review: { has_slop: false, issues: [] },
        }]);

        expect(lastScan?.verdict).toBe('neutral');
    });
});
