/**
 * Second-Opinion-Trigger (LLM_LANE_QUALITY_SPEC §4.2): Klassifikator,
 * T1/T2-Auswertung, Token-Deckel und Dedupe — alles pure Logik ohne LLM.
 */
import { describe, expect, it } from 'vitest';
import {
    SECOND_OPINION_GATES,
    dropDuplicateFindings,
    evaluateSecondOpinionTrigger,
    isTestFilePath,
} from '@/lib/pipeline/second-opinion';
import {
    buildPipelineContext,
    buildPullRequestFile,
    buildReviewIssue,
} from '@/lib/pipeline/testing/context-fixture';

describe('isTestFilePath', () => {
    it.each([
        'src/auth/login.test.ts',
        'src/auth/login.spec.tsx',
        'internal/ledger/ledger_test.go',
        'services/billing/charge_test.py',
        'services/billing/test_charges.py',
        'src/__tests__/helpers.ts',
        'tests/fixtures/user.ts',
        'packages/cli/test/run.js',
    ])('erkennt %s als Test-Datei', (testPath) => {
        expect(isTestFilePath(testPath)).toBe(true);
    });

    it.each([
        'src/pages/contest.ts',
        'internal/notary/attest.go',
        'services/protest.py',
        'src/testing/harness.ts',
        'src/latest/index.ts',
        'src/auth/login.ts',
    ])('erkennt %s NICHT als Test-Datei', (productionPath) => {
        expect(isTestFilePath(productionPath)).toBe(false);
    });
});

describe('evaluateSecondOpinionTrigger — T1 test-gap', () => {
    const testHeavyFiles = [
        buildPullRequestFile({ filename: 'tests/payments/iban.test.ts' }),
        buildPullRequestFile({ filename: 'tests/payments/refund.test.ts' }),
        buildPullRequestFile({ filename: 'src/payments/iban.ts' }),
    ];

    it('feuert auf einem test-lastigen Diff ohne Test-Findings', () => {
        const trigger = evaluateSecondOpinionTrigger(buildPipelineContext({
            reviewableFiles: testHeavyFiles,
            issues: [buildReviewIssue({ path: 'src/payments/iban.ts' })],
        }));
        expect(trigger?.reasons).toEqual(['test-gap']);
        expect(trigger?.targetFiles.map((file) => file.filename)).toEqual([
            'tests/payments/iban.test.ts',
            'tests/payments/refund.test.ts',
        ]);
    });

    it('zielt bei Teil-Abdeckung NUR auf die Test-Dateien ohne Finding (der r17-Fall)', () => {
        const trigger = evaluateSecondOpinionTrigger(buildPipelineContext({
            reviewableFiles: testHeavyFiles,
            issues: [buildReviewIssue({ path: 'tests/payments/iban.test.ts' })],
            prescanIssues: [],
        }));
        expect(trigger?.reasons).toEqual(['test-gap']);
        expect(trigger?.targetFiles.map((file) => file.filename)).toEqual([
            'tests/payments/refund.test.ts',
        ]);
    });

    it('feuert NICHT, wenn jede Test-Datei bereits ein Finding aus einer der Lanes hat', () => {
        expect(evaluateSecondOpinionTrigger(buildPipelineContext({
            reviewableFiles: testHeavyFiles,
            issues: [buildReviewIssue({ path: 'tests/payments/iban.test.ts' })],
            prescanIssues: [buildReviewIssue({ path: 'tests/payments/refund.test.ts', source: 'pre-scanner' })],
        }))).toBeNull();
    });

    it('feuert NICHT unter der Test-Anteils-Schwelle', () => {
        expect(evaluateSecondOpinionTrigger(buildPipelineContext({
            reviewableFiles: [
                buildPullRequestFile({ filename: 'tests/payments/iban.test.ts' }),
                buildPullRequestFile({ filename: 'src/payments/a.ts' }),
                buildPullRequestFile({ filename: 'src/payments/b.ts' }),
            ],
        }))).toBeNull();
    });
});

