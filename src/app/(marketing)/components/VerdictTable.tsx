import { getTranslations } from 'next-intl/server';
import { SectionIntro } from './SectionIntro';

type VerdictRowKey = 'rules' | 'production' | 'files' | 'gate' | 'label';

const VERDICT_ROW_KEYS: readonly VerdictRowKey[] = ['rules', 'production', 'files', 'gate', 'label'];

/**
 * Welcher Teil des Urteils deterministisch ist und welcher vom Modell kommt
 * (MARKETING_CLAIMS.md §00 Punkt 2), als maschinenlesbare Tabelle
 * (UNSLOP_SEO_RULES §2: tables over prose). Ersetzt den früheren Vergleich
 * „LLM judge vs. deterministic gate" mit Studienwerten.
 */
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
          {VERDICT_ROW_KEYS.map((verdictRowKey) => (
            <ComparisonTableRow key={verdictRowKey} verdictRowKey={verdictRowKey} />
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
        <th scope="col" className="px-5 py-4 font-medium text-lime-300">
          {tableText('columnPrescan')}
        </th>
        <th scope="col" className="px-5 py-4 font-medium text-zinc-200">
          {tableText('columnModel')}
        </th>
      </tr>
    </thead>
  );
}

async function ComparisonTableRow({ verdictRowKey }: { readonly verdictRowKey: VerdictRowKey }) {
  const tableText = await getTranslations('marketing.verdictTable');

  return (
    <tr className="transition-colors hover:bg-white/[0.03]">
      <th scope="row" className="px-5 py-4 align-top font-medium text-zinc-200">
        {tableText(`rows.${verdictRowKey}.check`)}
      </th>
      <td className="px-5 py-4 text-zinc-300">{tableText(`rows.${verdictRowKey}.prescan`)}</td>
      <td className="px-5 py-4 text-zinc-300">{tableText(`rows.${verdictRowKey}.model`)}</td>
    </tr>
  );
}
