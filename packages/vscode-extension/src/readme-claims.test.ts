/**
 * Claim-Policy-Guard für die Marketplace-README (MARKETING_CLAIMS.md §00):
 * die README ist die Produktseite der Extension und fällt unter dieselbe
 * Regel wie die Landing Page. Bis 2026-09-30 stand dort "119 research-backed
 * rules with verdicts no single LLM votes on" — eine Studien-Anmutung ohne
 * Beleg und eine Aussage, die der Code nicht trägt (ein Modell entscheidet
 * über jedes Modell-Finding mit).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readExtensionReadme(): string {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    return readFileSync(join(sourceDirectory, '..', 'README.md'), 'utf-8');
}

describe('Extension README against the claim policy', () => {
    it('makes no research-backed or no-LLM-votes claim', () => {
        const readmeText = readExtensionReadme();

        expect(readmeText).not.toMatch(/research-backed/i);
        expect(readmeText).not.toMatch(/no single LLM/i);
    });

    it('describes the mechanism the code implements, including that not every finding is re-checked', () => {
        const readmeText = readExtensionReadme();

        expect(readmeText).toContain('Rule-based detectors check the diff first, without a model.');
        expect(readmeText).toContain('a second model re-checks its findings blind');
        // Second-opinion findings are self_reported and the verifier can be skipped
        // for time (verificationSummary.ts counts both) — no blanket re-check claim.
        expect(readmeText).toContain('Not every finding gets that re-check');
        expect(readmeText).not.toMatch(/re-checks each model finding/i);
    });
});
