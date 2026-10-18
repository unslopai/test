/**
 * Unit Tests: resolveCascadeConfig — Slop-Score-Gating-Feld (Upcoming §6).
 *
 * Das Gate ist opt-in: ohne Repo-Config bleibt es aus (0), und eine kaputte
 * Config darf nie einen Job töten — ungültige Werte fallen auf den Default.
 */
import { describe, expect, it } from 'vitest';
import { resolveCascadeConfig } from '@/lib/pipeline/defaults';

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
