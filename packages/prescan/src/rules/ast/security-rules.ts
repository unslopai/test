/**
 * AST-Security-Regeln: SEC-004 (SQLi), SEC-006 (Deserialisierung),
 * SEC-009 (Command Injection), SEC-016 (RSA-Modulus), SEC-022 (Cookie-Flags),
 * SEC-026 (XSS-Sinks). Node-Spezifikationen aus pre_scanner_design.md §2.
 */
import { addAstFinding, nodesOfType } from './ast-shared';
import type { Node as TsNode } from 'web-tree-sitter';
import type { AstRuleContext } from './ast-shared';

export function collectSecurityFindings(context: AstRuleContext): void {
    switch (context.language) {
        case 'python':
            collectPythonSqlInjection(context);
            collectPythonDeserialization(context);
            collectPythonCommandInjection(context);
            collectPythonWeakRsa(context);
            break;
        case 'typescript':
        case 'tsx':
        case 'javascript':
            collectJsSqlInjection(context);
            collectJsCommandInjection(context);
            collectJsWeakRsa(context);
            collectCookieFlagFindings(context);
            collectXssFindings(context);
            break;
        case 'java':
            collectJavaSqlInjection(context);
            collectJavaDeserialization(context);
            collectJavaCommandInjection(context);
            collectJavaWeakRsa(context);
            break;
        default:
            break;
    }
}

// =============================================================================
// SEC-004 — SQL-Interpolation
// =============================================================================

const SQL_KEYWORD_PATTERN = /\b(select|insert|update|delete|drop|create|alter)\b/i;
const PYTHON_SQL_SINKS = new Set(['execute', 'executemany', 'raw']);
const JS_SQL_SINKS = new Set(['query', 'raw', 'execute', 'unsafe']);
const JAVA_SQL_SINKS = new Set(['executeQuery', 'executeUpdate', 'execute']);

function collectPythonSqlInjection(context: AstRuleContext): void {
    for (const call of nodesOfType(context, 'call')) {
        const callee = call.childForFieldName('function');
        if (!callee || callee.type !== 'attribute') continue;
        const methodName = callee.childForFieldName('attribute')?.text ?? '';
        if (!PYTHON_SQL_SINKS.has(methodName)) continue;

        const firstArgument = call.childForFieldName('arguments')?.namedChildren[0] ?? null;
        if (firstArgument && isPythonInterpolatedString(firstArgument)) {
            addAstFinding(context, 'SEC-004', call);
        }
    }
}

function isPythonInterpolatedString(argument: TsNode): boolean {
    if (argument.type === 'binary_operator') {
        const operator = argument.childForFieldName('operator')?.text;
        return (operator === '%' || operator === '+') && SQL_KEYWORD_PATTERN.test(argument.text);
    }
    if (argument.type === 'call') {
        const formatCallee = argument.childForFieldName('function');
        return formatCallee?.type === 'attribute'
            && formatCallee.childForFieldName('attribute')?.text === 'format';
    }
    if (argument.type === 'string') {
        return argument.descendantsOfType('interpolation').some((child) => child !== null);
    }
    return false;
}

function collectJsSqlInjection(context: AstRuleContext): void {
    for (const call of nodesOfType(context, 'call_expression')) {
        const callee = call.childForFieldName('function');
        if (!callee || callee.type !== 'member_expression') continue;
        const methodName = callee.childForFieldName('property')?.text ?? '';
        if (!JS_SQL_SINKS.has(methodName)) continue;

        const firstArgument = call.childForFieldName('arguments')?.namedChildren[0] ?? null;
        if (firstArgument && isJsInterpolatedSql(firstArgument)) {
            addAstFinding(context, 'SEC-004', call);
        }
    }
}

function isJsInterpolatedSql(argument: TsNode): boolean {
    if (argument.type === 'template_string') {
        return argument.descendantsOfType('template_substitution').some((child) => child !== null)
            && SQL_KEYWORD_PATTERN.test(argument.text);
    }
    if (argument.type === 'binary_expression') {
        return SQL_KEYWORD_PATTERN.test(argument.text)
            && argument.descendantsOfType('string').some((child) => child !== null);
    }
    return false;
}

