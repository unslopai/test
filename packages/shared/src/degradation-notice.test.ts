/**
 * Hinweiszeile für Zeit-Skips (DEADLINE_GUARD_SPEC.md §3.4) — dieselbe
 * Formulierung auf Check, GitHub-Review und CLI.
 */
import { describe, expect, it } from 'vitest';
import {
    findUnreadFileTypesNotice,
    formatDeepLaneNotice,
    formatDraftPartialNotice,
    formatDraftRound2Notice,
    formatPrescanFailedNotice,
    formatPrescanUnavailableNotice,
    formatRepoContextNotice,
    formatTimeBudgetNotice,
    formatUnreadFileTypesNotice,
    hasIncompleteCoverage,
    formatReportIncompleteNotice,
    listDegradationNotices,
} from './degradation-notice.js';

describe('hasIncompleteCoverage (gleiche Bedingung wie der neutrale Check Run)', () => {
    it('meldet Teilabdeckung bei ausgefallenem Pre-Scan oder gescheitertem Draft-Batch', () => {
        expect(hasIncompleteCoverage({ prescan: { degraded: true } })).toBe(true);
        expect(hasIncompleteCoverage({ draftUnreviewedFiles: ['src/a.ts'] })).toBe(true);
    });

    it('wertet einen vollständigen oder alten Lauf als vollständig', () => {
        expect(hasIncompleteCoverage({})).toBe(false);
        expect(hasIncompleteCoverage({ prescan: { degraded: false }, draftUnreviewedFiles: [] })).toBe(false);
    });
});

describe('listDegradationNotices (Reihenfolge wie Check-Summary und PR-Review; Vergleich in worker-routing.test.ts und github-reporter-step.test.ts)', () => {
    it('reiht Zeit-Skip, halben Draft, Pre-Scan, Repo-Kontext und tiefen Pass und bereinigt jeden Pfad', () => {
        const markPath = (receivedPath: string): string => `<${receivedPath}>`;

        expect(listDegradationNotices({
            skippedStages: ['escalation'],
            draftUnreviewedFiles: ['a.ts'],
            prescan: { degraded: true, unscannedFiles: ['b.tf'] },
            repoContext: { status: 'unavailable', paths: [], estimatedTokens: 0, omittedPaths: [] },
            deepLane: { status: 'degraded', degradations: ['deep_lane_failed'], unreviewedFiles: ['c.ts'] },
        }, markPath)).toEqual([
            formatTimeBudgetNotice(['escalation']),
            formatDraftPartialNotice(['<a.ts>']),
            formatPrescanUnavailableNotice(true, ['<b.tf>']),
            formatRepoContextNotice('unavailable'),
            formatDeepLaneNotice(['deep_lane_failed'], ['<c.ts>']),
        ]);
    });

    it('stellt die zweite Draft-Runde zwischen Repo-Kontext und tiefen Pass, wie github-reporter-step', () => {
        expect(listDegradationNotices({
            repoContext: { status: 'unavailable', paths: [], estimatedTokens: 0, omittedPaths: [] },
            degradations: ['repo_context_unavailable', 'draft_round2_skipped_deadline'],
            deepLane: { status: 'degraded', degradations: ['deep_lane_failed'], unreviewedFiles: [] },
        })).toEqual([
            formatRepoContextNotice('unavailable'),
            formatDraftRound2Notice(['draft_round2_skipped_deadline']),
            formatDeepLaneNotice(['deep_lane_failed'], []),
        ]);
        expect(listDegradationNotices({ degradations: ['draft_round2_failed'] })).toEqual([
            formatDraftRound2Notice(['draft_round2_failed']),
        ]);
    });

    it('stellt den unvollständigen Bericht ans Ende: er entsteht erst nach dem Review-Post (SPEC.md §8)', () => {
        expect(listDegradationNotices({
            degradations: ['draft_round2_failed', 'report_incomplete', 'deep_lane_failed'],
            deepLane: { status: 'degraded', degradations: ['deep_lane_failed'], unreviewedFiles: [] },
        })).toEqual([
            formatDraftRound2Notice(['draft_round2_failed']),
            formatDeepLaneNotice(['deep_lane_failed'], []),
            formatReportIncompleteNotice(['report_incomplete']),
        ]);
    });

    it('liefert für einen vollständigen Lauf keine Zeile', () => {
        expect(listDegradationNotices({})).toEqual([]);
        expect(listDegradationNotices({ degradations: ['cache_fallback'] })).toEqual([]);
    });
});

