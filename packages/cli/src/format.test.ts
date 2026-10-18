/**
 * Unit Tests: Terminal-Ausgabe ist frei von ANSI-/OSC-Injektion (ROADMAP §12).
 *
 * critique/rule/path/summary/fixedCodeSnippet sind modell-authored. Eine
 * Escape-Sequenz darin dürfte NIE das Terminal erreichen — sie könnte den
 * Tab-Titel setzen, Hyperlinks fälschen oder gedruckte Zeilen überschreiben.
 * Die Payloads werden per fromCharCode gebaut, damit diese Testdatei selbst
 * keine rohen Steuerbytes enthält.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { printHumanResult } from './format.js';
import { sanitizeModelText } from '@unslop/shared/node';
import type { ScanIssue, ScanResult } from '@unslop/shared';

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
const C1_CSI = String.fromCharCode(0x9b);

/** OSC 0 — setzt den Terminal-Titel; terminiert mit BEL. */
const OSC_TITLE_ATTACK = `${ESC}]0;pwned-title${BEL}`;
/** OSC 8 — gefälschter Hyperlink; terminiert mit ST (ESC \). */
const OSC_HYPERLINK_ATTACK = `${ESC}]8;;https://evil.example${ESC}\\click me${ESC}]8;;${ESC}\\`;
/** CSI — Cursor 10 Zeilen hoch + Zeile löschen (überschreibt echte Ausgabe). */
const CSI_OVERWRITE_ATTACK = `${ESC}[10A${ESC}[2K`;

/** true, wenn der Text noch irgendein C0-(außer LF/Tab)-, DEL- oder C1-Byte enthält. */
function containsControlBytes(renderedText: string): boolean {
    return [...renderedText].some((character) => {
        const codePoint = character.charCodeAt(0);
        if (codePoint === 0x0a || codePoint === 0x09) return false;
        return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
    });
}

function buildInfectedScanResult(): ScanResult {
    return {
        hasSlop: true,
        issues: [{
            id: 'abcdef0123456789',
            rule: `Condition 1 (Silent Error Swallowing)${CSI_OVERWRITE_ATTACK}`,
            severity: 'CRITICAL',
            path: `src/lib/example.ts${OSC_TITLE_ATTACK}`,
            line: 42,
            endLine: 42,
            exactQuote: 'catch (e) {}',
            critique: `Empty catch block.${OSC_HYPERLINK_ATTACK} Swallows every error.`,
            fixedCodeSnippet: `throw error;${C1_CSI}2K`,
        }],
        summary: `One critical finding.${OSC_TITLE_ATTACK}`,
        filesReviewed: 1,
        outcome: 'reviewed',
        omittedFiles: [],
        cognitiveIntegrityScore: 95,
    };
}

describe('printHumanResult — ANSI-/OSC-Sanitization (ROADMAP §12)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('druckt keine einzige Escape-/Steuersequenz aus Modelltext', () => {
        const loggedLines: string[] = [];
        vi.spyOn(console, 'log').mockImplementation((printedLine: string) => {
            loggedLines.push(printedLine);
        });

        printHumanResult(buildInfectedScanResult());
        const terminalOutput = loggedLines.join('\n');

        // Kein ESC, kein BEL, kein C1-Steuerzeichen — egal aus welchem Feld.
        // (ui.ts färbt off-TTY nicht, legitime Farb-Codes gibt es hier nicht.)
        expect(containsControlBytes(terminalOutput)).toBe(false);
        // Die Injektions-Payloads sind restlos entfernt …
        expect(terminalOutput).not.toContain('pwned-title');
        expect(terminalOutput).not.toContain('evil.example');
        // … der legitime Inhalt aller Felder bleibt erhalten.
        expect(terminalOutput).toContain('Condition 1 (Silent Error Swallowing)');
        expect(terminalOutput).toContain('src/lib/example.ts:42');
        expect(terminalOutput).toContain('Empty catch block.');
        expect(terminalOutput).toContain('Swallows every error.');
        expect(terminalOutput).toContain('throw error;');
        expect(terminalOutput).toContain('One critical finding.');
    });
});

