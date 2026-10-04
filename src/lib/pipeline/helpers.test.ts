/**
 * Unit Tests: Validation Boundary für LLM-JSON (ARCH-002).
 *
 * Anlass: gemini-3.1-pro-preview hängt an ein valides Objekt eine überzählige
 * schließende Klammer an (finishReason STOP, kein Abbruch) — der naive
 * JSON.parse riss damit den kompletten pro-direct-Review in den Job-Fehler.
 */
import { describe, expect, it } from 'vitest';
import { buildInlineComments, extractTokenUsage, formatReviewSummary, parseModelJson } from '@/lib/pipeline/helpers';
import { buildReviewIssue } from '@/lib/pipeline/testing/context-fixture';

interface ReviewShape {
    has_slop: boolean;
    summary: string;
}

describe('parseModelJson', () => {
    it('parses a clean JSON object', () => {
        const parsed = parseModelJson<ReviewShape>('{"has_slop": false, "summary": "clean"}', 'Test');
        expect(parsed.summary).toBe('clean');
    });

    it('tolerates the trailing brace emitted by the Pro preview model', () => {
        const parsed = parseModelJson<ReviewShape>('{\n "has_slop": true,\n "summary": "slop"\n}\n}', 'Test');
        expect(parsed.has_slop).toBe(true);
        expect(parsed.summary).toBe('slop');
    });

    it('ignores markdown fences and trailing prose around the object', () => {
        const fencedResponse = '```json\n{"has_slop": false, "summary": "ok"}\n```\nHope this helps!';
        expect(parseModelJson<ReviewShape>(fencedResponse, 'Test').summary).toBe('ok');
    });

    it('does not truncate at braces inside string values', () => {
        const responseWithBracesInStrings =
            '{"has_slop": true, "summary": "use interface{} sparingly \\" and }} carefully"}';
        const parsed = parseModelJson<ReviewShape>(responseWithBracesInStrings, 'Test');
        expect(parsed.summary).toBe('use interface{} sparingly " and }} carefully');
    });

    it('parses a top-level array response', () => {
        const parsed = parseModelJson<number[]>('[1, 2, 3]\ntrailing', 'Test');
        expect(parsed).toEqual([1, 2, 3]);
    });

    it('throws with context and preview on an empty response', () => {
        expect(() => parseModelJson('   ', 'Reviewer')).toThrowError(/\[Reviewer\] Modellantwort ist leer/);
    });

    it('throws when no parsable JSON is present at all', () => {
        expect(() => parseModelJson('I refuse to answer.', 'Reviewer'))
            .toThrowError(/kein gültiges JSON/);
    });

    it('throws on a truncated object instead of silently returning a fragment', () => {
        expect(() => parseModelJson('{"has_slop": true, "issues": [{"rule": "x"', 'Reviewer'))
            .toThrowError(/kein gültiges JSON/);
    });

    it('repariert rohe Steuerzeichen (literales Tab) in einem String-Literal', () => {
        // Gemini-Fehlermodus: tab-eingerückter Go-Code wörtlich in exact_quote,
        // das Tab bleibt unescaped im JSON-String -> JSON.parse würde hart scheitern.
        const responseWithRawTab =
            '{"has_slop": true, "exact_quote": "\tledger.counts[id]++", "summary": "ok"}';
        const parsed = parseModelJson<ReviewShape & { exact_quote: string }>(responseWithRawTab, 'Reviewer');
        expect(parsed.has_slop).toBe(true);
        expect(parsed.exact_quote).toBe('\tledger.counts[id]++');
    });

    it('repariert ein rohes Newline in einem mehrzeiligen String-Literal', () => {
        const responseWithRawNewline =
            '{"has_slop": true, "critique": "line one\nline two", "summary": "ok"}';
        const parsed = parseModelJson<ReviewShape & { critique: string }>(responseWithRawNewline, 'Reviewer');
        expect(parsed.critique).toBe('line one\nline two');
    });

    it('lässt gültiges JSON mit bereits escapten Steuerzeichen unverändert', () => {
        const parsed = parseModelJson<ReviewShape & { critique: string }>(
            '{"has_slop": false, "critique": "tab:\\tend", "summary": "ok"}', 'Reviewer',
        );
        expect(parsed.critique).toBe('tab:\tend');
    });

    describe('unescapte Anführungszeichen in zitiertem Code (gemini-3.8-flash, Probe 2026-09-17)', () => {
        interface QuotedIssueShape {
            has_slop: boolean;
            issues: { exact_quote: string; fixed_code_snippet: string; confidence: number }[];
            summary: string;
        }

        it('repariert JSX-Attribute mit unescapten Quotes in exact_quote UND fixed_code_snippet', () => {
            // Wörtlich aus dem r20-pro-direct-Probe (2 von 4 Calls): finishReason
            // STOP, Klammern balanciert, JSON.parse stirbt in Zeile 54.
            const degenerateResponse =
                '{\n  "has_slop": true,\n  "issues": [\n    {\n' +
                '      "exact_quote": "      <div className="comment__rich-text" dangerouslySetInnerHTML={{ __html: bodyHtml }} />",\n' +
                '      "fixed_code_snippet": "      <div className="comment__rich-text">{bodyHtml}</div>",\n' +
                '      "confidence": 98\n    }\n  ],\n  "summary": "XSS via dangerouslySetInnerHTML."\n}';
            const parsed = parseModelJson<QuotedIssueShape>(degenerateResponse, 'Reviewer');
            expect(parsed.issues).toHaveLength(1);
            expect(parsed.issues[0].exact_quote)
                .toBe('      <div className="comment__rich-text" dangerouslySetInnerHTML={{ __html: bodyHtml }} />');
            expect(parsed.issues[0].fixed_code_snippet).toBe('      <div className="comment__rich-text">{bodyHtml}</div>');
            expect(parsed.issues[0].confidence).toBe(98);
        });

        it('hält String-Literale mit Komma im zitierten Code zusammen (foo("a", "b"))', () => {
            const degenerateResponse =
                '{"has_slop": true, "issues": [{"exact_quote": "run("a", "b")", "fixed_code_snippet": "run(safeA, safeB)", ' +
                '"confidence": 70}], "summary": "ok"}';
            const parsed = parseModelJson<QuotedIssueShape>(degenerateResponse, 'Reviewer');
            expect(parsed.issues[0].exact_quote).toBe('run("a", "b")');
            expect(parsed.issues[0].fixed_code_snippet).toBe('run(safeA, safeB)');
        });

        it('kombiniert Quote- und Steuerzeichen-Reparatur (Tab-Einrückung plus Quotes)', () => {
            const degenerateResponse =
                '{"has_slop": true, "issues": [{"exact_quote": "\tlog.Printf("id=%d", id)", "fixed_code_snippet": "x", ' +
                '"confidence": 60}], "summary": "ok"}';
            const parsed = parseModelJson<QuotedIssueShape>(degenerateResponse, 'Reviewer');
            expect(parsed.issues[0].exact_quote).toBe('\tlog.Printf("id=%d", id)');
        });

        it('lässt korrekt escapte Quotes unverändert (Idempotenz auf gültigem JSON)', () => {
            const validResponse =
                '{"has_slop": true, "issues": [{"exact_quote": "<div className=\\"x\\" />", "fixed_code_snippet": "y", ' +
                '"confidence": 90}], "summary": "ok"}';
            const parsed = parseModelJson<QuotedIssueShape>(validResponse, 'Reviewer');
            expect(parsed.issues[0].exact_quote).toBe('<div className="x" />');
        });

        it('wirft weiterhin den Originalfehler, wenn auch die Reparatur kein JSON ergibt', () => {
            expect(() => parseModelJson('{"has_slop": true, "issues": [{"exact_quote": "a"b"', 'Reviewer'))
                .toThrowError(/kein gültiges JSON/);
        });
    });
});

