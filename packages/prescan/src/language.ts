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
 *
 * Eingecheckte Diffs (`.diff`, `.patch`) zählen dazu: sie zitieren Code eines
 * anderen Pfads samt entfernten Zeilen und Kontext. Beleg: unslopai/test#26,
 * drei CRITICAL (SEC-017, SEC-024) auf `fixtures/rule-recall/r26-clean-config.diff`
 * (Job `4276a714`, docs/benchmarks/LARGE_PR_CAMPAIGN.md).
 */
const PROSE_EXTENSION_PATTERN = /\.(md|mdx|markdown|rst|adoc|diff|patch)$/;
const TRANSLATION_CATALOG_PATTERN =
    /(^|\/)(messages|locales?|i18n|l10n|langs?|translations|_locales)\/.*\.(json|ya?ml|properties)$|\.(po|pot|arb|xlf|xliff)$/;

export function isProseFile(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    return PROSE_EXTENSION_PATTERN.test(normalizedPath) || TRANSLATION_CATALOG_PATTERN.test(normalizedPath);
}

/**
 * Deterministische Lane (LANGUAGE_COVERAGE_SPEC §6.1): Dateitypen mit
 * mindestens einer sprachspezifischen Regel. Nur sie lösen einen Review ohne
 * Modell aus. JS/TS gehört nicht dazu, weil es die LLM-Lane erreicht; Dateien
 * mit nur den universellen Regeln (Dockerfile, Shell, SQL) und Prosa auch nicht.
 */
const DETERMINISTIC_LANE_LANGUAGES: ReadonlySet<PrescanLanguage> = new Set([
    'python', 'java', 'go', 'c', 'cpp', 'powershell', 'yaml', 'json', 'hcl',
]);
/** Python-Manifeste: SEC-035 prüft ihre Deklarationen, die Endung allein sagt das nicht. */
const DETERMINISTIC_LANE_MANIFESTS: ReadonlySet<string> = new Set(['requirements.txt', 'pyproject.toml']);

export function isDeterministicLaneFile(filePath: string): boolean {
    if (isProseFile(filePath)) return false;
    const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
    return DETERMINISTIC_LANE_MANIFESTS.has(fileName) || DETERMINISTIC_LANE_LANGUAGES.has(detectLanguage(filePath));
}

/**
 * Quellcode, den ein Leser von einer Code-Review erwartet (LANGUAGE_COVERAGE_SPEC
 * §6.2): nur diese Sprachen nennt der Hinweis „No model read …“ in einem
 * gemischten PR. Config, Daten, Styles, Markup, YAML, JSON, TOML, Workflows und
 * Binärdateien lösen ihn nicht aus — sonst trüge fast jeder JS/TS-PR mit
 * `package.json` den Hinweis. Terraform (`.tf`, `hcl`) ist Code.
 */
const SOURCE_CODE_LANGUAGES: ReadonlySet<PrescanLanguage> = new Set([
    'typescript', 'tsx', 'javascript', 'python', 'java', 'go', 'rust', 'c', 'cpp', 'powershell', 'hcl',
]);

export function isSourceCodeFile(filePath: string): boolean {
    return SOURCE_CODE_LANGUAGES.has(detectLanguage(filePath));
}

/** Test-Datei-Muster (TEST-010, pre_scanner_design.md §2). */
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$|_test\.(go|py)$|(^|\/)test_[^/]*\.py$|Test\.java$/;

export function isTestFile(filePath: string): boolean {
    return TEST_FILE_PATTERN.test(filePath.replace(/\\/g, '/'));
}
