import { getTranslations } from 'next-intl/server';
import { SectionIntro } from './SectionIntro';
import { SourceSup } from './SourceSup';
import type { MarketingSourceKey } from '../marketing-sources';

type VerdictRowKey = 'apiHallucination' | 'swallowedErrors' | 'verdictStability' | 'fixGuidance';

interface VerdictRowDefinition {
  readonly rowKey: VerdictRowKey;
  readonly sourceKeys: readonly MarketingSourceKey[];
}

const VERDICT_ROWS: readonly VerdictRowDefinition[] = [
  { rowKey: 'apiHallucination', sourceKeys: ['apiOracle'] },
  { rowKey: 'swallowedErrors', sourceKeys: ['aira'] },
  { rowKey: 'verdictStability', sourceKeys: ['smartContracts'] },
  { rowKey: 'fixGuidance', sourceKeys: ['erosion', 'copilotSmells'] },
];

/** Machine-readable comparison table (UNSLOP_SEO_RULES §2: tables over prose). */
export async function VerdictTable() {
  const tableText = await getTranslations('marketing.verdictTable');

  return (
    <section id="comparison" className="border-y border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
        <SectionIntro eyebrow={tableText('eyebrow')} heading={tableText('heading')} />
        <ComparisonTable />
      </div>
    </section>
  );
}

async function ComparisonTable() {
  const tableText = await getTranslations('marketing.verdictTable');

  return (
    <div className="mt-10 overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">{tableText('heading')}</caption>
        <ComparisonTableHead />
        <tbody className="divide-y divide-white/10">
          {VERDICT_ROWS.map((verdictRow) => (
            <ComparisonTableRow key={verdictRow.rowKey} verdictRow={verdictRow} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function ComparisonTableHead() {
  const tableText = await getTranslations('marketing.verdictTable');

  return (
    <thead>
      <tr className="border-b border-white/10 bg-white/[0.03]">
        <th scope="col" className="px-5 py-4 font-medium text-zinc-400">
          {tableText('columnCheck')}
        </th>
        <th scope="col" className="px-5 py-4 font-medium text-rose-300">
          {tableText('columnLlmJudge')}
        </th>
        <th scope="col" className="px-5 py-4 font-medium text-lime-300">
          {tableText('columnGate')}
        </th>
      </tr>
    </thead>
  );
}

async function ComparisonTableRow({
  verdictRow,
}: {
  readonly verdictRow: VerdictRowDefinition;
}) {
  const tableText = await getTranslations('marketing.verdictTable');

  return (
    <tr className="transition-colors hover:bg-white/[0.03]">
      <th scope="row" className="px-5 py-4 font-medium text-zinc-200">
        {tableText(`rows.${verdictRow.rowKey}.check`)}
        <SourceSup sourceKeys={verdictRow.sourceKeys} />
      </th>
      <td className="px-5 py-4 text-zinc-400">{tableText(`rows.${verdictRow.rowKey}.llmJudge`)}</td>
      <td className="px-5 py-4 text-zinc-200">{tableText(`rows.${verdictRow.rowKey}.gate`)}</td>
    </tr>
  );
}
