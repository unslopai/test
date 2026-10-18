/**
 * AST-Regeln für Code- und Programmausführung aus Fremdeingabe, die über die
 * Shell-Formen in security-rules.ts hinausgehen:
 *
 * - SEC-009 in der Argument-Form: Python `subprocess.*` ohne `shell=True`,
 *   JS/TS `spawn`/`spawnSync`/`execFile`/`execFileSync` aus `child_process`.
 *   Ohne Shell zählt nur die Programm-Position: ein nicht-literales Argument an
 *   späterer Stelle startet kein anderes Programm. Mit `shell` in den Optionen
 *   zählt wie bei `exec` jeder Wert, der in die Kommandozeile eingebaut wird.
 * - SEC-011 für Python: `eval`/`exec` mit nicht-literalem Argument (die
 *   JS/TS-Seite liefert eslint-plugin-security, eslint-engine.ts).
 *
 * Schweregrad: CRITICAL nur, wenn der Wert sichtbar aus einer Request-Quelle
 * stammt (im Ausdruck selbst oder über eine Zuweisung in derselben Funktion).
 * Ohne sichtbare Quelle meldet die Regel nur, was schon im Code nach Injection
 * aussieht, und zwar als WARNING: `shlex.split(<nicht-literal>)`, Werte in
 * einer Shell-Kommandozeile, `eval`/`exec`. Ein nicht-literales Programm in
 * einer Liste oder als `spawn`-Argument bleibt ohne Quelle still — auf echtem
 * Code (pip, npm/cli, ffmpeg-Skripte dieses Repos) war das in allen gemessenen
 * Fällen ein Werkzeug- oder Editor-Pfad aus der Konfiguration.
 */
import { addAstFinding, enclosingNodeOfTypes, functionNodeTypesFor, nodesOfType } from './ast-shared';
import {
    PYTHON_SUBPROCESS_PATTERN,
    collectModuleTextConstantNames,
    isModuleOwnedText,
    isPythonStaticString,
} from './security-rules';
import type { Node as TsNode } from 'web-tree-sitter';
import type { AstRuleContext } from './ast-shared';
import type { PrescanSeverity } from '../../types';

export function collectCodeExecutionFindings(context: AstRuleContext): void {
    switch (context.language) {
        case 'python':
            collectPythonArgvCommandInjection(context);
            collectPythonDynamicEvaluation(context);
            break;
        case 'typescript':
        case 'tsx':
        case 'javascript':
            collectJsArgvCommandInjection(context);
            break;
        default:
            break;
    }
}

// =============================================================================
// Request-Quelle (entscheidet CRITICAL gegen WARNING)
// =============================================================================

/**
 * `request.args`, `req.query`, `flask.request.form`, `self.request.GET`.
 * Kein Treffer auf `urllib.request.urlopen` (Punkt davor), `requests.get` und
 * die Attribute des pytest-Fixtures `request` (`request.param`,
 * `request.config`, `request.getfixturevalue(...)`): die liefern Testwerte,
 * keine Nutzereingabe.
 */
const REQUEST_SOURCE_PATTERN = /(?<![\w.])(?:(?:self|flask)\.)?(?:request|req)\.(?!(?:param|config|node|getfixturevalue|fixturename|addfinalizer|applymarker|cls|module|function|instance|keywords|scope|session|fspath|path)\b)[A-Za-z_]/;

const ASSIGNMENT_NODE_TYPES: readonly string[] = ['assignment', 'variable_declarator', 'assignment_expression'];
/** Text-Anteile von String-Literalen: dort ist `req.json` ein Dateiname, keine Quelle. */
const STRING_CONTENT_NODE_TYPES: readonly string[] = ['string_content', 'string_fragment'];

function severityForSources(context: AstRuleContext, untrustedExpressions: readonly TsNode[]): PrescanSeverity {
    return untrustedExpressions.some((untrustedExpression) => isVisiblyRequestSourced(context, untrustedExpression))
        ? 'CRITICAL'
        : 'WARNING';
}

/**
 * Sichtbar heißt: der Ausdruck nennt die Request-Quelle selbst, oder einer
 * seiner Bezeichner wird im selben Scope (dieselbe Funktion, ohne innere
 * Funktionen; sonst die Modul-Ebene) aus einem Ausdruck mit Request-Quelle
 * zugewiesen — genau ein Schritt, kein Datenfluss über Funktionsgrenzen.
 */
