import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config';
import { MARKETING_SOURCES, arxivAbstractUrl } from '../marketing-sources';
import { LegalLinks } from './LegalLinks';

interface MarketingFooterProps {
  readonly locale: SupportedLocale;
}

/** Footer: the sources block every footnote points into, plus legal + language. */
export async function MarketingFooter({ locale }: MarketingFooterProps) {
  const footerText = await getTranslations('marketing.footer');

  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <section id="sources" aria-label={footerText('sourcesHeading')} className="scroll-mt-20">
          <p className="font-pixel text-xs uppercase tracking-[0.2em] text-lime-300">
            {footerText('sourcesEyebrow')}
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-50">
            {footerText('sourcesHeading')}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
            {footerText('sourcesIntro')}
          </p>
          <SourcesList />
        </section>
        <FooterBottomRow locale={locale} />
        <LegalLinks locale={locale} className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" />
        <p className="mt-8 text-xs text-zinc-600">
          {footerText('rights', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}

async function SourcesList() {
  const footerText = await getTranslations('marketing.footer');

  return (
    <ol className="mt-8 grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
      {MARKETING_SOURCES.map((registeredSource, sourceIndex) => (
        <li
          key={registeredSource.key}
          id={`source-${sourceIndex + 1}`}
          className="flex gap-3 scroll-mt-24 text-zinc-500"
        >
          <span className="font-mono text-zinc-600">[{sourceIndex + 1}]</span>
          <span>
            {footerText(`sources.${registeredSource.key}`)}{' '}
            <a
              href={arxivAbstractUrl(registeredSource.arxivId)}
              rel="noopener noreferrer"
              target="_blank"
              className="font-mono text-zinc-400 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-lime-300 hover:decoration-lime-300/50"
            >
              arXiv:{registeredSource.arxivId}
            </a>
          </span>
        </li>
      ))}
    </ol>
  );
}

async function FooterBottomRow({ locale }: MarketingFooterProps) {
  const footerText = await getTranslations('marketing.footer');

  return (
    <div className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-white/10 pt-8">
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
