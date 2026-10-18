-- GitHub Tokens Tabelle
-- Speichert GitHub Provider Access Tokens verschlüsselt,
-- damit der Worker asynchron im Namen des Users mit der GitHub API sprechen kann.
-- Dieses SQL im Supabase Dashboard unter "SQL Editor" ausführen.

CREATE TABLE github_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    encrypted_token TEXT NOT NULL,     -- AES-256-GCM verschlüsselter GitHub Access Token
    token_iv TEXT NOT NULL,            -- Initialization Vector für die Verschlüsselung
    token_tag TEXT NOT NULL,           -- Auth Tag für AES-GCM
    scopes TEXT,                       -- Gewährte Scopes (z.B. "repo,admin:repo_hook")
    github_username TEXT,              -- GitHub Username für Anzeige
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Schnelles Lookup via User ID
CREATE INDEX idx_github_tokens_user_id ON github_tokens(user_id);
