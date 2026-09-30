/**
 * Lifecycle der GitHub-App-Installation (GITHUB_APP_SPEC.md §4.5 / §4.6).
 *
 * Verarbeitet `installation`- und `installation_repositories`-Events, hält den
 * Repo-Bestand einer Installation synchron und räumt beim Adoptieren eines
 * bereits OAuth-verbundenen Repos den alten Repo-Webhook ab.
 *
 * Zwei Invarianten, die hier verteidigt werden:
 *  - Eine Installation legt Repos an, aber ingestiert NICHTS. Neue Repos landen
 *    als 'pending_activation'; die Embedding-Kosten fallen erst bei der
 *    expliziten, entitlement-geprüften Aktivierung an (D5).
 *  - Deinstallation löscht keine code_chunks. Sie sind ein teuer bezahlter
 *    Embedding-Cache, den eine Re-Installation wiederverwendet (D8). Sie
 *    werden aber deaktiviert, und nach 30 Tagen löscht der Cron das Repo samt
 *    Chunks (LEGAL_PAGES_SPEC §4a.2).
 */
import { supabase } from '@/lib/supabase';
import { GitHubApiError, deleteWebhook, fetchInstallationRepositories } from '@/lib/github';
import {
    fetchInstallationAccount,
    getInstallationToken,
    invalidateInstallationToken,
} from '@/lib/github-app';
import { isReauthenticationNeeded, proveInstallationOwnership } from '@/lib/installation-ownership';
import { resolveGithubToken } from '@/lib/repo-auth';
import { extractErrorMessage } from '@/lib/errors';
import { deactivateRepositoryChunks } from '@/lib/chunk-retention';
import type { OwnershipVerdict } from '@/lib/installation-ownership';
import type { InstallationAccount } from '@/lib/github-app';
import type {
    InstallationEventPayload,
    InstallationReposEventPayload,
} from '@/lib/github-webhook-payload';

/**
 * PostgREST reicht `.in()` als Query-String durch — eine Org mit tausenden Repos
 * sprengte sonst die URL-Längengrenze und der ganze Sync liefe auf einen 500.
 */
const REPO_LOOKUP_BATCH_SIZE = 200;

type InstallationStatus = 'active' | 'suspended' | 'deleted';

/** Der für die Auth-Entscheidung relevante Ausschnitt einer Installation. */
export interface InstallationRecord {
    readonly installationId: number;
    readonly userId: string | null;
    readonly status: InstallationStatus;
}

// =============================================================================
// Lesen
// =============================================================================

export async function findInstallation(installationId: number): Promise<InstallationRecord | null> {
    const { data: installationRow, error: lookupError } = await supabase
        .from('github_app_installations')
        .select('installation_id, user_id, status')
        .eq('installation_id', installationId)
        .maybeSingle();

    if (lookupError) {
        console.error(`[AppInstall] Lookup für Installation ${installationId} fehlgeschlagen:`, lookupError);
        throw new Error(`Installation ${installationId} konnte nicht geladen werden: ${lookupError.message}`);
    }

    if (!installationRow) {
        return null;
    }

    return {
        installationId: installationRow.installation_id,
        userId: installationRow.user_id,
        status: installationRow.status,
    };
}

// =============================================================================
// Events
// =============================================================================

/**
 * `installation`-Event. Die Zuordnung zu einem User passiert NICHT hier: das
 * Event kann vor dem Setup-Callback eintreffen, dann bleibt user_id NULL (D6).
 */
