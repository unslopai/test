/**
 * Worker-Logik für die Anti-Slop Review Pipeline.
 *
 * Unterstützt zwei Modi:
 * 1. Manueller Review (processJob): Raw-Code direkt analysieren (bestehend)
 * 2. PR-Review (processReviewJob): PR-Diff von GitHub laden, reviewen und Inline-Comments posten
 */
import { supabase } from '@/lib/supabase';
import { getVertexClient } from '@/lib/vertex';
import { ACTIVE_REVIEWER_PROMPT, ACTIVE_FIXER_PROMPT, ACTIVE_DIFF_REVIEWER_PROMPT, ACTIVE_RAG_REVIEWER_PROMPT } from '@/lib/prompts';
import { extractErrorMessage } from '@/lib/errors';
import { decryptToken } from '@/lib/crypto';
import { buildRAGContext } from '@/lib/rag';
import {
    fetchPullRequestFiles,
    getPullRequestHeadSha,
    createPullRequestReview,
    postPRComment,
    type PullRequestFile,
    type PullRequestReviewComment,
} from '@/lib/github';

// =============================================================================
// Interfaces
// =============================================================================

interface ReviewIssue {
    rule: string;
    severity: 'KRITISCH' | 'WARNUNG';
    start_line: number;
    end_line: number;
    exact_quote: string;
    german_critique: string;
}

interface ReviewerOutput {
    has_slop: boolean;
    issues: ReviewIssue[];
    summary: string;
}

/** Erweitertes Issue-Format für Diff-basierte Reviews mit Datei-Pfad. */
interface DiffReviewIssue {
    rule: string;
    severity: 'KRITISCH' | 'WARNUNG';
    path: string;
    line: number;
    end_line: number;
    exact_quote: string;
    german_critique: string;
    fixed_code_snippet?: string;
}

interface DiffReviewerOutput {
    has_slop: boolean;
    issues: DiffReviewIssue[];
    summary: string;
}

interface JobPayload {
    code?: string;
    filename?: string;
    language?: string;
    repo_full_name?: string;
    pr_number?: number;
    pr_url?: string;
    pr_head_sha?: string;
    action?: string;
    [key: string]: unknown;
}

function parseModelJson<T>(rawText: string, context: string): T {
    const text = rawText.trim();
    if (!text) {
        throw new Error(`[${context}] Modellantwort ist leer.`);
    }

    try {
        return JSON.parse(text) as T;
    } catch (error: unknown) {
        const preview = text.substring(0, 500);
        throw new Error(
            `[${context}] Modellantwort ist kein gültiges JSON: ${extractErrorMessage(error)}. ` +
            `Response-Preview: ${preview}`,
        );
    }
}

// =============================================================================
// Reviewer & Fixer (Raw Code — bestehende Logik)
// =============================================================================

/**
 * Führt den Anti-Slop Reviewer auf Raw-Code aus.
 * Nutzt Structured Outputs (JSON Mode) für präzise Ergebnisse.
 *
 * @param code - Der zu analysierende Raw-Code
 * @param filename - Optionaler Dateiname für Kontext
 * @returns Strukturiertes Review-Ergebnis
 */
async function runReviewer(code: string, filename?: string): Promise<ReviewerOutput> {
    const ai = getVertexClient();

    const numberedCode = code
        .split('\n')
        .map((line, i) => `${i + 1}: ${line}`)
        .join('\n');

    const userPrompt = filename
        ? `Datei: ${filename}\n\n${numberedCode}`
        : numberedCode;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            systemInstruction: ACTIVE_REVIEWER_PROMPT,
            responseMimeType: 'application/json',
        },
    });

    const text = response.text ?? '';
    console.log('[Reviewer] Raw Response:', text.substring(0, 500));

    const reviewerOutput = parseModelJson<ReviewerOutput>(text, 'Reviewer');
    return reviewerOutput;
}

/**
 * Führt den Diff-basierten Reviewer auf PR-Diffs aus.
 * Bewertet nur hinzugefügte Zeilen und liefert Datei-Pfade und Zeilennummern
 * für Inline-Comments.
 *
 * @param diffContent - Der zusammengesetzte Diff aller geänderten Dateien
 * @returns Strukturiertes Review-Ergebnis mit Pfad und Zeilennummern
 */
