/**
 * Zentraler GitHub API Client.
 *
 * Alle Interaktionen mit der GitHub REST API laufen über diese Datei.
 * Jede Funktion ist typisiert und wirft bei Fehlern aussagekräftige Exceptions.
 */
import * as crypto from 'crypto';

const GITHUB_API_BASE = 'https://api.github.com';

// =============================================================================
// Interfaces
// =============================================================================

export interface GitHubRepo {
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
    /** Repo-Berechtigungen des authentifizierten Users (von GitHub API mitgeliefert). */
    permissions?: {
        admin: boolean;
        maintain: boolean;
        push: boolean;
        triage: boolean;
        pull: boolean;
    };
}

export interface GitHubWebhook {
    id: number;
    active: boolean;
    events: string[];
    config: {
        url: string;
        content_type: string;
    };
    /** Ergebnis der letzten Delivery (nur beim Hook-GET befüllt). */
    last_response?: {
        code: number | null;
        status: string;
        message: string | null;
    };
}

/** Typisierter GitHub-API-Fehler — erlaubt Callern Status-basierte Behandlung (z.B. 404). */
export class GitHubApiError extends Error {
    constructor(
        readonly status: number,
        endpoint: string,
        responseBody: string,
    ) {
        super(`GitHub API Fehler ${status} bei ${endpoint}: ${responseBody}`);
        this.name = 'GitHubApiError';
    }
}

/** Einzelne geänderte Datei in einem PR, inklusive Patch (Unified Diff). */
export interface PullRequestFile {
    sha: string;
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
}

/** Parsed Diff-Hunk mit Start-Zeile und Zeilen-Inhalt für Inline-Comments. */
export interface DiffHunk {
    filename: string;
    startLine: number;
    endLine: number;
    patch: string;
}

/** Eintrag aus der GitHub Tree API (rekursiv). */
export interface GitHubTreeEntry {
    path: string;
    mode: string;
    type: 'blob' | 'tree';
    sha: string;
    size?: number;
    url: string;
}

// =============================================================================
// Core API Helper
// =============================================================================

/**
 * Führt einen authentifizierten GitHub API Request aus.
 *
 * Der `token` ist entweder ein User-OAuth-Token, ein Installation-Token oder
 * (für die /app-Endpoints) ein App-JWT — GitHub akzeptiert alle drei als Bearer.
 *
 * @param endpoint - Relativer API-Pfad (z.B. "/user/repos")
 * @param token - GitHub Access Token
 * @param options - Fetch-Optionen (method, body, etc.)
 * @returns Die geparste JSON-Antwort
 * @throws GitHubApiError mit Status-Code und Body bei nicht-erfolgreichen Responses
 */
export async function githubFetch<T>(endpoint: string, token: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API_BASE}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new GitHubApiError(response.status, endpoint, errorBody);
    }

    // Manche Endpoints geben 204 No Content zurück (z.B. DELETE)
    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

async function githubFetchPaginated<T>(
    endpoint: string,
    token: string,
    perPage: number = 100,
): Promise<T[]> {
    const items: T[] = [];
    const separator = endpoint.includes('?') ? '&' : '?';

    for (let page = 1; page <= 1000; page++) {
        const pageItems = await githubFetch<T[]>(
            `${endpoint}${separator}per_page=${perPage}&page=${page}`,
            token,
        );

        if (pageItems.length === 0) {
            break;
        }

        items.push(...pageItems);

        if (pageItems.length < perPage) {
            break;
        }
    }

    return items;
}

// =============================================================================
// Repository Operations
// =============================================================================

/**
 * Lädt alle Repositories des authentifizierten Users.
 * Paginiert automatisch bis zu 100 Repos.
 *
 * @param token - GitHub Access Token
 * @returns Array aller User-Repositories, sortiert nach letztem Update
 */
export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
    return githubFetchPaginated<GitHubRepo>('/user/repos?sort=updated', token);
}

/** Repo-Details für die CLI-Auto-Connect (id, Default-Branch, Admin-Recht). */
export interface RepoDetails {
    id: number;
    default_branch: string;
    permissions?: { admin?: boolean };
}

