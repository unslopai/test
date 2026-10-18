import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import type { SupportedLocale } from '@/i18n/config';
import { isWaitlistLive } from '@/lib/waitlist/waitlist-flag';
import { PullRequestExhibit } from './PullRequestExhibit';
import { WaitlistCta } from './WaitlistCta';

interface HeroSectionProps {
  readonly locale: SupportedLocale;
}

/**
 * Hero: pixel-accented H1 left, BLUF + Mechanismus-Subline + CTAs rechts,
 * darunter ein echter Review als Exponat (PullRequestExhibit).
 *
 * Claim-Policy 2026-09-30 (MARKETING_CLAIMS.md §00): keine Studienzahl, das
 * Problem aus dem Alltag, der Mechanismus in einem Satz, echte Ausgabe.
 *
 * CTAs (WAITLIST_SPEC.md §4.1): mit `isWaitlistLive` steht hier das
 * Waitlist-Formular. Ohne Flag führen beide CTAs auf Seitenanker — solange
 * die Registrierung gesperrt ist, verspricht die Landing keine Installation.
 */
export async function HeroSection({ locale }: HeroSectionProps) {
  const heroText = await getTranslations('marketing.hero');

  return (
    <section className="relative overflow-hidden">
      <HeroGlow />
      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <p className="marketing-rise font-pixel text-xs uppercase tracking-[0.2em] text-lime-300">
              {heroText('eyebrow')}
            </p>
            <h1
              className="marketing-rise mt-6 text-balance text-4xl font-semibold leading-[1.06] tracking-tight text-zinc-50 sm:text-5xl xl:text-6xl"
              style={{ animationDelay: '80ms' }}
            >
              {heroText.rich('headline', {
                accent: (chunks: ReactNode) => (
                  <span className="font-pixel text-[0.82em] leading-none text-lime-300">
                    {chunks}
                  </span>
                ),
              })}
            </h1>
          </div>
          <HeroPitch locale={locale} />
        </div>
        <div id="exhibit" className="scroll-mt-20">
          <PullRequestExhibit caption={heroText('exhibitCaption')} />
        </div>
      </div>
    </section>
  );
}

/** Rechte Hero-Spalte: BLUF, Mechanismus, Beta-Status und die CTA-Reihe. */
async function HeroPitch({ locale }: HeroSectionProps) {
  const heroText = await getTranslations('marketing.hero');

  return (
    <div className="flex flex-col lg:col-span-5 lg:justify-end">
      <p
        className="marketing-rise text-lg leading-relaxed text-zinc-200"
        style={{ animationDelay: '160ms' }}
      >
        {heroText('bluf')}
      </p>
      <p
        className="marketing-rise mt-4 text-base leading-relaxed text-zinc-400"
        style={{ animationDelay: '240ms' }}
      >
        {heroText('sub')}
      </p>
      <div className="marketing-rise mt-8" style={{ animationDelay: '320ms' }}>
        {isWaitlistLive() ? (
          <WaitlistCta locale={locale} source="landing_hero" align="start" />
        ) : (
          <HeroAnchorLink label={heroText('ctaPrimary')} />
        )}
        <a
          href="#mechanism"
          className="mt-5 inline-block text-sm font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-4 transition hover:text-white"
        >
          {heroText('ctaSecondary')}
        </a>
        <p className="mt-6 text-sm leading-relaxed text-zinc-500">{heroText('status')}</p>
        <p className="mt-6 font-pixel text-[0.7rem] uppercase leading-relaxed tracking-[0.15em] text-zinc-500">
          {heroText('tagline')}
        </p>
      </div>
    </div>
  );
}

/** Primär-CTA ohne Waitlist-Flag: Anker auf das Exponat statt `/login` (W8). */
function HeroAnchorLink({ label }: { readonly label: string }) {
  return (
    <div>
      <a
        href="#exhibit"
        className="inline-block rounded-md bg-lime-300 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_24px_rgba(190,242,100,0.25)] transition hover:-translate-y-px hover:bg-lime-200"
      >
        {label}
      </a>
    </div>
  );
}

/** Ambient backdrop: lime glow pools + a masked dot grid, all decorative. */
function HeroGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-[-14rem] h-[36rem] w-[70rem] -translate-x-1/2 rounded-full bg-lime-300/[0.07] blur-[140px]" />
      <div className="absolute left-[4%] top-[30rem] h-[26rem] w-[38rem] rounded-full bg-emerald-400/[0.05] blur-[120px]" />
      <div className="marketing-dot-grid absolute inset-x-0 top-0 h-[46rem] opacity-40 [mask-image:radial-gradient(58%_55%_at_50%_35%,black,transparent)]" />
    </div>
  );
}
