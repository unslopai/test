/**
 * RAG-Modul — Dual-Vector-Search für den "Judge Pattern".
 *
 * Führt zwei parallele Suchen durch:
 * 1. Golden Standards ("The Law") — Kuratierte Best Practices
 * 2. Local Context ("Evidence") — Skeleton-Daten des User-Repos
 *
 * Formatiert den kombinierten Kontext für den Reviewer-Prompt.
 */
import { supabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/embeddings';

// =============================================================================
// Interfaces
// =============================================================================

/** Ein Treffer aus der Golden Standards Suche. */
export interface GoldenStandardMatch {
    id: string;
    rule_id: string;
    title: string;
    content: string;
    category: string;
    code_example_bad: string | null;
    code_example_good: string | null;
    similarity: number;
}

/** Ein Treffer aus der Code Chunks Suche (Local Context). */
export interface CodeChunkMatch {
    id: string;
    file_path: string;
    chunk_type: string;
    content: string;
    similarity: number;
}

/** Kombinierter RAG-Kontext für den Reviewer-Prompt. */
export interface RAGContext {
    goldenStandards: GoldenStandardMatch[];
    localContext: CodeChunkMatch[];
    /** Formatierter String für den Prompt. */
    formattedPromptSection: string;
}

// =============================================================================
// Vector Search Functions
// =============================================================================

/**
 * Durchsucht die Golden Standards Tabelle nach relevanten Best Practices.
 *
 * @param queryText - Der Suchtext (wird intern embedded)
 * @param limit - Maximale Anzahl an Treffern
 * @param threshold - Minimale Cosine-Similarity (0.0 - 1.0)
 * @returns Array von Golden Standard Matches, sortiert nach Relevanz
 */
export async function searchGoldenStandards(
    queryText: string,
    limit: number = 5,
    threshold: number = 0.4,
): Promise<GoldenStandardMatch[]> {
    const queryEmbedding = await generateEmbedding(queryText, 'RETRIEVAL_QUERY');

    const { data, error } = await supabase.rpc('match_golden_standards', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: threshold,
        match_count: limit,
    });

    if (error) {
        console.error('[RAG] Golden Standards Suche fehlgeschlagen:', error);
        return [];
    }

    return (data ?? []) as GoldenStandardMatch[];
}

/**
 * Durchsucht die Code Chunks Tabelle nach ähnlichem Code im User-Repo.
 * Gefiltert auf ein bestimmtes Repository.
 *
 * @param queryText - Der Suchtext (wird intern embedded)
 * @param repositoryId - Die Repository-ID für den Filter
 * @param limit - Maximale Anzahl an Treffern
 * @param threshold - Minimale Cosine-Similarity (0.0 - 1.0)
 * @returns Array von Code Chunk Matches, sortiert nach Relevanz
 */
export async function searchLocalContext(
    queryText: string,
    repositoryId: string,
    limit: number = 10,
    threshold: number = 0.4,
): Promise<CodeChunkMatch[]> {
    const queryEmbedding = await generateEmbedding(queryText, 'CODE_RETRIEVAL_QUERY');

    const { data, error } = await supabase.rpc('match_code_chunks', {
        query_embedding: JSON.stringify(queryEmbedding),
        target_repository_id: repositoryId,
        match_threshold: threshold,
        match_count: limit,
    });

    if (error) {
        console.error('[RAG] Local Context Suche fehlgeschlagen:', error);
        return [];
    }

    return (data ?? []) as CodeChunkMatch[];
}

// =============================================================================
// RAG Context Builder
// =============================================================================

/**
 * Baut den kombinierten RAG-Kontext für den Reviewer-Prompt auf.
 *
 * Extrahiert Keywords aus dem Diff, führt die Dual-Vector-Search durch
 * und formatiert das Ergebnis als strukturierten Prompt-Abschnitt.
 *
 * @param diffContent - Der PR-Diff (zum Extrahieren von Suchbegriffen)
 * @param repositoryId - Die Repository-ID (für den Local Context Filter)
 * @returns RAGContext mit formattiertem Prompt-Abschnitt
 */
