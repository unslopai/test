import { supabase } from '@/lib/supabase';
import { getVertexClient } from '@/lib/vertex';
import { ACTIVE_REVIEWER_PROMPT, ACTIVE_FIXER_PROMPT } from '@/lib/prompts';
import { extractErrorMessage } from '@/lib/errors';

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

interface JobPayload {
    code: string;
    filename?: string;
    language?: string;
    [key: string]: unknown;
}

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

    const reviewerOutput: ReviewerOutput = JSON.parse(text);
    return reviewerOutput;
}

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
