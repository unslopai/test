import { getTranslations } from 'next-intl/server';
import { SectionIntro } from './SectionIntro';

export type FaqItemKey =
  | 'sourceCode'
  | 'ciSpeed'
  | 'adoption'
  | 'determinism'
  | 'languages'
  | 'outage';

/** Shared with the FAQPage JSON-LD in page.tsx — keep both in sync via this list. */
export const FAQ_ITEM_KEYS: readonly FaqItemKey[] = [
  'sourceCode',
  'ciSpeed',
  'adoption',
  'determinism',
  'languages',
  'outage',
];

/** Strict Question/Answer pairs (UNSLOP_SEO_RULES §5) as CSS-only accordions. */
export async function FaqSection() {
  const faqText = await getTranslations('marketing.faq');

  return (
    <section id="faq" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <SectionIntro eyebrow={faqText('eyebrow')} heading={faqText('heading')} />
      <div className="mt-10 max-w-3xl border-t border-white/10">
        {FAQ_ITEM_KEYS.map((faqItemKey) => (
          <FaqItem key={faqItemKey} faqItemKey={faqItemKey} />
        ))}
      </div>
    </section>
  );
}

async function FaqItem({ faqItemKey }: { readonly faqItemKey: FaqItemKey }) {
  const faqText = await getTranslations('marketing.faq');

  return (
    <details className="group border-b border-white/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-medium text-zinc-100 transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
        {faqText(`items.${faqItemKey}.question`)}
        <span
          aria-hidden="true"
          className="font-pixel text-lime-300 transition-transform duration-200 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="pb-6 pr-8 text-sm leading-relaxed text-zinc-400">
        {faqText(`items.${faqItemKey}.answer`)}
      </p>
    </details>
  );
}
