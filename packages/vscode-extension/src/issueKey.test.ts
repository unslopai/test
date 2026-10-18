/**
 * Unit Tests: Diagnostic-Code (nackte Regel-ID) und die Auflösung eines
 * Diagnostics zurück auf den Store-Schlüssel seines Findings — der Schlüssel
 * der Diagnostic-Seite muss gleich dem der Issue-Seite sein.
 */
import { describe, expect, it } from 'vitest';
import type { ScanIssue } from '@unslop/shared';
import { buildDiagnosticMessage } from './diagnosticMessage';
import type { TrackedFinding } from './findingsStore';
import { diagnosticCodeOf, issueKeyOf, resolveIssueKey } from './issueKey';
import type { DiagnosticAnchor } from './issueKey';

const lexicalFinding: ScanIssue = {
    id: '0123456789abcdef',
    rule: 'COND-003 (Lexical Slop)',
    severity: 'WARNING',
    path: 'src/lib/example.ts',
    line: 12,
    endLine: 12,
    exactQuote: '// blazing fast',
    critique: 'Marketing adjective in a comment.',
    verification: 'confirmed',
};

/** Store-Seite: Schlüssel aus dem vollen Label, wie FindingsStore.replaceAll ihn setzt. */
function keyedFindingsOf(trackedFindings: readonly TrackedFinding[]): Map<string, TrackedFinding> {
    return new Map(trackedFindings.map((tracked) => [issueKeyOf(tracked.issue.line, tracked.issue.rule), tracked]));
}

/** Diagnostic-Seite: was buildDiagnostic in Range, Code und Meldung schreibt. */
function anchorOf(tracked: TrackedFinding): DiagnosticAnchor {
    return {
        line: tracked.issue.line,
        code: diagnosticCodeOf(tracked.issue),
        message: buildDiagnosticMessage(tracked.issue, tracked.stale),
    };
}

describe('diagnosticCodeOf', () => {
    it('liefert die nackte Regel-ID statt des Labels mit Titel', () => {
        expect(diagnosticCodeOf(lexicalFinding)).toBe('COND-003');
        expect(diagnosticCodeOf({ rule: 'SEC-005: Hardcoded secret' })).toBe('SEC-005');
    });

    it('fällt ohne ID-Präfix auf das ganze Label zurück', () => {
        expect(diagnosticCodeOf({ rule: 'Deep review' })).toBe('Deep review');
    });
});

describe('resolveIssueKey — Schlüssel-Gleichheit Diagnostic vs. Issue', () => {
    it('löst ein Diagnostic auf den Schlüssel seines Findings auf', () => {
        const tracked: TrackedFinding = { issue: lexicalFinding, stale: false };

        expect(resolveIssueKey(anchorOf(tracked), keyedFindingsOf([tracked])))
            .toBe(issueKeyOf(lexicalFinding.line, lexicalFinding.rule));
    });

    it('löst auch ein stale markiertes Finding auf', () => {
        const tracked: TrackedFinding = { issue: lexicalFinding, stale: true };

        expect(resolveIssueKey(anchorOf(tracked), keyedFindingsOf([tracked])))
            .toBe(issueKeyOf(lexicalFinding.line, lexicalFinding.rule));
    });

    it('hält zwei Regeln auf derselben Zeile auseinander', () => {
        const lexicalTracked: TrackedFinding = { issue: lexicalFinding, stale: false };
        const swallowTracked: TrackedFinding = {
            issue: { ...lexicalFinding, rule: 'COND-001 (Silent Error Swallowing)', critique: 'Empty catch block.' },
            stale: false,
        };
        const keyedFindings = keyedFindingsOf([lexicalTracked, swallowTracked]);

        expect(resolveIssueKey(anchorOf(lexicalTracked), keyedFindings)).toBe(issueKeyOf(12, 'COND-003 (Lexical Slop)'));
        expect(resolveIssueKey(anchorOf(swallowTracked), keyedFindings))
            .toBe(issueKeyOf(12, 'COND-001 (Silent Error Swallowing)'));
    });

    it('trennt zwei Findings mit derselben Bare-ID auf derselben Zeile über die Meldung', () => {
        // Der Server hält HAL-002-Import-Claims getrennt von den übrigen HAL-002-Befunden.
        const importTracked: TrackedFinding = {
            issue: { ...lexicalFinding, rule: 'HAL-002 (Import does not exist)', critique: 'Package is not installed.' },
            stale: false,
        };
        const patternTracked: TrackedFinding = {
            issue: { ...lexicalFinding, rule: 'HAL-002 (anti_pattern)', critique: 'Invented API.' },
            stale: false,
        };
        const keyedFindings = keyedFindingsOf([importTracked, patternTracked]);

        expect(resolveIssueKey(anchorOf(importTracked), keyedFindings))
            .toBe(issueKeyOf(12, 'HAL-002 (Import does not exist)'));
        expect(resolveIssueKey(anchorOf(patternTracked), keyedFindings)).toBe(issueKeyOf(12, 'HAL-002 (anti_pattern)'));
    });

    it('liefert undefined statt eines fremden Findings, wenn nichts eindeutig passt', () => {
        const tracked: TrackedFinding = { issue: lexicalFinding, stale: false };
        const otherLineAnchor: DiagnosticAnchor = { ...anchorOf(tracked), line: 13 };

        expect(resolveIssueKey(otherLineAnchor, keyedFindingsOf([tracked]))).toBeUndefined();
    });
});
