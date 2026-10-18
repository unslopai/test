import { describe, expect, it } from 'vitest';
import { findUnresolvedPlaceholders } from './placeholders';

describe('placeholder guard (LEGAL_PAGES_SPEC §5.4)', () => {
    it('finds company-data placeholders and precondition markers', () => {
        const markdown = 'HRB [HRB-NUMMER], Tel. [TELEFONNUMMER]. [VORBEDINGUNG V9: Kündigung umgesetzt]';
        expect(findUnresolvedPlaceholders(markdown)).toEqual([
            'HRB-NUMMER',
            'TELEFONNUMMER',
            'VORBEDINGUNG V9: Kündigung umgesetzt',
        ]);
    });

    it('ignores markdown links, which also use square brackets', () => {
        const markdown = 'Siehe [Datenschutzerklärung](/de/privacy) und [Terms of Service](/en/terms).';
        expect(findUnresolvedPlaceholders(markdown)).toEqual([]);
    });

    it('ignores lowercase or symbolic brackets such as footnotes', () => {
        expect(findUnresolvedPlaceholders('Quelle [1], siehe [a] und [x-default]')).toEqual([]);
    });

    it('reports each placeholder once even when it repeats', () => {
        expect(findUnresolvedPlaceholders('[DATUM] … [DATUM] … [DATUM]')).toEqual(['DATUM']);
    });

    it('recognises umlaut-initial markers', () => {
        expect(findUnresolvedPlaceholders('[ÄNDERN: später]')).toEqual(['ÄNDERN: später']);
    });
});