function isVisiblyRequestSourced(context: AstRuleContext, untrustedExpression: TsNode): boolean {
    if (namesRequestSource(untrustedExpression)) return true;

    const referencedNames = new Set(
        [untrustedExpression, ...untrustedExpression.descendantsOfType('identifier')]
            .filter((node): node is TsNode => node !== null && node.type === 'identifier')
            .map((identifier) => identifier.text),
    );
    if (referencedNames.size === 0) return false;

    const functionNodeTypes = new Set(functionNodeTypesFor(context.language));
    const enclosingFunction = enclosingNodeOfTypes(untrustedExpression, functionNodeTypes);
    const scopeId = enclosingFunction?.id ?? null;
    const scopeNode = enclosingFunction ?? untrustedExpression.tree.rootNode;
    return scopeNode.descendantsOfType([...ASSIGNMENT_NODE_TYPES]).some(
        (assignment) => assignment !== null
            && (enclosingNodeOfTypes(assignment, functionNodeTypes)?.id ?? null) === scopeId
            && assignsRequestValueTo(assignment, referencedNames),
    );
}

function namesRequestSource(expression: TsNode): boolean {
    let codeText = expression.text;
    for (const stringContent of expression.descendantsOfType([...STRING_CONTENT_NODE_TYPES])) {
        if (!stringContent) continue;
        const contentStart = stringContent.startIndex - expression.startIndex;
        const contentEnd = stringContent.endIndex - expression.startIndex;
        codeText = codeText.slice(0, contentStart) + ' '.repeat(contentEnd - contentStart) + codeText.slice(contentEnd);
    }
    return REQUEST_SOURCE_PATTERN.test(codeText);
}

function assignsRequestValueTo(assignment: TsNode, referencedNames: ReadonlySet<string>): boolean {
    const assignedTarget = assignment.childForFieldName('left') ?? assignment.childForFieldName('name');
    const assignedValue = assignment.childForFieldName('right') ?? assignment.childForFieldName('value');
    if (!assignedTarget || !assignedValue || !namesRequestSource(assignedValue)) return false;
    return boundNamesOf(assignedTarget).some((boundName) => referencedNames.has(boundName));
}

/**
 * Namen, die eine Zuweisung bindet: ein Bezeichner oder eine Destrukturierung
 * (`tool, path = …`, `const { cmd, bin: tool } = …`). Attribut- und
 * Index-Ziele (`self.name = …`, `options["x"] = …`) binden keinen Namen —
 * sonst würde jedes `self.x` den ganzen `self` markieren.
 */
function boundNamesOf(assignedTarget: TsNode): string[] {
    switch (assignedTarget.type) {
        case 'identifier':
            return [assignedTarget.text];
        case 'pattern_list':
        case 'tuple_pattern':
        case 'list_pattern':
        case 'array_pattern':
            return assignedTarget.namedChildren.flatMap((element) => (element ? boundNamesOf(element) : []));
        case 'object_pattern':
            return assignedTarget.namedChildren.flatMap((property) => (property ? boundNamesOfProperty(property) : []));
        default:
            return [];
    }
}

function boundNamesOfProperty(propertyPattern: TsNode): string[] {
    if (propertyPattern.type === 'shorthand_property_identifier_pattern') return [propertyPattern.text];
    if (propertyPattern.type === 'object_assignment_pattern') {
        const assignedName = propertyPattern.childForFieldName('left');
        return assignedName ? boundNamesOf(assignedName) : [];
    }
    const propertyValue = propertyPattern.type === 'pair_pattern' ? propertyPattern.childForFieldName('value') : null;
    return propertyValue ? boundNamesOf(propertyValue) : [];
}

// =============================================================================
// SEC-009 — Python ohne shell=True
// =============================================================================

const PROGRAM_POSITION_DETAIL = 'The program itself is not a literal: whoever controls this value chooses which executable runs, even without a shell. Resolve the executable from a fixed allow-list.';

function collectPythonArgvCommandInjection(context: AstRuleContext): void {
    for (const call of nodesOfType(context, 'call')) {
        const calleeText = call.childForFieldName('function')?.text ?? '';
        if (!PYTHON_SUBPROCESS_PATTERN.test(calleeText)) continue;
        // shell=True deckt collectPythonCommandInjection (security-rules.ts) ab.
        if (/shell\s*=\s*True/.test(call.childForFieldName('arguments')?.text ?? '')) continue;

        const commandArgument = pythonCommandArgument(call);
        if (commandArgument) reportPythonProgramPosition(context, call, commandArgument);
    }
}

