/**
 * Leser des Kontextpakets für den App-Pfad (REPO_CONTEXT_SPEC §6.4, §9.1):
 * Trees- und Contents-API am Head-SHA des PRs, mit dem Token des Jobs.
 *
 * Höchstens ein Tree-Abruf und so viele Datei-Abrufe, wie die Auswahlregeln
 * über `maxFileReads` zulassen, davon höchstens 8 gleichzeitig (Sekundärlimit).
 * Nichts wird gespeichert: der Inhalt lebt nur im Arbeitsspeicher des Jobs.
 * Der Skeleton-Index wird bewusst nicht benutzt — er kennt nur den
 * Default-Branch zum Zeitpunkt des Verbindens.
 */
import { GitHubApiError, githubFetch } from '@/lib/github';
import type { GitHubTreeEntry } from '@/lib/github';
import type { RepoContextReader, RepoPathListing } from '@unslop/shared/repo-context';

/** Datei-Abrufe je PR im App-Pfad (Spec §6.4: 1 Tree + 15 Dateien). */
export const GITHUB_CONTEXT_MAX_FILE_READS = 15;

const MAX_CONCURRENT_FILE_READS = 8;
/** Die Contents-API liefert über 1 MB keinen Inhalt; so große Dateien gehören ohnehin in kein Paket. */
const MAX_CONTEXT_BLOB_BYTES = 200 * 1024;

export interface GitHubContextSource {
    readonly githubToken: string;
    readonly repoFullName: string;
    readonly headSha: string;
    /** Bricht jeden laufenden Abruf ab, wenn die Zeitgrenze des Steps erreicht ist. */
    readonly abortSignal: AbortSignal;
}

interface TreeResponse {
    readonly tree?: unknown;
    readonly truncated?: unknown;
}

interface ContentsResponse {
    readonly content?: unknown;
    readonly encoding?: unknown;
}

function isBlobEntry(treeEntry: unknown): treeEntry is Pick<GitHubTreeEntry, 'path' | 'type' | 'size'> {
    return treeEntry !== null && typeof treeEntry === 'object'
        && 'path' in treeEntry && typeof treeEntry.path === 'string'
        && 'type' in treeEntry && treeEntry.type === 'blob';
}

function encodeRepoPath(repoPath: string): string {
    return repoPath.split('/').map(encodeURIComponent).join('/');
}

/** Lässt höchstens `concurrencyLimit` Aufgaben gleichzeitig laufen, in Ankunftsreihenfolge. */
function createConcurrencyGate(concurrencyLimit: number): <TResult>(task: () => Promise<TResult>) => Promise<TResult> {
    let runningCount = 0;
    const waitingStarters: (() => void)[] = [];
    // Ein frei werdender Slot geht direkt an den ältesten Wartenden: der Zähler
    // bleibt dabei stehen, sodass kein neuer Aufrufer dazwischenrutscht.
    const releaseSlot = (): void => {
        const nextStarter = waitingStarters.shift();
        if (nextStarter) nextStarter();
        else runningCount--;
    };
    return async <TResult>(task: () => Promise<TResult>): Promise<TResult> => {
        if (runningCount >= concurrencyLimit) {
            await new Promise<void>((startWaiting) => waitingStarters.push(startWaiting));
        } else {
            runningCount++;
        }
        try {
            return await task();
        } finally {
            releaseSlot();
        }
    };
}

export function createGitHubContextReader(contextSource: GitHubContextSource): RepoContextReader {
    const { githubToken, repoFullName, headSha, abortSignal } = contextSource;
    const blobSizeByPath = new Map<string, number>();
    const runGated = createConcurrencyGate(MAX_CONCURRENT_FILE_READS);

    async function listPaths(): Promise<RepoPathListing> {
        const treeResponse = await githubFetch<TreeResponse>(
            `/repos/${repoFullName}/git/trees/${headSha}?recursive=1`, githubToken, { signal: abortSignal },
        );
        const blobEntries = Array.isArray(treeResponse.tree) ? treeResponse.tree.filter(isBlobEntry) : [];
        for (const blobEntry of blobEntries) blobSizeByPath.set(blobEntry.path, blobEntry.size ?? 0);
        return { paths: blobEntries.map((blobEntry) => blobEntry.path), truncated: treeResponse.truncated === true };
    }

    /** null = Datei fehlt am Head (404), ist zu groß oder kommt nicht als base64; alles andere wirft. */
    async function readFile(repoPath: string): Promise<string | null> {
        if ((blobSizeByPath.get(repoPath) ?? 0) > MAX_CONTEXT_BLOB_BYTES) return null;
        try {
            const contentsResponse = await runGated(() => githubFetch<ContentsResponse>(
                `/repos/${repoFullName}/contents/${encodeRepoPath(repoPath)}?ref=${headSha}`,
                githubToken,
                { signal: abortSignal },
            ));
            if (contentsResponse.encoding !== 'base64' || typeof contentsResponse.content !== 'string') return null;
            const fileText = Buffer.from(contentsResponse.content, 'base64').toString('utf-8');
            return fileText.includes('\0') ? null : fileText;
        } catch (contentsFailure: unknown) {
            if (contentsFailure instanceof GitHubApiError && contentsFailure.status === 404) return null;
            throw contentsFailure;
        }
    }

    return { listPaths, readFile };
}
