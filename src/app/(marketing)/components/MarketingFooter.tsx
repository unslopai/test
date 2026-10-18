import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config';
import { LegalLinks } from './LegalLinks';

interface MarketingFooterProps {
  readonly locale: SupportedLocale;
}

/**
 * Footer: Hinweis zur Beleglage der Seite, plus legal + language. Der frühere
 * Quellenblock mit arXiv-Fußnoten ist entfallen — Paper stehen laut
 * MARKETING_CLAIMS.md §00 nur noch in Langform-Texten, nicht auf der Landing.
 */
export async function MarketingFooter({ locale }: MarketingFooterProps) {
  const footerText = await getTranslations('marketing.footer');

  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-500">{footerText('claimsNote')}</p>
        <FooterBottomRow locale={locale} />
        <LegalLinks locale={locale} className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" />
        <p className="mt-8 text-xs text-zinc-600">
          {footerText('rights', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}

async function FooterBottomRow({ locale }: MarketingFooterProps) {
  const footerText = await getTranslations('marketing.footer');

  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-white/10 pt-8">
      <div className="flex items-baseline gap-3">
        <span className="font-pixel text-base text-zinc-50">unslop</span>
        <span className="text-sm text-zinc-500">{footerText('tagline')}</span>
      </div>
      <nav className="flex items-center gap-6 text-sm">
        <Link href="/login" className="text-zinc-400 transition-colors hover:text-zinc-100">
          {footerText('loginLink')}
        </Link>
        <Link href="/dashboard" className="text-zinc-400 transition-colors hover:text-zinc-100">
          {footerText('dashboardLink')}
        </Link>
        <LanguageSwitch locale={locale} />
      </nav>
    </div>
  );
}

async function LanguageSwitch({ locale }: MarketingFooterProps) {
  const footerText = await getTranslations('marketing.footer');
  const accessibilityText = await getTranslations('marketing.a11y');
  const languageLabels: Record<SupportedLocale, string> = {
    en: footerText('languageEnglish'),
    de: footerText('languageGerman'),
  };

  return (
    <span aria-label={accessibilityText('languageSwitcher')} className="flex items-center gap-3">
      <span className="text-zinc-600">{footerText('languageLabel')}</span>
      {SUPPORTED_LOCALES.map((supportedLocale) => (
        <Link
          key={supportedLocale}
          href={`/${supportedLocale}`}
          hrefLang={supportedLocale}
          aria-current={supportedLocale === locale ? 'page' : undefined}
          className={
            supportedLocale === locale
              ? 'font-medium text-zinc-100'
              : 'text-zinc-400 transition-colors hover:text-zinc-100'
          }
        >
          {languageLabels[supportedLocale]}
        </Link>
      ))}
    </span>
  );
}
