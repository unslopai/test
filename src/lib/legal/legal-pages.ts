/**
 * Rechtsseiten-Registry und Freischaltung (LEGAL_PAGES_SPEC.md §5.1/§5.2).
 *
 * Die Slugs sind locale-unabhängig (`/de/privacy`, `/en/privacy`), weil der
 * Waitlist-Consent `/{locale}/privacy` schon verlinkt. Das Flag ist eine
 * kommagetrennte Slug-Liste, damit Impressum + Datenschutz am Eintragungstag
 * live gehen können, Terms/Refund/AVV aber erst zum Paddle-Cutover
 * (Spec §4, Stufen A/B/C). Einziger Leseort, zur Laufzeit gelesen (Muster
 * `waitlist-flag.ts`), damit Tests per stubEnv schalten.
 */

export const LEGAL_PAGE_SLUGS = ['impressum', 'privacy', 'terms', 'refund', 'dpa'] as const;
export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];

export const LEGAL_PAGES_LIVE_ENV = 'NEXT_PUBLIC_LEGAL_PAGES_LIVE';

export function isLegalPageSlug(candidate: string): candidate is LegalPageSlug {
    return (LEGAL_PAGE_SLUGS as readonly string[]).includes(candidate);
}

/** Slugs, die das Flag freischaltet — unbekannte Einträge werden ignoriert (fail-closed). */
export function liveLegalPageSlugs(): readonly LegalPageSlug[] {
    const rawFlag = process.env[LEGAL_PAGES_LIVE_ENV] ?? '';
    const requestedSlugs = rawFlag
        .split(',')
        .map((slugCandidate) => slugCandidate.trim())
        .filter((slugCandidate) => slugCandidate.length > 0);
    return LEGAL_PAGE_SLUGS.filter((knownSlug) => requestedSlugs.includes(knownSlug));
}

export function isLegalPageLive(slug: LegalPageSlug): boolean {
    return liveLegalPageSlugs().includes(slug);
}

export const LEGAL_PLACEHOLDER_PREVIEW_ENV = 'LEGAL_PAGES_PREVIEW_PLACEHOLDERS';

/**
 * Sichtprüfung vor der Eintragung (Spec §5.4): Texte mit offenen Platzhaltern
 * dürfen lokal und in Vercel-Previews gerendert werden, damit Luca sie im
 * Layout lesen kann. In Production ist der Schalter wirkungslos — dort gilt
 * der Guard ohne Ausnahme.
 */
export function isPlaceholderPreviewAllowed(): boolean {
    return process.env[LEGAL_PLACEHOLDER_PREVIEW_ENV] === 'true'
        && process.env.VERCEL_ENV !== 'production';
}
