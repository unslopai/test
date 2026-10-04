import { getTranslations } from 'next-intl/server';
import { marketingRichTags } from './marketing-rich-tags';
import { SourceSup } from './SourceSup';
import type { MarketingSourceKey } from '../marketing-sources';

type PillarParagraphKey =
  | 'pillarJudge.paragraphOracle'
  | 'pillarJudge.paragraphSilent'
  | 'pillarErosion.paragraphRefinement'
  | 'pillarErosion.paragraphSlopsquatting'
  | 'pillarArchitecture.paragraphDeterministic'
  | 'pillarArchitecture.paragraphGatedRag';

type PillarSectionKey = 'pillarJudge' | 'pillarErosion' | 'pillarArchitecture';

interface PillarPunchlineKeys {
  readonly labelKey: 'pillarJudge.punchlineLabel' | 'pillarErosion.punchlineLabel';
  readonly textKey: 'pillarJudge.punchline' | 'pillarErosion.punchline';
}

interface PillarDefinition {
  readonly sectionKey: PillarSectionKey;
  readonly ordinal: string;
  readonly paragraphKeys: readonly PillarParagraphKey[];
  readonly sourceKeys: readonly MarketingSourceKey[];
  readonly punchline?: PillarPunchlineKeys;
}

/** The three messaging pillars of MARKETING_CLAIMS.md §4–§6, in order. */
const PILLAR_DEFINITIONS: readonly PillarDefinition[] = [
  {
    sectionKey: 'pillarJudge',
    ordinal: '01',
    paragraphKeys: ['pillarJudge.paragraphOracle', 'pillarJudge.paragraphSilent'],
    sourceKeys: ['aira', 'apiOracle', 'smartContracts'],
    punchline: { labelKey: 'pillarJudge.punchlineLabel', textKey: 'pillarJudge.punchline' },
  },
  {
    sectionKey: 'pillarErosion',
    ordinal: '02',
    paragraphKeys: ['pillarErosion.paragraphRefinement', 'pillarErosion.paragraphSlopsquatting'],
    sourceKeys: ['erosion', 'selfFixing', 'slopsquatting'],
    punchline: { labelKey: 'pillarErosion.punchlineLabel', textKey: 'pillarErosion.punchline' },
  },
  {
    sectionKey: 'pillarArchitecture',
    ordinal: '03',
    paragraphKeys: [
      'pillarArchitecture.paragraphDeterministic',
      'pillarArchitecture.paragraphGatedRag',
    ],
    sourceKeys: ['apiOracle', 'copilotSmells', 'ragDegradation'],
  },
];

/** The research case, section by section (anchor target of "Read the evidence"). */
export function EvidencePillars() {
  return (
    <section id="evidence" className="mx-auto max-w-6xl scroll-mt-20 space-y-28 px-6 py-28">
      {PILLAR_DEFINITIONS.map((pillar) => (
        <PillarArticle key={pillar.sectionKey} pillar={pillar} />
      ))}
    </section>
  );
}

async function PillarArticle({ pillar }: { readonly pillar: PillarDefinition }) {
  const marketingText = await getTranslations('marketing');

  return (
    <article className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
      <PillarHeader pillar={pillar} />
      <div className="space-y-6">
        {pillar.paragraphKeys.map((paragraphKey) => (
          <p key={paragraphKey} className="leading-relaxed text-zinc-300 sm:text-lg">
            {marketingText.rich(paragraphKey, marketingRichTags)}
          </p>
        ))}
        <p className="text-sm text-zinc-500">
          {marketingText('footer.sourcesEyebrow')}
          <SourceSup sourceKeys={pillar.sourceKeys} />
        </p>
        {pillar.punchline !== undefined && <PillarPunchline punchline={pillar.punchline} />}
      </div>
    </article>
  );
}

async function PillarHeader({ pillar }: { readonly pillar: PillarDefinition }) {
  const marketingText = await getTranslations('marketing');

  return (
    <div className="md:sticky md:top-28 md:self-start">
      <p className="font-pixel text-sm text-lime-300">{pillar.ordinal}</p>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
        {marketingText(`${pillar.sectionKey}.eyebrow`)}
      </p>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
        {marketingText(`${pillar.sectionKey}.header`)}
      </h2>
    </div>
  );
}

async function PillarPunchline({ punchline }: { readonly punchline: PillarPunchlineKeys }) {
  const marketingText = await getTranslations('marketing');

  return (
    <aside className="rounded-lg border border-lime-300/25 bg-lime-300/[0.06] p-6 transition-colors duration-200 hover:border-lime-300/45">
      <p className="font-pixel text-[0.65rem] uppercase tracking-[0.2em] text-lime-300">
        {marketingText(punchline.labelKey)}
      </p>
      <p className="mt-3 leading-relaxed text-zinc-100">{marketingText(punchline.textKey)}</p>
    </aside>
  );
}
