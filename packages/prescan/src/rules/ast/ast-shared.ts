/**
 * Gemeinsame Helfer der AST-Regeln (tree-sitter).
 *
 * Ein Tree pro Datei, EIN Durchlauf: collectNodesByType baut per Cursor-DFS
 * Buckets pro Node-Typ; die Regel-Module iterieren nur noch Buckets statt
 * selbst zu traversieren (pre_scanner_design.md §2).
 */
import { RULE_REGISTRY } from '../registry';
import type { Node as TsNode } from 'web-tree-sitter';
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

/** Alle Typen, die für eine Sprache gebucketet werden müssen. */
export function buildWantedNodeTypes(language: PrescanLanguage): ReadonlySet<string> {
    return new Set([...RULE_NODE_TYPES, ...functionNodeTypesFor(language)]);
}

/**
 * Cursor-DFS über den ganzen Baum — die einzige Traversierung pro Datei.
 * Gebucketet werden NUR die angeforderten Typen; alle anderen Knoten werden
 * besucht und sofort wieder verworfen.
 */
export function collectNodesByType(
    rootNode: TsNode,
    wantedNodeTypes: ReadonlySet<string>,
): Map<string, TsNode[]> {
    const nodesByType = new Map<string, TsNode[]>();
    const cursor = rootNode.walk();

    let reachedEnd = false;
    while (!reachedEnd) {
        if (wantedNodeTypes.has(cursor.nodeType)) {
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
