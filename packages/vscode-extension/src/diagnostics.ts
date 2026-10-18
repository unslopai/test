/**
 * Mapping ScanResult → native VS Code Diagnostics (Problems-Panel).
 * CRITICAL → Error, WARNING → Warning; stale Findings → Hint mit Suffix.
 */
import * as path from 'node:path';
import type { ScanIssue, ScanResult } from '@unslop/shared';
import * as vscode from 'vscode';
import { FindingsStore, issueKeyOf, type TrackedFinding } from './findingsStore';

export const DIAGNOSTIC_SOURCE = 'unslop';
export const STALE_SUFFIX = ' [stale — code changed since scan]';

export function publishScanResult(
    scanResult: ScanResult,
    repoRoot: string,
    diagnosticCollection: vscode.DiagnosticCollection,
    findingsStore: FindingsStore,
): number {
    diagnosticCollection.clear();

    const findingsByUri = new Map<string, ScanIssue[]>();
    for (const issue of scanResult.issues) {
        const fileUri = vscode.Uri.file(path.join(repoRoot, issue.path));
        const uriString = fileUri.toString();
        const fileIssues = findingsByUri.get(uriString) ?? [];
        fileIssues.push(issue);
        findingsByUri.set(uriString, fileIssues);
    }

    findingsStore.replaceAll(findingsByUri);

    for (const [uriString, fileIssues] of findingsByUri) {
        const fileUri = vscode.Uri.parse(uriString);
        diagnosticCollection.set(fileUri, fileIssues.map((issue) => buildDiagnostic(issue, false)));
    }

    return scanResult.issues.length;
}

export function buildDiagnostic(issue: ScanIssue, isStale: boolean): vscode.Diagnostic {
    const anchorRange = new vscode.Range(
        new vscode.Position(Math.max(0, issue.line - 1), 0),
        new vscode.Position(Math.max(0, issue.endLine - 1), Number.MAX_SAFE_INTEGER),
    );

    const diagnostic = new vscode.Diagnostic(
        anchorRange,
        isStale ? issue.critique + STALE_SUFFIX : issue.critique,
        isStale ? vscode.DiagnosticSeverity.Hint : severityFor(issue),
    );
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = issue.rule;
    return diagnostic;
}

/** Baut die Diagnostics einer Datei aus dem Store neu (z.B. nach Apply/Stale). */
export function republishFile(
    fileUri: vscode.Uri,
    diagnosticCollection: vscode.DiagnosticCollection,
    findingsStore: FindingsStore,
): void {
    const trackedFindings = findingsStore.findingsFor(fileUri);
    diagnosticCollection.set(
        fileUri,
        trackedFindings.map((tracked: TrackedFinding) => buildDiagnostic(tracked.issue, tracked.stale)),
    );
}

export function issueKeyForDiagnostic(diagnostic: vscode.Diagnostic): string {
    return issueKeyOf(diagnostic.range.start.line + 1, String(diagnostic.code ?? ''));
}

function severityFor(issue: ScanIssue): vscode.DiagnosticSeverity {
    return issue.severity === 'CRITICAL'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;
}
