/**
 * The Law — Statischer Golden-Standards-Block für den System-Prompt.
 *
 * Ersetzt die frühere per-Diff-Retrieval der Golden Standards (RAG).
 * Der Block wird deterministisch gerendert (sortiert nach rule_id, festes
 * Template, keine Zeitstempel), damit er über alle Scans byte-identisch ist
 * und Geminis Implicit Context Caching als Prefix-Treffer greift.
 *
 * Vorteil gegenüber Retrieval: 100% Rule-Recall statt Top-k-Similarity.
 */
import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';

/**
 * Gerenderter Law-Block plus sein Content-Hash — der Hash ist Bestandteil
 * des Context-Cache-Keys (PROMPT_CACHING_SPEC §4.3): JEDE Law-Mutation
 * (Re-Ingest, SQL-Edit, applies_to-Änderung) rotiert damit den Cache.
 */
export interface RenderedLaw {
    readonly lawBlock: string;
    /** sha256 (hex) über den GERENDERTEN Block; '' ⇒ Hash über den Leerstring. */
    readonly lawContentHash: string;
    /**
     * Rule-IDs der tatsächlich gerenderten Regeln — die server-seitige Enum
     * für die Validierung modell-authored `rule`-Felder (ROADMAP §12,
     * Finding 2). Bewusst die GEFILTERTE Menge: eine Regel, die dem Modell
     * nie gezeigt wurde, kann es auch nicht legitim zitieren.
     */
    readonly ruleIds: readonly string[];
}

interface GoldenStandardRow {
    readonly rule_id: string;
    readonly category: string;
    /**
     * Kundensichere Erklärung (ROADMAP §12) — der EINZIGE Regeltext, der den
     * Prompt erreicht. NULL ⇒ content-freie NEUTRAL_RULE_BODY; `content` (das
     * Detektions-Rezept) wird strukturell NIE geladen oder gerendert (§3g).
     * Eine NULL-Regel verliert also ihre Detektions-Detailtiefe im Prompt —
     * neue Regeln brauchen eine authorte Erklärung, kein content-Fallback.
     */
    readonly public_explanation: string | null;
    /** Ökosystem-Tags für Dynamic Law Filtering; null/leer = universelle Regel. */
    readonly applies_to: readonly string[] | null;
}

/**
 * Fallback-Zeile für Regeln ohne `public_explanation` (§12). Bewusst
 * content-FREI: `content` (das Detektions-Rezept) darf den Prompt nie erreichen,
 * auch nicht als Fallback. Die 19 betroffenen Regeln sind fast ausnahmslos
 * interne Prozess-Policy (keine Diff-Findings), daher ist der Detektions-Verlust
 * hier vernachlässigbar; eine neutrale Zeile verhindert zugleich, dass das
 * Modell auf einer leeren Regel halluziniert.
 */
const NEUTRAL_RULE_BODY = 'Enforced by automated checks; no further detail is provided here.';

/** Ab dieser Größe (Zeichen) sollte die Standards-Tabelle kuratiert werden. */
const LAW_BLOCK_SIZE_WARNING_CHARS = 50_000;

/**
 * Lädt alle Golden Standards, filtert sie per Dynamic Law Filtering
 * (BEST_PRACTICES_PLAN §9.4) und rendert den statischen Law-Block.
 * Gibt '' zurück, wenn die Tabelle leer ist (Prompt bleibt dann ohne Law-Sektion).
 *
 * Cache-Contract: Der Filter hängt NUR von den Repo-Ökosystemen ab (Ingest-
 * Zeit-Erkennung), nie vom Diff — der Block bleibt damit per Repo byte-stabil.
 *
 * @param detectedEcosystems - `repositories.detected_ecosystems`; null =
 *   Erkennung nie gelaufen → ungefilterter Block (Verhalten vor Phase 5).
 */
export async function fetchRenderedLawBlock(
    detectedEcosystems: readonly string[] | null = null,
): Promise<RenderedLaw> {
    const { data: standardRows, error: fetchError } = await supabase
        .from('golden_standards')
        .select('rule_id, category, public_explanation, applies_to')
        .order('rule_id', { ascending: true });

    if (fetchError) {
        throw new Error(`Golden Standards konnten nicht geladen werden: ${fetchError.message}`);
    }

    if (!standardRows || standardRows.length === 0) {
        console.warn('[Law] golden_standards ist leer — Prompt wird ohne Law-Block gebaut.');
        return { lawBlock: '', lawContentHash: hashLawBlock(''), ruleIds: [] };
    }

    const applicableRows = filterRulesByEcosystems(
        standardRows as GoldenStandardRow[],
        detectedEcosystems,
    );

    const lawBlock = renderLawBlock(applicableRows);
    return {
        lawBlock,
        lawContentHash: hashLawBlock(lawBlock),
        ruleIds: applicableRows.map((standardRow) => standardRow.rule_id),
    };
}

/** Exportiert für Tests: deterministischer sha256-Hex-Hash des Law-Blocks. */
export function hashLawBlock(renderedLawBlock: string): string {
    return createHash('sha256').update(renderedLawBlock, 'utf-8').digest('hex');
}