async function runDiffReviewer(diffContent: string): Promise<DiffReviewerOutput> {
    const ai = getVertexClient();

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: diffContent,
        config: {
            systemInstruction: ACTIVE_DIFF_REVIEWER_PROMPT,
            responseMimeType: 'application/json',
        },
    });

    const text = response.text ?? '';
    console.log('[DiffReviewer] Raw Response:', text.substring(0, 500));

    const diffReviewOutput = parseModelJson<DiffReviewerOutput>(text, 'DiffReviewer');
    return diffReviewOutput;
}

/**
 * Führt den RAG-erweiterten Diff-Reviewer aus ("Judge Pattern").
 *
 * Der Prompt erhält drei Kontextbereiche:
 * 1. THE LAW (Golden Standards) — Kuratierte Best Practices (absolut)
 * 2. EVIDENCE (Local Context) — Skeleton-Daten aus dem User-Repo (informativ)
 * 3. NEW CODE — Der PR-Diff
 *
 * @param diffContent - Der zusammengesetzte Diff aller geänderten Dateien
 * @param ragContext - Formatierter RAG-Kontext (THE LAW + EVIDENCE)
 * @returns Strukturiertes Review-Ergebnis mit Pfad und Zeilennummern
 */
async function runRAGDiffReviewer(
    diffContent: string,
    ragContext: string,
): Promise<DiffReviewerOutput> {
    const ai = getVertexClient();

    // Der User-Prompt kombiniert RAG-Kontext und den PR-Diff
    const userPrompt = ragContext
        ? `${ragContext}\n\n\n=== NEW CODE (Pull Request Diff) ===\n${diffContent}`
        : diffContent;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            systemInstruction: ACTIVE_RAG_REVIEWER_PROMPT,
            responseMimeType: 'application/json',
        },
    });

    const text = response.text ?? '';
    console.log('[RAGReviewer] Raw Response:', text.substring(0, 500));

    const ragReviewOutput = parseModelJson<DiffReviewerOutput>(text, 'RAGReviewer');
    return ragReviewOutput;
}

/**
 * Führt den Slop-Fixer auf Code aus, der Probleme hat.
 * Refactored den Code anhand der gefundenen Issues.
 *
 * @param code - Der Original-Code mit Slop
 * @param critique - Die Review-Ergebnisse
 * @returns Der refactored Code als String
 */