describe('formatReportIncompleteNotice (Schritt nach dem Review-Post gescheitert)', () => {
    it('sagt, dass der Review steht und was fehlt', () => {
        expect(formatReportIncompleteNotice(['report_incomplete'])).toBe(
            'Incomplete report: the review was posted, but its comments could not be linked to the findings, '
            + 'so dismissing a finding will not resolve its review thread on GitHub.',
        );
    });

    it('schweigt bei vollständigem Bericht oder fehlendem Feld (Alt-Ergebnis)', () => {
        expect(formatReportIncompleteNotice(undefined)).toBeNull();
        expect(formatReportIncompleteNotice(['cache_fallback'])).toBeNull();
    });
});

describe('formatUnreadFileTypesNotice / findUnreadFileTypesNotice', () => {
    it('findet den Satz am Ende der veröffentlichten Summary wieder', () => {
        const unreadFileTypesNotice = formatUnreadFileTypesNotice(3, ['.c', '.rs']);

        expect(unreadFileTypesNotice).toBe('No model read 3 changed files of these types: .c, .rs.');
        expect(findUnreadFileTypesNotice(`No AI slop found. ${unreadFileTypesNotice}`)).toBe(unreadFileTypesNotice);
        expect(findUnreadFileTypesNotice(formatUnreadFileTypesNotice(1, ['.rs']))).toBe('No model read 1 changed file of this type: .rs.');
    });

    it('ignoriert eine Summary ohne den Satz oder mit ihm nur mitten im Modelltext', () => {
        expect(findUnreadFileTypesNotice('No AI slop found.')).toBeNull();
        expect(findUnreadFileTypesNotice('No model read 1 changed file of this type: .rs. More text')).toBeNull();
    });
});

describe('formatPrescanFailedNotice (Pre-Scan ausgefallen, kein Modell-Review)', () => {
    it('rät ohne belegte Ursache nicht zum Re-Run (Speicher-Kill kommt als gewöhnlicher HTTP 500 an)', () => {
        expect(formatPrescanFailedNotice()).toBe(
            'Not reviewed: the deterministic pre-scanner failed on this change, and no model reviews it because it '
            + 'changes no file of a type the model review reads. Nothing was checked.',
        );
    });

    it('nennt bei HTTP 413 den Grund und dass derselbe Change wieder scheitert (unslopai/test#35)', () => {
        expect(formatPrescanFailedNotice('payload_too_large')).toBe(
            'Not reviewed: the deterministic pre-scanner failed on this change because the scan request exceeded '
            + 'its size limit (HTTP 413), and no model reviews it because it changes no file of a type the model '
            + 'review reads. Nothing was checked; re-running the review fails the same way.',
        );
    });
});

describe('formatTimeBudgetNotice', () => {
    it('nennt die übersprungenen Stufen in Lauf-Reihenfolge', () => {
        expect(formatTimeBudgetNotice(['escalation', 'second_opinion'])).toBe(
            'Reduced confidence: time budget exhausted — skipped: escalation, second opinion.',
        );
    });

    it('behauptet beim Verifier weder "teilweise" noch "ganz" — beides ist möglich', () => {
        expect(formatTimeBudgetNotice(['verifier'])).toContain('blind verification (some or all findings)');
    });

    it('schweigt, wenn nichts übersprungen wurde oder das Feld fehlt (Alt-Ergebnis)', () => {
        expect(formatTimeBudgetNotice([])).toBeNull();
        expect(formatTimeBudgetNotice(undefined)).toBeNull();
    });
});