describe('printHumanResult — nothing-reviewed honesty (ROADMAP §3)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function capturedOutput(scanResult: ScanResult): string {
        const loggedLines: string[] = [];
        vi.spyOn(console, 'log').mockImplementation((printedLine: string) => {
            loggedLines.push(printedLine);
        });
        printHumanResult(scanResult);
        return loggedLines.join('\n');
    }

    const NOTHING_REVIEWED_RESULT: ScanResult = {
        hasSlop: false,
        issues: [],
        summary: 'All changed code files exceed the review size cap.',
        filesReviewed: 0,
        outcome: 'nothing_reviewed',
        omittedFiles: ['src/lib/huge-a.ts', 'src/lib/huge-b.ts'],
        cognitiveIntegrityScore: null,
    };

    it('nennt Grund und ausgelassene Dateien statt eines Clean-Hakens', () => {
        const terminalOutput = capturedOutput(NOTHING_REVIEWED_RESULT);

        expect(terminalOutput).not.toContain('No AI slop found');
        expect(terminalOutput).toContain('Nothing was reviewed');
        expect(terminalOutput).toContain('NOT a clean verdict');
        expect(terminalOutput).toContain('All changed code files exceed the review size cap.');
        expect(terminalOutput).toContain('src/lib/huge-a.ts');
        expect(terminalOutput).toContain('src/lib/huge-b.ts');
    });

    it('zeigt einen Lauf ohne Modell-Review als „Deterministic checks only“, mit Findings und ohne Clean-Haken', () => {
        const deterministicOnlyOutput = capturedOutput({
            hasSlop: true,
            issues: [{
                id: 'd'.repeat(16),
                rule: 'SEC-035 (Package does not exist on its registry)',
                severity: 'CRITICAL',
                path: 'requirements.txt',
                line: 3,
                endLine: 3,
                exactQuote: 'hallucinated-http-kit==1.2.0',
                critique: 'This declared package does not exist on the public registry.',
            }],
            summary: 'Deterministic checks only: this diff changes no TypeScript or JavaScript file, so no model reviewed it.',
            filesReviewed: 0,
            filesScanned: 2,
            outcome: 'deterministic_only',
            omittedFiles: [],
            cognitiveIntegrityScore: null,
        });
        const withoutFindingsOutput = capturedOutput({
            ...NOTHING_REVIEWED_RESULT,
            summary: 'Deterministic checks only: this diff changes no TypeScript or JavaScript file, so no model reviewed it.',
            outcome: 'deterministic_only',
            omittedFiles: [],
        });

        expect(deterministicOnlyOutput).toContain('Deterministic checks only — no model reviewed this diff.');
        expect(deterministicOnlyOutput).toContain('requirements.txt:3');
        expect(deterministicOnlyOutput).not.toContain('Nothing was reviewed');
        expect(deterministicOnlyOutput).not.toContain('Cognitive Integrity Score');
        expect(withoutFindingsOutput).toContain('No deterministic findings. This is NOT a clean verdict.');
        expect(withoutFindingsOutput).not.toContain('No AI slop found');
    });

    it('behandelt Legacy-Ergebnisse ohne outcome-Feld über filesReviewed === 0 gleich', () => {
        // So kommt ein Alt-Ergebnis wirklich an: als Wire-JSON ohne die neuen
        // Felder — derselbe Parse-Cast wie im echten Poll-Pfad.
        const legacyWireJson = JSON.stringify({
            hasSlop: false,
            issues: [],
            summary: 'All changed code files exceed the review size cap.',
            filesReviewed: 0,
            cognitiveIntegrityScore: null,
        });
        const legacyResult = JSON.parse(legacyWireJson) as ScanResult;

        const terminalOutput = capturedOutput(legacyResult);

        expect(terminalOutput).not.toContain('No AI slop found');
        expect(terminalOutput).toContain('Nothing was reviewed');
    });

    it('rendert einen echten Clean-Scan (Dateien geprüft, 0 Findings) weiterhin als sauber', () => {
        const terminalOutput = capturedOutput({
            hasSlop: false,
            issues: [],
            summary: 'No AI slop found.',
            filesReviewed: 3,
            outcome: 'reviewed',
            omittedFiles: [],
            cognitiveIntegrityScore: 97,
        });

        expect(terminalOutput).toContain('No AI slop found');
        expect(terminalOutput).toContain('3 file(s) reviewed');
        expect(terminalOutput).not.toContain('Nothing was reviewed');
        expect(terminalOutput).toContain('Cognitive Integrity Score: 97/100 — no findings to verify.');
    });
});