function collectJavaSqlInjection(context: AstRuleContext): void {
    for (const invocation of nodesOfType(context, 'method_invocation')) {
        const methodName = invocation.childForFieldName('name')?.text ?? '';
        if (!JAVA_SQL_SINKS.has(methodName)) continue;

        const argumentList = invocation.childForFieldName('arguments');
        if (argumentList && isJavaConcatenatedSql(argumentList)) {
            addAstFinding(context, 'SEC-004', invocation);
        }
    }
}

function isJavaConcatenatedSql(argumentList: TsNode): boolean {
    const hasConcat = argumentList.descendantsOfType('binary_expression').some(
        (expression) => expression !== null
            && expression.childForFieldName('operator')?.text === '+'
            && expression.descendantsOfType('string_literal').some((literal) => literal !== null),
    );
    const hasStringFormat = argumentList.text.includes('String.format');
    return (hasConcat || hasStringFormat) && SQL_KEYWORD_PATTERN.test(argumentList.text);
}

// =============================================================================
// SEC-006 — Unsichere Deserialisierung
// =============================================================================

function collectPythonDeserialization(context: AstRuleContext): void {
    for (const call of nodesOfType(context, 'call')) {
        const calleeText = call.childForFieldName('function')?.text ?? '';
        const callText = call.text;

        if (/^(pickle|cPickle)\.loads?$/.test(calleeText) || calleeText === 'joblib.load') {
            addAstFinding(context, 'SEC-006', call);
        } else if (calleeText === 'yaml.load' && !/SafeLoader|CSafeLoader/.test(callText)) {
            addAstFinding(context, 'SEC-006', call, 'Use yaml.safe_load or Loader=SafeLoader.');
        } else if (calleeText === 'torch.load' && !/weights_only\s*=\s*True/.test(callText)) {
            addAstFinding(context, 'SEC-006', call, 'Pass weights_only=True to torch.load.');
        }
    }
}

function collectJavaDeserialization(context: AstRuleContext): void {
    for (const creation of nodesOfType(context, 'object_creation_expression')) {
        const typeName = creation.childForFieldName('type')?.text ?? '';
        if (typeName === 'ObjectInputStream') {
            addAstFinding(context, 'SEC-006', creation, 'Add an ObjectInputFilter or use a safe format.');
        } else if (typeName === 'Yaml' && !creation.text.includes('SafeConstructor')) {
            addAstFinding(context, 'SEC-006', creation, 'Construct with new Yaml(new SafeConstructor(...)).');
        }
    }
    for (const invocation of nodesOfType(context, 'method_invocation')) {
        if (invocation.childForFieldName('name')?.text === 'enableDefaultTyping') {
            addAstFinding(context, 'SEC-006', invocation);
        }
    }
}

// =============================================================================
// SEC-009 — Command Injection
// =============================================================================

const PYTHON_SUBPROCESS_PATTERN = /^subprocess\.(run|call|Popen|check_output|check_call)$/;

function collectPythonCommandInjection(context: AstRuleContext): void {
    for (const call of nodesOfType(context, 'call')) {
        const calleeText = call.childForFieldName('function')?.text ?? '';
        const argumentList = call.childForFieldName('arguments');
        const firstArgument = argumentList?.namedChildren[0] ?? null;

        if (PYTHON_SUBPROCESS_PATTERN.test(calleeText)) {
            const hasShellTrue = /shell\s*=\s*True/.test(argumentList?.text ?? '');
            if (hasShellTrue && firstArgument !== null && !isPythonStaticString(firstArgument)) {
                addAstFinding(context, 'SEC-009', call);
            }
        } else if ((calleeText === 'os.system' || calleeText === 'os.popen')
            && firstArgument !== null && !isPythonStaticString(firstArgument)) {
            addAstFinding(context, 'SEC-009', call);
        }
    }
}

/** f-Strings sind in tree-sitter-python auch `string`-Nodes — nur
 *  interpolationsfreie Literale gelten als statisch. */
