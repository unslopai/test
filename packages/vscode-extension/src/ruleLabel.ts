/**
 * Zerlegung des Regel-Labels in Regel-ID und Titel:
 * `COND-003 (Lexical Slop)` → `COND-003` + `Lexical Slop`.
 *
 * Das Label entsteht serverseitig (src/lib/pipeline/rule-reference.ts,
 * presentRuleReference); hier wird es nur zerlegt, nicht neu gebaut. Die
 * ID-Form ist dieselbe wie dort (LEADING_RULE_ID_PATTERN). Eine eigene
 * Datei statt eines Imports aus @unslop/shared: die Extension kompiliert mit
 * plain tsc ohne Bundler und löst keine Runtime-Exports daraus auf
 * (dasselbe Muster wie lineRefs.ts).
 */

/** Regel-ID am Anfang des Labels, gleich was folgt: ` (…)`, `: …` oder nichts. */
const LEADING_RULE_ID_PATTERN = /^([A-Z]{2,10}-\d{3})\b/;

/** Trenner zwischen ID und Titel: Leerraum, Doppelpunkt, Binde- oder Gedankenstrich. */
const TITLE_SEPARATOR_PATTERN = /^[\s:\-\u2013\u2014]+/;

/** Ein Titel, der vollständig in runden Klammern steht: `(Lexical Slop)`. */
const PARENTHESIZED_TITLE_PATTERN = /^\((.*)\)$/;

export interface RuleLabelParts {
    /** Führende Regel-ID; ohne erkennbare ID das ganze (getrimmte) Label. */
    readonly ruleId: string;
    /** Titel hinter der ID; null ohne ID oder ohne Text dahinter. */
    readonly ruleTitle: string | null;
}

export function splitRuleLabel(ruleLabel: string): RuleLabelParts {
    const trimmedLabel = ruleLabel.trim();
    const leadingRuleId = LEADING_RULE_ID_PATTERN.exec(trimmedLabel)?.[1];
    if (leadingRuleId === undefined) return { ruleId: trimmedLabel, ruleTitle: null };

    const titleText = trimmedLabel.slice(leadingRuleId.length).replace(TITLE_SEPARATOR_PATTERN, '');
    const unwrappedTitle = (PARENTHESIZED_TITLE_PATTERN.exec(titleText)?.[1] ?? titleText).trim();
    return { ruleId: leadingRuleId, ruleTitle: unwrappedTitle === '' ? null : unwrappedTitle };
}