export async function handleInstallationEvent(payload: InstallationEventPayload): Promise<void> {
    switch (payload.action) {
        // Kein Repo-Sync hier: GitHub vergibt bei JEDER (Neu-)Installation eine
        // frische installation_id, die Zeile ist also immer unverknüpft
        // (user_id NULL) und hätte gar kein Ziel für den Insert. Die Repos holt
        // der Setup-Callback, sobald der User die Installation beansprucht (D6).
        // Ein Sync an dieser Stelle könnte nur im Rennen mit genau diesem
        // Callback feuern — und würde ihn verdoppeln.
        case 'created':
            await upsertInstallationRow(payload, 'active');
            console.log(`[AppInstall] Installation ${payload.installationId} (${payload.accountLogin}) angelegt.`);
            return;

        case 'deleted':
            invalidateInstallationToken(payload.installationId);
            // Repos ZUERST lösen: bricht der zweite Schritt ab, bleibt die
            // Installation 'active' und der Zustand ist aus GitHub
            // rekonstruierbar. Umgekehrt hätten wir eine 'deleted' Installation
            // mit Repos, die noch auf sie zeigen — ein toter Endzustand.
            await detachRepositories(payload.installationId, null);
            await setInstallationStatus(payload.installationId, 'deleted');
            console.log(`[AppInstall] Installation ${payload.installationId} entfernt, Repos deaktiviert.`);
            return;

        // Suspend lässt die Repos unangetastet (inkl. installation_id), damit
        // unsuspend sie ohne Rekonstruktion zurückholt (D8).
        case 'suspend':
            invalidateInstallationToken(payload.installationId);
            await setInstallationStatus(payload.installationId, 'suspended');
            return;

        case 'unsuspend':
            await setInstallationStatus(payload.installationId, 'active');
            return;

        default:
            console.log(`[AppInstall] Installation-Action '${payload.action}' wird ignoriert.`);
    }
}

/**
 * Synchronisiert den Repo-Bestand, sofern die Installation bereits einem User
 * gehört. Unverknüpfte Installationen werden übersprungen: für den Insert gäbe
 * es kein user_id, und der Setup-Callback holt den Bestand ohnehin komplett nach.
 */
async function resyncIfLinked(installationId: number): Promise<void> {
    const installation = await findInstallation(installationId);

    if (!installation || installation.userId === null) {
        console.log(`[AppInstall] Repo-Sync für unverknüpfte Installation ${installationId} vertagt.`);
        return;
    }

    await syncInstallationRepositories(installationId, installation.userId);
}

/** `installation_repositories`-Event: Repo-Bestand der Installation pflegen. */
export async function handleInstallationReposEvent(
    payload: InstallationReposEventPayload,
): Promise<void> {
    if (payload.action === 'removed') {
        await detachRepositories(payload.installationId, payload.removedRepoIds);
        console.log(`[AppInstall] ${payload.removedRepoIds.length} Repo(s) aus Installation entfernt.`);
        return;
    }

    if (payload.action === 'added') {
        await resyncIfLinked(payload.installationId);
    }
}

// =============================================================================
// Verknüpfung + Repo-Sync
// =============================================================================

export type ClaimResult =
    | { readonly ok: true; readonly accountLogin: string }
    | { readonly ok: false; readonly reason: 'not_owner' | 'already_linked' | 'reauth_required' };

/**
 * Beansprucht eine Installation für den eingeloggten User — der einzige Weg,
 * auf dem eine installation_id einen user_id bekommt.
 *
 * SICHERHEITSKERN: Die installation_id kommt aus einem Query-Parameter und ist
 * frei wählbar. Ohne Ownership-Beweis könnte ein beliebiger eingeloggter User
 * fremde Installations-IDs durchprobieren, sie an sich binden und über den
 * anschließenden Repo-Sync die privaten Repos des Opfers unter seiner eigenen
 * user_id indexieren lassen. Deshalb muss der User BEWEISEN, dass er den
 * GitHub-Account kontrolliert, auf dem die Installation sitzt:
 *
 *  - User-Account: die numerische Account-ID muss seiner eigenen entsprechen
 *    (die ID, nicht der Login — Logins sind umbenennbar und nachbesetzbar).
 *  - Organisation: er muss ORG-ADMIN (Owner) sein. Admin-Recht auf einem
 *    einzelnen Repo genügt ausdrücklich NICHT: das hat auch ein externer
 *    Collaborator, und er könnte damit eine Installation über 200 Repos an sich
 *    binden, von denen er 199 nicht lesen darf.
 *
 * Eine bereits von jemand anderem beanspruchte Installation wird nie umgehängt.
 * Der Installations-Status bleibt erhalten: eine suspendierte Installation darf
 * ein Setup-Aufruf nicht heimlich wieder auf 'active' heben.
 */
