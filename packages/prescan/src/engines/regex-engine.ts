/**
 * Regex-Engine — Zeilen-Regeln auf Dateiinhalt (Cloud + CLI).
 *
 * Läuft auf dem VOLLEN Inhalt (bzw. den Patch-Zeilen im Degraded Mode);
 * der Added-Line-Filter passiert zentral in runPrescan. Enthält den
 * PROC-013-Deobfuskations-Pass: -EncodedCommand-Payloads werden dekodiert
 * und als virtueller Inhalt der Ursprungszeile gescannt.
 */
import { RULE_REGISTRY } from '../rules/registry';
import { isProseFile } from '../language';
import type { PrescanLanguage } from '../language';
import type { PrescanFinding, PrescanSeverity } from '../types';

interface RegexLineRule {
    readonly ruleId: string;
    /** null = jede Sprache. */
    readonly languages: readonly PrescanLanguage[] | null;
    readonly matches: (line: string) => boolean;
}

// =============================================================================
// SEC-005 — Hardcoded Secrets (Provider-Formate + Entropie)
// =============================================================================

const SECRET_PROVIDER_PATTERNS: readonly RegExp[] = [
    /GOCSPX-[A-Za-z0-9_-]{20,}/,                                    // Google OAuth Client Secret
    /AIza[0-9A-Za-z_-]{30,}/,                                       // Google API Key
    /\bsk-[A-Za-z0-9_-]{20,}/,                                      // OpenAI/Stripe-artige Secret Keys
    /AKIA[0-9A-Z]{16}/,                                             // AWS Access Key ID
    /\bgh[pousr]_[A-Za-z0-9]{30,}/,                                 // GitHub Tokens (ghp_, gho_, ghu_, ghs_, ghr_)
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,       // PEM
    /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
];

