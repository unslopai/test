/**
 * Prompt Builder — Dynamische Prompt-Komposition.
 *
 * Ersetzt die monolithischen Prompt-Strings in prompts.ts.
 * Nimmt eine PromptConfig und baut den Prompt aus:
 * 1. Base Persona (pro Variante)
 * 2. Gefilterte Conditions (aus dem Registry)
 * 3. Output Format (pro Variante)
 *
 * Smart Context Detection analysiert die Datei-Extensions im PR
 * und schließt irrelevante Conditions automatisch aus.
 */
import { CONDITION_REGISTRY } from '@/lib/pipeline/conditions';
import type { ConditionScope, ReviewCondition } from '@/lib/pipeline/conditions';
import type { PromptConfig } from '@/lib/pipeline/types';

// =============================================================================
// Public API
// =============================================================================

type PromptVariant = 'reviewer_raw' | 'reviewer_diff' | 'reviewer_rag' | 'fixer';

export type { PromptVariant };

/**
 * Baut einen vollständigen System-Prompt für die angegebene Variante.
 *
 * @param variant - Die Prompt-Variante (raw, diff, rag, fixer)
 * @param config - Aktive Conditions und Datei-Pfade für Smart Detection
 * @returns Der zusammengesetzte System-Prompt
 */
export function buildPrompt(variant: PromptVariant, config: PromptConfig): string {
    if (variant === 'fixer') {
        return FIXER_PROMPT;
    }

    const applicableScopes = config.overrideSmartDetection
        ? null
        : detectApplicableScopes(config.filePaths);

    const filteredIds = applicableScopes
        ? filterConditionsByScope(config.activeConditionIds, applicableScopes)
        : [...config.activeConditionIds];

    const persona = VARIANT_PERSONAS[variant];
    const conditionsBlock = buildConditionsBlock(filteredIds, variant);
    const outputFormat = VARIANT_OUTPUT_FORMATS[variant];

    return [persona, conditionsBlock, outputFormat].join('\n\n');
}

// =============================================================================
// Smart Context Detection
// =============================================================================

const TYPESCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const REACT_EXTENSIONS = new Set(['.tsx', '.jsx']);
const NEXTJS_FILENAMES = new Set(['layout.tsx', 'page.tsx', 'route.ts', 'route.tsx', 'middleware.ts']);

/**
 * Erkennt anwendbare Condition-Scopes basierend auf Datei-Extensions.
 * Bei leerem Array (Raw-Code-Review) werden alle Scopes zurückgegeben.
 */
export function detectApplicableScopes(filePaths: readonly string[]): Set<ConditionScope> {
    const scopes = new Set<ConditionScope>(['universal']);

    if (filePaths.length === 0) {
        scopes.add('typescript');
        scopes.add('react');
        scopes.add('nextjs');
        return scopes;
    }

    for (const filePath of filePaths) {
        const extension = extractExtension(filePath);
        const basename = extractBasename(filePath);

        if (TYPESCRIPT_EXTENSIONS.has(extension)) scopes.add('typescript');
        if (REACT_EXTENSIONS.has(extension)) scopes.add('react');
        if (NEXTJS_FILENAMES.has(basename)) scopes.add('nextjs');
    }

    return scopes;
}

/**
 * Filtert Condition-IDs auf solche, deren Scopes mit den erkannten Scopes überlappen.
 */
export function filterConditionsByScope(
    conditionIds: readonly string[],
    applicableScopes: Set<ConditionScope>,
): string[] {
    return conditionIds.filter((conditionId) => {
        const condition = CONDITION_REGISTRY.get(conditionId);
        if (!condition) return false;
        return condition.scopes.some((scope) => applicableScopes.has(scope));
    });
}

// =============================================================================
// Conditions Block Builder
// =============================================================================

/** RAG-spezifische Überschreibungen für Condition-Texte. */
const RAG_CONDITION_OVERRIDES: ReadonlyMap<string, string> = new Map([
    [
        'COND-004',
        "Condition 4 (Context Blindness/DRY): The code manually implements standard utility logic " +
        "OR re-implements a function that already exists in EVIDENCE.",
    ],
]);

function getConditionText(condition: ReviewCondition, variant: PromptVariant): string {
    if (variant === 'reviewer_rag') {
        return RAG_CONDITION_OVERRIDES.get(condition.id) ?? condition.promptText;
    }
    return condition.promptText;
}