export async function claimInstallation(
    userId: string,
    installationId: number,
): Promise<ClaimResult> {
    const existingInstallation = await findInstallation(installationId);

    if (existingInstallation?.userId && existingInstallation.userId !== userId) {
        console.error(
            `[AppInstall] User ${userId} versuchte Installation ${installationId} zu übernehmen, `
            + 'die bereits einem anderen Account gehört.',
        );
        return { ok: false, reason: 'already_linked' };
    }

    const installationAccount = await fetchInstallationAccount(installationId);

    // Ein fehlendes oder widerrufenes User-Token macht den Beweis unmöglich —
    // das ist kein Serverfehler, sondern führt zum erneuten Login.
    let userToken: string;
    try {
        userToken = await resolveGithubToken(userId);
    } catch (tokenError: unknown) {
        if (isReauthenticationNeeded(tokenError)) {
            return { ok: false, reason: 'reauth_required' };
        }
        throw tokenError;
    }

    const ownershipVerdict = await proveOwnership(userToken, installationAccount);

    if (ownershipVerdict !== 'owner') {
        console.error(
            `[AppInstall] Ownership-Beweis für Installation ${installationId} `
            + `(${installationAccount.accountLogin}) durch User ${userId}: ${ownershipVerdict}.`,
        );
        return { ok: false, reason: ownershipVerdict };
    }

    await linkInstallationToUser(
        installationId,
        userId,
        installationAccount,
        existingInstallation?.status ?? 'active',
    );

    return { ok: true, accountLogin: installationAccount.accountLogin };
}

/** Kapselt den Beweis inkl. des Falls "Token von GitHub widerrufen" (401). */
async function proveOwnership(
    userToken: string,
    installationAccount: InstallationAccount,
): Promise<OwnershipVerdict> {
    try {
        return await proveInstallationOwnership(userToken, installationAccount);
    } catch (ownershipError: unknown) {
        if (isReauthenticationNeeded(ownershipError)) {
            return 'reauth_required';
        }
        throw ownershipError;
    }
}

async function linkInstallationToUser(
    installationId: number,
    userId: string,
    installationAccount: InstallationAccount,
    installationStatus: InstallationStatus,
): Promise<void> {
    const { error: linkError } = await supabase
        .from('github_app_installations')
        .upsert(
            {
                installation_id: installationId,
                user_id: userId,
                account_login: installationAccount.accountLogin,
                account_type: installationAccount.accountType,
                status: installationStatus,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'installation_id' },
        );

    if (linkError) {
        console.error(`[AppInstall] Verknüpfung von Installation ${installationId} fehlgeschlagen:`, linkError);
        throw new Error(`Installation konnte nicht verknüpft werden: ${linkError.message}`);
    }
}

/**
 * Gleicht den Repo-Bestand einer Installation mit der DB ab.
 *
 * Unbekannte Repos → 'pending_activation' (keine Ingestion, D5).
 * Bekannte Repos → Adoption: installation_id setzen, Status behalten, Legacy-Hook abbauen.
 */
export async function syncInstallationRepositories(
    installationId: number,
    userId: string,
): Promise<number> {
    const installationToken = await getInstallationToken(installationId);
    const grantedRepos = await fetchInstallationRepositories(installationToken);

    if (grantedRepos.length === 0) {
        return 0;
    }

    const knownRepos = await loadKnownRepos(userId, grantedRepos.map((grantedRepo) => grantedRepo.id));
    const knownReposByGithubId = new Map(
        knownRepos.map((knownRepo) => [knownRepo.githubRepoId, knownRepo]),
    );

    const unknownRepos = grantedRepos.filter((grantedRepo) => !knownReposByGithubId.has(grantedRepo.id));

    await insertPendingRepositories(installationId, userId, unknownRepos);
    await adoptKnownRepositories(installationId, userId, knownRepos);

    console.log(
        `[AppInstall] ${grantedRepos.length} Repo(s) für Installation ${installationId} `
        + `synchronisiert (${unknownRepos.length} neu, ${knownRepos.length} adoptiert).`,
    );

    return grantedRepos.length;
}

