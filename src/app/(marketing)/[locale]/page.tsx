import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isSupportedLocale, type SupportedLocale } from '@/i18n/config';
import { siteBaseUrl } from '@/lib/site-base-url';
import { HeroSection } from '../components/HeroSection';
import { StatBand } from '../components/StatBand';
import { EvidencePillars } from '../components/EvidencePillars';
import { VerdictTable } from '../components/VerdictTable';
import { ObjectionGrid } from '../components/ObjectionGrid';
import { ArchitectureSpec } from '../components/ArchitectureSpec';
import { FaqSection, FAQ_ITEM_KEYS } from '../components/FaqSection';
import { ClosingCta } from '../components/ClosingCta';

interface MarketingPageProps {
  readonly params: Promise<{ locale: string }>;
}

const OPEN_GRAPH_LOCALES: Record<SupportedLocale, string> = {
  en: 'en_US',
  de: 'de_DE',
};

export async function generateMetadata({ params }: MarketingPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  const metaText = await getTranslations({ locale, namespace: 'marketing.meta' });

  return {
    metadataBase: siteBaseUrl(),
    title: metaText('title'),
    description: metaText('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: { en: '/en', de: '/de', 'x-default': '/en' },
    },
    openGraph: {
      title: metaText('title'),
      description: metaText('description'),
      url: `/${locale}`,
      siteName: 'Unslop',
      locale: OPEN_GRAPH_LOCALES[locale],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: metaText('title'),
      description: metaText('description'),
    },
  };
}

export default async function MarketingLandingPage({ params }: MarketingPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <main id="main">
      <StructuredData />
      <HeroSection locale={locale} />
      <StatBand />
      <EvidencePillars />
      <VerdictTable />
      <ObjectionGrid />
      <ArchitectureSpec />
      <FaqSection />
      <ClosingCta locale={locale} />
    </main>
  );
}

/**
 * SoftwareApplication + FAQPage JSON-LD (UNSLOP_SEO_RULES §5: structured
 * output readiness). Built from the same catalogs as the visible FAQ, so the
 * schema can never drift from the rendered answers.
 */
async function StructuredData() {
  const metaText = await getTranslations('marketing.meta');
  const faqText = await getTranslations('marketing.faq');

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Unslop',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        description: metaText('description'),
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEM_KEYS.map((faqItemKey) => ({
          '@type': 'Question',
          name: faqText(`items.${faqItemKey}.question`),
          acceptedAnswer: {
            '@type': 'Answer',
            text: faqText(`items.${faqItemKey}.answer`),
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
