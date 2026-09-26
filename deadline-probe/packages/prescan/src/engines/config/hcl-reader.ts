/**
 * Minimaler HCL2-Reader für Terraform-Dateien (Config-Engine v4).
 *
 * Bewusst KEIN externer Parser: die verfügbaren npm-Parser (hcl2-parser,
 * @cdktf/hcl2json) sind Go-WASM-Bundles mit mehreren MB — in der ohnehin
 * speicherkritischen Prescan-Lambda (ROADMAP §1, Route-Instanz-Leck) nicht
 * tragbar. Dieser Reader versteht genau das, was die IAM-/Serverless-Checks
 * brauchen: Blöcke mit Labels, Attribute, Strings (inkl. `${}`), Heredocs,
 * Listen, Objekte, Funktionsaufrufe und Referenzen. Alles andere (Operatoren,
 * Conditionals, Splats) wird als `raw`-Ausdruck durchgereicht statt zu
 * scheitern — ein unbekannter Ausdruck ist nie ein Finding.
 */

export type HclValue =
    | { readonly kind: 'string'; readonly value: string; readonly line: number }
    | { readonly kind: 'number'; readonly value: number; readonly line: number }
    | { readonly kind: 'literal'; readonly value: string; readonly line: number }
    | { readonly kind: 'list'; readonly items: readonly HclValue[]; readonly line: number }
    | { readonly kind: 'object'; readonly entries: ReadonlyMap<string, HclValue>; readonly line: number }
    | { readonly kind: 'call'; readonly name: string; readonly args: readonly HclValue[]; readonly line: number }
    | { readonly kind: 'reference'; readonly text: string; readonly line: number }
    | { readonly kind: 'raw'; readonly text: string; readonly line: number };

export interface HclBody {
    readonly attributes: ReadonlyMap<string, HclValue>;
    readonly blocks: readonly HclBlock[];
}

export interface HclBlock extends HclBody {
    readonly type: string;
    readonly labels: readonly string[];
    readonly line: number;
}

// =============================================================================
// Tokenizer
// =============================================================================

type TokenKind = 'ident' | 'string' | 'number' | 'op' | 'newline' | 'eof';

interface HclToken {
    readonly kind: TokenKind;
    readonly text: string;
    readonly line: number;
    readonly start: number;
    readonly end: number;
}

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_-]/;
const DIGIT = /[0-9]/;
const TWO_CHAR_OPERATORS = new Set(['==', '!=', '>=', '<=', '&&', '||', '=>']);
const HEREDOC_HEADER = /^<<-?([A-Za-z_][A-Za-z0-9_]*)\r?\n/;
const NUMBER_HEAD = /^[0-9]+(\.[0-9]+)?/;

class HclTokenizer {
    private position = 0;
    private line = 1;
    private readonly tokens: HclToken[] = [];

    constructor(private readonly source: string) {}

    run(): HclToken[] {
        while (this.position < this.source.length) {
            this.readToken();
        }
        this.tokens.push({ kind: 'eof', text: '', line: this.line, start: this.position, end: this.position });
        return this.tokens;
    }

    private readToken(): void {
        const current = this.source[this.position];
        if (current === '\n') {
            this.push('newline', this.position, this.position + 1);
            this.line += 1;
            return;
        }
        if (current === ' ' || current === '\t' || current === '\r') {
            this.position += 1;
            return;
        }
        if (this.skipComment()) return;
        if (current === '"') {
            this.readString();
        } else if (this.source.startsWith('<<', this.position)) {
            this.readHeredoc();
        } else if (DIGIT.test(current)) {
            this.readNumber();
        } else if (IDENT_START.test(current)) {
            this.readIdentifier();
        } else {
            this.readOperator();
        }
    }

    private push(kind: TokenKind, start: number, end: number): void {
        this.tokens.push({ kind, text: this.source.slice(start, end), line: this.line, start, end });
        this.position = end;
    }

