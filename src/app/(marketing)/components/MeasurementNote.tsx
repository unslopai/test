import { getTranslations } from 'next-intl/server';
import { marketingRichTags } from './marketing-rich-tags';

const MEASUREMENT_CONTEXT_KEYS = ['method', 'run', 'limits'] as const;

/**
 * Die eine eigene Messung der Landing. MARKETING_CLAIMS.md §00 Punkt 3
 * verlangt Methode, Datum, Modell und Einschränkung AM SELBEN ORT wie die
 * Zahl — deshalb sind Ergebnis und Kontext ein Block und nie getrennt
 * verwendbar. Quelle: docs/benchmarks/RULE_RECALL_BENCHMARK.md, Cutover-Lauf
 * 2026-09-16 (125/126 combined, 0 FP auf 4 Kontrollen) und Option-A-Lauf
 * 2026-09-29 (r24 2× 46/48 combined).
 */
export async function MeasurementNote() {
  const measurementText = await getTranslations('marketing.findings.measurement');

  return (
    <aside className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <p className="font-pixel text-[0.65rem] uppercase tracking-[0.2em] text-lime-300">
        {measurementText('eyebrow')}
      </p>
      <h3 className="mt-3 text-lg font-semibold text-zinc-50">{measurementText('heading')}</h3>
      <p className="mt-4 text-base leading-relaxed text-zinc-200 sm:text-lg">
        {measurementText.rich('result', marketingRichTags)}
      </p>
      <div className="mt-4 max-w-4xl space-y-2">
        {MEASUREMENT_CONTEXT_KEYS.map((contextKey) => (
          <p key={contextKey} className="text-sm leading-relaxed text-zinc-400">
            {measurementText(contextKey)}
          </p>
        ))}
      </div>
    </aside>
  );
}
