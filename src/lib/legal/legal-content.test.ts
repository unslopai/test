import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { LEGAL_CONTENT_DIRECTORY, extractDocumentTitle, loadLegalDocument } from './legal-content';
import { LEGAL_PAGE_SLUGS } from './legal-pages';
import { findUnresolvedPlaceholders } from './placeholders';

/**
 * Paritäts- und Guard-Test über die ECHTEN Rechtstexte (LEGAL_PAGES_SPEC §7):
 * DE und EN müssen denselben Aufbau und dieselben offenen Marker haben, sonst
 * geht eine Fassung mit einem Versprechen live, das die andere nicht macht.
 */

async function readLegalMarkdown(slug: string, locale: string): Promise<string> {
    return readFile(path.join(LEGAL_CONTENT_DIRECTORY, `${slug}.${locale}.md`), 'utf-8');
}

function countSections(markdown: string): number {
    return markdown.split('\n').filter((line) => line.startsWith('## ')).length;
}

/** Marker-Kopf vor dem ersten Doppelpunkt — einige Marker sind bewusst übersetzt. */
function placeholderHeads(markdown: string): string[] {
    return findUnresolvedPlaceholders(markdown)
        .map((placeholder) => placeholder.split(':')[0].trim())
        .sort();
}

describe('legal content parity DE/EN', () => {
    describe.each(LEGAL_PAGE_SLUGS)('%s', (slug) => {
        it('exists in every supported locale with a top-level title', async () => {
            for (const locale of SUPPORTED_LOCALES) {
                const markdown = await readLegalMarkdown(slug, locale);
                expect(extractDocumentTitle(markdown), `${slug}.${locale}`).not.toBeNull();
            }
        });

        it('has the same number of sections and the same placeholder heads in DE and EN', async () => {
            const germanMarkdown = await readLegalMarkdown(slug, 'de');
            const englishMarkdown = await readLegalMarkdown(slug, 'en');
            expect(countSections(englishMarkdown)).toBe(countSections(germanMarkdown));
            expect(placeholderHeads(englishMarkdown)).toEqual(placeholderHeads(germanMarkdown));
        });
    });
});

describe('loadLegalDocument', () => {
    it('reports unresolved placeholders instead of returning the markdown', async () => {
        // Das Impressum trägt bis zur HR-Eintragung mindestens [HRB-NUMMER].
        const documentState = await loadLegalDocument('impressum', 'de');
        expect(documentState.kind).toBe('unresolved');
        if (documentState.kind === 'unresolved') {
            expect(documentState.placeholders).toContain('HRB-NUMMER');
        }
    });

    it('extracts the first H1 as document title', () => {
        expect(extractDocumentTitle('# Impressum\n\n## Anbieter')).toBe('Impressum');
        expect(extractDocumentTitle('## Kein H1')).toBeNull();
    });
});
