import { getTranslations } from 'next-intl/server';
import { SectionIntro } from './SectionIntro';

type ProblemKey = 'swallowedErrors' | 'inventedPackages' | 'greenTests' | 'unreadDiff';

/**
 * Das Problem aus dem Entwickleralltag, ohne Zahl (MARKETING_CLAIMS.md §00
 * Punkt 4). Ersetzt das frühere Einwand-Raster mit Studienzahlen.
 */
const PROBLEM_KEYS: readonly ProblemKey[] = [
  'swallowedErrors',
  'inventedPackages',
  'greenTests',
  'unreadDiff',
];

export async function ProblemGrid() {
  const problemText = await getTranslations('marketing.problems');

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <SectionIntro eyebrow={problemText('eyebrow')} heading={problemText('heading')} />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {PROBLEM_KEYS.map((problemKey) => (
          <ProblemCard key={problemKey} problemKey={problemKey} />
        ))}
      </div>
    </section>
  );
}

async function ProblemCard({ problemKey }: { readonly problemKey: ProblemKey }) {
  const problemText = await getTranslations('marketing.problems');

  return (
    <article className="group rounded-lg border border-white/10 bg-white/[0.02] p-6 transition duration-200 hover:-translate-y-0.5 hover:border-white/25">
      <h3 className="text-lg font-semibold text-zinc-50">
        {problemText(`items.${problemKey}.claim`)}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        {problemText(`items.${problemKey}.rebuttal`)}
      </p>
    </article>
  );
}
