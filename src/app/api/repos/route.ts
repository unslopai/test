/**
 * GET /api/repos
 *
 * Lädt alle GitHub-Repositories des authentifizierten Users und
 * gleicht sie mit der `repositories`-Tabelle ab, um den Gatekeeper-Status
 * (unconnected / active) zu ermitteln.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { fetchUserRepos } from '@/lib/github';
import { decryptToken } from '@/lib/crypto';
import { extractErrorMessage } from '@/lib/errors';


interface RepoWithStatus {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    private: boolean;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    updated_at: string;
    default_branch: string;
    /** Gatekeeper-Status: 'unconnected' wenn nicht verbunden, 'active' wenn Webhook aktiv */
    gatekeeper_status: 'unconnected' | 'active' | 'syncing' | 'error';
    /** Interne Repository-ID in unserer DB (null wenn nicht verbunden) */
    gatekeeper_repo_id: string | null;
}


export async function GET() {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Nicht authentifiziert' },
                { status: 401 },
            );
        }

        // Verschlüsselten GitHub Token aus der DB laden
        const { data: tokenRow, error: tokenError } = await supabaseAdmin
            .from('github_tokens')
            .select('encrypted_token, token_iv, token_tag')
            .eq('user_id', user.id)
            .single();

        if (tokenError || !tokenRow) {
            return NextResponse.json(
                { error: 'Kein GitHub Token gespeichert. Bitte erneut einloggen.' },
                { status: 401 },
            );
        }

        const githubToken = decryptToken({
            encryptedToken: tokenRow.encrypted_token,
            iv: tokenRow.token_iv,
            tag: tokenRow.token_tag,
        });

        // GitHub Repos laden
        const githubRepos = await fetchUserRepos(githubToken);

        // Verbundene Repos aus unserer DB laden
        const { data: connectedRepos } = await supabaseAdmin
            .from('repositories')
            .select('id, github_repo_id, status')
            .eq('user_id', user.id);

        const connectedMap = new Map(
            (connectedRepos ?? []).map((repo) => [
                repo.github_repo_id,
                { id: repo.id as string, status: repo.status as string },
            ]),
        );

        // Nur Repos anzeigen auf denen der User Admin-Rechte hat (= Webhook erstellen möglich)
        const adminRepos = githubRepos.filter(
            (repo) => repo.permissions?.admin === true,
        );

        // Repos mit Status zusammenführen
        const reposWithStatus: RepoWithStatus[] = adminRepos.map((repo) => {
            const connected = connectedMap.get(repo.id);
            // 'deactivated' = Soft-Delete → dem Frontend als 'unconnected' anzeigen
            const dbStatus = connected?.status ?? 'unconnected';
            const displayStatus = dbStatus === 'deactivated' ? 'unconnected' : dbStatus;
            return {
                ...repo,
                gatekeeper_status: displayStatus as RepoWithStatus['gatekeeper_status'],
                gatekeeper_repo_id: displayStatus === 'unconnected' ? null : (connected?.id ?? null),
            };
        });


        return NextResponse.json({ repos: reposWithStatus });

    } catch (err: unknown) {
        console.error('[GET /api/repos] Fehler:', err);
        return NextResponse.json(
            { error: extractErrorMessage(err) },
            { status: 500 },
        );
    }
}
