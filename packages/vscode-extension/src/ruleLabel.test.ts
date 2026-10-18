/**
 * Unit Tests: Zerlegung des Regel-Labels in Regel-ID und Titel.
 */
import { describe, expect, it } from 'vitest';
import { splitRuleLabel } from './ruleLabel';

describe('splitRuleLabel', () => {
    it('trennt „COND-003 (Lexical Slop)“ in COND-003 und Lexical Slop', () => {
        expect(splitRuleLabel('COND-003 (Lexical Slop)')).toEqual({ ruleId: 'COND-003', ruleTitle: 'Lexical Slop' });
    });

    it('trennt „SEC-005: Hardcoded secret“ in SEC-005 und Hardcoded secret', () => {
        expect(splitRuleLabel('SEC-005: Hardcoded secret')).toEqual({ ruleId: 'SEC-005', ruleTitle: 'Hardcoded secret' });
    });

    it('nimmt ein Label ohne ID-Präfix ganz als ID, ohne Titel', () => {
        expect(splitRuleLabel('Deep review')).toEqual({ ruleId: 'Deep review', ruleTitle: null });
    });

    it('trennt auch einen Gedankenstrich-Titel und trimmt das Label', () => {
        expect(splitRuleLabel('  SEC-005 - Hardcoded secret  ')).toEqual({ ruleId: 'SEC-005', ruleTitle: 'Hardcoded secret' });
    });

    it('liefert für eine nackte ID oder leere Klammern keinen Titel', () => {
        expect(splitRuleLabel('SEC-012')).toEqual({ ruleId: 'SEC-012', ruleTitle: null });
        expect(splitRuleLabel('SEC-012 ()')).toEqual({ ruleId: 'SEC-012', ruleTitle: null });
    });

    it('erkennt wie der Server nur dreistellige IDs (SEC-0051 ist keine)', () => {
        expect(splitRuleLabel('SEC-0051 (x)')).toEqual({ ruleId: 'SEC-0051 (x)', ruleTitle: null });
    });
});
