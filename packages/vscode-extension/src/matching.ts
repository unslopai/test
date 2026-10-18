/**
 * Exact-Match-Apply-Contract (SPEC.md D5) — pur, ohne vscode-Import,
 * damit die Sicherheitslogik standalone testbar ist.
 *
 * Ein Fix darf NUR angewendet werden, wenn das exactQuote des Findings
 * nach LF-Normalisierung ZEICHENGENAU an der verankerten Zeilen-Range steht.
 * Kein Fuzzy-Matching, kein Relocieren — bei Drift wird verweigert (stale).
 */

export interface FindingAnchor {
    /** 1-basierte Startzeile (inklusive). */
    readonly line: number;
    /** 1-basierte Endzeile (inklusive). */
    readonly endLine: number;
    readonly exactQuote: string;
}

export type MatchVerdict = 'match' | 'drifted' | 'out-of-range';

export function normalizeToLf(text: string): string {
    return text.replace(/\r\n/g, '\n');
}

/**
 * Extrahiert die verankerten Zeilen [line, endLine] aus dem Dokumenttext.
 * Gibt null zurück wenn die Range außerhalb des Dokuments liegt.
 */
export function extractAnchoredText(documentText: string, anchor: FindingAnchor): string | null {
    const documentLines = normalizeToLf(documentText).split('\n');
    const startIndex = anchor.line - 1;
    const endIndex = anchor.endLine - 1;

    if (startIndex < 0 || endIndex < startIndex || endIndex >= documentLines.length) {
        return null;
    }

    return documentLines.slice(startIndex, endIndex + 1).join('\n');
}

/**
 * Prüft den Apply-Contract: steht das exactQuote noch wörtlich an der Anker-Range?
 */
export function verifyAnchor(documentText: string, anchor: FindingAnchor): MatchVerdict {
    const anchoredText = extractAnchoredText(documentText, anchor);
    if (anchoredText === null) return 'out-of-range';

    return anchoredText === normalizeToLf(anchor.exactQuote) ? 'match' : 'drifted';
}
