/**
 * AiReviewerStep — Führt den LLM-basierten Code-Review aus.
 *
 * Baut den Prompt dynamisch via PromptBuilder zusammen,
 * ruft Vertex AI auf und konvertiert die LLM-Antwort in PipelineIssues.
 */
import { getVertexClient } from '@/lib/vertex';
import { fetchRenderedLawBlock } from '@/lib/law';
import { buildPrompt, filterIssuesByScope } from '@/lib/pipeline/prompt-builder';
import { parseModelJson, extractTokenUsage } from '@/lib/pipeline/helpers';
import type { PipelineContext, PipelineStep, PipelineIssue, IssueSeverity } from '@/lib/pipeline/types';
import type { PromptVariant } from '@/lib/pipeline/prompt-builder';

// =============================================================================
// LLM Response Types (intern, nicht exportiert)
// =============================================================================

interface LlmDiffIssue {
    rule: string;
    severity: 'CRITICAL' | 'WARNING';
    path: string;
    line: number;
    end_line: number;
    exact_quote: string;
    critique: string;
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
        const lawBlock = await fetchRenderedLawBlock();
        const systemPrompt = buildPrompt(promptVariant, context.promptConfig, lawBlock);
        const userPrompt = buildUserPrompt(context, promptVariant);

        const reviewerModel = 'gemini-2.5-flash';
        const ai = getVertexClient();
        const response = await ai.models.generateContent({
            model: reviewerModel,
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
        const scopedIssues = filterIssuesByScope(pipelineIssues, context.promptConfig);
        const tokenUsage = extractTokenUsage(response.usageMetadata, reviewerModel);

        console.log(
            `[AiReviewer] ${scopedIssues.length} Issues (${pipelineIssues.length - scopedIssues.length} ` +
            `vom Scope-Post-Filter verworfen), has_slop: ${llmOutput.has_slop}, ` +
            `Tokens: prompt=${tokenUsage.promptTokens} cached=${tokenUsage.cachedTokens} output=${tokenUsage.outputTokens}`,
        );

        return {
            ...context,
            issues: [...context.issues, ...scopedIssues],
            reviewSummary: llmOutput.summary,
            tokenUsage,
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
        critique: llmIssue.critique,
        fixedCodeSnippet: llmIssue.fixed_code_snippet,
        source: 'ai-reviewer',
    }));
}