export async function fetchRepoByFullName(token: string, repoFullName: string): Promise<RepoDetails> {
    return githubFetch<RepoDetails>(`/repos/${repoFullName}`, token);
}

/** Die GitHub-Identität hinter einem User-OAuth-Token, inklusive der Scopes. */
export interface GitHubUserIdentity {
    readonly id: number;
    readonly login: string;
    /**
     * Die tatsächlich gewährten OAuth-Scopes (Header `X-OAuth-Scopes`).
     *
     * Muss aus der Antwort gelesen werden, nicht aus dem, was wir beim Login
     * angefordert haben: ein Token aus einem früheren Login trägt die alten
     * Scopes, und der Status-Code einer abgelehnten Anfrage (403 vs. 404) ist
     * kein verlässlicher Indikator für einen fehlenden Scope.
     */
    readonly grantedScopes: readonly string[];
}

/** Die Rolle eines Users in einer Organisation. null = kein aktives Mitglied. */
export type OrgMembershipRole = 'admin' | 'member' | null;

/**
 * Rolle des Token-Inhabers in einer Organisation.
 *
 * Braucht den `read:org`-Scope. Fehlt er (Alt-Token vor der Scope-Erweiterung),
 * antwortet GitHub mit 403 — das ist KEIN "nein", sondern "nicht prüfbar", und
 * muss vom Aufrufer unterschieden werden. Deshalb wirft die Funktion in dem Fall.
 *
 * @returns 'admin' | 'member' bei aktiver Mitgliedschaft, null wenn kein Mitglied
 */
export async function fetchOrgMembershipRole(
    userToken: string,
    orgLogin: string,
): Promise<OrgMembershipRole> {
    let membership: unknown;

    try {
        membership = await githubFetch<unknown>(`/user/memberships/orgs/${orgLogin}`, userToken);
    } catch (membershipError: unknown) {
        // 404 = kein Mitglied dieser Org. Alles andere (403 fehlender Scope,
        // 5xx) darf NICHT als "kein Admin" durchgehen — sonst würde ein
        // GitHub-Ausfall stillschweigend zu einer Ablehnung oder, schlimmer,
        // ein fehlender Scope zu einer Fehlentscheidung.
        if (membershipError instanceof GitHubApiError && membershipError.status === 404) {
            return null;
        }
        throw membershipError;
    }

    const membershipState = readOptionalString(membership, 'state');
    const membershipRole = readOptionalString(membership, 'role');

    if (membershipState !== 'active') {
        return null;
    }

    return membershipRole === 'admin' ? 'admin' : 'member';
}

function readOptionalString(source: unknown, key: string): string | null {
    if (typeof source !== 'object' || source === null) {
        return null;
    }
    const fieldValue = Reflect.get(source, key);
    return typeof fieldValue === 'string' ? fieldValue : null;
}

/**
 * Wer ist der Inhaber dieses User-Tokens?
 *
 * Grundlage des Ownership-Beweises beim App-Setup: nur wer nachweislich der
 * Account ist, auf dem die Installation sitzt, darf sie für sich beanspruchen.
 */
