import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

interface LegalDocumentProps {
    readonly markdown: string;
}

/**
 * Rendert einen freigegebenen Rechtstext (LEGAL_PAGES_SPEC.md §5.3).
 * Server-Komponente, kein Roh-HTML (`skipHtml`), Tabellen und Anker über
 * remark-gfm; remark-breaks macht einfache Zeilenumbrüche (Adressblöcke) zu
 * <br>, was gefahrlos ist, weil jeder Absatz der Quelltexte eine Zeile ist.
 */
export function LegalDocument({ markdown }: LegalDocumentProps) {
    return (
        <article className="legal-document mx-auto max-w-3xl px-6 py-20 text-zinc-300">
            <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                {markdown}
            </Markdown>
        </article>
    );
}
