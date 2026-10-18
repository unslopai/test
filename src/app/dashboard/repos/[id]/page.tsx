/**
 * Repo-Detailseite (Server Component) — Kunden-Surface (DASHBOARD_UX_SPEC.md §3).
 *
 * Master-Detail über Routen: `[id]` ist die gatekeeper repo uuid, deep-linkbar.
 * Ownership wird serverseitig geprüft (Repo gehört dem eingeloggten User),
 * sonst 404 — gleiche Semantik wie überall (kein Existenz-Leak). Die
 * operator-only `…/settings`-Unterroute lebt unverändert daneben.
 */
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { scheduleLazyReap } from '@/lib/lazy-reaper';
import { getAppInstallUrl } from '@/lib/github-app';
import RepoDetailClient from './RepoDetailClient';

interface PageParams {
    params: Promise<{ id: string }>;
}

export default async function RepoDetailPage({ params }: PageParams) {
    const { id: repoId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        redirect('/login');
    }
    // Lazy Reaping (DEADLINE_GUARD_SPEC D10): after() blockiert das Rendern
    // nicht; ein abgeräumter Job erscheint beim nächsten Scan-Poll der Seite.
    scheduleLazyReap('dashboard');

    // Explizite Spalten [DATA-001]; eine ungültige uuid endet im PostgREST-
    // Fehler und damit ebenfalls in der 404 — kein eigener Validierungspfad.
    const { data: repoRow, error: repoError } = await supabaseAdmin
        .from('repositories')
        .select('id, full_name, status, github_repo_id, webhook_id, installation_id, review_fork_prs')
        .eq('id', repoId)
        .eq('user_id', user.id)
        .single();

    if (repoError || !repoRow) {
        notFound();
    }

    return (
        <RepoDetailClient
            repoId={repoRow.id as string}
            fullName={repoRow.full_name as string}
            status={repoRow.status as string}
            githubRepoId={repoRow.github_repo_id as number}
            prReviewsEnabled={repoRow.webhook_id !== null || repoRow.installation_id !== null}
            // Legacy = ohne App-Installation verbunden: nur diese Repos haben
            // einen Repo-Webhook zum Prüfen/Reparieren (D8).
            isLegacyRepo={repoRow.status === 'active' && repoRow.installation_id === null}
            reviewForkPrs={repoRow.review_fork_prs === true}
            appInstallUrl={getAppInstallUrl()}
        />
    );
}
