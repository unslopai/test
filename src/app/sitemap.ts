import type { MetadataRoute } from 'next';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { siteBaseUrl } from '@/lib/site-base-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteBaseUrl();
  const localizedLandingUrls = Object.fromEntries(
    SUPPORTED_LOCALES.map((supportedLocale) => [
      supportedLocale,
      new URL(`/${supportedLocale}`, baseUrl).toString(),
    ]),
  );

  return SUPPORTED_LOCALES.map((supportedLocale) => ({
    url: localizedLandingUrls[supportedLocale],
    changeFrequency: 'weekly',
    priority: 1,
    alternates: { languages: localizedLandingUrls },
  }));
}
