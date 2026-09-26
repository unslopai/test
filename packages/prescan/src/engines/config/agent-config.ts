/**
 * SEC-042 / SEC-043 — Agent-Harness-Konfigurationen.
 *
 * v4 deckt genau EIN Format mit dokumentierter Semantik ab: Claude-Code-
 * Settings (`.claude/settings.json`, `.claude/settings.local.json`):
 *  - SEC-042 (CRITICAL): `defaultMode: bypassPermissions` + nicht-leere
 *    `permissions.deny` — alles außerhalb der Denylist läuft ungefragt.
 *    Eine Denylist im Default-Modus (Ask) ist KEIN Denylist-Gate: dort ist
 *    die menschliche Freigabe das Gate. Deshalb bewusst nicht geflaggt.
 *  - SEC-043 (WARNING): `bypassPermissions` ohne Denylist (binärer Vollzugriff)
 *    oder ein ungescoptes Shell-Grant (`Bash`, `Bash(*)`, `Bash(*:*)`) in
 *    `permissions.allow`.
 * Generische deny-/allow-Schlüssel in beliebigen YAML/JSON-Dateien werden
 * NICHT geprüft — ohne Harness-Semantik ist das FP-trächtig (Design §9).
 */
import { LineCounter, isScalar, parseDocument } from 'yaml';
import { buildConfigFinding } from './config-finding';
import { asMap, asSeq, lineOfNode, mapValue, scalarString } from './yaml-helpers';
import type { Node as YamlNode } from 'yaml';
import type { PrescanFinding } from '../../types';

const CLAUDE_SETTINGS_PATH = /(^|\/)\.claude\/settings(\.local)?\.json$/;
const UNSCOPED_SHELL_GRANT = /^Bash(\(\s*\*+(:\*)?\s*\))?$/;
const BYPASS_MODE = 'bypassPermissions';

export interface AgentConfigInput {
    readonly path: string;
    readonly source: string;
}

export function isAgentConfigPath(path: string): boolean {
    return CLAUDE_SETTINGS_PATH.test(path);
}

export function runAgentConfigChecks(input: AgentConfigInput): PrescanFinding[] {
    if (!isAgentConfigPath(input.path)) return [];
    const lineCounter = new LineCounter();
    const document = parseDocument(input.source, { lineCounter, keepSourceTokens: true });
    const permissions = asMap(mapValue(asMap(document.contents as YamlNode | null), 'permissions'));
    if (!permissions) return [];

    const sourceLines = input.source.split('\n');
    const quoteAt = (line: number): string => sourceLines[line - 1] ?? '';
    const findings: PrescanFinding[] = [];

    const defaultModeNode = mapValue(permissions, 'defaultMode');
    const denyNode = asSeq(mapValue(permissions, 'deny'));
    const isBypassMode = scalarString(defaultModeNode) === BYPASS_MODE;
    const hasDenylist = (denyNode?.items.length ?? 0) > 0;

    if (isBypassMode && hasDenylist) {
        const denyLine = lineOfNode(lineCounter, denyNode);
        findings.push(buildConfigFinding({ ruleId: 'SEC-042', path: input.path, line: denyLine, quote: quoteAt(denyLine) }));
    } else if (isBypassMode) {
        const modeLine = lineOfNode(lineCounter, defaultModeNode);
        findings.push(buildConfigFinding({ ruleId: 'SEC-043', path: input.path, line: modeLine, quote: quoteAt(modeLine) }));
    }

    for (const grantNode of asSeq(mapValue(permissions, 'allow'))?.items ?? []) {
        if (!isScalar(grantNode) || typeof grantNode.value !== 'string' || !UNSCOPED_SHELL_GRANT.test(grantNode.value.trim())) continue;
        const grantLine = lineOfNode(lineCounter, grantNode);
        findings.push(buildConfigFinding({ ruleId: 'SEC-043', path: input.path, line: grantLine, quote: quoteAt(grantLine) }));
    }
    return findings;
}