    private skipComment(): boolean {
        if (this.source[this.position] === '#' || this.source.startsWith('//', this.position)) {
            const lineEnd = this.source.indexOf('\n', this.position);
            this.position = lineEnd === -1 ? this.source.length : lineEnd;
            return true;
        }
        if (this.source.startsWith('/*', this.position)) {
            const commentEnd = this.source.indexOf('*/', this.position + 2);
            const skipTo = commentEnd === -1 ? this.source.length : commentEnd + 2;
            this.line += countNewlines(this.source.slice(this.position, skipTo));
            this.position = skipTo;
            return true;
        }
        return false;
    }

    /** Quoted string with escapes and nested `${ … }` / `%{ … }` interpolation. */
    private readString(): void {
        const start = this.position;
        const cursor = scanQuotedString(this.source, start);
        const end = Math.min(cursor + 1, this.source.length);
        const startLine = this.line;
        this.line += countNewlines(this.source.slice(start, end));
        this.tokens.push({ kind: 'string', text: this.source.slice(start + 1, cursor), line: startLine, start, end });
        this.position = end;
    }

    /** `<<EOF` / `<<-EOF` … `EOF` — content lines without the delimiter. */
    private readHeredoc(): void {
        const start = this.position;
        const headerMatch = HEREDOC_HEADER.exec(this.source.slice(start));
        if (!headerMatch) {
            this.readOperator();
            return;
        }
        const delimiter = headerMatch[1];
        const contentLines: string[] = [];
        let cursor = start + headerMatch[0].length;
        // Endet VOR dem Zeilenumbruch hinter dem Delimiter: der Newline bleibt
        // ein Token und beendet das Attribut wie bei jedem anderen Wert.
        let tokenEnd = this.source.length;
        while (cursor < this.source.length) {
            const lineEnd = this.source.indexOf('\n', cursor);
            const lineText = this.source.slice(cursor, lineEnd === -1 ? this.source.length : lineEnd);
            if (lineText.trim() === delimiter) {
                tokenEnd = lineEnd === -1 ? this.source.length : lineEnd;
                break;
            }
            contentLines.push(lineText);
            cursor = lineEnd === -1 ? this.source.length : lineEnd + 1;
        }
        const heredocLine = this.line;
        this.line += countNewlines(this.source.slice(start, tokenEnd));
        this.tokens.push({ kind: 'string', text: contentLines.join('\n'), line: heredocLine, start, end: tokenEnd });
        this.position = tokenEnd;
    }

    private readNumber(): void {
        const numberMatch = NUMBER_HEAD.exec(this.source.slice(this.position));
        this.push('number', this.position, this.position + (numberMatch?.[0].length ?? 1));
    }

    private readIdentifier(): void {
        let cursor = this.position + 1;
        while (cursor < this.source.length && IDENT_PART.test(this.source[cursor])) cursor += 1;
        this.push('ident', this.position, cursor);
    }

    private readOperator(): void {
        const twoChars = this.source.slice(this.position, this.position + 2);
        const length = TWO_CHAR_OPERATORS.has(twoChars) ? 2 : 1;
        this.push('op', this.position, this.position + length);
    }
}

/** Index of the closing quote of the string opened at `start` (or source end). */
function scanQuotedString(source: string, start: number): number {
    let cursor = start + 1;
    let interpolationDepth = 0;
    let inNestedString = false;
    while (cursor < source.length) {
        const character = source[cursor];
        if (character === '\\') {
            cursor += 2;
            continue;
        }
        if (interpolationDepth === 0 && character === '"') return cursor;
        const opensInterpolation = (character === '$' || character === '%') && source[cursor + 1] === '{' && !inNestedString;
        if (opensInterpolation) {
            interpolationDepth += 1;
            cursor += 2;
            continue;
        }
        if (interpolationDepth > 0 && character === '"') inNestedString = !inNestedString;
        if (interpolationDepth > 0 && character === '}' && !inNestedString) interpolationDepth -= 1;
        cursor += 1;
    }
    return cursor;
}

function countNewlines(text: string): number {
    return text.split('\n').length - 1;
}

// =============================================================================
// Parser
// =============================================================================

const VALUE_TERMINATORS = new Set([',', '}', ']', ')']);

type HclStatement = HclBlock | { readonly name: string; readonly value: HclValue };

class HclParser {
    private index = 0;

    constructor(private readonly tokens: readonly HclToken[], private readonly source: string) {}

