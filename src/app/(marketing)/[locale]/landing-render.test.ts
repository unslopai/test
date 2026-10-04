/**
 * SSR-Smoke-Test für die Marketing-Landing-Page (ROADMAP §2, Gap 2026-07-22:
 * "nothing asserts the landing page renders per locale").
 *
 * Getestet wird der ECHTE Server-Component-Baum (layout.tsx + page.tsx +
 * alle Sektionen) und die echte Copy-Auflösung aus messages/{en,de}.json.
 * Gemockt ist ausschließlich Next-Build-Plumbing, das außerhalb des
 * Next-Compilers nicht existiert: next/font/google (SWC-Feature), next/link
 * (Client-Hooks) und der Request-Kontext von next-intl/server — dessen Mock
 * delegiert an next-intls eigenen createTranslator über die realen Kataloge
 * mit strict onError: ein fehlender Key oder Katalog-Fallback wirft und
 * lässt den Test scheitern, statt still auf den Key-Namen zurückzufallen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import type { SupportedLocale } from '@/i18n/config';
import enMessages from '../../../../messages/en.json';
import deMessages from '../../../../messages/de.json';
import MarketingLayout from './layout';
import MarketingLandingPage, { generateMetadata } from './page';
import {
    CONFIRMED_MODEL_FINDING,
    DOWNGRADED_MODEL_FINDING,
    PULL_REQUEST_EXHIBIT,
} from '../real-findings';

/** Vom Test kontrollierter Ersatz für den Proxy-/Cookie-Request-Kontext. */
const requestScope = vi.hoisted(() => ({ locale: 'en' as 'en' | 'de' }));

vi.mock('next/font/google', () => ({
    Silkscreen: () => ({ variable: '--font-silkscreen', className: 'font-silkscreen' }),
}));

vi.mock('next/link', () => ({
    default: (linkProps: { children?: unknown }) => linkProps.children ?? null,
}));

/**
 * Das Waitlist-Formular ist eine Client-Komponente mit Hooks — außerhalb eines
 * React-Renderers nicht ausführbar. Der Stub liefert einen Marker, damit der
 * Test beweist, DASS der Server-Baum bei gesetztem Flag das Formular einhängt
 * und die Login-CTAs entfernt (WAITLIST_SPEC.md §6).
 */
const WAITLIST_FORM_MARKER = '__waitlist_form__';
vi.mock('../components/WaitlistForm', () => ({
    WaitlistForm: () => WAITLIST_FORM_MARKER,
}));

