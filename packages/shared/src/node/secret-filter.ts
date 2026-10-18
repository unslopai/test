/**
 * Lokaler Secret-Filter (MCP_SPEC.md §3.4, D6) — läuft auf dem fertigen Diff
 * VOR dem Upload. Ein Treffer führt zum harten Refusal (secret_detected);
 * es wird nichts hochgeladen.
 *
 * Das ist die einzige Ausnahme von D3 (keine lokale Logik): ein Safety-Filter,
 * keine Analyse — er produziert nie ein Finding, nur eine Verweigerung.
 *
 * Seit ROADMAP §13 (Hardening) werden ALLE übertragenen Bytes geprüft, nicht
 * nur hinzugefügte Zeilen: Kontext- und Removed-Zeilen, Datei-Header und
 * Patch-Metadaten wandern genauso über den Draht. "Die Base enthielt es schon"
 * ist kein Grund, es erneut zu exfiltrieren. Zusätzlich fängt eine
 * Shannon-Entropie-Heuristik rohe Credentials ohne bekanntes Prefix.
 */

export interface SecretMatch {
    /** Repo-relativer Pfad — oder eine `(…)`-Pseudo-Location für Metadaten. */
    readonly path: string;
    /**
     * 1-basierte Zeile: neue Dateiversion für added/context, alte Version für
     * removed. 0 = nicht zeilenadressierbar (Header, Metadaten, Payload-Feld).
     */
    readonly line: number;
    /** Menschlich lesbarer Name der Pattern-Klasse (für die Fehlermeldung). */
    readonly patternClass: string;
}

interface SecretPattern {
    readonly patternClass: string;
    readonly pattern: RegExp;
}

