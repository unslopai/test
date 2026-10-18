/**
 * Validierungsgrenze für GitHub-Webhook-Payloads (GITHUB_APP_SPEC.md §4.4)
 * und für die Pull-Request-Objekte der REST-API, die dieselbe Form haben
 * (Dashboard „Review now“, §4.10).
 *
 * [ARCH-002] Externer Input wird hier EINMAL strukturell geparst und verlässt
 * dieses Modul nur noch als typisiertes Objekt. Ein `null`-Rückgabewert heißt
 * "Payload unbrauchbar" — der Aufrufer antwortet dann mit 400.
 *
 * [SEC-002] Der Payload ist Daten, niemals Instruktion.
 */

// =============================================================================
// Primitive Reader (kein Type-Casting, nur Narrowing)
// =============================================================================

function readObject(source: unknown, key: string): object | null {
    if (typeof source !== 'object' || source === null) {
        return null;
    }
    const nestedValue = Reflect.get(source, key);
    return typeof nestedValue === 'object' && nestedValue !== null ? nestedValue : null;
}

function readString(source: unknown, key: string): string | null {
    if (typeof source !== 'object' || source === null) {
        return null;
    }
    const stringValue = Reflect.get(source, key);
    return typeof stringValue === 'string' ? stringValue : null;
}

function readNumber(source: unknown, key: string): number | null {
    if (typeof source !== 'object' || source === null) {
        return null;
    }
    const numberValue = Reflect.get(source, key);
    return typeof numberValue === 'number' && Number.isFinite(numberValue) ? numberValue : null;
}

/**
 * Die Installation-ID einer App-Delivery. Fehlt sie, stammt die Delivery vom
 * Legacy-Repo-Hook — genau dieser Unterschied steuert Signatur-Secret und
 * Dupe-Guard (GITHUB_APP_SPEC D7).
 */
export function readInstallationId(rawPayload: unknown): number | null {
    return readNumber(readObject(rawPayload, 'installation'), 'id');
}

/** Parst den rohen Body. Ungültiges JSON ist ein 400, kein Crash. */
export function parseWebhookBody(rawBody: string): unknown | null {
    try {
        return JSON.parse(rawBody);
    } catch (jsonParseError: unknown) {
        console.error('[Webhook] Payload ist kein gültiges JSON:', jsonParseError);
        return null;
    }
}

// =============================================================================
// pull_request
// =============================================================================

export interface PullRequestEventPayload {
    readonly action: string;
    readonly githubRepoId: number;
    readonly repoFullName: string;
    readonly prNumber: number;
    readonly prUrl: string | null;
    /** Ohne HEAD-SHA kann kein Check Run angeheftet werden — dann läuft der Job ohne. */
    readonly prHeadSha: string | null;
    /**
     * Der Head VOR dem Push (`before` einer `synchronize`-Delivery), sonst null.
     * Nur Jobs auf genau diesem Commit löst die Delivery ab (GITHUB_APP_SPEC §4.9).
     */
    readonly previousHeadSha: string | null;
    /** Gesetzt = Delivery der GitHub App, null = Legacy-Repo-Hook. */
    readonly installationId: number | null;
    /**
     * true = der Head liegt in einem anderen Repo als die Basis (Fork-PR). Ein
     * gelöschter Fork (`head.repo: null`) zählt als fremd.
     */
    readonly isCrossRepository: boolean;
    /** `pull_request.author_association` (OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR, NONE …), sonst null. */
    readonly authorAssociation: string | null;
}

/**
 * Vergleicht das Head-Repo mit dem Basis-Repo über die ID, nicht über
 * `head.repo.fork`: das Flag ist auch bei einem Branch im selben Repo true,
 * wenn das Kunden-Repo selbst ein Fork ist. Fehlt `head.repo` ganz (kommt in
 * echten GitHub-Deliveries nicht vor), gilt der PR als repo-intern.
 */
function readIsCrossRepository(pullRequestNode: object | null, baseRepoId: number): boolean {
    const headNode = readObject(pullRequestNode, 'head');
    if (!headNode || !Reflect.has(headNode, 'repo')) {
        return false;
    }
    const headRepoId = readNumber(readObject(headNode, 'repo'), 'id');
    return headRepoId !== baseRepoId;
}

