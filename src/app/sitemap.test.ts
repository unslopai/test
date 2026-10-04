import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGAL_PAGES_LIVE_ENV } from '@/lib/legal/legal-pages';
import sitemap from './sitemap';

describe('sitemap (LEGAL_PAGES_SPEC §5.2)', () => {
    beforeEach(() => {
        vi.stubEnv('APP_BASE_URL', 'https://unslop.example');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('lists only the two landing pages while no legal page is live', () => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, '');
        expect(sitemap().map((entry) => entry.url)).toEqual([
            'https://unslop.example/en',
            'https://unslop.example/de',
        ]);
    });

    it('adds each live legal page in both locales with hreflang alternates', () => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, 'impressum,privacy');
        const entries = sitemap();
        expect(entries.map((entry) => entry.url)).toEqual([
            'https://unslop.example/en',
            'https://unslop.example/de',
            'https://unslop.example/en/impressum',
            'https://unslop.example/de/impressum',
            'https://unslop.example/en/privacy',
            'https://unslop.example/de/privacy',
        ]);
        const privacyEntry = entries.find((entry) => entry.url.endsWith('/de/privacy'));
        expect(privacyEntry?.alternates?.languages).toEqual({
            en: 'https://unslop.example/en/privacy',
            de: 'https://unslop.example/de/privacy',
        });
    });
});
