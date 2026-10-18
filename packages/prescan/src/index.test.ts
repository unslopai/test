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

describe('runPrescan — config-file routing and companion files (v4)', () => {
    const NEXT_MIDDLEWARE_LINES = [
        "import { NextResponse } from 'next/server';",
        'export function middleware() {',
        '  const forwardedResponse = NextResponse.next();',
        "  forwardedResponse.headers.set('x-request-id', crypto.randomUUID());",
        '  return forwardedResponse;',
        '}',
    ];
    const middlewareFile = buildScannableFile({
        path: 'middleware.ts',
        content: NEXT_MIDDLEWARE_LINES.join('\n'),
        patch: buildPatchForAddedLines(1, NEXT_MIDDLEWARE_LINES),
    });

    it('flags SEC-019 on a Next middleware when no next.config is visible', async () => {
        const prescanResult = await runPrescan({ files: [middlewareFile] }, OFFLINE_CONFIG);
        expect(prescanResult.findings.map((finding) => [finding.ruleId, finding.line])).toEqual([['SEC-019', 4]]);
    });

    it('lets a hardened next.config companion suppress SEC-019 and reports an unreadable one as skipped', async () => {
        const hardened = await runPrescan(
            { files: [middlewareFile], companionFiles: [{ path: 'next.config.ts', content: "{ key: 'X-Frame-Options' }" }] },
            OFFLINE_CONFIG,
        );
        expect(hardened.findings).toEqual([]);

        const unreadable = await runPrescan(
            { files: [middlewareFile], companionFiles: [{ path: 'next.config.ts', content: null }] },
            OFFLINE_CONFIG,
        );
        expect(unreadable.findings).toEqual([]);
        expect(unreadable.skippedChecks).toContainEqual({ ruleId: 'SEC-019', reason: 'companion-unavailable: next.config.ts', path: 'middleware.ts' });
    });

    it('routes Terraform files through the config checks (SEC-032) and applies the added-line filter', async () => {
        const terraformLines = [
            'resource "aws_iam_role_policy" "lambda_access" {',
            '  role   = aws_iam_role.lambda_exec.id',
            '  policy = jsonencode({ Statement = [{ Effect = "Allow", Action = "*", Resource = "*" }] })',
            '}',
        ];
        const terraformFile = buildScannableFile({
            path: 'infra/lambda.tf',
            content: terraformLines.join('\n'),
            patch: buildPatchForAddedLines(1, terraformLines),
        });
        const flagged = await runPrescan({ files: [terraformFile] }, OFFLINE_CONFIG);
        expect(flagged.findings.map((finding) => finding.ruleId)).toEqual(['SEC-032']);

        const onlyRoleLineAdded = buildScannableFile({
            path: 'infra/lambda.tf',
            content: terraformLines.join('\n'),
            patch: buildPatchForAddedLines(2, [terraformLines[1]]),
        });
        const filtered = await runPrescan({ files: [onlyRoleLineAdded] }, OFFLINE_CONFIG);
        expect(filtered.findings).toEqual([]);
    });
});

describe('runPrescan — workspace packages (LANGUAGE_COVERAGE_SPEC §4.4)', () => {
    it('does not look up a dependency that a companion workspace manifest declares as its own name', async () => {
        const manifestLines = ['{', '  "dependencies": {', '    "@unslop/shared": "0.1.0"', '  }', '}'];
        const unreachableFetch: typeof fetch = async () => { throw new Error('must not be called'); };

        const prescanResult = await runPrescan(
            {
                files: [buildScannableFile({
                    path: 'packages/cli/package.json',
                    content: manifestLines.join('\n'),
                    patch: buildPatchForAddedLines(1, manifestLines),
                })],
                companionFiles: [{ path: 'packages/shared/package.json', content: '{\n  "name": "@unslop/shared"\n}' }],
            },
            DEFAULT_PRESCAN_CONFIG,
            { fetchImpl: unreachableFetch },
        );

        expect(prescanResult.findings).toEqual([]);
        expect(prescanResult.skippedChecks).toEqual([]);
    });
});
