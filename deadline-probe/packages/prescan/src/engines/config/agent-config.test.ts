/**
 * SEC-042/043-Tests — Claude-Code-Settings. Die Negativen sichern die
 * Semantik-Entscheidung aus Design §9: eine Denylist im Ask-Modus ist kein
 * Denylist-Gate, gescopte Bash-Grants sind kein Finding.
 */
import { describe, expect, it } from 'vitest';
import { runAgentConfigChecks } from './agent-config';

function settings(permissions: Record<string, unknown>): string {
    return JSON.stringify({ permissions }, null, 2);
}

function ruleIdsFor(path: string, source: string): string[] {
    return runAgentConfigChecks({ path, source }).map((finding) => finding.ruleId);
}

describe('SEC-042 — denylist-only shell gate', () => {
    it('flags bypassPermissions combined with a deny list, anchored at the deny key', () => {
        const source = settings({ defaultMode: 'bypassPermissions', deny: ['Bash(rm -rf *)', 'Bash(curl *)'] });
        const [finding] = runAgentConfigChecks({ path: '.claude/settings.json', source });
        expect(finding).toMatchObject({ ruleId: 'SEC-042', severity: 'CRITICAL', line: 4 });
        expect(finding.exactQuote).toContain('"deny"');
    });

    it('does not flag a deny list in the default (ask) mode or in a non-Claude file', () => {
        expect(ruleIdsFor('.claude/settings.local.json', settings({ deny: ['Bash(rm -rf *)'] }))).toEqual([]);
        expect(ruleIdsFor('.claude/settings.json', settings({ defaultMode: 'acceptEdits', deny: ['Bash(rm *)'], allow: ['Bash(npm test:*)'] }))).toEqual([]);
        expect(ruleIdsFor('config/permissions.json', settings({ defaultMode: 'bypassPermissions', deny: ['Bash(rm *)'] }))).toEqual([]);
    });
});

describe('SEC-043 — unscoped tool grants', () => {
    it('flags bypassPermissions without a deny list and bare Bash grants', () => {
        expect(ruleIdsFor('.claude/settings.json', settings({ defaultMode: 'bypassPermissions' }))).toEqual(['SEC-043']);
        const bareGrants = settings({ allow: ['Read', 'Bash', 'Bash(*)', 'Bash(git status:*)'] });
        const grantFindings = runAgentConfigChecks({ path: 'apps/web/.claude/settings.json', source: bareGrants });
        expect(grantFindings.map((finding) => [finding.ruleId, finding.line])).toEqual([['SEC-043', 5], ['SEC-043', 6]]);
    });

    it('accepts scoped grants and survives malformed JSON without findings', () => {
        expect(ruleIdsFor('.claude/settings.json', settings({ allow: ['Bash(npm run *)', 'Edit(src/**)'] }))).toEqual([]);
        expect(ruleIdsFor('.claude/settings.json', '{ "permissions": ')).toEqual([]);
    });
});
