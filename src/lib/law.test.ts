/**
 * Unit Tests: Dynamic Law Filtering (BEST_PRACTICES_PLAN §9.4).
 *
 * Der Filter darf NUR von den Repo-Ökosystemen abhängen; null (Erkennung nie
 * gelaufen) muss exakt das Verhalten vor Phase 5 liefern. renderLawBlock muss
 * byte-deterministisch bleiben (Cache-Contract des System-Prompts).
 */
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { filterRulesByEcosystems, renderLawBlock } from '@/lib/law';
import { GATED_LLM_EXTENSIONS } from '@/lib/pipeline/defaults';
import { detectDiffEcosystems, detectRepoEcosystems } from '@/lib/pipeline/ecosystem-detection';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

interface TestRuleRow {
    readonly rule_id: string;
    readonly category: string;
    readonly public_explanation: string | null;
    readonly applies_to: readonly string[] | null;
}

function buildRuleRow(
    ruleId: string,
    appliesTo: readonly string[] | null,
    publicExplanation: string | null = null,
): TestRuleRow {
    return {
        rule_id: ruleId,
        category: 'security',
        public_explanation: publicExplanation,
        applies_to: appliesTo,
    };
}

const MALLOC_RULE = buildRuleRow('SEC-001', ['c', 'cpp']);
const XSS_RULE = buildRuleRow('SEC-026', ['react', 'nextjs', 'typescript']);
const UNIVERSAL_RULE = buildRuleRow('PROC-001', null);
const EMPTY_TAGS_RULE = buildRuleRow('MAINT-001', []);

const ALL_RULES = [MALLOC_RULE, XSS_RULE, UNIVERSAL_RULE, EMPTY_TAGS_RULE];

describe('filterRulesByEcosystems', () => {
    it('null (Erkennung nie gelaufen) liefert ALLE Regeln — Verhalten vor Phase 5', () => {
        expect(filterRulesByEcosystems(ALL_RULES, null)).toEqual(ALL_RULES);
    });

    it('leere Erkennung liefert ALLE Regeln — kein Signal, kein Filter (fail-open)', () => {
        // Früher „[] ⇒ nur universelle Regeln“ — das hat den Law-Block auf dem
        // Prod-Repo mit leerem Default-Branch kollabieren lassen und die
        // Draft-Recall gekillt (Clean-Scan-Anomalie 2026-08-10, ROADMAP §3g).
        expect(filterRulesByEcosystems(ALL_RULES, [])).toEqual(ALL_RULES);
    });

    it('Next.js-Repo bekommt keine malloc-Regel, aber XSS und Universelles', () => {
        const filteredRules = filterRulesByEcosystems(
            ALL_RULES,
            ['nextjs', 'react', 'typescript', 'nodejs'],
        );

        expect(filteredRules).toEqual([XSS_RULE, UNIVERSAL_RULE, EMPTY_TAGS_RULE]);
    });

    it('ein einzelner Tag-Treffer genügt für die Aufnahme', () => {
        const filteredRules = filterRulesByEcosystems(ALL_RULES, ['typescript']);

        expect(filteredRules).toContain(XSS_RULE);
        expect(filteredRules).not.toContain(MALLOC_RULE);
    });
});

describe('renderLawBlock (Cache-Contract)', () => {
    it('ist byte-deterministisch für identischen Input', () => {
        const firstRender = renderLawBlock(ALL_RULES);
        const secondRender = renderLawBlock(ALL_RULES);

        expect(firstRender).toBe(secondRender);
        expect(firstRender).toContain('[SEC-001]');
        expect(firstRender).toContain('=== THE LAW');
    });

    it('gefilterte Regeln erscheinen nicht im gerenderten Block', () => {
        const nextjsRules = filterRulesByEcosystems(ALL_RULES, ['nextjs']);

        expect(renderLawBlock(nextjsRules)).not.toContain('[SEC-001]');
    });
});