export async function fetchAuthenticatedUser(userToken: string): Promise<GitHubUserIdentity> {
    // Eigener fetch statt githubFetch: nur hier brauchen wir die Response-Header
    // (X-OAuth-Scopes), die githubFetch bewusst nicht durchreicht.
    const identityResponse = await fetch(`${GITHUB_API_BASE}/user`, {
        headers: {
            Authorization: `Bearer ${userToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });

    if (!identityResponse.ok) {
        throw new GitHubApiError(identityResponse.status, '/user', await identityResponse.text());
    }

    const userIdentity: unknown = await identityResponse.json();

    if (typeof userIdentity !== 'object' || userIdentity === null) {
        throw new GitHubApiError(500, '/user', 'Antwort ist kein Objekt.');
    }

    const accountId = Reflect.get(userIdentity, 'id');
    const accountLogin = Reflect.get(userIdentity, 'login');

    if (typeof accountId !== 'number' || typeof accountLogin !== 'string') {
        throw new GitHubApiError(500, '/user', 'Antwort enthält keine verwertbare Identität.');
    }

    return {
        id: accountId,
        login: accountLogin,
        grantedScopes: parseOAuthScopes(identityResponse.headers.get('x-oauth-scopes')),
    };
}

/** "repo, admin:repo_hook, read:org" → ['repo', 'admin:repo_hook', 'read:org'] */
function parseOAuthScopes(scopeHeader: string | null): readonly string[] {
    if (!scopeHeader) {
        return [];
    }

    return scopeHeader
        .split(',')
        .map((grantedScope) => grantedScope.trim())
        .filter((grantedScope) => grantedScope.length > 0);
}

/**
 * Prüft, ob das Repo mindestens einen Commit hat (ROADMAP §7l).
 *
 * GitHub beantwortet die Commit-Liste eines leeren Repos mit
 * 409 "Git Repository is empty." — jeder andere Fehler wird durchgereicht.
 */
export async function repoHasCommits(token: string, repoFullName: string): Promise<boolean> {
    try {
        await githubFetch<unknown>(`/repos/${repoFullName}/commits?per_page=1`, token);
        return true;
    } catch (githubError: unknown) {
        if (githubError instanceof GitHubApiError && githubError.status === 409) {
            return false;
        }
        throw githubError;
    }
}

/**
 * Lädt die gesamte Dateistruktur eines Repos via GitHub Tree API (rekursiv).
 *
 * Gibt alle Blobs (Dateien) und Trees (Verzeichnisse) zurück.
 * Die rekursive Variante lädt den gesamten Baum in einem Request.
 *
 * @param token - GitHub Access Token
 * @param repoFullName - Repository im Format "owner/repo"
 * @param branch - Der Branch (z.B. "main")
 * @returns Array aller Einträge im Repository-Tree
 */
export async function fetchRepoTree(
    token: string,
    repoFullName: string,
    branch: string = 'main',
): Promise<GitHubTreeEntry[]> {
    const response = await githubFetch<{ tree: GitHubTreeEntry[] }>(
        `/repos/${repoFullName}/git/trees/${branch}?recursive=1`,
        token,
    );
    return response.tree;
}

/**
 * Lädt den Inhalt einer einzelnen Datei aus einem GitHub Repository.
 *
 * Nutzt die Contents API und dekodiert den Base64-kodierten Inhalt.
 * Für Dateien > 1 MB wird automatisch die Blob API verwendet.
 *
 * @param token - GitHub Access Token
 * @param repoFullName - Repository im Format "owner/repo"
 * @param filePath - Relativer Pfad zur Datei (z.B. "src/lib/utils.ts")
 * @param branch - Der Branch (z.B. "main")
 * @returns Der Datei-Inhalt als UTF-8 String
 */
export async function fetchFileContent(
    token: string,
    repoFullName: string,
    filePath: string,
    branch: string = 'main',
): Promise<string> {
    const response = await githubFetch<{ content: string; encoding: string }>(
        `/repos/${repoFullName}/contents/${filePath}?ref=${branch}`,
        token,
    );

    if (response.encoding === 'base64') {
        return Buffer.from(response.content, 'base64').toString('utf-8');
    }

    return response.content;
}

// =============================================================================
// Webhook Operations
// =============================================================================

/**
 * Erstellt einen Webhook auf einem GitHub Repository.
 * Der Webhook lauscht auf `pull_request` Events und sendet Payloads
 * an die angegebene URL, gesichert mit einem HMAC-Secret.
 *
 * @param token - GitHub Access Token mit `admin:repo_hook` Scope
 * @param repoFullName - Repository im Format "owner/repo"
 * @param webhookUrl - Die Payload-URL (z.B. "https://example.com/api/webhook")
 * @param secret - HMAC-Secret zur Signatur-Verifikation
 * @returns Das erstellte Webhook-Objekt mit der GitHub-ID
 */
export async function createWebhook(
    token: string,
    repoFullName: string,
    webhookUrl: string,
    secret: string,
): Promise<GitHubWebhook> {
    return githubFetch<GitHubWebhook>(`/repos/${repoFullName}/hooks`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'web',
            active: true,
            events: ['pull_request'],
            config: {
                url: webhookUrl,
                content_type: 'json',
                secret,
                insecure_ssl: '0',
            },
        }),
    });
}

/**
 * Löscht einen Webhook von einem GitHub Repository.
 *
 * @param token - GitHub Access Token mit `admin:repo_hook` Scope
 * @param repoFullName - Repository im Format "owner/repo"
 * @param webhookId - Die GitHub Webhook-ID
 */
export async function deleteWebhook(
    token: string,
    repoFullName: string,
    webhookId: number,
): Promise<void> {
    await githubFetch<void>(`/repos/${repoFullName}/hooks/${webhookId}`, token, {
        method: 'DELETE',
    });
}

/**
 * Lädt einen einzelnen Webhook inkl. last_response (Health-Check-Basis).
 * null = Hook existiert auf GitHub nicht mehr (404) — der häufigste
 * Broken-Zustand, wenn jemand die Repo-Settings aufgeräumt hat.
 *
 * @param token - GitHub Access Token mit `admin:repo_hook` Scope
 * @param repoFullName - Repository im Format "owner/repo"
 * @param webhookId - Die GitHub Webhook-ID aus der repositories-Zeile
 */
export async function fetchWebhook(
    token: string,
    repoFullName: string,
    webhookId: number,
): Promise<GitHubWebhook | null> {
    try {
        return await githubFetch<GitHubWebhook>(`/repos/${repoFullName}/hooks/${webhookId}`, token);
    } catch (hookFetchError: unknown) {
        if (hookFetchError instanceof GitHubApiError && hookFetchError.status === 404) {
            return null;
        }
        throw hookFetchError;
    }
}

// =============================================================================
// Pull Request Operations
// =============================================================================

/**
 * Lädt die geänderten Dateien eines Pull Requests inkl. Patches (Unified Diffs).
 * Jede Datei enthält ein `patch`-Feld mit dem Unified Diff der Änderungen.
 *
 * @param token - GitHub Access Token
 * @param repoFullName - Repository im Format "owner/repo"
 * @param prNumber - PR-Nummer
 * @returns Array der geänderten Dateien mit ihren Patches
 */
export async function fetchPullRequestFiles(
    token: string,
    repoFullName: string,
    prNumber: number,
): Promise<PullRequestFile[]> {
    return githubFetchPaginated<PullRequestFile>(
        `/repos/${repoFullName}/pulls/${prNumber}/files`,
        token,
    );
}

/**
 * Postet ein PR-Review mit Inline-Comments an den geänderten Codezeilen.
 *
 * GitHub PR Reviews erlauben Inline-Comments, die direkt an Diff-Zeilen
 * angeheftet werden. Der `event` Parameter steuert ob das Review als
 * "COMMENT", "APPROVE" oder "REQUEST_CHANGES" gepostet wird.
 *
 * @param token - GitHub Access Token
 * @param repoFullName - Repository im Format "owner/repo"
 * @param prNumber - PR-Nummer
 * @param commitSha - Der HEAD-Commit-SHA des PRs
 * @param body - Gesamtzusammenfassung des Reviews (Markdown)
 * @param comments - Array von Inline-Comments mit Datei, Zeile und Nachricht
 * @param event - Review-Typ: "COMMENT" (neutral) oder "REQUEST_CHANGES" (blockiert)
 */
export async function createPullRequestReview(
    token: string,
    repoFullName: string,
    prNumber: number,
    commitSha: string,
    body: string,
    comments: PullRequestReviewComment[],
    event: 'COMMENT' | 'REQUEST_CHANGES' = 'COMMENT',
): Promise<number | null> {
    const createdReview = await githubFetch<unknown>(`/repos/${repoFullName}/pulls/${prNumber}/reviews`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            commit_id: commitSha,
            body,
            event,
            comments,
        }),
    });

    // [ARCH-002] Strukturelle Sicht auf die Antwort. null statt Fehler: die
    // Review-ID traegt nur die Comment-Map (MCP_SPEC §4.3) — ein Review ohne
    // auslesbare ID ist gepostet und darf den Job nicht kippen.
    const reviewId = typeof createdReview === 'object' && createdReview !== null
        ? Reflect.get(createdReview, 'id')
        : undefined;
    return typeof reviewId === 'number' ? reviewId : null;
}

/** Ein Inline-Comment eines geposteten Reviews (nur die Comment-Map-Felder). */
export interface PostedReviewComment {
    readonly id: number;
    readonly body: string;
}

/**
 * Liest die Inline-Comments eines geposteten Reviews (MCP_SPEC §4.3):
 * die Create-Review-Antwort enthaelt KEINE Comment-IDs, deshalb der
 * Nachschlag ueber den Review-Endpoint.
 */
export async function fetchReviewComments(
    token: string,
    repoFullName: string,
    prNumber: number,
    reviewId: number,
): Promise<PostedReviewComment[]> {
    const reviewComments = await githubFetch<{ id?: unknown; body?: unknown }[]>(
        `/repos/${repoFullName}/pulls/${prNumber}/reviews/${reviewId}/comments`,
        token,
    );

    return reviewComments.flatMap((reviewComment) => (
        typeof reviewComment.id === 'number' && typeof reviewComment.body === 'string'
            ? [{ id: reviewComment.id, body: reviewComment.body }]
            : []
    ));
}

/** Inline-Comment für ein PR-Review, positioniert am Diff einer bestimmten Datei. */
export interface PullRequestReviewComment {
    path: string;
    /** Die Zeile im Diff, an der der Comment angeheftet wird. */
    line: number;
    /** Optional: Start-Zeile für Multi-Line-Comments. */
    start_line?: number;
    /** Seite des Diffs: "RIGHT" für hinzugefügte Zeilen. */
    side: 'LEFT' | 'RIGHT';
    /** Optional: Seite für start_line bei Multi-Line-Comments. */
    start_side?: 'LEFT' | 'RIGHT';
    /** Der Kommentar-Text (Markdown). */
    body: string;
}

// =============================================================================
// Review-Thread-Resolution (MCP_SPEC §4.7 — nur via GraphQL möglich)
// =============================================================================

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

/** Minimale strukturelle Sicht auf die GraphQL-Antwort [ARCH-002]. */
interface ReviewThreadsQueryPayload {
    data?: {
        repository?: {
            pullRequest?: {
                reviewThreads?: {
                    pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
                    nodes?: {
                        id?: string;
                        viewerCanResolve?: boolean;
                        comments?: { nodes?: { databaseId?: number | null }[] };
                    }[];
                };
            };
        };
    };
    errors?: { message?: string }[];
}

async function githubGraphql<TPayload>(
    token: string,
    query: string,
    variables: Record<string, unknown>,
    operationLabel: string,
): Promise<TPayload> {
    const graphqlPayload = await githubFetch<TPayload & { errors?: { message?: string }[] }>(
        GITHUB_GRAPHQL_URL,
        token,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables }),
        },
    );

    // GraphQL antwortet 200 auch bei Fehlern — die stehen im errors-Array.
    // Das operationLabel steht im Fehler, damit Logs query- von mutation-
    // Fehlschlägen unterscheiden (Permission-Diagnose, ROADMAP §1e).
    if (graphqlPayload.errors && graphqlPayload.errors.length > 0) {
        throw new GitHubApiError(
            200,
            GITHUB_GRAPHQL_URL,
            `[${operationLabel}] ` + graphqlPayload.errors
                .map((graphqlError) => graphqlError.message ?? 'unknown')
                .join('; '),
        );
    }

    return graphqlPayload;
}

const REVIEW_THREADS_QUERY = `
query($owner: String!, $name: String!, $prNumber: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      reviewThreads(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          viewerCanResolve
          comments(first: 20) { nodes { databaseId } }
        }
      }
    }
  }
}`;

const RESOLVE_THREAD_MUTATION = `
mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread { isResolved }
  }
}`;

interface MatchedReviewThread {
    readonly threadId: string;
    /** GitHubs eigene Aussage, ob der aktuelle Token den Thread auflösen DARF. */
    readonly viewerCanResolve: boolean;
}

/** Sucht die GraphQL-Thread-Node zum Inline-Comment (REST databaseId). */
async function findReviewThreadForComment(
    token: string,
    repoFullName: string,
    prNumber: number,
    commentDatabaseId: number,
): Promise<MatchedReviewThread | null> {
    const [repoOwner, repoName] = repoFullName.split('/');
    let paginationCursor: string | null = null;

    // 4 Seiten à 50 Threads — jenseits von 200 Threads ist der PR das Problem.
    for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
        const threadsPayload: ReviewThreadsQueryPayload = await githubGraphql<ReviewThreadsQueryPayload>(
            token,
            REVIEW_THREADS_QUERY,
            { owner: repoOwner, name: repoName, prNumber, cursor: paginationCursor },
            'review-threads-query',
        );

        const reviewThreads = threadsPayload.data?.repository?.pullRequest?.reviewThreads;
        for (const threadNode of reviewThreads?.nodes ?? []) {
            const containsComment = (threadNode.comments?.nodes ?? [])
                .some((commentNode) => commentNode.databaseId === commentDatabaseId);
            if (containsComment && typeof threadNode.id === 'string') {
                return {
                    threadId: threadNode.id,
                    viewerCanResolve: threadNode.viewerCanResolve === true,
                };
            }
        }

        if (!reviewThreads?.pageInfo?.hasNextPage || !reviewThreads.pageInfo.endCursor) {
            return null;
        }
        paginationCursor = reviewThreads.pageInfo.endCursor;
    }

    return null;
}

export type ReviewThreadResolutionOutcome = 'resolved' | 'thread_not_found' | 'not_permitted';

/**
 * Löst den Review-Thread auf, der den gegebenen Inline-Comment enthält
 * (MCP_SPEC §4.7 `unslop_resolve_finding`).
 *
 * 'not_permitted' = GitHub selbst meldet via `viewerCanResolve`, dass dieser
 * Token den Thread nicht auflösen darf (Beobachtung 2026-08-09: Installation-
 * Token der App bekommen auf die Mutation "Resource not accessible by
 * integration") — der Caller meldet das ehrlich statt generisch zu failen.
 *
 * @throws GitHubApiError bei API-Fehlern (Netz, Auth, GraphQL-errors)
 */
export async function resolveReviewThreadForComment(
    token: string,
    repoFullName: string,
    prNumber: number,
    commentDatabaseId: number,
): Promise<ReviewThreadResolutionOutcome> {
    const matchedThread = await findReviewThreadForComment(
        token, repoFullName, prNumber, commentDatabaseId,
    );
    if (matchedThread === null) {
        return 'thread_not_found';
    }

    // viewerCanResolve wird bewusst NICHT als Gate benutzt — nur als Telemetrie:
    // das Feld meldete für App-Viewer false, während die Mutation mit
    // contents:write funktionieren kann (Quirk-Verdacht). Versuchen und den
    // Fehler klassifizieren ist robuster als einem Capability-Feld zu trauen.
    try {
        await githubGraphql<{ data?: unknown }>(
            token, RESOLVE_THREAD_MUTATION, { threadId: matchedThread.threadId }, 'resolve-thread-mutation',
        );
        return 'resolved';
    } catch (mutationError: unknown) {
        const isPermissionRefusal = mutationError instanceof GitHubApiError
            && mutationError.message.includes('Resource not accessible');
        if (!isPermissionRefusal) {
            throw mutationError;
        }
        console.warn(
            `[GitHub] resolveReviewThread verweigert für ${repoFullName}#${prNumber}, `
            + `Comment ${commentDatabaseId} (viewerCanResolve=${matchedThread.viewerCanResolve}).`,
        );
        return 'not_permitted';
    }
}

