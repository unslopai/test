/**
 * Schlüssel eines Findings im FindingsStore und der Weg vom Diagnostic zurück
 * zu diesem Schlüssel (pure, kein vscode-Import — testbar ohne Extension-Host).
 *
 * Der Store-Schlüssel ist Startzeile + volles (sanitisiertes) Regel-Label. Der
 * Diagnostic-Code trägt seit dem Problems-Panel-Fix nur die nackte Regel-ID,
 * und die ist pro Zeile nicht garantiert eindeutig: der Server bündelt zwar je
 * Bare-ID und Datei, hält aber HAL-002-Import-Claims getrennt von den übrigen
 * HAL-002-Befunden (reviewer-call.ts), und Pre-Scan-Befunde laufen an der
 * Draft-Aggregation vorbei. Deshalb wird ein Diagnostic über den Store
 * aufgelöst statt den Schlüssel aus dem Code nachzubauen.
 */
import type { ScanIssue } from '@unslop/shared';
import { buildDiagnosticMessage } from './diagnosticMessage';
import type { TrackedFinding } from './findingsStore';
import { splitRuleLabel } from './ruleLabel';

export function issueKeyOf(issueLine: number, issueRule: string): string {
    return `${issueLine}::${issueRule}`;
}

/** Diagnostic-Code im Problems-Panel: die nackte Regel-ID, ohne ID das ganze Label. */
export function diagnosticCodeOf(issue: Pick<ScanIssue, 'rule'>): string {
    return splitRuleLabel(issue.rule).ruleId;
}

/** Was ein Diagnostic nach dem Durchreichen durch VS Code noch verlässlich trägt. */
export interface DiagnosticAnchor {
    /** 1-basierte Startzeile. */
    readonly line: number;
    readonly code: string;
    readonly message: string;
}

/**
 * Schlüssel des Findings, aus dem das Diagnostic gebaut wurde. Eindeutig über
 * Zeile + Regel-ID reicht im Normalfall; teilen sich zwei Findings beides, so
 * entscheidet die Meldung (sie trägt Titel und Kritik). Ohne eindeutigen
 * Treffer: undefined — lieber keine Code Action als der Fix eines anderen
 * Findings.
 */
export function resolveIssueKey(
    anchor: DiagnosticAnchor,
    keyedFindings: Iterable<readonly [string, TrackedFinding]>,
): string | undefined {
    const sameRuleOnLine = [...keyedFindings].filter(([, tracked]) => tracked.issue.line === anchor.line
        && diagnosticCodeOf(tracked.issue) === anchor.code);
    if (sameRuleOnLine.length === 1) return sameRuleOnLine[0][0];

    const sameMessage = sameRuleOnLine.filter(
        ([, tracked]) => buildDiagnosticMessage(tracked.issue, tracked.stale) === anchor.message,
    );
    return sameMessage.length === 1 ? sameMessage[0][0] : undefined;
}
