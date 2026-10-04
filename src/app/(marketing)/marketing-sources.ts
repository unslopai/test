/**
 * Citation registry for the landing page — the sources block of
 * MARKETING_CLAIMS.md (§8) plus the two §7-only studies. Array order defines
 * the footnote numbering used across every section; the human-readable labels
 * live in messages/{en,de}.json under `marketing.footer.sources.<key>`.
 *
 * Fact discipline (MARKETING_CLAIMS.md §0): every stat rendered on the page
 * must point at one of these entries — a number without a footnote is a bug.
 */
export const MARKETING_SOURCES = [
  { key: 'aira', arxivId: '2604.17587' },
  { key: 'apiOracle', arxivId: '2604.20202' },
  { key: 'erosion', arxivId: '2506.11022' },
  { key: 'coverage', arxivId: '2605.22175' },
  { key: 'testSmells', arxivId: '2410.10628' },
  { key: 'mutantDetection', arxivId: '2408.07846' },
  { key: 'slopsquatting', arxivId: '2406.10279' },
  { key: 'selfFixing', arxivId: '2308.04838' },
  { key: 'smartContracts', arxivId: '2306.12338' },
  { key: 'cryptoMisuse', arxivId: '2404.03823' },
  { key: 'webAppScoring', arxivId: '2504.20612' },
  { key: 'securePrompting', arxivId: '2605.24300' },
  { key: 'copilotSmells', arxivId: '2401.14176' },
  { key: 'ragDegradation', arxivId: '2407.09726' },
  { key: 'agentHarness', arxivId: '2607.05743' },
  { key: 'agentToctou', arxivId: '2508.17155' },
] as const;

export type MarketingSourceKey = (typeof MARKETING_SOURCES)[number]['key'];

export function sourceFootnoteNumber(sourceKey: MarketingSourceKey): number {
  return MARKETING_SOURCES.findIndex((registeredSource) => registeredSource.key === sourceKey) + 1;
}

export function arxivAbstractUrl(arxivId: string): string {
  return `https://arxiv.org/abs/${arxivId}`;
}