/** Pattern-Klassen exakt nach MCP_SPEC.md §3.4. */
const SECRET_PATTERNS: readonly SecretPattern[] = [
    {
        patternClass: 'private key',
        pattern: /-----BEGIN (?:(?:RSA|EC|OPENSSH|PGP) )?PRIVATE KEY-----/,
    },
    {
        patternClass: 'known key prefix',
        pattern: /(?:\b|['"=:])(?:sk-|sk_live_|rk_live_|ghp_|gho_|ghu_|ghs_|github_pat_|usk_|xoxb-|xoxp-)[A-Za-z0-9_-]{8,}|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
    },
    {
        patternClass: 'env-shaped assignment',
        pattern: /(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|CREDENTIAL)[A-Z_]*\s*=\s*['"]?[^\s'"]{12,}/,
    },
    {
        patternClass: 'GCP service account',
        pattern: /"type"\s*:\s*"service_account"/,
    },
];

export const HIGH_ENTROPY_PATTERN_CLASS = 'high-entropy token';

/**
 * Entropie-Kandidaten: zusammenhängende base64-/base64url-artige Läufe.
 * Unter 24 Zeichen ist die empirische Shannon-Schätzung zu instabil
 * (max. log2(len) Bits) — kurze Tokens erzeugen nur Rauschen.
 */
const ENTROPY_TOKEN_PATTERN = /[A-Za-z0-9+/=_-]{24,}/g;

/**
 * Bits pro Zeichen. Kalibriert (siehe secret-filter.test.ts): zufällige
 * base64-Tokens und JWT-Segmente liegen ≥ 4.28, camelCase-Bezeichner ≤ 4.19,
 * reines Hex strukturell ≤ 4.0. Der Charset-Guard darunter ist die zweite,
 * unabhängige Verteidigung gegen Prosa und Bezeichner.
 */
const ENTROPY_THRESHOLD_BITS_PER_CHAR = 4.2;

/** Empirische Shannon-Entropie eines Tokens in Bits pro Zeichen. */
function shannonEntropyBitsPerChar(token: string): number {
    const charCounts = new Map<string, number>();
    for (const char of token) {
        charCounts.set(char, (charCounts.get(char) ?? 0) + 1);
    }

    let entropyBits = 0;
    for (const count of charCounts.values()) {
        const probability = count / token.length;
        entropyBits -= probability * Math.log2(probability);
    }
    return entropyBits;
}

/**
 * False-Positive-Guards für die Entropie-Heuristik. Jede Zeile hier ist eine
 * dokumentierte legitime Token-Form, die NICHT als Secret gelten darf:
 * Git-SHA-1/-SHA-256 und andere Digests sind reines Hex; SRI-/npm-Integrity-
 * Hashes tragen ein `sha256-`/`sha384-`/`sha512-`-Prefix; Bezeichner, Prosa
 * und UUIDs mischen nie Klein- UND Großbuchstaben UND Ziffern zugleich.
 */
function isEntropyFalsePositive(token: string): boolean {
    if (/^[0-9a-fA-F]+$/.test(token)) return true;
    if (/^sha(?:256|384|512)-/.test(token)) return true;

    const mixesCasesAndDigits = /[a-z]/.test(token) && /[A-Z]/.test(token) && /[0-9]/.test(token);
    return !mixesCasesAndDigits;
}

/** Prüft eine Textzeile auf hochentropische Token abseits der Regex-Klassen. */
function containsHighEntropyToken(lineText: string): boolean {
    // Data-URIs sind eingebettete Assets (Icons, Fonts), keine Credentials.
    if (lineText.includes(';base64,')) return false;

    const candidateTokens = lineText.match(ENTROPY_TOKEN_PATTERN) ?? [];
    return candidateTokens.some((token) =>
        !isEntropyFalsePositive(token)
        && shannonEntropyBitsPerChar(token) >= ENTROPY_THRESHOLD_BITS_PER_CHAR);
}

export interface ClassifyOptions {
    /** Entropie-Heuristik aussetzen (z. B. innerhalb öffentlicher PEM-Blöcke). */
    readonly skipEntropy?: boolean;
}

/**
 * Klassifiziert ein Textstück: bekannte Pattern-Klasse, Entropie-Treffer oder
 * null. Reihenfolge ist Absicht — ein benanntes Muster ist die bessere
 * Fehlermeldung als das generische "high-entropy token".
 */
export function classifySecretText(text: string, options?: ClassifyOptions): string | null {
    const matchedPattern = SECRET_PATTERNS.find((secretPattern) => secretPattern.pattern.test(text));
    if (matchedPattern) return matchedPattern.patternClass;

    if (!options?.skipEntropy && containsHighEntropyToken(text)) {
        return HIGH_ENTROPY_PATTERN_CLASS;
    }
    return null;
}

const FILE_HEADER_PATTERN = /^diff --git a\/.+ b\/(.+)$/;
const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
/** Öffentliches PEM-Material (Zertifikate, Public Keys) — base64, aber kein Secret. */
const PUBLIC_PEM_BEGIN_PATTERN = /-----BEGIN (?!.*PRIVATE)[A-Z0-9 ]+-----/;
const PEM_END_PATTERN = /-----END [A-Z0-9 ]+-----/;

interface DiffWalkState {
    filePath: string | null;
    oldLineNumber: number;
    newLineNumber: number;
    inPublicPemBlock: boolean;
}

/** Verarbeitet Struktur-Zeilen (Datei-Header, Hunk-Header, `\`-Marker). */
function advanceOnStructureLine(state: DiffWalkState, diffLine: string): boolean {
    const fileHeaderMatch = FILE_HEADER_PATTERN.exec(diffLine);
    if (fileHeaderMatch) {
        state.filePath = fileHeaderMatch[1];
        state.oldLineNumber = 0;
        state.newLineNumber = 0;
        state.inPublicPemBlock = false;
        return true;
    }

    const hunkHeaderMatch = HUNK_HEADER_PATTERN.exec(diffLine);
    if (hunkHeaderMatch) {
        state.oldLineNumber = Number.parseInt(hunkHeaderMatch[1], 10);
        state.newLineNumber = Number.parseInt(hunkHeaderMatch[2], 10);
        return true;
    }

    return diffLine.startsWith('\\'); // "\ No newline"-Marker
}

/**
 * Scannt eine Inhalts- oder Metadaten-Zeile und rückt die Zeilenzähler vor.
 * Added/Context melden die Zeile der neuen, Removed die der alten Version;
 * Metadaten-Zeilen (`index …`, `--- a/…`, `+++ b/…`, Mode-Zeilen) melden 0.
 */
function scanContentLine(state: DiffWalkState, diffLine: string): SecretMatch | null {
    const isAdded = diffLine.startsWith('+') && !diffLine.startsWith('+++');
    const isRemoved = diffLine.startsWith('-') && !diffLine.startsWith('---');
    const isContext = diffLine.startsWith(' ') || diffLine === '';
    const isHunkContent = isAdded || isRemoved || isContext;

    const lineText = isHunkContent ? diffLine.slice(1) : diffLine;
    const reportedLine = isRemoved ? state.oldLineNumber : (isHunkContent ? state.newLineNumber : 0);

    if (PUBLIC_PEM_BEGIN_PATTERN.test(lineText)) state.inPublicPemBlock = true;
    const patternClass = classifySecretText(lineText, { skipEntropy: state.inPublicPemBlock });
    if (PEM_END_PATTERN.test(lineText)) state.inPublicPemBlock = false;

    if (isRemoved || isContext) state.oldLineNumber += 1;
    if (isAdded || isContext) state.newLineNumber += 1;

    if (!patternClass) return null;
    return { path: state.filePath ?? '(diff header)', line: reportedLine, patternClass };
}

/**
 * Scannt ALLE Zeilen eines Unified Diffs — added, context, removed und
 * Metadaten — auf Secret-Muster und hochentropische Token. Alles davon
 * verlässt beim Upload das Gerät; entsprechend wird alles geprüft.
 */
export function findSecretsInDiff(unifiedDiff: string): SecretMatch[] {
    const secretMatches: SecretMatch[] = [];
    const walkState: DiffWalkState = {
        filePath: null,
        oldLineNumber: 0,
        newLineNumber: 0,
        inPublicPemBlock: false,
    };

    for (const diffLine of unifiedDiff.split('\n')) {
        if (advanceOnStructureLine(walkState, diffLine)) continue;

        const lineMatch = scanContentLine(walkState, diffLine);
        if (lineMatch) secretMatches.push(lineMatch);
    }

    return secretMatches;
}

// =============================================================================
// Redaktion (serverseitig, REPO_CONTEXT_SPEC §9 1a)
// =============================================================================

/** Steht im Diff an der Stelle des Materials; Zeilenzahl und Struktur der Zeile bleiben. */
export const SECRET_REDACTION_PLACEHOLDER = '<redacted-secret>';

/**
 * Wie die Erkennung oben, aber mit Grenze VOR dem Prefix: ohne sie träfe
 * `sk-` auch `./task-list-item`, `mask-gradient-to-r` und `flask-sqlalchemy`.
 */
const KNOWN_KEY_VALUE_PATTERN =
    /(?<![A-Za-z0-9_-])(?:sk-|sk_live_|rk_live_|ghp_|gho_|ghu_|ghs_|github_pat_|usk_|xoxb-|xoxp-)[A-Za-z0-9_-]{8,}|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const ENV_ASSIGNMENT_VALUE_PATTERN =
    /((?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|CREDENTIAL)[A-Z_]*\s*=\s*)(['"]?)([^\s'"]{12,})/g;
/** Unquotierter Wert, der ein Bezeichner, Zugriff oder Aufruf ist (`OTHER_CONSTANT`, `process.env.X`, `getSecret(…)`): Code, kein Material. */
const CODE_REFERENCE_VALUE_PATTERN = /^[A-Za-z_$][\w$]*;?$|[.(\[]/;
/** Quotierte Adresse ohne Zugangsdaten (`https://host/path`): Konfiguration, kein Material. */
const PLAIN_URL_VALUE_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[^@]*$/i;

export interface LineRedaction {
    readonly redactedLine: string;
    /** Musterklassen der ersetzten Stellen; leer = Zeile unverändert. */
    readonly patternClasses: readonly string[];
}

function isHarmlessAssignedValue(openingQuote: string, assignedValue: string): boolean {
    if (assignedValue.includes(SECRET_REDACTION_PLACEHOLDER)) return true;
    if (openingQuote === '') return CODE_REFERENCE_VALUE_PATTERN.test(assignedValue);
    return PLAIN_URL_VALUE_PATTERN.test(assignedValue);
}

/**
 * Ersetzt mögliches Secret-Material in EINER Zeile durch den Platzhalter:
 * bekannte Key-Prefixe, den Wert einer env-förmigen Zuweisung und
 * hochentropische Token. Der Name der Variable bleibt stehen — ein Reviewer
 * sieht weiter, DASS dort ein Literal stand, nur nicht welches.
 * `skipEntropy` setzt nur die Entropie-Heuristik aus (öffentliches PEM-Material).
 */
export function redactSecretsInLine(lineText: string, options?: ClassifyOptions): LineRedaction {
    const patternClasses = new Set<string>();
    let redactedLine = lineText.replace(KNOWN_KEY_VALUE_PATTERN, () => {
        patternClasses.add('known key prefix');
        return SECRET_REDACTION_PLACEHOLDER;
    });
    redactedLine = redactedLine.replace(
        ENV_ASSIGNMENT_VALUE_PATTERN,
        (assignmentText: string, assignmentHead: string, openingQuote: string, assignedValue: string) => {
            if (isHarmlessAssignedValue(openingQuote, assignedValue)) return assignmentText;
            patternClasses.add('env-shaped assignment');
            return `${assignmentHead}${openingQuote}${SECRET_REDACTION_PLACEHOLDER}`;
        },
    );
    if (!options?.skipEntropy && !redactedLine.includes(';base64,')) {
        redactedLine = redactedLine.replace(ENTROPY_TOKEN_PATTERN, (candidateToken: string) => {
            const isSecretLike = !isEntropyFalsePositive(candidateToken)
                && shannonEntropyBitsPerChar(candidateToken) >= ENTROPY_THRESHOLD_BITS_PER_CHAR;
            if (!isSecretLike) return candidateToken;
            patternClasses.add(HIGH_ENTROPY_PATTERN_CLASS);
            return SECRET_REDACTION_PLACEHOLDER;
        });
    }
    return { redactedLine, patternClasses: [...patternClasses] };
}

export interface PatchRedaction {
    readonly redactedPatch: string;
    /** Je ersetzter Zeile die Musterklassen, nie das Material. */
    readonly redactedLineClasses: readonly (readonly string[])[];
}

/**
 * Redigiert den Patch EINER Datei (Hunks ohne Datei-Header), bevor er ein
 * Modell erreicht. Hunk-Header und das Präfix jeder Zeile bleiben, damit
 * Zeilennummern und Hunk-Grenzen weiter stimmen. In öffentlichem PEM-Material
 * (base64, kein Secret) ruht nur die Entropie-Heuristik, wie in
 * `findSecretsInDiff`; der Zustand endet mit dem Hunk, weil die END-Zeile
 * außerhalb liegen kann.
 */
export function redactSecretsInPatch(patch: string): PatchRedaction {
    const redactedLineClasses: (readonly string[])[] = [];
    let inPublicPemBlock = false;
    const redactedLines = patch.split('\n').map((patchLine) => {
        if (patchLine.startsWith('@@')) {
            inPublicPemBlock = false;
            return patchLine;
        }
        if (patchLine.startsWith('\\')) return patchLine;
        if (PUBLIC_PEM_BEGIN_PATTERN.test(patchLine)) inPublicPemBlock = true;
        const lineRedaction = redactSecretsInLine(patchLine.slice(1), { skipEntropy: inPublicPemBlock });
        if (PEM_END_PATTERN.test(patchLine)) inPublicPemBlock = false;
        if (lineRedaction.patternClasses.length === 0) return patchLine;
        redactedLineClasses.push(lineRedaction.patternClasses);
        return `${patchLine.charAt(0)}${lineRedaction.redactedLine}`;
    });
    return { redactedPatch: redactedLines.join('\n'), redactedLineClasses };
}

/** true = mindestens eine Zeile des Texts trägt ein Secret-Muster (Kontextpaket-Abschnitte). */
export function containsSecretLine(multiLineText: string): boolean {
    return multiLineText.split('\n').some((textLine) => classifySecretText(textLine) !== null);
}
