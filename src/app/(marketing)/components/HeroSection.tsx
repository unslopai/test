import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import type { SupportedLocale } from '@/i18n/config';
import { isWaitlistLive } from '@/lib/waitlist/waitlist-flag';
import { SourceSup } from './SourceSup';
import { WaitlistCta } from './WaitlistCta';

interface HeroSectionProps {
  readonly locale: SupportedLocale;
}

/**
 * Hero: pixel-accented H1 left, BLUF + evidence-backed subline + CTAs
 * bottom-right, and a decorative product-window mock floating below
 * (structural ref: Interfere hero). Copy and semantics are unchanged;
 * the window is aria-hidden set dressing, not content.
 *
 * Bis zum Launch ersetzt das Waitlist-Formular die Login-CTAs
 * (WAITLIST_SPEC.md Entscheidung 4, geschaltet über `isWaitlistLive`).
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
              <SourceSup sourceKeys={['aira']} />
            </p>
            {isWaitlistLive() ? (
              <HeroWaitlistRow
                locale={locale}
                secondaryLabel={heroText('ctaSecondary')}
                tagline={heroText('tagline')}
              />
            ) : (
              <HeroCtaRow
                primaryLabel={heroText('ctaPrimary')}
                secondaryLabel={heroText('ctaSecondary')}
                tagline={heroText('tagline')}
              />
            )}
          </div>
        </div>
        <HeroProductWindow />
      </div>
    </section>
  );
}

interface HeroWaitlistRowProps {
  readonly locale: SupportedLocale;
  readonly secondaryLabel: string;
  readonly tagline: string;
}

/** Pre-Launch-Variante der CTA-Reihe: Formular statt Login-Button, Evidenz-Link bleibt. */
function HeroWaitlistRow({ locale, secondaryLabel, tagline }: HeroWaitlistRowProps) {
  return (
    <div className="marketing-rise mt-8" style={{ animationDelay: '320ms' }}>
      <WaitlistCta locale={locale} source="landing_hero" align="start" />
      <a
        href="#evidence"
        className="mt-5 inline-block text-sm font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-4 transition hover:text-white"
      >
        {secondaryLabel}
      </a>
      <p className="mt-8 font-pixel text-[0.7rem] uppercase leading-relaxed tracking-[0.15em] text-zinc-500">
        {tagline}
      </p>
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

interface HeroCtaRowProps {
  readonly primaryLabel: string;
  readonly secondaryLabel: string;
  readonly tagline: string;
}

function HeroCtaRow({ primaryLabel, secondaryLabel, tagline }: HeroCtaRowProps) {
  return (
    <div className="marketing-rise" style={{ animationDelay: '320ms' }}>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href="/login"
          className="rounded-md bg-lime-300 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_24px_rgba(190,242,100,0.25)] transition hover:-translate-y-px hover:bg-lime-200"
        >
          {primaryLabel}
        </Link>
        <a
          href="#evidence"
          className="rounded-md border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-medium text-zinc-200 backdrop-blur transition hover:border-white/30 hover:text-white"
        >
          {secondaryLabel}
        </a>
      </div>
      <p className="mt-8 font-pixel text-[0.7rem] uppercase leading-relaxed tracking-[0.15em] text-zinc-500">
        {tagline}
      </p>
    </div>
  );
}

/**
 * Decorative mock of the review-gate dashboard, styled as a floating glass
 * window (hairline border, inner top highlight, deep drop shadow). Hidden
 * from assistive tech and hit testing — it is imagery, not UI.
 */
function HeroProductWindow() {
  return (
    <div
      aria-hidden="true"
      className="marketing-rise pointer-events-none relative mt-16 select-none sm:mt-24"
      style={{ animationDelay: '420ms' }}
    >
      <div className="absolute -inset-x-10 -top-12 h-44 rounded-full bg-lime-300/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_60px_-15px_rgba(0,0,0,0.7),0_70px_140px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <PreviewChromeBar />
        <div className="flex">
          <PreviewSidebarRail />
          <div className="grid min-w-0 flex-1 md:grid-cols-[1fr_1.2fr]">
            <PreviewFindingsPane />
            <PreviewDiffPane />
          </div>
        </div>
        <PreviewVerdictStrip />
      </div>
    </div>
  );
}

function PreviewChromeBar() {
  return (
    <div className="flex h-11 items-center gap-4 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-transparent px-4">
      <div className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
      </div>
      <span className="truncate font-mono text-xs text-zinc-500">
        unslop — pull request #482 · fix: stripe webhook retries
      </span>
      <span className="ml-auto hidden rounded-full border border-lime-300/20 bg-lime-300/[0.06] px-2.5 py-0.5 font-pixel text-[10px] uppercase tracking-widest text-lime-300/80 sm:block">
        Review gate
      </span>
    </div>
  );
}

function PreviewSidebarRail() {
  return (
    <div className="hidden w-14 flex-col items-center gap-3 border-r border-white/[0.06] py-5 sm:flex">
      <span className="h-7 w-7 rounded-md border border-lime-300/30 bg-lime-300/10" />
      <span className="h-7 w-7 rounded-md border border-white/[0.06] bg-white/[0.03]" />
      <span className="h-7 w-7 rounded-md border border-white/[0.06] bg-white/[0.03]" />
      <span className="h-7 w-7 rounded-md border border-white/[0.06] bg-white/[0.03]" />
      <span className="mt-auto h-7 w-7 rounded-full border border-white/[0.06] bg-white/[0.03]" />
    </div>
  );
}

type PreviewSeverity = 'blocker' | 'warning';

interface PreviewFinding {
  readonly ruleId: string;
  readonly severity: PreviewSeverity;
  readonly note: string;
}

/** Mock findings quoting real rule IDs from THE LAW, so the shot reads as ours. */
const PREVIEW_FINDINGS: readonly PreviewFinding[] = [
  { ruleId: 'ASYNC-001', severity: 'blocker', note: 'Floating promise in webhook handler' },
  { ruleId: 'SEC-002', severity: 'blocker', note: 'Service-role key referenced in client bundle' },
  { ruleId: 'MAINT-001', severity: 'warning', note: 'Cognitive complexity 19 exceeds limit of 15' },
  { ruleId: 'ARCH-002', severity: 'warning', note: "Blind 'use client' on a server-renderable tree" },
];

const SEVERITY_DOT_CLASS: Record<PreviewSeverity, string> = {
  blocker: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]',
  warning: 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.5)]',
};

