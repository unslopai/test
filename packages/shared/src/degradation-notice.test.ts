/**
 * Hinweiszeile für Zeit-Skips (DEADLINE_GUARD_SPEC.md §3.4) — dieselbe
 * Formulierung auf Check, GitHub-Review und CLI.
 */
import { describe, expect, it } from 'vitest';
import { formatTimeBudgetNotice } from './degradation-notice.js';

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
