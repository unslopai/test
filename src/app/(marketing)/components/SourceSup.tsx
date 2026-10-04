import { getTranslations } from 'next-intl/server';
import {
  sourceFootnoteNumber,
  type MarketingSourceKey,
} from '../marketing-sources';

interface SourceSupProps {
  readonly sourceKeys: readonly MarketingSourceKey[];
}

/** Superscript footnote links from a claim to its receipts in the sources block. */
export async function SourceSup({ sourceKeys }: SourceSupProps) {
  const accessibilityText = await getTranslations('marketing.a11y');

  return (
    <sup className="ml-1 select-none whitespace-nowrap text-[0.7em]">
      {sourceKeys.map((sourceKey) => {
        const footnoteNumber = sourceFootnoteNumber(sourceKey);
        return (
          <a
            key={sourceKey}
            href={`#source-${footnoteNumber}`}
            aria-label={accessibilityText('sourceReference', { number: footnoteNumber })}
            className="px-0.5 text-lime-300/80 transition-colors hover:text-lime-200"
          >
            [{footnoteNumber}]
          </a>
        );
      })}
    </sup>
  );
}
