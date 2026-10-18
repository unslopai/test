import { getTranslations } from 'next-intl/server';
import {
  CONFIRMED_MODEL_FINDING,
  DOWNGRADED_MODEL_FINDING,
  type FindingSeverity,
  type RealFinding,
} from '../real-findings';
import { MeasurementNote } from './MeasurementNote';
import { SectionIntro } from './SectionIntro';

type FindingCardKey = 'confirmed' | 'downgraded';

interface FindingCardDefinition {
  readonly cardKey: FindingCardKey;
  readonly finding: RealFinding;
}

const FINDING_CARDS: readonly FindingCardDefinition[] = [
  { cardKey: 'confirmed', finding: CONFIRMED_MODEL_FINDING },
  { cardKey: 'downgraded', finding: DOWNGRADED_MODEL_FINDING },
];

const SEVERITY_CHIP_CLASS: Record<FindingSeverity, string> = {
  CRITICAL: 'border-red-400/25 bg-red-500/10 text-red-300',
  WARNING: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
};

/**
 * „Zeigen statt behaupten" (MARKETING_CLAIMS.md §00 Punkt 1 und 3): zwei
 * gespeicherte Findings wörtlich, darunter die eine eigene Messung samt
 * Methode, Datum, Modellen und Grenzen. Ersetzt das frühere Stat-Band mit
 * Studienzahlen. Die Produktausgabe bleibt englisch; nur Label und
 * Bildunterschrift kommen aus dem Katalog.
 */
export async function FindingShowcase() {
  const findingsText = await getTranslations('marketing.findings');

  return (
    <section id="findings" className="scroll-mt-20 border-y border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionIntro
          eyebrow={findingsText('eyebrow')}
          heading={findingsText('heading')}
          intro={findingsText('intro')}
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {FINDING_CARDS.map((findingCard) => (
            <FindingCard key={findingCard.cardKey} findingCard={findingCard} />
          ))}
        </div>
        <MeasurementNote />
      </div>
    </section>
  );
}

async function FindingCard({ findingCard }: { readonly findingCard: FindingCardDefinition }) {
  const findingsText = await getTranslations('marketing.findings');
  const { finding, cardKey } = findingCard;

  return (
    <figure className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
      <p className="font-pixel text-[0.65rem] uppercase tracking-[0.2em] text-lime-300">
        {findingsText(`cards.${cardKey}.label`)}
      </p>
      <FindingHeader finding={finding} />
      <CodeBlock label={findingsText('quoteLabel')} codeLines={finding.quotedLines} tone="quoted" />
      <CodeBlock label={findingsText('fixLabel')} codeLines={finding.fixLines} tone="fix" />
      <div className="mt-4 space-y-3">
        {finding.critiqueParagraphs.map((critiqueParagraph) => (
          <p key={critiqueParagraph} lang="en" className="text-sm leading-relaxed text-zinc-300">
            {critiqueParagraph}
          </p>
        ))}
      </div>
      <figcaption className="mt-6 border-t border-white/10 pt-4 text-sm leading-relaxed text-zinc-500">
        {findingsText(`cards.${cardKey}.caption`)}
      </figcaption>
    </figure>
  );
}

function FindingHeader({ finding }: { readonly finding: RealFinding }) {
  return (
    <div className="mt-4">
      <p className="text-base font-semibold text-zinc-50">{finding.rule}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
        <span className={`rounded-full border px-2 py-0.5 ${SEVERITY_CHIP_CLASS[finding.severity]}`}>
          {finding.severity}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">
          {finding.verification}
        </span>
        <span className="break-all text-zinc-500">
          {finding.path}:{finding.line}
        </span>
      </div>
    </div>
  );
}

interface CodeBlockProps {
  readonly label: string;
  readonly codeLines: readonly string[];
  readonly tone: 'quoted' | 'fix';
}

const CODE_TONE_CLASS: Record<CodeBlockProps['tone'], string> = {
  quoted: 'bg-red-500/10 text-red-200',
  fix: 'bg-lime-400/10 text-lime-200',
};

function CodeBlock({ label, codeLines, tone }: CodeBlockProps) {
  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <pre
        className={`mt-2 whitespace-pre-wrap break-words rounded-lg border border-white/[0.05] px-3 py-2 font-mono text-[11px] leading-relaxed ${CODE_TONE_CLASS[tone]}`}
      >
        <code>{codeLines.join('\n')}</code>
      </pre>
    </div>
  );
}