/**
 * Dynamic Law Filtering (§9.4): Regeln ohne Tags sind universell und bleiben
 * immer drin; getaggte Regeln nur bei Überschneidung mit den Repo-Ökosystemen.
 *
 * `detectedEcosystems = null` (Erkennung nie gelaufen) ⇒ KEIN Filter.
 * `detectedEcosystems = []` (Erkennung lief, nichts Bekanntes gefunden) ⇒
 * ebenfalls KEIN Filter — eine leere Erkennung trägt keine Information, auf
 * der man filtern könnte (z.B. leerer Default-Branch, während die PRs React
 * enthalten). Fail-open ist hier Pflicht: das frühere „[] ⇒ nur universelle
 * Regeln" hat den Law-Block auf 72 Regeln geschrumpft und nachweislich die
 * Draft-Recall kollabieren lassen (Clean-Scan-Anomalie 2026-08-10, ROADMAP
 * §3g — kontrolliertes A/B auf den echten PR-Diffs: gefiltert 0 Findings,
 * ungefiltert alle erwarteten). Exportiert für Tests.
 */
export function filterRulesByEcosystems(
    standardRows: readonly GoldenStandardRow[],
    detectedEcosystems: readonly string[] | null,
): GoldenStandardRow[] {
    if (detectedEcosystems === null || detectedEcosystems.length === 0) {
        return [...standardRows];
    }

    const repoLawTags = resolveLawTags(detectedEcosystems);
    return standardRows.filter((standardRow) => {
        const ruleEcosystemTags = standardRow.applies_to ?? [];
        return ruleEcosystemTags.length === 0
            || ruleEcosystemTags.some((ecosystemTag) => repoLawTags.has(ecosystemTag));
    });
}

/**
 * `applies_to`-Tags, die ein erkanntes Ökosystem zusätzlich zu seinem eigenen
 * Namen trifft (LANGUAGE_COVERAGE_SPEC §6.6). Die Java-Regeln der Tabelle
 * (HAL-004, HAL-006, HAL-007, SEC-006, SEC-008, SEC-015, SEC-030) tragen das
 * Tag `java-spring`, ihr Text gilt aber für jedes Java. `java-spring` selbst
 * bleibt der Key der Spring-Practices und entsteht nur mit Spring im Manifest.
 */
const IMPLIED_LAW_TAGS: ReadonlyMap<string, readonly string[]> = new Map([
    ['java', ['java-spring']],
]);

/** Die Tags, mit denen der Law-Filter ein Repo vergleicht. Exportiert für Tests. */
export function resolveLawTags(detectedEcosystems: readonly string[]): ReadonlySet<string> {
    return new Set(detectedEcosystems.flatMap(
        (detectedEcosystem) => [detectedEcosystem, ...(IMPLIED_LAW_TAGS.get(detectedEcosystem) ?? [])],
    ));
}

/**
 * Rendert die Standards in ein deterministisches Prompt-Format.
 * Reihenfolge und Template dürfen NICHT von Laufzeit-Werten abhängen,
 * sonst bricht die Byte-Identität des Cache-Prefixes.
 */
export function renderLawBlock(standardRows: readonly GoldenStandardRow[]): string {
    const renderedRules = standardRows
        .map((standardRow) => renderSingleRule(standardRow))
        .join('\n\n---\n\n');

    const lawBlock =
        '=== THE LAW (Golden Standards — ABSOLUTE RULES) ===\n' +
        'The following are curated architectural rules. They are ABSOLUTE and may NEVER be ' +
        'overridden by existing code patterns. If ANY added line violates one of these rules, ' +
        'flag it and cite the Rule ID.\n\n' +
        renderedRules;

    if (lawBlock.length > LAW_BLOCK_SIZE_WARNING_CHARS) {
        console.warn(
            `[Law] Law-Block ist ${lawBlock.length} Zeichen groß (> ${LAW_BLOCK_SIZE_WARNING_CHARS}). ` +
            'Golden Standards kuratieren, sonst wird der Cache-Prefix unnötig teuer.',
        );
    }

    return lawBlock;
}

/**
 * Rendert eine Regel für den System-Prompt (ROADMAP §12).
 *
 * Kopfzeile trägt NUR noch Rule-ID + Kategorie — kein `title` mehr, der
 * Forschungszitate/Statistiken (arXiv/CWE/Prozente) enthält und für die
 * Detektion nie gebraucht wurde. Der Regeltext ist AUSSCHLIESSLICH die
 * kundensichere `public_explanation`; fehlt sie, kommt die content-freie
 * NEUTRAL_RULE_BODY. `content` (das Detektions-Rezept) wird nie geladen und
 * kann den Prompt — und damit den Client — nicht erreichen. Das ist die
 * strukturelle Garantie: es gibt nichts zu umgehen, keine Prompt-Bitte.
 */
function renderSingleRule(standardRow: GoldenStandardRow): string {
    const ruleText = standardRow.public_explanation ?? NEUTRAL_RULE_BODY;
    return `### [${standardRow.rule_id}] (${standardRow.category})\n${ruleText}`;
}