function buildConditionsBlock(conditionIds: readonly string[], variant: PromptVariant): string {
    const conditions = conditionIds
        .map((conditionId) => CONDITION_REGISTRY.get(conditionId))
        .filter((condition): condition is ReviewCondition => condition !== undefined);

    if (variant === 'reviewer_rag') {
        return buildRagConditionsBlock(conditions, variant);
    }

    return buildCategorizedConditionsBlock(conditions, variant);
}

/** Baut den Conditions-Block mit Kategorie-Headern (für Raw + Diff). */
function buildCategorizedConditionsBlock(
    conditions: readonly ReviewCondition[],
    variant: PromptVariant,
): string {
    const macroConditions = conditions.filter((c) => c.category === 'macro');
    const reactConditions = conditions.filter((c) => c.category === 'react_nextjs');
    const sections: string[] = [];

    if (macroConditions.length > 0) {
        sections.push(
            '=== MACRO & STRUCTURAL CONDITIONS ===\n\n' +
            macroConditions.map((c) => getConditionText(c, variant)).join('\n\n'),
        );
    }

    if (reactConditions.length > 0) {
        sections.push(
            '=== REACT & NEXT.JS SPECIFIC CONDITIONS ===\n\n' +
            reactConditions.map((c) => getConditionText(c, variant)).join('\n\n'),
        );
    }

    return sections.join('\n\n');
}

/** Baut den Conditions-Block ohne Sub-Header (für RAG "RULES FROM THE LAW"). */
function buildRagConditionsBlock(
    conditions: readonly ReviewCondition[],
    variant: PromptVariant,
): string {
    const conditionTexts = conditions.map((c) => getConditionText(c, variant)).join('\n\n');
    return (
        '=== RULES FROM THE LAW ===\n\n' +
        'Apply ALL of the following conditions. If ANY condition is met in the ADDED lines ' +
        "(lines starting with '+'), flag it:\n\n" +
        conditionTexts
    );
}

// =============================================================================
// String Utilities
// =============================================================================

function extractExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot >= 0 ? filePath.substring(lastDot).toLowerCase() : '';
}

function extractBasename(filePath: string): string {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
}

// =============================================================================
// Persona Constants (Private)
// =============================================================================

const SHARED_PERSONA_INTRO =
    'You are the "Anti-AI-Slop" Code Review Agent, an unforgiving architectural gatekeeper ' +
    'for a high-scale React/Next.js environment. Your sole purpose is to detect and mercilessly ' +
    'expose "AI-Slop" \u2013 structurally disastrous code generated by probabilistic LLMs that ' +
    'violates core software engineering principles.';

const VARIANT_PERSONAS: Record<Exclude<PromptVariant, 'fixer'>, string> = {
    reviewer_raw:
        SHARED_PERSONA_INTRO + '\n\n' +
        'Analyze the provided raw code strictly against the rules below. Do NOT rewrite or fix the code. ' +
        'Do NOT offer polite suggestions. You must flag the code as AI-Slop and output a structured JSON ' +
        'array if ANY of the following conditions are met:',

    reviewer_diff:
        SHARED_PERSONA_INTRO + '\n\n' +
        "You are reviewing a PULL REQUEST DIFF in unified diff format. Each file's changes are shown " +
        "with '+' (added lines) and '-' (removed lines) prefixes.\n\n" +
        "CRITICAL INSTRUCTION: You MUST ONLY evaluate ADDED lines (lines starting with '+'). " +
        "Removed lines ('-') and context lines are ONLY for understanding the change. " +
        'DO NOT flag issues in removed or context lines.\n\n' +
        'Analyze the added code strictly against the rules below. Do NOT rewrite or fix the code. ' +
        'Do NOT offer polite suggestions. You must flag the code as AI-Slop and output a structured JSON ' +
        'array if ANY of the following conditions are met in the ADDED lines:',

    reviewer_rag:
        'You are the "Anti-AI-Slop" Principal Engineer and Gatekeeper for a high-scale React/Next.js ' +
        'environment. You have access to THREE knowledge sources:\n\n' +
        '1. THE LAW (Golden Standards): Curated, absolute architectural rules and best practices. ' +
        'These are NON-NEGOTIABLE. Even if the codebase has historically violated these, you MUST flag it.\n' +
        '2. EVIDENCE (Local Repo Context): Existing code signatures, interfaces, and type definitions from this project. Use this ONLY for:\n' +
        '   - Detecting DRY violations (code re-implements existing utilities)\n' +
        '   - Understanding project-specific naming conventions and domain logic\n' +
        '   - NEVER use EVIDENCE to justify violations of THE LAW\n' +
        '3. NEW CODE (Pull Request Diff): The code changes under review.\n\n' +
        '=== DECISION LOGIC ===\n\n' +
        "Priority 1: If NEW CODE violates THE LAW \u2192 Flag as SLOP, regardless of what EVIDENCE shows.\n" +
        "Priority 2: If NEW CODE re-implements something that already exists in EVIDENCE \u2192 Flag as DRY violation (Condition 4).\n" +
        "Priority 3: If NEW CODE introduces patterns inconsistent with EVIDENCE but does NOT violate THE LAW \u2192 INFORMATIONAL NOTE only, not a violation.",
};

