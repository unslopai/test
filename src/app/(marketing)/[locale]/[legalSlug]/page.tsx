import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isSupportedLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config';
import { siteBaseUrl } from '@/lib/site-base-url';
import {
    isLegalPageLive,
    isLegalPageSlug,
    isPlaceholderPreviewAllowed,
    type LegalPageSlug,
} from '@/lib/legal/legal-pages';
import { extractDocumentTitle, loadLegalDocument } from '@/lib/legal/legal-content';
import { LegalDocument } from '../../components/LegalDocument';

/**
 * Rechtsseiten `/{locale}/{impressum|privacy|terms|refund|dpa}`
 * (LEGAL_PAGES_SPEC.md §5). Fail-closed in drei Stufen: unbekannter Slug,
 * nicht freigeschalteter Slug (Flag) und Text mit offenem Platzhalter ⇒ 404.
 * Vor der HR-Eintragung darf nichts davon erreichbar sein (Entscheidung E12).
 */

interface LegalPageProps {
    readonly params: Promise<{ locale: string; legalSlug: string }>;
}

interface ResolvedLegalRoute {
    readonly locale: SupportedLocale;
    readonly slug: LegalPageSlug;
}

async function resolveLiveRoute(params: LegalPageProps['params']): Promise<ResolvedLegalRoute> {
    const { locale, legalSlug } = await params;
    if (!isSupportedLocale(locale) || !isLegalPageSlug(legalSlug) || !isLegalPageLive(legalSlug)) {
        notFound();
    }
    return { locale, slug: legalSlug };
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
    const { locale, slug } = await resolveLiveRoute(params);
    const legalText = await getTranslations({ locale, namespace: 'marketing.legal' });
    const localizedUrls = Object.fromEntries(
        SUPPORTED_LOCALES.map((supportedLocale) => [supportedLocale, `/${supportedLocale}/${slug}`]),
    );

    return {
        metadataBase: siteBaseUrl(),
        title: `${legalText(`titles.${slug}`)} — Unslop`,
        alternates: { canonical: `/${locale}/${slug}`, languages: localizedUrls },
    };
}

export default async function LegalPage({ params }: LegalPageProps) {
    const { locale, slug } = await resolveLiveRoute(params);
    const documentState = await loadLegalDocument(slug, locale);

    if (documentState.kind === 'unresolved' && !isPlaceholderPreviewAllowed()) {
        console.error(
            `[legal] legal_page_unresolved_placeholders slug=${slug} locale=${locale} ` +
            `placeholders=${JSON.stringify(documentState.placeholders)}`,
        );
        notFound();
    }

    const documentTitle = extractDocumentTitle(documentState.markdown);
    return (
        <main id="main" aria-label={documentTitle ?? slug}>
            {documentState.kind === 'unresolved' && (
                <PlaceholderPreviewBanner placeholders={documentState.placeholders} />
            )}
            <LegalDocument markdown={documentState.markdown} />
        </main>
    );
}

/** Nur in Preview/lokal sichtbar (§5.4): macht offene Platzhalter unübersehbar. */
function PlaceholderPreviewBanner({ placeholders }: { readonly placeholders: readonly string[] }) {
    return (
        <p
            role="status"
            className="mx-auto mt-10 max-w-3xl border border-amber-400/40 bg-amber-400/10 px-6 py-3 text-sm text-amber-200"
        >
            Vorschau mit {placeholders.length} offenen Platzhaltern — diese Seite ist nicht freigegeben.
        </p>
    );
}
