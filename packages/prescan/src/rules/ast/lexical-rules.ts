/**
 * COND-003 — Lexical Slop (Condition 3), der deterministische Teil: generische
 * Namen (`data`, `result`, `item`, `temp`, nummeriert wie `temp1`, und `e` im
 * `catch`) an NEU EINGEFÜHRTEN Bindungen in JS/TS. Emojis in Kommentaren
 * bleiben beim Modell.
 *
 * Gemeldet wird nur, wo der Autor den Namen frei gewählt hat:
 * - `const data = …` / `let result` (einfache Deklaration),
 * - Parameter einer benannten Funktion, Klassenmethode oder einer Funktion, die
 *   einer Variablen bzw. einem Klassenfeld zugewiesen oder exportiert wird,
 * - der Parameter eines `catch`.
 *
 * Bewusst NICHT gemeldet (im Zweifel still, 0-FP-Disziplin der Lane):
 * - Destrukturierung (`const { data } = await query`): der Name gehört der
 *   fremden API (Supabase, SWR, axios), nicht dem Autor.
 * - Property-Zugriffe und Objekt-Schlüssel: keine Bindung.
 * - Parameter von Inline-Callbacks (Aufruf-Argument, JSX-Attribut,
 *   Objekt-Property wie `onSuccess: (data) => …`): der Name spiegelt meist die
 *   Konvention der aufgerufenen API (`.on('data', (data) => …)`,
 *   `.then((result) => …)`, `.map((item) => …)`).
 * - Signaturen ohne Rumpf (Interface, Overload, `declare`) und ambiente
 *   Deklarationen (`declare const data`): die Bindung entsteht woanders.
 * - Funktionen, die an etwas anderes als einen CommonJS-Export zugewiesen
 *   werden (`socket.onmessage = function (data) {}`).
 * - `for (const item of items)`: Schleifenvariable, Grenzfall.
 * - `e` außerhalb von `catch`: Event-Handler-Konvention (`(e) => e.preventDefault()`).
 * - Testdateien: Fixture-Namen wie `data`/`result` sind dort üblich und kein
 *   Befund, den ein Reviewer gemeldet haben will (Auftrag 2026-10-03). Dazu
 *   zählt hier auch jeder Pfad unter einem Test-Verzeichnis, siehe
 *   TEST_DIRECTORY_PATTERN.
 */
import { addAstLineFinding, enclosingNodeOfTypes, isJsTsLanguage, nodesOfType } from './ast-shared';
import type { Node as TsNode } from 'web-tree-sitter';
import type { AstRuleContext } from './ast-shared';

const LEXICAL_SLOP_RULE_ID = 'COND-003';
const CATCH_ONLY_NAME = 'e';
const AMBIENT_NODE_TYPES: ReadonlySet<string> = new Set(['ambient_declaration']);

/**
 * `isTestFile` (language.ts) erkennt `*.test.*`/`*.spec.*`, aber weder
 * JS-Dateien unter `test/` noch Hilfsdateien unter `__tests__/` (ROADMAP §1, offenes
 * To-Do). In der Korpus-Stichprobe lagen deshalb 9 von 28 Namens-Treffern in
 * Testcode (npm/cli `test/`, vite `__tests__/`). Bis `isTestFile` das abdeckt,
 * schweigt diese Regel unter jedem Test-Verzeichnis.
 */
const TEST_DIRECTORY_PATTERN = /(^|\/)(tests?|__tests__|__mocks__|__fixtures__|fixtures|specs?|e2e|testdata)\//i;

type BindingRole = 'variable' | 'parameter' | 'catch parameter';

/** Knoten, die einen TS-Parameter um den Namen legen (`pattern`-Feld). */
const TYPED_PARAMETER_NODE_TYPES: ReadonlySet<string> = new Set(['required_parameter', 'optional_parameter']);
/** Funktionsformen, deren Name oder Platz in der Klasse zeigt, dass der Autor sie definiert. */
const DECLARED_FUNCTION_NODE_TYPES: ReadonlySet<string> = new Set([
    'function_declaration', 'generator_function_declaration',
]);
const FUNCTION_VALUE_NODE_TYPES: ReadonlySet<string> = new Set([
    'arrow_function', 'function_expression', 'generator_function',
]);
/** Eltern eines Funktionswerts, die ihn zur Definition machen (kein Callback-Argument). */
const DEFINITION_PARENT_NODE_TYPES: ReadonlySet<string> = new Set([
    'variable_declarator', 'public_field_definition', 'field_definition', 'export_statement',
]);
/**
 * CommonJS-Export (`module.exports = function (data) {}`, `exports.run = …`).
 * Jede andere Zuweisung (`socket.onmessage = …`, `Store.prototype.run = …`)
 * bleibt still: dort kann der Name die Konvention des Ziels spiegeln.
 */
