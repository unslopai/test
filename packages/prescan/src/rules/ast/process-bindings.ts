/**
 * Löst Prozess-Aufrufe über die Importe einer Datei auf (SEC-009), damit die
 * Regeln am Ursprung einer Funktion hängen und nicht an ihrem Namen:
 *
 * - JS/TS: welche lokalen Namen `child_process`-Funktionen sind — Import,
 *   `require`, `await import(...)`, Destrukturierung, Namespace (`cp.exec`)
 *   und Aliase darauf (`const execAsync = promisify(exec)`, `const run = cp.spawn`).
 *   Ein `.exec` auf einem anderen Objekt (`pattern.exec(line)`, `db.exec(sql)`)
 *   löst nicht auf.
 * - Python: der kanonische Name eines Aufrufs über die Importe von
 *   `subprocess`, `os`, `shlex` und `asyncio` (`sp.run` ⇒ `subprocess.run`,
 *   `split` aus `from shlex import split` ⇒ `shlex.split`).
 *
 * Alles statisch und dateilokal: ein Alias, der über einen Funktionsaufruf,
 * ein Objekt-Feld oder eine andere Datei läuft, bleibt unaufgelöst.
 */
import type { Node as TsNode } from 'web-tree-sitter';

// =============================================================================
// JS/TS — child_process
// =============================================================================

const CHILD_PROCESS_MODULES: ReadonlySet<string> = new Set(['child_process', 'node:child_process']);

export interface ChildProcessBindings {
    /** Lokaler Name → Funktionsname in `child_process` (`{ spawn: run }` ⇒ run → spawn). */
    readonly functionNames: ReadonlyMap<string, string>;
    /** Lokale Namen des ganzen Moduls (`import * as cp`, `const cp = require(...)`). */
    readonly namespaceNames: ReadonlySet<string>;
}

interface MutableChildProcessBindings {
    readonly functionNames: Map<string, string>;
    readonly namespaceNames: Set<string>;
}

export function collectChildProcessBindings(rootNode: TsNode): ChildProcessBindings {
    const bindings: MutableChildProcessBindings = { functionNames: new Map(), namespaceNames: new Set() };
    for (const importStatement of rootNode.descendantsOfType('import_statement')) {
        if (importStatement) addImportBinding(importStatement, bindings);
    }
    // Dokumentreihenfolge: ein Alias steht hinter der Bindung, auf die er zeigt.
    for (const declarator of rootNode.descendantsOfType('variable_declarator')) {
        const bindingPattern = declarator?.childForFieldName('name') ?? null;
        const boundValue = declarator?.childForFieldName('value') ?? null;
        if (bindingPattern && boundValue) addDeclaratorBinding(bindingPattern, boundValue, bindings);
    }
    return bindings;
}

/** `import * as cp`, `import cp from`, `import cp = require(...)`, `import { exec as run }`. */
function addImportBinding(importStatement: TsNode, bindings: MutableChildProcessBindings): void {
    const requireClause = importStatement.namedChildren.find((importPart) => importPart?.type === 'import_require_clause') ?? null;
    const sourceNode = importStatement.childForFieldName('source') ?? requireClause?.childForFieldName('source') ?? null;
    if (!CHILD_PROCESS_MODULES.has(stripQuotes(sourceNode?.text ?? ''))) return;

    const namespaceNodes = [
        ...importStatement.descendantsOfType('namespace_import').map((namespaceImport) => namespaceImport?.namedChildren[0] ?? null),
        importStatement.descendantsOfType('import_clause')[0]?.namedChildren.find((clauseChild) => clauseChild?.type === 'identifier') ?? null,
        requireClause?.namedChildren.find((clauseChild) => clauseChild?.type === 'identifier') ?? null,
    ];
    for (const namespaceNode of namespaceNodes) {
        if (namespaceNode) bindings.namespaceNames.add(namespaceNode.text);
    }
    for (const importSpecifier of importStatement.descendantsOfType('import_specifier')) {
        const importedName = importSpecifier?.childForFieldName('name')?.text;
        const localName = importSpecifier?.childForFieldName('alias')?.text ?? importedName;
        if (importedName && localName) bindImportedName(bindings, localName, importedName);
    }
}

