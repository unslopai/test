/**
 * RAG-Modul — Evidence-Retrieval für den "Judge Pattern".
 *
 * Sucht per Vector-Search Skeleton-Daten des User-Repos ("Evidence"),
 * die zum Diff passen (DRY-Erkennung, Namenskonventionen).
 *
 * HINWEIS: Die Golden Standards ("The Law") werden NICHT mehr hier retrieved.
 * Sie stehen als statischer Block im System-Prompt (@/lib/law), damit der
 * Cache-Prefix byte-identisch bleibt und der Reviewer 100% Rule-Recall hat.
 * Evidence ist per-Diff variabel und gehört deshalb in den dynamischen Teil.
 */
import { supabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/embeddings';

// =============================================================================
// Interfaces
// =============================================================================

/** Ein Treffer aus der Code Chunks Suche (Local Context). */
export interface CodeChunkMatch {
    id: string;
    file_path: string;
    chunk_type: string;
    content: string;
    similarity: number;
}

/** Evidence-Kontext für den Reviewer-Prompt. */
export interface RAGContext {
    localContext: CodeChunkMatch[];
    /** Formatierter String für den dynamischen Teil des User-Prompts. */
    formattedPromptSection: string;
}

// =============================================================================
// Vector Search
// =============================================================================

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
 * Baut den Evidence-Kontext für den Reviewer-Prompt auf.
 *
 * Extrahiert Keywords aus dem Diff, sucht passende Code-Chunks des Repos
 * und formatiert das Ergebnis als strukturierten Prompt-Abschnitt.
 *
 * @param diffContent - Der PR-Diff (zum Extrahieren von Suchbegriffen)
 * @param repositoryId - Die Repository-ID (für den Local Context Filter)
 * @returns RAGContext mit formatiertem Prompt-Abschnitt ('' ohne Treffer)
 */
export async function buildRAGContext(
    diffContent: string,
    repositoryId: string | null,
): Promise<RAGContext> {
    if (!repositoryId) {
        return { localContext: [], formattedPromptSection: '' };
    }

    const searchQuery = extractSearchQuery(diffContent);
    console.log(`[RAG] Starte Evidence-Search mit Query: "${searchQuery.substring(0, 100)}..."`);

    const localContext = await searchLocalContext(searchQuery, repositoryId, 8, 0.4);
    console.log(`[RAG] Gefunden: ${localContext.length} Local Context Chunks`);

    return {
        localContext,
        formattedPromptSection: formatEvidenceSection(localContext),
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
 * Formatiert die Evidence-Treffer als strukturierten Prompt-Abschnitt.
 *
 * @param localContext - Treffer aus dem User-Repo
 * @returns Formatierter String für den Reviewer-Prompt ('' ohne Treffer)
 */
function formatEvidenceSection(localContext: CodeChunkMatch[]): string {
    if (localContext.length === 0) {
        return '';
    }

    const localSection = localContext
        .map((chunk) =>
            `[${chunk.chunk_type}] ${chunk.file_path}:\n\`\`\`\n${chunk.content}\n\`\`\``,
        )
        .join('\n\n');

    return (
        `=== EVIDENCE (Existing Codebase Context — INFORMATIONAL ONLY) ===\n` +
        `The following are existing code signatures/interfaces from this project's codebase. ` +
        `Use this ONLY to detect DRY violations (Condition 4). ` +
        `NEVER use existing code patterns to justify violations of THE LAW.\n\n` +
        localSection
    );
}
