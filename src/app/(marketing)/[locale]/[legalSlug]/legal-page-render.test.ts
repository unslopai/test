/**
 * SSR-Test der Rechtsseiten-Route (LEGAL_PAGES_SPEC.md §7). Gleiche Technik
 * wie landing-render.test.ts: der echte Server-Component-Baum wird in Node
 * ausgeführt, gemockt sind nur Next-Plumbing und der Request-Kontext.
 * `loadLegalDocument` wird pro Fall gestubbt, damit der "ready"-Pfad testbar
 * ist, obwohl die echten Texte bis zur Eintragung Platzhalter tragen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupportedLocale } from '@/i18n/config';
import { LEGAL_PAGES_LIVE_ENV } from '@/lib/legal/legal-pages';
import enMessages from '../../../../../messages/en.json';
import deMessages from '../../../../../messages/de.json';

const NOT_FOUND_SENTINEL = '__not_found__';
vi.mock('next/navigation', () => ({
    notFound: () => {
        throw new Error(NOT_FOUND_SENTINEL);
    },
}));

vi.mock('next/link', () => ({
    default: (linkProps: { children?: unknown }) => linkProps.children ?? null,
}));

const documentStub = vi.hoisted(() => ({
    state: { kind: 'ready', markdown: '# Stub\n\n## Abschnitt\n\nInhalt' } as
        | { kind: 'ready'; markdown: string }
        | { kind: 'unresolved'; markdown: string; placeholders: readonly string[] },
}));
vi.mock('@/lib/legal/legal-content', async () => {
    const actualModule = await import('@/lib/legal/legal-content');
    return {
        ...actualModule,
        loadLegalDocument: async () => documentStub.state,
    };
});

vi.mock('next-intl/server', async () => {
    const { createTranslator } = await import('next-intl');
    const catalogByLocale = {
        en: (await import('../../../../../messages/en.json')).default,
        de: (await import('../../../../../messages/de.json')).default,
    };
    const createStrictTranslator = createTranslator as unknown as (translatorConfig: {
        locale: SupportedLocale;
        messages: Record<string, unknown>;
        namespace?: string;
        onError: (translationError: Error) => never;
    }) => unknown;
    return {
        getTranslations: async (request: { locale: SupportedLocale; namespace?: string }) =>
            createStrictTranslator({
                locale: request.locale,
                messages: catalogByLocale[request.locale],
                namespace: request.namespace,
                onError: (translationError) => {
                    throw translationError;
                },
            }),
    };
});

import LegalPage, { generateMetadata } from './page';

interface RenderableElement {
    readonly type: unknown;
    readonly props?: { readonly children?: unknown };
}

async function executeServerTree(treeNode: unknown, renderedTexts: string[]): Promise<void> {
    if (typeof treeNode === 'string') {
        renderedTexts.push(treeNode);
        return;
    }
    if (Array.isArray(treeNode)) {
        for (const childNode of treeNode) await executeServerTree(childNode, renderedTexts);
        return;
    }
    if (typeof treeNode !== 'object' || treeNode === null) return;
    const elementNode = treeNode as RenderableElement;
    if (typeof elementNode.type === 'function') {
        const renderComponent = elementNode.type as (componentProps: unknown) => unknown;
        await executeServerTree(await renderComponent(elementNode.props ?? {}), renderedTexts);
        return;
    }
    await executeServerTree(elementNode.props?.children, renderedTexts);
}

async function renderLegalPage(locale: string, legalSlug: string): Promise<string[]> {
    const pageTree = await LegalPage({ params: Promise.resolve({ locale, legalSlug }) });
    const renderedTexts: string[] = [];
    await executeServerTree(pageTree, renderedTexts);
    return renderedTexts;
}

describe('legal page route /{locale}/{slug}', () => {
    beforeEach(() => {
        vi.stubEnv('APP_BASE_URL', 'https://unslop.example');
        documentStub.state = { kind: 'ready', markdown: '# Stub\n\n## Abschnitt\n\nInhalt' };
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('is a 404 while the slug is not enabled by the flag', async () => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, '');
        await expect(renderLegalPage('de', 'impressum')).rejects.toThrow(NOT_FOUND_SENTINEL);
    });

    it('is a 404 for unknown slugs and unsupported locales even when everything is live', async () => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, 'impressum,privacy,terms,refund,dpa');
        await expect(renderLegalPage('de', 'datenschutz')).rejects.toThrow(NOT_FOUND_SENTINEL);
        await expect(renderLegalPage('fr', 'privacy')).rejects.toThrow(NOT_FOUND_SENTINEL);
    });

    it('is a 404 when an enabled page still carries a placeholder (guard, §5.4)', async () => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, 'impressum');
        documentStub.state = { kind: 'unresolved', markdown: '# Impressum', placeholders: ['HRB-NUMMER'] };
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        await expect(renderLegalPage('de', 'impressum')).rejects.toThrow(NOT_FOUND_SENTINEL);
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('legal_page_unresolved_placeholders'));
        consoleError.mockRestore();
    });

    it('renders an unresolved page only with the preview switch, and never in production', async () => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, 'impressum');
        vi.stubEnv('LEGAL_PAGES_PREVIEW_PLACEHOLDERS', 'true');
        documentStub.state = { kind: 'unresolved', markdown: '# Impressum\n\nHRB [HRB-NUMMER]', placeholders: ['HRB-NUMMER'] };

        const previewTexts = await renderLegalPage('de', 'impressum');
        expect(previewTexts).toContain('Impressum');
        expect(previewTexts.join(' ')).toContain('offenen Platzhaltern');

        vi.stubEnv('VERCEL_ENV', 'production');
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        await expect(renderLegalPage('de', 'impressum')).rejects.toThrow(NOT_FOUND_SENTINEL);
        consoleError.mockRestore();
    });

    it('renders the markdown once the slug is live and resolved', async () => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, 'privacy');
        const renderedTexts = await renderLegalPage('en', 'privacy');
        expect(renderedTexts).toContain('Stub');
        expect(renderedTexts).toContain('Abschnitt');
        expect(renderedTexts).toContain('Inhalt');
    });

    it.each([
        { locale: 'de', title: deMessages.marketing.legal.titles.privacy },
        { locale: 'en', title: enMessages.marketing.legal.titles.privacy },
    ] as const)('resolves localized metadata for $locale with canonical + alternates', async ({ locale, title }) => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, 'privacy');
        const metadata = await generateMetadata({ params: Promise.resolve({ locale, legalSlug: 'privacy' }) });
        expect(metadata.title).toBe(`${title} — Unslop`);
        expect(metadata.alternates?.canonical).toBe(`/${locale}/privacy`);
        expect(metadata.alternates?.languages).toEqual({ en: '/en/privacy', de: '/de/privacy' });
        expect(String(metadata.metadataBase)).toBe('https://unslop.example/');
    });

    it('does not expose metadata for a page that is not live', async () => {
        vi.stubEnv(LEGAL_PAGES_LIVE_ENV, '');
        await expect(
            generateMetadata({ params: Promise.resolve({ locale: 'de', legalSlug: 'privacy' }) }),
        ).rejects.toThrow(NOT_FOUND_SENTINEL);
    });
});
