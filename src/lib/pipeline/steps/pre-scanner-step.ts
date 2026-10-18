/**
 * PreScannerStep — deterministische Findings VOR jedem LLM-Call
 * (pre_scanner_design.md; PROC-001/PROC-003).
 *
 * Dünner HTTP-Client: Inhalte beschaffen, den Scan an POST /api/internal/prescan
 * delegieren (eigene Invocation — die Engines dürfen NIE mit der Vertex-Kaskade
 * eine Instance teilen, ROADMAP §1b OOM), Findings auf PipelineIssues mappen —
 * in die SEPARATE prescanIssues-Lane, die der claim-verifier strukturell nie
 * sieht. Dieses Modul importiert @unslop/prescan nur als Typ.
 *
 * Soft-Launch Fail-Safe Gate (§5.4): JEDER Fehler dieses Steps wird hier
 * absorbiert; das Review läuft dann ohne deterministische Findings weiter.
 * Der Pre-Scanner kann nie der Grund sein, dass ein Job auf 'error' geht.
 */
import { extractErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { assignFindingIds } from '@/lib/pipeline/helpers';
import { capRepeatedRuleHits } from '@/lib/pipeline/prescan-hit-cap';
import { isPrescanScannable } from '@/lib/pipeline/review-scope';
import { loadCompanionFiles } from '@/lib/prescan/companion-loader';
import { loadPrescanFiles } from '@/lib/prescan/file-content-loader';
import { requestInternalPrescan } from '@/lib/prescan/internal-client';
import type { PrescanFinding } from '@unslop/prescan';
import type { PipelineContext, PipelineIssue, PipelineStep } from '@/lib/pipeline/types';

export const preScannerStep: PipelineStep = {
    id: 'pre-scanner',
    displayName: 'Deterministic Pre-Scanner',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) return context;

        try {
            return await runPrescanStep(context);
        } catch (prescanError: unknown) {
            // [MAINT-001]: laut, mit Job-Kontext, UND als degraded persistiert —
            // nie still geschluckt. Die LLM-Pipeline läuft unverändert weiter.
            console.error(
                `[PreScanner] Job ${context.jobId}: Pre-Scan fehlgeschlagen — Review läuft `
                + `ohne deterministische Findings weiter: ${extractErrorMessage(prescanError)}`,
            );
            return {
                ...context,
                prescanIssues: [],
                // Ohne reviewbare Datei gibt es nichts, was die LLM-Steps lesen
                // könnten: der Skip bleibt, und `resolveReviewOutcome` macht aus
                // dem degradierten Lauf ein ehrliches „nichts geprüft“.
                llmSkipped: isDeterministicOnly(context),
                prescanStats: {
                    degraded: true,
                    degradedReason: extractErrorMessage(prescanError),
                    findingsCount: 0,
                    criticalCount: 0,
                    rulesEvaluated: 0,
                    rulesDisabled: [],
                    filesScanned: 0,
                    filesSkipped: [],
                    skippedChecks: [{ ruleId: '*', reason: 'step-failure' }],
                    llmSkipped: false,
                    durationMs: 0,
                    engineVersions: null,
                },
            };
        }
    },
};

