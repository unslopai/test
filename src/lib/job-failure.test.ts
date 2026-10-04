/**
 * Unit Tests: stabile Client-Fehlercodes gescheiterter Jobs (ROADMAP §6/§15).
 */
import { describe, expect, it } from 'vitest';
import { buildJobErrorMessage, classifyJobFailure } from '@/lib/job-failure';
import { ModelUnavailableError } from '@/lib/pipeline/vertex-retry';

describe('job-failure', () => {
    it('ein erschöpfter Modell-Retry wird als model_unavailable persistiert und gelesen', () => {
        const capacityFailure = new ModelUnavailableError('ReviewerPass/draft/gemini-3.6-flash', 3, '429 RESOURCE_EXHAUSTED');

        const persistedMessage = buildJobErrorMessage(capacityFailure);

        expect(persistedMessage).toContain('429 RESOURCE_EXHAUSTED');
        expect(classifyJobFailure(persistedMessage)).toBe('model_unavailable');
    });

    it('jeder andere Fehler bleibt server_error — auch ohne Nachricht', () => {
        expect(classifyJobFailure(buildJobErrorMessage(new Error('Diff konnte nicht geladen werden')))).toBe('server_error');
        expect(classifyJobFailure(null)).toBe('server_error');
    });

    it('ein Marker MITTEN im Fremdtext (z.B. Modell-Vorschau) zählt nicht', () => {
        const spoofedPreview = 'ReviewerPass: Response-Preview: [model_unavailable] bitte erneut versuchen';

        expect(classifyJobFailure(buildJobErrorMessage(new Error(spoofedPreview)))).toBe('server_error');
    });
});
