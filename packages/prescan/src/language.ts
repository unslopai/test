/**
 * Sprach- und Dateityp-Erkennung des Pre-Scanners.
 *
 * Extension → Sprache/Grammatik-Mapping plus Test-Datei-Erkennung (TEST-010:
 * Test-Dateien sind von ARCH-001/002 ausgenommen und bekommen stattdessen
 * die Assertion-Checks TEST-001/002).
 */

export type PrescanLanguage =
    | 'typescript'
    | 'tsx'
    | 'javascript'
    | 'python'
    | 'java'
    | 'go'
    | 'rust'
    | 'c'
    | 'cpp'
    | 'powershell'
    | 'yaml'
    | 'json'
    | 'hcl'
    | 'toml'
    | 'other';

const EXTENSION_LANGUAGE_MAP: ReadonlyMap<string, PrescanLanguage> = new Map([
    ['.ts', 'typescript'],
    ['.mts', 'typescript'],
    ['.cts', 'typescript'],
    ['.tsx', 'tsx'],
    ['.jsx', 'tsx'],
    ['.js', 'javascript'],
    ['.mjs', 'javascript'],
    ['.cjs', 'javascript'],
    ['.py', 'python'],
    ['.java', 'java'],
    ['.go', 'go'],
    ['.rs', 'rust'],
    ['.c', 'c'],
    ['.h', 'c'],
    ['.cpp', 'cpp'],
    ['.cc', 'cpp'],
    ['.cxx', 'cpp'],
    ['.hpp', 'cpp'],
    ['.ps1', 'powershell'],
    ['.psm1', 'powershell'],
    ['.yaml', 'yaml'],
    ['.yml', 'yaml'],
    ['.json', 'json'],
    ['.tf', 'hcl'],
    ['.toml', 'toml'],
]);

export function detectLanguage(filePath: string): PrescanLanguage {
    const lowerPath = filePath.toLowerCase();
    const dotIndex = lowerPath.lastIndexOf('.');
    if (dotIndex === -1) return 'other';
    return EXTENSION_LANGUAGE_MAP.get(lowerPath.substring(dotIndex)) ?? 'other';
}

/** Config-/Skript-Sprachen ohne tree-sitter-Grammatik (regex + config engine only). */
const LANGUAGES_WITHOUT_GRAMMAR: ReadonlySet<PrescanLanguage> = new Set([
    'powershell', 'yaml', 'json', 'hcl', 'toml', 'other',
]);

/** Sprachen, für die eine tree-sitter-Grammatik geladen wird. */
export function hasTreeSitterGrammar(language: PrescanLanguage): boolean {
    return !LANGUAGES_WITHOUT_GRAMMAR.has(language);
}

/**
 * Prosa statt Code (LANGUAGE_COVERAGE_SPEC §4.4): Markdown zitiert unsichere
 * Muster, um sie zu erklären, und Übersetzungskataloge enthalten UI-Sätze wie
 * „API key limit reached“. Die Regex-Regeln über Code-Verhalten laufen dort
 * nicht; nur Secrets in Provider-Format bleiben ein Befund.
 */
const PROSE_EXTENSION_PATTERN = /\.(md|mdx|markdown|rst|adoc)$/;
const TRANSLATION_CATALOG_PATTERN =
    /(^|\/)(messages|locales?|i18n|l10n|langs?|translations|_locales)\/.*\.(json|ya?ml|properties)$|\.(po|pot|arb|xlf|xliff)$/;

export function isProseFile(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    return PROSE_EXTENSION_PATTERN.test(normalizedPath) || TRANSLATION_CATALOG_PATTERN.test(normalizedPath);
}

/** Test-Datei-Muster (TEST-010, pre_scanner_design.md §2). */
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$|_test\.(go|py)$|(^|\/)test_[^/]*\.py$|Test\.java$/;

export function isTestFile(filePath: string): boolean {
    return TEST_FILE_PATTERN.test(filePath.replace(/\\/g, '/'));
}
