/**
 * Terminal-Ausgabe für Scan-Ergebnisse: nach Datei gruppiert,
 * Severity farbig (ANSI nur bei TTY).
 */
import type { ScanIssue, ScanResult, Severity } from '@unslop/shared';

const useColor = process.stdout.isTTY === true;

function paint(text: string, ansiCode: string): string {
    return useColor ? `\u001b[${ansiCode}m${text}\u001b[0m` : text;
}

const red = (text: string): string => paint(text, '31');
const yellow = (text: string): string => paint(text, '33');
const green = (text: string): string => paint(text, '32');
const bold = (text: string): string => paint(text, '1');
const dim = (text: string): string => paint(text, '2');

function severityBadge(severity: Severity): string {
    return severity === 'CRITICAL' ? red('CRITICAL') : yellow('WARNING ');
}

export function printHumanResult(scanResult: ScanResult): void {
    if (!scanResult.hasSlop || scanResult.issues.length === 0) {
        console.log(green('✔ No AI slop found.') + dim(` (${scanResult.filesReviewed} file(s) reviewed)`));
        return;
    }

    const issuesByFile = groupByFile(scanResult.issues);

    for (const [filePath, fileIssues] of issuesByFile) {
        console.log('\n' + bold(filePath));
        for (const issue of fileIssues) {
            console.log(`  ${severityBadge(issue.severity)} ${bold(issue.rule)} ${dim(`(line ${issue.line})`)}`);
            console.log(`    ${issue.critique.replace(/\n/g, '\n    ')}`);
            if (issue.fixedCodeSnippet) {
                console.log(dim('    Suggested fix:'));
                console.log(dim('      ' + issue.fixedCodeSnippet.replace(/\n/g, '\n      ')));
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
    console.log(dim(`Summary: ${scanResult.summary}`));
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
