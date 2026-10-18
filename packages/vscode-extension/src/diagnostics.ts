/**
 * Mapping ScanResult → native VS Code diagnostics (Problems panel).
 * CRITICAL → Error, WARNING → Warning; stale findings → Hint with suffix.
 */
import type { ScanIssue, ScanResult } from '@unslop/shared';
import * as vscode from 'vscode';
import { buildDiagnosticMessage } from './diagnosticMessage';
import { FindingsStore, type TrackedFinding } from './findingsStore';
import { diagnosticCodeOf } from './issueKey';
import { resolveWithinRoot } from './pathSafety';
import { sanitizeModelText } from './sanitize';

export const DIAGNOSTIC_SOURCE = 'unslop';

export function publishScanResult(
    scanResult: ScanResult,
    repoRoot: string,
    diagnosticCollection: vscode.DiagnosticCollection,
    findingsStore: FindingsStore,
): number {
    diagnosticCollection.clear();

    const findingsByUri = new Map<string, ScanIssue[]>();
    let escapingFindings = 0;
    for (const issue of scanResult.issues) {
        // issue.path is model-authored (Finding 2): only anchor a finding — and
        // thus a one-click fix target — when it resolves inside the workspace.
        const safeAbsolutePath = resolveWithinRoot(repoRoot, issue.path);
        if (safeAbsolutePath === null) {
            escapingFindings += 1;
            continue;
        }
        const fileUri = vscode.Uri.file(safeAbsolutePath);
        const uriString = fileUri.toString();
        const fileIssues = findingsByUri.get(uriString) ?? [];
        fileIssues.push(sanitizeIssueForDisplay(issue));
        findingsByUri.set(uriString, fileIssues);
    }

    if (escapingFindings > 0) {
        console.warn(`[unslop] Dropped ${escapingFindings} finding(s) whose path resolved outside the workspace.`);
    }

    findingsStore.replaceAll(findingsByUri);

    for (const [uriString, fileIssues] of findingsByUri) {
        const fileUri = vscode.Uri.parse(uriString);
        diagnosticCollection.set(fileUri, fileIssues.map((issue) => buildDiagnostic(issue, false)));
    }

    // Report only the findings actually anchored in the workspace, not the raw
    // count — dropped out-of-workspace findings were never published.
    return scanResult.issues.length - escapingFindings;
}

/**
 * `rule` und `critique` sind modell-authored und erreichen das Problems-Panel
 * (Message + Diagnostic-Code) — ANSI-/OSC-Steuersequenzen werden am Ingest
 * entfernt, damit Store-Keys, Diagnostics und Apply-Fix-Lookups konsistent
 * auf demselben (sanitisierten) Text arbeiten. `fixedCodeSnippet` bleibt
 * bewusst unangetastet: er ist der Apply-Payload (CRLF-Erhalt), kein
 * Display-Text. `fixAdvice` ist reiner Display-Text und wird mit bereinigt.
 * `path` sichert bereits resolveWithinRoot ab.
 */
function sanitizeIssueForDisplay(issue: ScanIssue): ScanIssue {
    return {
        ...issue,
        rule: sanitizeModelText(issue.rule),
        critique: sanitizeModelText(issue.critique),
        ...(issue.fixAdvice !== undefined ? { fixAdvice: sanitizeModelText(issue.fixAdvice) } : {}),
    };
}

export function buildDiagnostic(issue: ScanIssue, isStale: boolean): vscode.Diagnostic {
    const anchorRange = new vscode.Range(
        new vscode.Position(Math.max(0, issue.line - 1), 0),
        new vscode.Position(Math.max(0, issue.endLine - 1), Number.MAX_SAFE_INTEGER),
    );

    const diagnostic = new vscode.Diagnostic(
        anchorRange,
        buildDiagnosticMessage(issue, isStale),
        isStale ? vscode.DiagnosticSeverity.Hint : severityFor(issue),
    );
    diagnostic.source = DIAGNOSTIC_SOURCE;
    // Nackte Regel-ID: das Problems-Panel zeigt `unslop(COND-003)`, der Titel steht in der Meldung.
    diagnostic.code = diagnosticCodeOf(issue);
    return diagnostic;
}

/** Rebuilds a file's diagnostics from the store (e.g. after apply/stale). */
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

/** Store-Schlüssel des Findings hinter einem Diagnostic; undefined ohne eindeutigen Treffer. */
export function issueKeyForDiagnostic(
    diagnostic: vscode.Diagnostic,
    fileUri: vscode.Uri,
    findingsStore: FindingsStore,
): string | undefined {
    return findingsStore.keyForDiagnostic(fileUri, {
        line: diagnostic.range.start.line + 1,
        code: String(diagnostic.code ?? ''),
        message: diagnostic.message,
    });
}

function severityFor(issue: ScanIssue): vscode.DiagnosticSeverity {
    return issue.severity === 'CRITICAL'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;
}