/** `{ default as cp }` bindet das ganze Modul, jeder andere Name eine Funktion. */
function bindImportedName(bindings: MutableChildProcessBindings, localName: string, importedName: string): void {
    if (importedName === 'default') {
        bindings.namespaceNames.add(localName);
    } else {
        bindings.functionNames.set(localName, importedName);
    }
}

/**
 * `const cp = require(...)`, `const { exec } = await import(...)`,
 * `const { spawn } = cp` und Aliase: `const spawnSync = require(...).spawnSync`,
 * `const execAsync = promisify(exec)`, `const run = cp.execFile`.
 */
function addDeclaratorBinding(bindingPattern: TsNode, boundValue: TsNode, bindings: MutableChildProcessBindings): void {
    if (isChildProcessModuleValue(boundValue, bindings.namespaceNames)) {
        addModuleValueBinding(bindingPattern, bindings);
        return;
    }
    const aliasedFunction = bindingPattern.type === 'identifier' ? resolveAliasedFunction(boundValue, bindings) : null;
    if (aliasedFunction) bindings.functionNames.set(bindingPattern.text, aliasedFunction);
}

function addModuleValueBinding(bindingPattern: TsNode, bindings: MutableChildProcessBindings): void {
    if (bindingPattern.type === 'identifier') {
        bindings.namespaceNames.add(bindingPattern.text);
        return;
    }
    for (const shorthandName of bindingPattern.descendantsOfType('shorthand_property_identifier_pattern')) {
        if (shorthandName) bindings.functionNames.set(shorthandName.text, shorthandName.text);
    }
    for (const renamedProperty of bindingPattern.descendantsOfType('pair_pattern')) {
        const importedName = renamedProperty?.childForFieldName('key')?.text;
        const localName = renamedProperty?.childForFieldName('value')?.text;
        if (importedName && localName) bindImportedName(bindings, localName, importedName);
    }
}

/** `require('child_process')`, `await import('node:child_process')` oder ein Namespace-Name. */
function isChildProcessModuleValue(boundValue: TsNode, namespaceNames: ReadonlySet<string>): boolean {
    const loadedValue = boundValue.type === 'await_expression' ? boundValue.namedChildren[0] ?? null : boundValue;
    if (!loadedValue) return false;
    if (loadedValue.type === 'identifier') return namespaceNames.has(loadedValue.text);
    if (loadedValue.type !== 'call_expression') return false;
    const loaderCallee = loadedValue.childForFieldName('function');
    const isModuleLoader = loaderCallee?.type === 'import' || loaderCallee?.text === 'require';
    return isModuleLoader && loadsChildProcess(loadedValue);
}

/** `promisify(exec)`, `util.promisify(cp.execFile)` oder der Funktionswert selbst. */
function resolveAliasedFunction(boundValue: TsNode, bindings: ChildProcessBindings): string | null {
    if (boundValue.type !== 'call_expression') return resolveChildProcessFunction(boundValue, bindings);
    const wrapperCallee = boundValue.childForFieldName('function');
    const isPromisify = wrapperCallee?.text === 'promisify'
        || (wrapperCallee?.type === 'member_expression' && wrapperCallee.childForFieldName('property')?.text === 'promisify');
    const wrappedFunction = isPromisify ? boundValue.childForFieldName('arguments')?.namedChildren[0] ?? null : null;
    return wrappedFunction ? resolveChildProcessFunction(wrappedFunction, bindings) : null;
}

function isChildProcessRequire(expression: TsNode | null): boolean {
    return expression?.type === 'call_expression'
        && expression.childForFieldName('function')?.text === 'require'
        && loadsChildProcess(expression);
}

function loadsChildProcess(loaderCall: TsNode): boolean {
    const requestedModule = loaderCall.childForFieldName('arguments')?.namedChildren[0]?.text ?? '';
    return CHILD_PROCESS_MODULES.has(stripQuotes(requestedModule));
}

