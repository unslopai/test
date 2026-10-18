/**
 * Platzhalter-Guard (LEGAL_PAGES_SPEC.md §5.4).
 *
 * Die Rechtstexte tragen offene Werte als `[HRB-NUMMER]` und Vorbedingungen
 * als `[VORBEDINGUNG V9: …]`. Beides darf nie öffentlich werden: eine
 * freigeschaltete Seite mit offenem Platzhalter rendert 404, nicht den Text.
 *
 * Erkannt wird jede eckige Klammer, die mit einem Großbuchstaben (auch Umlaut)
 * beginnt und NICHT von `(` gefolgt wird — Letzteres ist ein Markdown-Link
 * wie `[Datenschutzerklärung](/de/privacy)`.
 */

const PLACEHOLDER_PATTERN = /\[([A-ZÄÖÜ][^\]\n]*)\](?!\()/g;

export function findUnresolvedPlaceholders(markdown: string): readonly string[] {
    const placeholders = new Set<string>();
    for (const match of markdown.matchAll(PLACEHOLDER_PATTERN)) {
        placeholders.add(match[1]);
    }
    return [...placeholders];
}
