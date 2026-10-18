/**
 * AiReviewerStep — Führt den LLM-basierten Code-Review aus.
 *
 * Baut den Prompt dynamisch via PromptBuilder zusammen,
 * ruft Vertex AI auf und konvertiert die LLM-Antwort in PipelineIssues.
 */
import { getVertexClient } from '@/lib/vertex';
import { buildPrompt } from '@/lib/pipeline/prompt-builder';
import { parseModelJson } from '@/lib/pipeline/helpers';
import type { PipelineContext, PipelineStep, PipelineIssue, IssueSeverity } from '@/lib/pipeline/types';
import type { PromptVariant } from '@/lib/pipeline/prompt-builder';

// =============================================================================
// LLM Response Types (intern, nicht exportiert)
// =============================================================================

interface LlmDiffIssue {
    rule: string;
    severity: 'KRITISCH' | 'WARNUNG';
    path: string;
    line: number;
    end_line: number;
    exact_quote: string;
    german_critique: string;
    fixed_code_snippet?: string;
}

interface LlmDiffReviewResponse {
    has_slop: boolean;
    issues: LlmDiffIssue[];
    summary: string;
}

// =============================================================================
// Step Implementation
// =============================================================================

export const aiReviewerStep: PipelineStep = {
    id: 'ai-reviewer',
    displayName: 'AI Reviewer',

    async execute(context: PipelineContext): Promise<PipelineContext> {
        if (context.shouldAbort) return context;

        const promptVariant = selectPromptVariant(context.ragPromptSection);
        const systemPrompt = buildPrompt(promptVariant, context.promptConfig);
        const userPrompt = buildUserPrompt(context, promptVariant);

        const ai = getVertexClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
            },
        });

        const rawResponseText = response.text ?? '';
        console.log('[AiReviewer] Raw Response:', rawResponseText.substring(0, 500));

        const llmOutput = parseModelJson<LlmDiffReviewResponse>(rawResponseText, 'AiReviewer');
        const pipelineIssues = convertToPipelineIssues(llmOutput.issues);

        console.log(`[AiReviewer] ${pipelineIssues.length} Issues, has_slop: ${llmOutput.has_slop}`);

        return {
            ...context,
            issues: [...context.issues, ...pipelineIssues],
            reviewSummary: llmOutput.summary,
        };
    },
};

// =============================================================================
// Helpers
// =============================================================================

function selectPromptVariant(ragPromptSection: string): PromptVariant {
    return ragPromptSection ? 'reviewer_rag' : 'reviewer_diff';
}

function buildUserPrompt(context: PipelineContext, variant: PromptVariant): string {
    if (variant === 'reviewer_rag' && context.ragPromptSection) {
        return `${context.ragPromptSection}\n\n\n=== NEW CODE (Pull Request Diff) ===\n${context.combinedDiff}`;
    }
    return context.combinedDiff;
}

function convertToPipelineIssues(llmIssues: readonly LlmDiffIssue[]): PipelineIssue[] {
    return llmIssues.map((llmIssue) => ({
        rule: llmIssue.rule,
        severity: llmIssue.severity as IssueSeverity,
        path: llmIssue.path,
        line: llmIssue.line,
        endLine: llmIssue.end_line,
        exactQuote: llmIssue.exact_quote,
        germanCritique: llmIssue.german_critique,
        fixedCodeSnippet: llmIssue.fixed_code_snippet,
        source: 'ai-reviewer',
    }));
}
