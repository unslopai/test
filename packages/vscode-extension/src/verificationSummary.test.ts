/**
 * Unit Tests: Verifikations-Bilanz der Score-Tagline (Extension-Kopie) —
 * inklusive Parity-Guard gegen die kanonische Shared-Kopie (Muster lineRefs.ts).
 */
import { describe, expect, it } from 'vitest';
import { describeFindingVerification as sharedDescribeFindingVerification } from '@unslop/shared/node';
import { describeFindingVerification } from './verificationSummary';
import type { VerifiedFinding } from './verificationSummary';

describe('describeFindingVerification (Extension-Kopie)', () => {
    it('claims full survival only when every finding is confirmed', () => {
        expect(describeFindingVerification([{ verification: 'confirmed' }]))
            .toBe('every finding survived independent blind re-verification');
    });

    it('counts uncertain findings instead of claiming full survival', () => {
        expect(describeFindingVerification([{ verification: 'confirmed' }, { verification: 'uncertain' }]))
            .toBe('2 findings: 1 survived independent blind re-verification, 1 remained uncertain');
    });
});

describe('Parity-Guard gegen die kanonische Shared-Kopie', () => {
    // Die Extension-Kopie existiert nur, weil plain tsc keine Runtime-Exports
    // aus @unslop/shared auflöst (Header-Kommentar). Ein Fix, der nur in einer
    // Kopie landet, fällt hier laut aus statt still zu driften.
    const parityPayloads: readonly (readonly VerifiedFinding[])[] = [
        [],
        [{ verification: 'confirmed' }],
        [{ verification: 'confirmed' }, { verification: 'uncertain' }],
        [{ verification: 'self_reported' }, { verification: 'self_reported' }],
        [{ verification: 'unverified' }, {}],
        [{ verification: 'deterministic' }, { verification: 'confirmed' }, { verification: 'uncertain' }],
    ];

    it.each(parityPayloads.map((payload, payloadIndex) => [payloadIndex, payload] as const))(
        'Payload %i wird von beiden Kopien identisch gerendert',
        (_payloadIndex, payload) => {
            expect(describeFindingVerification(payload)).toBe(sharedDescribeFindingVerification(payload));
        },
    );
});