async function runFixer(code: string, critique: ReviewerOutput): Promise<string> {
    const ai = getVertexClient();

    const userPrompt = `CRITIQUE_JSON:\n${JSON.stringify(critique.issues, null, 2)}\n\nORIGINAL_CODE:\n${code}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            systemInstruction: ACTIVE_FIXER_PROMPT,
        },
    });

    const fixedCode = response.text ?? '';
    console.log('[Fixer] Output length:', fixedCode.length, 'chars');
    return fixedCode;
}

// =============================================================================
// Job Processors
// =============================================================================

/**
 * Verarbeitet einen manuellen Review-Job (bestehende Logik).
 * Nimmt Raw-Code aus dem Payload, reviewt ihn und speichert das Ergebnis.
 *
 * @param jobId - Die Job-ID aus der review_jobs Tabelle
 */
export async function processJob(jobId: string) {
    console.log(`[Worker] Starte Job ${jobId}...`);

    const { data: job, error: fetchError } = await supabase
        .from('review_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('status', 'pending') // Concurrency guard
        .select()
        .single();

    if (fetchError || !job) {
        console.error(`[Worker] Job ${jobId} nicht gefunden oder bereits verarbeitet:`, fetchError);
        return;
    }

    const payload = job.payload as JobPayload;

    if (!payload.code) {
        await supabase
            .from('review_jobs')
            .update({
                status: 'error',
                error_message: 'Payload enthält keinen "code" Schlüssel.',
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
        return;
    }

    try {
        console.log(`[Worker] Job ${jobId} — Starte Reviewer...`);
        const reviewResult = await runReviewer(payload.code, payload.filename);
        console.log(`[Worker] Job ${jobId} — Reviewer fertig: ${reviewResult.issues.length} Issues, has_slop: ${reviewResult.has_slop}`);

        let fixedCode: string | null = null;

        if (reviewResult.has_slop && reviewResult.issues.length > 0) {
            console.log(`[Worker] Job ${jobId} — Starte Fixer...`);
            fixedCode = await runFixer(payload.code, reviewResult);
            console.log(`[Worker] Job ${jobId} — Fixer fertig.`);
        } else {
            console.log(`[Worker] Job ${jobId} — Kein Slop gefunden, Fixer übersprungen.`);
        }

        await supabase
            .from('review_jobs')
            .update({
                status: 'done',
                result: {
                    review: reviewResult,
                    fixed_code: fixedCode,
                },
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);

        console.log(`[Worker] Job ${jobId} erfolgreich abgeschlossen.`);

    } catch (error: unknown) {
        console.error(`[Worker] Fehler bei Job ${jobId}:`, error);

        await supabase
            .from('review_jobs')
            .update({
                status: 'error',
                error_message: extractErrorMessage(error),
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
    }
}

/**
 * Verarbeitet einen PR-basierten Review-Job (neuer Webhook-Flow).
 *
 * Ablauf:
 * 1. Job aus DB laden und auf 'processing' setzen
 * 2. GitHub Token des Repo-Besitzers entschlüsseln
 * 3. PR-Diff über GitHub API laden
 * 4. Diff an den Reviewer senden
 * 5. Bei Slop: Fixer für jede betroffene Datei laufen lassen
 * 6. Ergebnis als PR-Review mit Inline-Comments posten
 * 7. Fixer-Suggestions als separaten PR-Comment posten
 *
 * @param jobId - Die Job-ID aus der review_jobs Tabelle
 * @param userId - Die User-ID des Repo-Besitzers (für Token-Lookup)
 */
export async function processReviewJob(jobId: string, userId: string) {
    console.log(`[PRWorker] Starte PR-Review Job ${jobId}...`);

    // Job claimen (Concurrency Guard)
    const { data: job, error: fetchError } = await supabase
        .from('review_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('status', 'pending')
        .select()
        .single();

    if (fetchError || !job) {
        console.error(`[PRWorker] Job ${jobId} nicht gefunden oder bereits verarbeitet:`, fetchError);
        return;
    }

    const payload = job.payload as JobPayload;
    const repoFullName = payload.repo_full_name;
    const prNumber = payload.pr_number;

    if (!repoFullName || !prNumber) {
        await supabase
            .from('review_jobs')
            .update({
                status: 'error',
                error_message: 'Payload enthält kein repo_full_name oder pr_number.',
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
        return;
    }

    try {
        // GitHub Token entschlüsseln
        const { data: tokenRow, error: tokenError } = await supabase
            .from('github_tokens')
            .select('encrypted_token, token_iv, token_tag')
            .eq('user_id', userId)
            .single();

        if (tokenError || !tokenRow) {
            throw new Error('GitHub Token für diesen User nicht gefunden. Re-Login erforderlich.');
        }

        const githubToken = decryptToken({
            encryptedToken: tokenRow.encrypted_token,
            iv: tokenRow.token_iv,
            tag: tokenRow.token_tag,
        });

        // PR-Diff laden
        console.log(`[PRWorker] Lade PR #${prNumber} Diff von ${repoFullName}...`);
        const prFiles = await fetchPullRequestFiles(githubToken, repoFullName, prNumber);
        const headSha = await getPullRequestHeadSha(githubToken, repoFullName, prNumber);

        // Nur Dateien mit Patches verarbeiten (Binärdateien haben kein Patch)
        const reviewableFiles = prFiles.filter(
            (file) => file.patch && isReviewableFile(file.filename),
        );

        if (reviewableFiles.length === 0) {
            console.log(`[PRWorker] Keine reviewbaren Dateien in PR #${prNumber}.`);

            await supabase
                .from('review_jobs')
                .update({
                    status: 'done',
                    result: { review: { has_slop: false, issues: [], summary: 'Keine reviewbaren Dateien im PR.' } },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', jobId);

            await postPRComment(
                githubToken,
                repoFullName,
                prNumber,
                '✅ **Anti-Slop Gatekeeper**: Keine reviewbaren Code-Dateien in diesem PR gefunden.',
            );
            return;
        }

        // Diff für den Reviewer zusammenbauen
        const combinedDiff = buildCombinedDiff(reviewableFiles);
        console.log(`[PRWorker] Reviewe ${reviewableFiles.length} Dateien (${combinedDiff.length} chars)...`);

        // RAG-Kontext laden (Golden Standards + Local Context)
        // Repository-ID aus der DB laden für den Local Context Filter
        const { data: repoRow } = await supabase
            .from('repositories')
            .select('id')
            .eq('full_name', repoFullName)
            .single();

        const ragContext = await buildRAGContext(
            combinedDiff,
            repoRow?.id ?? null,
        );

        console.log(
            `[PRWorker] RAG-Kontext: ${ragContext.goldenStandards.length} Golden Standards, ` +
            `${ragContext.localContext.length} Local Chunks`,
        );

        // RAG-erweiterten Reviewer ausführen (Judge Pattern)
        const reviewOutput = ragContext.formattedPromptSection
            ? await runRAGDiffReviewer(combinedDiff, ragContext.formattedPromptSection)
            : await runDiffReviewer(combinedDiff);
        console.log(`[PRWorker] Reviewer fertig: ${reviewOutput.issues.length} Issues, has_slop: ${reviewOutput.has_slop}`);

        // Ergebnis in DB speichern
        await supabase
            .from('review_jobs')
            .update({
                status: 'done',
                result: {
                    review: reviewOutput,
                    files_reviewed: reviewableFiles.length,
                },
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);

        // PR-Review posten
        if (reviewOutput.has_slop && reviewOutput.issues.length > 0) {
            // Inline-Comments für jedes Issue erstellen
            const inlineComments = buildInlineComments(reviewOutput.issues, reviewableFiles);

            // Zusammenfassungs-Body
            const reviewBody = formatReviewSummary(reviewOutput);

            // PR-Review mit Inline-Comments posten
            await createPullRequestReview(
                githubToken,
                repoFullName,
                prNumber,
                headSha,
                reviewBody,
                inlineComments,
                'REQUEST_CHANGES',
            );

            console.log(`[PRWorker] Review mit ${inlineComments.length} Inline-Comments gepostet.`);

            // Fixer-Suggestions sind jetzt direkt in den Inline-Comments integriert!

        } else {
            // Kein Slop gefunden → Approval-Comment
            await createPullRequestReview(
                githubToken,
                repoFullName,
                prNumber,
                headSha,
                '✅ **Anti-Slop Gatekeeper**: Kein AI-Slop gefunden. Der Code entspricht den Qualitätsstandards.',
                [],
                'COMMENT',
            );
            console.log(`[PRWorker] Kein Slop — Approval-Comment gepostet.`);
        }

        console.log(`[PRWorker] Job ${jobId} erfolgreich abgeschlossen.`);

    } catch (error: unknown) {
        console.error(`[PRWorker] Fehler bei Job ${jobId}:`, error);

        await supabase
            .from('review_jobs')
            .update({
                status: 'error',
                error_message: extractErrorMessage(error),
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
    }
}

// =============================================================================
// Helper-Funktionen
// =============================================================================

/**
 * Prüft ob eine Datei reviewbar ist (Code-Dateien, keine Binärdateien/Configs).
 *
 * @param filename - Der Dateipfad relativ zum Repo-Root
 * @returns true wenn die Datei reviewt werden soll
 */
function isReviewableFile(filename: string): boolean {
    const reviewableExtensions = [
        '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    ];

    const ignoredPaths = [
        'node_modules/', 'package-lock.json', '.next/',
        '.git/', 'dist/', 'build/', '.env',
    ];

    // Ignorierte Pfade prüfen
    if (ignoredPaths.some((ignored) => filename.includes(ignored))) {
        return false;
    }

    // Extension prüfen
    return reviewableExtensions.some((ext) => filename.endsWith(ext));
}

/**
 * Baut den kombinierten Diff-String für den Reviewer zusammen.
 * Jede Datei wird mit einem Header markiert, gefolgt vom Patch.
 *
 * @param files - Die geänderten Dateien mit ihren Patches
 * @returns Formatierter Diff-String
 */
function buildCombinedDiff(files: PullRequestFile[]): string {
    return files
        .map((file) => `=== FILE: ${file.filename} (${file.status}) ===\n${file.patch ?? ''}`)
        .join('\n\n');
}

/**
 * Konvertiert Review-Issues in GitHub PR Inline-Comments.
 *
 * Mappt die Issues auf die tatsächlichen Diff-Positionen.
 * Wenn ein Issue auf eine Zeile verweist die nicht im Diff ist,
 * wird es als allgemeiner Kommentar an die erste Zeile der Datei gehängt.
 *
 * @param issues - Die Review-Issues mit Pfad und Zeilennummern
 * @param prFiles - Die PR-Dateien für die Validierung der Zeilennummern
 * @returns Array von PR Inline-Comments
 */
function buildInlineComments(
    issues: DiffReviewIssue[],
    prFiles: PullRequestFile[],
): PullRequestReviewComment[] {
    const fileSet = new Set(prFiles.map((file) => file.filename));

    return issues
        .filter((issue) => fileSet.has(issue.path))
        .map((issue) => {
            const severityIcon = issue.severity === 'KRITISCH' ? '🚨' : '⚠️';

            const commentBody = [
                `${severityIcon} **${issue.rule}** (${issue.severity})`,
                '',
                issue.german_critique,
            ];

            if (issue.fixed_code_snippet) {
                commentBody.push(
                    '',
                    '💡 **Fix-Vorschlag** (1-Click Commit):',
                    '```suggestion',
                    issue.fixed_code_snippet,
                    '```'
                );
            }

            const isMultiLine = issue.end_line && issue.end_line > issue.line;

            const comment: PullRequestReviewComment = {
                path: issue.path,
                line: isMultiLine ? issue.end_line : issue.line,
                side: 'RIGHT',
                body: commentBody.join('\n'),
            };

            if (isMultiLine) {
                comment.start_line = issue.line;
                comment.start_side = 'RIGHT';
            }

            return comment;
        });
}

/**
 * Formatiert die Review-Zusammenfassung als Markdown für den PR-Body.
 *
 * @param reviewOutput - Das Review-Ergebnis
 * @returns Markdown-formatierte Zusammenfassung
 */
function formatReviewSummary(reviewOutput: DiffReviewerOutput): string {
    const kritischCount = reviewOutput.issues.filter((issue) => issue.severity === 'KRITISCH').length;
    const warnungCount = reviewOutput.issues.filter((issue) => issue.severity === 'WARNUNG').length;

    const lines = [
        '## 🛡️ Anti-Slop Gatekeeper Review',
        '',
        `**Ergebnis:** ${reviewOutput.issues.length} Issue(s) gefunden`,
        '',
    ];

    if (kritischCount > 0) {
        lines.push(`- 🚨 **${kritischCount} KRITISCH**`);
    }
    if (warnungCount > 0) {
        lines.push(`- ⚠️ **${warnungCount} WARNUNG**`);
    }

    lines.push('', '---', '', `**Zusammenfassung:** ${reviewOutput.summary}`);

    return lines.join('\n');
}

/**
 * Führt den Fixer für alle Dateien aus, die Slop enthalten,
 * und formatiert das Ergebnis als Markdown-Comment mit Code-Suggestions.
 *
 * @param reviewOutput - Das Diff-Review-Ergebnis mit Issues
 * @param prFiles - Die PR-Dateien mit Original-Patches
 * @returns Formatierter Markdown-String mit Fixer-Suggestions, oder null
 */
async function runFixerForDiff(
    reviewOutput: DiffReviewerOutput,
    prFiles: PullRequestFile[],
): Promise<string | null> {
    // Gruppiere Issues nach Datei
    const issuesByFile = new Map<string, DiffReviewIssue[]>();
    for (const issue of reviewOutput.issues) {
        const existing = issuesByFile.get(issue.path) ?? [];
        existing.push(issue);
        issuesByFile.set(issue.path, existing);
    }

    const fixerResults: string[] = [];

    for (const [filepath, fileIssues] of issuesByFile) {
        const prFile = prFiles.find((file) => file.filename === filepath);
        if (!prFile?.patch) continue;

        // Extrahiere die hinzugefügten Zeilen aus dem Patch als "Code"
        const addedCode = prFile.patch
            .split('\n')
            .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
            .map((line) => line.substring(1))
            .join('\n');

        if (!addedCode.trim()) continue;

        // Erstelle ein ReviewerOutput-kompatibles Objekt für den Fixer
        const pseudoReview: ReviewerOutput = {
            has_slop: true,
            issues: fileIssues.map((issue) => ({
                rule: issue.rule,
                severity: issue.severity,
                start_line: issue.line,
                end_line: issue.end_line,
                exact_quote: issue.exact_quote,
                german_critique: issue.german_critique,
            })),
            summary: reviewOutput.summary,
        };

        try {
            const fixedCode = await runFixer(addedCode, pseudoReview);

            fixerResults.push([
                `### 📝 \`${filepath}\``,
                '',
                '**Vorgeschlagene Änderungen:**',
                '',
                '```suggestion',
                fixedCode,
                '```',
            ].join('\n'));
        } catch (fixerError: unknown) {
            console.warn(`[PRWorker] Fixer für ${filepath} fehlgeschlagen:`, fixerError);
        }
    }

    if (fixerResults.length === 0) return null;

    return [
        '## 🔧 Anti-Slop Fixer — Vorgeschlagene Korrekturen',
        '',
        'Die folgenden Code-Korrekturen wurden automatisch generiert:',
        '',
        ...fixerResults,
        '',
        '---',
        '*Automatisch generiert vom Anti-Slop Gatekeeper. Bitte überprüfe die Vorschläge vor dem Merge.*',
    ].join('\n');
}