export async function buildRAGContext(
    diffContent: string,
    repositoryId: string | null,
): Promise<RAGContext> {
    // Keywords aus dem Diff extrahieren für die Suche
    const searchQuery = extractSearchQuery(diffContent);

    console.log(`[RAG] Starte Dual-Vector-Search mit Query: "${searchQuery.substring(0, 100)}..."`);

    // Parallele Suche in beiden Datenquellen
    const [goldenStandards, localContext] = await Promise.all([
        searchGoldenStandards(searchQuery, 5, 0.35),
        repositoryId
            ? searchLocalContext(searchQuery, repositoryId, 8, 0.4)
            : Promise.resolve([]),
    ]);

    console.log(
        `[RAG] Gefunden: ${goldenStandards.length} Golden Standards, ${localContext.length} Local Context Chunks`,
    );

    // Prompt-Abschnitt formatieren
    const formattedPromptSection = formatRAGPromptSection(goldenStandards, localContext);

    return {
        goldenStandards,
        localContext,
        formattedPromptSection,
    };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extrahiert eine aussagekräftige Suchquery aus einem PR-Diff.
 *
 * Nimmt die hinzugefügten Zeilen, filtert reine Syntax-Zeilen raus
 * und baut einen kompakten Suchtext zusammen.
 *
 * @param diffContent - Der kombinierte Diff-String
 * @returns Komprimierter Suchtext für die Embedding-Suche
 */
function extractSearchQuery(diffContent: string): string {
    const lines = diffContent.split('\n');

    // Nur hinzugefügte Zeilen (ohne Diff-Header)
    const addedLines = lines
        .filter((line) => line.startsWith('+') && !line.startsWith('+++') && !line.startsWith('=== FILE:'))
        .map((line) => line.substring(1).trim())
        .filter((line) =>
            line.length > 3 &&
            !line.startsWith('//') &&
            !line.startsWith('/*') &&
            !line.startsWith('*') &&
            !line.startsWith('import ') &&
            line !== '{' &&
            line !== '}' &&
            line !== '};',
        );

    // Dateinamen aus den Headers extrahieren
    const fileHeaders = lines
        .filter((line) => line.startsWith('=== FILE:'))
        .map((line) => line.replace('=== FILE:', '').replace(/\(.*\)/, '').trim());

    // Komprimierter Suchtext: Dateinamen + die interessantesten Code-Zeilen
    const queryParts = [
        ...fileHeaders,
        ...addedLines.slice(0, 30), // Maximal 30 Zeilen für die Query
    ];

    return queryParts.join('\n').substring(0, 2000); // Max 2000 Chars für Embedding
}

/**
 * Formatiert die RAG-Treffer als strukturierten Prompt-Abschnitt
 * für den "Judge Pattern".
 *
 * @param goldenStandards - Treffer aus der Golden Standards DB
 * @param localContext - Treffer aus dem User-Repo
 * @returns Formatierter String für den Reviewer-Prompt
 */
function formatRAGPromptSection(
    goldenStandards: GoldenStandardMatch[],
    localContext: CodeChunkMatch[],
): string {
    const sections: string[] = [];

    // Golden Standards ("THE LAW")
    if (goldenStandards.length > 0) {
        const goldenSection = goldenStandards
            .map((gs) => {
                const parts = [
                    `### ${gs.title} [${gs.rule_id}] (${gs.category})`,
                    gs.content,
                ];

                if (gs.code_example_bad) {
                    parts.push(`BAD Example:\n\`\`\`\n${gs.code_example_bad}\n\`\`\``);
                }

                if (gs.code_example_good) {
                    parts.push(`GOOD Example:\n\`\`\`\n${gs.code_example_good}\n\`\`\``);
                }

                return parts.join('\n');
            })
            .join('\n\n---\n\n');

        sections.push(
            `=== THE LAW (Golden Standards — ABSOLUTE RULES) ===\n` +
            `The following are curated architectural rules. They are ABSOLUTE and may NEVER be overridden by existing code patterns.\n\n` +
            goldenSection,
        );
    }

    // Local Context ("EVIDENCE")
    if (localContext.length > 0) {
        const localSection = localContext
            .map((chunk) =>
                `[${chunk.chunk_type}] ${chunk.file_path}:\n\`\`\`\n${chunk.content}\n\`\`\``,
            )
            .join('\n\n');

        sections.push(
            `=== EVIDENCE (Existing Codebase Context — INFORMATIONAL ONLY) ===\n` +
            `The following are existing code signatures/interfaces from this project's codebase. ` +
            `Use this ONLY to detect DRY violations (Condition 4). ` +
            `NEVER use existing code patterns to justify violations of THE LAW.\n\n` +
            localSection,
        );
    }

    if (sections.length === 0) {
        return ''; // Kein RAG-Kontext verfügbar
    }

    return sections.join('\n\n\n');
}