vi.mock('next-intl/server', async () => {
    const { createTranslator } = await import('next-intl');
    const catalogByLocale = {
        en: (await import('../../../../messages/en.json')).default,
        de: (await import('../../../../messages/de.json')).default,
    };
    // Die App übergibt Namespaces als dynamische Strings; die generische
    // Literal-Key-Signatur von createTranslator lässt das nicht zu. Die lose
    // Fassade ist rein typseitig — zur Laufzeit läuft der echte Translator,
    // und onError macht jede Fehlauflösung zum harten Testfehler.
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

interface RenderableElement {
    readonly type: unknown;
    readonly props?: { readonly children?: unknown };
}

/**
 * Führt einen React-Server-Component-Baum vollständig aus (jede Funktions-
 * Komponente wird aufgerufen und awaited) und sammelt alle Text-Knoten —
 * der kleinste Renderer, der RSC-async-Komponenten in Node ausführen kann
 * (react-dom/server unterstützt sie nicht).
 */
async function executeServerTree(treeNode: unknown, renderedTexts: string[]): Promise<void> {
    if (typeof treeNode === 'string') {
        renderedTexts.push(treeNode);
        return;
    }
    if (Array.isArray(treeNode)) {
        for (const childNode of treeNode) {
            await executeServerTree(childNode, renderedTexts);
        }
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

/** Rendert layout.tsx mit page.tsx als Kind — exakt die Prod-Komposition. */
async function renderLandingPage(locale: SupportedLocale): Promise<string[]> {
    requestScope.locale = locale;
    const layoutTree = await MarketingLayout({
        children: createElement(MarketingLandingPage, { params: Promise.resolve({ locale }) }),
        params: Promise.resolve({ locale }),
    });
    const renderedTexts: string[] = [];
    await executeServerTree(layoutTree, renderedTexts);
    return renderedTexts;
}

/**
 * Kennzeichen der früheren, auf Drittstudien gebauten Landing (CONTEXT.md §6,
 * W1/W10/W11): taucht eines davon wieder auf, ist die Claim-Policy vom
 * 2026-09-30 verletzt.
 */
const FORBIDDEN_STUDY_FRAGMENTS = [
    'arXiv',
    '44×',
    '44 to 1',
    '44 zu 1',
    '1.80×',
    '1,80×',
    '2.1 →',
    '2,1 →',
    '34.4%',
    '34,4 %',
    '87.1%',
    '77%',
    '205,474',
    '205.474',
    'Precision',
] as const;

const LOCALE_CASES = [
    { locale: 'en', ownCatalog: enMessages, otherCatalog: deMessages },
    { locale: 'de', ownCatalog: deMessages, otherCatalog: enMessages },
] as const;

describe('marketing landing page SSR smoke (ROADMAP §2)', () => {
    beforeEach(() => {
        vi.stubEnv('APP_BASE_URL', 'https://unslop.example');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe.each(LOCALE_CASES)('locale $locale', ({ locale, ownCatalog, otherCatalog }) => {
        it('renders layout + page server-side without throwing and resolves copy from its own catalog', async () => {
            const renderedTexts = await renderLandingPage(locale);

            // Layout-Copy (Skip-Link) und Page-Copy (Closing-CTA) müssen aus
            // dem Katalog DIESER Locale kommen — nicht aus dem der anderen.
            expect(renderedTexts).toContain(ownCatalog.marketing.a11y.skipToContent);
            expect(renderedTexts).toContain(ownCatalog.marketing.closingCta.heading);
            expect(renderedTexts).not.toContain(otherCatalog.marketing.a11y.skipToContent);
            expect(renderedTexts).not.toContain(otherCatalog.marketing.closingCta.heading);
        });

        it('shows the neutral anchor CTAs and no waitlist form while NEXT_PUBLIC_WAITLIST_LIVE is unset (W8)', async () => {
            const renderedTexts = await renderLandingPage(locale);

            expect(renderedTexts).toContain(ownCatalog.marketing.hero.ctaPrimary);
            expect(renderedTexts).toContain(ownCatalog.marketing.closingCta.button);
            expect(renderedTexts).not.toContain(WAITLIST_FORM_MARKER);
        });

        it('swaps hero + closing anchor CTAs for the waitlist form when NEXT_PUBLIC_WAITLIST_LIVE=true (WAITLIST_SPEC §4.1)', async () => {
            vi.stubEnv('NEXT_PUBLIC_WAITLIST_LIVE', 'true');
            const renderedTexts = await renderLandingPage(locale);

            expect(renderedTexts.filter((text) => text === WAITLIST_FORM_MARKER)).toHaveLength(2);
            expect(renderedTexts).not.toContain(ownCatalog.marketing.hero.ctaPrimary);
            expect(renderedTexts).not.toContain(ownCatalog.marketing.closingCta.button);
            // closingCta.secondary („Log in") ist bewusst NICHT geprüft: die Nav
            // behält ihren Login-Link mit demselben Wortlaut (Entscheidung 4).
            // Der Mechanismus-Link bleibt auch im Pre-Launch-Hero erreichbar.
            expect(renderedTexts).toContain(ownCatalog.marketing.hero.ctaSecondary);
        });

        it('renders no third-party study figure and no footnote to a paper (MARKETING_CLAIMS §00)', async () => {
            const renderedPage = (await renderLandingPage(locale)).join(' ');

            for (const forbiddenFragment of FORBIDDEN_STUDY_FRAGMENTS) {
                expect(renderedPage, `forbidden fragment: ${forbiddenFragment}`).not.toContain(forbiddenFragment);
            }
        });

        it('renders the own measurement only together with method, run and limits (MARKETING_CLAIMS §00.3)', async () => {
            const renderedTexts = await renderLandingPage(locale);
            const measurementCopy = ownCatalog.marketing.findings.measurement;

            expect(renderedTexts.join('')).toContain('126');
            expect(renderedTexts).toContain(measurementCopy.method);
            expect(renderedTexts).toContain(measurementCopy.run);
            expect(renderedTexts).toContain(measurementCopy.limits);
        });

        it('renders the stored product output of the three real findings verbatim', async () => {
            const renderedTexts = await renderLandingPage(locale);

            expect(renderedTexts).toContain(PULL_REQUEST_EXHIBIT.critique);
            expect(renderedTexts).toContain(CONFIRMED_MODEL_FINDING.rule);
            expect(renderedTexts).toContain(DOWNGRADED_MODEL_FINDING.critiqueParagraphs[1]);
        });

        it('resolves localized metadata with canonical + alternate URLs from APP_BASE_URL', async () => {
            const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });

            expect(metadata.title).toBe(ownCatalog.marketing.meta.title);
            expect(metadata.description).toBe(ownCatalog.marketing.meta.description);
            expect(metadata.title).not.toBe(otherCatalog.marketing.meta.title);

            expect(String(metadata.metadataBase)).toBe('https://unslop.example/');
            expect(metadata.alternates?.canonical).toBe(`/${locale}`);
            expect(metadata.alternates?.languages).toEqual({ en: '/en', de: '/de', 'x-default': '/en' });

            // Die Kanonical-URL, die Next aus metadataBase + canonical baut:
            const resolvedCanonicalUrl = new URL(`/${locale}`, metadata.metadataBase ?? undefined);
            expect(resolvedCanonicalUrl.href).toBe(`https://unslop.example/${locale}`);

            expect(metadata.openGraph?.locale).toBe(locale === 'en' ? 'en_US' : 'de_DE');
        });
    });
});
