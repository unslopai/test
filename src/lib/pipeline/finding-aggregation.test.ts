/**
 * Unit Tests: Finding-Aggregation pro Rule+File (ROADMAP §7).
 *
 * Kern-Invarianten: Aggregation ist deterministisch, der Anker (line/endLine/
 * exactQuote) ist IMMER das erste Vorkommen (Finding-ID-Stabilität), und die
 * Prescan-Dedupe entfernt nur kollidierende VORKOMMEN, nie blind das Aggregat.
 */
import { describe, expect, it } from 'vitest';
import {
    aggregateIssuesByRuleAndFile,
    subtractPrescanOverlaps,
} from '@/lib/pipeline/finding-aggregation';
import { buildReviewIssue } from '@/lib/pipeline/testing/context-fixture';

describe('aggregateIssuesByRuleAndFile', () => {
    it('bündelt gleiche Rule+File-Vorkommen zu EINEM Finding mit sortierter occurrences-Liste', () => {
        const aggregatedIssues = aggregateIssuesByRuleAndFile([
            buildReviewIssue({ line: 18, endLine: 18, exactQuote: '// ✨ magic' }),
            buildReviewIssue({ line: 12, endLine: 12, exactQuote: '// 🚀 blazing' }),
            buildReviewIssue({ line: 25, endLine: 28, exactQuote: '// 🎉 party block' }),
        ]);

        expect(aggregatedIssues).toHaveLength(1);
        const [aggregatedIssue] = aggregatedIssues;
        expect(aggregatedIssue.occurrences).toEqual([
            { line: 12, endLine: 12, exactQuote: '// 🚀 blazing' },
            { line: 18, endLine: 18, exactQuote: '// ✨ magic' },
            { line: 25, endLine: 28, exactQuote: '// 🎉 party block' },
        ]);
        // Anker = erstes Vorkommen — daran hängen Finding-ID und Apply-Contract.
        expect(aggregatedIssue.line).toBe(12);
        expect(aggregatedIssue.endLine).toBe(12);
        expect(aggregatedIssue.exactQuote).toBe('// 🚀 blazing');
    });

    it('lässt Einzel-Findings unverändert passieren (kein occurrences-Feld)', () => {
        const singleIssue = buildReviewIssue({ rule: 'SEC-001 (Krypto)', path: 'src/a.ts' });

        const [passedThroughIssue] = aggregateIssuesByRuleAndFile([singleIssue]);

        expect(passedThroughIssue).toBe(singleIssue);
        expect(passedThroughIssue.occurrences).toBeUndefined();
    });

    it('trennt Gruppen nach Datei und nach bare Rule-ID, nicht nach dem Präsentations-String', () => {
        const aggregatedIssues = aggregateIssuesByRuleAndFile([
            buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', path: 'src/a.ts', line: 5 }),
            buildReviewIssue({ rule: 'MAINT-001 (swallowed error)', path: 'src/a.ts', line: 9 }),
            buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', path: 'src/b.ts', line: 5 }),
            buildReviewIssue({ rule: 'SEC-001 (Krypto)', path: 'src/a.ts', line: 7 }),
        ]);

        expect(aggregatedIssues).toHaveLength(3);
        const [maintAggregate] = aggregatedIssues;
        expect(maintAggregate.occurrences).toHaveLength(2);
    });

    it('eskaliert die Severity des Aggregats konservativ auf CRITICAL', () => {
        const [aggregatedIssue] = aggregateIssuesByRuleAndFile([
            buildReviewIssue({ severity: 'WARNING', line: 3 }),
            buildReviewIssue({ severity: 'CRITICAL', line: 9 }),
        ]);

        expect(aggregatedIssue.severity).toBe('CRITICAL');
    });

    it('übernimmt die MINIMALE definierte Confidence (pro-direct, Richtung Eskalation)', () => {
        const [aggregatedIssue] = aggregateIssuesByRuleAndFile([
            buildReviewIssue({ line: 3, confidence: 95 }),
            buildReviewIssue({ line: 9, confidence: 61 }),
        ]);

        expect(aggregatedIssue.confidence).toBe(61);
    });

    it('lässt confidence weg, wenn kein Vorkommen eine trägt (flash-cascade vor Verifikation)', () => {
        const [aggregatedIssue] = aggregateIssuesByRuleAndFile([
            buildReviewIssue({ line: 3 }),
            buildReviewIssue({ line: 9 }),
        ]);

        expect(aggregatedIssue.confidence).toBeUndefined();
    });

    it('behält den fixedCodeSnippet des ersten Vorkommens (Anker-Zeilen des Snippets)', () => {
        const [aggregatedIssue] = aggregateIssuesByRuleAndFile([
            buildReviewIssue({ line: 9, fixedCodeSnippet: 'const other = 1;' }),
            buildReviewIssue({ line: 3, fixedCodeSnippet: 'const anchor = 1;' }),
        ]);

        expect(aggregatedIssue.fixedCodeSnippet).toBe('const anchor = 1;');
    });

    it('ist deterministisch: gleiche Eingabe in anderer Reihenfolge ⇒ gleiches Aggregat', () => {
        const firstOccurrence = buildReviewIssue({ line: 12, exactQuote: 'a' });
        const secondOccurrence = buildReviewIssue({ line: 18, exactQuote: 'b' });

        const [forwardAggregate] = aggregateIssuesByRuleAndFile([firstOccurrence, secondOccurrence]);
        const [reversedAggregate] = aggregateIssuesByRuleAndFile([secondOccurrence, firstOccurrence]);

        expect(reversedAggregate).toEqual(forwardAggregate);
    });
});