export function parsePullRequestEvent(rawPayload: unknown): PullRequestEventPayload | null {
    const action = readString(rawPayload, 'action');
    const repositoryNode = readObject(rawPayload, 'repository');
    const pullRequestNode = readObject(rawPayload, 'pull_request');

    const githubRepoId = readNumber(repositoryNode, 'id');
    const repoFullName = readString(repositoryNode, 'full_name');
    const prNumber = readNumber(pullRequestNode, 'number');

    if (!action || githubRepoId === null || !repoFullName || prNumber === null) {
        return null;
    }

    return {
        action,
        githubRepoId,
        repoFullName,
        prNumber,
        prUrl: readString(pullRequestNode, 'html_url'),
        prHeadSha: readString(readObject(pullRequestNode, 'head'), 'sha'),
        previousHeadSha: readString(rawPayload, 'before'),
        installationId: readInstallationId(rawPayload),
        isCrossRepository: readIsCrossRepository(pullRequestNode, githubRepoId),
        authorAssociation: readString(pullRequestNode, 'author_association'),
    };
}

// =============================================================================
// check_run (Re-Runs, GITHUB_APP_SPEC.md §4.8)
// =============================================================================

export type CheckRunEventPayload =
    | { readonly kind: 'rerun'; readonly prEvent: PullRequestEventPayload }
    | { readonly kind: 'ignored_action'; readonly action: string }
    | { readonly kind: 'no_pull_request' };

/**
 * Parst ein check_run-Event. GitHubs Enum-Wert heißt 'rerequested' (EIN Wort)
 * und wird nur an Apps mit checks:write geliefert — Repo-Hooks erhalten
 * ausschließlich created/completed.
 *
 * null = strukturell unbrauchbar (Aufrufer antwortet 400); 'ignored_action'
 * und 'no_pull_request' sind bewusste 200-Antworten: Fork-PRs und reine
 * Pushes liefern ein leeres pull_requests-Array, und ohne PR gibt es nichts
 * zu reviewen.
 */
export function parseCheckRunEvent(rawPayload: unknown): CheckRunEventPayload | null {
    const action = readString(rawPayload, 'action');
    const repositoryNode = readObject(rawPayload, 'repository');
    const githubRepoId = readNumber(repositoryNode, 'id');
    const repoFullName = readString(repositoryNode, 'full_name');
    const checkRunNode = readObject(rawPayload, 'check_run');

    if (!action || githubRepoId === null || !repoFullName || !checkRunNode) {
        return null;
    }

    if (action !== 'rerequested') {
        return { kind: 'ignored_action', action };
    }

    const prNumber = readFirstPullRequestNumber(checkRunNode);
    if (prNumber === null) {
        return { kind: 'no_pull_request' };
    }

    return {
        kind: 'rerun',
        prEvent: {
            action,
            githubRepoId,
            repoFullName,
            prNumber,
            prUrl: `https://github.com/${repoFullName}/pull/${prNumber}`,
            // head_sha steht laut Docs auch bei leerem pull_requests-Array
            // zuverlässig am check_run selbst.
            prHeadSha: readString(checkRunNode, 'head_sha'),
            previousHeadSha: null,
            installationId: readInstallationId(rawPayload),
            // Fork-PRs liefern ein leeres pull_requests-Array und enden oben als
            // 'no_pull_request'; den Re-Run selbst löst nur jemand mit Schreibrecht aus.
            isCrossRepository: false,
            authorAssociation: null,
        },
    };
}

function readFirstPullRequestNumber(checkRunNode: object): number | null {
    const pullRequestList = Reflect.get(checkRunNode, 'pull_requests');
    if (!Array.isArray(pullRequestList) || pullRequestList.length === 0) {
        return null;
    }
    return readNumber(pullRequestList[0], 'number');
}

// =============================================================================
// installation
// =============================================================================

export interface InstallationEventPayload {
    readonly action: string;
    readonly installationId: number;
    readonly accountLogin: string;
    readonly accountType: string;
}

