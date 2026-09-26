/**
 * SEC-019 — fehlende HTTP-Security-Header in einer Next.js-Middleware/-Proxy.
 *
 * Nur Next.js (pre_scanner_design.md §9.1). Express- und Flask-Bootstraps sind
 * nach dem Review vom 2026-09-24 in der Revision vom 2026-09-26 entfernt: Header
 * können dort in Modulen außerhalb der Datei oder auf dem Hosting-Layer liegen,
 * die Datei beweist also nichts.
 *
 * Der Check feuert nur, wenn die Datei den Verstoß selbst beweist: eine frisch
 * erzeugte `NextResponse`, die ausschließlich Literal-Header ohne Security-Header
 * bekommt und unverändert zurückgegeben wird. Jeder Hinweis auf anderswo gesetzte
 * Header unterdrückt — die Response entweicht in einen Aufruf, stammt nicht aus
 * `NextResponse.*`, der Export ist gewrappt, ein lokales Security-Modul wird
 * importiert (relativ oder `@/`/`~/`/`#/`), oder eine `next.config.*` hat eine
 * `headers()`-Funktion. Lieber ein Miss als ein False Positive.
 */
import { buildConfigFinding } from './config-finding';
import type { PrescanLanguage } from '../../language';
import type { PrescanCompanionFile, PrescanFinding, SkippedCheck } from '../../types';

