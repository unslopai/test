/**
 * GitHubReporterStep — Postet das Review-Ergebnis als PR-Review auf GitHub.
 *
 * Konvertiert PipelineIssues zu Inline-Comments und postet den Review.
 * Behandelt auch den Abort-Fall (keine reviewbaren Dateien).
 * Persistenz liegt im nachgelagerten ResultPersisterStep.
 *
 * Zwei Identitäten (GITHUB_APP_SPEC.md §3):
 *  - 'app':   Bot. Das Merge-Gating trägt der Check Run, der Review ist immer
 *             ein neutrales COMMENT.
 *  - 'oauth': User. Kein Check Run möglich, deshalb REQUEST_CHANGES als Gate —
 *             inklusive des 422-Fallbacks für selbst geöffnete PRs.
 */
import {
    GitHubApiError,
    fetchReviewComments,
    postPRComment,
} from '@/lib/github';
import { supabase } from '@/lib/supabase';
import { postReviewIdempotently } from '@/lib/pipeline/review-posting';
import { extractErrorMessage } from '@/lib/errors';
import { appendAiDisclosure, isAiGeneratedRun } from '@/lib/ai-disclosure';
import { buildDeterministicOnlySummary, resolvePublishedSummary } from '@/lib/pipeline/final-summary';
import { describeNothingReviewed, resolveReviewOutcome } from '@/lib/pipeline/review-scope';
import { buildInlineComments, collectReportableIssues, formatReviewSummary, parseFindingMarker, partitionIssuesByAnchor } from '@/lib/pipeline/helpers';
import { describeFindingVerification } from '@unslop/shared/verification-format';
import { formatDraftPartialNotice, formatTimeBudgetNotice } from '@unslop/shared/degradation-notice';
import type { PullRequestReviewComment } from '@/lib/github';
import type { CascadeState, PipelineContext, PipelineIssue, PipelineStep } from '@/lib/pipeline/types';

export const githubReporterStep: PipelineStep = {
    id: 'github-reporter',
    displayName: 'GitHub Reporter',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        const reviewOutcome = resolveReviewOutcome(context);
        if (reviewOutcome === 'nothing_reviewed') {
            await postAbortComment(context);
            return context;
        }

        if (collectReportableIssues(context).length > 0) {
            await postReviewWithIssues(context);
        } else if (reviewOutcome === 'deterministic_only') {
            await postDeterministicOnlyComment(context);
        } else {
            await postApprovalComment(context);
        }

        return context;
    },
};

// =============================================================================
// Report Handlers
// =============================================================================

/** Ein ausgefallener Pre-Scan ist kein erledigter Lauf: kein grünes Häkchen (LANGUAGE_COVERAGE_SPEC §6.2). */
async function postAbortComment(context: PipelineContext): Promise<void> {
    const nothingReviewedNotice = describeNothingReviewed(context);
    const statusIcon = nothingReviewedNotice.kind === 'check_failed' ? '⚠️' : '✅';
    await postPRComment(
        context.githubToken,
        context.repoFullName,
        context.prNumber,
        `${statusIcon} **Anti-Slop Gatekeeper**: ${nothingReviewedNotice.reason}`,
    );

    console.log(`[GitHubReporter] Abort-Kommentar gepostet: ${nothingReviewedNotice.reason}`);
}

async function postReviewWithIssues(context: PipelineContext): Promise<void> {
    // Merge-Punkt der Lanes (pre_scanner_design.md §5.1): deterministische
    // prescanIssues + LLM-Issues. Anker-Basis sind prFiles, nicht
    // reviewableFiles — der Pre-Scanner findet auch in Dateien (YAML, py),
    // die der LLM-Review nie sieht.
    const reportableIssues = collectReportableIssues(context);
    // Out-of-Hunk-Findings dürfen nicht inline gepostet werden — GitHub lehnt
    // sonst den GESAMTEN Review ab. Sie wandern stattdessen in den Body.
    const { anchoredIssues, unanchoredIssues } = partitionIssuesByAnchor(
        reportableIssues,
        context.prFiles,
    );
    const inlineComments = buildInlineComments(anchoredIssues);
    const reviewBody = formatReviewSummary(
        reportableIssues,
        resolvePublishedSummary(context, reportableIssues),
        unanchoredIssues,
        context.omittedFiles,
    ) + buildModelReviewFooter(context, reportableIssues);

    const postedReviewId = await createGatekeeperReview(context, reviewBody, inlineComments);

    console.log(
        `[GitHubReporter] Review gepostet: ${inlineComments.length} Inline-Comments, ` +
        `${unanchoredIssues.length} unverankerte Findings im Body.`,
    );

    await persistFindingCommentMap(context, postedReviewId, anchoredIssues, unanchoredIssues);
}

