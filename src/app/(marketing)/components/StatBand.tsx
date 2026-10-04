import { getTranslations } from 'next-intl/server';
import type { ComponentType } from 'react';
import { SourceSup } from './SourceSup';
import type { MarketingSourceKey } from '../marketing-sources';

type StatKey = 'judgeMiss' | 'severityGap' | 'erosion' | 'selfCorrection' | 'coverageIllusion' | 'ruleCount';

interface StatEntry {
  readonly statKey: StatKey;
  readonly sourceKeys: readonly MarketingSourceKey[];
  readonly bentoSpanClass: string;
  readonly Visual: ComponentType;
}

/**
 * Order matches the stat band in MARKETING_CLAIMS.md §3. Span classes shape
 * the bento: one wide feature card, four squares, one full-width strip.
 */
const STAT_ENTRIES: readonly StatEntry[] = [
  { statKey: 'judgeMiss', sourceKeys: ['aira'], bentoSpanClass: 'sm:col-span-2 lg:col-span-4', Visual: JudgeMissVisual },
  { statKey: 'severityGap', sourceKeys: ['aira'], bentoSpanClass: 'lg:col-span-2', Visual: SeverityGapVisual },
  { statKey: 'erosion', sourceKeys: ['erosion'], bentoSpanClass: 'lg:col-span-2', Visual: ErosionVisual },
  { statKey: 'selfCorrection', sourceKeys: ['erosion'], bentoSpanClass: 'lg:col-span-2', Visual: SelfCorrectionVisual },
  { statKey: 'coverageIllusion', sourceKeys: ['coverage'], bentoSpanClass: 'lg:col-span-2', Visual: CoverageIllusionVisual },
  { statKey: 'ruleCount', sourceKeys: [], bentoSpanClass: 'sm:col-span-2 lg:col-span-6', Visual: RuleCountVisual },
];

/** The numbers under the hero — every one footnoted to its study. */
export async function StatBand() {
  const statText = await getTranslations('marketing.statBand');

  return (
    <section className="border-y border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          {statText('heading')}
        </h2>
        <p className="mt-3 max-w-3xl text-zinc-400">{statText('intro')}</p>
        <dl className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {STAT_ENTRIES.map((statEntry) => (
            <StatBentoCard key={statEntry.statKey} statEntry={statEntry} />
          ))}
        </dl>
      </div>
    </section>
  );
}

