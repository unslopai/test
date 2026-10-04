import { getTranslations } from 'next-intl/server';
import { marketingRichTags } from './marketing-rich-tags';

type PillarParagraphKey =
  | 'pillarDeterministic.paragraphDetectors'
  | 'pillarDeterministic.paragraphNoRejudge'
  | 'pillarModel.paragraphDraft'
  | 'pillarModel.paragraphBlind'
  | 'pillarModel.paragraphHonest'
  | 'pillarDegradation.paragraphBudget'
  | 'pillarDegradation.paragraphNotice';

type PillarSectionKey = 'pillarDeterministic' | 'pillarModel' | 'pillarDegradation';

interface PillarPunchlineKeys {
  readonly labelKey: 'pillarDegradation.punchlineLabel';
  readonly textKey: 'pillarDegradation.punchline';
}

interface PillarDefinition {
  readonly sectionKey: PillarSectionKey;
  readonly ordinal: string;
  readonly paragraphKeys: readonly PillarParagraphKey[];
  readonly punchline?: PillarPunchlineKeys;
}

/**
 * Der Mechanismus in drei Schritten (MARKETING_CLAIMS.md §00 Punkt 2): was
 * deterministisch ist, was vom Modell kommt und blind gegengeprüft wird, und
 * was passiert, wenn eine Stufe ausfällt. Jeder Satz ist im PR der Umstellung
 * gegen Code belegt (Tabelle Claim → Beleg).
 */
const PILLAR_DEFINITIONS: readonly PillarDefinition[] = [
  {
    sectionKey: 'pillarDeterministic',
    ordinal: '01',
    paragraphKeys: [
      'pillarDeterministic.paragraphDetectors',
      'pillarDeterministic.paragraphNoRejudge',
    ],
  },
  {
    sectionKey: 'pillarModel',
    ordinal: '02',
    paragraphKeys: [
      'pillarModel.paragraphDraft',
      'pillarModel.paragraphBlind',
      'pillarModel.paragraphHonest',
    ],
  },
  {
    sectionKey: 'pillarDegradation',
    ordinal: '03',
    paragraphKeys: ['pillarDegradation.paragraphBudget', 'pillarDegradation.paragraphNotice'],
    punchline: {
      labelKey: 'pillarDegradation.punchlineLabel',
      textKey: 'pillarDegradation.punchline',
    },
  },
];

/** Anchor target of the hero link "How the verdict is made". */
export function MechanismPillars() {
  return (
    <section id="mechanism" className="mx-auto max-w-6xl scroll-mt-20 space-y-28 px-6 py-28">
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
      <p lang="en" className="mt-3 font-mono text-sm leading-relaxed text-zinc-100">
        {marketingText(punchline.textKey)}
      </p>
    </aside>
  );
}
