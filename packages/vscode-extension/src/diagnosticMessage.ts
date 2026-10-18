/**
 * Message text of a finding in the Problems panel (pure, no vscode import —
 * diagnostics.ts wraps it into a vscode.Diagnostic).
 */
import type { ScanIssue } from '@unslop/shared';
import { formatOccurrenceLineRefs } from './lineRefs';

export const STALE_SUFFIX = ' [stale — code changed since scan]';

/**
 * AI label of a single finding (AI Act Art. 50(2), LEGAL_PAGES_SPEC §4a.3):
 * a finding a model wrote carries it, a pre-scan finding
 * (`verification: 'deterministic'`) does not. A finding without a status
 * (results before 2026-09-17) counts as a model finding: label when in doubt.
 */
export const AI_GENERATED_FINDING_NOTICE = 'AI-generated finding. Check it before you rely on it.';

/**
 * Aggregierte Findings (ROADMAP §7) ankern am ersten Vorkommen; die übrigen
 * Fundstellen stehen als Zeilenliste in der Message ("lines 12, 18, 25-28")
 * statt N gleichlautende Diagnostics zu erzeugen. Die Zeilen sind
 * server-validiert (Zahlen aus dem Diff-Hunk-Manifest), kein Sanitize nötig.
 */
export function occurrenceSuffixOf(issue: ScanIssue): string {
    if (!issue.occurrences || issue.occurrences.length < 2) return '';
    return ` [${issue.occurrences.length} occurrences in this file: `
        + `lines ${formatOccurrenceLineRefs(issue.occurrences)}]`;
}

export function buildDiagnosticMessage(issue: ScanIssue, isStale: boolean): string {
    // fixAdvice ist Prosa: sie steht in der Meldung, nie im Apply-Payload (applicableFixOf).
    return issue.critique
        + occurrenceSuffixOf(issue)
        + (issue.fixAdvice ? `\nHow to fix: ${issue.fixAdvice}` : '')
        + (isStale ? STALE_SUFFIX : '')
        + (issue.verification !== 'deterministic' ? `\n${AI_GENERATED_FINDING_NOTICE}` : '');
}
