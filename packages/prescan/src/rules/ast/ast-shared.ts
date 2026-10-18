/**
 * Gemeinsame Helfer der AST-Regeln (tree-sitter).
 *
 * Ein Tree pro Datei, EIN Durchlauf: collectNodesByType baut per Cursor-DFS
 * Buckets pro Node-Typ; die Regel-Module iterieren nur noch Buckets statt
 * selbst zu traversieren (pre_scanner_design.md §2).
 */
import { RULE_REGISTRY } from '../registry';
import type { Node as TsNode, TreeCursor } from 'web-tree-sitter';
import type { PrescanLanguage } from '../../language';
import type { PrescanFinding, PrescanSeverity } from '../../types';

// functionNodeTypesFor wird unten definiert und von buildWantedNodeTypes genutzt.

export interface AstRuleContext {
    readonly path: string;
    readonly language: PrescanLanguage;
    readonly source: string;
    readonly isTestFile: boolean;
    readonly nodesByType: ReadonlyMap<string, readonly TsNode[]>;
    /** Typen, die tatsächlich gebucketet wurden — Grundlage des Guards in nodesOfType. */
    readonly wantedNodeTypes: ReadonlySet<string>;
    readonly findings: PrescanFinding[];
}

/**
 * Node-Typen, für die Regel-Module Buckets anfordern (§2). Die Liste ist
 * bewusst explizit: sie ist der Filter, der verhindert, dass der ganze AST als
 * JS-Objekte materialisiert wird.
 *
 * WARUM DAS ZÄHLT: eine 250-KB-Datei hat schnell >100k Knoten. Ein Bucket über
 * ALLE Typen hält für jeden davon ein JS-Wrapper-Objekt bis zum Ende des
 * Datei-Scans im Speicher — und hebelt damit genau das lazy Cursor-Design von
 * tree-sitter aus, das die Knoten sonst sofort wieder freigibt. Auf Vercel
 * teilen sich Pre-Scanner und LLM-Cascade eine Lambda-Instanz; dieser Ballast
 * geht direkt vom Budget des Draft-Reviewers ab.
 */
const RULE_NODE_TYPES: readonly string[] = [
    // exception-rules
    'catch_clause', 'except_clause',
    // security-rules (py / js-ts / java)
    'call', 'call_expression', 'method_invocation', 'object_creation_expression',
    'jsx_attribute', 'assignment_expression',
    // test-rules
    'function_definition', 'method_declaration',
    // react-rules (COND-011)
    'jsx_element', 'jsx_self_closing_element',
    // correctness-rules (ARCH-005 Go / CONC-003 C)
    'field_declaration', 'composite_literal', 'assignment_statement', 'inc_statement', 'dec_statement', 'declaration',
    // complexity-rules (ARCH-003, Python-Container)
    'list', 'dictionary', 'set',
    'list_comprehension', 'dictionary_comprehension', 'set_comprehension',
];

/** Bucket-Filter über den Knotentext: gesammelt wird nur, was die Regel überhaupt ansehen kann. */
export interface NodeTextFilter {
    /** Längere Knoten werden verworfen, ohne ihren Text zu lesen. */
    readonly maxTextLength: number;
    readonly accepts: (nodeText: string) => boolean;
}

/**
 * Generische Namen aus THE LAW (Condition 3, „Lexical Slop“): `data`, `result`,
 * `item`, `temp`, jeweils auch mit bis zu zwei Ziffern (`temp1`, `result22`),
 * dazu `e`. Welche Bindung damit gemeint ist, entscheidet lexical-rules.ts.
 */
export const GENERIC_BINDING_NAME_PATTERN = /^(?:(?:data|result|item|temp)\d{0,2}|e)$/;
const LONGEST_GENERIC_NAME_LENGTH = 'result99'.length;
/** Typen, die type-rules.ts ansieht: `any` und das `unknown` eines Doppel-Casts. */
const CAPITULATION_TYPE_NAMES: ReadonlySet<string> = new Set(['any', 'unknown']);
const TS_DIRECTIVE_MARKER = '@ts-';
/**
 * Eine Direktive mit ausführlicher Begründung bleibt darunter. Längere
 * Kommentare (Lizenzköpfe, Doc-Blöcke) werden gar nicht erst gelesen.
 */
const LONGEST_DIRECTIVE_COMMENT_LENGTH = 2000;

