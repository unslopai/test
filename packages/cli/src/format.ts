/**
 * Terminal output for scan results: grouped by file,
 * severity colored (ANSI only on TTY).
 */
import type { ScanIssue, ScanResult, Severity } from '@unslop/shared';

import {
    describeFindingVerification,
    formatDraftPartialNotice,
    formatOccurrenceLineRefs,
    formatTimeBudgetNotice,
    sanitizeModelText,
} from '@unslop/shared/node';
import type { FixReport, FixStatus } from '@unslop/shared/node';

import { red, yellow, green, bold, dim, cyan } from './ui.js';

function severityBadge(severity: Severity): string {
    return severity === 'CRITICAL' ? red('CRITICAL') : yellow('WARNING ');
}

/**
 * The Cognitive Integrity Score measures the confidence of the review (blind
 * re-verification of every finding), not the code quality — which is why it sits
 * next to the result, not as a rating above it. The tagline counts each
 * finding's verification status instead of claiming "every finding survived"
 * next to an uncertain or self-reported one (SPEC.md §6).
 */
function integrityScoreLine(scanResult: ScanResult): string {
    const noticeSuffix = degradationNotices(scanResult)
        .map((degradationNotice) => `\n${yellow(`⚠ ${degradationNotice}`)}`)
        .join('');
    if (scanResult.cognitiveIntegrityScore === null) {
        return dim('Cognitive Integrity Score: n/a — confidence verification was unavailable for this scan.')
            + noticeSuffix;
    }
    return (
        bold(`Cognitive Integrity Score: ${scanResult.cognitiveIntegrityScore}/100`) +
        dim(` — ${describeFindingVerification(scanResult.issues)}.`) +
        noticeSuffix
    );
}

/**
 * A time skip (DEADLINE_GUARD_SPEC §3.4) and a partial draft (LARGE_DIFF_RECALL_SPEC
 * Option A) each get the same one-line notice as the check run and the PR review.
 * File paths come from the diff and are sanitized like every other model-adjacent text.
 */
function degradationNotices(scanResult: ScanResult): string[] {
    const unreviewedFiles = (scanResult.draftUnreviewedFiles ?? []).map(sanitizeModelText);
    return [
        formatTimeBudgetNotice(scanResult.skippedStages),
        formatDraftPartialNotice(unreviewedFiles),
    ].filter((degradationNotice): degradationNotice is string => degradationNotice !== null);
}

/**
 * "We reviewed nothing" is NEVER "your code is clean" (ROADMAP §3): an aborted
 * or zero-files scan gets its own warning rendering, before the clean branch
 * can claim a ✔ it did not earn. filesReviewed === 0 doubles as the guard for
 * legacy results that predate the outcome field.
 */
function printNothingReviewed(scanResult: ScanResult): void {
    console.log(yellow('⚠ Nothing was reviewed — this is NOT a clean verdict.'));
    console.log(`  ${sanitizeModelText(scanResult.summary)}`);
    const omittedFiles = scanResult.omittedFiles ?? [];
    if (omittedFiles.length > 0) {
        console.log(dim(`  Omitted (review size cap): ${omittedFiles.map(sanitizeModelText).join(', ')}`));
    }
}

