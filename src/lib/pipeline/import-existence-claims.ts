/**
 * HAL-002 auf einer Import-Zeile (LANGUAGE_COVERAGE_SPEC §6.5, Variante a).
 *
 * HAL-002 lässt das Modell aus eigenem Wissen urteilen, ob eine API existiert.
 * Für einen Import oder ein Paket endet dieses Wissen am Trainingsstand: im
 * Schattenlauf vom 2026-09-30 nannten Draft und Verifier
 * `org.springframework.boot.restclient.RestTemplateBuilder` nicht existent,
 * obwohl es die Klasse seit Spring Boot 4 gibt (Job `9f8dccf4`). Ob ein Import
 * existiert, hängt an der Version der Abhängigkeit, und die sieht kein Modell.
 *
 * Deshalb endet ein solcher Claim als WARNING statt CRITICAL, in jeder
 * Sprache — wie SEC-035 im Pre-Scanner für Import-Namen. HAL-002 auf einem
 * Aufruf (`strings.ToLowerCase(...)`) bleibt CRITICAL: dort zitiert das
 * Finding die Verwendung, nicht die Herkunft. Im Zweifel bleibt es CRITICAL:
 * jedes Muster verlangt die ganze Zeile oder das ganze Zitat.
 */
import type { PipelineIssue } from '@/lib/pipeline/types';

const HAL_002_RULE_PATTERN = /\bHAL-002\b/;

const QUOTED_MODULE = String.raw`['"][^'"]+['"]`;
const JS_BINDINGS = String.raw`[\w$*{},\s]+`;

/** Eine Zeile, die nur sagt, woher ein Name kommt. */
const IMPORT_LINE_PATTERNS: readonly RegExp[] = [
    new RegExp(String.raw`^import\s+(type\s+)?(${JS_BINDINGS}\s+from\s+)?${QUOTED_MODULE};?$`), // JS/TS, Go einzeilig
    new RegExp(String.raw`^\}\s*from\s+${QUOTED_MODULE};?$`),                                   // JS/TS, letzte Zeile eines Blocks
    new RegExp(String.raw`^export\s+(type\s+)?${JS_BINDINGS}\s+from\s+${QUOTED_MODULE};?$`),    // JS/TS Re-Export
    new RegExp(String.raw`^((const|let|var)\s+[\w$]+\s*=\s*)?(await\s+)?(require|import)\(\s*${QUOTED_MODULE}\s*\);?$`),
    new RegExp(String.raw`^(const|let|var)\s+\{[\w$\s,:]+\}\s*=\s*require\(\s*${QUOTED_MODULE}\s*\);?$`),
    /^import\s+(static\s+)?[\w.]+(\.\*)?;$/,                 // Java
    /^import\s+[\w.]+(\s+as\s+\w+)?(\s*,\s*[\w.]+(\s+as\s+\w+)?)*$/, // Python, Kotlin, Scala
    /^from\s+[\w.]+\s+import\s+[\w*]+(\s+as\s+\w+)?(\s*,\s*\w+(\s+as\s+\w+)?)*$/, // Python
    /^import\s+(?:[\w.]+\s+)?"[^"\s]+"$/,                    // Go mit Alias
    /^#\s*include\s*[<"][^>"]+[>"]$/,                        // C/C++
    /^pub(\([^)]*\))?\s+use\s+[\w:{},\s*]+;$/,               // Rust
    /^use\s+[\w:{},\s*]+;$/,                                 // Rust
    /^extern\s+crate\s+\w+;$/,                               // Rust
    /^using\s+(static\s+)?(\w+\s*=\s*)?[\w.]+;$/,            // C#
    /^using\s+(module|namespace|assembly)\s+[\w.\\/:-]+$/i,  // PowerShell
    /^Import-Module\s+(-Name\s+)?['"]?[\w.\\/:-]+['"]?$/i,   // PowerShell
    /^#Requires\s+-Modules\s+[\w.,\s-]+$/i,                  // PowerShell
];

/** Ein mehrzeiliger Import als Ganzes, Zeilenumbrüche zu Leerzeichen gefaltet. */
const IMPORT_BLOCK_PATTERNS: readonly RegExp[] = [
    new RegExp(String.raw`^import\s+(type\s+)?${JS_BINDINGS}\s+from\s+${QUOTED_MODULE};?$`),
    /^from\s+[\w.]+\s+import\s+\([\w\s,*]+\)$/,
    /^import\s+\((\s*(?:[\w.]+\s+)?"[^"\s]+")+\s*\)$/,
];

/** Eine Zeile innerhalb eines Go-`import (...)`-Blocks: optionaler Alias, dann der Pfad. */
const GO_IMPORT_BLOCK_LINE_PATTERN = /^(?!return\b)(?:[\w.]+\s+)?"[^"\s]+"$/;
const TRAILING_LINE_COMMENT_PATTERN = /\s+(\/\/|#(?!Requires|\s*include)).*$/i;

const IMPORT_EXISTENCE_NOTE =
    'Reported as a warning: whether an import or package exists depends on the dependency version, '
    + 'which this review cannot see.';

function isImportLine(quotedLine: string, filePath: string): boolean {
    if (IMPORT_LINE_PATTERNS.some((importPattern) => importPattern.test(quotedLine))) return true;
    return filePath.toLowerCase().endsWith('.go') && GO_IMPORT_BLOCK_LINE_PATTERN.test(quotedLine);
}

/** Zitat-Zeilen ohne Diff-Präfix, Einrückung, Zeilenkommentar und Leerzeilen. */
function readQuotedLines(exactQuote: string): string[] {
    return exactQuote
        .split(/\r?\n/)
        .map((quotedLine) => quotedLine.replace(/^\+/, '').replace(TRAILING_LINE_COMMENT_PATTERN, '').trim())
        .filter((quotedLine) => quotedLine.length > 0);
}

/**
 * true = das Finding ist HAL-002 und zitiert nur Imports: jede Zeile für sich,
 * oder das ganze Zitat als ein mehrzeiliger Import. Ein leeres Zitat belegt
 * nichts.
 */
export function isImportExistenceClaim(issue: PipelineIssue): boolean {
    if (!HAL_002_RULE_PATTERN.test(issue.rule)) return false;
    const quotedLines = readQuotedLines(issue.exactQuote);
    if (quotedLines.length === 0) return false;
    if (quotedLines.every((quotedLine) => isImportLine(quotedLine, issue.path))) return true;
    const foldedQuote = quotedLines.join(' ');
    return IMPORT_BLOCK_PATTERNS.some((blockPattern) => blockPattern.test(foldedQuote));
}

/**
 * Validation-Boundary neben `normalizeGatekeeperIssue`: gilt für jeden
 * Reviewer-Pass (Draft, pro-direct, Zweitmeinung), vor dem Verifier. Alles
 * andere bleibt unverändert.
 */
export function downgradeImportExistenceClaim(issue: PipelineIssue): PipelineIssue {
    if (issue.severity !== 'CRITICAL' || !isImportExistenceClaim(issue)) return issue;
    return {
        ...issue,
        severity: 'WARNING',
        critique: `${issue.critique}\n\n${IMPORT_EXISTENCE_NOTE}`,
    };
}
