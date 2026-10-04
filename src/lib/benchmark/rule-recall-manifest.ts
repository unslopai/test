/**
 * Rule-Recall Fixture-Validation — reine, DB-freie Struktur- und
 * Vollstaendigkeitspruefung der synthetischen Benchmark-Fixtures.
 *
 * Zwei Nutzer teilen sich diese Wahrheit:
 *  - der Offline-Vitest (`rule-recall-manifest.test.ts`): `npm test` bricht,
 *    sobald eine Fixture strukturell driftet ODER eine detektierbare Regel
 *    weder gepflanzt noch bewusst ausgeschlossen ist.
 *  - der Benchmark-Runner (`scripts/lib/rule-recall-benchmark.ts`): dieselbe
 *    Preflight-Pruefung, BEVOR echte LLM-Tokens ausgegeben werden.
 *
 * Kernkontrakt gegen die haeufigste Fixture-Fehlerquelle: der Unified-Diff-
 * Hunk-Header `@@ -1,0 +1,N @@` MUSS genau N `+`-Zeilen tragen. Stimmt N nicht,
 * faellt das gepflanzte Finding aus dem Hunk-Range der Anchor-Validierung
 * (`issue-validation.ts`) und ein real erkannter Verstoss zaehlt faelschlich
 * als "Miss". Deshalb wird N hier hart gegen die Realzahl geprueft.
 */

export interface ExpectedFinding {
    readonly path: string;
    readonly ruleContains: string;
}

export interface ManifestEntry {
    readonly description: string;
    readonly detectedEcosystems: readonly string[] | null;
    readonly negativeControl: boolean;
    readonly expected: readonly ExpectedFinding[];
}

export type RuleRecallManifest = Record<string, ManifestEntry>;

export interface ExcludedRule {
    readonly ruleId: string;
    readonly reason: string;
}

export interface ParsedFixtureFile {
    readonly path: string;
    readonly declaredAddedLines: number;
    readonly actualAddedLines: number;
}

const FILE_HEADER_PATTERN = /^=== FILE: (.+?) \((\w+)\) ===$/;
const HUNK_HEADER_PATTERN = /^@@ -\d+,\d+ \+\d+,(\d+) @@/;

/**
 * Zerlegt einen Fixture-Diff in seine Datei-Sektionen und misst pro Sektion
 * die deklarierte (Header-N) gegen die tatsaechliche `+`-Zeilenzahl. Wirft bei
 * jeder strukturellen Abweichung mit einer praezisen, fixture-benannten
 * Meldung — ein stiller Skip waere genau der Honesty-Bug, den INFRA-002
 * verbietet.
 */
export function parseFixtureDiff(fixtureName: string, diffText: string): ParsedFixtureFile[] {
    if (diffText.includes('\r')) {
        throw new Error(`${fixtureName}: enthaelt CR — Fixtures muessen LF-only sein.`);
    }
    const lines = diffText.split('\n');
    const files: ParsedFixtureFile[] = [];

    let currentPath: string | null = null;
    let declaredAddedLines = 0;
    let actualAddedLines = 0;
    let inHunk = false;

    const flush = (): void => {
        if (currentPath === null) return;
        files.push({ path: currentPath, declaredAddedLines, actualAddedLines });
    };

    for (const line of lines) {
        const fileHeaderMatch = FILE_HEADER_PATTERN.exec(line);
        if (fileHeaderMatch) {
            flush();
            currentPath = fileHeaderMatch[1].trim();
            declaredAddedLines = 0;
            actualAddedLines = 0;
            inHunk = false;
            continue;
        }

        const hunkHeaderMatch = HUNK_HEADER_PATTERN.exec(line);
        if (hunkHeaderMatch) {
            if (currentPath === null) {
                throw new Error(`${fixtureName}: Hunk-Header vor jeder FILE-Sektion.`);
            }
            if (inHunk) {
                throw new Error(`${fixtureName}: ${currentPath} hat >1 Hunk (nur einer erlaubt).`);
            }
            declaredAddedLines = Number(hunkHeaderMatch[1]);
            inHunk = true;
            continue;
        }

        if (inHunk && line.startsWith('+')) {
            actualAddedLines += 1;
            continue;
        }
        // Leerzeile zwischen Sektionen beendet den Hunk-Kontext; alles andere
        // innerhalb eines Hunks (ohne '+') verletzt den Pure-Addition-Contract.
        if (inHunk && line.trim().length > 0 && !line.startsWith('+')) {
            throw new Error(
                `${fixtureName}: ${currentPath} hat eine Nicht-'+'-Zeile im Hunk ` +
                `("${line.slice(0, 40)}") — Fixtures sind reine Additions-Patches.`,
            );
        }
        if (line.trim().length === 0) {
            inHunk = false;
        }
    }
    flush();
    return files;
}

