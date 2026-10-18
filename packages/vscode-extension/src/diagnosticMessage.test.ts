/**
 * Unit Tests: Meldungstext eines Findings im Problems-Panel, KI-Label je
 * Finding (LEGAL_PAGES_SPEC §4a.3, V11-Rest): ein Modell-Finding trägt es,
 * ein Pre-Scan-Finding nicht.
 */
import { describe, expect, it } from 'vitest';
import type { ScanIssue } from '@unslop/shared';
import { AI_GENERATED_FINDING_NOTICE, STALE_SUFFIX, buildDiagnosticMessage } from './diagnosticMessage';

const modelFinding: ScanIssue = {
    id: '0123456789abcdef',
    rule: 'COND-001 (Silent Error Swallowing)',
    severity: 'CRITICAL',
    path: 'src/lib/example.ts',
    line: 12,
    endLine: 12,
    exactQuote: 'catch (e) {}',
    critique: 'Empty catch block.',
    verification: 'confirmed',
};

describe('buildDiagnosticMessage — KI-Label je Finding', () => {
    it('labels a model finding as AI-generated', () => {
        expect(buildDiagnosticMessage(modelFinding, false))
            .toBe(`Silent Error Swallowing: Empty catch block.\n${AI_GENERATED_FINDING_NOTICE}`);
    });

    it('labels a finding without a verification status (label when in doubt)', () => {
        const { verification: omittedVerification, ...legacyFinding } = modelFinding;
        void omittedVerification;

        expect(buildDiagnosticMessage(legacyFinding, false)).toContain(AI_GENERATED_FINDING_NOTICE);
    });

    it('never labels a pre-scan finding', () => {
        const prescanFinding: ScanIssue = { ...modelFinding, rule: 'SEC-005 (Hardcoded secret)', verification: 'deterministic' };

        expect(buildDiagnosticMessage(prescanFinding, false)).toBe('Hardcoded secret: Empty catch block.');
    });

    it('keeps occurrences, fix advice and the stale marker before the label', () => {
        const aggregatedFinding: ScanIssue = {
            ...modelFinding,
            fixAdvice: 'Rethrow the error.',
            occurrences: [
                { line: 12, endLine: 12, exactQuote: 'catch (e) {}' },
                { line: 18, endLine: 18, exactQuote: 'catch (e) {}' },
            ],
        };

        expect(buildDiagnosticMessage(aggregatedFinding, true)).toBe(
            'Silent Error Swallowing: Empty catch block. [2 occurrences in this file: lines 12, 18]\nHow to fix: Rethrow the error.'
            + `${STALE_SUFFIX}\n${AI_GENERATED_FINDING_NOTICE}`,
        );
    });
});

describe('buildDiagnosticMessage — Regel-Titel in der Meldung (Code trägt nur die ID)', () => {
    const deterministicFinding: ScanIssue = { ...modelFinding, verification: 'deterministic' };

    it('stellt den Klammer-Titel der Kritik voran', () => {
        const lexicalFinding: ScanIssue = { ...deterministicFinding, rule: 'COND-003 (Lexical Slop)' };

        expect(buildDiagnosticMessage(lexicalFinding, false)).toBe('Lexical Slop: Empty catch block.');
    });

    it('stellt den Doppelpunkt-Titel der Kritik voran', () => {
        const secretFinding: ScanIssue = { ...deterministicFinding, rule: 'SEC-005: Hardcoded secret' };

        expect(buildDiagnosticMessage(secretFinding, false)).toBe('Hardcoded secret: Empty catch block.');
    });

    it('lässt die Kritik ohne Präfix, wenn das Label keinen Titel trägt', () => {
        expect(buildDiagnosticMessage({ ...deterministicFinding, rule: 'SEC-012' }, false)).toBe('Empty catch block.');
        expect(buildDiagnosticMessage({ ...deterministicFinding, rule: 'Deep review' }, false)).toBe('Empty catch block.');
    });
});
