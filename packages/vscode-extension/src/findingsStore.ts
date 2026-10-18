/**
 * Hält die Findings des letzten Scans, verknüpft mit ihren Diagnostics.
 *
 * Schlüssel: Datei-URI + issueKey (Startzeile + Regel), weil VS Code
 * Diagnostic-Objekte beim Durchreichen klont — Objektidentität ist
 * als Verknüpfung unbrauchbar.
 */
import type { ScanIssue } from '@unslop/shared';
import * as vscode from 'vscode';

export interface TrackedFinding {
    readonly issue: ScanIssue;
    stale: boolean;
}

export function issueKeyOf(issueLine: number, issueRule: string): string {
    return `${issueLine}::${issueRule}`;
}

export class FindingsStore {
    private readonly findingsByFile = new Map<string, Map<string, TrackedFinding>>();

    replaceAll(findingsByUri: ReadonlyMap<string, readonly ScanIssue[]>): void {
        this.findingsByFile.clear();
        for (const [uriString, issues] of findingsByUri) {
            const trackedFindings = new Map<string, TrackedFinding>();
            for (const issue of issues) {
                trackedFindings.set(issueKeyOf(issue.line, issue.rule), { issue, stale: false });
            }
            this.findingsByFile.set(uriString, trackedFindings);
        }
    }

    lookup(fileUri: vscode.Uri, issueKey: string): TrackedFinding | undefined {
        return this.findingsByFile.get(fileUri.toString())?.get(issueKey);
    }

    findingsFor(fileUri: vscode.Uri): readonly TrackedFinding[] {
        return [...(this.findingsByFile.get(fileUri.toString())?.values() ?? [])];
    }

    remove(fileUri: vscode.Uri, issueKey: string): void {
        this.findingsByFile.get(fileUri.toString())?.delete(issueKey);
    }

    clear(): void {
        this.findingsByFile.clear();
    }
}