describe('printHumanResult — Score-Tagline zählt den Verifikationsstatus (SPEC §6)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function capturedOutput(scanResult: ScanResult): string {
        const loggedLines: string[] = [];
        vi.spyOn(console, 'log').mockImplementation((printedLine: string) => {
            loggedLines.push(printedLine);
        });
        printHumanResult(scanResult);
        return loggedLines.join('\n');
    }

    function buildFinding(verification: ScanIssue['verification'], line: number): ScanIssue {
        return {
            id: `finding-${line}`,
            rule: 'Condition 3 (Lexical Slop)',
            severity: 'WARNING',
            path: 'src/lib/example.ts',
            line,
            endLine: line,
            exactQuote: 'const data = fetchData();',
            critique: 'Generic variable name.',
            ...(verification ? { verification } : {}),
        };
    }

    it('nennt ein UNCERTAIN-Finding statt "every finding survived" zu behaupten', () => {
        const terminalOutput = capturedOutput({
            hasSlop: true,
            issues: [buildFinding('confirmed', 10), buildFinding('uncertain', 20)],
            summary: 'AI slop detected.',
            filesReviewed: 1,
            outcome: 'reviewed',
            omittedFiles: [],
            cognitiveIntegrityScore: 70,
        });

        expect(terminalOutput).toContain(
            'Cognitive Integrity Score: 70/100 — 2 findings: 1 survived independent blind re-verification, 1 remained uncertain.',
        );
        expect(terminalOutput).not.toContain('every finding survived');
    });

    it('nennt einen Zeit-Skip des Deadline Guards unter dem Score (DEADLINE_GUARD_SPEC §3.4)', () => {
        const terminalOutput = capturedOutput({
            hasSlop: true,
            issues: [buildFinding('confirmed', 10)],
            summary: 'AI slop detected.',
            filesReviewed: 1,
            outcome: 'reviewed',
            omittedFiles: [],
            cognitiveIntegrityScore: null,
            skippedStages: ['verifier'],
        });

        expect(terminalOutput).toContain('Reduced confidence: time budget exhausted — skipped: blind verification (some or all findings).');
    });

    it('nennt die Dateien eines gescheiterten Draft-Batches, sanitisiert (draft_partial, LARGE_DIFF_RECALL_SPEC §9)', () => {
        const terminalOutput = capturedOutput({
            hasSlop: true,
            issues: [buildFinding('confirmed', 10)],
            summary: 'AI slop detected.',
            filesReviewed: 3,
            outcome: 'reviewed',
            omittedFiles: [],
            cognitiveIntegrityScore: null,
            degradations: ['draft_partial'],
            draftUnreviewedFiles: ['src/lib/alpha.ts', `src/lib/beta.ts${OSC_TITLE_ATTACK}`],
        });

        expect(terminalOutput).toContain(
            'Reduced coverage: the AI review failed on 2 files — not reviewed: src/lib/alpha.ts, src/lib/beta.ts',
        );
        expect(containsControlBytes(terminalOutput)).toBe(false);
    });

    it('behauptet auf pro-direct keine Blind-Verifikation (self-reported)', () => {
        const terminalOutput = capturedOutput({
            hasSlop: true,
            issues: [buildFinding('self_reported', 10)],
            summary: 'AI slop detected.',
            filesReviewed: 20,
            outcome: 'reviewed',
            omittedFiles: [],
            cognitiveIntegrityScore: 97,
        });

        expect(terminalOutput).toContain("1 finding: 1 carry only the reviewing model's self-reported confidence");
        expect(terminalOutput).not.toContain('survived');
    });

    it('wertet Alt-Ergebnisse ohne Status konservativ als unverified', () => {
        const terminalOutput = capturedOutput({
            hasSlop: true,
            issues: [buildFinding(undefined, 10)],
            summary: 'AI slop detected.',
            filesReviewed: 1,
            outcome: 'reviewed',
            omittedFiles: [],
            cognitiveIntegrityScore: 95,
        });

        expect(terminalOutput).toContain('1 finding: 1 could not be independently verified.');
    });
});

describe('sanitizeModelText — Sequenz-Abdeckung', () => {
    it('entfernt CSI-Farb- und Cursor-Sequenzen, auch als C1-Single-Byte', () => {
        expect(sanitizeModelText(`${ESC}[31mred${ESC}[0m and ${C1_CSI}2Kwiped`)).toBe('red and wiped');
    });

    it('entfernt OSC-Strings mit BEL- und mit ST-Terminator', () => {
        expect(sanitizeModelText(`a${OSC_TITLE_ATTACK}b`)).toBe('ab');
        expect(sanitizeModelText(`a${OSC_HYPERLINK_ATTACK}b`)).toBe('aclick meb');
    });

    it('entfernt einen unterminierten OSC-String bis zum Ende (kein Hänger-Rest)', () => {
        expect(sanitizeModelText(`before${ESC}]0;never terminated`)).toBe('before');
    });

    it('behält Newlines und Tabs, entfernt aber CR und NUL', () => {
        const mixedWhitespace = `line1\nline2\tindent${String.fromCharCode(0)}${String.fromCharCode(13)}`;
        expect(sanitizeModelText(mixedWhitespace)).toBe('line1\nline2\tindent');
    });

    it('lässt sauberen Text byte-identisch durch', () => {
        expect(sanitizeModelText('🚫 CRITICAL — Empty catch block (SEC-001).')).toBe(
            '🚫 CRITICAL — Empty catch block (SEC-001).',
        );
    });
});