interface KnownRepoRow {
    readonly id: string;
    readonly githubRepoId: number;
    readonly fullName: string;
    readonly webhookId: number | null;
    readonly status: string;
}

async function loadKnownRepos(
    userId: string,
    githubRepoIds: readonly number[],
): Promise<KnownRepoRow[]> {
    const knownRepos: KnownRepoRow[] = [];

    for (let batchStart = 0; batchStart < githubRepoIds.length; batchStart += REPO_LOOKUP_BATCH_SIZE) {
        const idBatch = githubRepoIds.slice(batchStart, batchStart + REPO_LOOKUP_BATCH_SIZE);

        const { data: knownRepoRows, error: lookupError } = await supabase
            .from('repositories')
            .select('id, github_repo_id, full_name, webhook_id, status')
            .eq('user_id', userId)
            .in('github_repo_id', idBatch);

        if (lookupError) {
            console.error('[AppInstall] Repo-Lookup fehlgeschlagen:', lookupError);
            throw new Error(`Repo-Bestand konnte nicht geladen werden: ${lookupError.message}`);
        }

        knownRepos.push(...(knownRepoRows ?? []).map((knownRepoRow) => ({
            id: knownRepoRow.id,
            githubRepoId: knownRepoRow.github_repo_id,
            fullName: knownRepoRow.full_name,
            webhookId: knownRepoRow.webhook_id,
            status: knownRepoRow.status,
        })));
    }

    return knownRepos;
}

/**
 * Neue Repos in EINEM Upsert (nicht in einer Schleife).
 *
 * Zwei Gründe. Erstens Zeit: GitHub bricht eine Webhook-Delivery nach 10s ab,
 * und eine Org mit 200 Repos wären 200 sequentielle DB-Roundtrips. Zweitens
 * Idempotenz: der Setup-Callback und ein gleichzeitig eintreffendes
 * installation_repositories-Event können denselben Bestand parallel schreiben —
 * `ignoreDuplicates` macht aus dem Wettlauf einen No-Op statt einer
 * Unique-Verletzung, die den ganzen Sync abbräche.
 */
async function insertPendingRepositories(
    installationId: number,
    userId: string,
    unknownRepos: readonly { id: number; full_name: string; default_branch: string }[],
): Promise<void> {
    if (unknownRepos.length === 0) {
        return;
    }

    const { error: insertError } = await supabase
        .from('repositories')
        .upsert(
            unknownRepos.map((unknownRepo) => ({
                user_id: userId,
                github_repo_id: unknownRepo.id,
                full_name: unknownRepo.full_name,
                default_branch: unknownRepo.default_branch,
                installation_id: installationId,
                status: 'pending_activation',
            })),
            { onConflict: 'user_id,github_repo_id', ignoreDuplicates: true },
        );

    if (insertError) {
        console.error('[AppInstall] Insert der neuen Repos fehlgeschlagen:', insertError);
        throw new Error(`Neue Repos konnten nicht angelegt werden: ${insertError.message}`);
    }
}

/**
 * Bekannte Repos unter die App-Identität ziehen — OHNE den Status anzufassen.
 *
 * Der Sync hebt insbesondere KEIN 'deactivated' an. Ein deaktiviertes Repo ist
 * entweder bewusst vom User abbestellt oder von einer Deinstallation
 * zurückgeblieben; in beiden Fällen wäre eine automatische Wiederbelebung falsch:
 * der Kunde bekäme auf einem abbestellten Repo wieder Bot-Kommentare und — bei
 * einem `required check` — sogar unmergebare PRs. Der Weg zurück führt über den
 * Aktivieren-Button (entitlement-geprüft), der die installation_id sieht und
 * deshalb die App-Aktivierung statt eines neuen Webhooks auslöst.
 */
