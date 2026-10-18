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
    {
        // REPO_CONTEXT_SPEC §7.1. Nicht je Repo einzeln wählbar: aktiv genau dann,
        // wenn `pipeline_config.repoContext.enabled` gilt (defaults.ts).
        id: 'COND-012',
        name: 'Repository Mismatch',
        category: 'macro',
        scopes: ['universal'],
        promptText:
            'Condition 12 (Repository Mismatch): Applies ONLY when the request contains a REPOSITORY CONTEXT section. ' +
            'The added code contradicts a file shown there in exactly one of these ways: ' +
            '(1) it reads or writes a database table or column that the shown schema does not define; ' +
            '(2) it imports or requires a third-party package that the shown manifest of its module does not declare ' +
            '(standard-library, built-in and relative imports, path aliases such as \'@/…\' and packages of the same ' +
            'workspace never count, nor does a package whose distribution name ' +
            "differs from its import name, such as 'pyyaml' for 'yaml'); " +
            '(3) it calls an API that the major version pinned in the shown manifest has removed; ' +
            '(4) it adds a route, handler or module that the shown entry point never loads, or starts a second server next to it; ' +
            '(5) it keeps application state in process memory although the shown schema has a table for that data; ' +
            '(6) it adds a second database or database driver next to the one the shown files already use. ' +
            'Report only what a shown file proves; a file that is not shown proves nothing.',
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

/** "Condition 1 (Silent Error Swallowing)" — die Referenz inkl. optionalem Klammer-Namen (eine Klammer-Ebene tief). */
const CONDITION_LABEL_PATTERN = /^Condition (\d+)(?:\s*\((?:[^()]|\([^()]*\))*\))?/;

/**
 * Nutzer-Label einer Condition-Referenz: "Condition 1 (…)" → "COND-001
 * (Silent Error Swallowing)" — dieselbe Form "ID (Titel)" wie Law- und
 * Pre-Scanner-Findings. Die Nummer ist Prompt-Vokabular, kein Produkt-Label
 * (ROADMAP §3, Befund 2026-09-30: "unslop(Condition 1 (…))" im Problems-Panel).
 *
 * Intern bleibt "Condition N" die Referenz (Validation, Scope-Filter,
 * Finding-ID); umgeschrieben wird nur am Report-Merge-Punkt
 * (collectReportableIssues). Unbekannte Nummern und Nicht-Condition-Regeln
 * passieren unverändert; ein Anhang wie " / MAINT-001" bleibt erhalten.
 */
export function presentConditionRule(ruleReference: string): string {
    const conditionMatch = CONDITION_LABEL_PATTERN.exec(ruleReference);
    if (!conditionMatch) return ruleReference;

    const condition = CONDITION_REGISTRY.get(`COND-${conditionMatch[1].padStart(3, '0')}`);
    if (!condition) return ruleReference;

    return `${condition.id} (${condition.name})${ruleReference.slice(conditionMatch[0].length)}`;
}

/**
 * Conditions, die ein Repo einzeln an- und abwählen kann. COND-012 gehört
 * nicht dazu: sie folgt `pipeline_config.repoContext.enabled`
 * (`resolveActiveConditionIds` in defaults.ts), ein zweiter Schalter daneben
 * würde nichts bewirken.
 */
export const SELECTABLE_CONDITION_IDS: readonly string[] = ALL_CONDITION_IDS.filter(
    (conditionId) => conditionId !== 'COND-012',
);
