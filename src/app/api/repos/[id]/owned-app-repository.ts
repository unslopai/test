/**
 * Session-Auth und Besitzprüfung der Dashboard-Routen „Open pull requests“
 * (`…/pulls`, `…/review`, GITHUB_APP_SPEC.md §4.10).
 *
 * Muster der Nachbarn (fork-prs, scans): eingeloggter User, Service-Role-Read
 * mit `.eq('id').eq('user_id')` [DATA-001]; fremdes und nicht existentes Repo
 * bekommen dieselbe 404. App-only: ein Repo ohne `installation_id`
 * (Legacy-OAuth) bekommt 409 `github_app_required`, nie einen Fallback auf das
 * User-Token — Check Runs gibt es nur mit Installation-Token.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';

export interface OwnedAppRepository {
    readonly id: string;
    readonly ownerUserId: string;
    readonly fullName: string;
    readonly status: string;
    readonly installationId: number;
    readonly reviewForkPrs: boolean;
}

export type OwnedAppRepositoryAccess =
    | { readonly kind: 'granted'; readonly repository: OwnedAppRepository }
    | { readonly kind: 'denied'; readonly response: NextResponse };

function denied(errorCode: string, status: number): OwnedAppRepositoryAccess {
    return { kind: 'denied', response: NextResponse.json({ error: errorCode }, { status }) };
}

/** Strukturelle Sicht auf die Repo-Zeile [ARCH-002]; null = unbrauchbar wie nicht gefunden. */
function parseRepositoryRow(repoRow: unknown): Omit<OwnedAppRepository, 'installationId'> & {
    readonly installationId: number | null;
} | null {
    if (typeof repoRow !== 'object' || repoRow === null) return null;
    const id: unknown = Reflect.get(repoRow, 'id');
    const ownerUserId: unknown = Reflect.get(repoRow, 'user_id');
    const fullName: unknown = Reflect.get(repoRow, 'full_name');
    const status: unknown = Reflect.get(repoRow, 'status');
    const installationId: unknown = Reflect.get(repoRow, 'installation_id');
    if (typeof id !== 'string' || typeof ownerUserId !== 'string'
        || typeof fullName !== 'string' || typeof status !== 'string') {
        return null;
    }
    return {
        id,
        ownerUserId,
        fullName,
        status,
        installationId: typeof installationId === 'number' ? installationId : null,
        reviewForkPrs: Reflect.get(repoRow, 'review_fork_prs') === true,
    };
}

/** Reihenfolge: 401 unauthorized → 404 repository_not_found → 409 github_app_required. */
export async function resolveOwnedAppRepository(repositoryId: string): Promise<OwnedAppRepositoryAccess> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return denied('unauthorized', 401);
    }

    // Eine ungültige uuid endet im PostgREST-Fehler und damit in derselben 404.
    const { data: repoRow, error: repoError } = await supabaseAdmin
        .from('repositories')
        .select('id, user_id, full_name, status, installation_id, review_fork_prs')
        .eq('id', repositoryId)
        .eq('user_id', user.id)
        .single();

    const parsedRepository = repoError ? null : parseRepositoryRow(repoRow);
    if (!parsedRepository) {
        return denied('repository_not_found', 404);
    }
    if (parsedRepository.installationId === null) {
        return denied('github_app_required', 409);
    }

    return { kind: 'granted', repository: { ...parsedRepository, installationId: parsedRepository.installationId } };
}