async function adoptKnownRepositories(
    installationId: number,
    userId: string,
    knownRepos: readonly KnownRepoRow[],
): Promise<void> {
    if (knownRepos.length === 0) {
        return;
    }

    // Kein updated_at: die Adoption trifft auch deaktivierte Repos, und an
    // deren updated_at hängt die 30-Tage-Löschfrist des Crons (Migration 052).
    // Jeder Sync der Installation finge sie sonst von vorn an.
    const { error: adoptError } = await supabase
        .from('repositories')
        .update({ installation_id: installationId })
        .eq('user_id', userId)
        .in('id', knownRepos.map((knownRepo) => knownRepo.id));

    if (adoptError) {
        console.error('[AppInstall] Adoption der bekannten Repos fehlgeschlagen:', adoptError);
        throw new Error(`Repos konnten nicht adoptiert werden: ${adoptError.message}`);
    }

    // Nur die wenigen Repos mit Legacy-Hook brauchen einen GitHub-Call.
    for (const adoptedRepo of knownRepos.filter((knownRepo) => knownRepo.webhookId !== null)) {
        await detachLegacyWebhook(userId, adoptedRepo);
    }
}

/**
 * Entfernt den alten Repo-Webhook eines adoptierten Repos (D7).
 *
 * Best effort: gelingt das Löschen nicht (User-Token weg, Admin-Recht verloren),
 * bleibt der Hook auf GitHub stehen — die Doppel-Delivery fängt dann der harte
 * Guard in der Webhook-Route ab. Die DB-Spalten werden trotzdem geleert, damit
 * kein totes Secret zurückbleibt.
 */
async function detachLegacyWebhook(userId: string, knownRepo: KnownRepoRow): Promise<void> {
    if (knownRepo.webhookId === null) {
        return;
    }

    try {
        const userToken = await resolveGithubToken(userId);
        await deleteWebhook(userToken, knownRepo.fullName, knownRepo.webhookId);
        console.log(`[AppInstall] Legacy-Hook ${knownRepo.webhookId} von ${knownRepo.fullName} gelöscht.`);
    } catch (hookDeleteError: unknown) {
        const isAlreadyGone = hookDeleteError instanceof GitHubApiError && hookDeleteError.status === 404;
        if (!isAlreadyGone) {
            console.error(
                `[AppInstall] Legacy-Hook von ${knownRepo.fullName} nicht löschbar `
                + `(Route-Guard übernimmt): ${extractErrorMessage(hookDeleteError)}`,
            );
        }
    }

    const { error: clearError } = await supabase
        .from('repositories')
        .update({ webhook_id: null, webhook_secret: null })
        .eq('id', knownRepo.id)
        .eq('user_id', userId);

    if (clearError) {
        console.error(`[AppInstall] Hook-Spalten von ${knownRepo.fullName} nicht leerbar:`, clearError);
        throw new Error(`Legacy-Hook-Referenz blieb bestehen: ${clearError.message}`);
    }
}

// =============================================================================
// Abbau
// =============================================================================

async function upsertInstallationRow(
    payload: InstallationEventPayload,
    status: InstallationStatus,
): Promise<void> {
    // user_id fehlt hier bewusst: bei einer Re-Installation würde ein NULL die
    // bestehende Verknüpfung überschreiben.
    const { error: upsertError } = await supabase
        .from('github_app_installations')
        .upsert(
            {
                installation_id: payload.installationId,
                account_login: payload.accountLogin,
                account_type: payload.accountType,
                status,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'installation_id' },
        );

    if (upsertError) {
        console.error(`[AppInstall] Upsert von Installation ${payload.installationId} fehlgeschlagen:`, upsertError);
        throw new Error(`Installation konnte nicht gespeichert werden: ${upsertError.message}`);
    }
}

