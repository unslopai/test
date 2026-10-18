import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    LEGAL_PAGES_LIVE_ENV,
    LEGAL_PLACEHOLDER_PREVIEW_ENV,
    isLegalPageLive,
    isLegalPageSlug,
    isPlaceholderPreviewAllowed,
    liveLegalPageSlugs,
} from './legal-pages';

describe('legal pages flag (LEGAL_PAGES_SPEC §5.2)', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('treats a missing or empty flag as nothing live (fail-closed)', () => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, '');
        expect(liveLegalPageSlugs()).toEqual([]);
        expect(isLegalPageLive('impressum')).toBe(false);
    });

    it('enables exactly the listed slugs, trimmed, in registry order', () => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, ' privacy , impressum ');
        expect(liveLegalPageSlugs()).toEqual(['impressum', 'privacy']);
        expect(isLegalPageLive('terms')).toBe(false);
    });

    it('ignores unknown slugs instead of enabling anything by accident', () => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, 'all,*,impressum');
        expect(liveLegalPageSlugs()).toEqual(['impressum']);
    });

    it('allows the placeholder preview only outside Vercel production', () => {
        vi.stubEnv(LEGAL_PLACEHOLDER_PREVIEW_ENV, 'true');
        vi.stubEnv('VERCEL_ENV', 'preview');
        expect(isPlaceholderPreviewAllowed()).toBe(true);
        vi.stubEnv('VERCEL_ENV', 'production');
        expect(isPlaceholderPreviewAllowed()).toBe(false);
        vi.stubEnv(LEGAL_PLACEHOLDER_PREVIEW_ENV, '');
        vi.stubEnv('VERCEL_ENV', 'preview');
        expect(isPlaceholderPreviewAllowed()).toBe(false);
    });

    it('recognises only the five registered slugs', () => {
        expect(isLegalPageSlug('dpa')).toBe(true);
        expect(isLegalPageSlug('datenschutz')).toBe(false);
        expect(isLegalPageSlug('')).toBe(false);
    });
});
