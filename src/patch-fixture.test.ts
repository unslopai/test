import { describe, expect, it } from 'vitest';

const quotedPatchLine = '+import hallucinatedKit from "hallucinated-kit-zz-proof";';

describe('patch fixture', () => {
    it('keeps the quoted import line as plain text', () => {
        expect(quotedPatchLine.startsWith('+import')).toBe(true);
    });
});