describe('subtractPrescanOverlaps — occurrence-genaue Dedupe am Merge-Punkt', () => {
    const prescanCollision = buildReviewIssue({
        rule: 'MAINT-001 (Empty catch)',
        path: 'src/lib/example.ts',
        line: 12,
        endLine: 12,
        source: 'pre-scanner',
    });

    function buildAggregate() {
        const [aggregatedIssue] = aggregateIssuesByRuleAndFile([
            buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', line: 12, endLine: 12, exactQuote: 'q12', fixedCodeSnippet: 'fix12' }),
            buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', line: 18, endLine: 18, exactQuote: 'q18' }),
            buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', line: 25, endLine: 28, exactQuote: 'q25' }),
        ]);
        return aggregatedIssue;
    }

    it('droppt ein Einzel-Issue bei Kollision komplett (Alt-Verhalten)', () => {
        const singleIssue = buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', line: 12, endLine: 12 });

        expect(subtractPrescanOverlaps(singleIssue, [prescanCollision])).toBeNull();
    });

    it('lässt ein Issue ohne Rule- oder Datei-Match unangetastet', () => {
        const unrelatedIssue = buildReviewIssue({ rule: 'SEC-001 (Krypto)', line: 12, endLine: 12 });

        expect(subtractPrescanOverlaps(unrelatedIssue, [prescanCollision])).toBe(unrelatedIssue);
    });

    it('entfernt aus einem Aggregat NUR das kollidierende Vorkommen und re-verankert', () => {
        const reducedIssue = subtractPrescanOverlaps(buildAggregate(), [prescanCollision]);

        expect(reducedIssue).not.toBeNull();
        expect(reducedIssue!.occurrences).toEqual([
            { line: 18, endLine: 18, exactQuote: 'q18' },
            { line: 25, endLine: 28, exactQuote: 'q25' },
        ]);
        expect(reducedIssue!.line).toBe(18);
        expect(reducedIssue!.exactQuote).toBe('q18');
        // Der Snippet gehörte zum entfernten Anker-Vorkommen — er darf nie
        // an einem anderen Vorkommen landen.
        expect(reducedIssue!.fixedCodeSnippet).toBeUndefined();
    });

    it('degradiert ein Aggregat mit einem Rest-Vorkommen zum Einzel-Finding', () => {
        const twoMorePrescanHits = [
            prescanCollision,
            buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', line: 18, endLine: 18, source: 'pre-scanner' }),
        ];

        const reducedIssue = subtractPrescanOverlaps(buildAggregate(), twoMorePrescanHits);

        expect(reducedIssue!.occurrences).toBeUndefined();
        expect(reducedIssue!.line).toBe(25);
        expect(reducedIssue!.endLine).toBe(28);
    });

    it('liefert null, wenn ALLE Vorkommen von Prescan-Findings abgedeckt sind', () => {
        const fullCoverage = [
            prescanCollision,
            buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', line: 18, endLine: 18, source: 'pre-scanner' }),
            buildReviewIssue({ rule: 'MAINT-001 (Empty catch)', line: 26, endLine: 26, source: 'pre-scanner' }),
        ];

        expect(subtractPrescanOverlaps(buildAggregate(), fullCoverage)).toBeNull();
    });

    it('behält den Snippet, wenn das Anker-Vorkommen überlebt', () => {
        const nonAnchorCollision = buildReviewIssue({
            rule: 'MAINT-001 (Empty catch)', line: 18, endLine: 18, source: 'pre-scanner',
        });

        const reducedIssue = subtractPrescanOverlaps(buildAggregate(), [nonAnchorCollision]);

        expect(reducedIssue!.line).toBe(12);
        expect(reducedIssue!.fixedCodeSnippet).toBe('fix12');
        expect(reducedIssue!.occurrences).toEqual([
            { line: 12, endLine: 12, exactQuote: 'q12' },
            { line: 25, endLine: 28, exactQuote: 'q25' },
        ]);
    });
});
