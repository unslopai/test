import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { SupportedLocale } from '@/i18n/config';

const NAV_ANCHOR_IDS = ['findings', 'mechanism', 'architecture', 'faq'] as const;

interface MarketingNavProps {
  readonly locale: SupportedLocale;
}

/**
 * Sticky top navigation: pixel-font brand, section anchors, login.
 * Kein „Get started"-Button mehr: er führte auf `/login`, obwohl die
 * Registrierung gesperrt ist (W8). Der Login-Link bleibt für Bestandskonten.
 */
export async function MarketingNav({ locale }: MarketingNavProps) {
  const navText = await getTranslations('marketing.nav');
  const accessibilityText = await getTranslations('marketing.a11y');

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0b]/85 backdrop-blur-md">
      <nav
        aria-label={accessibilityText('mainNavigation')}
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
      >
        <BrandMark locale={locale} />
        <div className="hidden items-center gap-8 md:flex">
          {NAV_ANCHOR_IDS.map((anchorId) => (
            <a
              key={anchorId}
              href={`#${anchorId}`}
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              {navText(anchorId)}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="text-sm text-zinc-300 transition-colors hover:text-white"
          >
            {navText('login')}
          </Link>
        </div>
      </nav>
    </header>
  );
}

function BrandMark({ locale }: MarketingNavProps) {
  return (
    <Link href={`/${locale}`} className="flex items-baseline gap-1.5">
      <span className="font-pixel text-lg text-zinc-50">unslop</span>
      <span className="marketing-caret inline-block h-3.5 w-2 bg-lime-300" aria-hidden="true" />
    </Link>
  );
}
