import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SupportedLocale } from '@/i18n/config';
import type { LegalPageSlug } from './legal-pages';
import { findUnresolvedPlaceholders } from './placeholders';

/**
 * Lädt einen Rechtstext aus `src/content/legal/{slug}.{locale}.md`
 * (LEGAL_PAGES_SPEC.md §5.3). Die Markdown-Dateien sind die Quelle, die Luca
 * freigegeben hat — kein JSX-Abtippen. `outputFileTracingIncludes` in
 * next.config.ts nimmt den Ordner ins Deployment auf.
 */

export const LEGAL_CONTENT_DIRECTORY = path.join(process.cwd(), 'src', 'content', 'legal');

export type LegalDocumentState =
    | { readonly kind: 'ready'; readonly markdown: string }
    | { readonly kind: 'unresolved'; readonly markdown: string; readonly placeholders: readonly string[] };

export async function loadLegalDocument(
    slug: LegalPageSlug,
    locale: SupportedLocale,
): Promise<LegalDocumentState> {
    const documentPath = path.join(LEGAL_CONTENT_DIRECTORY, `${slug}.${locale}.md`);
    const markdown = await readFile(documentPath, 'utf-8');
    const placeholders = findUnresolvedPlaceholders(markdown);
    if (placeholders.length > 0) {
        return { kind: 'unresolved', markdown, placeholders };
    }
    return { kind: 'ready', markdown };
}

/** Erste `# `-Überschrift des Dokuments — wird zum Seitentitel. */
export function extractDocumentTitle(markdown: string): string | null {
    const headingLine = markdown.split('\n').find((line) => line.startsWith('# '));
    return headingLine ? headingLine.slice(2).trim() : null;
}