/**
 * Postet einen einzelnen Comment auf einen PR (nicht als Review, sondern als Issue-Comment).
 * Nützlich für Zusammenfassungen oder wenn Inline-Comments nicht möglich sind.
 *
 * @param token - GitHub Access Token
 * @param repoFullName - Repository im Format "owner/repo"
 * @param prNumber - PR-Nummer
 * @param body - Der Kommentar-Text (Markdown)
 */
export async function postPRComment(
    token: string,
    repoFullName: string,
    prNumber: number,
    body: string,
): Promise<void> {
    await githubFetch<unknown>(`/repos/${repoFullName}/issues/${prNumber}/comments`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
    });
}

/** Ein Issue-Kommentar auf einem PR (nur die für Dedupe nötigen Felder). */
export interface PRIssueComment {
    body: string;
}

/**
 * Listet die Issue-Kommentare eines Pull Requests (für Marker-Dedupe).
 */
export async function listPRComments(
    token: string,
    repoFullName: string,
    prNumber: number,
): Promise<PRIssueComment[]> {
    return githubFetchPaginated<PRIssueComment>(
        `/repos/${repoFullName}/issues/${prNumber}/comments`,
        token,
    );
}

/**
 * Holt den HEAD-Commit-SHA eines Pull Requests.
 * Wird benötigt, um PR-Reviews an den richtigen Commit anzuheften.
 *
 * @param token - GitHub Access Token
 * @param repoFullName - Repository im Format "owner/repo"
 * @param prNumber - PR-Nummer
 * @returns HEAD-Commit-SHA als String
 */
