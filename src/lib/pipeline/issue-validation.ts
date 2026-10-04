/**
 * Issue-Validation — server-seitige Validation-Boundary für modell-authored
 * Finding-Metadaten (ROADMAP §12, Rest von Audit-Finding 2).
 *
 * Das LLM-JSON ist untrusted [ARCH-002]. Zwei Prüfungen, beide gegen
 * server-kontrollierte Wahrheit:
 *  - `rule` muss eine Regel referenzieren, die dem Modell tatsächlich gegeben
 *    wurde: eine AKTIVE Condition (activeConditionIds ∩ CONDITION_REGISTRY —
 *    exakt die Menge, die buildConditionsBlock in den Prompt rendert) oder
 *    eine Rule-ID aus dem GERENDERTEN Law-Block (RenderedLaw.ruleIds).
 *  - `line`/`endLine` müssen ganzzahlig sein und strikt innerhalb der echten
 *    Diff-Hunks der referenzierten Datei liegen (Manifest = reviewableFiles).
 *
 * Verworfene Issues verlassen die Pipeline hier — vor Persistenz, GitHub-Post
 * und CLI-/Extension-Auslieferung. Die Prescan-Lane läuft NICHT hierdurch:
 * sie ist deterministisch und server-authored.
 */
import { CONDITION_REGISTRY } from '@/lib/pipeline/conditions';
import { buildHunkRangesByFile, isLineWithinHunks } from '@/lib/pipeline/diff-utils';
import type { HunkRange } from '@/lib/pipeline/diff-utils';
import type { PullRequestFile } from '@/lib/github';
import type { PipelineIssue } from '@/lib/pipeline/types';

/** "Condition 4 (Context Blindness)" — die Nummer entscheidet, anchored. */
const CONDITION_REFERENCE_PATTERN = /^Condition (\d+)\b/;
/**
 * Law-Rule-ID irgendwo im Rule-String ("SEC-001 (security)", "THE LAW:
 * MAINT-001") — bewusst NICHT anchored: das Output-Format schreibt dem Modell
 * für Law-Zitate keine Feld-Struktur vor, ein Präfix darf ein legitimes
 * Finding nicht kosten. Die Strenge liegt in der Enum-Mitgliedschaft.
 */
const LAW_RULE_REFERENCE_PATTERN = /\b([A-Z]{2,10}-\d{3})\b/;

export interface ManifestValidation {
    readonly acceptedIssues: readonly PipelineIssue[];
    /** Anzahl verworfener Issues — für das Server-Log, nie für den Client. */
    readonly rejectedCount: number;
}

/**
 * Filtert LLM-Issues gegen die bekannte Rule-Enum und das Diff-Hunk-Manifest.
 * Reine Funktion; wirft nie — ein unvalidierbares Issue wird verworfen,
 * nicht eskaliert (D10: die Kaskade erzeugt keine Job-Fehler).
 */
export function validateIssuesAgainstManifest(
    issues: readonly PipelineIssue[],
    reviewableFiles: readonly PullRequestFile[],
    lawRuleIds: readonly string[],
    activeConditionIds: readonly string[],
): ManifestValidation {
    const hunksByPath = buildHunkRangesByFile(reviewableFiles);
    const knownLawRuleIds = new Set(lawRuleIds);
    const promptedConditionIds = new Set(
        activeConditionIds.filter((conditionId) => CONDITION_REGISTRY.has(conditionId)),
    );

    const acceptedIssues = issues.filter(
        (issue) => referencesKnownRule(issue.rule, knownLawRuleIds, promptedConditionIds)
            && isAnchoredInManifest(issue, hunksByPath),
    );

    return { acceptedIssues, rejectedCount: issues.length - acceptedIssues.length };
}

function referencesKnownRule(
    ruleReference: string,
    knownLawRuleIds: ReadonlySet<string>,
    promptedConditionIds: ReadonlySet<string>,
): boolean {
    const conditionMatch = CONDITION_REFERENCE_PATTERN.exec(ruleReference);
    if (conditionMatch) {
        return promptedConditionIds.has(`COND-${conditionMatch[1].padStart(3, '0')}`);
    }

    const lawMatch = LAW_RULE_REFERENCE_PATTERN.exec(ruleReference);
    return lawMatch !== null && knownLawRuleIds.has(lawMatch[1]);
}

function isAnchoredInManifest(
    issue: PipelineIssue,
    hunksByPath: ReadonlyMap<string, readonly HunkRange[]>,
): boolean {
    const fileHunks = hunksByPath.get(issue.path);
    if (fileHunks === undefined) return false;

    if (!Number.isInteger(issue.line) || !Number.isInteger(issue.endLine)) return false;
    if (issue.line < 1 || issue.endLine < issue.line) return false;

    return isLineWithinHunks(issue.line, fileHunks)
        && isLineWithinHunks(issue.endLine, fileHunks);
}
