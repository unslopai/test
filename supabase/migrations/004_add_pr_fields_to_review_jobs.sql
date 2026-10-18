-- Review Jobs Tabelle erweitern
-- Fügt PR-spezifische Felder hinzu, damit der Worker weiß welcher PR reviewed wird.
-- Dieses SQL im Supabase Dashboard unter "SQL Editor" ausführen.

ALTER TABLE review_jobs
    ADD COLUMN repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL,
    ADD COLUMN pr_number INTEGER,
    ADD COLUMN pr_url TEXT,
    ADD COLUMN source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'webhook'));

-- Index für Repo-spezifische Job-Abfragen
CREATE INDEX idx_review_jobs_repository_id ON review_jobs(repository_id);