/**
 * `shlex.split(<nicht-literal>)` ohne literales erstes Wort ist schon eine
 * Kommandozeile aus Fremdtext (WARNING, mit Request-Quelle CRITICAL). Eine
 * Listen-/Tupel-Form mit nicht-literalem Programm zählt nur mit sichtbarer
 * Request-Quelle. Eine nackte Variable (`run(cmd)`) bleibt still — ob sie eine
 * sicher gebaute Liste ist, ist nicht entscheidbar.
 */
function reportPythonProgramPosition(context: AstRuleContext, call: TsNode, commandArgument: TsNode): void {
    if (commandArgument.type === 'call' && commandArgument.childForFieldName('function')?.text === 'shlex.split') {
        const splitSource = commandArgument.childForFieldName('arguments')?.namedChildren[0] ?? null;
        if (splitSource && !startsWithLiteralProgram(splitSource)) {
            addAstFinding(context, 'SEC-009', call, PROGRAM_POSITION_DETAIL, severityForSources(context, [splitSource]));
        }
        return;
    }
    if (commandArgument.type !== 'list' && commandArgument.type !== 'tuple') return;
    const programElement = commandArgument.namedChildren.find((element) => element?.type !== 'comment') ?? null;
    if (programElement && !isFixedPythonProgram(programElement) && isVisiblyRequestSourced(context, programElement)) {
        addAstFinding(context, 'SEC-009', call, PROGRAM_POSITION_DETAIL, 'CRITICAL');
    }
}

/** Erstes Positionsargument oder `args=`. */
function pythonCommandArgument(call: TsNode): TsNode | null {
    const keywordCommand = pythonCallArguments(call).find(
        (callArgument) => callArgument.type === 'keyword_argument' && callArgument.childForFieldName('name')?.text === 'args',
    );
    return firstPositionalArgument(call) ?? keywordCommand?.childForFieldName('value') ?? null;
}

function firstPositionalArgument(call: TsNode): TsNode | null {
    const firstArgument = pythonCallArguments(call)[0] ?? null;
    return firstArgument && firstArgument.type !== 'keyword_argument' ? firstArgument : null;
}

function pythonCallArguments(call: TsNode): TsNode[] {
    return (call.childForFieldName('arguments')?.namedChildren ?? [])
        .filter((callArgument): callArgument is TsNode => callArgument !== null && callArgument.type !== 'comment');
}

/**
 * `shlex.split("git log " + ref)` oder `f"git log {ref}"`: das erste Wort ist
 * literal und von Leerraum abgeschlossen, also bleibt das Programm fest.
 */
function startsWithLiteralProgram(splitSource: TsNode): boolean {
    if (isStaticPythonText(splitSource) || isPythonModuleConstant(splitSource)) return true;
    const leadingLiteral = leadingPythonLiteral(splitSource);
    return leadingLiteral !== null && /^\s*\S+\s/.test(leadingLiteral);
}

/** Literal, auch geklammert oder als implizite Verkettung `"a" "b"` ohne Interpolation. */
function isStaticPythonText(expression: TsNode): boolean {
    if (expression.type === 'parenthesized_expression' || expression.type === 'concatenated_string') {
        return expression.namedChildren.every((part) => part === null || part.type === 'comment' || isStaticPythonText(part));
    }
    return isPythonStaticString(expression);
}

function leadingPythonLiteral(expression: TsNode): string | null {
    if (expression.type === 'string') {
        const contentStart = expression.child(0)?.endIndex ?? expression.startIndex;
        const firstInterpolation = expression.descendantsOfType('interpolation')[0] ?? null;
        const contentEnd = firstInterpolation?.startIndex ?? expression.child(expression.childCount - 1)?.startIndex ?? expression.endIndex;
        return expression.text.slice(contentStart - expression.startIndex, contentEnd - expression.startIndex);
    }
    if (expression.type === 'binary_operator') {
        return leadingPythonConcatenation(expression);
    }
    if (expression.type === 'concatenated_string' || expression.type === 'parenthesized_expression') {
        const firstPart = expression.namedChildren[0] ?? null;
        return firstPart ? leadingPythonLiteral(firstPart) : null;
    }
    const formatCallee = expression.type === 'call' ? expression.childForFieldName('function') : null;
    if (formatCallee?.type === 'attribute' && formatCallee.childForFieldName('attribute')?.text === 'format') {
        const formatTemplate = formatCallee.childForFieldName('object');
        return formatTemplate ? leadingPythonLiteral(formatTemplate) : null;
    }
    return null;
}

