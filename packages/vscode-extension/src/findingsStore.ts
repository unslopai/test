/**
 * Holds the findings of the last scan, linked to their diagnostics.
 *
 * Key: file URI + issueKey (start line + full rule label), because VS Code
 * clones Diagnostic objects when passing them through — object identity is
 * unusable as a link. A diagnostic carries only the bare rule ID as its code,
 * so it is resolved back to its key via keyForDiagnostic (issueKey.ts).
 */
import type { ScanIssue } from '@unslop/shared';
import * as vscode from 'vscode';
import { issueKeyOf, resolveIssueKey, type DiagnosticAnchor } from './issueKey';

export interface TrackedFinding {
    readonly issue: ScanIssue;
    stale: boolean;
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

    keyForDiagnostic(fileUri: vscode.Uri, anchor: DiagnosticAnchor): string | undefined {
        const trackedFindings = this.findingsByFile.get(fileUri.toString());
        return trackedFindings ? resolveIssueKey(anchor, trackedFindings) : undefined;
    }

    findingsFor(fileUri: vscode.Uri): readonly TrackedFinding[] {
        return [...(this.findingsByFile.get(fileUri.toString())?.values() ?? [])];
    }

    remove(fileUri: vscode.Uri, issueKey: string): void {
        this.findingsByFile.get(fileUri.toString())?.delete(issueKey);
    }

    /** Global count for the status bar (critical/warning/stale). */
    countsAll(): { critical: number; warning: number; stale: number } {
        let critical = 0;
        let warning = 0;
        let stale = 0;
        for (const trackedFindings of this.findingsByFile.values()) {
            for (const tracked of trackedFindings.values()) {
                if (tracked.issue.severity === 'CRITICAL') critical++;
                else warning++;
                if (tracked.stale) stale++;
            }
        }
        return { critical, warning, stale };
    }

    hasAnyFindings(): boolean {
        for (const trackedFindings of this.findingsByFile.values()) {
            if (trackedFindings.size > 0) return true;
        }
        return false;
    }

    clear(): void {
        this.findingsByFile.clear();
    }
}