describe('formatDraftPartialNotice (LARGE_DIFF_RECALL_SPEC Option A)', () => {
    it('nennt jede nicht geprüfte Datei in Diff-Reihenfolge — keine gekürzte Liste', () => {
        expect(formatDraftPartialNotice(['src/lib/a.ts', 'src/lib/b.ts', 'src/lib/c.ts'])).toBe(
            'Reduced coverage: the AI review failed on 3 files — not reviewed: src/lib/a.ts, src/lib/b.ts, src/lib/c.ts.',
        );
    });

    it('bildet den Singular', () => {
        expect(formatDraftPartialNotice(['src/lib/only.ts'])).toBe(
            'Reduced coverage: the AI review failed on 1 file — not reviewed: src/lib/only.ts.',
        );
    });

    it('nennt einen belegten Grund im selben Satz', () => {
        expect(formatDraftPartialNotice(['scripts/collect-dump.ps1'], 'content_filter')).toBe(
            "Reduced coverage: the AI review failed on 1 file because the model provider's content filter "
            + 'withheld the answer — not reviewed: scripts/collect-dump.ps1.',
        );
        expect(formatDraftPartialNotice(['src/lib/a.ts', 'src/lib/b.ts'], 'empty_answer')).toBe(
            'Reduced coverage: the AI review failed on 2 files because the model returned an empty answer '
            + '— not reviewed: src/lib/a.ts, src/lib/b.ts.',
        );
    });

    it('schweigt bei vollständigem Draft oder fehlendem Feld (Ergebnis vor 2026-09-29)', () => {
        expect(formatDraftPartialNotice([])).toBeNull();
        expect(formatDraftPartialNotice(undefined)).toBeNull();
    });
});

describe('formatPrescanUnavailableNotice (ausgefallener Pre-Scan neben einer Modell-Review)', () => {
    it('sagt, dass nur das Modell gelesen hat, ohne einen Re-Run zu versprechen', () => {
        expect(formatPrescanUnavailableNotice(true)).toBe(
            'Reduced coverage: the deterministic pre-scanner failed on this change — only the model review ran, '
            + 'and files it does not read were not checked.',
        );
    });

    it('nennt bei einem Teilausfall jede Datei ohne Pre-Scan (Datei-Batches)', () => {
        expect(formatPrescanUnavailableNotice(true, ['src/a.ts', 'infra/main.tf'])).toBe(
            'Reduced coverage: the deterministic pre-scanner failed on 2 files — not checked by it: src/a.ts, infra/main.tf.',
        );
        expect(formatPrescanUnavailableNotice(true, ['src/a.ts'])).toContain('failed on 1 file — ');
        expect(formatPrescanUnavailableNotice(true, [])).toContain('failed on this change');
        expect(formatPrescanUnavailableNotice(false, ['src/a.ts'])).toBeNull();
    });

    it('nennt höchstens 50 Dateien beim Namen und sagt, wie viele fehlen', () => {
        const manyFiles = Array.from({ length: 53 }, (_unused, fileIndex) => `src/module-${fileIndex}.ts`);

        const cappedNotice = formatPrescanUnavailableNotice(true, manyFiles);

        expect(cappedNotice).toContain('failed on 53 files');
        expect(cappedNotice).toContain('src/module-49.ts, and 3 more (full list in the job result).');
        expect(cappedNotice).not.toContain('src/module-50.ts');
    });

    it('schweigt, wenn der Pre-Scan lief oder für das Repo abgeschaltet ist', () => {
        expect(formatPrescanUnavailableNotice(false)).toBeNull();
        expect(formatPrescanUnavailableNotice(undefined)).toBeNull();
    });
});

describe('formatDraftRound2Notice (zweite Draft-Runde, SPEC.md §12.5.2)', () => {
    it('sagt bei übersprungener oder gescheiterter Runde, dass erste Runde und Verifikation voll liefen', () => {
        expect(formatDraftRound2Notice(['draft_round2_skipped_deadline'])).toBe(
            'Reduced coverage: the second review pass was skipped for part of this change because too little time was left; '
            + 'the first pass and the verification ran in full.',
        );
        expect(formatDraftRound2Notice(['cache_fallback', 'draft_round2_failed'])).toBe(
            'Reduced coverage: the second review pass failed for part of this change; the first pass and the verification ran in full.',
        );
    });

    it('schweigt, wenn die Runde überall lief oder aus war', () => {
        expect(formatDraftRound2Notice([])).toBeNull();
        expect(formatDraftRound2Notice(undefined)).toBeNull();
        expect(formatDraftRound2Notice(['time_budget_exhausted'])).toBeNull();
    });
});
