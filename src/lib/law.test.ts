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
import { parseFixtureDiff } from '@/lib/benchmark/rule-recall-manifest';
import type { RuleRecallManifest } from '@/lib/benchmark/rule-recall-manifest';
import { filterRulesByEcosystems, renderLawBlock, resolveLawTags } from '@/lib/law';
import { GATED_LLM_EXTENSIONS } from '@/lib/pipeline/defaults';
import { KNOWN_ECOSYSTEMS, detectDiffEcosystems, detectRepoEcosystems } from '@/lib/pipeline/ecosystem-detection';

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
    /**
     * TypeScript-Host. Jede Sprache kommt als einzelne Datei ohne Manifest
     * dazu: der härteste Fall (Go ohne `go.mod`, Java ohne Spring, Python ohne
     * `pyproject.toml`).
     */
    const HOST_TREE_PATHS = ['package.json', 'tsconfig.json', 'src/app/page.tsx'];
    const MANIFEST_CONTENTS: Readonly<Record<string, string>> = {
        'package.json': '{"dependencies":{"next":"16.2.4","react":"19.0.0"}}',
    };
    const loadHostManifest = (manifestPath: string): Promise<string | null> =>
        Promise.resolve(MANIFEST_CONTENTS[manifestPath] ?? null);

    /** Regeln je Endung laut Live-Tabelle (SQL 2026-10-03) — fest verdrahtet, damit der Test nicht nur die Erkennung mit sich selbst vergleicht. */
    const C_FAMILY_RULE_IDS = [
        'CONC-003', 'CONC-004', 'CONC-005', 'HAL-005', 'SEC-001', 'SEC-002', 'SEC-003',
        'SEC-023', 'SEC-027', 'SEC-028', 'SEC-029',
    ];
    const POWERSHELL_RULE_IDS = ['SEC-011', 'SEC-048', 'SEC-049', 'SEC-050'];
    const TAGGED_RULE_IDS_BY_EXTENSION: Readonly<Record<string, readonly string[]>> = {
        '.py': ['ARCH-003', 'HAL-003', 'SEC-006', 'SEC-008', 'SEC-010', 'SEC-011', 'SEC-019', 'SEC-036'],
        '.java': ['HAL-004', 'HAL-006', 'HAL-007', 'SEC-006', 'SEC-008', 'SEC-015', 'SEC-030'],
        '.go': ['ARCH-005'],
        '.c': C_FAMILY_RULE_IDS,
        '.h': C_FAMILY_RULE_IDS,
        '.cpp': C_FAMILY_RULE_IDS,
        '.cc': C_FAMILY_RULE_IDS,
        '.cxx': C_FAMILY_RULE_IDS,
        '.hpp': C_FAMILY_RULE_IDS,
        '.tf': ['INFRA-012', 'SEC-032', 'SEC-033', 'SEC-034'],
        '.ps1': POWERSHELL_RULE_IDS,
        '.psm1': POWERSHELL_RULE_IDS,
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

    function loadRuleRecallManifest(): RuleRecallManifest {
        const manifest: unknown = JSON.parse(
            fs.readFileSync(path.join(process.cwd(), 'fixtures', 'rule-recall', 'manifest.json'), 'utf-8'),
        );
        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
            throw new Error('manifest.json: kein Objekt.');
        }
        return manifest as RuleRecallManifest;
    }

    function filterInventoryFor(repoEcosystems: readonly string[]): string[] {
        return filterRulesByEcosystems(loadInventoryRuleRows(), repoEcosystems).map((ruleRow) => ruleRow.rule_id);
    }

    it.each(GATED_LLM_EXTENSIONS)('keeps every rule tagged for the language of %s files in the filtered block', async (gatedExtension) => {
        const languageFile = `module/changed_file${gatedExtension}`;
        const repoEcosystems = await detectRepoEcosystems([...HOST_TREE_PATHS, languageFile], loadHostManifest);
        const languageLawTags = resolveLawTags(detectDiffEcosystems([languageFile]));
        const taggedRuleIds = loadInventoryRuleRows()
            .filter((ruleRow) => ruleRow.applies_to?.some((ecosystemTag) => languageLawTags.has(ecosystemTag)))
            .map((ruleRow) => ruleRow.rule_id);

        const filteredRuleIds = filterInventoryFor(repoEcosystems);

        expect(taggedRuleIds.sort()).toEqual(TAGGED_RULE_IDS_BY_EXTENSION[gatedExtension]);
        expect(filteredRuleIds).toEqual(expect.arrayContaining(taggedRuleIds));
    });

    it('keeps the 31 rules the filter used to drop from every repo with a detected ecosystem', async () => {
        const formerlyDroppedTags = new Set(['kubernetes', 'c', 'cpp', 'aws', 'terraform', 'powershell', 'solidity']);
        const formerlyDroppedRuleIds = loadInventoryRuleRows()
            .filter((ruleRow) => ruleRow.applies_to?.some((ecosystemTag) => formerlyDroppedTags.has(ecosystemTag))
                && !ruleRow.applies_to.includes('python'))
            .map((ruleRow) => ruleRow.rule_id);
        const polyglotTreePaths = [
            ...HOST_TREE_PATHS, 'k8s/api-deployment.yaml', 'native/codec/frame.c', 'infra/network/subnets.tf',
            'scripts/deploy/prepare-host.ps1', 'contracts/Escrow.sol',
        ];

        const repoEcosystems = await detectRepoEcosystems(polyglotTreePaths, loadHostManifest);

        expect(formerlyDroppedRuleIds).toHaveLength(31);
        expect(filterInventoryFor(repoEcosystems)).toEqual(expect.arrayContaining(formerlyDroppedRuleIds));
    });

    it('gives every tagged rule at least one tag the detection can produce', () => {
        const reachableLawTags = resolveLawTags(KNOWN_ECOSYSTEMS);
        const unreachableRuleIds = loadInventoryRuleRows()
            .filter((ruleRow) => (ruleRow.applies_to?.length ?? 0) > 0
                && !ruleRow.applies_to?.some((ecosystemTag) => reachableLawTags.has(ecosystemTag)))
            .map((ruleRow) => ruleRow.rule_id);

        expect(unreachableRuleIds).toEqual([]);
    });

    it('keeps the Rust rules of a Rust repository that also has a PowerShell script', async () => {
        const repoEcosystems = await detectRepoEcosystems(
            ['Cargo.toml', 'src/main.rs', 'scripts/install.ps1'], loadHostManifest,
        );

        expect(filterInventoryFor(repoEcosystems)).toEqual(expect.arrayContaining(['CONC-003', 'SEC-008']));
    });

    it('keeps the Spring practices key next to the Java law key when the manifest names Spring', async () => {
        const springTreePaths = [...HOST_TREE_PATHS, 'billing/pom.xml', 'billing/src/main/java/com/acme/billing/Ledger.java'];
        const repoEcosystems = await detectRepoEcosystems(springTreePaths, (manifestPath) => Promise.resolve(
            manifestPath === 'billing/pom.xml'
                ? '<parent><artifactId>spring-boot-starter-parent</artifactId></parent>'
                : MANIFEST_CONTENTS[manifestPath] ?? null,
        ));

        expect(repoEcosystems).toEqual(expect.arrayContaining(['java-spring', 'java']));
    });

    it('fixture manifest: polyglotEcosystems equal what the detection yields for a TypeScript host with the fixture files', async () => {
        const manifest = loadRuleRecallManifest();
        const polyglotFixtures = Object.entries(manifest).filter(([, manifestEntry]) => manifestEntry.polyglotEcosystems);

        expect(polyglotFixtures.length).toBeGreaterThanOrEqual(5);
        for (const [fixtureName, manifestEntry] of polyglotFixtures) {
            const fixturePaths = parseFixtureDiff(
                fixtureName,
                fs.readFileSync(path.join(process.cwd(), 'fixtures', 'rule-recall', fixtureName), 'utf-8'),
            ).map((fixtureFile) => fixtureFile.path);
            const repoEcosystems = await detectRepoEcosystems(['package.json', 'tsconfig.json', ...fixturePaths], () => Promise.resolve(null));

            expect(repoEcosystems, fixtureName).toEqual(manifestEntry.polyglotEcosystems);
        }
    });
});