/**
 * `"git" + " log " + ref`: solange links ein vollständiges Literal steht, zählt
 * auch der Anfang des rechten Operanden zum literalen Präfix.
 */
function leadingPythonConcatenation(concatenation: TsNode): string | null {
    const leftOperand = concatenation.childForFieldName('left');
    const leftLiteral = leftOperand ? leadingPythonLiteral(leftOperand) : null;
    if (leftLiteral === null || !leftOperand || !isStaticPythonText(leftOperand)) return leftLiteral;
    if (concatenation.childForFieldName('operator')?.text !== '+') return leftLiteral;
    const rightOperand = concatenation.childForFieldName('right');
    return leftLiteral + ((rightOperand ? leadingPythonLiteral(rightOperand) : null) ?? '');
}

/** Literal, der laufende Interpreter oder eine Modul-Konstante auf einem Literal. */
function isFixedPythonProgram(programElement: TsNode): boolean {
    return isStaticPythonText(programElement) || programElement.text === 'sys.executable' || isPythonModuleConstant(programElement);
}

function isPythonModuleConstant(expression: TsNode): boolean {
    return expression.type === 'identifier'
        && collectPythonModuleStringConstants(expression.tree.rootNode).has(expression.text);
}

function collectPythonModuleStringConstants(rootNode: TsNode): ReadonlySet<string> {
    const constantNames = new Set<string>();
    for (const topLevelStatement of rootNode.namedChildren) {
        const assignment = topLevelStatement?.type === 'expression_statement' ? topLevelStatement.namedChildren[0] : null;
        if (assignment?.type !== 'assignment') continue;
        const assignedTarget = assignment.childForFieldName('left');
        const assignedValue = assignment.childForFieldName('right');
        if (assignedTarget?.type === 'identifier' && assignedValue && isPythonStaticString(assignedValue)) {
            constantNames.add(assignedTarget.text);
        }
    }
    return constantNames;
}

// =============================================================================
// SEC-011 — Python eval/exec
// =============================================================================

const PYTHON_EVALUATION_CALLEES = new Set(['eval', 'exec', 'builtins.eval', 'builtins.exec']);

/**
 * Nur der Builtin: `ast.literal_eval(...)` und Methoden gleichen Namens auf
 * anderen Objekten (`frame.eval(...)` in pandas) bleiben still.
 */
function collectPythonDynamicEvaluation(context: AstRuleContext): void {
    for (const call of nodesOfType(context, 'call')) {
        const calleeText = call.childForFieldName('function')?.text ?? '';
        if (!PYTHON_EVALUATION_CALLEES.has(calleeText)) continue;

        const evaluatedArgument = firstPositionalArgument(call);
        if (evaluatedArgument && !isStaticPythonText(evaluatedArgument)) {
            addAstFinding(context, 'SEC-011', call, undefined, severityForSources(context, [evaluatedArgument]));
        }
    }
}

// =============================================================================
// SEC-009 — JS/TS spawn/execFile aus child_process
// =============================================================================

const CHILD_PROCESS_MODULES: ReadonlySet<string> = new Set(['child_process', 'node:child_process']);
const ARGV_PROCESS_FUNCTIONS: ReadonlySet<string> = new Set(['spawn', 'spawnSync', 'execFile', 'execFileSync']);
const FIXED_JS_PROGRAMS: ReadonlySet<string> = new Set(['process.execPath', 'process.argv0']);

interface ChildProcessBindings {
    /** Lokaler Name → importierter Funktionsname (`{ spawn: run }` ⇒ run → spawn). */
    readonly functionNames: ReadonlyMap<string, string>;
    /** Lokale Namen des ganzen Moduls (`import * as cp`, `const cp = require(...)`). */
    readonly namespaceNames: ReadonlySet<string>;
}

function collectJsArgvCommandInjection(context: AstRuleContext): void {
    if (!context.source.includes('child_process')) return;
    let bindings: ChildProcessBindings | null = null;
    let moduleTextConstants: ReadonlySet<string> | null = null;

    for (const call of nodesOfType(context, 'call_expression')) {
        bindings ??= collectChildProcessBindings(call.tree.rootNode);
        const processFunction = resolveChildProcessFunction(call.childForFieldName('function'), bindings);
        if (!processFunction || !ARGV_PROCESS_FUNCTIONS.has(processFunction)) continue;

        moduleTextConstants ??= collectModuleTextConstantNames(call.tree.rootNode);
        reportJsProcessCall(context, call, moduleTextConstants);
    }
}

