/**
 * Prompt Builder — Cache-optimale Prompt-Komposition.
 *
 * Baut den System-Prompt als STABILEN Per-Repo-Prefix:
 * 1. Base Persona (pro Variante)
 * 2. ALLE aktiven Conditions (KEIN Scope-Filter mehr im Prompt)
 * 3. The Law (statisch gerenderte Golden Standards)
 * 4. Output Format (pro Variante)
 *
 * Der Prefix ist damit byte-identisch über alle Scans eines Repos und
 * triggert Geminis Implicit Context Caching. Alles Diff-Variable (Evidence,
 * Diff) gehört in den User-Content ans Ende — NIEMALS hierher.
 *
 * Smart Context Detection läuft nicht mehr im Prompt, sondern als
 * Post-Filter auf den Findings (filterIssuesByScope).
 */
import { CONDITION_REGISTRY } from '@/lib/pipeline/conditions';
import type { ConditionScope, ReviewCondition } from '@/lib/pipeline/conditions';
import type { PromptConfig, PipelineIssue } from '@/lib/pipeline/types';

// =============================================================================
// Public API
// =============================================================================

type PromptVariant = 'reviewer_raw' | 'reviewer_diff' | 'reviewer_rag' | 'fixer';

export type { PromptVariant };

/**
 * Baut einen vollständigen System-Prompt für die angegebene Variante.
 *
 * WICHTIG (Cache-Contract): Das Ergebnis darf für ein Repo nur von
 * config.activeConditionIds und lawBlock abhängen — nie vom einzelnen Diff.
 *
 * @param variant - Die Prompt-Variante (raw, diff, rag, fixer)
 * @param config - Aktive Conditions des Repos
 * @param lawBlock - Statisch gerenderter Golden-Standards-Block (aus @/lib/law)
 * @returns Der zusammengesetzte System-Prompt
 */
export function buildPrompt(variant: PromptVariant, config: PromptConfig, lawBlock: string = ''): string {
    if (variant === 'fixer') {
        return FIXER_PROMPT;
    }

    const persona = VARIANT_PERSONAS[variant];
    const conditionsBlock = buildConditionsBlock([...config.activeConditionIds], variant);
    const outputFormat = VARIANT_OUTPUT_FORMATS[variant];

    return [persona, conditionsBlock, lawBlock, outputFormat]
        .filter((promptSection) => promptSection.length > 0)
        .join('\n\n');
}

// =============================================================================
// Findings Post-Filter (ehemals Smart Context Detection im Prompt)
// =============================================================================

const CONDITION_NUMBER_PATTERN = /Condition (\d+)/;

/**
 * Verwirft Findings, deren Condition-Scope nicht zu den PR-Dateitypen passt
 * (z.B. React-Regeln in einem PR ohne React-Dateien).
 *
 * Repliziert die frühere Prompt-seitige Scope-Filterung PR-weit: Scopes werden
 * aus ALLEN PR-Dateipfaden abgeleitet, nicht pro Finding-Datei. Findings ohne
 * "Condition N"-Referenz (z.B. Law-Regeln) passieren ungefiltert.
 */
export function filterIssuesByScope(
    issues: readonly PipelineIssue[],
    config: PromptConfig,
): PipelineIssue[] {
    if (config.overrideSmartDetection) {
        return [...issues];
    }

    const applicableScopes = detectApplicableScopes(config.filePaths);

    return issues.filter((issue) => {
        const conditionNumberMatch = CONDITION_NUMBER_PATTERN.exec(issue.rule);
        if (!conditionNumberMatch) return true;

        const conditionId = `COND-${conditionNumberMatch[1].padStart(3, '0')}`;
        const condition = CONDITION_REGISTRY.get(conditionId);
        if (!condition) return true;

        return condition.scopes.some((scope) => applicableScopes.has(scope));
    });
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
    '      "severity": "CRITICAL" | "WARNING",\n' +
    '      "start_line": number,\n' +
    '      "end_line": number,\n' +
    '      "exact_quote": "max 2 lines of the trigger code",\n' +
    '      "critique": "Professional English explanation of the violation."\n' +
    '    }\n' +
    '  ],\n' +
    '  "summary": "Short English summary of all findings."\n' +
    '}\n\n' +
    'If no issues are found, return: { "has_slop": false, "issues": [], "summary": "No AI slop found." }\n\n' +
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
    '      "severity": "CRITICAL" | "WARNING",\n' +
    '      "path": "src/path/to/file.tsx",\n' +
    '      "line": number,\n' +
    '      "end_line": number,\n' +
    '      "exact_quote": "max 2 lines of the trigger code",\n' +
    '      "critique": "Professional English explanation of the violation."\n' +
    '    }\n' +
    '  ],\n' +
    '  "summary": "Short English summary of all findings."\n' +
    '}\n\n' +
    'If no issues are found, return: { "has_slop": false, "issues": [], "summary": "No AI slop found." }\n\n' +
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
    'You MUST format the "critique" string EXACTLY according to this strict template:\n' +
    '"\uD83D\uDEAB [Severity] - [Short explanation of the anti-pattern].\n' +
    '\uD83D\uDCDA Evidence: According to [evidence_citation], this pattern systematically leads to defects.\n' +
    '\uD83D\uDCA1 Suggested fix: [Your suggestion]"\n\n' +
    '- [Severity] is either CRITICAL or WARNING.\n' +
    '- [evidence_citation] MUST be the precise Rule ID from THE LAW (e.g. SEC-001) or the file path from EVIDENCE if it\'s a DRY violation.\n\n' +
    'Return ONLY a valid JSON object with this schema:\n' +
    '{\n' +
    '  "has_slop": boolean,\n' +
    '  "issues": [\n' +
    '    {\n' +
    '      "rule": "Condition X (Name)",\n' +
    '      "severity": "CRITICAL" | "WARNING",\n' +
    '      "path": "src/path/to/file.tsx",\n' +
    '      "line": number,\n' +
    '      "end_line": number,\n' +
    '      "exact_quote": "max 2 lines of the trigger code",\n' +
    '      "critique": "\uD83D\uDEAB CRITICAL - Empty catch block.\\\\n\uD83D\uDCDA Evidence: According to SEC-001, this pattern systematically leads to defects.\\\\n\uD83D\uDCA1 Suggested fix: Re-throw the error...",\n' +
    '      "fixed_code_snippet": "throw new Error(e.message);"\n' +
    '    }\n' +
    '  ],\n' +
    '  "summary": "Short English summary of all findings."\n' +
    '}\n\n' +
    'If no issues are found, return: { "has_slop": false, "issues": [], "summary": "No AI slop found." }\n\n' +
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