export async function getPullRequestHeadSha(
    token: string,
    repoFullName: string,
    prNumber: number,
): Promise<string> {
    const pr = await githubFetch<{ head: { sha: string } }>(
        `/repos/${repoFullName}/pulls/${prNumber}`,
        token,
    );
    return pr.head.sha;
}

// =============================================================================
// Check Runs (nur mit Installation-Token — OAuth-Tokens dürfen keine erstellen)
// =============================================================================

/** Abschluss-Urteil eines Check Runs. `failure` blockiert einen `required check`. */
export type CheckRunConclusion = 'success' | 'failure' | 'neutral' | 'action_required';

/** Der im PR sichtbare Kopf des Check Runs (Markdown im `summary`). */
export interface CheckRunOutput {
    readonly title: string;
    readonly summary: string;
}

export interface CreateCheckRunParams {
    readonly name: string;
    readonly headSha: string;
    readonly status: 'queued' | 'in_progress' | 'completed';
    /** Nur bei status 'completed' erlaubt — GitHub lehnt die Kombination sonst ab. */
    readonly conclusion?: CheckRunConclusion;
    readonly detailsUrl?: string;
    readonly output?: CheckRunOutput;
}

export interface CheckRunUpdate {
    readonly status: 'in_progress' | 'completed';
    readonly conclusion?: CheckRunConclusion;
    readonly output?: CheckRunOutput;
}