const SECRET_ASSIGNMENT_PATTERN = /(key|secret|passw|token)[^=:]{0,32}[=:]\s*["']([^"']{16,})["']/i;
/** Zeilen, die Secrets nur referenzieren statt enthalten. */
const SECRET_LOOKUP_EXEMPTION = /process\.env|os\.environ|getenv|import\.meta\.env|secretKeyRef|\$\{/;

export function shannonEntropy(candidateValue: string): number {
    const charCounts = new Map<string, number>();
    for (const character of candidateValue) {
        charCounts.set(character, (charCounts.get(character) ?? 0) + 1);
    }
    let entropy = 0;
    for (const count of charCounts.values()) {
        const probability = count / candidateValue.length;
        entropy -= probability * Math.log2(probability);
    }
    return entropy;
}

function matchesProviderSecret(line: string): boolean {
    return !SECRET_LOOKUP_EXEMPTION.test(line)
        && SECRET_PROVIDER_PATTERNS.some((pattern) => pattern.test(line));
}

function matchesSecretLine(line: string): boolean {
    if (SECRET_LOOKUP_EXEMPTION.test(line)) return false;
    if (SECRET_PROVIDER_PATTERNS.some((pattern) => pattern.test(line))) return true;

    const assignmentMatch = SECRET_ASSIGNMENT_PATTERN.exec(line);
    if (!assignmentMatch) return false;
    return shannonEntropy(assignmentMatch[2]) >= 4.0;
}

// =============================================================================
// Zeilen-Regeln
// =============================================================================

const WEAK_HASH_PATTERN = /(getInstance\s*\(\s*["'](MD4|MD5|SHA-?1)["']|hashlib\.(md4|md5|sha1)\b|createHash\s*\(\s*["'](md4|md5|sha-?1)["'])/i;

const WEAK_CIPHER_PATTERN = /(Cipher\.getInstance|createCipheriv|createCipher)\s*\(\s*["'][^"']*(ECB|DESede|(?<![A-Z])DES(?![A-Za-z])|RC2|RC4|Blowfish)/i;
/** Java: getInstance("AES") ohne Modus fällt auf ECB zurück. */
const BARE_AES_PATTERN = /Cipher\.getInstance\s*\(\s*["'](AES|DES)["']\s*\)/;

const TLS_DISABLED_PATTERN = /(verify\s*=\s*False|rejectUnauthorized\s*:\s*false|InsecureSkipVerify\s*:\s*true|CURLOPT_SSL_VERIFY(PEER|HOST)\s*,\s*0|NODE_TLS_REJECT_UNAUTHORIZED[^\n]*=\s*["']?0)/;

const CORS_WILDCARD_PATTERN = /Access-Control-Allow-Origin["']?\s*[:,=]?\s*["']?\*/i;
const CORS_REFLECTED_PATTERN = /Access-Control-Allow-Origin[^\n]*(req(uest)?\.headers[[.]["']?origin|\borigin\s*\))/i;

const SCANF_PATTERN = /\b[fs]?scanf\s*\(/;
const SCANF_UNBOUNDED_FORMAT = /%[sl[]/;
const SCANF_BOUNDED_FORMAT = /%\d+(s|\[)/;

const BANNED_LIBC_PATTERN = /\b(gets|strcpy|strcat|sprintf|vsprintf|stpcpy|alloca|tmpnam|mktemp)\s*\(/;

const PS_INVOKE_EXPRESSION = /\b(IEX|Invoke-Expression)\b/i;
const PS_DOWNLOAD_PATTERN = /(Invoke-WebRequest|\biwr\b|DownloadString|DownloadFile|Net\.WebClient|Start-BitsTransfer)/i;
const PS_BYPASS_PATTERN = /(-ExecutionPolicy\s+(Bypass|Unrestricted)|AmsiUtils|amsiInitFailed|-EncodedCommand\b|\s-enc\s)/i;
const LOLBIN_PATTERN = /\b(rundll32(\.exe)?\s|certutil\s+-urlcache|mshta(\.exe)?\s|Invoke-Mimikatz|procdump[^\n]*lsass|sekurlsa::)/i;

/**
 * HAL-002 — halluzinierte Stdlib-APIs, die es nachweislich NICHT gibt.
 * Bewusst eine harte Allow-Liste bekannter LLM-Erfindungen pro Sprache:
 * jeder Eintrag ist per Sprachreferenz falsifizierbar, daher 0-FP-fähig.
 */
const GO_HALLUCINATED_API_PATTERN = /\bstrings\.(ToLowerCase|ToUpperCase|Titleize|Reversed)\s*\(|\bfmt\.Printfln\s*\(/;

const SATD_MARKER_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/;
const SATD_AI_PATTERN = /(copilot|chatgpt|gpt|gemini|claude|\bllm\b|ai[- _]generated)/i;
const TICKET_REFERENCE_PATTERN = /([A-Z]{2,}-\d+|#\d+)/;

const REGEX_LINE_RULES: readonly RegexLineRule[] = [
    { ruleId: 'SEC-005', languages: null, matches: matchesSecretLine },
    {
        ruleId: 'SEC-014',
        languages: ['python', 'java', 'typescript', 'tsx', 'javascript'],
        matches: (line) => WEAK_HASH_PATTERN.test(line),
    },
    {
        ruleId: 'SEC-015',
        languages: ['java', 'typescript', 'tsx', 'javascript'],
        matches: (line) => WEAK_CIPHER_PATTERN.test(line) || BARE_AES_PATTERN.test(line),
    },
    { ruleId: 'SEC-017', languages: null, matches: (line) => TLS_DISABLED_PATTERN.test(line) },
    {
        ruleId: 'SEC-024',
        languages: null,
        matches: (line) => CORS_WILDCARD_PATTERN.test(line) || CORS_REFLECTED_PATTERN.test(line),
    },
    {
        ruleId: 'SEC-027',
        languages: ['c', 'cpp'],
        matches: (line) => SCANF_PATTERN.test(line)
            && SCANF_UNBOUNDED_FORMAT.test(line)
            && !SCANF_BOUNDED_FORMAT.test(line),
    },
    { ruleId: 'SEC-029', languages: ['c', 'cpp'], matches: (line) => BANNED_LIBC_PATTERN.test(line) },
    {
        ruleId: 'SEC-048',
        languages: ['powershell'],
        matches: (line) => PS_INVOKE_EXPRESSION.test(line) && PS_DOWNLOAD_PATTERN.test(line),
    },
    { ruleId: 'SEC-049', languages: ['powershell'], matches: (line) => PS_BYPASS_PATTERN.test(line) },
    { ruleId: 'SEC-050', languages: null, matches: (line) => LOLBIN_PATTERN.test(line) },
    { ruleId: 'HAL-002', languages: ['go'], matches: (line) => GO_HALLUCINATED_API_PATTERN.test(line) },
    {
        ruleId: 'MAINT-006',
        languages: null,
        matches: (line) => SATD_MARKER_PATTERN.test(line)
            && SATD_AI_PATTERN.test(line)
            && !TICKET_REFERENCE_PATTERN.test(line),
    },
];

/**
 * Prosa-Dateien (Markdown, Übersetzungskataloge): ein Schlüssel in Provider-
 * Format ist auch dort ein Leck. Die Entropie-Heuristik und alle Regeln über
 * Code-Verhalten treffen dort nur Zitate und UI-Texte.
 */
const PROSE_LINE_RULES: readonly RegexLineRule[] = [
    { ruleId: 'SEC-005', languages: null, matches: matchesProviderSecret },
];

// =============================================================================
// Engine-Einstieg
// =============================================================================

export interface RegexEngineInput {
    readonly path: string;
    readonly language: PrescanLanguage;
    /** Zeilennummer (1-basiert) → Zeilentext. Voll- oder Patch-rekonstruiert. */
    readonly lines: ReadonlyMap<number, string>;
}

export function runRegexEngine(input: RegexEngineInput): PrescanFinding[] {
    const findings: PrescanFinding[] = [];
    const proseFile = isProseFile(input.path);
    const lineRules = proseFile ? PROSE_LINE_RULES : REGEX_LINE_RULES;

    for (const [lineNumber, lineText] of input.lines) {
        const scannableTexts = buildScannableTexts(input.language, lineText);
        for (const rule of lineRules) {
            if (rule.languages !== null && !rule.languages.includes(input.language)) continue;
            if (!scannableTexts.some((candidateText) => rule.matches(candidateText))) continue;
            findings.push(buildRegexFinding(rule.ruleId, input.path, lineNumber, lineText));
        }
    }

    if (!proseFile) findings.push(...collectOverblankingFindings(input));
    return findings;
}

/** PROC-013: Base64-EncodedCommand-Payloads dekodieren und mitscannen. */
const ENCODED_COMMAND_PATTERN = /-e(?:nc|ncodedcommand)?\s+["']?([A-Za-z0-9+/=]{16,})["']?/i;

function buildScannableTexts(language: PrescanLanguage, lineText: string): readonly string[] {
    if (language !== 'powershell') return [lineText];

    const encodedMatch = ENCODED_COMMAND_PATTERN.exec(lineText);
    if (!encodedMatch) return [lineText];

    try {
        const decodedPayload = Buffer.from(encodedMatch[1], 'base64').toString('utf16le');
        return [lineText, decodedPayload];
    } catch {
        return [lineText];
    }
}

/** MAINT-005: >2 aufeinanderfolgende Leerzeilen. */
function collectOverblankingFindings(input: RegexEngineInput): PrescanFinding[] {
    const findings: PrescanFinding[] = [];
    const sortedLineNumbers = [...input.lines.keys()].sort((a, b) => a - b);

    let blankRunStart = 0;
    let blankRunLength = 0;
    let previousLineNumber = Number.NEGATIVE_INFINITY;

    for (const lineNumber of sortedLineNumbers) {
        const isBlank = (input.lines.get(lineNumber) ?? '').trim() === '';
        const isContiguous = lineNumber === previousLineNumber + 1;

        if (isBlank && isContiguous && blankRunLength > 0) {
            blankRunLength += 1;
        } else if (isBlank) {
            blankRunStart = lineNumber;
            blankRunLength = 1;
        } else {
            if (blankRunLength > 2) {
                findings.push(buildRegexFinding('MAINT-005', input.path, blankRunStart, '', blankRunStart + blankRunLength - 1));
            }
            blankRunLength = 0;
        }
        previousLineNumber = lineNumber;
    }

    if (blankRunLength > 2) {
        findings.push(buildRegexFinding('MAINT-005', input.path, blankRunStart, '', blankRunStart + blankRunLength - 1));
    }

    return findings;
}

function buildRegexFinding(
    ruleId: string,
    path: string,
    line: number,
    lineText: string,
    endLine?: number,
): PrescanFinding {
    const descriptor = RULE_REGISTRY.get(ruleId);
    const severity: PrescanSeverity = descriptor?.severity ?? 'WARNING';
    return {
        ruleId,
        ruleTitle: descriptor?.title ?? ruleId,
        severity,
        path,
        line,
        endLine: endLine ?? line,
        exactQuote: lineText.trim().substring(0, 200),
        explanation: descriptor?.explanation ?? '',
        fixTemplate: descriptor?.fixTemplate,
        engine: 'regex',
        fileLevel: false,
    };
}