async function StatBentoCard({ statEntry }: { readonly statEntry: StatEntry }) {
  const statText = await getTranslations('marketing.statBand');
  const { Visual } = statEntry;

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 transition-colors duration-300 hover:border-white/20 hover:from-white/[0.06] ${statEntry.bentoSpanClass}`}
    >
      <dt className="order-2 mt-2 text-sm leading-relaxed text-zinc-400">
        {statText(`stats.${statEntry.statKey}.caption`)}
        {statEntry.sourceKeys.length > 0 && <SourceSup sourceKeys={statEntry.sourceKeys} />}
      </dt>
      <dd className="order-1 flex flex-1 flex-col">
        <div aria-hidden="true" className="mb-6 flex-1">
          <Visual />
        </div>
        <span className="font-mono text-3xl font-medium tracking-tight text-zinc-50 transition-colors duration-300 group-hover:text-lime-300 sm:text-4xl">
          {statText(`stats.${statEntry.statKey}.value`)}
        </span>
      </dd>
    </div>
  );
}

const JUDGE_MISS_TICK_COUNT = 44;

/** 44 deterministic findings against a single LLM-judge sliver, 44:1 literal. */
function JudgeMissVisual() {
  const tickIndexes = Array.from({ length: JUDGE_MISS_TICK_COUNT }, (_, tickIndex) => tickIndex);

  return (
    <div className="flex h-full min-h-28 flex-col justify-end gap-2">
      <div className="grid grid-cols-[repeat(44,minmax(0,1fr))] gap-[3px]">
        {tickIndexes.map((tickIndex) => (
          <span
            key={tickIndex}
            className="h-14 rounded-[2px] bg-lime-300 transition-colors duration-300 group-hover:bg-lime-200"
            style={{ opacity: 0.3 + (0.7 * tickIndex) / (JUDGE_MISS_TICK_COUNT - 1) }}
          />
        ))}
      </div>
      <div className="grid grid-cols-[repeat(44,minmax(0,1fr))] gap-[3px] border-t border-white/10 pt-2">
        <span className="h-3 rounded-[2px] bg-zinc-600" />
      </div>
    </div>
  );
}

/** Two baseline-anchored bars at the 1 : 1.8 severity ratio. */
function SeverityGapVisual() {
  return (
    <div className="flex h-full min-h-28 items-end gap-4 border-b border-white/10">
      <span className="h-12 w-10 rounded-t-md bg-zinc-700/70 transition-colors duration-300 group-hover:bg-zinc-600/70" />
      <span className="h-[5.4rem] w-10 rounded-t-md bg-gradient-to-t from-amber-500/50 to-red-400/80 shadow-[0_0_24px_rgba(248,113,113,0.15)] transition-shadow duration-300 group-hover:shadow-[0_0_32px_rgba(248,113,113,0.25)]" />
    </div>
  );
}

const EROSION_POINTS: readonly (readonly [number, number])[] = [
  [8, 50],
  [60, 32],
  [112, 10],
];

/** Rising vulnerability line over "improve this code" rounds: 2.1 → 4.7 → 6.2. */
function ErosionVisual() {
  const linePath = EROSION_POINTS.map(([x, y], pointIndex) =>
    `${pointIndex === 0 ? 'M' : 'L'}${x} ${y}`,
  ).join(' ');

  return (
    <div className="flex h-full min-h-28 items-center">
      <svg viewBox="0 0 120 60" className="h-full max-h-32 w-full">
        <defs>
          <linearGradient id="stat-erosion-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(248,113,113,0.22)" />
            <stop offset="100%" stopColor="rgba(248,113,113,0)" />
          </linearGradient>
        </defs>
        {[15, 30, 45].map((gridLineY) => (
          <line key={gridLineY} x1="0" y1={gridLineY} x2="120" y2={gridLineY} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        ))}
        <path d={`${linePath} L112 60 L8 60 Z`} fill="url(#stat-erosion-area)" />
        <path d={linePath} fill="none" stroke="rgba(248,113,113,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {EROSION_POINTS.map(([dotX, dotY]) => (
          <circle key={dotX} cx={dotX} cy={dotY} r="3" fill="#f87171" stroke="#101012" strokeWidth="2" />
        ))}
      </svg>
    </div>
  );
}

const SELF_CORRECTION_RATIO = 0.27;
const SELF_CORRECTION_RING_CIRCUMFERENCE = 2 * Math.PI * 26;

/** Ring gauge: the lime 27% arc is the share of fixes that actually helped. */
function SelfCorrectionVisual() {
  return (
    <div className="flex h-full min-h-28 items-center justify-center">
      <svg viewBox="0 0 64 64" className="h-24 w-24 -rotate-90">
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke="#bef264"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${SELF_CORRECTION_RING_CIRCUMFERENCE * SELF_CORRECTION_RATIO} ${SELF_CORRECTION_RING_CIRCUMFERENCE}`}
          className="transition-colors duration-300 group-hover:stroke-lime-200"
        />
      </svg>
    </div>
  );
}

/** Two gauge bars: the dim 96.2% pass rate vs. lime 63.7% real detection. */
function CoverageIllusionVisual() {
  return (
    <div className="flex h-full min-h-28 flex-col justify-center gap-5">
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <span className="block h-full w-[96.2%] rounded-full bg-zinc-500/70 transition-colors duration-300 group-hover:bg-zinc-400/70" />
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <span className="block h-full w-[63.7%] rounded-full bg-lime-300/90 transition-colors duration-300 group-hover:bg-lime-200" />
      </div>
    </div>
  );
}

const RULE_CELL_COUNT = 119;

/** One cell per rule in the golden database — exactly 119, no rounding. */
function RuleCountVisual() {
  const ruleCellIndexes = Array.from({ length: RULE_CELL_COUNT }, (_, ruleCellIndex) => ruleCellIndex);

  return (
    <div className="flex h-full min-h-16 flex-wrap content-center gap-1.5 [mask-image:linear-gradient(to_right,black_55%,transparent)]">
      {ruleCellIndexes.map((ruleCellIndex) => (
        <span
          key={ruleCellIndex}
          className={`h-2 w-2 rounded-[2px] transition-colors duration-300 ${
            ruleCellIndex % 7 === 3
              ? 'bg-lime-300/90 shadow-[0_0_6px_rgba(190,242,100,0.45)] group-hover:bg-lime-200'
              : 'bg-white/[0.07] group-hover:bg-white/[0.12]'
          }`}
        />
      ))}
    </div>
  );
}
