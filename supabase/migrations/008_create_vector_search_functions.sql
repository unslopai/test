-- Vector Search RPC-Funktionen
-- PostgREST (Supabase API-Layer) unterstützt pgvector-Operatoren nicht nativ,
-- deshalb brauchen wir SQL-Funktionen die via supabase.rpc() aufgerufen werden.
-- Dieses SQL im Supabase Dashboard unter "SQL Editor" ausführen.


-- =============================================================================
-- Golden Standards Suche
-- Findet die architektonisch relevantesten Best Practices / Anti-Patterns
-- für einen gegebenen Code-Kontext.
-- =============================================================================

CREATE OR REPLACE FUNCTION match_golden_standards(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    rule_id text,
    title text,
    content text,
    category text,
    code_example_bad text,
    code_example_good text,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        gs.id,
        gs.rule_id,
        gs.title,
        gs.content,
        gs.category,
        gs.code_example_bad,
        gs.code_example_good,
        1 - (gs.embedding <=> query_embedding) AS similarity
    FROM golden_standards gs
    WHERE gs.embedding IS NOT NULL
      AND 1 - (gs.embedding <=> query_embedding) > match_threshold
    ORDER BY gs.embedding <=> query_embedding
    LIMIT match_count;
$$;


-- =============================================================================
-- Code Chunks Suche (Local Context — User-Repo)
-- Findet semantisch ähnliche Skeleton-Einträge im Repo des Users.
-- Gefiltert auf ein bestimmtes Repository via repository_id.
-- =============================================================================

CREATE OR REPLACE FUNCTION match_code_chunks(
    query_embedding vector(768),
    target_repository_id uuid,
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    file_path text,
    chunk_type text,
    content text,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        cc.id,
        cc.file_path,
        cc.chunk_type,
        cc.content,
        1 - (cc.embedding <=> query_embedding) AS similarity
    FROM code_chunks cc
    WHERE cc.repository_id = target_repository_id
      AND cc.embedding IS NOT NULL
      AND 1 - (cc.embedding <=> query_embedding) > match_threshold
    ORDER BY cc.embedding <=> query_embedding
    LIMIT match_count;
$$;