// =============================================================================
// Aggregierte Findings im GitHub-Rendering (ROADMAP §7)
// =============================================================================

describe('buildInlineComments — aggregierte Findings', () => {
    const aggregatedIssue = buildReviewIssue({
        rule: 'Condition 3 (Lexical Slop)',
        line: 12,
        endLine: 12,
        exactQuote: '// 🚀 blazing',
        occurrences: [
            { line: 12, endLine: 12, exactQuote: '// 🚀 blazing' },
            { line: 18, endLine: 18, exactQuote: '// ✨ magic' },
            { line: 25, endLine: 28, exactQuote: '// 🎉 party block' },
        ],
    });

    it('postet EINEN Kommentar am ersten Vorkommen und listet alle Fundstellen im Body', () => {
        const [inlineComment] = buildInlineComments([aggregatedIssue]);

        expect(inlineComment.line).toBe(12);
        expect(inlineComment.start_line).toBeUndefined();
        expect(inlineComment.body).toContain('3 occurrences in this file');
        expect(inlineComment.body).toContain('lines 12, 18, 25-28');
    });

    it('hält den Body eines Einzel-Findings frei von der Occurrences-Zeile', () => {
        const [inlineComment] = buildInlineComments([buildReviewIssue({})]);

        expect(inlineComment.body).not.toContain('occurrences in this file');
    });
});

describe('formatReviewSummary — aggregierte unverankerte Findings', () => {
    it('referenziert alle Vorkommen eines Aggregats als Zeilenliste', () => {
        const summaryMarkdown = formatReviewSummary(
            [],
            'Summary.',
            [buildReviewIssue({
                path: 'src/lib/example.ts',
                line: 12,
                occurrences: [
                    { line: 12, endLine: 12, exactQuote: 'a' },
                    { line: 18, endLine: 18, exactQuote: 'b' },
                ],
            })],
        );

        expect(summaryMarkdown).toContain('`src/lib/example.ts` — lines 12, 18');
        expect(summaryMarkdown).not.toContain('src/lib/example.ts:12`');
    });
});

describe('extractTokenUsage — abrechnungstreue Output-Zählung', () => {
    it('zählt Thinking-Tokens zum Output (Vertex berechnet sie zum Output-Preis)', () => {
        const tokenUsage = extractTokenUsage(
            { promptTokenCount: 1200, cachedContentTokenCount: 900, candidatesTokenCount: 40, thoughtsTokenCount: 310 },
            'gemini-3.8-flash',
        );

        expect(tokenUsage).toEqual({ promptTokens: 1200, cachedTokens: 900, outputTokens: 350, model: 'gemini-3.8-flash' });
    });

    it('ohne thoughtsTokenCount bleibt der Output die reine Antwort', () => {
        const tokenUsage = extractTokenUsage({ candidatesTokenCount: 40 }, 'gemini-3.6-flash');

        expect(tokenUsage.outputTokens).toBe(40);
    });

    it('fehlende usageMetadata liefert Nullen statt NaN', () => {
        expect(extractTokenUsage(undefined, 'gemini-3.6-flash').outputTokens).toBe(0);
    });
});