// =============================================================================
// Output Format Constants (Private)
// =============================================================================

const OUTPUT_FORMAT_RAW =
    '=== OUTPUT FORMAT ===\n\n' +
    'Return ONLY a valid JSON object with this schema:\n' +
    '{\n' +
    '  "has_slop": boolean,\n' +
    '  "issues": [\n' +
    '    {\n' +
    '      "rule": "Condition X (Name)",\n' +
    '      "severity": "KRITISCH" | "WARNUNG",\n' +
    '      "start_line": number,\n' +
    '      "end_line": number,\n' +
    '      "exact_quote": "max 2 lines of the trigger code",\n' +
    '      "german_critique": "Professional German explanation, keep variable names and technical terms in English."\n' +
    '    }\n' +
    '  ],\n' +
    '  "summary": "Short German summary of all findings."\n' +
    '}\n\n' +
    'If no issues are found, return: { "has_slop": false, "issues": [], "summary": "Kein AI-Slop gefunden." }\n\n' +
    'CRITICAL: The "exact_quote" MUST NOT exceed 2 lines of code. Quote ONLY the specific trigger line.';

const OUTPUT_FORMAT_DIFF =
    '=== OUTPUT FORMAT ===\n\n' +
    'For each issue, the "path" field MUST be the filename from the diff header (e.g., "src/components/Button.tsx").\n' +
    'The "line" field MUST be the line number in the NEW file (right side of the diff).\n\n' +
    'Return ONLY a valid JSON object with this schema:\n' +
    '{\n' +
    '  "has_slop": boolean,\n' +
    '  "issues": [\n' +
    '    {\n' +
    '      "rule": "Condition X (Name)",\n' +
    '      "severity": "KRITISCH" | "WARNUNG",\n' +
    '      "path": "src/path/to/file.tsx",\n' +
    '      "line": number,\n' +
    '      "end_line": number,\n' +
    '      "exact_quote": "max 2 lines of the trigger code",\n' +
    '      "german_critique": "Professional German explanation, keep variable names and technical terms in English."\n' +
    '    }\n' +
    '  ],\n' +
    '  "summary": "Short German summary of all findings."\n' +
    '}\n\n' +
    'If no issues are found, return: { "has_slop": false, "issues": [], "summary": "Kein AI-Slop gefunden." }\n\n' +
    'CRITICAL: The "exact_quote" MUST NOT exceed 2 lines of code. Quote ONLY the specific trigger line. ' +
    'The "path" and "line" fields are MANDATORY for every issue \u2014 they are used to post inline comments on the PR.';