async function setInstallationStatus(
    installationId: number,
    status: InstallationStatus,
): Promise<void> {
    const { error: statusError } = await supabase
        .from('github_app_installations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('installation_id', installationId);

    if (statusError) {
        console.error(`[AppInstall] Status '${status}' für ${installationId} nicht setzbar:`, statusError);
        throw new Error(`Installations-Status konnte nicht gesetzt werden: ${statusError.message}`);
    }
}

/**
 * Repos von der Installation lösen: deaktivieren und installation_id nullen,
 * damit keine toten Referenzen bleiben. Die code_chunks werden nicht gelöscht
 * (D8), aber deaktiviert: ab hier läuft ihre 30-Tage-Frist wie beim Trennen im
 * Dashboard (LEGAL_PAGES_SPEC §4a.2).
 *
 * Chunks ZUERST: scheitert ihre Deaktivierung, hängen die Repos noch an der
 * Installation und die Wiederholung des Webhooks findet sie wieder. Umgekehrt
 * wären sie gelöst und ihre Skelette blieben für immer aktiv.
 *
 * @param githubRepoIds - null = alle Repos der Installation (Deinstallation)
 */
async function detachRepositories(
    installationId: number,
    githubRepoIds: readonly number[] | null,
): Promise<void> {
    if (githubRepoIds !== null && githubRepoIds.length === 0) {
        return;
    }

    const detachedAtIso = new Date().toISOString();
    const attachedRepositoryIds = await loadAttachedRepositoryIds(installationId, githubRepoIds);
    await deactivateRepositoryChunks(attachedRepositoryIds, detachedAtIso);
    await deactivateAttachedRepositories(installationId, githubRepoIds, detachedAtIso);
    await releaseDeactivatedRepositories(installationId, githubRepoIds);
}

async function loadAttachedRepositoryIds(
    installationId: number,
    githubRepoIds: readonly number[] | null,
): Promise<string[]> {
    const attachedQuery = supabase
        .from('repositories')
        .select('id')
        .eq('installation_id', installationId);

    const { data: attachedRows, error: lookupError } = githubRepoIds === null
        ? await attachedQuery
        : await attachedQuery.in('github_repo_id', githubRepoIds);

    if (lookupError) {
        console.error(`[AppInstall] Repos von Installation ${installationId} nicht ladbar:`, lookupError);
        throw new Error(`Repos der Installation konnten nicht geladen werden: ${lookupError.message}`);
    }

    return (attachedRows ?? []).map((attachedRow) => attachedRow.id);
}

/** Noch nicht deaktivierte Repos: Status, Zeitstempel (Start der 30-Tage-Frist) und Referenz. */
async function deactivateAttachedRepositories(
    installationId: number,
    githubRepoIds: readonly number[] | null,
    detachedAtIso: string,
): Promise<void> {
    const deactivateQuery = supabase
        .from('repositories')
        .update({ status: 'deactivated', installation_id: null, updated_at: detachedAtIso })
        .eq('installation_id', installationId)
        // status ist nullable; ein bloßes neq ließe eine NULL-Zeile aus.
        .or('status.is.null,status.neq.deactivated');

    const { error: detachError } = githubRepoIds === null
        ? await deactivateQuery
        : await deactivateQuery.in('github_repo_id', githubRepoIds);

    if (detachError) {
        console.error(`[AppInstall] Repos von Installation ${installationId} nicht lösbar:`, detachError);
        throw new Error(`Repos konnten nicht deaktiviert werden: ${detachError.message}`);
    }
}

/**
 * Was jetzt noch an der Installation hängt, war schon vorher im Dashboard
 * getrennt. Dort wird nur die Referenz genullt: `updated_at` bleibt stehen,
 * sonst finge die 30-Tage-Löschfrist des Crons von vorn an.
 */
async function releaseDeactivatedRepositories(
    installationId: number,
    githubRepoIds: readonly number[] | null,
): Promise<void> {
    const releaseQuery = supabase
        .from('repositories')
        .update({ installation_id: null })
        .eq('installation_id', installationId);

    const { error: releaseError } = githubRepoIds === null
        ? await releaseQuery
        : await releaseQuery.in('github_repo_id', githubRepoIds);

    if (releaseError) {
        console.error(`[AppInstall] Getrennte Repos von Installation ${installationId} nicht lösbar:`, releaseError);
        throw new Error(`Getrennte Repos konnten nicht gelöst werden: ${releaseError.message}`);
    }
}
