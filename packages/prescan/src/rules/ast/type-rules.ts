/**
 * COND-002 — Type Capitulation (Condition 2), deterministisch für TS/TSX,
 * die Direktiven auch für JS.
 *
 * Gemeldet wird
 * (a) explizites `any` in jeder Typposition (Annotation, Generic-Argument,
 *     `as any`, Default eines Typparameters),
 * (b) `@ts-ignore` und `@ts-nocheck`, dazu `@ts-expect-error` ohne Begründung,
 * (c) der Doppel-Cast `as unknown as T`.
 *
 * tree-sitter statt `@typescript-eslint` (`no-explicit-any`, `ban-ts-comment`):
 * die ESLint-Engine ist der größte RSS-Treiber der Prescan-Route, das Plugin
 * kostet beim Laden weitere ~30 MB, und ein `eslint-disable`-Kommentar im
 * Kundencode würde die Regel stumm schalten — sechs der sieben Fundstellen aus
 * unslopai/test#30 tragen einen (docs/benchmarks/LARGE_PR_CAMPAIGN.md §4).
 *
 * Testdateien sind NICHT ausgenommen: THE LAW gilt auch für Tests, und der
 * Anlass war unter anderem ein `as any` in einer Testdatei (unslopai/test#29).
 */
import { addAstLineFinding, isJsTsLanguage, nodesOfType } from './ast-shared';
import type { Node as TsNode } from 'web-tree-sitter';
import type { AstRuleContext } from './ast-shared';

const TYPE_CAPITULATION_RULE_ID = 'COND-002';

/**
 * Eine Direktive gilt nur am Anfang des Kommentars, so wie der Compiler sie
 * liest. Ein Satz wie „wir vermeiden @ts-ignore“ ist keine.
 */
const TS_DIRECTIVE_PATTERN = /^(?:\/\/+|\/\*+)\s*@ts-(ignore|nocheck|expect-error)(?![\w-])([^\n]*)/;
/** Trennzeichen zwischen Direktive und Begründung sowie das Ende eines Block-Kommentars. */
const DIRECTIVE_REASON_PADDING_PATTERN = /^[\s:–—-]+|\s*\*\/\s*$/g;

export function collectTypeCapitulationFindings(context: AstRuleContext): void {
    if (!isJsTsLanguage(context.language)) return;

    collectDirectiveFindings(context);
    // Die JavaScript-Grammatik kennt keine Typknoten.
    if (context.language === 'javascript') return;
    collectCapitulationTypeFindings(context);
}

function collectDirectiveFindings(context: AstRuleContext): void {
    for (const commentNode of nodesOfType(context, 'comment')) {
        const directiveMatch = TS_DIRECTIVE_PATTERN.exec(commentNode.text);
        if (!directiveMatch) continue;

        const [, directiveName, directiveTail] = directiveMatch;
        if (directiveName === 'expect-error') {
            // Mit Begründung ist `@ts-expect-error` die erlaubte Form: der Compiler
            // meldet sich, sobald der Fehler verschwindet.
            if (directiveTail.replace(DIRECTIVE_REASON_PADDING_PATTERN, '').length > 0) continue;
            addAstLineFinding(context, TYPE_CAPITULATION_RULE_ID, commentNode,
                '(`@ts-expect-error` without a reason: say which error is expected and why.)');
            continue;
        }
        addAstLineFinding(context, TYPE_CAPITULATION_RULE_ID, commentNode,
            `(\`@ts-${directiveName}\` switches the type checker off instead of fixing the type.)`);
    }
}

function collectCapitulationTypeFindings(context: AstRuleContext): void {
    for (const typeNode of nodesOfType(context, 'predefined_type')) {
        if (typeNode.text === 'any') {
            addAstLineFinding(context, TYPE_CAPITULATION_RULE_ID, typeNode,
                '(Explicit `any`: name the real type, or use `unknown` and narrow it.)');
        } else if (isDoubleCastPivot(typeNode)) {
            addAstLineFinding(context, TYPE_CAPITULATION_RULE_ID, typeNode,
                '(`as unknown as` forces a cast the compiler rejected. Convert or validate the value instead.)');
        }
    }
}

/** Hüllen, die zwischen den beiden Casts stehen dürfen: `(value as unknown) as T`, `(value as unknown)! as T`. */
const CAST_OPERAND_WRAPPER_NODE_TYPES: ReadonlySet<string> = new Set(['parenthesized_expression', 'non_null_expression']);

/**
 * `value as unknown as Target`: das `unknown` eines `as`, das selbst Operand
 * eines `as` ist. Die Winkel-Form `<Target><unknown>value` ist nicht erfasst
 * (in TSX gar nicht schreibbar, sonst selten).
 */
function isDoubleCastPivot(unknownTypeNode: TsNode): boolean {
    const innerCast = unknownTypeNode.parent;
    if (innerCast?.type !== 'as_expression') return false;

    let castOperand: TsNode = innerCast;
    while (castOperand.parent && CAST_OPERAND_WRAPPER_NODE_TYPES.has(castOperand.parent.type)) {
        castOperand = castOperand.parent;
    }
    const outerCast = castOperand.parent;
    return outerCast?.type === 'as_expression' && outerCast.namedChild(0)?.startIndex === castOperand.startIndex;
}