    parseBody(closing: string | null): HclBody {
        const attributes = new Map<string, HclValue>();
        const blocks: HclBlock[] = [];

        while (!this.atEnd()) {
            const token = this.peek();
            if (this.isSeparator(token)) {
                this.index += 1;
                continue;
            }
            if (closing !== null && this.isOperator(token, closing)) {
                this.index += 1;
                break;
            }
            if (token.kind !== 'ident') {
                this.skipStatement();
                continue;
            }
            const statement = this.parseStatement();
            if (statement === null) continue;
            if ('labels' in statement) blocks.push(statement);
            else attributes.set(statement.name, statement.value);
        }
        return { attributes, blocks };
    }

    private parseStatement(): HclStatement | null {
        const nameToken = this.next();
        if (this.isOperator(this.peek(), '=')) {
            this.index += 1;
            return { name: nameToken.text, value: this.parseValue() };
        }
        const labels: string[] = [];
        while (this.peek().kind === 'string' || this.peek().kind === 'ident') labels.push(this.next().text);
        if (this.isOperator(this.peek(), '{')) {
            this.index += 1;
            const body = this.parseBody('}');
            return { type: nameToken.text, labels, line: nameToken.line, ...body };
        }
        this.skipStatement();
        return null;
    }

    private parseValue(): HclValue {
        const startToken = this.peek();
        const primary = this.parsePrimary();
        if (this.isValueEnd(this.peek())) return primary;

        // Operator/Conditional/Index hinter dem Primärausdruck: als raw durchreichen.
        const endToken = this.skipExpressionTail();
        return { kind: 'raw', text: this.source.slice(startToken.start, endToken.end).trim(), line: startToken.line };
    }

    private parsePrimary(): HclValue {
        const token = this.peek();
        if (token.kind === 'string') {
            this.index += 1;
            return { kind: 'string', value: token.text, line: token.line };
        }
        if (token.kind === 'number') {
            this.index += 1;
            return { kind: 'number', value: Number(token.text), line: token.line };
        }
        if (this.isOperator(token, '[')) return this.parseList();
        if (this.isOperator(token, '{')) return this.parseObject();
        if (token.kind === 'ident') return this.parseIdentifierValue();
        const endToken = this.skipExpressionTail(true);
        return { kind: 'raw', text: this.source.slice(token.start, endToken.end).trim(), line: token.line };
    }

    private parseList(): HclValue {
        const openToken = this.next();
        const items: HclValue[] = [];
        while (!this.atEnd()) {
            const token = this.peek();
            if (this.isSeparator(token)) {
                this.index += 1;
                continue;
            }
            if (this.isOperator(token, ']')) {
                this.index += 1;
                break;
            }
            items.push(this.parseValue());
        }
        return { kind: 'list', items, line: openToken.line };
    }

    private parseObject(): HclValue {
        const openToken = this.next();
        const entries = new Map<string, HclValue>();
        while (!this.atEnd()) {
            const token = this.peek();
            if (this.isSeparator(token)) {
                this.index += 1;
                continue;
            }
            if (this.isOperator(token, '}')) {
                this.index += 1;
                break;
            }
            const entry = this.parseObjectEntry();
            if (entry !== null) entries.set(entry.name, entry.value);
        }
        return { kind: 'object', entries, line: openToken.line };
    }

    private parseObjectEntry(): { readonly name: string; readonly value: HclValue } | null {
        const keyToken = this.peek();
        if (keyToken.kind !== 'ident' && keyToken.kind !== 'string') {
            this.skipStatement();
            return null;
        }
        this.index += 1;
        const separator = this.peek();
        if (!this.isOperator(separator, '=') && !this.isOperator(separator, ':')) {
            this.skipStatement();
            return null;
        }
        this.index += 1;
        return { name: keyToken.text, value: this.parseValue() };
    }

    private parseIdentifierValue(): HclValue {
        const nameToken = this.next();
        if (this.isOperator(this.peek(), '(')) return this.parseCall(nameToken);
        if (nameToken.text === 'true' || nameToken.text === 'false' || nameToken.text === 'null') {
            return { kind: 'literal', value: nameToken.text, line: nameToken.line };
        }
        let referenceEnd = nameToken.end;
        while (this.isOperator(this.peek(), '.') && this.tokens[this.index + 1]?.kind === 'ident') {
            this.index += 2;
            referenceEnd = this.tokens[this.index - 1].end;
        }
        return { kind: 'reference', text: this.source.slice(nameToken.start, referenceEnd), line: nameToken.line };
    }

