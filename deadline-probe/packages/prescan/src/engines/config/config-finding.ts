/**
 * Gemeinsamer Finding-Builder der Config-Checks (v4): Titel/Severity/
 * Explanation kommen aus RULE_REGISTRY, die Checks liefern nur Anker + Zitat.
 */
import { RULE_REGISTRY } from '../../rules/registry';
import type { PrescanFinding, PrescanSeverity } from '../../types';

export interface ConfigFindingAnchor {
    readonly ruleId: string;
    readonly path: string;
    readonly line: number;
    readonly quote: string;
    readonly severityOverride?: PrescanSeverity;
}

export function buildConfigFinding(anchor: ConfigFindingAnchor): PrescanFinding {
    const descriptor = RULE_REGISTRY.get(anchor.ruleId);
    return {
        ruleId: anchor.ruleId,
        ruleTitle: descriptor?.title ?? anchor.ruleId,
        severity: anchor.severityOverride ?? descriptor?.severity ?? 'WARNING',
        path: anchor.path,
        line: anchor.line,
        endLine: anchor.line,
        exactQuote: anchor.quote.trim().substring(0, 200),
        explanation: descriptor?.explanation ?? '',
        fixTemplate: descriptor?.fixTemplate,
        engine: 'config',
        fileLevel: false,
    };
}
