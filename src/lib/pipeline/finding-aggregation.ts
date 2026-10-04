/**
 * Finding-Aggregation pro Rule+File (ROADMAP §7).
 *
 * Meldet der Draft-Reviewer dieselbe Regel mehrfach in derselben Datei
 * (der 32-Emoji-Fall: 32 Einzelfindings → 36 Claims → ~55s Verifikation),
 * werden die Vorkommen VOR der Claim-Verifikation zu EINEM Finding mit
 * occurrences-Liste gebündelt: ein Claim, ein Verdict, ein Kommentar.
 *
 * Anker-Contract: line/endLine/exactQuote des Aggregats spiegeln das erste
 * Vorkommen (aufsteigend nach Zeile). Damit bleiben Finding-ID
 * (sha256 über bareRule\0path\0exactQuote\0ordinal, helpers.assignFindingIds)
 * und Apply-/Suppression-Anker deterministisch — unabhängig davon, wie viele
 * weitere Vorkommen ein späterer Scan findet.
 */
import type { IssueOccurrence } from '@unslop/shared';
import type { PipelineIssue } from '@/lib/pipeline/types';

/** Bare Rule-ID vor dem ersten Leerzeichen — derselbe Prefix-Split wie die Dedupe. */
export function normalizeBareRuleId(rule: string): string {
    return rule.split(' ')[0] || rule;
}

// =============================================================================
// Aggregation (Draft-Lane, vor der Claim-Verifikation)
// =============================================================================

/**
 * Bündelt Issues mit gleicher (bareRuleId, path)-Identität zu einem Finding.
 * Einzelgänger passieren unverändert (kein occurrences-Feld — Alt-Contract);
 * die Ausgabe-Reihenfolge folgt dem ersten Auftreten jeder Gruppe. Rein und
 * deterministisch: gleiche Eingabe ⇒ gleiche Aggregate, gleiche Anker.
 */
export function aggregateIssuesByRuleAndFile(issues: readonly PipelineIssue[]): PipelineIssue[] {
    const issueGroups = new Map<string, PipelineIssue[]>();
    for (const issue of issues) {
        const groupKey = `${normalizeBareRuleId(issue.rule)}\0${issue.path}`;
        const groupMembers = issueGroups.get(groupKey) ?? [];
        groupMembers.push(issue);
        issueGroups.set(groupKey, groupMembers);
    }

    return [...issueGroups.values()].map(
        (groupMembers) => (groupMembers.length === 1 ? groupMembers[0] : consolidateGroup(groupMembers)),
    );
}

function consolidateGroup(groupMembers: readonly PipelineIssue[]): PipelineIssue {
    const sortedMembers = [...groupMembers].sort(
        (first, second) => first.line - second.line || first.endLine - second.endLine,
    );
    const representative = sortedMembers[0];
    const minimumConfidence = minimumDefinedConfidence(sortedMembers);

    return {
        ...representative,
        // Konservativ: ein CRITICAL-Vorkommen macht das Aggregat CRITICAL.
        severity: sortedMembers.some((member) => member.severity === 'CRITICAL')
            ? 'CRITICAL'
            : 'WARNING',
        // pro-direct liefert self-reported Confidence pro Vorkommen — das
        // unsicherste Vorkommen bestimmt das Aggregat (Richtung Eskalation).
        ...(minimumConfidence !== null ? { confidence: minimumConfidence } : {}),
        occurrences: sortedMembers.map(toOccurrence),
    };
}

function toOccurrence(issue: PipelineIssue): IssueOccurrence {
    return { line: issue.line, endLine: issue.endLine, exactQuote: issue.exactQuote };
}

function minimumDefinedConfidence(groupMembers: readonly PipelineIssue[]): number | null {
    const definedConfidences = groupMembers
        .map((member) => member.confidence)
        .filter((confidence): confidence is number => typeof confidence === 'number');
    return definedConfidences.length > 0 ? Math.min(...definedConfidences) : null;
}

// =============================================================================
// Occurrence-genaue Prescan-Dedupe (Merge-Punkt, pre_scanner_design.md §5.1)
// =============================================================================

/**
 * Entfernt aus einem LLM-Issue die Vorkommen, die mit einem deterministischen
 * Prescan-Finding kollidieren (gleiche Datei, Rule-ID im Rule-String,
 * überlappender Zeilenbereich) — das deterministische Finding gewinnt.
 *
 * Einzel-Issues verhalten sich wie vor der Aggregation (Kollision ⇒ null).
 * Bei Aggregaten fallen NUR die kollidierenden Vorkommen weg; der Rest wird
 * auf das erste verbleibende Vorkommen re-verankert. null = nichts übrig.
 */
export function subtractPrescanOverlaps(
    llmIssue: PipelineIssue,
    prescanIssues: readonly PipelineIssue[],
): PipelineIssue | null {
    const collidingPrescanIssues = prescanIssues.filter(
        (prescanIssue) => matchesPrescanRuleAndFile(llmIssue, prescanIssue),
    );
    if (collidingPrescanIssues.length === 0) return llmIssue;

    if (!llmIssue.occurrences) {
        const topLevelCollides = collidingPrescanIssues.some(
            (prescanIssue) => rangesOverlap(llmIssue, prescanIssue),
        );
        return topLevelCollides ? null : llmIssue;
    }

    const remainingOccurrences = llmIssue.occurrences.filter(
        (occurrence) => !collidingPrescanIssues.some(
            (prescanIssue) => rangesOverlap(occurrence, prescanIssue),
        ),
    );

    if (remainingOccurrences.length === llmIssue.occurrences.length) return llmIssue;
    if (remainingOccurrences.length === 0) return null;
    return reanchorToRemaining(llmIssue, remainingOccurrences);
}

function matchesPrescanRuleAndFile(llmIssue: PipelineIssue, prescanIssue: PipelineIssue): boolean {
    if (llmIssue.path !== prescanIssue.path) return false;
    const prescanRuleId = prescanIssue.rule.split(' ')[0];
    return Boolean(prescanRuleId) && llmIssue.rule.includes(prescanRuleId);
}

function rangesOverlap(
    lineRange: { readonly line: number; readonly endLine: number },
    prescanIssue: PipelineIssue,
): boolean {
    return lineRange.line <= prescanIssue.endLine && prescanIssue.line <= lineRange.endLine;
}

/**
 * Re-verankert ein reduziertes Aggregat auf sein erstes verbleibendes
 * Vorkommen. fixedCodeSnippet überlebt NUR, wenn der ursprüngliche Anker
 * (erstes Vorkommen) noch dabei ist — der Snippet ist ein Drop-in-Ersatz für
 * exakt diese Zeilen und darf nie an einem anderen Vorkommen landen.
 */
function reanchorToRemaining(
    llmIssue: PipelineIssue,
    remainingOccurrences: readonly IssueOccurrence[],
): PipelineIssue {
    const newAnchor = remainingOccurrences[0];
    const anchorUnchanged = newAnchor.line === llmIssue.line
        && newAnchor.endLine === llmIssue.endLine
        && newAnchor.exactQuote === llmIssue.exactQuote;

    const { fixedCodeSnippet, occurrences, ...retainedFields } = llmIssue;
    void occurrences;
    return {
        ...retainedFields,
        line: newAnchor.line,
        endLine: newAnchor.endLine,
        exactQuote: newAnchor.exactQuote,
        ...(anchorUnchanged && fixedCodeSnippet !== undefined ? { fixedCodeSnippet } : {}),
        ...(remainingOccurrences.length > 1 ? { occurrences: remainingOccurrences } : {}),
    };
}
