import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { SupportedLocale } from '@/i18n/config';
import { isWaitlistLive } from '@/lib/waitlist/waitlist-flag';
import { WaitlistCta } from './WaitlistCta';

interface ClosingCtaProps {
  readonly locale: SupportedLocale;
}

/**
 * Book-end CTA: the one-liner positioning statement plus the two actions.
 * Bis zum Launch steht hier das Waitlist-Formular statt der Login-Buttons
 * (WAITLIST_SPEC.md Entscheidung 4).
 */
export async function ClosingCta({ locale }: ClosingCtaProps) {
  const ctaText = await getTranslations('marketing.closingCta');

  return (
    <section className="border-t border-white/10">
      <div className="mx-auto max-w-4xl px-6 py-28 text-center">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-4xl">
          {ctaText('heading')}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">{ctaText('sub')}</p>
        {isWaitlistLive() ? (
          <div className="mx-auto mt-10 max-w-xl">
            <WaitlistCta locale={locale} source="landing_closing" align="center" />
          </div>
        ) : (
          <ClosingLoginButtons primaryLabel={ctaText('button')} secondaryLabel={ctaText('secondary')} />
        )}
      </div>
    </section>
  );
}

interface ClosingLoginButtonsProps {
  readonly primaryLabel: string;
  readonly secondaryLabel: string;
}

function ClosingLoginButtons({ primaryLabel, secondaryLabel }: ClosingLoginButtonsProps) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
      <Link
        href="/login"
        className="rounded-md bg-lime-300 px-7 py-3.5 text-sm font-semibold text-zinc-950 transition hover:-translate-y-px hover:bg-lime-200"
      >
        {primaryLabel}
      </Link>
      <Link
        href="/login"
        className="rounded-md border border-white/15 px-7 py-3.5 text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:text-white"
      >
        {secondaryLabel}
      </Link>
    </div>
  );
}
