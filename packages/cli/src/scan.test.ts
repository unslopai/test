/**
 * Exit-Code-Contract der Upload-Refusals (SPEC.md D10, ROADMAP §13).
 *
 * Warum getestet: an diesen drei Zahlen haengt fremde CI. "Keine Aenderungen"
 * MUSS 0 bleiben — waere es 2, ginge jeder Branch ohne Diff rot. Secret und
 * Ueberlaenge MUESSEN 2 sein und auf stderr gehen, damit `--json`-stdout
 * parsebar bleibt (die VS-Code-Extension liest genau das, scanRunner.ts).
 *
 * Erste Tests in packages/cli ueberhaupt; die Datei ist deshalb neu in
 * vitest.config.ts eingetragen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatScanFailure, reportUploadRefusal } from './scan.js';
import type { ScanOptions } from './scan.js';

const HUMAN_OPTIONS: ScanOptions = {
    jsonOutput: false,
    failOn: 'critical',
    explicitBaseRef: null,
    timeoutSeconds: 120,
    fixMode: 'off',
    allowDirty: false,
};
const JSON_OPTIONS: ScanOptions = { ...HUMAN_OPTIONS, jsonOutput: true };

let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    stdoutSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('formatScanFailure — Server-Fehlercodes auf stderr', () => {
    it('führt mit dem Code und ergänzt bei model_unavailable einen Retry-Hinweis', () => {
        const failureLine = formatScanFailure('model_unavailable');

        // Die Extension klassifiziert diese Zeile über den Code (classifyScanFailure).
        expect(failureLine.startsWith('Scan failed: model_unavailable — ')).toBe(true);
        expect(failureLine).toContain('retry in a minute');
    });

    it('führt bei review_timeout mit dem Code und rät zum erneuten Scan', () => {
        const failureLine = formatScanFailure('review_timeout');

        expect(failureLine.startsWith('Scan failed: review_timeout — ')).toBe(true);
        expect(failureLine).toContain('Run the scan again');
    });

    it('lässt Codes ohne Handlungshinweis unverändert', () => {
        expect(formatScanFailure('server_error')).toBe('Scan failed: server_error');
        expect(formatScanFailure(undefined)).toBe('Scan failed: unknown_error');
    });
});

describe('reportUploadRefusal — Exit-Code-Contract', () => {
    it('behandelt no_changes als sauberen Lauf (0) und schreibt auf stdout', () => {
        expect(reportUploadRefusal({ kind: 'no_changes' }, HUMAN_OPTIONS)).toBe(0);
        expect(stdoutSpy).toHaveBeenCalledOnce();
        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('liefert bei no_changes im JSON-Modus ein parsebares leeres Ergebnis', () => {
        expect(reportUploadRefusal({ kind: 'no_changes' }, JSON_OPTIONS)).toBe(0);

        const printedJson: unknown = JSON.parse(String(stdoutSpy.mock.calls[0][0]));
        expect(printedJson).toEqual({
            hasSlop: false,
            issues: [],
            summary: 'No changes to scan (working tree matches the merge-base).',
            filesReviewed: 0,
            // Ehrlichkeits-Contract (ROADMAP §3): 0 geprüfte Dateien sind nie ein Urteil.
            outcome: 'nothing_reviewed',
            omittedFiles: [],
            cognitiveIntegrityScore: null,
        });
    });

    it('bricht bei einem Secret mit 2 ab und nennt Pfad, Zeile und Musterklasse', () => {
        const exitCode = reportUploadRefusal(
            { kind: 'secret_detected', firstMatch: { path: 'src/env.ts', line: 7, patternClass: 'known key prefix' } },
            HUMAN_OPTIONS,
        );

        expect(exitCode).toBe(2);
        const refusalMessage = String(stderrSpy.mock.calls[0][0]);
        expect(refusalMessage).toContain('src/env.ts:7');
        expect(refusalMessage).toContain('known key prefix');
        expect(refusalMessage).toContain('Nothing was uploaded');
    });

    it('haelt stdout bei einem Secret im JSON-Modus komplett leer', () => {
        // Sonst mischt sich die Fehlermeldung in das JSON, das die Extension parst.
        expect(reportUploadRefusal(
            { kind: 'secret_detected', firstMatch: { path: 'a.ts', line: 1, patternClass: 'private key' } },
            JSON_OPTIONS,
        )).toBe(2);

        expect(stdoutSpy).not.toHaveBeenCalled();
        expect(stderrSpy).toHaveBeenCalledOnce();
    });

    it('bricht bei Ueberlaenge mit 2 ab und nennt beide Groessen in KB', () => {
        const exitCode = reportUploadRefusal(
            { kind: 'diff_too_large', diffBytes: 400 * 1024, limitBytes: 300 * 1024 },
            HUMAN_OPTIONS,
        );

        expect(exitCode).toBe(2);
        const refusalMessage = String(stderrSpy.mock.calls[0][0]);
        expect(refusalMessage).toContain('400 KB');
        expect(refusalMessage).toContain('300 KB');
    });
});
