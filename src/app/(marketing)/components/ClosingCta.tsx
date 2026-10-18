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
 * Mit `isWaitlistLive` steht hier das Waitlist-Formular (WAITLIST_SPEC.md
 * Entscheidung 4). Ohne Flag führt der Hauptbutton zurück zu den Findings
 * statt auf `/login`: die Registrierung ist gesperrt, also verspricht die
 * Seite keine Installation (W8). Der Login-Link bleibt für Bestandskonten.
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
          <ClosingNeutralButtons primaryLabel={ctaText('button')} loginLabel={ctaText('secondary')} />
        )}
      </div>
    </section>
  );
}

interface ClosingNeutralButtonsProps {
  readonly primaryLabel: string;
  readonly loginLabel: string;
}

function ClosingNeutralButtons({ primaryLabel, loginLabel }: ClosingNeutralButtonsProps) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
      <a
        href="#findings"
        className="rounded-md bg-lime-300 px-7 py-3.5 text-sm font-semibold text-zinc-950 transition hover:-translate-y-px hover:bg-lime-200"
      >
        {primaryLabel}
      </a>
      <Link
        href="/login"
        className="rounded-md border border-white/15 px-7 py-3.5 text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:text-white"
      >
        {loginLabel}
      </Link>
    </div>
  );
}