function PreviewFindingsPane() {
  return (
    <div className="border-b border-white/[0.06] p-4 sm:p-5 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Findings
        </span>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-zinc-400">
          {PREVIEW_FINDINGS.length}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {PREVIEW_FINDINGS.map((finding) => (
          <li
            key={finding.ruleId}
            className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT_CLASS[finding.severity]}`}
            />
            <span className="min-w-0">
              <span className="block font-mono text-[11px] text-zinc-300">{finding.ruleId}</span>
              <span className="block truncate text-xs text-zinc-500">{finding.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type PreviewDiffLineKind = 'context' | 'removed' | 'added';

interface PreviewDiffLine {
  readonly kind: PreviewDiffLineKind;
  readonly code: string;
}

const PREVIEW_DIFF_LINES: readonly PreviewDiffLine[] = [
  { kind: 'context', code: 'export async function POST(request: Request) {' },
  { kind: 'removed', code: '  handleStripeEvent(request);' },
  { kind: 'added', code: '  await handleStripeEvent(request);' },
  { kind: 'context', code: '  return NextResponse.json({ received: true });' },
  { kind: 'context', code: '}' },
];

const DIFF_LINE_CLASS: Record<PreviewDiffLineKind, string> = {
  context: 'text-zinc-500',
  removed: 'bg-red-500/10 text-red-300',
  added: 'bg-lime-400/10 text-lime-300',
};

function PreviewDiffPane() {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="truncate font-mono text-[11px] text-zinc-400">
          src/app/api/stripe/webhook/route.ts
        </span>
        <span className="text-[11px] text-zinc-600">ASYNC-001</span>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.05] bg-black/40 py-2 font-mono text-[11px] leading-relaxed">
        {PREVIEW_DIFF_LINES.map((diffLine, lineIndex) => (
          <div key={diffLine.code} className={`flex px-3 ${DIFF_LINE_CLASS[diffLine.kind]}`}>
            <span className="w-7 shrink-0 select-none text-zinc-700">{lineIndex + 7}</span>
            <span className="whitespace-pre">{diffLine.code}</span>
          </div>
        ))}
      </div>
      <PreviewBotComment />
    </div>
  );
}

/** Skeleton of the bot's PR comment, so the diff pane fills its column. */
function PreviewBotComment() {
  return (
    <div className="mt-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        <span className="h-5 w-5 rounded-md border border-lime-300/30 bg-lime-300/10" />
        <span className="font-mono text-[11px] text-zinc-400">unslop[bot]</span>
        <span className="text-[10px] text-zinc-600">just now</span>
      </div>
      <div className="mt-3 space-y-2">
        <span className="block h-2 w-11/12 rounded-full bg-white/[0.06]" />
        <span className="block h-2 w-3/4 rounded-full bg-white/[0.06]" />
        <span className="block h-2 w-1/2 rounded-full bg-white/[0.06]" />
      </div>
    </div>
  );
}

function PreviewVerdictStrip() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:px-5">
      <span className="font-mono text-[11px] text-zinc-500">
        deterministic pass · 119 rules · 1.4s
      </span>
      <span className="rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
        Blocked — 2 blockers · 2 warnings
      </span>
    </div>
  );
}