/**
 * Mit Shell werden Programm und Argumente zu einer Kommandozeile: jeder dort
 * eingebaute Wert zählt wie bei `exec`. Ohne Shell (oder wenn nur das Programm
 * undurchsichtig ist) zählt die Programm-Position, und nur mit sichtbarer
 * Request-Quelle.
 */
function reportJsProcessCall(context: AstRuleContext, call: TsNode, moduleTextConstants: ReadonlySet<string>): void {
    const callArguments = (call.childForFieldName('arguments')?.namedChildren ?? [])
        .filter((argument): argument is TsNode => argument !== null && argument.type !== 'comment');
    const programArgument = callArguments[0];
    if (!programArgument) return;

    const shellInterpolations = hasShellOption(callArguments)
        ? collectShellInterpolations(callArguments, moduleTextConstants)
        : [];
    if (shellInterpolations.length > 0) {
        addAstFinding(context, 'SEC-009', call, SHELL_INTERPOLATION_DETAIL, severityForSources(context, shellInterpolations));
    } else if (!isFixedJsProgram(programArgument, moduleTextConstants) && isVisiblyRequestSourced(context, programArgument)) {
        addAstFinding(context, 'SEC-009', call, PROGRAM_POSITION_DETAIL, 'CRITICAL');
    }
}

function collectChildProcessBindings(rootNode: TsNode): ChildProcessBindings {
    const functionNames = new Map<string, string>();
    const namespaceNames = new Set<string>();

    for (const importStatement of rootNode.descendantsOfType('import_statement')) {
        const moduleName = stripQuotes(importStatement?.childForFieldName('source')?.text ?? '');
        if (!importStatement || !CHILD_PROCESS_MODULES.has(moduleName)) continue;
        for (const namespaceImport of importStatement.descendantsOfType('namespace_import')) {
            const namespaceName = namespaceImport?.namedChildren[0]?.text;
            if (namespaceName) namespaceNames.add(namespaceName);
        }
        const defaultImport = importStatement.descendantsOfType('import_clause')[0]?.namedChildren
            .find((clauseChild) => clauseChild?.type === 'identifier');
        if (defaultImport) namespaceNames.add(defaultImport.text);
        for (const importSpecifier of importStatement.descendantsOfType('import_specifier')) {
            const importedName = importSpecifier?.childForFieldName('name')?.text;
            const localName = importSpecifier?.childForFieldName('alias')?.text ?? importedName;
            if (importedName && localName) functionNames.set(localName, importedName);
        }
    }
    for (const declarator of rootNode.descendantsOfType('variable_declarator')) {
        const bindingPattern = declarator?.childForFieldName('name') ?? null;
        const boundValue = declarator?.childForFieldName('value') ?? null;
        if (bindingPattern && boundValue) addRequireBinding(bindingPattern, boundValue, functionNames, namespaceNames);
    }
    return { functionNames, namespaceNames };
}

/** `const cp = require(...)`, `const { spawn } = require(...)`, `const spawn = require(...).spawn`. */
function addRequireBinding(
    bindingPattern: TsNode,
    boundValue: TsNode,
    functionNames: Map<string, string>,
    namespaceNames: Set<string>,
): void {
    const requiredMember = boundValue.type === 'member_expression' && isChildProcessRequire(boundValue.childForFieldName('object'))
        ? boundValue.childForFieldName('property')?.text
        : undefined;
    if (requiredMember && bindingPattern.type === 'identifier') {
        functionNames.set(bindingPattern.text, requiredMember);
        return;
    }
    if (!isChildProcessRequire(boundValue)) return;
    if (bindingPattern.type === 'identifier') {
        namespaceNames.add(bindingPattern.text);
        return;
    }
    for (const shorthandName of bindingPattern.descendantsOfType('shorthand_property_identifier_pattern')) {
        if (shorthandName) functionNames.set(shorthandName.text, shorthandName.text);
    }
    for (const renamedProperty of bindingPattern.descendantsOfType('pair_pattern')) {
        const importedName = renamedProperty?.childForFieldName('key')?.text;
        const localName = renamedProperty?.childForFieldName('value')?.text;
        if (importedName && localName) functionNames.set(localName, importedName);
    }
}

