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