/**
 * Postet den Findings-Review mit der Identität des jeweiligen Auth-Modus.
 *
 * Im App-Modus ist REQUEST_CHANGES bewusst NICHT mehr das Gate: das übernimmt
 * der Check Run (der als `required check` verankerbar ist). Der Review bleibt
 * neutral, damit der Bot dem Team nicht die Review-Anforderungen des PRs
 * durcheinanderbringt.
 */
async function createGatekeeperReview(
    context: PipelineContext,
    reviewBody: string,
    inlineComments: readonly PullRequestReviewComment[],
): Promise<number | null> {
    if (context.authMode === 'app') {
        return await postReviewIdempotently(
            context,
            reviewBody,
            inlineComments,
            'COMMENT',
        );
    }

    return await createReviewWithSelfAuthorFallback(context, reviewBody, inlineComments);
}

/**
 * Postet den Findings-Review als REQUEST_CHANGES — mit COMMENT-Fallback.
 *
 * Nur im OAuth-Modus: dort authentifizieren wir uns per User-OAuth, posten also
 * als der PR-Autor selbst. GitHub lehnt REQUEST_CHANGES (und APPROVE) auf
 * eigenen PRs mit 422 ab; nur COMMENT ist erlaubt. Der Fallback wiederholt
 * denselben Review-Body inklusive aller Inline-Comments, damit der
 * Gatekeeper-Block trotzdem im PR landet.
 */
async function createReviewWithSelfAuthorFallback(
    context: PipelineContext,
    reviewBody: string,
    inlineComments: readonly PullRequestReviewComment[],
): Promise<number | null> {
    try {
        return await postReviewIdempotently(
            context,
            reviewBody,
            inlineComments,
            'REQUEST_CHANGES',
        );
    } catch (reviewError: unknown) {
        if (!isSelfAuthoredPrRejection(reviewError)) {
            throw reviewError;
        }

        console.warn(
            `[GitHubReporter] REQUEST_CHANGES auf eigenem PR abgelehnt (422) — ` +
            `Fallback auf COMMENT-Review für ${context.repoFullName}#${context.prNumber}.`,
        );

        return await postReviewIdempotently(
            context,
            reviewBody,
            inlineComments,
            'COMMENT',
        );
    }
}

/** GitHub 422: "Can not request changes on your own pull request". */
function isSelfAuthoredPrRejection(reviewError: unknown): boolean {
    return reviewError instanceof GitHubApiError
        && reviewError.status === 422
        && reviewError.message.toLowerCase().includes('your own pull request');
}

// =============================================================================
// Comment-Map-Persistenz (MCP_SPEC §4.3, D7)
// =============================================================================

/**
 * Persistiert die Finding→GitHub-Comment-Map nach finding_comments, damit
 * `unslop_resolve_finding` den Review-Thread später auflösen kann.
 *
 * Fail-soft mit EIGENEM catch: der Review ist zu diesem Zeitpunkt gepostet —
 * eine fehlgeschlagene Map-Persistenz darf den Job nicht kippen; Recovery ist
 * der Weiterlauf ohne Map (das Finding bleibt ledger-auflösbar, nur nicht
 * GitHub-auflösbar), der Fehler wird laut geloggt.
 */