describe('renderLawBlock — kein IP-Leak in den System-Prompt (ROADMAP §12)', () => {
    it('rendert die public_explanation, wenn sie gesetzt ist', () => {
        const deLeakedRule = buildRuleRow('MAINT-002', null, 'Empty catch blocks hide failures from logs.');

        expect(renderLawBlock([deLeakedRule])).toContain('Empty catch blocks hide failures from logs.');
    });

    it('rendert eine content-freie neutrale Zeile, wenn public_explanation NULL ist', () => {
        // Kein Fallback auf content: das Detektions-Rezept darf den Prompt nie
        // erreichen, auch nicht für noch nicht de-leakte Regeln.
        const notYetAuthored = buildRuleRow('PROC-001', null, null);
        const renderedBlock = renderLawBlock([notYetAuthored]);

        expect(renderedBlock).toContain('Enforced by automated checks');
        expect(renderedBlock).toContain('[PROC-001]');
    });

    it('rendert keinen title mehr — der Kopf ist ausschließlich [ID] (Kategorie)', () => {
        // title trug Forschungszitate/Statistiken (arXiv/CWE/%) und ist aus dem
        // GoldenStandardRow-Contract entfernt; die Kopfzeile beweist es.
        const anyRule = buildRuleRow('SEC-001', null, 'Check allocation results before use.');

        expect(renderLawBlock([anyRule])).toContain('### [SEC-001] (security)');
    });
});

describe('Gate G6 — Law-Filter im polyglotten Repo (LANGUAGE_COVERAGE_SPEC §6.4)', () => {
    /** TypeScript-Host mit einem Python-Service und einem Spring-Modul. */
    const POLYGLOT_TREE_PATHS = [
        'package.json', 'tsconfig.json', 'src/app/page.tsx',
        'services/reports/pyproject.toml', 'services/reports/report_job.py',
        'billing/pom.xml', 'billing/src/main/java/com/acme/billing/Ledger.java',
    ];
    const MANIFEST_CONTENTS: Readonly<Record<string, string>> = {
        'package.json': '{"dependencies":{"next":"16.2.4","react":"19.0.0"}}',
        'billing/pom.xml': '<parent><artifactId>spring-boot-starter-parent</artifactId></parent>',
    };

    /** Snapshot der Live-Tabelle `golden_standards` (Drift-Check im Benchmark-Preflight). */
    function loadInventoryRuleRows(): TestRuleRow[] {
        const inventory: unknown = JSON.parse(
            fs.readFileSync(path.join(process.cwd(), 'fixtures', 'rule-recall', 'rules-inventory.json'), 'utf-8'),
        );
        if (!inventory || typeof inventory !== 'object' || !('rules' in inventory) || !Array.isArray(inventory.rules)) {
            throw new Error('rules-inventory.json: rules-Liste fehlt.');
        }
        return inventory.rules.map((inventoryRule: { rule_id: string; applies_to: readonly string[] | null }) =>
            buildRuleRow(inventoryRule.rule_id, inventoryRule.applies_to));
    }

    it.each(GATED_LLM_EXTENSIONS)('keeps every rule tagged for the language of %s files in the filtered block', async (gatedExtension) => {
        const repoEcosystems = await detectRepoEcosystems(
            POLYGLOT_TREE_PATHS,
            (manifestPath) => Promise.resolve(MANIFEST_CONTENTS[manifestPath] ?? null),
        );
        const languageEcosystems: readonly string[] = detectDiffEcosystems([`module/changed_file${gatedExtension}`]);
        const inventoryRuleRows = loadInventoryRuleRows();
        const taggedRuleIds = inventoryRuleRows
            .filter((ruleRow) => ruleRow.applies_to?.some((ecosystemTag) => languageEcosystems.includes(ecosystemTag)))
            .map((ruleRow) => ruleRow.rule_id);

        const filteredRuleIds = filterRulesByEcosystems(inventoryRuleRows, repoEcosystems)
            .map((ruleRow) => ruleRow.rule_id);

        expect(languageEcosystems).toHaveLength(1);
        expect(taggedRuleIds.length).toBeGreaterThanOrEqual(7);
        expect(filteredRuleIds).toEqual(expect.arrayContaining(taggedRuleIds));
    });
});
