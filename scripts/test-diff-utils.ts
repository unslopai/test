/**
 * Assertion-Suite für diff-utils + Inline-Comment-Partitionierung.
 *
 * Aufruf: npx tsx scripts/test-diff-utils.ts
 * Exit-Codes: 0 = alle Assertions grün, 1 = Fehlschlag.
 *
 * Deckt die beiden "Bulletproof"-Verträge ab:
 * 1. Trimming verändert NIE den Inhalt von '+'-Zeilen (nur ganze Dateien/Metadaten).
 * 2. Out-of-Hunk-Findings werden nie als Inline-Comment gepostet.
 */
import * as assert from 'node:assert';
import { parseHunkRanges, isLineWithinHunks, trimReviewableFiles } from '@/lib/pipeline/diff-utils';
import { partitionIssuesByAnchor } from '@/lib/pipeline/helpers';
import type { PullRequestFile } from '@/lib/github';
import type { PipelineIssue } from '@/lib/pipeline/types';

let assertionCount = 0;
function check(label: string, assertion: () => void): void {
    assertion();
    assertionCount++;
    console.log(`  ✅ ${label}`);
}

function makeFile(filename: string, patch: string): PullRequestFile {
    return { sha: '', filename, status: 'modified', additions: 0, deletions: 0, changes: 0, patch };
}

function makeIssue(path: string, line: number, endLine: number): PipelineIssue {
    return {
        rule: 'Condition 1 (Silent Error Swallowing)',
        severity: 'CRITICAL',
        path,
        line,
        endLine,
        exactQuote: 'console.log(err);',
        critique: 'test critique',
        source: 'test',
    };
}

// =============================================================================
// parseHunkRanges / isLineWithinHunks
// =============================================================================

console.log('\n[1] Hunk-Analyse');

const multiHunkPatch = [
    '@@ -4,6 +4,13 @@ export async function syncOrders() {',
    ' context line',
    '+added line',
    '@@ -40,3 +47,5 @@ export function helper() {',
    ' context',
    '+more',
].join('\n');

check('zwei Hunks mit korrekten Ranges', () => {
    assert.deepStrictEqual(parseHunkRanges(multiHunkPatch), [
        { newStart: 4, newEnd: 16 },
        { newStart: 47, newEnd: 51 },
    ]);
});

check('Hunk-Header ohne Zeilenanzahl (+5 @@) ergibt Ein-Zeilen-Range', () => {
    assert.deepStrictEqual(parseHunkRanges('@@ -1 +5 @@\n+x'), [{ newStart: 5, newEnd: 5 }]);
});

check('Zeile innerhalb/außerhalb der Hunks', () => {
    const hunks = parseHunkRanges(multiHunkPatch);
    assert.strictEqual(isLineWithinHunks(4, hunks), true);
    assert.strictEqual(isLineWithinHunks(16, hunks), true);
    assert.strictEqual(isLineWithinHunks(17, hunks), false);
    assert.strictEqual(isLineWithinHunks(47, hunks), true);
    assert.strictEqual(isLineWithinHunks(52, hunks), false);
});

check('@@-ähnliche Code-Zeile (kein Header) wird ignoriert', () => {
    assert.deepStrictEqual(parseHunkRanges('+const re = /@@ -1 +2 @@/;'), []);
});

// =============================================================================
// trimReviewableFiles
// =============================================================================

console.log('\n[2] Deterministisches Trimming');

check('kleine Dateien passieren unverändert (inkl. + Zeilen byte-identisch)', () => {
    const smallPatch = '@@ -1,2 +1,3 @@\n context\n+    const total = 1;  \n context2';
    const { trimmedFiles, omittedFilePaths } = trimReviewableFiles([makeFile('src/a.ts', smallPatch)]);
    assert.strictEqual(omittedFilePaths.length, 0);
    assert.strictEqual(trimmedFiles[0].patch, smallPatch);
});

