/**
 * parseUnifiedDiff (CLI/MCP-Pfad): eine Datei ohne Hunk — Binärdatei oder
 * reine Modus-Änderung — hat wie bei der GitHub-API keinen Patch und zählt
 * weder für den Pre-Scan noch für den Hinweis auf ungelesene Dateitypen
 * (LANGUAGE_COVERAGE_SPEC §6.2).
 */
import { describe, expect, it, vi } from 'vitest';
import { isPrescanScannable, describeFilesWithoutModelReview } from '@/lib/pipeline/review-scope';
import { parseUnifiedDiff } from '@/lib/pipeline/steps/cli-diff-loader-step';
import { buildPipelineContext } from '@/lib/pipeline/testing/context-fixture';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const MIXED_LOCAL_DIFF = [
    'diff --git a/src/lib/worker.ts b/src/lib/worker.ts',
    'index 1111111..2222222 100644',
    '--- a/src/lib/worker.ts',
    '+++ b/src/lib/worker.ts',
    '@@ -1,2 +1,3 @@',
    ' export const retryLimit = 3;',
    '+export const retryDelayMs = 250;',
    'diff --git a/assets/logo.png b/assets/logo.png',
    'index 3333333..4444444 100644',
    'Binary files a/assets/logo.png and b/assets/logo.png differ',
    'diff --git a/cmd/server/main.go b/cmd/server/main.go',
    'old mode 100644',
    'new mode 100755',
    '',
].join('\n');

describe('parseUnifiedDiff — files without a hunk', () => {
    const parsedFiles = parseUnifiedDiff(MIXED_LOCAL_DIFF);
    const patchByPath = new Map(parsedFiles.map((parsedFile) => [parsedFile.filename, parsedFile.patch]));

    it('leaves the patch undefined for a binary file and a mode-only change', () => {
        expect(parsedFiles.map((parsedFile) => parsedFile.filename))
            .toEqual(['src/lib/worker.ts', 'assets/logo.png', 'cmd/server/main.go']);
        expect(patchByPath.get('src/lib/worker.ts')).toContain('+export const retryDelayMs = 250;');
        expect(patchByPath.get('assets/logo.png')).toBeUndefined();
        expect(patchByPath.get('cmd/server/main.go')).toBeUndefined();
    });

    it('keeps them out of the pre-scan and out of the unread-file-types notice', () => {
        const scannablePaths = parsedFiles.filter(isPrescanScannable).map((scannableFile) => scannableFile.filename);
        const typescriptFiles = parsedFiles.filter((parsedFile) => parsedFile.filename.endsWith('.ts'));

        expect(scannablePaths).toEqual(['src/lib/worker.ts']);
        expect(describeFilesWithoutModelReview(buildPipelineContext({
            prFiles: parsedFiles,
            reviewableFiles: typescriptFiles,
        }))).toBeNull();
    });
});
