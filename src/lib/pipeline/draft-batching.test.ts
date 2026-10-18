/**
 * Datei-Batch-Chunking des Drafts (LARGE_DIFF_RECALL_SPEC Option A, §9):
 * greedy in Diff-Reihenfolge, eine überlange Datei allein, unter der Grenze
 * kein Chunking, <already_flagged> nur für die Batch-Dateien.
 */
import { describe, expect, it } from 'vitest';
import {
    estimateDiffTokens,
    packFilesIntoDraftBatches,
    resolveDraftBatches,
    selectPrescanIssuesForBatch,
} from '@/lib/pipeline/draft-batching';
import { buildCombinedDiff } from '@/lib/pipeline/helpers';
import { buildPullRequestFile, buildReviewIssue } from '@/lib/pipeline/testing/context-fixture';

/** Eine Datei, deren Diff-Text (inkl. Header) exakt `tokenCount` geschätzte Tokens hat. */
function buildFileWithTokens(filename: string, tokenCount: number) {
    const headerLength = buildCombinedDiff([buildPullRequestFile({ filename, patch: '' })]).length;
    const patch = 'x'.repeat(tokenCount * 4 - headerLength);
    return buildPullRequestFile({ filename, patch });
}

describe('packFilesIntoDraftBatches', () => {
    it('packt greedy in Diff-Reihenfolge und beginnt einen neuen Batch, sobald die Grenze reißen würde', () => {
        const reviewableFiles = [
            buildFileWithTokens('src/a.ts', 40),
            buildFileWithTokens('src/b.ts', 50),
            buildFileWithTokens('src/c.ts', 20),
            buildFileWithTokens('src/d.ts', 90),
            buildFileWithTokens('src/e.ts', 10),
        ];

        const draftBatches = packFilesIntoDraftBatches(reviewableFiles, 100);

        expect(draftBatches.map((draftBatch) => draftBatch.files.map((file) => file.filename))).toEqual([
            ['src/a.ts', 'src/b.ts'],
            ['src/c.ts'],
            ['src/d.ts', 'src/e.ts'],
        ]);
        expect(draftBatches.map((draftBatch) => draftBatch.batchIndex)).toEqual([0, 1, 2]);
        // Der Batch-Diff ist das Produktionsformat der enthaltenen Dateien.
        expect(draftBatches[0].diffText).toBe(buildCombinedDiff(reviewableFiles.slice(0, 2)));
        // Die Schätzung zählt den Header mit: a (40) + b (50) + Trenner "\n\n".
        expect(draftBatches[0].estimatedTokens).toBe(estimateDiffTokens(draftBatches[0].diffText));
        expect(draftBatches.every((draftBatch) => draftBatch.estimatedTokens <= 101)).toBe(true);
    });

    it('stellt eine Datei über der Grenze allein, ohne sie zu zerschneiden', () => {
        const oversizedFile = buildFileWithTokens('src/huge.ts', 250);
        const reviewableFiles = [buildFileWithTokens('src/a.ts', 30), oversizedFile, buildFileWithTokens('src/z.ts', 30)];

        const draftBatches = packFilesIntoDraftBatches(reviewableFiles, 100);

        expect(draftBatches.map((draftBatch) => draftBatch.files.map((file) => file.filename))).toEqual([
            ['src/a.ts'],
            ['src/huge.ts'],
            ['src/z.ts'],
        ]);
        expect(draftBatches[1].files[0].patch).toBe(oversizedFile.patch);
    });

    it('liefert für eine leere Dateiliste keine Batches', () => {
        expect(packFilesIntoDraftBatches([], 100)).toEqual([]);
    });
});

describe('resolveDraftBatches', () => {
    it('chunkt nicht, solange der Diff die Grenze nicht überschreitet (Einzel-Call wie bisher)', () => {
        const reviewableFiles = [buildFileWithTokens('src/a.ts', 60), buildFileWithTokens('src/b.ts', 39)];
        const combinedDiff = buildCombinedDiff(reviewableFiles);
        expect(estimateDiffTokens(combinedDiff)).toBe(100);

        expect(resolveDraftBatches(reviewableFiles, combinedDiff, 100)).toBeNull();
    });

    it('chunkt, sobald die Dateien zusammen die Grenze reißen', () => {
        const reviewableFiles = [buildFileWithTokens('src/a.ts', 60), buildFileWithTokens('src/b.ts', 41)];
        const combinedDiff = buildCombinedDiff(reviewableFiles);
        expect(estimateDiffTokens(combinedDiff)).toBe(102);

        const draftBatches = resolveDraftBatches(reviewableFiles, combinedDiff, 100);

        expect(draftBatches?.map((draftBatch) => draftBatch.files.map((file) => file.filename))).toEqual([
            ['src/a.ts'],
            ['src/b.ts'],
        ]);
    });

    it('bleibt beim Einzel-Call, wenn der Diff über der Grenze liegt, aber nur aus einer Datei besteht', () => {
        const reviewableFiles = [buildFileWithTokens('src/huge.ts', 300)];

        expect(resolveDraftBatches(reviewableFiles, buildCombinedDiff(reviewableFiles), 100)).toBeNull();
    });
});

describe('selectPrescanIssuesForBatch', () => {
    it('behält nur die <already_flagged>-Tupel der Batch-Dateien, in Prescan-Reihenfolge', () => {
        const prescanIssues = [
            buildReviewIssue({ path: 'src/b.ts', line: 3, source: 'pre-scanner' }),
            buildReviewIssue({ path: 'src/a.ts', line: 7, source: 'pre-scanner' }),
            buildReviewIssue({ path: 'src/c.ts', line: 9, source: 'pre-scanner' }),
            buildReviewIssue({ path: 'src/a.ts', line: 12, source: 'pre-scanner' }),
        ];
        const batchFiles = [buildPullRequestFile({ filename: 'src/a.ts' }), buildPullRequestFile({ filename: 'src/c.ts' })];

        const batchPrescanIssues = selectPrescanIssuesForBatch(prescanIssues, batchFiles);

        expect(batchPrescanIssues.map((issue) => `${issue.path}:${issue.line}`)).toEqual([
            'src/a.ts:7',
            'src/c.ts:9',
            'src/a.ts:12',
        ]);
    });
});