describe('evaluateSecondOpinionTrigger — T2 prescan-divergence ist abgeschaltet (LARGE_DIFF_RECALL_SPEC §9)', () => {
    // Der Prod-Fall von unslopai/test#16: 43 Prescan-Findings, Draft 0 — weil der
    // Draft die Tupel per <already_flagged> NICHT erneut melden soll. Das ist
    // Compliance, keine Divergenz, und darf keine Pro-Eskalation mehr kosten.
    const manyPrescanIssues = Array.from({ length: 43 }, (_, issueIndex) => buildReviewIssue({
        path: `src/lib/file-${issueIndex}.ts`, source: 'pre-scanner',
    }));

    it('feuert NICHT mehr, wenn der Prescan viel findet und der Draft nichts', () => {
        expect(evaluateSecondOpinionTrigger(buildPipelineContext({
            reviewableFiles: manyPrescanIssues.map((issue) => buildPullRequestFile({ filename: issue.path })),
            issues: [],
            prescanIssues: manyPrescanIssues,
        }))).toBeNull();
    });

    it('kennt keine Prescan-Schwelle mehr — die Gates tragen nur T1 und den Token-Deckel', () => {
        expect(Object.keys(SECOND_OPINION_GATES).sort()).toEqual(['maxSubsetTokens', 'testFileShareThreshold']);
    });

    it('T1 bleibt unberührt: ein test-lastiger Diff mit Prescan-Findings feuert weiter nur als test-gap', () => {
        const trigger = evaluateSecondOpinionTrigger(buildPipelineContext({
            reviewableFiles: [
                buildPullRequestFile({ filename: 'tests/payments/iban.test.ts' }),
                buildPullRequestFile({ filename: 'src/payments/iban.ts' }),
            ],
            issues: [],
            prescanIssues: manyPrescanIssues,
        }));
        expect(trigger?.reasons).toEqual(['test-gap']);
        expect(trigger?.targetFiles.map((file) => file.filename)).toEqual(['tests/payments/iban.test.ts']);
    });
});

describe('evaluateSecondOpinionTrigger — Token-Deckel', () => {
    it('laesst Dateien ueber dem Subset-Budget ehrlich aus', () => {
        const oversizedPatch = 'x'.repeat((SECOND_OPINION_GATES.maxSubsetTokens + 1) * 4);
        const trigger = evaluateSecondOpinionTrigger(buildPipelineContext({
            reviewableFiles: [
                buildPullRequestFile({ filename: 'tests/huge.test.ts', patch: oversizedPatch }),
                buildPullRequestFile({ filename: 'tests/small.test.ts', patch: '+expect(1).toBe(1);' }),
            ],
        }));
        expect(trigger?.targetFiles.map((file) => file.filename)).toEqual(['tests/small.test.ts']);
        expect(trigger?.truncatedFileCount).toBe(1);
    });

    it('liefert null statt eines leeren Subsets, wenn alles ueber dem Deckel liegt', () => {
        const oversizedPatch = 'x'.repeat((SECOND_OPINION_GATES.maxSubsetTokens + 1) * 4);
        expect(evaluateSecondOpinionTrigger(buildPipelineContext({
            reviewableFiles: [buildPullRequestFile({ filename: 'tests/huge.test.ts', patch: oversizedPatch })],
        }))).toBeNull();
    });
});

describe('dropDuplicateFindings', () => {
    it('verwirft Kandidaten, deren Regel+Datei bereits gemeldet ist — auch bei abweichendem Titel-Suffix', () => {
        const surviving = dropDuplicateFindings(
            [
                buildReviewIssue({ rule: 'SEC-001 (Unbounded copy)', path: 'src/a.c' }),
                buildReviewIssue({ rule: 'SEC-002 (Format string)', path: 'src/a.c' }),
            ],
            [buildReviewIssue({ rule: 'SEC-001 (Banned libc API)', path: 'src/a.c' })],
        );
        expect(surviving.map((issue) => issue.rule)).toEqual(['SEC-002 (Format string)']);
    });

    it('unterscheidet Condition-Nummern und Dateien', () => {
        const surviving = dropDuplicateFindings(
            [
                buildReviewIssue({ rule: 'Condition 11 (JSX nesting)', path: 'src/App.tsx' }),
                buildReviewIssue({ rule: 'Condition 3 (Lexical Slop)', path: 'src/App.tsx' }),
                buildReviewIssue({ rule: 'Condition 3 (Lexical Slop)', path: 'src/Other.tsx' }),
            ],
            [buildReviewIssue({ rule: 'Condition 3 (Lexical Slop)', path: 'src/App.tsx' })],
        );
        expect(surviving.map((issue) => `${issue.rule}@${issue.path}`)).toEqual([
            'Condition 11 (JSX nesting)@src/App.tsx',
            'Condition 3 (Lexical Slop)@src/Other.tsx',
        ]);
    });
});
