/**
 * Deckel für wiederholte Treffer derselben Pre-Scanner-Regel
 * (LANGUAGE_COVERAGE_SPEC §8, E4).
 *
 * `kubernetes/examples` liefert 641 WARNINGs auf 400 Dateien, INFRA-002, -007
 * und -010 je 127-mal. 127 Inline-Kommentare derselben Regel liest niemand.
 * Die ersten drei Treffer einer Regel bleiben einzelne Findings, ab dem
 * vierten steht ein einziges Finding für den Rest und nennt jede Fundstelle —
 * gekürzt wird die Darstellung, nie die Liste.
 */
import type { PipelineIssue } from '@/lib/pipeline/types';

/** So viele Treffer derselben Regel erscheinen als eigene Findings. */
export const INDIVIDUAL_HITS_PER_RULE = 3;

/**
 * Gruppiert nach Regel und Severity: ein CRITICAL verschwindet nie in einem
 * WARNING-Sammelfinding. Die Reihenfolge bleibt erhalten, das Sammelfinding
 * steht an der Stelle des vierten Treffers.
 */
export function capRepeatedRuleHits(prescanIssues: readonly PipelineIssue[]): PipelineIssue[] {
    const hitsByRule = new Map<string, PipelineIssue[]>();
    for (const prescanIssue of prescanIssues) {
        const ruleKey = buildRuleKey(prescanIssue);
        hitsByRule.set(ruleKey, [...(hitsByRule.get(ruleKey) ?? []), prescanIssue]);
    }

    return prescanIssues.flatMap((prescanIssue) => {
        const ruleHits = hitsByRule.get(buildRuleKey(prescanIssue)) ?? [];
        const hitPosition = ruleHits.indexOf(prescanIssue);
        if (hitPosition < INDIVIDUAL_HITS_PER_RULE) return [prescanIssue];
        return hitPosition === INDIVIDUAL_HITS_PER_RULE ? [collapseOverflowHits(ruleHits)] : [];
    });
}

function buildRuleKey(prescanIssue: PipelineIssue): string {
    return `${prescanIssue.rule}\0${prescanIssue.severity}`;
}

function collapseOverflowHits(ruleHits: readonly PipelineIssue[]): PipelineIssue {
    const overflowHits = ruleHits.slice(INDIVIDUAL_HITS_PER_RULE);
    const [anchorIssue] = overflowHits;
    const overflowLocations = overflowHits.map((overflowHit) => `${overflowHit.path}:${overflowHit.line}`);
    return {
        ...anchorIssue,
        critique: `${anchorIssue.critique}\n\nThis rule matched ${ruleHits.length} times in this change. `
            + `The first ${INDIVIDUAL_HITS_PER_RULE} are reported individually; this finding stands for the `
            + `remaining ${overflowHits.length}: ${overflowLocations.join(', ')}.`,
        // Ein einzelner Fix-Vorschlag würde für alle Fundstellen gelesen.
        fixedCodeSnippet: undefined,
    };
}