/** Referenz auf einen erstellten Check Run — mehr braucht der Aufrufer nicht. */
export interface CheckRunRef {
    readonly id: number;
}

/**
 * Erstellt einen Check Run am HEAD-Commit eines PRs.
 *
 * Ein Check Run mit `status: 'completed'` und Conclusion darf direkt erstellt
 * werden (einzelner Request) — genutzt für Gate-Skips, die nie in eine Pipeline laufen.
 *
 * @param installationToken - Installation-Token der GitHub App (checks:write)
 * @param repoFullName - Repository im Format "owner/repo"
 */
export async function createCheckRun(
    installationToken: string,
    repoFullName: string,
    params: CreateCheckRunParams,
): Promise<CheckRunRef> {
    const createdCheckRun = await githubFetch<unknown>(
        `/repos/${repoFullName}/check-runs`,
        installationToken,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: params.name,
                head_sha: params.headSha,
                status: params.status,
                conclusion: params.conclusion,
                details_url: params.detailsUrl,
                output: params.output,
            }),
        },
    );

    // [ARCH-002] Ohne Prüfung könnte ein `undefined` als check_run_id in der DB
    // landen — der Job hätte dann einen Check, den er nie wieder schließen kann.
    const checkRunId = typeof createdCheckRun === 'object' && createdCheckRun !== null
        ? Reflect.get(createdCheckRun, 'id')
        : undefined;

    if (typeof checkRunId !== 'number') {
        throw new GitHubApiError(
            500,
            `/repos/${repoFullName}/check-runs`,
            'Check-Run-Antwort enthält keine numerische id.',
        );
    }

    return { id: checkRunId };
}