export function parseInstallationEvent(rawPayload: unknown): InstallationEventPayload | null {
    const action = readString(rawPayload, 'action');
    const installationNode = readObject(rawPayload, 'installation');
    const installationId = readNumber(installationNode, 'id');
    const accountNode = readObject(installationNode, 'account');
    const accountLogin = readString(accountNode, 'login');

    if (!action || installationId === null || !accountLogin) {
        return null;
    }

    return {
        action,
        installationId,
        accountLogin,
        accountType: readString(accountNode, 'type') ?? 'User',
    };
}

// =============================================================================
// installation_repositories
// =============================================================================

export interface InstallationReposEventPayload {
    readonly action: string;
    readonly installationId: number;
    /** Nur bei action 'removed' befüllt; hinzugefügte Repos werden per API nachgeladen. */
    readonly removedRepoIds: readonly number[];
}

export function parseInstallationReposEvent(
    rawPayload: unknown,
): InstallationReposEventPayload | null {
    const action = readString(rawPayload, 'action');
    const installationId = readNumber(readObject(rawPayload, 'installation'), 'id');

    if (!action || installationId === null) {
        return null;
    }

    return {
        action,
        installationId,
        removedRepoIds: readRepoIdList(rawPayload, 'repositories_removed'),
    };
}

function readRepoIdList(rawPayload: unknown, key: string): readonly number[] {
    if (typeof rawPayload !== 'object' || rawPayload === null) {
        return [];
    }

    const repoList = Reflect.get(rawPayload, key);
    if (!Array.isArray(repoList)) {
        return [];
    }

    return repoList
        .map((repoEntry: unknown) => readNumber(repoEntry, 'id'))
        .filter((repoId: number | null): repoId is number => repoId !== null);
}

// =============================================================================
// Pull-Request-Objekte der REST-API (Dashboard „Review now“, §4.10)
// =============================================================================

/** Ein offener PR aus `GET /repos/{r}/pulls?state=open`. */
export interface OpenPullRequest {
    readonly prNumber: number;
    readonly title: string;
    readonly authorLogin: string | null;
    readonly headBranch: string | null;
    readonly headSha: string;
    readonly updatedAt: string | null;
    readonly htmlUrl: string;
    /** Dieselbe Fork-Regel wie das Webhook-Gate: Head-Repo-ID gegen Basis-Repo-ID. */
    readonly isCrossRepository: boolean;
    readonly authorAssociation: string | null;
}

function asObjectOrNull(rawValue: unknown): object | null {
    return typeof rawValue === 'object' && rawValue !== null ? rawValue : null;
}

/** null = Eintrag ohne Nummer, Head-SHA, Link oder Basis-Repo; er wird nicht angezeigt. */
export function parseOpenPullRequest(rawPull: unknown): OpenPullRequest | null {
    const pullRequestNode = asObjectOrNull(rawPull);
    const prNumber = readNumber(pullRequestNode, 'number');
    const headNode = readObject(pullRequestNode, 'head');
    const headSha = readString(headNode, 'sha');
    const htmlUrl = readString(pullRequestNode, 'html_url');
    const baseRepoId = readNumber(readObject(readObject(pullRequestNode, 'base'), 'repo'), 'id');

    if (prNumber === null || !headSha || !htmlUrl || baseRepoId === null) {
        return null;
    }

    return {
        prNumber,
        title: readString(pullRequestNode, 'title') ?? '',
        authorLogin: readString(readObject(pullRequestNode, 'user'), 'login'),
        headBranch: readString(headNode, 'ref'),
        headSha,
        updatedAt: readString(pullRequestNode, 'updated_at'),
        htmlUrl,
        isCrossRepository: readIsCrossRepository(pullRequestNode, baseRepoId),
        authorAssociation: readString(pullRequestNode, 'author_association'),
    };
}

/** Head und Zustand eines einzelnen PRs aus `GET /repos/{r}/pulls/{n}`. */
export interface PullRequestHeadState {
    readonly headSha: string;
    readonly isOpen: boolean;
}

export function parsePullRequestHeadState(rawPull: unknown): PullRequestHeadState | null {
    const headSha = readString(readObject(rawPull, 'head'), 'sha');
    const pullState = readString(rawPull, 'state');
    if (!headSha || !pullState) {
        return null;
    }
    return { headSha, isOpen: pullState === 'open' };
}