const SECURITY_HEADER_PATTERN = /content-security-policy|x-frame-options|frame-ancestors|strict-transport-security|referrer-policy|permissions-policy|x-content-type-options/i;
const NEXT_MIDDLEWARE_FILE = /(^|\/)(middleware|proxy)\.(ts|js|mjs|cjs|mts)$/;
const NEXT_SERVER_IMPORT = /from\s+['"]next\/server['"]/;
const HEADER_MUTATION = /(\S+?)\.headers\.(?:set|append)\(\s*([^,)]*)/g;
const REQUEST_RECEIVER = /(^|[.(])[\w$]*req(uest)?(headers)?$/i;
const HEADERS_OBJECT_OR_CLONE = /\bheaders\s*:|new Headers\(/;
/** Relativ oder per Projekt-Alias (`@/` create-next-app-Default, `~/`, `#/` Subpath-Import). */
const LOCAL_SPECIFIER = String.raw`['"](?:\.|[@~#]\/)`;
const SECURITY_LOCAL_IMPORT = new RegExp(
    String.raw`(from\s+${LOCAL_SPECIFIER}[^'"]*(secur|header|csp|helmet|nonce|harden)[^'"]*['"])|(import\s+[^;]*(secur|header|csp|helmet|nonce|harden)[^;]*from\s+${LOCAL_SPECIFIER})`,
    'i',
);
/** `export default chain(…)` / `export const middleware = withX(…)` — der Wrapper kann Header setzen. */
const WRAPPED_EXPORT = /export\s+(?:default|const\s+[\w$]+\s*=)\s*(?:await\s+)?(?!async\b|function\b)[\w$.]+\s*\(/;
/** Eine `headers()`-Funktion bzw. ein `headers`-Key in next.config — unabhängig von Literal-Header-Namen. */
const NEXT_CONFIG_HEADERS = /\bheaders\s*[(:]/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export interface SecurityHeadersInput {
    readonly path: string;
    readonly language: PrescanLanguage;
    readonly source: string;
    /** Alle sichtbaren `next.config.*` (Diff + Begleitdateien); content null = unlesbar. */
    readonly nextConfigs: readonly PrescanCompanionFile[];
}

export interface SecurityHeadersResult {
    readonly findings: PrescanFinding[];
    readonly skippedChecks: SkippedCheck[];
}

const NO_RESULT: SecurityHeadersResult = { findings: [], skippedChecks: [] };

export function runSecurityHeaderChecks(input: SecurityHeadersInput): SecurityHeadersResult {
    if (input.language !== 'typescript' && input.language !== 'javascript') return NO_RESULT;
    if (!NEXT_MIDDLEWARE_FILE.test(input.path) || !NEXT_SERVER_IMPORT.test(input.source)) return NO_RESULT;
    if (SECURITY_HEADER_PATTERN.test(input.source)) return NO_RESULT;
    return checkNextMiddleware(input);
}

interface ResponseHeaderMutation {
    readonly line: number;
    readonly receiver: string;
    readonly isComputedName: boolean;
}

function checkNextMiddleware(input: SecurityHeadersInput): SecurityHeadersResult {
    const mutations = collectResponseHeaderMutations(input.source);
    if (!provesUnhardenedResponse(input.source, mutations)) return NO_RESULT;

    const unreadableConfigs = input.nextConfigs.filter((config) => config.content === null);
    if (unreadableConfigs.length > 0) {
        return {
            findings: [],
            skippedChecks: unreadableConfigs.map((config) => ({
                ruleId: 'SEC-019', reason: `companion-unavailable: ${config.path}`, path: input.path,
            })),
        };
    }
    const configuresHeadersElsewhere = input.nextConfigs.some(
        (config) => config.content !== null && configuresHeaders(config.content),
    );
    if (configuresHeadersElsewhere) return NO_RESULT;

    const anchorLine = mutations[0].line;
    return {
        findings: [buildConfigFinding({ ruleId: 'SEC-019', path: input.path, line: anchorLine, quote: lineText(input.source, anchorLine) })],
        skippedChecks: [],
    };
}

/** Beweist die Datei allein, dass jede mutierte Response ohne Security-Header rausgeht? */
function provesUnhardenedResponse(source: string, mutations: readonly ResponseHeaderMutation[]): boolean {
    if (mutations.length === 0 || mutations.some((mutation) => mutation.isComputedName)) return false;
    if (HEADERS_OBJECT_OR_CLONE.test(source) || SECURITY_LOCAL_IMPORT.test(source) || WRAPPED_EXPORT.test(source)) return false;
    const receivers = new Set(mutations.map((mutation) => mutation.receiver));
    return [...receivers].every((receiver) => isConfinedFreshResponse(source, receiver));
}

function configuresHeaders(configSource: string): boolean {
    return SECURITY_HEADER_PATTERN.test(configSource) || NEXT_CONFIG_HEADERS.test(configSource);
}

/** `.headers.set/append(` auf Nicht-Request-Receivern, mit Zeile und Literal-/Computed-Status des Header-Namens. */
function collectResponseHeaderMutations(source: string): ResponseHeaderMutation[] {
    const mutations: ResponseHeaderMutation[] = [];
    for (const mutationMatch of source.matchAll(HEADER_MUTATION)) {
        const receiver = mutationMatch[1];
        if (REQUEST_RECEIVER.test(receiver)) continue;
        const firstArgument = mutationMatch[2].trim();
        mutations.push({
            line: lineAtOffset(source, mutationMatch.index ?? 0),
            receiver,
            isComputedName: !/^['"`]/.test(firstArgument),
        });
    }
    return mutations;
}

/**
 * Die Response stammt aus genau einer `NextResponse.*`-Deklaration, und jedes
 * weitere Vorkommen ist eine Header-Mutation oder ein nacktes `return`. Jede
 * andere Nutzung (Argument eines Aufrufs, Zuweisung, Property-Zugriff) heißt:
 * die Response entweicht, ein Helfer könnte Header setzen ⇒ nicht beweisbar.
 */
function isConfinedFreshResponse(source: string, receiver: string): boolean {
    if (!IDENTIFIER.test(receiver)) return false;
    const name = receiver.replace(/\$/g, '\$');
    const freshDeclaration = new RegExp(
        String.raw`(?:const|let|var)\s+${name}\s*=\s*(?:NextResponse\.(?:next|rewrite|redirect|json)|new\s+NextResponse)\(`, 'g',
    );
    const declarations = countMatches(source, freshDeclaration);
    if (declarations !== 1) return false;

    const mutationUses = countMatches(source, new RegExp(String.raw`(?<![\w$.])${name}\.headers\.(?:set|append)\(`, 'g'));
    const returnUses = countMatches(source, new RegExp(String.raw`\breturn\s+${name}\s*(?:;|\}|$)`, 'gm'));
    const allUses = countMatches(source, new RegExp(String.raw`(?<![\w$.])${name}(?![\w$])`, 'g'));
    return allUses === declarations + mutationUses + returnUses;
}

function countMatches(source: string, pattern: RegExp): number {
    return [...source.matchAll(pattern)].length;
}

function lineAtOffset(source: string, offset: number): number {
    return source.slice(0, offset).split('\n').length;
}

function lineText(source: string, line: number): string {
    return source.split('\n')[line - 1] ?? '';
}