/**
 * Schließt einen laufenden Check Run ab (oder aktualisiert seinen Output).
 * `completed_at` setzt GitHub selbst, sobald eine Conclusion mitkommt.
 *
 * @param installationToken - Installation-Token der GitHub App (checks:write)
 * @param checkRunId - ID aus createCheckRun (persistiert in review_jobs.check_run_id)
 */
export async function updateCheckRun(
    installationToken: string,
    repoFullName: string,
    checkRunId: number,
    update: CheckRunUpdate,
): Promise<void> {
    await githubFetch<unknown>(
        `/repos/${repoFullName}/check-runs/${checkRunId}`,
        installationToken,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: update.status,
                conclusion: update.conclusion,
                output: update.output,
            }),
        },
    );
}

// =============================================================================
// Installation Repositories
// =============================================================================

/** Ein Repo im Zugriffsbereich einer App-Installation. */
export interface InstallationRepo {
    readonly id: number;
    readonly full_name: string;
    readonly default_branch: string;
}

/**
 * Listet alle Repos, auf die eine App-Installation Zugriff hat.
 * Antwort ist ein Objekt (`{ repositories: [...] }`), nicht ein Array — die
 * generische Paginierung passt hier deshalb nicht.
 *
 * @param installationToken - Installation-Token der GitHub App
 */