async function persistFindingCommentMap(
    context: PipelineContext,
    postedReviewId: number | null,
    anchoredIssues: readonly PipelineIssue[],
    unanchoredIssues: readonly PipelineIssue[],
): Promise<void> {
    if (!context.repositoryId) {
        return;
    }

    try {
        const commentIdByFindingId = await loadPostedCommentIds(context, postedReviewId);

        const findingCommentRows = [...anchoredIssues, ...unanchoredIssues]
            .filter((reportedIssue): reportedIssue is PipelineIssue & { id: string } =>
                typeof reportedIssue.id === 'string')
            .map((reportedIssue) => ({
                job_id: context.jobId,
                repository_id: context.repositoryId,
                pr_number: context.prNumber,
                finding_id: reportedIssue.id,
                github_comment_id: commentIdByFindingId.get(reportedIssue.id) ?? null,
            }));

        if (findingCommentRows.length === 0) {
            return;
        }

        const { error: mapInsertError } = await supabase
            .from('finding_comments')
            .upsert(findingCommentRows, { onConflict: 'job_id,finding_id' });
        if (mapInsertError) {
            throw new Error(mapInsertError.message);
        }

        console.log(
            `[GitHubReporter] Comment-Map persistiert: ${findingCommentRows.length} Findings, `
            + `${[...commentIdByFindingId.keys()].length} mit Inline-Comment-ID.`,
        );
    } catch (commentMapError: unknown) {
        console.error(
            `[GitHubReporter] Job ${context.jobId}: Comment-Map nicht persistierbar `
            + `(fail-soft, Review ist gepostet): ${extractErrorMessage(commentMapError)}`,
        );
    }
}

/** Liest die Inline-Comments des Reviews zurück und mappt sie über den Marker. */
async function loadPostedCommentIds(
    context: PipelineContext,
    postedReviewId: number | null,
): Promise<Map<string, number>> {
    const commentIdByFindingId = new Map<string, number>();
    if (postedReviewId === null) {
        return commentIdByFindingId;
    }

    const postedComments = await fetchReviewComments(
        context.githubToken,
        context.repoFullName,
        context.prNumber,
        postedReviewId,
    );

    for (const postedComment of postedComments) {
        const markedFindingId = parseFindingMarker(postedComment.body);
        if (markedFindingId) {
            commentIdByFindingId.set(markedFindingId, postedComment.id);
        }
    }

    return commentIdByFindingId;
}

/**
 * Kein Modell hat gelesen und der Pre-Scanner fand nichts (LANGUAGE_COVERAGE_SPEC
 * §6.2, E2): kein grünes Häkchen, kein „meets the quality standards“ — der
 * Kommentar nennt, was geprüft wurde und was nicht.
 */
async function postDeterministicOnlyComment(context: PipelineContext): Promise<void> {
    await postReviewIdempotently(
        context,
        `ℹ️ **Anti-Slop Gatekeeper**: ${buildDeterministicOnlySummary(context, [])}`,
        [],
        'COMMENT',
    );

    console.log('[GitHubReporter] Nur deterministisch geprüft, keine Findings — Hinweis-Kommentar gepostet.');
}

/**
 * Der Integrity Score misst, wie LLM-Claims die Verifikation überstehen. Ohne
 * Modell-Review gibt es keine Claims: der Block entfiele sonst auf „Confidence
 * verification was unavailable“, was nach einem Ausfall klingt. Die
 * KI-Kennzeichnung folgt ihrer eigenen Regel: nur wenn ein Modell lief, also
 * auch nicht beim Short-Circuit des Pre-Scanners (LEGAL_PAGES_SPEC §4a.3).
 */
function buildModelReviewFooter(context: PipelineContext, reportableIssues: readonly PipelineIssue[]): string {
    const reviewOutcome = resolveReviewOutcome(context);
    const scoreBlock = reviewOutcome === 'deterministic_only'
        ? ''
        : buildIntegrityScoreBlock(context.cascade, reportableIssues);
    return isAiGeneratedRun(reviewOutcome, context.llmSkipped) ? appendAiDisclosure(scoreBlock) : scoreBlock;
}

