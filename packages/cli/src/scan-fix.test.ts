/**
 * CLI-Auto-Fix-Tests (ROADMAP §3): Flag-Parsing (--fix / --dry-run /
 * --allow-dirty), der Dirty-Tree-Guard VOR dem Scan und der
 * autoFixSummary-Block im --json-stdout. Die Engine selbst läuft ECHT gegen
 * Fixture-Dateien (fix-apply.test.ts deckt ihre Innereien); gemockt sind nur
 * die System-Grenzen Git und API.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScanIssue, ScanResult } from '@unslop/shared';
import { parseScanOptions, reportScanResult, runScan, UsageError } from './scan.js';
import type { ScanOptions } from './scan.js';

vi.mock('@unslop/shared/node', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@unslop/shared/node')>();
    return {
        ...actual,
        loadConfig: vi.fn(() => ({ apiKey: 'test-key', baseUrl: 'https://unslop.invalid' })),
        assertInsideWorkTree: vi.fn(),
        isWorkingTreeDirty: vi.fn(() => false),
        resolveGitRoot: vi.fn(() => fixtureRoot),
        resolveRepoFullName: vi.fn(() => 'unslopai/test'),
        resolveMergeBase: vi.fn(() => 'a'.repeat(40)),
        resolveHeadSha: vi.fn(() => 'b'.repeat(40)),
        computeDiff: vi.fn(() => 'diff --git a/x b/x'),
        // Short-circuits runScan before any network call.
        findDiffUploadRefusal: vi.fn(() => ({ kind: 'no_changes' as const })),
    };
});

import { findDiffUploadRefusal, isWorkingTreeDirty, resolveRepoFullName } from '@unslop/shared/node';

let fixtureRoot: string;
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unslop-cli-fix-'));
    stdoutSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(isWorkingTreeDirty).mockReturnValue(false);
});

afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    // Kein restoreAllMocks: das würde die Factory-Implementierungen des
    // Modul-Mocks mit-zurücksetzen. Nur die Console-Spies zurückgeben,
    // Call-Historie der Modul-Mocks leeren.
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    vi.clearAllMocks();
});

const BASE_OPTIONS: ScanOptions = {
    jsonOutput: false,
    failOn: 'critical',
    explicitBaseRef: null,
    timeoutSeconds: 120,
    fixMode: 'off',
    allowDirty: false,
};

function fixableIssue(overrides: Partial<ScanIssue>): ScanIssue {
    return {
        id: 'abcdef0123456789',
        rule: 'MAINT-001',
        severity: 'CRITICAL',
        path: 'src/sample.ts',
        line: 1,
        endLine: 1,
        exactQuote: 'const data = 1;',
        critique: 'generic name',
        fixedCodeSnippet: 'const seed = 1;',
        ...overrides,
    };
}

function resultWith(issues: readonly ScanIssue[]): ScanResult {
    return {
        hasSlop: issues.length > 0,
        issues,
        summary: 'test summary',
        filesReviewed: 1,
        outcome: 'reviewed',
        omittedFiles: [],
        cognitiveIntegrityScore: 95,
    };
}

describe('parseScanOptions — Fix-Flags', () => {
    it('parst --fix als apply-Modus', () => {
        expect(parseScanOptions(['--fix']).fixMode).toBe('apply');
    });

    it('lässt --dry-run unabhängig von der Flag-Reihenfolge gewinnen', () => {
        expect(parseScanOptions(['--fix', '--dry-run']).fixMode).toBe('dry-run');
        expect(parseScanOptions(['--dry-run', '--fix']).fixMode).toBe('dry-run');
        expect(parseScanOptions(['--dry-run']).fixMode).toBe('dry-run');
    });

    it('parst --allow-dirty und lässt den Default bei false', () => {
        expect(parseScanOptions(['--fix', '--allow-dirty']).allowDirty).toBe(true);
        expect(parseScanOptions(['--fix']).allowDirty).toBe(false);
        expect(parseScanOptions([]).fixMode).toBe('off');
    });

    it('weist unbekannte Optionen weiterhin ab', () => {
        expect(() => parseScanOptions(['--fixx'])).toThrow(UsageError);
    });
});

describe('runScan — Dirty-Tree-Guard', () => {
    it('verweigert --fix bei dirtym Working Tree mit Exit 2, VOR jedem Scan-Schritt', async () => {
        vi.mocked(isWorkingTreeDirty).mockReturnValue(true);

        const exitCode = await runScan({ ...BASE_OPTIONS, fixMode: 'apply' });

        expect(exitCode).toBe(2);
        expect(String(stderrSpy.mock.calls[0][0])).toContain('--allow-dirty');
        expect(resolveRepoFullName).not.toHaveBeenCalled();
    });

    it('lässt --fix mit --allow-dirty trotz dirtym Tree weiterlaufen', async () => {
        vi.mocked(isWorkingTreeDirty).mockReturnValue(true);

        const exitCode = await runScan({ ...BASE_OPTIONS, fixMode: 'apply', allowDirty: true });

        expect(exitCode).toBe(0); // no_changes-Refusal ist ein sauberer Lauf
        expect(resolveRepoFullName).toHaveBeenCalled();
    });

    it('braucht für --dry-run keinen sauberen Tree (es wird nie geschrieben)', async () => {
        vi.mocked(isWorkingTreeDirty).mockReturnValue(true);

        const exitCode = await runScan({ ...BASE_OPTIONS, fixMode: 'dry-run' });

        expect(exitCode).toBe(0);
        expect(findDiffUploadRefusal).toHaveBeenCalled();
    });
});

describe('reportScanResult — Fix-Anwendung + Output-Contract', () => {
    function writeFixture(relativePath: string, content: string): void {
        const absolutePath = path.join(fixtureRoot, relativePath);
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, content, 'utf-8');
    }

    it('wendet Fixes echt an und schreibt autoFixSummary in das --json-Dokument', () => {
        writeFixture('src/sample.ts', 'const data = 1;\n');
        const scanResult = resultWith([
            fixableIssue({}),
            fixableIssue({ path: 'src/other.ts' }), // file missing → skipped
        ]);

        const exitCode = reportScanResult(scanResult, { ...BASE_OPTIONS, jsonOutput: true, fixMode: 'apply' });

        expect(exitCode).toBe(1); // Findings gab es — Fixen ändert das Gating nicht
        const printedJson = JSON.parse(String(stdoutSpy.mock.calls[0][0])) as ScanResult & {
            autoFixSummary: { applied: number; skipped: number; failed: number; dryRun: boolean };
        };
        expect(printedJson.autoFixSummary).toEqual({ applied: 1, skipped: 1, failed: 0, dryRun: false });
        expect(fs.readFileSync(path.join(fixtureRoot, 'src/sample.ts'), 'utf-8')).toBe('const seed = 1;\n');
    });

    it('--dry-run meldet den Fix, lässt die Datei aber unverändert', () => {
        writeFixture('src/sample.ts', 'const data = 1;\n');

        reportScanResult(resultWith([fixableIssue({})]), { ...BASE_OPTIONS, jsonOutput: true, fixMode: 'dry-run' });

        const printedJson = JSON.parse(String(stdoutSpy.mock.calls[0][0])) as {
            autoFixSummary: { applied: number; dryRun: boolean };
        };
        expect(printedJson.autoFixSummary.applied).toBe(1);
        expect(printedJson.autoFixSummary.dryRun).toBe(true);
        expect(fs.readFileSync(path.join(fixtureRoot, 'src/sample.ts'), 'utf-8')).toBe('const data = 1;\n');
    });

    it('ohne Fix-Modus bleibt das JSON byte-identisch zum ScanResult', () => {
        const scanResult = resultWith([]);

        reportScanResult(scanResult, { ...BASE_OPTIONS, jsonOutput: true });

        expect(String(stdoutSpy.mock.calls[0][0])).toBe(JSON.stringify(scanResult));
    });

    it('liefert im Fix-Modus auch bei null Findings einen autoFixSummary-Block', () => {
        reportScanResult(resultWith([]), { ...BASE_OPTIONS, jsonOutput: true, fixMode: 'apply' });

        const printedJson = JSON.parse(String(stdoutSpy.mock.calls[0][0])) as {
            autoFixSummary: { applied: number; skipped: number };
        };
        expect(printedJson.autoFixSummary).toEqual({ applied: 0, skipped: 0, failed: 0, dryRun: false });
    });

    it('menschlicher Modus druckt den Fix-Report nach dem Ergebnis', () => {
        writeFixture('src/sample.ts', 'const data = 1;\n');

        reportScanResult(resultWith([fixableIssue({})]), { ...BASE_OPTIONS, fixMode: 'apply' });

        const printedLines = stdoutSpy.mock.calls.map((call: readonly unknown[]) => String(call[0])).join('\n');
        expect(printedLines).toContain('Auto-fix results:');
        expect(printedLines).toContain('1 applied, 0 skipped, 0 failed.');
    });

    it('menschlicher Dry-Run sagt explizit, dass nichts geschrieben wurde, und nennt Skip-Gründe', () => {
        writeFixture('src/sample.ts', 'drifted content\n');

        reportScanResult(resultWith([fixableIssue({})]), { ...BASE_OPTIONS, fixMode: 'dry-run' });

        const printedLines = stdoutSpy.mock.calls.map((call: readonly unknown[]) => String(call[0])).join('\n');
        expect(printedLines).toContain('no files were modified');
        expect(printedLines).toContain('anchor mismatch');
        expect(printedLines).toContain('0 would be applied, 1 skipped, 0 failed.');
    });
});
