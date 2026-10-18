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
 * @param endpoint - Relativer API-Pfad (z.B. "/user/repos")
 * @param token - GitHub Access Token
 * @param options - Fetch-Optionen (method, body, etc.)
 * @returns Die geparste JSON-Antwort
 * @throws Error mit Status-Code und Body bei nicht-erfolgreichen Responses
 */
async function githubFetch<T>(endpoint: string, token: string, options: RequestInit = {}): Promise<T> {
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
        throw new Error(
            `GitHub API Fehler ${response.status} ${response.statusText} bei ${endpoint}: ${errorBody}`
        );
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
): Promise<void> {
    await githubFetch<unknown>(`/repos/${repoFullName}/pulls/${prNumber}/reviews`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            commit_id: commitSha,
            body,
            event,
            comments,
        }),
    });
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
