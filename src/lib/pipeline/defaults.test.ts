/**
 * Unit Tests: resolveCascadeConfig — Slop-Score-Gating-Feld (Upcoming §6).
 *
 * Das Gate ist opt-in: ohne Repo-Config bleibt es aus (0), und eine kaputte
 * Config darf nie einen Job töten — ungültige Werte fallen auf den Default.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_REVIEW_SCOPE_CONFIG,
    resolveCascadeConfig,
    resolveReviewScopeConfig,
} from '@/lib/pipeline/defaults';

describe('resolveCascadeConfig — minIntegrityScore', () => {
    it('defaults to 0 (gate disabled) when the repo config has no cascade block', () => {
        expect(resolveCascadeConfig(undefined).minIntegrityScore).toBe(0);
    });

    it('accepts a valid threshold on the 0-100 scale', () => {
        expect(resolveCascadeConfig({ minIntegrityScore: 85 }).minIntegrityScore).toBe(85);
    });

    it.each([
        ['above the scale', 150],
        ['negative', -5],
        ['not a number', 'strict' as unknown as number],
        ['NaN', Number.NaN],
    ])('falls back to the disabled default when the value is %s', (_label, invalidThreshold) => {
        expect(resolveCascadeConfig({ minIntegrityScore: invalidThreshold }).minIntegrityScore).toBe(0);
    });

    it('leaves the other cascade thresholds on their documented defaults', () => {
        const resolvedConfig = resolveCascadeConfig({ minIntegrityScore: 85 });

        expect(resolvedConfig.confidenceThreshold).toBe(70);
        expect(resolvedConfig.verifierBatchCap).toBe(15);
    });
});

describe('resolveCascadeConfig — draftBatchMaxTokens (LARGE_DIFF_RECALL_SPEC §9)', () => {
    it('defaults to the 20k batch size that passed gates 1–4, separate from the routing threshold', () => {
        const resolvedConfig = resolveCascadeConfig(undefined);

        expect(resolvedConfig.draftBatchMaxTokens).toBe(20000);
        expect(resolvedConfig.heuristicMaxDiffTokens).toBe(12000);
    });

    it('accepts a per-repo override and falls back on garbage', () => {
        expect(resolveCascadeConfig({ draftBatchMaxTokens: 30000 }).draftBatchMaxTokens).toBe(30000);
        expect(resolveCascadeConfig({ draftBatchMaxTokens: 0 }).draftBatchMaxTokens).toBe(20000);
        expect(resolveCascadeConfig({ draftBatchMaxTokens: Number.NaN }).draftBatchMaxTokens).toBe(20000);
    });
});

describe('resolveReviewScopeConfig (LANGUAGE_COVERAGE_SPEC §6.3)', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('reads Python, Go and PowerShell by default; Java, C/C++ and Terraform only per repo config (gate results, LANGUAGE_COVERAGE_SPEC §6.5, §6.6)', () => {
        expect(DEFAULT_REVIEW_SCOPE_CONFIG.llmExtensions).toEqual(['.py', '.go', '.ps1', '.psm1']);
    });

    it('uses the code default when the repo config has no usable reviewScope block', () => {
        expect(resolveReviewScopeConfig(undefined)).toEqual(DEFAULT_REVIEW_SCOPE_CONFIG);
        expect(resolveReviewScopeConfig({ llmExtensions: '.py' })).toEqual(DEFAULT_REVIEW_SCOPE_CONFIG);
    });

    it('takes the repo list, keeps only gated extensions, and treats the empty list as JS/TS only', () => {
        expect(resolveReviewScopeConfig({ llmExtensions: ['.java', '.rs', '.py', 42] }).llmExtensions)
            .toEqual(['.py', '.java']);
        expect(resolveReviewScopeConfig({ llmExtensions: [] }).llmExtensions).toEqual([]);
    });

    it('UNSLOP_LLM_LANE_JSTS_ONLY=1 overrides the repo config without a deploy', () => {
        vi.stubEnv('UNSLOP_LLM_LANE_JSTS_ONLY', '1');

        expect(resolveReviewScopeConfig({ llmExtensions: ['.py', '.java'] }).llmExtensions).toEqual([]);
    });
});
