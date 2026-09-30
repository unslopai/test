/**
 * Unit Tests: Regel der KI-Kennzeichnung (Art. 50 Abs. 2 KI-VO, LEGAL_PAGES_SPEC §4a.3).
 *
 * Gekennzeichnet wird, woran ein Modell beteiligt war, und nur das.
 */
import { describe, expect, it } from 'vitest';
import {
    AI_GENERATED_MARKER,
    AI_GENERATED_NOTICE,
    appendAiDisclosure,
    isAiGeneratedFinding,
    isAiGeneratedRun,
} from '@/lib/ai-disclosure';

describe('isAiGeneratedRun', () => {
    it('nur ein Lauf mit Modell-Review ist KI-generiert', () => {
        expect(isAiGeneratedRun('reviewed', false)).toBe(true);
        expect(isAiGeneratedRun('deterministic_only', true)).toBe(false);
        expect(isAiGeneratedRun('nothing_reviewed', false)).toBe(false);
    });

    it('ein Short-Circuit des Pre-Scanners heißt reviewed, ist aber nicht KI-generiert', () => {
        expect(isAiGeneratedRun('reviewed', true)).toBe(false);
    });
});

describe('isAiGeneratedFinding', () => {
    it('ein Pre-Scan-Finding ist nicht KI-generiert', () => {
        expect(isAiGeneratedFinding({ verification: 'deterministic' })).toBe(false);
    });

    it('jedes Finding der Modell-Lane ist KI-generiert, unabhängig vom Verifikationsstatus', () => {
        expect(isAiGeneratedFinding({ verification: 'confirmed' })).toBe(true);
        expect(isAiGeneratedFinding({ verification: 'uncertain' })).toBe(true);
        expect(isAiGeneratedFinding({ verification: 'self_reported' })).toBe(true);
        expect(isAiGeneratedFinding({ verification: 'unverified' })).toBe(true);
    });

    it('kennzeichnet im Zweifel: ein Finding ohne Status zählt als Modell-Finding', () => {
        expect(isAiGeneratedFinding({})).toBe(true);
    });
});

describe('appendAiDisclosure', () => {
    it('hängt sichtbares Label und maschinenlesbaren Marker ans Ende, die erste Zeile bleibt', () => {
        const labelledBody = appendAiDisclosure('## Review headline\n\nBody.');

        expect(labelledBody.split('\n')[0]).toBe('## Review headline');
        expect(labelledBody.endsWith(`${AI_GENERATED_NOTICE}\n${AI_GENERATED_MARKER}`)).toBe(true);
    });

    it('das Label nennt „AI-generated“, der Marker ist ein HTML-Kommentar', () => {
        expect(AI_GENERATED_NOTICE).toContain('AI-generated');
        expect(AI_GENERATED_MARKER).toBe('<!-- unslop:ai-generated -->');
    });
});
