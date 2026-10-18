/**
 * Hinweiszeile für Zeit-Skips (DEADLINE_GUARD_SPEC.md §3.4) — dieselbe
 * Formulierung auf Check, GitHub-Review und CLI.
 */
import { describe, expect, it } from 'vitest';
import {
    formatDraftPartialNotice, formatPrescanUnavailableNotice, formatTimeBudgetNotice,
} from './degradation-notice.js';

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

    it('schweigt, wenn der Pre-Scan lief oder für das Repo abgeschaltet ist', () => {
        expect(formatPrescanUnavailableNotice(false)).toBeNull();
        expect(formatPrescanUnavailableNotice(undefined)).toBeNull();
    });
});
