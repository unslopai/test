import { getTranslations } from 'next-intl/server';
import { marketingRichTags } from './marketing-rich-tags';
import { SectionIntro } from './SectionIntro';
import { SourceSup } from './SourceSup';
import type { MarketingSourceKey } from '../marketing-sources';

type ObjectionKey = 'testsPass' | 'securePrompting' | 'demoWorked' | 'agentGuardrails';

interface ObjectionDefinition {
  readonly objectionKey: ObjectionKey;
  readonly sourceKeys: readonly MarketingSourceKey[];
}

/** MARKETING_CLAIMS.md §7 — the objection-handling ammunition. */
const OBJECTION_DEFINITIONS: readonly ObjectionDefinition[] = [
  { objectionKey: 'testsPass', sourceKeys: ['testSmells', 'mutantDetection'] },
  { objectionKey: 'securePrompting', sourceKeys: ['securePrompting'] },
  { objectionKey: 'demoWorked', sourceKeys: ['cryptoMisuse', 'webAppScoring'] },
  { objectionKey: 'agentGuardrails', sourceKeys: ['agentHarness', 'agentToctou'] },
];

export async function ObjectionGrid() {
  const objectionText = await getTranslations('marketing.objections');

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <SectionIntro eyebrow={objectionText('eyebrow')} heading={objectionText('heading')} />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {OBJECTION_DEFINITIONS.map((objection) => (
          <ObjectionCard key={objection.objectionKey} objection={objection} />
        ))}
      </div>
    </section>
  );
}

async function ObjectionCard({ objection }: { readonly objection: ObjectionDefinition }) {
  const objectionText = await getTranslations('marketing.objections');

  return (
    <article className="group rounded-lg border border-white/10 bg-white/[0.02] p-6 transition duration-200 hover:-translate-y-0.5 hover:border-white/25">
      <h3 className="text-lg font-semibold text-zinc-50">
        {objectionText(`items.${objection.objectionKey}.claim`)}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        {objectionText.rich(`items.${objection.objectionKey}.rebuttal`, marketingRichTags)}
        <SourceSup sourceKeys={objection.sourceKeys} />
      </p>
    </article>
  );
}
