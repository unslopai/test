-- Golden Standards Tabelle
-- Kuratierte Best Practices und Anti-Patterns als "The Law" für den Reviewer.
-- text-embedding-005 produziert standardmäßig 768-dimensionale Vektoren.
-- Dieses SQL im Supabase Dashboard unter "SQL Editor" ausführen.

CREATE TABLE golden_standards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('anti_pattern', 'best_practice', 'security', 'performance')),
    rule_id TEXT NOT NULL UNIQUE,               -- z.B. "condition_1_silent_error_swallowing"
    title TEXT NOT NULL,                         -- Kurzbeschreibung
    content TEXT NOT NULL,                       -- Vollständiger Text / Erklärung
    code_example_bad TEXT,                       -- Slop-Beispiel (optional)
    code_example_good TEXT,                      -- Clean-Code-Beispiel (optional)
    embedding vector(768),                       -- text-embedding-005 Vektor
    metadata JSONB DEFAULT '{}',                 -- Tags, Severity, Framework-Version, etc.
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW Index für schnelle Cosine-Similarity-Suche
CREATE INDEX idx_golden_standards_embedding ON golden_standards
    USING hnsw (embedding vector_cosine_ops);

-- Index für Kategorie-Filter
CREATE INDEX idx_golden_standards_category ON golden_standards(category);