export function printHumanResult(scanResult: ScanResult): void {
    if (scanResult.outcome === 'nothing_reviewed' || scanResult.filesReviewed === 0) {
        printNothingReviewed(scanResult);
        return;
    }

    if (!scanResult.hasSlop || scanResult.issues.length === 0) {
        console.log(green('✔ No AI slop found.') + dim(` (${scanResult.filesReviewed} file(s) reviewed)`));
        console.log(integrityScoreLine(scanResult));
        return;
    }

    const issuesByFile = groupByFile(scanResult.issues);

    for (const [filePath, fileIssues] of issuesByFile) {
        console.log('\n' + bold(sanitizeModelText(filePath)));
        for (const issue of fileIssues) {
            // path:line is Ctrl+Click-able in terminals (opens the file in the editor).
            // rule/path/critique/fixedCodeSnippet are model-authored — strip
            // ANSI/OSC escapes before they reach the terminal (ROADMAP §12).
            console.log(
                `  ${severityBadge(issue.severity)} ${bold(sanitizeModelText(issue.rule))} ` +
                cyan(`${sanitizeModelText(issue.path)}:${issue.line}`),
            );
            if (issue.occurrences && issue.occurrences.length >= 2) {
                // Aggregated finding (one rule, many hits in this file): the
                // anchor line above is the first occurrence, list the rest.
                console.log(dim(
                    `    ${issue.occurrences.length} occurrences: ` +
                    `lines ${formatOccurrenceLineRefs(issue.occurrences)}`,
                ));
            }
            console.log(`    ${sanitizeModelText(issue.critique).replace(/\n/g, '\n    ')}`);
            if (issue.fixedCodeSnippet) {
                console.log(dim('    Suggested fix:'));
                console.log(dim('      ' + sanitizeModelText(issue.fixedCodeSnippet).replace(/\n/g, '\n      ')));
            }
        }
    }

    const criticalCount = scanResult.issues.filter((issue) => issue.severity === 'CRITICAL').length;
    const warningCount = scanResult.issues.length - criticalCount;

    console.log(
        '\n' + bold('Result: ') +
        `${scanResult.issues.length} issue(s) — ` +
        `${red(String(criticalCount) + ' critical')}, ${yellow(String(warningCount) + ' warning')}`,
    );
    console.log(dim(`Summary: ${sanitizeModelText(scanResult.summary)}`));
    console.log(integrityScoreLine(scanResult));

    if (criticalCount > 0) {
        console.log(
            '\n' + dim('Hint: open this folder in VS Code (with the Gatekeeper extension) to see these ' +
            'issues inline, or re-run with ') + bold('unslop scan --fix') + dim(' to apply the suggested fixes.'),
        );
    }
}

/**
 * Summary of --fix / --dry-run: one line per fix candidate with the honest
 * outcome — skips and failures name their guard reason (drifted anchor,
 * missing payload, contained path) instead of pretending success. rule/path
 * are model-authored and sanitized; reasons are our own strings.
 */
export function printFixReport(fixReport: FixReport): void {
    if (fixReport.outcomes.length === 0) {
        console.log('\n' + dim('Auto-fix: no findings, nothing to fix.'));
        return;
    }

    console.log('\n' + bold(fixReport.dryRun
        ? 'Auto-fix preview (--dry-run) — no files were modified:'
        : 'Auto-fix results:'));

    for (const outcome of fixReport.outcomes) {
        console.log(
            `  ${fixStatusBadge(outcome.status, fixReport.dryRun)} ` +
            cyan(`${sanitizeModelText(outcome.path)}:${outcome.line}`) + ' ' +
            dim(`(${sanitizeModelText(outcome.rule)})`) +
            (outcome.reason ? dim(` — ${outcome.reason}`) : ''),
        );
    }

    const appliedLabel = fixReport.dryRun ? 'would be applied' : 'applied';
    console.log(bold(
        `${fixReport.applied} ${appliedLabel}, ${fixReport.skipped} skipped, ${fixReport.failed} failed.`,
    ));
}

function fixStatusBadge(status: FixStatus, dryRun: boolean): string {
    if (status === 'applied') return green(dryRun ? '✔ would fix' : '✔ fixed');
    return status === 'skipped' ? yellow('– skipped') : red('✘ failed');
}

function groupByFile(issues: readonly ScanIssue[]): Map<string, ScanIssue[]> {
    const issuesByFile = new Map<string, ScanIssue[]>();
    for (const issue of issues) {
        const fileIssues = issuesByFile.get(issue.path) ?? [];
        fileIssues.push(issue);
        issuesByFile.set(issue.path, fileIssues);
    }
    return issuesByFile;
}