describe('printHumanResult — aggregierte Findings (ROADMAP §7)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function capturedIssueOutput(scanResult: ScanResult): string {
        const loggedLines: string[] = [];
        vi.spyOn(console, 'log').mockImplementation((printedLine: string) => {
            loggedLines.push(printedLine);
        });
        printHumanResult(scanResult);
        return loggedLines.join('\n');
    }

    const AGGREGATED_RESULT: ScanResult = {
        hasSlop: true,
        issues: [{
            id: 'abcdef0123456789',
            rule: 'Condition 3 (Lexical Slop)',
            severity: 'WARNING',
            path: 'src/lib/example.ts',
            line: 12,
            endLine: 12,
            exactQuote: '// 🚀 blazing',
            critique: 'Emoji comments across the file.',
            occurrences: [
                { line: 12, endLine: 12, exactQuote: '// 🚀 blazing' },
                { line: 18, endLine: 18, exactQuote: '// ✨ magic' },
                { line: 25, endLine: 28, exactQuote: '// 🎉 party block' },
            ],
        }],
        summary: 'One aggregated finding.',
        filesReviewed: 1,
        outcome: 'reviewed',
        omittedFiles: [],
        cognitiveIntegrityScore: 95,
    };

    it('rendert die Vorkommens-Zeilenliste unter dem Anker (lines 12, 18, 25-28)', () => {
        const terminalOutput = capturedIssueOutput(AGGREGATED_RESULT);

        expect(terminalOutput).toContain('src/lib/example.ts:12');
        expect(terminalOutput).toContain('3 occurrences: lines 12, 18, 25-28');
        // EIN Finding, nicht drei — die Aggregation ist der Sinn der Übung.
        expect(terminalOutput).toContain('1 issue(s)');
    });

    it('rendert Einzel-Findings ohne occurrences-Feld unverändert (Alt-Contract)', () => {
        const legacyResult: ScanResult = {
            ...AGGREGATED_RESULT,
            issues: [{ ...AGGREGATED_RESULT.issues[0], occurrences: undefined }],
        };

        const terminalOutput = capturedIssueOutput(legacyResult);

        expect(terminalOutput).not.toContain('occurrences:');
        expect(terminalOutput).toContain('src/lib/example.ts:12');
    });
});

describe('printHumanResult — KI-Kennzeichnung (LEGAL_PAGES_SPEC §4a.3)', () => {
    const AI_LABEL_LINE = 'AI-generated review. Check it before you rely on it.';

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function capturedOutput(scanResult: ScanResult): string {
        const loggedLines: string[] = [];
        vi.spyOn(console, 'log').mockImplementation((printedLine: string) => {
            loggedLines.push(printedLine);
        });
        printHumanResult(scanResult);
        return loggedLines.join('\n');
    }

    const CLEAN_MODEL_REVIEW: ScanResult = {
        hasSlop: false,
        issues: [],
        summary: 'No AI slop found.',
        filesReviewed: 3,
        outcome: 'reviewed',
        aiGenerated: true,
        omittedFiles: [],
        cognitiveIntegrityScore: 97,
    };

    it('druckt das Label unter einem Modell-Review, mit und ohne Findings', () => {
        const cleanOutput = capturedOutput(CLEAN_MODEL_REVIEW);
        const findingsOutput = capturedOutput({ ...buildInfectedScanResult(), aiGenerated: true });

        expect(cleanOutput).toContain(AI_LABEL_LINE);
        expect(findingsOutput).toContain(AI_LABEL_LINE);
    });

    it('kennzeichnet im Zweifel: ein Modell-Review von einem Server ohne das Feld bekommt das Label', () => {
        const legacyServerOutput = capturedOutput({ ...CLEAN_MODEL_REVIEW, aiGenerated: undefined });

        expect(legacyServerOutput).toContain(AI_LABEL_LINE);
    });

    it('druckt kein Label, wenn kein Modell beteiligt war', () => {
        const deterministicOnlyOutput = capturedOutput({
            ...CLEAN_MODEL_REVIEW,
            summary: 'Deterministic checks only: no model reviewed it.',
            filesReviewed: 0,
            outcome: 'deterministic_only',
            aiGenerated: false,
            cognitiveIntegrityScore: null,
        });
        const nothingReviewedOutput = capturedOutput({
            ...CLEAN_MODEL_REVIEW,
            filesReviewed: 0,
            outcome: 'nothing_reviewed',
            aiGenerated: false,
            cognitiveIntegrityScore: null,
        });

        expect(deterministicOnlyOutput).not.toContain('AI-generated');
        expect(nothingReviewedOutput).not.toContain('AI-generated');
    });
});