async function runPrescanStep(context: PipelineContext): Promise<PipelineContext> {
    const scannableFiles = context.prFiles.filter(isPrescanScannable);

    const prescanFiles = await loadPrescanFiles({
        githubToken: context.githubToken,
        repoFullName: context.repoFullName,
        headSha: context.headSha,
        files: scannableFiles,
        maxFileBytes: context.prescanConfig.maxFileBytes,
    });

    // Begleitdateien (v4, SEC-019): next.config.* neben einer Next-Middleware —
    // der Core sieht nur den Diff und wuesste sonst nichts von Headern in next.config.
    const companionFiles = await loadCompanionFiles({
        githubToken: context.githubToken,
        repoFullName: context.repoFullName,
        headSha: context.headSha,
        scannedPaths: prescanFiles.map((file) => file.path),
    });

    const prescanResult = await requestInternalPrescan({
        files: prescanFiles,
        companionFiles,
        prescanConfig: context.prescanConfig,
        repoFullName: context.repoFullName,
        headSha: context.headSha,
    });

    const uncappedIssues = prescanResult.findings.map(mapFindingToIssue);
    const criticalCount = uncappedIssues.filter((issue) => issue.severity === 'CRITICAL').length;
    // E4: ab dem vierten Treffer derselben Regel ein Sammelfinding. Die Stats
    // zählen weiter jeden Treffer, der Short-Circuit rechnet mit allen CRITICALs.
    const prescanIssues = capRepeatedRuleHits(uncappedIssues);

    const prescanStats = {
        degraded: false,
        degradedReason: null,
        findingsCount: uncappedIssues.length,
        criticalCount,
        rulesEvaluated: prescanResult.rulesEvaluated,
        rulesDisabled: prescanResult.rulesDisabled,
        filesScanned: prescanResult.filesScanned,
        filesSkipped: prescanResult.filesSkipped,
        skippedChecks: prescanResult.skippedChecks,
        llmSkipped: false,
        durationMs: prescanResult.durationMs,
        engineVersions: prescanResult.engineVersions,
    } satisfies NonNullable<PipelineContext['prescanStats']>;

    // Early Partial Result (MCP_SPEC.md §4.1, D4): die deterministischen
    // Findings werden SOFORT sichtbar gemacht — der Poll-Endpoint serviert sie
    // als phase 'deterministic', während die LLM-Kaskade noch läuft.
    await writePartialResult(context.jobId, prescanIssues, prescanStats, isDeterministicOnly(context));

    // Short-Circuit (§5.3, config-gated, default off): genug deterministische
    // CRITICALs ⇒ Zero-Token-Pfad. Nur FINDINGS dürfen den LLM-Review skippen —
    // eine Degradation (Fail-Safe-Pfad oben) erzwingt immer llmSkipped: false.
    const shortCircuitConfig = context.prescanConfig.shortCircuit;
    const shortCircuited = shortCircuitConfig.mode === 'critical'
        && criticalCount >= shortCircuitConfig.minCriticalFindings;
    // Ohne reviewbare Datei (LANGUAGE_COVERAGE_SPEC §6.2) hat der Diff-Loader
    // den Skip schon gesetzt; er gilt unabhängig vom Short-Circuit weiter.
    const llmSkipped = shortCircuited || isDeterministicOnly(context);

    console.log(
        `[PreScanner] Job ${context.jobId}: ${uncappedIssues.length} deterministische Findings `
        + `(${criticalCount} CRITICAL) in ${prescanResult.filesScanned} Dateien, `
        + `${prescanResult.durationMs}ms, ${prescanResult.skippedChecks.length} skipped checks`
        + `${shortCircuited ? ' — SHORT-CIRCUIT: LLM-Steps werden übersprungen.' : '.'}`,
    );

    return {
        ...context,
        prescanIssues,
        llmSkipped,
        reviewSummary: shortCircuited && !isDeterministicOnly(context)
            ? `LLM review skipped: ${criticalCount} critical structural violations found `
                + 'by the deterministic pre-scanner. Fix these first.'
            : context.reviewSummary,
        prescanStats: { ...prescanStats, llmSkipped },
    };
}

/**
 * Schreibt das Prescan-Teilergebnis nach review_jobs.partial_result (§4.1).
 *
 * Fail-soft mit EIGENEM catch: ein fehlgeschlagener Partial-Write darf weder
 * den Job failen noch (via äußerem Fail-Safe-Gate) die gerade gewonnenen
 * Findings verwerfen — Recovery ist der Weiterlauf ohne Partial; das
 * terminale Ergebnis kommt unverändert vom result-persister.
 * `result` bleibt exklusiv dem result-persister vorbehalten — hier wird
 * ausschließlich partial_result geschrieben, damit es genau einen
 * autoritativen Terminal-Write gibt.
 */
async function writePartialResult(
    jobId: string,
    prescanIssues: readonly PipelineIssue[],
    prescanStats: NonNullable<PipelineContext['prescanStats']>,
    deterministicOnly: boolean,
): Promise<void> {
    try {
        const issuesWithIds = assignFindingIds(prescanIssues);
        const { error: partialWriteError } = await supabase
            .from('review_jobs')
            .update({
                partial_result: {
                    phase: 'deterministic',
                    review: {
                        has_slop: issuesWithIds.length > 0,
                        issues: issuesWithIds,
                        summary: deterministicOnly
                            ? `${issuesWithIds.length} deterministic findings; no model review for this change.`
                            : `${issuesWithIds.length} deterministic findings; LLM analysis running.`,
                    },
                    prescan: prescanStats,
                },
            })
            .eq('id', jobId);
        if (partialWriteError) {
            throw new Error(partialWriteError.message);
        }
    } catch (partialWriteError: unknown) {
        console.error(
            `[PreScanner] Job ${jobId}: partial_result-Write fehlgeschlagen (fail-soft, `
            + `Review läuft weiter): ${extractErrorMessage(partialWriteError)}`,
        );
    }
}

/** Der Diff-Loader hat den Lauf als „nur deterministisch“ geplant (keine reviewbare Datei). */
function isDeterministicOnly(context: PipelineContext): boolean {
    return context.deterministicOnlyReason !== undefined;
}

/** Mapping-Tabelle aus pre_scanner_design.md §4. */
function mapFindingToIssue(finding: PrescanFinding): PipelineIssue {
    return {
        rule: `${finding.ruleId} (${finding.ruleTitle})`,
        severity: finding.severity,
        path: finding.path,
        line: finding.line,
        endLine: finding.endLine,
        exactQuote: finding.exactQuote,
        critique: finding.explanation,
        fixedCodeSnippet: finding.fixTemplate,
        source: 'pre-scanner',
        // Deterministisch per Definition — der Integrity-Scorer behandelt
        // diese Issues als verdict-exempt (sie erreichen ihn strukturell nie).
        confidence: 100,
        verification: 'deterministic',
    };
}
