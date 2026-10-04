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
import { mapLastScan, type LastScanView } from './[id]/scans/scan-view';


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
    /**
     * Gatekeeper-Status. 'pending_activation' = die GitHub App ist auf dem Repo
     * installiert, es ist aber noch nicht indexiert (kostet erst beim Aktivieren).
     */
    gatekeeper_status: 'unconnected' | 'pending_activation' | 'active' | 'syncing' | 'error';
    /** Interne Repository-ID in unserer DB (null wenn nicht verbunden) */
    gatekeeper_repo_id: string | null;
    /**
     * Ist die GitHub App auf diesem Repo installiert (= installation_id gesetzt)?
     *
     * Steuert im Dashboard, ob "Aktivieren" direkt den Connect-Request schickt
     * oder erst zur Installation der App auffordert: ohne Installation gibt es
     * kein Installation-Token, mit dem der Gatekeeper den PR lesen könnte.
     */
    app_installed: boolean;
    /**
     * PR-Reviews eingerichtet? true = Webhook registriert, false = CLI-only
     * verbunden, null = gar nicht verbunden. DB-abgeleitet (kein GitHub-Call);
     * die Live-Verifikation macht der webhook-health-Endpoint in den Settings.
     */
    pr_reviews_enabled: boolean | null;
    /**
     * Jüngster Scan des Repos (DASHBOARD_UX_SPEC.md §4.2) — rein DB-seitig
     * über ein lateral Embed mitgeladen. null = verbundenes Repo ohne Scans
     * ("nie gescannt") oder gar nicht verbunden.
     */
    last_scan: LastScanView | null;
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

        // Verbundene Repos aus unserer DB laden — inklusive des jüngsten Scans
        // pro Repo über ein lateral Embed (order/limit auf der referenzierten
        // Tabelle): EINE PostgREST-Query, kein N+1 (DASHBOARD_UX_SPEC.md §4.2).
        // Vom result-Blob werden nur die zwei benötigten JSON-Pfade selektiert.
        const { data: connectedRepos } = await supabaseAdmin
            .from('repositories')
            .select('id, github_repo_id, status, webhook_id, installation_id, '
                + 'review_jobs(created_at, status, nothing_reviewed:result->nothing_reviewed, review:result->review)')
            .eq('user_id', user.id)
            .order('created_at', { referencedTable: 'review_jobs', ascending: false })
            .limit(1, { referencedTable: 'review_jobs' });

        // Der Embed-Select-String übersteigt den Type-Parser von supabase-js
        // (JSON-Pfad-Aliase) — die Zeilenform ist deshalb explizit benannt;
        // das review_jobs-Embed bleibt unknown und geht durch mapLastScan.
        interface ConnectedRepoRow {
            readonly id: string;
            readonly github_repo_id: number;
            readonly status: string;
            readonly webhook_id: number | null;
            readonly installation_id: number | null;
            readonly review_jobs: unknown;
        }
        const connectedRepoRows = (connectedRepos ?? []) as unknown as ConnectedRepoRow[];

        const connectedMap = new Map(
            connectedRepoRows.map((repo) => [
                repo.github_repo_id,
                {
                    id: repo.id,
                    status: repo.status,
                    hasInstallation: repo.installation_id !== null,
                    // PR-Reviews laufen entweder über den Repo-Hook (OAuth) oder
                    // über die App-Installation — beides zählt als eingerichtet.
                    prReviewsEnabled: repo.webhook_id !== null || repo.installation_id !== null,
                    // ARCH-002: das Embed ist DB-JSON und wird strukturell geparst.
                    lastScan: mapLastScan(repo.review_jobs),
                },
            ]),
        );

        // Admin-Recht ist nur für den OAuth-Pfad nötig (dort legen WIR den Webhook
        // an). Repos, die über die GitHub App laufen, gehören auch ohne Admin-Recht
        // in die Liste — sonst sähe ein Org-Mitglied seine App-Repos nie und käme
        // nie an den Aktivieren-Button.
        //
        // Die Ausnahme gilt NUR bei gesetzter installation_id: ein Repo ohne
        // Installation bekäme sonst einen Connect-Button, der beim Anlegen des
        // Webhooks zwangsläufig an fehlenden Rechten scheitert.
        const listableRepos = githubRepos.filter(
            (repo) => repo.permissions?.admin === true
                || connectedMap.get(repo.id)?.hasInstallation === true,
        );

        // Repos mit Status zusammenführen
        const reposWithStatus: RepoWithStatus[] = listableRepos.map((repo) => {
            const connected = connectedMap.get(repo.id);
            // 'deactivated' = Soft-Delete → dem Frontend als 'unconnected' anzeigen
            const dbStatus = connected?.status ?? 'unconnected';
            const displayStatus = dbStatus === 'deactivated' ? 'unconnected' : dbStatus;
            const isConnected = displayStatus !== 'unconnected';
            return {
                ...repo,
                gatekeeper_status: displayStatus as RepoWithStatus['gatekeeper_status'],
                gatekeeper_repo_id: isConnected ? (connected?.id ?? null) : null,
                app_installed: connected?.hasInstallation ?? false,
                pr_reviews_enabled: isConnected ? (connected?.prReviewsEnabled ?? false) : null,
                last_scan: isConnected ? (connected?.lastScan ?? null) : null,
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