export async function fetchInstallationRepositories(
    installationToken: string,
): Promise<InstallationRepo[]> {
    const collectedRepos: InstallationRepo[] = [];

    for (let page = 1; page <= 100; page++) {
        const pageResponse = await githubFetch<unknown>(
            `/installation/repositories?per_page=100&page=${page}`,
            installationToken,
        );

        const { parsedRepos, rawEntryCount } = parseInstallationRepoPage(pageResponse);
        collectedRepos.push(...parsedRepos);

        // Abbruch am ROHEN Seitenumfang, nicht am geparsten: ein einziger
        // verworfener Eintrag würde die Seite sonst als "letzte" erscheinen
        // lassen und alle Folgeseiten still unterschlagen.
        if (rawEntryCount < 100) {
            break;
        }
    }

    return collectedRepos;
}

interface InstallationRepoPage {
    readonly parsedRepos: InstallationRepo[];
    readonly rawEntryCount: number;
}

/**
 * [ARCH-002] Strukturelle Prüfung der Repo-Liste. Einträge ohne die
 * Pflichtfelder fallen raus, statt als `undefined` in einen DB-Insert zu wandern.
 */
function parseInstallationRepoPage(pageResponse: unknown): InstallationRepoPage {
    if (typeof pageResponse !== 'object' || pageResponse === null) {
        throw new GitHubApiError(500, '/installation/repositories', 'Antwort ist kein Objekt.');
    }

    const repoList = Reflect.get(pageResponse, 'repositories');

    if (!Array.isArray(repoList)) {
        throw new GitHubApiError(
            500,
            '/installation/repositories',
            'Antwort enthält kein repositories-Array.',
        );
    }

    const parsedRepos = repoList.flatMap((repoEntry: unknown) => {
        if (typeof repoEntry !== 'object' || repoEntry === null) {
            return [];
        }

        const repoId = Reflect.get(repoEntry, 'id');
        const fullName = Reflect.get(repoEntry, 'full_name');
        const defaultBranch = Reflect.get(repoEntry, 'default_branch');

        if (typeof repoId !== 'number' || typeof fullName !== 'string') {
            console.warn('[GitHub] Repo-Eintrag der Installation ohne id/full_name übersprungen.');
            return [];
        }

        return [{
            id: repoId,
            full_name: fullName,
            default_branch: typeof defaultBranch === 'string' ? defaultBranch : 'main',
        }];
    });

    return { parsedRepos, rawEntryCount: repoList.length };
}

// =============================================================================
// Webhook Signature Verification
// =============================================================================

/**
 * Verifiziert die HMAC-SHA256-Signatur eines GitHub Webhook-Payloads.
 *
 * GitHub sendet die Signatur im `X-Hub-Signature-256` Header
 * im Format "sha256=<hex>". Diese Funktion vergleicht die erwartete
 * Signatur mit der tatsächlichen, timing-safe um Timing-Angriffe zu verhindern.
 *
 * @param rawBody - Der rohe Request-Body als String
 * @param signature - Der `X-Hub-Signature-256` Header-Wert
 * @param secret - Das Webhook-Secret aus der Datenbank
 * @returns true wenn die Signatur gültig ist
 */
export function verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string,
): boolean {
    const expectedSignature = 'sha256=' +
        crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    // Timing-safe comparison um Timing-Angriffe zu verhindern
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (actualBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
