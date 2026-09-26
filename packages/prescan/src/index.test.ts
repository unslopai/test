/**
 * runPrescan-Orchestrierungs-Tests: Added-Line-Filter (PROC-007),
 * Patch-only Degraded Mode (§7.1), Size-Cap/Budget-Ehrlichkeit (§7.4),
 * Rule-Overrides und Dedupe.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESCAN_CONFIG, resolvePrescanConfig, runPrescan } from './index';
import type { PrescanConfig, PrescanFile } from './types';

const OFFLINE_CONFIG: PrescanConfig = { ...DEFAULT_PRESCAN_CONFIG, registryChecks: false };

/** Patch, der die Zeilen [firstLine..lastLine] als hinzugefügt markiert. */
function buildPatchForAddedLines(firstLine: number, addedLineTexts: readonly string[]): string {
    const hunkHeader = `@@ -${firstLine},0 +${firstLine},${addedLineTexts.length} @@`;
    return [hunkHeader, ...addedLineTexts.map((lineText) => `+${lineText}`)].join('\n');
}

function buildScannableFile(overrides: Partial<PrescanFile>): PrescanFile {
    return {
        path: 'src/service.ts',
        content: null,
        patch: '',
        ...overrides,
    };
}

describe('runPrescan — added-line filter (PROC-007)', () => {
    it('reports findings on added lines and drops findings on unchanged lines', async () => {
        const fileContent = [
            'const legacySecret = "AKIAIOSFODNN7LEGACY0";', // Zeile 1: NICHT im Diff
            'const shippedToday = "AKIAIOSFODNN7EXAMPLE";', // Zeile 2: added
        ].join('\n');

        const scanResult = await runPrescan({
            files: [buildScannableFile({
                content: fileContent,
                patch: buildPatchForAddedLines(2, ['const shippedToday = "AKIAIOSFODNN7EXAMPLE";']),
            })],
        }, OFFLINE_CONFIG);

        expect(scanResult.findings).toHaveLength(1);
        expect(scanResult.findings[0].line).toBe(2);
        expect(scanResult.findings[0].ruleId).toBe('SEC-005');
    });

    it('skips files whose patch adds no lines', async () => {
        const scanResult = await runPrescan({
            files: [buildScannableFile({
                content: 'const removedOnly = 1;',
                patch: '@@ -10,2 +10,1 @@\n-const droppedLine = 2;\n const removedOnly = 1;',
            })],
        }, OFFLINE_CONFIG);

        expect(scanResult.findings).toHaveLength(0);
        expect(scanResult.filesScanned).toBe(0);
    });
});

describe('runPrescan — patch-only degraded mode (§7.1)', () => {
    it('runs regex rules on patch lines and records skipped AST checks honestly', async () => {
        const scanResult = await runPrescan({
            files: [buildScannableFile({
                content: null,
                patch: buildPatchForAddedLines(5, ['const uploadedKey = "AKIAIOSFODNN7EXAMPLE";']),
            })],
        }, OFFLINE_CONFIG);

        expect(scanResult.findings.map((finding) => finding.ruleId)).toEqual(['SEC-005']);
        expect(scanResult.skippedChecks).toContainEqual({
            ruleId: '*',
            reason: 'patch-only-input',
            path: 'src/service.ts',
        });
    });
});

describe('runPrescan — caps and budget honesty (§7.4)', () => {
    it('skips oversized files loudly (size-cap) instead of scanning them', async () => {
        const oversizedContent = 'const filler = 1;\n'.repeat(20000);
        const scanResult = await runPrescan({
            files: [buildScannableFile({
                content: oversizedContent,
                patch: buildPatchForAddedLines(1, ['const filler = 1;']),
            })],
        }, { ...OFFLINE_CONFIG, maxFileBytes: 1024 });

        expect(scanResult.filesSkipped).toEqual([{ path: 'src/service.ts', reason: 'size-cap' }]);
        expect(scanResult.filesScanned).toBe(0);
    });

    it('skips remaining files loudly when the wall-clock budget is exhausted', async () => {
        let simulatedClock = 0;
        const advancingClock = () => {
            simulatedClock += 10000;
            return simulatedClock;
        };

        const scanResult = await runPrescan({
            files: [
                buildScannableFile({
                    path: 'src/first.ts',
                    content: 'const first = 1;',
                    patch: buildPatchForAddedLines(1, ['const first = 1;']),
                }),
                buildScannableFile({
                    path: 'src/second.ts',
                    content: 'const second = 2;',
                    patch: buildPatchForAddedLines(1, ['const second = 2;']),
                }),
            ],
        }, { ...OFFLINE_CONFIG, totalBudgetMs: 15000 }, { now: advancingClock });

        expect(scanResult.filesSkipped).toContainEqual({ path: 'src/second.ts', reason: 'budget-exhausted' });
    });
});

describe('runPrescan — rule overrides', () => {
    it('disables overridden rules and reports them in rulesDisabled', async () => {
        const configWithOverride: PrescanConfig = {
            ...OFFLINE_CONFIG,
            ruleOverrides: { 'SEC-005': false },
        };
        const scanResult = await runPrescan({
            files: [buildScannableFile({
                content: 'const uploadedKey = "AKIAIOSFODNN7EXAMPLE";',
                patch: buildPatchForAddedLines(1, ['const uploadedKey = "AKIAIOSFODNN7EXAMPLE";']),
            })],
        }, configWithOverride);

        expect(scanResult.findings).toHaveLength(0);
        expect(scanResult.rulesDisabled).toEqual(['SEC-005']);
    });
});

describe('resolvePrescanConfig — boundary validation [ARCH-002]', () => {
    it('returns defaults for garbage input', () => {
        expect(resolvePrescanConfig(null)).toEqual(DEFAULT_PRESCAN_CONFIG);
        expect(resolvePrescanConfig('not-an-object')).toEqual(DEFAULT_PRESCAN_CONFIG);
    });

    it('falls back field-wise: broken fields default, valid fields survive', () => {
        const resolvedConfig = resolvePrescanConfig({
            ruleOverrides: { 'MAINT-003': false, 'SEC-005': 'yes' },
            shortCircuit: { mode: 'nuclear', minCriticalFindings: -3 },
            registryChecks: false,
            maxFileBytes: 'huge',
            totalBudgetMs: 20000,
        });

        expect(resolvedConfig.ruleOverrides).toEqual({ 'MAINT-003': false });
        expect(resolvedConfig.shortCircuit).toEqual({ mode: 'off', minCriticalFindings: 1 });
        expect(resolvedConfig.registryChecks).toBe(false);
        expect(resolvedConfig.maxFileBytes).toBe(DEFAULT_PRESCAN_CONFIG.maxFileBytes);
        expect(resolvedConfig.totalBudgetMs).toBe(20000);
    });
});