const COMMONJS_EXPORT_TARGET_PATTERN = /^(module\.)?exports\b/;
/** Hüllen um den Namen eines Parameters: Default-Wert (`data = {}`) und Rest (`...data`). */
const PARAMETER_WRAPPER_NODE_TYPES: ReadonlySet<string> = new Set(['assignment_pattern', 'rest_pattern']);

export function collectLexicalFindings(context: AstRuleContext): void {
    if (!isJsTsLanguage(context.language) || context.isTestFile) return;
    if (TEST_DIRECTORY_PATTERN.test(context.path.replace(/\\/g, '/'))) return;

    for (const identifierNode of nodesOfType(context, 'identifier')) {
        const bindingRole = resolveBindingRole(identifierNode);
        if (bindingRole === null) continue;
        if (identifierNode.text === CATCH_ONLY_NAME && bindingRole !== 'catch parameter') continue;

        addAstLineFinding(context, LEXICAL_SLOP_RULE_ID, identifierNode,
            `(Generic ${bindingRole} name \`${identifierNode.text}\`: name it after what it holds.)`);
    }
}

/** Rolle des Bezeichners als neue Bindung, `null` für jede andere Verwendung. */
function resolveBindingRole(identifierNode: TsNode): BindingRole | null {
    const parentNode = identifierNode.parent;
    if (!parentNode) return null;

    if (parentNode.type === 'variable_declarator') {
        // `declare const data: Shape` beschreibt eine fremde Bindung, sie führt keine ein.
        const introducesBinding = isFieldOf(parentNode, 'name', identifierNode)
            && enclosingNodeOfTypes(parentNode, AMBIENT_NODE_TYPES) === null;
        return introducesBinding ? 'variable' : null;
    }
    if (parentNode.type === 'catch_clause') {
        return isFieldOf(parentNode, 'parameter', identifierNode) ? 'catch parameter' : null;
    }

    const functionNode = resolveParameterOwner(identifierNode, parentNode);
    return functionNode !== null && isAuthorDefinedFunction(functionNode) ? 'parameter' : null;
}

/** Die Funktion, deren Parameter der Bezeichner ist — sonst `null`. */
function resolveParameterOwner(identifierNode: TsNode, parentNode: TsNode): TsNode | null {
    // `value => …`: einzelner Parameter ohne Klammern.
    if (parentNode.type === 'arrow_function') {
        return isFieldOf(parentNode, 'parameter', identifierNode) ? parentNode : null;
    }
    const parameterNode = unwrapParameterName(identifierNode, parentNode);
    const parameterParent = parameterNode?.parent;
    if (!parameterNode || !parameterParent) return null;

    // JavaScript: der Name steht direkt in der Parameterliste.
    if (parameterParent.type === 'formal_parameters') return parameterParent.parent;
    // TypeScript: `name: Type` bzw. `name?: Type` um den Namen.
    if (TYPED_PARAMETER_NODE_TYPES.has(parameterParent.type) && isFieldOf(parameterParent, 'pattern', parameterNode)) {
        return parameterParent.parent?.parent ?? null;
    }
    return null;
}

/** Der Knoten, der in der Parameterliste steht: der Name selbst oder seine Default-/Rest-Hülle. */
function unwrapParameterName(identifierNode: TsNode, parentNode: TsNode): TsNode | null {
    if (!PARAMETER_WRAPPER_NODE_TYPES.has(parentNode.type)) return identifierNode;
    // In `data = fallback` ist nur die linke Seite der Parameter, `fallback` ist ein Ausdruck.
    const isDefaultValue = parentNode.type === 'assignment_pattern' && !isFieldOf(parentNode, 'left', identifierNode);
    return isDefaultValue ? null : parentNode;
}

function isAuthorDefinedFunction(functionNode: TsNode): boolean {
    // Overloads, Interface- und `declare`-Signaturen haben keinen Rumpf.
    if (functionNode.childForFieldName('body') === null) return false;
    if (DECLARED_FUNCTION_NODE_TYPES.has(functionNode.type)) return true;
    if (functionNode.type === 'method_definition') return functionNode.parent?.type === 'class_body';
    if (!FUNCTION_VALUE_NODE_TYPES.has(functionNode.type)) return false;

    const valueParent = functionNode.parent;
    if (valueParent?.type === 'assignment_expression') {
        return COMMONJS_EXPORT_TARGET_PATTERN.test(valueParent.childForFieldName('left')?.text ?? '');
    }
    return DEFINITION_PARENT_NODE_TYPES.has(valueParent?.type ?? '');
}

function isFieldOf(parentNode: TsNode, fieldName: string, candidateNode: TsNode): boolean {
    return parentNode.childForFieldName(fieldName)?.startIndex === candidateNode.startIndex;
}