check('Metadaten-Zeilen werden entfernt, Inhalt bleibt', () => {
    const patchWithMetadata = 'index 1111111..2222222 100644\n@@ -1,1 +1,2 @@\n context\n+added';
    const { trimmedFiles } = trimReviewableFiles([makeFile('src/b.ts', patchWithMetadata)]);
    assert.strictEqual(trimmedFiles[0].patch, '@@ -1,1 +1,2 @@\n context\n+added');
});

check('Datei > 40KB wird komplett ausgelassen, nie gekürzt', () => {
    const hugePatch = '@@ -1,1 +1,2 @@\n+' + 'x'.repeat(41 * 1024);
    const { trimmedFiles, omittedFilePaths } = trimReviewableFiles([
        makeFile('src/huge.ts', hugePatch),
        makeFile('src/small.ts', '@@ -1,1 +1,2 @@\n+ok'),
    ]);
    assert.deepStrictEqual(omittedFilePaths, ['src/huge.ts']);
    assert.strictEqual(trimmedFiles.length, 1);
    assert.strictEqual(trimmedFiles[0].filename, 'src/small.ts');
});

check('Gesamt-Cap 300KB: spätere Dateien werden ausgelassen', () => {
    const chunkPatch = '@@ -1,1 +1,2 @@\n+' + 'y'.repeat(35 * 1024); // ~35KB je Datei
    const manyFiles = Array.from({ length: 10 }, (_, fileIndex) =>
        makeFile(`src/file-${fileIndex}.ts`, chunkPatch));
    const { trimmedFiles, omittedFilePaths } = trimReviewableFiles(manyFiles);
    assert.strictEqual(trimmedFiles.length + omittedFilePaths.length, 10);
    assert.ok(trimmedFiles.length === 8, `expected 8 kept, got ${trimmedFiles.length}`);
    assert.ok(omittedFilePaths.includes('src/file-9.ts'));
});

// =============================================================================
// partitionIssuesByAnchor
// =============================================================================

console.log('\n[3] Inline-Comment-Partitionierung (Out-of-Hunk-Fix)');

const prFiles = [makeFile('src/order-sync.ts', multiHunkPatch)];

check('Finding im Hunk → anchored', () => {
    const { anchoredIssues, unanchoredIssues } = partitionIssuesByAnchor(
        [makeIssue('src/order-sync.ts', 10, 12)], prFiles);
    assert.strictEqual(anchoredIssues.length, 1);
    assert.strictEqual(unanchoredIssues.length, 0);
});

check('Finding außerhalb aller Hunks → unanchored (hätte den Review gekillt)', () => {
    const { anchoredIssues, unanchoredIssues } = partitionIssuesByAnchor(
        [makeIssue('src/order-sync.ts', 30, 30)], prFiles);
    assert.strictEqual(anchoredIssues.length, 0);
    assert.strictEqual(unanchoredIssues.length, 1);
});

check('Multiline-Finding, das eine Hunk-Grenze überschreitet → unanchored', () => {
    const { anchoredIssues, unanchoredIssues } = partitionIssuesByAnchor(
        [makeIssue('src/order-sync.ts', 15, 18)], prFiles);
    assert.strictEqual(anchoredIssues.length, 0);
    assert.strictEqual(unanchoredIssues.length, 1);
});

check('Finding in Datei, die nicht im PR ist → unanchored', () => {
    const { anchoredIssues, unanchoredIssues } = partitionIssuesByAnchor(
        [makeIssue('src/other.ts', 5, 5)], prFiles);
    assert.strictEqual(anchoredIssues.length, 0);
    assert.strictEqual(unanchoredIssues.length, 1);
});

check('gemischte Findings werden korrekt getrennt', () => {
    const { anchoredIssues, unanchoredIssues } = partitionIssuesByAnchor(
        [
            makeIssue('src/order-sync.ts', 5, 5),
            makeIssue('src/order-sync.ts', 99, 99),
            makeIssue('src/order-sync.ts', 48, 49),
        ],
        prFiles,
    );
    assert.strictEqual(anchoredIssues.length, 2);
    assert.strictEqual(unanchoredIssues.length, 1);
    assert.strictEqual(unanchoredIssues[0].line, 99);
});

console.log(`\n=== diff-utils: alle ${assertionCount} Checks bestanden ===`);