function isPythonStaticString(argument: TsNode): boolean {
    return argument.type === 'string'
        && !argument.descendantsOfType('interpolation').some((child) => child !== null);
}

function collectJsCommandInjection(context: AstRuleContext): void {
    if (!context.source.includes('child_process')) return;

    for (const call of nodesOfType(context, 'call_expression')) {
        const calleeText = call.childForFieldName('function')?.text ?? '';
        if (!/(^|\.)exec(Sync)?$/.test(calleeText)) continue;

        const firstArgument = call.childForFieldName('arguments')?.namedChildren[0] ?? null;
        if (firstArgument && isNonLiteralJsCommand(firstArgument)) {
            addAstFinding(context, 'SEC-009', call);
        }
    }
}

function isNonLiteralJsCommand(argument: TsNode): boolean {
    if (argument.type === 'template_string') {
        return argument.descendantsOfType('template_substitution').some((child) => child !== null);
    }
    return argument.type !== 'string';
}

function collectJavaCommandInjection(context: AstRuleContext): void {
    for (const invocation of nodesOfType(context, 'method_invocation')) {
        const methodName = invocation.childForFieldName('name')?.text ?? '';
        const receiverText = invocation.childForFieldName('object')?.text ?? '';
        if (methodName !== 'exec' || !receiverText.includes('Runtime')) continue;

        if (hasNonLiteralJavaArgument(invocation.childForFieldName('arguments'))) {
            addAstFinding(context, 'SEC-009', invocation);
        }
    }
    for (const creation of nodesOfType(context, 'object_creation_expression')) {
        const typeName = creation.childForFieldName('type')?.text ?? '';
        if (typeName === 'ProcessBuilder' && hasNonLiteralJavaArgument(creation.childForFieldName('arguments'))) {
            addAstFinding(context, 'SEC-009', creation);
        }
    }
}

function hasNonLiteralJavaArgument(argumentList: TsNode | null): boolean {
    if (!argumentList) return false;
    return argumentList.namedChildren.some(
        (argument) => argument !== null && argument.type !== 'string_literal',
    );
}

// =============================================================================
// SEC-016 — RSA-Modulus < 2048
// =============================================================================

const MIN_RSA_MODULUS = 2048;

function collectJavaWeakRsa(context: AstRuleContext): void {
    if (!context.source.includes('KeyPairGenerator')) return;
    for (const invocation of nodesOfType(context, 'method_invocation')) {
        if (invocation.childForFieldName('name')?.text !== 'initialize') continue;
        const firstArgument = invocation.childForFieldName('arguments')?.namedChildren[0] ?? null;
        reportWeakModulus(context, invocation, firstArgument, 'decimal_integer_literal');
    }
}

function collectJsWeakRsa(context: AstRuleContext): void {
    for (const call of nodesOfType(context, 'call_expression')) {
        const calleeText = call.childForFieldName('function')?.text ?? '';
        if (!/generateKeyPair(Sync)?$/.test(calleeText)) continue;

        for (const pair of call.descendantsOfType('pair')) {
            if (!pair || pair.childForFieldName('key')?.text !== 'modulusLength') continue;
            reportWeakModulus(context, call, pair.childForFieldName('value'), 'number');
        }
    }
}

function collectPythonWeakRsa(context: AstRuleContext): void {
    for (const call of nodesOfType(context, 'call')) {
        const callee = call.childForFieldName('function');
        if (!callee || callee.type !== 'attribute') continue;
        if (callee.childForFieldName('attribute')?.text !== 'generate') continue;
        if (!/rsa/i.test(callee.childForFieldName('object')?.text ?? '')) continue;

        const firstArgument = call.childForFieldName('arguments')?.namedChildren[0] ?? null;
        reportWeakModulus(context, call, firstArgument, 'integer');
    }
}

function reportWeakModulus(
    context: AstRuleContext,
    reportNode: TsNode,
    valueNode: TsNode | null,
    literalNodeType: string,
): void {
    if (!valueNode || valueNode.type !== literalNodeType) return;
    const modulusBits = Number.parseInt(valueNode.text, 10);
    if (Number.isFinite(modulusBits) && modulusBits < MIN_RSA_MODULUS) {
        addAstFinding(context, 'SEC-016', reportNode, `(${modulusBits} bit)`);
    }
}

