/**
 * Hinweiszeile zum Repo-Kontextpaket (REPO_CONTEXT_SPEC §9.2): EINE
 * Formulierung für Check Run, PR-Review, CLI und MCP.
 */
import { describe, expect, it } from 'vitest';
import { formatRepoContextNotice } from './degradation-notice.js';

describe('formatRepoContextNotice', () => {
    it('sagt bei fehlendem Paket, dass nur der Diff geprüft wurde', () => {
        expect(formatRepoContextNotice('unavailable')).toBe(
            'Reduced coverage: the repository context could not be loaded, so this review saw only the diff '
            + 'and did not check it against the manifests, schema or entry point of the repository.',
        );
    });

    it('nennt die weggelassenen Dateien eines gekürzten Pakets', () => {
        expect(formatRepoContextNotice('loaded', ['db/schema.sql'])).toBe(
            'Reduced coverage: the repository context left out 1 file '
            + '(too large, over budget, unreadable or withheld by the secret filter) — '
            + 'not checked against: db/schema.sql.',
        );
    });

    it('schweigt bei vollständigem, abgeschaltetem oder nicht mitgeliefertem Paket', () => {
        expect(formatRepoContextNotice('loaded', [])).toBeNull();
        expect(formatRepoContextNotice('disabled')).toBeNull();
        expect(formatRepoContextNotice('not_provided')).toBeNull();
        expect(formatRepoContextNotice(undefined)).toBeNull();
    });
});