/**
 * Condition 2/3 (type-rules.ts, lexical-rules.ts) brauchen `identifier`,
 * `predefined_type` und `comment` — die häufigsten Knoten einer TS-Datei.
 * Ungefiltert gebucketet wären sie genau der Ballast, vor dem RULE_NODE_TYPES
 * warnt. Der Filter liest den Text am Cursor und materialisiert nur die Knoten
 * mit einem der wenigen gesuchten Texte.
 *
 * ACHTUNG für neue Regeln: `nodesOfType(context, 'comment')` liefert in JS/TS
 * deshalb NICHT alle Kommentare, sondern nur die mit `@ts-` (entsprechend für
 * `identifier` und `predefined_type`). Der Guard in nodesOfType merkt das
 * nicht. Wer mehr braucht, erweitert `accepts` hier.
 */
const JS_TS_NODE_TEXT_FILTERS: ReadonlyMap<string, NodeTextFilter> = new Map([
    ['identifier', {
        maxTextLength: LONGEST_GENERIC_NAME_LENGTH,
        accepts: (nodeText: string) => GENERIC_BINDING_NAME_PATTERN.test(nodeText),
    }],
    ['predefined_type', {
        maxTextLength: 'unknown'.length,
        accepts: (nodeText: string) => CAPITULATION_TYPE_NAMES.has(nodeText),
    }],
    ['comment', {
        maxTextLength: LONGEST_DIRECTIVE_COMMENT_LENGTH,
        accepts: (nodeText: string) => nodeText.includes(TS_DIRECTIVE_MARKER),
    }],
]);
const NO_NODE_TEXT_FILTERS: ReadonlyMap<string, NodeTextFilter> = new Map();

export function isJsTsLanguage(language: PrescanLanguage): boolean {
    return language === 'typescript' || language === 'tsx' || language === 'javascript';
}

export function nodeTextFiltersFor(language: PrescanLanguage): ReadonlyMap<string, NodeTextFilter> {
    return isJsTsLanguage(language) ? JS_TS_NODE_TEXT_FILTERS : NO_NODE_TEXT_FILTERS;
}

/** Alle Typen, die für eine Sprache gebucketet werden müssen. */
export function buildWantedNodeTypes(language: PrescanLanguage): ReadonlySet<string> {
    return new Set([
        ...RULE_NODE_TYPES,
        ...functionNodeTypesFor(language),
        ...nodeTextFiltersFor(language).keys(),
    ]);
}

/**
 * Cursor-DFS über den ganzen Baum — die einzige Traversierung pro Datei.
 * Gebucketet werden NUR die angeforderten Typen; alle anderen Knoten werden
 * besucht und sofort wieder verworfen.
 */
export function collectNodesByType(
    rootNode: TsNode,
    wantedNodeTypes: ReadonlySet<string>,
    nodeTextFilters: ReadonlyMap<string, NodeTextFilter> = NO_NODE_TEXT_FILTERS,
): Map<string, TsNode[]> {
    const nodesByType = new Map<string, TsNode[]>();
    const cursor = rootNode.walk();

    let reachedEnd = false;
    while (!reachedEnd) {
        if (wantedNodeTypes.has(cursor.nodeType) && passesTextFilter(cursor, nodeTextFilters.get(cursor.nodeType))) {
            const currentNode = cursor.currentNode;
            const bucket = nodesByType.get(currentNode.type);
            if (bucket) {
                bucket.push(currentNode);
            } else {
                nodesByType.set(currentNode.type, [currentNode]);
            }
        }

        if (cursor.gotoFirstChild()) continue;
        while (!cursor.gotoNextSibling()) {
            if (!cursor.gotoParent()) {
                reachedEnd = true;
                break;
            }
        }
    }

    cursor.delete();
    return nodesByType;
}

function passesTextFilter(cursor: TreeCursor, nodeTextFilter: NodeTextFilter | undefined): boolean {
    if (!nodeTextFilter) return true;
    if (cursor.endIndex - cursor.startIndex > nodeTextFilter.maxTextLength) return false;
    return nodeTextFilter.accepts(cursor.nodeText);
}

/**
 * Bucket-Zugriff mit Guard: ein Typ, der nicht in RULE_NODE_TYPES steht, wurde
 * nie gesammelt und würde stumm ein leeres Array liefern — die Regel wäre
 * faktisch tot, ohne dass es jemand merkt. Das ist genau die Art stiller
 * Fehlschlag, die MAINT-001 verbietet, also wird sie hier laut.
 */
export function nodesOfType(context: AstRuleContext, ...nodeTypes: readonly string[]): readonly TsNode[] {
    for (const nodeType of nodeTypes) {
        if (!context.wantedNodeTypes.has(nodeType)) {
            throw new Error(
                `[Prescan] Node-Typ '${nodeType}' wird nicht gebucketet — in RULE_NODE_TYPES `
                + `(ast-shared.ts) ergänzen, sonst läuft die Regel ins Leere.`,
            );
        }
    }
    return nodeTypes.flatMap((nodeType) => context.nodesByType.get(nodeType) ?? []);
}

