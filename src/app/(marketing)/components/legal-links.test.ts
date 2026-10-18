/**
 * Footer-Regressionsschutz (LEGAL_PAGES_SPEC.md §7): ohne Flag darf der
 * Marketing-Footer keine Rechtslinks zeigen (der Zustand vor der Eintragung);
 * mit Flag genau die freigeschalteten, in der Sprache der Seite.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { SupportedLocale } from '@/i18n/config';
import { LEGAL_PAGES_LIVE_ENV } from '@/lib/legal/legal-pages';
import enMessages from '../../../../messages/en.json';
import deMessages from '../../../../messages/de.json';

const requestScope = vi.hoisted(() => ({ locale: 'en' as 'en' | 'de' }));

vi.mock('next/link', () => ({
    default: (linkProps: { children?: unknown }) => linkProps.children ?? null,
}));

vi.mock('next-intl/server', async () => {
    const { createTranslator } = await import('next-intl');
    const catalogByLocale = {
        en: (await import('../../../../messages/en.json')).default,
        de: (await import('../../../../messages/de.json')).default,
    };
    const createStrictTranslator = createTranslator as unknown as (translatorConfig: {
        locale: SupportedLocale;
        messages: Record<string, unknown>;
        namespace?: string;
        onError: (translationError: Error) => never;
    }) => unknown;
    return {
        getTranslations: async (request?: string | { locale: SupportedLocale; namespace?: string }) => {
            const namespace = typeof request === 'string' ? request : request?.namespace;
            const locale = typeof request === 'object' ? request.locale : requestScope.locale;
            return createStrictTranslator({
                locale,
                messages: catalogByLocale[locale],
                namespace,
                onError: (translationError) => {
                    throw translationError;
                },
            });
        },
    };
});

import { MarketingFooter } from './MarketingFooter';

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

async function renderFooter(locale: SupportedLocale): Promise<string[]> {
    requestScope.locale = locale;
    const renderedTexts: string[] = [];
    await executeServerTree(createElement(MarketingFooter, { locale }), renderedTexts);
    return renderedTexts;
}

const LOCALE_CASES = [
    { locale: 'en', catalog: enMessages },
    { locale: 'de', catalog: deMessages },
] as const;

describe('marketing footer legal links', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe.each(LOCALE_CASES)('locale $locale', ({ locale, catalog }) => {
        it('shows no legal links while the flag is unset', async () => {
            vi.stubEnv(LEGAL_PAGES_LIVE_ENV, '');
            const renderedTexts = await renderFooter(locale);
            for (const linkLabel of Object.values(catalog.marketing.legal.links)) {
                expect(renderedTexts).not.toContain(linkLabel);
            }
        });

        it('shows exactly the live slugs with localized labels', async () => {
            vi.stubEnv(LEGAL_PAGES_LIVE_ENV, 'impressum,privacy');
            const renderedTexts = await renderFooter(locale);
            expect(renderedTexts).toContain(catalog.marketing.legal.links.impressum);
            expect(renderedTexts).toContain(catalog.marketing.legal.links.privacy);
            expect(renderedTexts).not.toContain(catalog.marketing.legal.links.terms);
            expect(renderedTexts).not.toContain(catalog.marketing.legal.links.dpa);
        });
    });
});