async function postApprovalComment(context: PipelineContext): Promise<void> {
    const omittedNote = context.omittedFiles.length > 0
        ? `\n\n_Not reviewed (size cap exceeded): ${context.omittedFiles.map((filePath) => `\`${filePath}\``).join(', ')}_`
        : '';

    await postReviewIdempotently(
        context,
        '✅ **Anti-Slop Gatekeeper**: No AI slop found. This code meets the quality standards.'
            + omittedNote
            // Der Satz ist ein Baustein, das Urteil dahinter hat ein Modell gefällt.
            + appendAiDisclosure(buildIntegrityScoreBlock(context.cascade, [])),
        [],
        'COMMENT',
    );

    console.log('[GitHubReporter] Kein Slop — Approval-Comment gepostet.');
}

// =============================================================================
// Cognitive Integrity Score Block (SPEC.md §6 — informativ, gated NIE den Check)
// =============================================================================

function buildIntegrityScoreBlock(cascade: CascadeState, reportableIssues: readonly PipelineIssue[]): string {
    const scoreBlockLines = ['', '---', ''];

    if (cascade.integrityScore !== null) {
        scoreBlockLines.push(`🧠 **Cognitive Integrity Score: ${cascade.integrityScore}/100**`);
        scoreBlockLines.push('');
        scoreBlockLines.push(describeVerificationPath(cascade, reportableIssues));
    } else {
        scoreBlockLines.push('🧠 **Cognitive Integrity Score: n/a**');
        scoreBlockLines.push('');
        scoreBlockLines.push('_Confidence verification was unavailable for this review._');
    }

    for (const degradationNotice of collectDegradationNotices(cascade)) {
        scoreBlockLines.push('');
        scoreBlockLines.push(degradationNotice);
    }

    return scoreBlockLines.join('\n');
}

/**
 * Ein Zeit-Skip nennt die Stufen (DEADLINE_GUARD_SPEC §3.4), ein halber Draft
 * die nicht geprüften Dateien (LARGE_DIFF_RECALL_SPEC Option A) — die
 * Dateiliste bleibt bewusst ohne Kursiv-Markup, damit Unterstriche in Pfaden
 * das Markdown nicht kippen. Alle übrigen Degradationen behalten den
 * generischen Satz.
 */
function collectDegradationNotices(cascade: CascadeState): string[] {
    const timeBudgetNotice = formatTimeBudgetNotice(cascade.skippedStages);
    const draftPartialNotice = formatDraftPartialNotice(cascade.draftUnreviewedFiles);
    const degradationNotices: string[] = [];
    if (timeBudgetNotice) degradationNotices.push(`_⚠️ ${timeBudgetNotice}_`);
    if (draftPartialNotice) degradationNotices.push(`⚠️ ${draftPartialNotice}`);
    if (degradationNotices.length === 0 && cascade.degradations.length > 0) {
        degradationNotices.push('_⚠️ Reduced confidence mode: parts of the verification cascade were unavailable._');
    }
    return degradationNotices;
}

/**
 * Die Bilanz zählt den Verifikationsstatus der Findings (SPEC.md §6) statt
 * pauschal "every finding survived" zu behaupten — das stand bis 2026-09-17
 * auch neben UNCERTAIN-downgraded Findings.
 */
function describeVerificationPath(cascade: CascadeState, reportableIssues: readonly PipelineIssue[]): string {
    const verificationSummary = describeFindingVerification(reportableIssues);
    if (cascade.route === 'pro-direct') {
        return '_This pull request exceeded complexity thresholds and was reviewed end-to-end by the '
            + `strongest model — ${verificationSummary}._`;
    }
    return `_${capitalize(verificationSummary)}${describeEscalationSuffix(cascade)}._`;
}

/**
 * Eskaliert heißt nicht immer "Low-Confidence-Findings nachgeprüft": hat nur
 * die Second Opinion ein Modell gerufen (escalationReason 'second_opinion'),
 * wurde kein Finding eskaliert — sie hat untererfasste Dateien nachgeprüft
 * (Live-Receipt 2026-09-26, unslopai/test#16: die alte Copy behauptete dort
 * eine Eskalation, die nie stattfand).
 */
function describeEscalationSuffix(cascade: CascadeState): string {
    if (!cascade.escalated) return '';
    return cascade.escalationReason === 'second_opinion'
        ? '; a stronger model re-reviewed under-reported files as a second opinion'
        : '; low-confidence findings were escalated to a stronger model';
}

function capitalize(sentence: string): string {
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
