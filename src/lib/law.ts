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
import { supabase } from '@/lib/supabase';

interface GoldenStandardRow {
    readonly rule_id: string;
    readonly category: string;
    readonly title: string;
    readonly content: string;
    readonly code_example_bad: string | null;
    readonly code_example_good: string | null;
}

/** Ab dieser Größe (Zeichen) sollte die Standards-Tabelle kuratiert werden. */
const LAW_BLOCK_SIZE_WARNING_CHARS = 50_000;

/**
 * Lädt alle Golden Standards und rendert den statischen Law-Block.
 * Gibt '' zurück, wenn die Tabelle leer ist (Prompt bleibt dann ohne Law-Sektion).
 */
export async function fetchRenderedLawBlock(): Promise<string> {
    const { data: standardRows, error: fetchError } = await supabase
        .from('golden_standards')
        .select('rule_id, category, title, content, code_example_bad, code_example_good')
        .order('rule_id', { ascending: true });

    if (fetchError) {
        throw new Error(`Golden Standards konnten nicht geladen werden: ${fetchError.message}`);
    }

    if (!standardRows || standardRows.length === 0) {
        console.warn('[Law] golden_standards ist leer — Prompt wird ohne Law-Block gebaut.');
        return '';
    }

    return renderLawBlock(standardRows as GoldenStandardRow[]);
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

function renderSingleRule(standardRow: GoldenStandardRow): string {
    const ruleParts = [
        `### ${standardRow.title} [${standardRow.rule_id}] (${standardRow.category})`,
        standardRow.content,
    ];

    if (standardRow.code_example_bad) {
        ruleParts.push(`BAD Example:\n\`\`\`\n${standardRow.code_example_bad}\n\`\`\``);
    }

    if (standardRow.code_example_good) {
        ruleParts.push(`GOOD Example:\n\`\`\`\n${standardRow.code_example_good}\n\`\`\``);
    }

    return ruleParts.join('\n');
}
