-- Repositories Tabelle
-- Trackt welche Repos mit dem Gatekeeper verbunden sind.
-- Dieses SQL im Supabase Dashboard unter "SQL Editor" ausführen.

CREATE TABLE repositories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    github_repo_id BIGINT NOT NULL,
    full_name TEXT NOT NULL,           -- z.B. "username/repo-name"
    default_branch TEXT DEFAULT 'main',
    webhook_id BIGINT,                 -- GitHub Webhook ID (zum späteren Löschen)
    webhook_secret TEXT NOT NULL,       -- HMAC-Secret für Signatur-Verifikation
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'syncing', 'error')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Ein User kann ein Repo nur einmal verbinden
    UNIQUE (user_id, github_repo_id)
);

-- Index für schnelles Lookup via GitHub Repo ID (Webhook-Verarbeitung)
CREATE INDEX idx_repositories_github_repo_id ON repositories(github_repo_id);

-- Index für User-spezifische Abfragen (Dashboard)
CREATE INDEX idx_repositories_user_id ON repositories(user_id);
