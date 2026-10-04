/**
 * Nutzer-Label der Conditions (ROADMAP §3, Befund 2026-09-30): die
 * Prompt-Nummer "Condition 1 (…)" darf kein Produkt-Label sein; gezeigt wird
 * "COND-001 (Titel)" wie bei Law- und Pre-Scanner-Findings.
 */
import { describe, expect, it } from 'vitest';
import { presentConditionRule } from '@/lib/pipeline/conditions';

describe('presentConditionRule', () => {
    it('maps the prompt reference onto the registry ID and title', () => {
        expect(presentConditionRule('Condition 1 (Silent Error Swallowing)'))
            .toBe('COND-001 (Silent Error Swallowing)');
        expect(presentConditionRule('Condition 11 (JSX nesting)'))
            .toBe('COND-011 (Cyclomatic Explosion / God Component)');
    });

    it('uses the registry title even when the model paraphrased or omitted the name', () => {
        expect(presentConditionRule('Condition 7')).toBe('COND-007 (Derived State Anti-Pattern)');
    });

    it('consumes a model name with nested parentheses without leaving a stray bracket', () => {
        expect(presentConditionRule('Condition 4 (Context Blindness (DRY))'))
            .toBe('COND-004 (Context Blindness / DRY)');
    });

    it('keeps a trailing law reference the model attached', () => {
        expect(presentConditionRule('Condition 1 (Silent Error Swallowing) / MAINT-001'))
            .toBe('COND-001 (Silent Error Swallowing) / MAINT-001');
    });

    it('leaves law rules, unknown condition numbers and embedded mentions untouched', () => {
        expect(presentConditionRule('SEC-004 (Hardcoded secret)')).toBe('SEC-004 (Hardcoded secret)');
        expect(presentConditionRule('Condition 99 (Invented)')).toBe('Condition 99 (Invented)');
        expect(presentConditionRule('MAINT-001 (see Condition 1)')).toBe('MAINT-001 (see Condition 1)');
    });
});
