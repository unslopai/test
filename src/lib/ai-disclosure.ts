/**
 * KI-Kennzeichnung der Ausgaben (Art. 50 Abs. 2 KI-VO, LEGAL_PAGES_SPEC §4a.3, E17 a).
 *
 * Regel: eine Ausgabe trägt die Kennzeichnung genau dann, wenn ein Modell an
 * ihrem Inhalt beteiligt war. Pre-Scan-Findings entstehen aus AST-, Regex- und
 * Config-Regeln mit festen Textbausteinen; sie als KI-generiert zu kennzeichnen
 * wäre falsch. Ein Lauf ohne Modell (`deterministic_only`, `nothing_reviewed`,
 * Short-Circuit des Pre-Scanners) bleibt deshalb ohne Label, ebenso ein
 * einzelnes Pre-Scan-Finding in einem sonst vom Modell geprüften Review.
 *
 * Form: eine sichtbare Zeile plus ein HTML-Kommentar als maschinenlesbarer
 * Marker. Beides steht am ENDE des Textes, damit die Kopfzeile des Reviews
 * (Wiedererkennung in `review-posting.ts`) unverändert bleibt.
 */
import type { IssueVerification, ScanOutcome } from '@unslop/shared';

/** Maschinenlesbarer Marker; GitHub rendert HTML-Kommentare nicht. */
export const AI_GENERATED_MARKER = '<!-- unslop:ai-generated -->';

/** Sichtbares Label. „AI-generated“ ist der Wortlaut aus E17. */
export const AI_GENERATED_NOTICE = '_AI-generated. Check it before you rely on it._';

/**
 * Nur ein Lauf mit Modell-Review erzeugt KI-generierte Ausgaben. Das Outcome
 * allein reicht nicht: beim Short-Circuit des Pre-Scanners (genug
 * deterministische CRITICALs, `llmSkipped`) heißt es `reviewed`, obwohl kein
 * Modell lief.
 */
export function isAiGeneratedRun(reviewOutcome: ScanOutcome, llmSkipped: boolean): boolean {
    return reviewOutcome === 'reviewed' && !llmSkipped;
}

/**
 * Ein Finding stammt vom Modell, wenn es nicht aus der deterministischen Lane
 * kommt. Ein fehlender Status (Ergebnisse vor 2026-09-17) zählt als Modell:
 * im Zweifel wird gekennzeichnet.
 */
export function isAiGeneratedFinding(finding: { readonly verification?: IssueVerification }): boolean {
    return finding.verification !== 'deterministic';
}

/** Hängt Label und Marker an einen Markdown-Text (Kommentar, Review-Body, Check-Summary). */
export function appendAiDisclosure(markdownText: string): string {
    return `${markdownText}\n\n${AI_GENERATED_NOTICE}\n${AI_GENERATED_MARKER}`;
}