function isChildProcessRequire(expression: TsNode | null): boolean {
    if (!expression || expression.type !== 'call_expression') return false;
    if (expression.childForFieldName('function')?.text !== 'require') return false;
    const requiredModule = expression.childForFieldName('arguments')?.namedChildren[0]?.text ?? '';
    return CHILD_PROCESS_MODULES.has(stripQuotes(requiredModule));
}

/** `spawn(...)`, `cp.spawn(...)`, `require('child_process').spawn(...)` → Funktionsname, sonst null. */
function resolveChildProcessFunction(callee: TsNode | null, bindings: ChildProcessBindings): string | null {
    if (!callee) return null;
    if (callee.type === 'identifier') return bindings.functionNames.get(callee.text) ?? null;
    if (callee.type !== 'member_expression') return null;

    const receiver = callee.childForFieldName('object');
    const isChildProcessReceiver = receiver !== null
        && ((receiver.type === 'identifier' && bindings.namespaceNames.has(receiver.text)) || isChildProcessRequire(receiver));
    return isChildProcessReceiver ? callee.childForFieldName('property')?.text ?? null : null;
}

const SHELL_OFF_VALUES: ReadonlySet<string> = new Set(['false', 'undefined', 'null', '0', "''", '""']);
const JS_SCALAR_LITERAL_TYPES: ReadonlySet<string> = new Set(['number', 'true', 'false', 'null', 'undefined']);

/** `shell: true`, `shell: '/bin/bash'`, `shell: isWindows` — alles außer einem literalen Aus. */
function hasShellOption(callArguments: readonly TsNode[]): boolean {
    return callArguments.slice(1).some((argument) => argument.type === 'object' && argument.namedChildren.some((property) => {
        if (property?.type === 'shorthand_property_identifier') return property.text === 'shell';
        const shellValue = property?.type === 'pair' && property.childForFieldName('key')?.text === 'shell'
            ? property.childForFieldName('value')
            : null;
        return shellValue !== null && !SHELL_OFF_VALUES.has(shellValue.text);
    }));
}

const SHELL_INTERPOLATION_DETAIL = 'With the shell option the program and its arguments are joined into one shell command line, so every non-literal value in it can inject shell syntax. Drop the shell option or validate the values against a strict allow-list.';

/**
 * Werte, die in die Shell-Kommandozeile eingebaut werden: ein aus Teilen
 * gebauter Programm-String (Template, Konkatenation) und nicht-literale
 * Elemente des Argument-Arrays. Ein undurchsichtiges Programm (Variable,
 * Aufruf) oder ein Argument-Array als Variable bleiben außen vor — wie die
 * nackte Variable in Python.
 */
function collectShellInterpolations(callArguments: readonly TsNode[], moduleTextConstants: ReadonlySet<string>): TsNode[] {
    const [programArgument, argvArgument] = callArguments;
    const shellInterpolations: TsNode[] = [];
    const isBuiltProgram = programArgument !== undefined
        && (programArgument.type === 'template_string' || programArgument.type === 'binary_expression');
    if (isBuiltProgram && !isModuleOwnedText(programArgument, moduleTextConstants)) {
        shellInterpolations.push(programArgument);
    }
    if (argvArgument?.type === 'array') {
        shellInterpolations.push(...argvArgument.namedChildren.filter(
            (element): element is TsNode => element !== null && element.type !== 'comment'
                && !JS_SCALAR_LITERAL_TYPES.has(element.type) && !isModuleOwnedText(element, moduleTextConstants),
        ));
    }
    return shellInterpolations;
}

/** Literal, Modul-Konstante, `process.execPath` oder ein Ternary aus solchen. */
function isFixedJsProgram(programArgument: TsNode, moduleTextConstants: ReadonlySet<string>): boolean {
    if (FIXED_JS_PROGRAMS.has(programArgument.text) || isModuleOwnedText(programArgument, moduleTextConstants)) return true;
    if (programArgument.type !== 'ternary_expression') return false;
    const consequence = programArgument.childForFieldName('consequence');
    const alternative = programArgument.childForFieldName('alternative');
    return consequence !== null && alternative !== null
        && isFixedJsProgram(consequence, moduleTextConstants) && isFixedJsProgram(alternative, moduleTextConstants);
}

function stripQuotes(quotedText: string): string {
    return quotedText.replace(/^['"`]|['"`]$/g, '');
}
