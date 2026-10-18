import { Silkscreen } from 'next/font/google';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { LegalLinks } from '@/app/(marketing)/components/LegalLinks';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/config';
import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { GitHubLoginButton } from './GitHubLoginButton';

const silkscreen = Silkscreen({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-silkscreen',
});

export async function generateMetadata(): Promise<Metadata> {
  const loginText = await getTranslations('login');
  return { title: `${loginText('heading')} — Unslop` };
}

/**
 * Split-screen login in the landing page's design language: the auth panel on
 * the left, the brand statement on a dot-grid panel on the right. Locale stays
 * cookie-based (dashboard tree) — the LocaleSwitcher keeps working here.
 */
export default async function LoginPage() {
  return (
    <div
      className={`${silkscreen.variable} marketing-surface grid min-h-screen text-zinc-300 lg:grid-cols-2`}
    >
      <AuthPanel />
      <BrandPanel />
    </div>
  );
}

async function AuthPanel() {
  const loginText = await getTranslations('login');
  const footerText = await getTranslations('marketing.footer');
  const requestLocale = await getLocale();
  const visitorLocale = isSupportedLocale(requestLocale) ? requestLocale : DEFAULT_LOCALE;

  return (
    <div className="flex flex-col px-8 py-8 sm:px-12">
      <div className="flex items-center justify-between">
        <Link
          href={`/${visitorLocale}`}
          className="group flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <span aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">
            ←
          </span>
          {loginText('back')}
        </Link>
        <LocaleSwitcher />
      </div>
      <div className="flex flex-1 items-center py-16">
        <AuthCard />
      </div>
      <LegalLinks locale={visitorLocale} className="flex flex-wrap gap-x-5 gap-y-1 text-xs" />
      <p className="mt-3 text-xs text-zinc-600">
        {footerText('rights', { year: new Date().getFullYear() })}
      </p>
    </div>
  );
}

async function AuthCard() {
  const loginText = await getTranslations('login');

  return (
    <div className="w-full max-w-sm">
      <p className="flex items-baseline gap-1.5">
        <span className="font-pixel text-base text-zinc-50">unslop</span>
        <span className="marketing-caret inline-block h-3 w-1.5 bg-lime-300" aria-hidden="true" />
      </p>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-50">
        {loginText('heading')}
      </h1>
      <p className="mt-2 text-zinc-400">{loginText('subtitle')}</p>
      <div className="mt-8">
        <GitHubLoginButton />
      </div>
      <p className="mt-6 text-xs leading-relaxed text-zinc-500">
        {loginText.rich('scopesNotice', {
          repo: (chunks) => <code className="font-mono text-zinc-300">{chunks}</code>,
          hook: (chunks) => <code className="font-mono text-zinc-300">{chunks}</code>,
          org: (chunks) => <code className="font-mono text-zinc-300">{chunks}</code>,
        })}
      </p>
    </div>
  );
}

async function BrandPanel() {
  const heroText = await getTranslations('marketing.hero');

  return (
    <aside className="marketing-dot-grid relative hidden border-l border-white/10 lg:flex lg:items-center lg:justify-center">
      <div className="max-w-lg px-12 py-16">
        <p className="font-pixel text-xs uppercase tracking-[0.2em] text-lime-300">
          {heroText('eyebrow')}
        </p>
        <p className="mt-6 text-3xl font-semibold leading-snug tracking-tight text-zinc-50">
          {heroText('tagline')}
        </p>
        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="max-w-md text-sm leading-relaxed text-zinc-400">{heroText('sub')}</p>
        </div>
      </div>
    </aside>
  );
}
