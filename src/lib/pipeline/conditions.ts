/**
 * Condition Registry — Single Source of Truth für alle Review-Regeln.
 *
 * Jede Condition ist ein typisiertes Objekt mit stabiler ID, Scope-Tags
 * und dem exakten Prompt-Text, der in den LLM-Prompt injiziert wird.
 *
 * Die Conditions werden NICHT mehr in monolithischen Prompt-Strings dupliziert,
 * sondern vom PromptBuilder dynamisch zusammengesetzt.
 */

// =============================================================================
// Types
// =============================================================================

/** Sprachkategorien, auf die eine Condition anwendbar ist. */
type ConditionScope = 'universal' | 'react' | 'nextjs' | 'typescript';

/** Ein einzelnes, atomares Review-Kriterium. */
interface ReviewCondition {
    readonly id: string;
    readonly name: string;
    readonly category: 'macro' | 'react_nextjs';
    readonly scopes: readonly ConditionScope[];
    readonly promptText: string;
}

export type { ConditionScope, ReviewCondition };

// =============================================================================
// Registry
// =============================================================================

const CONDITIONS: readonly ReviewCondition[] = [
    {
        id: 'COND-001',
        name: 'Silent Error Swallowing',
        category: 'macro',
        scopes: ['universal'],
        promptText:
            "Condition 1 (Silent Error Swallowing): A 'catch' block is empty, contains only passive logging " +
            "(e.g., 'console.log(e)'), or returns a null/fallback value without rethrowing or triggering a compensation mechanism.",
    },
    {
        id: 'COND-002',
        name: 'Type Capitulation',
        category: 'macro',
        scopes: ['typescript'],
        promptText:
            "Condition 2 (Type Capitulation): Usage of 'any', '@ts-ignore', or redundant 'Object' casts " +
            'exceeds 5% of type declarations.',
    },
    {
        id: 'COND-003',
        name: 'Lexical Slop',
        category: 'macro',
        scopes: ['universal'],
        promptText:
            "Condition 3 (Lexical Slop): Emojis are present in code comments, or variables use meaningless, " +
            "generic clusters (e.g., 'data', 'result', 'temp1', 'item').",
    },
    {
        id: 'COND-004',
        name: 'Context Blindness / DRY',
        category: 'macro',
        scopes: ['universal'],
        promptText:
            'Condition 4 (Context Blindness/DRY): The code manually implements standard utility logic ' +
            '(e.g., bubble sorting, manual date string concatenation) instead of using native methods or ' +
            'assuming standard ecosystem imports.',
    },
    {
        id: 'COND-005',
        name: 'Dead Code',
        category: 'macro',
        scopes: ['universal'],
        promptText:
            'Condition 5 (Dead Code): There are initialized variables that are only written to but never read, ' +
            'or unused imports.',
    },
    {
        id: 'COND-006',
        name: "'use client' Infection",
        category: 'react_nextjs',
        scopes: ['nextjs'],
        promptText:
            "Condition 6 ('use client' Infection): The directive 'use client' is placed at the top of a " +
            "Next.js App Router layout file ('layout.tsx') or root 'page.tsx'.",
    },
    {
        id: 'COND-007',
        name: 'Derived State Anti-Pattern',
        category: 'react_nextjs',
        scopes: ['react'],
        promptText:
            "Condition 7 (Derived State Anti-Pattern): A 'useEffect' hook contains ONLY state mutators " +
            "('setState') that are calculated based on other local state variables or props.",
    },
    {
        id: 'COND-008',
        name: 'Network Race Condition',
        category: 'react_nextjs',
        scopes: ['react'],
        promptText:
            "Condition 8 (Network Race Condition): A 'fetch' or asynchronous network call is made inside a " +
            "'useEffect' block without the instantiation and usage of an 'AbortController'.",
    },
    {
        id: 'COND-009',
        name: 'Boolean Array Redundancy',
        category: 'react_nextjs',
        scopes: ['react'],
        promptText:
            'Condition 9 (Boolean Array Redundancy): Declaration of more than two correlating status booleans ' +
            "(e.g., 'const [isLoading]', 'const [isError]', 'const [isSuccess]') in the same component instead " +
            'of using a state machine or union type.',
    },
    {
        id: 'COND-010',
        name: 'Stale Closure Risk',
        category: 'react_nextjs',
        scopes: ['react'],
        promptText:
            "Condition 10 (Stale Closure Risk): A 'useEffect', 'useCallback', or 'setInterval' has an empty " +
            "dependency array '[]' but references reactive local state bindings inside its callback.",
    },
    {
        id: 'COND-011',
        name: 'Cyclomatic Explosion / God Component',
        category: 'react_nextjs',
        scopes: ['react'],
        promptText:
            'Condition 11 (Cyclomatic Explosion / God Component): The JSX return statement contains nesting ' +
            "deeper than 4 levels (if/else, ternaries, logical ANDs), or a component contains more than 2 'useEffect' declarations.",
    },
] as const;

/** Immutable Registry aller Conditions, indiziert nach ID. */
export const CONDITION_REGISTRY: ReadonlyMap<string, ReviewCondition> = new Map(
    CONDITIONS.map((condition) => [condition.id, condition]),
);

/** Convenience-Liste aller Condition-IDs (für "alle aktiviert"-Default). */
export const ALL_CONDITION_IDS: readonly string[] = CONDITIONS.map(
    (condition) => condition.id,
);