export function addAstFinding(
    context: AstRuleContext,
    ruleId: string,
    node: TsNode,
    detail?: string,
    severityOverride?: PrescanSeverity,
): void {
    const descriptor = RULE_REGISTRY.get(ruleId);
    const explanation = descriptor?.explanation ?? '';
    context.findings.push({
        ruleId,
        ruleTitle: descriptor?.title ?? ruleId,
        severity: severityOverride ?? descriptor?.severity ?? 'WARNING',
        path: context.path,
        line: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        exactQuote: firstLineOf(node.text),
        explanation: detail ? `${explanation} ${detail}` : explanation,
        fixTemplate: descriptor?.fixTemplate,
        engine: 'tree-sitter',
        fileLevel: false,
    });
}

/** firstLineOf kappt bei 200 Zeichen: bis zu dieser Spalte zeigt das Zitat ab Zeilenanfang das Token sicher. */
const LAST_COLUMN_QUOTED_FROM_LINE_START = 120;
const QUOTE_LEAD_LENGTH = 80;

/**
 * Finding auf genau der Zeile, in der `node` beginnt, mit der ganzen Zeile als
 * Zitat. Für Regeln, deren Knoten ein einzelnes Token ist (`any`, ein Name):
 * das Token allein wäre als Zitat nichtssagend, ein umschließendes Statement
 * würde den Treffer über Zeilen strecken, die der PR nicht geändert hat.
 * Steht das Token weit hinten in einer langen Zeile (minifizierter Code),
 * beginnt das Zitat kurz davor, damit es den Treffer zeigt.
 */
export function addAstLineFinding(context: AstRuleContext, ruleId: string, node: TsNode, detail: string): void {
    const descriptor = RULE_REGISTRY.get(ruleId);
    const lineNumber = node.startPosition.row + 1;
    const lineStartIndex = context.source.lastIndexOf('\n', node.startIndex - 1) + 1;
    const nextNewlineIndex = context.source.indexOf('\n', node.startIndex);
    const tokenColumn = node.startIndex - lineStartIndex;
    const quoteStartIndex = tokenColumn > LAST_COLUMN_QUOTED_FROM_LINE_START
        ? node.startIndex - QUOTE_LEAD_LENGTH
        : lineStartIndex;
    const lineText = context.source.substring(quoteStartIndex, nextNewlineIndex === -1 ? undefined : nextNewlineIndex);
    context.findings.push({
        ruleId,
        ruleTitle: descriptor?.title ?? ruleId,
        severity: descriptor?.severity ?? 'WARNING',
        path: context.path,
        line: lineNumber,
        endLine: lineNumber,
        exactQuote: firstLineOf(lineText),
        explanation: `${descriptor?.explanation ?? ''} ${detail}`.trim(),
        fixTemplate: descriptor?.fixTemplate,
        engine: 'tree-sitter',
        fileLevel: false,
    });
}

export function firstLineOf(nodeText: string): string {
    const newlineIndex = nodeText.indexOf('\n');
    const firstLine = newlineIndex === -1 ? nodeText : nodeText.substring(0, newlineIndex);
    return firstLine.trim().substring(0, 200);
}

/** Nächster Funktions-Vorfahre — für "gehört Node X zu Funktion F"-Checks. */
export function enclosingNodeOfTypes(node: TsNode, nodeTypes: ReadonlySet<string>): TsNode | null {
    let ancestor = node.parent;
    while (ancestor) {
        if (nodeTypes.has(ancestor.type)) return ancestor;
        ancestor = ancestor.parent;
    }
    return null;
}

export function hasDescendantOfType(node: TsNode, ...nodeTypes: readonly string[]): boolean {
    return node.descendantsOfType(nodeTypes as string[]).some((descendant) => descendant !== null);
}

/** Funktions-Node-Typen pro Sprache (ARCH-001/002/004, Scope-Anker). */
export const FUNCTION_NODE_TYPES: Readonly<Partial<Record<PrescanLanguage, readonly string[]>>> = {
    typescript: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition', 'generator_function_declaration'],
    tsx: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition', 'generator_function_declaration'],
    javascript: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition', 'generator_function_declaration'],
    python: ['function_definition'],
    java: ['method_declaration', 'constructor_declaration'],
    go: ['function_declaration', 'method_declaration', 'func_literal'],
    rust: ['function_item', 'closure_expression'],
    c: ['function_definition'],
    cpp: ['function_definition', 'lambda_expression'],
};

export function functionNodeTypesFor(language: PrescanLanguage): readonly string[] {
    return FUNCTION_NODE_TYPES[language] ?? [];
}
