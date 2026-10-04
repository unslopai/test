import { getTranslations } from 'next-intl/server';
import { SectionIntro } from './SectionIntro';

type SpecRowKey =
  | 'rules'
  | 'enforcement'
  | 'retrieval'
  | 'rescans'
  | 'integration'
  | 'webhooks'
  | 'tokens'
  | 'limits';

const SPEC_ROW_KEYS: readonly SpecRowKey[] = [
  'rules',
  'enforcement',
  'retrieval',
  'rescans',
  'integration',
  'webhooks',
  'tokens',
  'limits',
];

/** Key-value technical spec (UNSLOP_SEO_RULES §4/§5: hard credentials, strict K/V). */
export async function ArchitectureSpec() {
  const specText = await getTranslations('marketing.architectureSpec');

  return (
    <section id="architecture" className="border-y border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
        <SectionIntro
          eyebrow={specText('eyebrow')}
          heading={specText('heading')}
          intro={specText('intro')}
        />
        <dl className="mt-10 border-t border-white/10">
          {SPEC_ROW_KEYS.map((specRowKey) => (
            <SpecRow key={specRowKey} specRowKey={specRowKey} />
          ))}
        </dl>
      </div>
    </section>
  );
}

async function SpecRow({ specRowKey }: { readonly specRowKey: SpecRowKey }) {
  const specText = await getTranslations('marketing.architectureSpec');

  return (
    <div className="group grid gap-2 border-b border-white/10 py-5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-8">
      <dt className="font-mono text-sm font-medium uppercase tracking-wide text-lime-300/90">
        {specText(`rows.${specRowKey}.term`)}
      </dt>
      <dd className="text-sm leading-relaxed text-zinc-300 sm:text-base">
        {specText(`rows.${specRowKey}.definition`)}
      </dd>
    </div>
  );
}
