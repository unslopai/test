import type { MetadataRoute } from 'next';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { liveLegalPageSlugs } from '@/lib/legal/legal-pages';
import { siteBaseUrl } from '@/lib/site-base-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteBaseUrl();
  const localizedLandingUrls = Object.fromEntries(
    SUPPORTED_LOCALES.map((supportedLocale) => [
      supportedLocale,
      new URL(`/${supportedLocale}`, baseUrl).toString(),
    ]),
  );

  const landingEntries: MetadataRoute.Sitemap = SUPPORTED_LOCALES.map((supportedLocale) => ({
    url: localizedLandingUrls[supportedLocale],
    changeFrequency: 'weekly',
    priority: 1,
    alternates: { languages: localizedLandingUrls },
  }));

  // Rechtsseiten nur, wenn sie freigeschaltet sind (LEGAL_PAGES_SPEC.md §5.2).
  const legalEntries: MetadataRoute.Sitemap = liveLegalPageSlugs().flatMap((legalSlug) => {
    const localizedLegalUrls = Object.fromEntries(
      SUPPORTED_LOCALES.map((supportedLocale) => [
        supportedLocale,
        new URL(`/${supportedLocale}/${legalSlug}`, baseUrl).toString(),
      ]),
    );
    return SUPPORTED_LOCALES.map((supportedLocale) => ({
      url: localizedLegalUrls[supportedLocale],
      changeFrequency: 'monthly' as const,
      priority: 0.3,
      alternates: { languages: localizedLegalUrls },
    }));
  });

  return [...landingEntries, ...legalEntries];
}