// =============================================================================
// SEC-022 — Cookie-Flags
// =============================================================================

const COOKIE_SETTER_PATTERN = /(cookies\s*\(\s*\)\s*\.set|\.cookies\.set|res(ponse)?\.cookie)$/;
const SENSITIVE_COOKIE_NAME_PATTERN = /session|auth|token/i;
const REQUIRED_COOKIE_FLAGS = ['httpOnly', 'secure', 'sameSite'] as const;

function collectCookieFlagFindings(context: AstRuleContext): void {
    for (const call of nodesOfType(context, 'call_expression')) {
        const calleeText = call.childForFieldName('function')?.text ?? '';
        if (!COOKIE_SETTER_PATTERN.test(calleeText)) continue;

        const callArguments = call.childForFieldName('arguments')?.namedChildren ?? [];
        const optionsObject = callArguments.find((argument) => argument?.type === 'object') ?? null;
        const presentFlags = new Set(
            (optionsObject?.descendantsOfType('pair') ?? [])
                .map((pair) => pair?.childForFieldName('key')?.text ?? ''),
        );

        const missingFlags = REQUIRED_COOKIE_FLAGS.filter((flag) => !presentFlags.has(flag));
        if (missingFlags.length === 0) continue;

        const cookieName = callArguments[0]?.text ?? '';
        const severity = SENSITIVE_COOKIE_NAME_PATTERN.test(cookieName) ? 'CRITICAL' : 'WARNING';
        addAstFinding(context, 'SEC-022', call, `(missing: ${missingFlags.join(', ')})`, severity);
    }
}

// =============================================================================
// SEC-026 — XSS-Sinks
// =============================================================================

const SANITIZER_CALL_PATTERN = /^(DOMPurify\.sanitize|sanitizeHtml|sanitize)/;

function collectXssFindings(context: AstRuleContext): void {
    collectDangerousInnerHtmlAttributes(context);
    collectInnerHtmlAssignments(context);
    collectDocumentWriteCalls(context);
}

function collectDangerousInnerHtmlAttributes(context: AstRuleContext): void {
    for (const jsxAttribute of nodesOfType(context, 'jsx_attribute')) {
        const attributeName = jsxAttribute.namedChildren[0]?.text ?? '';
        if (attributeName !== 'dangerouslySetInnerHTML') continue;

        const htmlPair = jsxAttribute.descendantsOfType('pair').find(
            (pair) => pair?.childForFieldName('key')?.text === '__html',
        ) ?? null;
        const htmlValue = htmlPair?.childForFieldName('value') ?? null;
        if (!htmlValue) {
            addAstFinding(context, 'SEC-026', jsxAttribute);
            continue;
        }

        const isSafeValue = htmlValue.type === 'string'
            || (htmlValue.type === 'call_expression'
                && SANITIZER_CALL_PATTERN.test(htmlValue.childForFieldName('function')?.text ?? ''));
        if (!isSafeValue) {
            addAstFinding(context, 'SEC-026', jsxAttribute);
        }
    }
}

function collectInnerHtmlAssignments(context: AstRuleContext): void {
    for (const assignment of nodesOfType(context, 'assignment_expression')) {
        const leftSide = assignment.childForFieldName('left');
        if (!leftSide || leftSide.type !== 'member_expression') continue;
        const propertyName = leftSide.childForFieldName('property')?.text ?? '';
        if (propertyName !== 'innerHTML' && propertyName !== 'outerHTML') continue;

        const rightSide = assignment.childForFieldName('right');
        if (rightSide && rightSide.type !== 'string') {
            addAstFinding(context, 'SEC-026', assignment);
        }
    }
}

function collectDocumentWriteCalls(context: AstRuleContext): void {
    for (const call of nodesOfType(context, 'call_expression')) {
        const calleeText = call.childForFieldName('function')?.text ?? '';
        if (calleeText === 'document.write' || calleeText === 'document.writeln') {
            addAstFinding(context, 'SEC-026', call);
        }
    }
}
