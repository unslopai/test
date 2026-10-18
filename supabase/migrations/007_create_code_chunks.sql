-- Code Chunks Tabelle (Skeleton Ingestion — Strategy A)
-- Speichert die API-Oberfläche des User-Repos:
-- Funktions-Signaturen, Interfaces, Type-Aliases, Klassen-Definitionen, Export-Statements.
-- Die eigentliche Implementierungslogik wird NICHT gespeichert (Shit-in-Shit-out Vermeidung).
-- Dieses SQL im Supabase Dashboard unter "SQL Editor" ausführen.

CREATE TABLE code_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,                     -- Relativer Pfad im Repo (z.B. "src/lib/utils.ts")
    chunk_type TEXT NOT NULL CHECK (chunk_type IN (
        'function_signature',
        'interface',
        'type_alias',
        'class_definition',
        'export_statement'
    )),
    content TEXT NOT NULL,                       -- Der extrahierte Skeleton-Code
    embedding vector(768),                       -- text-embedding-005 Vektor
    metadata JSONB DEFAULT '{}',                 -- Zeilennummern, Export-Typ, etc.
    created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW Index für schnelle Cosine-Similarity-Suche
CREATE INDEX idx_code_chunks_embedding ON code_chunks
    USING hnsw (embedding vector_cosine_ops);

-- Composite Index: Repo + Dateipfad (für Ingestion-Updates)
CREATE INDEX idx_code_chunks_repo_file ON code_chunks(repository_id, file_path);

-- Index für Repo-spezifische Abfragen
CREATE INDEX idx_code_chunks_repository_id ON code_chunks(repository_id);