export interface ValidationOptions {
    /** Alle rule_ids aus golden_standards, die eine public_explanation haben. */
    readonly detectableRuleIds: readonly string[];
    /** Rule-IDs, die bewusst NICHT als Fixture gepflanzt werden, mit Grund. */
    readonly excludedRules: readonly ExcludedRule[];
}

export interface ValidationResult {
    readonly errors: readonly string[];
    /** Regel-IDs, die in mindestens einer Fixture gepflanzt sind. */
    readonly plantedRuleIds: readonly string[];
    /** Detektierbare Regeln, die weder gepflanzt noch ausgeschlossen sind. */
    readonly uncoveredRuleIds: readonly string[];
}

/** Zieht die Rule-IDs (`SEC-001`) aus einem ruleContains-Ausdruck. */
export function extractRuleIds(ruleContains: string): string[] {
    return [...ruleContains.matchAll(/\b([A-Z]{2,10}-\d{3})\b/g)].map((match) => match[1]);
}

/** Erste Regel-ID eines ruleContains = die primaer gepflanzte Regel. */
export function primaryRuleId(ruleContains: string): string | null {
    return extractRuleIds(ruleContains)[0] ?? null;
}

/**
 * Prueft Manifest + geparste Fixtures strukturell und auf Vollstaendigkeit.
 * Reine Funktion: liest keine Dateien, ruft keine DB — die Aufrufer liefern
 * Manifest, geparste Diffs und die Regel-Universen.
 */
export function validateManifest(
    manifest: RuleRecallManifest,
    fixtures: Record<string, ParsedFixtureFile[]>,
    options: ValidationOptions,
): ValidationResult {
    const errors: string[] = [];
    const plantedRuleIds = new Set<string>();
    const globalPaths = new Set<string>();

    for (const [fixtureName, entry] of Object.entries(manifest)) {
        const parsedFiles = fixtures[fixtureName];
        if (!parsedFiles) {
            errors.push(`Manifest nennt ${fixtureName}, aber keine Diff-Datei gefunden.`);
            continue;
        }

        const fixturePaths = new Set(parsedFiles.map((file) => file.path));

        for (const file of parsedFiles) {
            if (file.declaredAddedLines !== file.actualAddedLines) {
                errors.push(
                    `${fixtureName}: ${file.path} Hunk deklariert ${file.declaredAddedLines} ` +
                    `Zeilen, hat aber ${file.actualAddedLines}.`,
                );
            }
            if (file.actualAddedLines < 1) {
                errors.push(`${fixtureName}: ${file.path} hat keine Code-Zeilen.`);
            }
            if (globalPaths.has(file.path)) {
                errors.push(`Pfad ${file.path} kommt in mehr als einer Fixture vor.`);
            }
            globalPaths.add(file.path);
        }

        if (entry.negativeControl && entry.expected.length !== 0) {
            errors.push(`${fixtureName}: Negativ-Kontrolle darf keine expected-Findings haben.`);
        }

        for (const expected of entry.expected) {
            if (!fixturePaths.has(expected.path)) {
                errors.push(
                    `${fixtureName}: expected-Pfad ${expected.path} existiert nicht im Diff.`,
                );
            }
            const ids = extractRuleIds(expected.ruleContains);
            if (ids.length === 0 && !/Condition \d+/.test(expected.ruleContains)) {
                errors.push(
                    `${fixtureName}: ruleContains "${expected.ruleContains}" nennt weder ` +
                    `Rule-ID noch Condition.`,
                );
            }
            const primary = primaryRuleId(expected.ruleContains);
            if (primary) plantedRuleIds.add(primary);
        }
    }

    const excludedIds = new Set(options.excludedRules.map((excluded) => excluded.ruleId));
    const uncoveredRuleIds = options.detectableRuleIds.filter(
        (ruleId) => !plantedRuleIds.has(ruleId) && !excludedIds.has(ruleId),
    );

    return {
        errors,
        plantedRuleIds: [...plantedRuleIds].sort(),
        uncoveredRuleIds,
    };
}
