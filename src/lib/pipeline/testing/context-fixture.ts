/**
 * Test-Fixtures für die Cascade-Tests (SPEC.md §11).
 *
 * Baut vollständige, typsichere Pipeline-Objekte mit sprechenden Defaults;
 * Tests übersteuern nur die Felder, die für das jeweilige Szenario tragen.
 * Wird ausschließlich aus *.test.ts importiert — nie aus Produktions-Code.
 */
import { DEFAULT_CASCADE_CONFIG, INITIAL_CASCADE_STATE } from '@/lib/pipeline/defaults';
import { DEFAULT_PRESCAN_CONFIG } from '@unslop/prescan';
import type { PullRequestFile } from '@/lib/github';
import type {
    CascadeState,
    ClaimVerdict,
    PipelineContext,
    PipelineIssue,
} from '@/lib/pipeline/types';

export function buildReviewIssue(overrides: Partial<PipelineIssue> = {}): PipelineIssue {
    return {
        rule: 'Condition 3 (Lexical Slop)',
        severity: 'CRITICAL',
        path: 'src/lib/example.ts',
        line: 42,
        endLine: 42,
        exactQuote: 'const data = fetchData();',
        critique: 'Generic variable name violates the naming rules.',
        source: 'draft-reviewer',
        ...overrides,
    };
}

export function buildClaimVerdict(overrides: Partial<ClaimVerdict> = {}): ClaimVerdict {
    return {
        claimId: 'c1',
        verificationQuestion: 'Does the quoted identifier violate the no-generic-names rule?',
        blindAnswer: 'The identifier carries no domain meaning and violates the rule.',
        verdict: 'CONFIRMED',
        confidence: 90,
        phase: 'flash-verify',
        ...overrides,
    };
}

export function buildCascadeState(overrides: Partial<CascadeState> = {}): CascadeState {
    return { ...INITIAL_CASCADE_STATE, ...overrides };
}

export function buildPullRequestFile(overrides: Partial<PullRequestFile> = {}): PullRequestFile {
    return {
        sha: 'filesha-under-test',
        filename: 'src/lib/example.ts',
        status: 'modified',
        additions: 5,
        deletions: 1,
        changes: 6,
        patch: '@@ -40,3 +40,5 @@\n+const data = fetchData();',
        ...overrides,
    };
}

export function buildPipelineContext(overrides: Partial<PipelineContext> = {}): PipelineContext {
    return {
        jobId: 'job-under-test',
        repoFullName: 'unslopai/test',
        prNumber: 7,
        headSha: 'headsha-under-test',
        githubToken: '',
        // Default ist der Legacy-Pfad: die Bestandstests prüfen genau ihn.
        authMode: 'oauth',
        repositoryId: 'repo-under-test',
        ownerUserId: 'owner-under-test',
        // Ohne Budget: Bestandstests prüfen Stufen-Logik, nicht die Job-Uhr.
        jobStartedAtMs: 0,
        deadlineAtMs: null,
        prFiles: [],
        reviewableFiles: [],
        combinedDiff: '',
        omittedFiles: [],
        issues: [],
        reviewSummary: '',
        ragPromptSection: '',
        practicesPromptSection: '',
        detectedEcosystems: null,
        promptConfig: {
            activeConditionIds: [],
            filePaths: [],
            overrideSmartDetection: false,
        },
        tokenUsage: null,
        cascade: INITIAL_CASCADE_STATE,
        cascadeConfig: DEFAULT_CASCADE_CONFIG,
        prescanConfig: DEFAULT_PRESCAN_CONFIG,
        prescanIssues: [],
        prescanStats: null,
        llmSkipped: false,
        shouldAbort: false,
        ...overrides,
    };
}