/** `spawn`, `cp.spawn`, `require('child_process').spawn` → Funktionsname, sonst null. */
export function resolveChildProcessFunction(callee: TsNode | null, bindings: ChildProcessBindings): string | null {
    if (!callee) return null;
    if (callee.type === 'identifier') return bindings.functionNames.get(callee.text) ?? null;
    if (callee.type !== 'member_expression') return null;

    const receiver = callee.childForFieldName('object');
    const isChildProcessReceiver = receiver !== null
        && ((receiver.type === 'identifier' && bindings.namespaceNames.has(receiver.text)) || isChildProcessRequire(receiver));
    return isChildProcessReceiver ? callee.childForFieldName('property')?.text ?? null : null;
}

function stripQuotes(quotedText: string): string {
    return quotedText.replace(/^['"`]|['"`]$/g, '');
}

// =============================================================================
// Python — subprocess, os, shlex, asyncio
// =============================================================================

const TRACKED_PYTHON_MODULES: ReadonlySet<string> = new Set(['subprocess', 'os', 'shlex', 'asyncio', 'asyncio.subprocess']);

/** Lokaler Name → voller Name im Modul (`sp` → `subprocess`, `run` → `subprocess.run`). */
export type PythonImportAliases = ReadonlyMap<string, string>;

export function collectPythonImportAliases(rootNode: TsNode): PythonImportAliases {
    const importAliases = new Map<string, string>();
    for (const importNode of rootNode.descendantsOfType(['import_statement', 'import_from_statement'])) {
        if (importNode?.type === 'import_statement') addPythonModuleAliases(importNode, importAliases);
        else if (importNode) addPythonFromImports(importNode, importAliases);
    }
    return importAliases;
}

/** `import subprocess as sp` ⇒ sp → subprocess. Ein `import subprocess` braucht keinen Eintrag. */
function addPythonModuleAliases(importStatement: TsNode, importAliases: Map<string, string>): void {
    for (const importedName of importStatement.namedChildren) {
        if (importedName?.type !== 'aliased_import') continue;
        const moduleName = importedName.childForFieldName('name')?.text ?? '';
        const localName = importedName.childForFieldName('alias')?.text;
        if (localName && TRACKED_PYTHON_MODULES.has(moduleName)) importAliases.set(localName, moduleName);
    }
}

/** `from subprocess import run, Popen as P` ⇒ run → subprocess.run, P → subprocess.Popen. */
function addPythonFromImports(importStatement: TsNode, importAliases: Map<string, string>): void {
    const moduleNode = importStatement.childForFieldName('module_name');
    if (!moduleNode || !TRACKED_PYTHON_MODULES.has(moduleNode.text)) return;
    for (const importedName of importStatement.namedChildren) {
        if (!importedName || importedName.id === moduleNode.id) continue;
        if (importedName.type === 'dotted_name') {
            importAliases.set(importedName.text, `${moduleNode.text}.${importedName.text}`);
        } else if (importedName.type === 'aliased_import') {
            const memberName = importedName.childForFieldName('name')?.text;
            const localName = importedName.childForFieldName('alias')?.text;
            if (memberName && localName) importAliases.set(localName, `${moduleNode.text}.${memberName}`);
        }
    }
}

/**
 * Der Name über die Importe (`sp.run` ⇒ `subprocess.run`, `run` ⇒
 * `subprocess.run`) und der Name, wie er dasteht. Beide zählen: die Importe
 * gelten dateiweit, also kann ein lokales `from asyncio import subprocess` in
 * einer Funktion das Modul-`subprocess` einer anderen überdecken.
 */
export function pythonCalleeNames(callee: TsNode | null, importAliases: PythonImportAliases): readonly string[] {
    if (!callee) return [];
    const canonicalName = canonicalPythonCallee(callee, importAliases);
    return canonicalName === callee.text ? [canonicalName] : [canonicalName, callee.text];
}

function canonicalPythonCallee(callee: TsNode, importAliases: PythonImportAliases): string {
    if (callee.type === 'identifier') return importAliases.get(callee.text) ?? callee.text;
    const receiver = callee.type === 'attribute' ? callee.childForFieldName('object') : null;
    const attributeName = callee.type === 'attribute' ? callee.childForFieldName('attribute')?.text : undefined;
    if (receiver?.type === 'identifier' && attributeName) {
        return `${importAliases.get(receiver.text) ?? receiver.text}.${attributeName}`;
    }
    return callee.text;
}