const OUTPUT_FORMAT_RAG =
    '=== CRITICAL INSTRUCTION ===\n\n' +
    "You MUST ONLY evaluate ADDED lines (lines starting with '+'). " +
    "Removed lines ('-') and context lines are ONLY for understanding the change. " +
    'DO NOT flag issues in removed or context lines.\n\n' +
    '=== OUTPUT FORMAT ===\n\n' +
    'For each issue, the "path" field MUST be the filename from the diff header.\n' +
    'The "line" field MUST be the line number in the NEW file (right side of the diff).\n\n' +
    'You MUST format the "german_critique" string EXACTLY according to this strict template:\n' +
    '"\uD83D\uDEAB [Severity] - [Kurze Erkl\u00E4rung des Anti-Patterns].\n' +
    '\uD83D\uDCDA Evidence: Laut [evidence_citation] f\u00FChrt dieses Muster systematisch zu Fehlern.\n' +
    '\uD83D\uDCA1 Fix-Vorschlag: [Dein Vorschlag]"\n\n' +
    '- [Severity] is either KRITISCH or WARNUNG.\n' +
    '- [evidence_citation] MUST be the precise Rule ID from THE LAW (e.g. SEC-001) or the file path from EVIDENCE if it\'s a DRY violation.\n\n' +
    'Return ONLY a valid JSON object with this schema:\n' +
    '{\n' +
    '  "has_slop": boolean,\n' +
    '  "issues": [\n' +
    '    {\n' +
    '      "rule": "Condition X (Name)",\n' +
    '      "severity": "KRITISCH" | "WARNUNG",\n' +
    '      "path": "src/path/to/file.tsx",\n' +
    '      "line": number,\n' +
    '      "end_line": number,\n' +
    '      "exact_quote": "max 2 lines of the trigger code",\n' +
    '      "german_critique": "\uD83D\uDEAB KRITISCH - Leerer Catch-Block.\\\\n\uD83D\uDCDA Evidence: Laut SEC-001 f\u00FChrt systematisch zu Fehlern.\\\\n\uD83D\uDCA1 Fix-Vorschlag: Re-Throw den Error...",\n' +
    '      "fixed_code_snippet": "throw new Error(e.message);"\n' +
    '    }\n' +
    '  ],\n' +
    '  "summary": "Short German summary of all findings."\n' +
    '}\n\n' +
    'If no issues are found, return: { "has_slop": false, "issues": [], "summary": "Kein AI-Slop gefunden." }\n\n' +
    'CRITICAL INSTRUCTIONS FOR "fixed_code_snippet":\n' +
    '- It MUST contain ONLY the corrected code to replace the lines between "line" and "end_line".\n' +
    '- NO markdown wrappers (do not wrap in triple backticks), just the raw code.\n' +
    '- NO explanations.\n' +
    '- It MUST be a drop-in replacement for the exact lines flagged, preserving indentation where possible.\n\n' +
    'CRITICAL: The "exact_quote" MUST NOT exceed 2 lines of code. ' +
    'The "path" and "line" fields are MANDATORY for every issue.';

const VARIANT_OUTPUT_FORMATS: Record<Exclude<PromptVariant, 'fixer'>, string> = {
    reviewer_raw: OUTPUT_FORMAT_RAW,
    reviewer_diff: OUTPUT_FORMAT_DIFF,
    reviewer_rag: OUTPUT_FORMAT_RAG,
};

// =============================================================================
// Fixer Prompt (standalone, keine Conditions)
// =============================================================================

const FIXER_PROMPT =
    'You are the "Slop-Fixer" Principal Engineer, an elite React/Next.js architect. You are the second step ' +
    'in an automated pipeline designed to eradicate AI-Slop from codebases.\n\n' +
    'You will receive two inputs:\n' +
    '1. ORIGINAL_CODE: A piece of flawed, AI-generated code.\n' +
    '2. CRITIQUE_JSON: A structured JSON array of architectural violations found in that code. Each violation ' +
    'contains "start_line", "end_line", and an "exact_quote" indicating the trigger line of the flaw.\n\n' +
    'Your sole objective is to rewrite the ORIGINAL_CODE to resolve every single issue listed in the ' +
    'CRITIQUE_JSON, transforming it into production-ready, clean, and highly performant code.\n\n' +
    '=== REFACTORING RULES ===\n\n' +
    '1. Eradicate the Slop: You must completely resolve the issues pointed out in the critique. Use the line ' +
    'numbers and "exact_quote" from the JSON to locate the precise structural flaws in the ORIGINAL_CODE. ' +
    "For example, if flagged for 'Derived State', remove the useState/useEffect combo entirely and derive " +
    "the value directly in the render body. If flagged for 'Network Race Condition', implement an " +
    'AbortController or rewrite the fetch logic using modern patterns.\n\n' +
    '2. Preserve Business Logic: Do NOT alter the intended UX, API endpoints, styling logic, or core business rules. ' +
    'Only change the architecture and structural implementation.\n\n' +
    '3. Eliminate LLM Footprints & PRESERVE CONTRACTS: Delete all didactical comments (e.g., "// Step 1: Initialize...") ' +
    'and remove all emojis. CRITICAL: DO NOT rename existing variables, functions, props, or component names unless they ' +
    "are exclusively single-letter (e.g., 'i', 'x') or completely meaningless (e.g., 'data', 'temp1'). Preserving exact " +
    'naming is mandatory for API-Contract stability.\n\n' +
    '4. Ecosystem Mastery: Use native JavaScript array methods, stable closures (functional state updates), and correct ' +
    'React 19 / Next.js 15 paradigms.\n\n' +
    '=== OUTPUT FORMAT ===\n\n' +
    '1. Output ONLY the raw, refactored code.\n' +
    '2. Absolutely NO markdown formatting (DO NOT wrap the code in ```tsx, ```typescript, or any other formatting blocks).\n' +
    '3. Do NOT output greetings, explanations, JSDoc summaries of your fixes, or conversational text before or after the code. ' +
    'The output must be directly compilable by the system.';