    private parseCall(nameToken: HclToken): HclValue {
        this.index += 1;
        const args: HclValue[] = [];
        while (!this.atEnd()) {
            const token = this.peek();
            if (this.isSeparator(token)) {
                this.index += 1;
                continue;
            }
            if (this.isOperator(token, ')')) {
                this.index += 1;
                break;
            }
            args.push(this.parseValue());
        }
        return { kind: 'call', name: nameToken.text, args, line: nameToken.line };
    }

    /**
     * Consumes tokens up to (not including) the next depth-0 terminator; returns
     * the last consumed token. `forceProgress` guarantees at least one token is
     * consumed — the recovery paths must never spin on a stray terminator.
     */
    private skipExpressionTail(forceProgress: boolean = false): HclToken {
        let depth = 0;
        let lastToken = this.peek();
        let consumedAny = false;
        while (!this.atEnd()) {
            const token = this.peek();
            const atTerminator = token.kind === 'newline' || (depth === 0 && this.isValueEnd(token));
            if (atTerminator && (consumedAny || !forceProgress)) break;
            if (token.kind === 'op' && '([{'.includes(token.text)) depth += 1;
            if (token.kind === 'op' && ')]}'.includes(token.text)) depth -= 1;
            lastToken = this.next();
            consumedAny = true;
        }
        return lastToken;
    }

    /** Recovery: skip a malformed statement, always advancing by at least one token. */
    private skipStatement(): void {
        const startIndex = this.index;
        this.skipExpressionTail();
        const stopToken = this.peek();
        if (stopToken.kind === 'newline' || (stopToken.kind === 'op' && stopToken.text !== '}')) this.index += 1;
        if (this.index === startIndex && !this.atEnd()) this.index += 1;
    }

    private isSeparator(token: HclToken): boolean {
        return token.kind === 'newline' || this.isOperator(token, ',');
    }

    private isValueEnd(token: HclToken): boolean {
        return token.kind === 'newline' || token.kind === 'eof'
            || (token.kind === 'op' && VALUE_TERMINATORS.has(token.text));
    }

    private isOperator(token: HclToken, text: string): boolean {
        return token.kind === 'op' && token.text === text;
    }

    private peek(): HclToken {
        return this.tokens[this.index];
    }

    private next(): HclToken {
        const token = this.tokens[this.index];
        this.index += 1;
        return token;
    }

    private atEnd(): boolean {
        return this.peek().kind === 'eof';
    }
}

/** Parses a Terraform file into its top-level body. Unknown syntax degrades to `raw` values instead of throwing. */
export function parseHcl(source: string): HclBody {
    const tokens = new HclTokenizer(source).run();
    return new HclParser(tokens, source).parseBody(null);
}

// =============================================================================
// Value helpers
// =============================================================================

export interface HclStringAt {
    readonly value: string;
    readonly line: number;
}

export function hclString(value: HclValue | undefined): string | null {
    return value?.kind === 'string' ? value.value : null;
}

/** A string or a list of strings; references/raw entries are dropped. */
export function hclStrings(value: HclValue | undefined): readonly HclStringAt[] {
    if (!value) return [];
    if (value.kind === 'string') return [{ value: value.value, line: value.line }];
    if (value.kind !== 'list') return [];
    return value.items.flatMap((item) => (item.kind === 'string' ? [{ value: item.value, line: item.line }] : []));
}

export function hclReference(value: HclValue | undefined): string | null {
    return value?.kind === 'reference' ? value.text : null;
}

export function hclObject(value: HclValue | undefined): ReadonlyMap<string, HclValue> | null {
    return value?.kind === 'object' ? value.entries : null;
}

export function findBlocks(body: HclBody, type: string, firstLabel?: string): readonly HclBlock[] {
    return body.blocks.filter(
        (block) => block.type === type && (firstLabel === undefined || block.labels[0] === firstLabel),
    );
}
