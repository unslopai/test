import { PULL_REQUEST_EXHIBIT } from '../real-findings';

interface PullRequestExhibitProps {
  readonly caption: string;
}

/**
 * Hero-Exponat: ein echter Review an einem echten Pull Request (Daten und
 * Beleg in real-findings.ts), im Glasfenster-Stil der Landing. Anders als
 * das frühere Mock-Fenster ist das Inhalt, kein Dekor — deshalb eine
 * <figure> mit Bildunterschrift statt aria-hidden (MARKETING_CLAIMS §00.1).
 */
export function PullRequestExhibit({ caption }: PullRequestExhibitProps) {
  return (
    <figure className="marketing-rise relative mt-16 sm:mt-24" style={{ animationDelay: '420ms' }}>
      <div
        aria-hidden="true"
        className="absolute -inset-x-10 -top-12 h-44 rounded-full bg-lime-300/10 blur-3xl"
      />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_60px_-15px_rgba(0,0,0,0.7),0_70px_140px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <ExhibitChromeBar />
        <div className="grid min-w-0 md:grid-cols-[1.2fr_1fr]">
          <ExhibitDiffPane />
          <ExhibitReviewComment />
        </div>
        <ExhibitCheckStrip />
      </div>
      <figcaption className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">
        {caption}
      </figcaption>
    </figure>
  );
}

function ExhibitChromeBar() {
  return (
    <div className="flex h-11 items-center gap-4 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-transparent px-4">
      <div aria-hidden="true" className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
      </div>
      <span className="truncate font-mono text-xs text-zinc-400">
        {PULL_REQUEST_EXHIBIT.repository} · pull request #{PULL_REQUEST_EXHIBIT.pullRequestNumber}
      </span>
    </div>
  );
}

function ExhibitDiffPane() {
  return (
    <div className="min-w-0 border-b border-white/[0.06] p-4 sm:p-5 md:border-b-0 md:border-r">
      <p className="truncate font-mono text-[11px] text-zinc-400">{PULL_REQUEST_EXHIBIT.path}</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-white/[0.05] bg-black/40 py-2 font-mono text-[11px] leading-relaxed">
        {PULL_REQUEST_EXHIBIT.addedLines.map((addedLine, lineIndex) => (
          <ExhibitDiffLine
            key={`${lineIndex}-${addedLine}`}
            lineNumber={lineIndex + 1}
            code={addedLine}
          />
        ))}
      </div>
    </div>
  );
}

interface ExhibitDiffLineProps {
  readonly lineNumber: number;
  readonly code: string;
}

function ExhibitDiffLine({ lineNumber, code }: ExhibitDiffLineProps) {
  const isFlaggedLine = lineNumber === PULL_REQUEST_EXHIBIT.flaggedLine;

  return (
    <div
      className={`flex w-max min-w-full px-3 ${
        isFlaggedLine ? 'bg-red-500/10 text-red-200' : 'text-lime-300/80'
      }`}
    >
      <span className="w-6 shrink-0 select-none text-zinc-600">{lineNumber}</span>
      <span className="w-4 shrink-0 select-none text-zinc-600">+</span>
      <span className="whitespace-pre">{code}</span>
    </div>
  );
}

function ExhibitReviewComment() {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className="h-5 w-5 rounded-md border border-lime-300/30 bg-lime-300/10"
        />
        <span className="font-mono text-[11px] text-zinc-300">{PULL_REQUEST_EXHIBIT.botLogin}</span>
        <span className="font-mono text-[11px] text-zinc-600">
          {PULL_REQUEST_EXHIBIT.path}:{PULL_REQUEST_EXHIBIT.flaggedLine}
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-snug text-zinc-100">
        {PULL_REQUEST_EXHIBIT.rule}{' '}
        <span className="font-normal text-red-300">({PULL_REQUEST_EXHIBIT.severity})</span>
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{PULL_REQUEST_EXHIBIT.critique}</p>
    </div>
  );
}

function ExhibitCheckStrip() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:px-5">
      <span className="font-mono text-[11px] text-zinc-500">
        {PULL_REQUEST_EXHIBIT.checkName} · {PULL_REQUEST_EXHIBIT.checkDurationSeconds} s
      </span>
      <span className="rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1 font-mono text-xs text-red-300">
        {PULL_REQUEST_EXHIBIT.checkConclusion} · {PULL_REQUEST_EXHIBIT.checkTitle}
      </span>
    </div>
  );
}
