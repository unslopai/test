/**
 * "@unslop/shared/node" — Runtime-Helpers für Node-Clients (CLI + MCP-Server).
 *
 * Bewusst als eigener Subpath (MCP_SPEC.md §3.1): der Root-Export "."
 * bleibt types-only und isomorph; hier liegt die explizite Runtime-Fläche
 * (node:fs, node:child_process). Published Packages (CLI, MCP) bundeln
 * diese Quelle per esbuild — @unslop/shared selbst wird nie veröffentlicht.
 */
export {
    DEFAULT_BASE_URL,
    DEFAULT_REROLL_LIMIT,
    configFilePath,
    loadConfig,
    resolveRerollLimit,
    saveConfig,
} from './credentials.js';
export type { CliConfig } from './credentials.js';

export {
    ApiError,
    connectRepo,
    fetchRepoStatus,
    fetchScanStatus,
    pollUntilDone,
    submitFindingResolution,
    submitPrReview,
    submitScan,
    waitForRepoActive,
} from './api-client.js';
export type { FindingResolutionResponse, PrReviewSubmitResponse } from './api-client.js';

export {
    GitError,
    assertInsideWorkTree,
    computeDiff,
    isWorkingTreeDirty,
    resolveGitRoot,
    resolveHeadSha,
    resolveMergeBase,
    resolveRepoFullName,
} from './git.js';
export { buildLocalRepoContext } from './repo-context-local.js';
export type { RepoContextPackage } from '../repo-context.js';
export type { DiffOptions } from './git.js';

export { HIGH_ENTROPY_PATTERN_CLASS, classifySecretText, findSecretsInDiff } from './secret-filter.js';
export type { SecretMatch } from './secret-filter.js';

export {
    MAX_DIFF_UPLOAD_BYTES,
    SecretUploadBlockedError,
    findDiffUploadRefusal,
    findWirePayloadSecret,
} from './diff-upload-guard.js';
export type { DiffUploadRefusal, WirePayloadValue } from './diff-upload-guard.js';

// resolveWithinRoot und verifyAnchor werden nur für die Parity-Tests der
// Extension-Kopien (pathSafety.test.ts, matching.test.ts) exportiert —
// Produktions-Consumer gehen über applyFixes.
export { applyFixes, resolveWithinRoot, verifyAnchor } from './fix-apply.js';
export type {
    FindingAnchor,
    FixApplyOptions,
    FixOutcome,
    FixReport,
    FixStatus,
    MatchVerdict,
} from './fix-apply.js';

export { sanitizeModelText } from './sanitize.js';

// Re-Export für die CLI: das Modul ist pure und lebt auf Package-Ebene,
// weil App-Code (Next/Turbopack) diesen /node-Entry nicht bundeln kann
// (die .js-Relativimporte der Node-Module lösen dort nicht auf) — der
// Build-Bruch hinter dem gescheiterten Deploy dpl_BbFo6vTs (2026-08-26).
export { formatOccurrenceLineRefs } from '../occurrence-format.js';
export type { OccurrenceLineRange } from '../occurrence-format.js';

// Dito: Verifikations-Bilanz der Score-Tagline (SPEC.md §6) — pure, wird
// von CLI (Terminal-Tagline) und Backend (GitHub-Block) geteilt.
export { countFindingVerifications, describeFindingVerification } from '../verification-format.js';
export {
    formatDraftPartialNotice,
    formatPrescanUnavailableNotice,
    formatRepoContextNotice,
    formatTimeBudgetNotice,
} from '../degradation-notice.js';
export type { VerificationCounts, VerifiedFinding } from '../verification-format.js';
