/**
 * Companion-Loader für den Pre-Scanner (Config-Engine v4, SEC-019).
 *
 * Eine Next-Middleware im Diff sagt allein nichts über die Security-Header
 * der App: sie können in `next.config.*` liegen. Der Core kann das nicht
 * sehen (er bekommt nur Diff-Dateien), der Worker hat das Token — also
 * beschafft der Worker die Begleitdatei bei headSha und reicht sie mit.
 * Vertrag (PrescanCompanionFile): gelistet = existiert; `content: null` =
 * unlesbar (der Core meldet den abhängigen Check dann als skipped, nie als
 * Finding); nicht gelistet = existiert nicht. Ein 404 auf das Verzeichnis
 * oder die Datei ist „existiert nicht“, jeder andere Fehler ist „unlesbar“ —
 * ebenso ein abgeschnittenes Listing und ein `next.config.*`, das keine
 * reguläre Datei ist (Symlink, Submodul): beides heißt „unbekannt“, nicht „fehlt“.
 */
import { GitHubApiError, fetchFileContent, githubFetch } from '@/lib/github';
import type { PrescanCompanionFile } from '@unslop/prescan';

/** Spiegel von NEXT_MIDDLEWARE_FILE in @unslop/prescan — der Worker importiert das Package nur als Typ. */
const NEXT_MIDDLEWARE_FILE = /(^|\/)(middleware|proxy)\.(ts|js|mjs|cjs|mts)$/;
const NEXT_CONFIG_NAME = /^next\.config\.(js|mjs|cjs|ts|mts)$/;
/**
 * Timeout pro GitHub-Request. Der File-Content-Loader hat (noch) keinen; 10 s ist
 * der Wert, den er vernünftigerweise nutzen würde: weit über der üblichen
 * Sub-Sekunden-Latenz der Contents API und unter dem 15-s-`totalBudgetMs` des
 * Prescans, damit ein hängender Call den Step nicht bis zum Worker-Timeout blockiert.
 */
const COMPANION_FETCH_TIMEOUT_MS = 10_000;
/** Die Contents API liefert pro Verzeichnis höchstens 1000 Einträge, ohne Pagination. */
const CONTENTS_LISTING_LIMIT = 1000;

export interface CompanionLoaderParams {
    readonly githubToken: string;
    readonly repoFullName: string;
    readonly headSha: string;
    /** Pfade der scanbaren Diff-Dateien — bestimmen, welche Begleitdateien gesucht werden. */
    readonly scannedPaths: readonly string[];
}

export interface CompanionDirectoryEntry {
    readonly name: string;
    /** false für Symlinks, Submodule, Verzeichnisse — Inhalt über die Contents API nicht lesbar. */
    readonly isFile: boolean;
}

/** GitHub-Zugriffe als Port — injizierbar für Tests. `null` = 404; unvollständiges Listing wirft. */
export interface CompanionGitHubPort {
    listDirectory(directoryPath: string): Promise<readonly CompanionDirectoryEntry[] | null>;
    readFile(filePath: string): Promise<string | null>;
}

export async function loadCompanionFiles(
    params: CompanionLoaderParams,
    port: CompanionGitHubPort = buildGitHubPort(params),
): Promise<PrescanCompanionFile[]> {
    if (!params.githubToken) return [];
    const companions: PrescanCompanionFile[] = [];
    for (const directoryPath of nextConfigDirectories(params.scannedPaths)) {
        companions.push(...await loadNextConfigsIn(directoryPath, port));
    }
    return companions;
}

/** Verzeichnis jeder Next-Middleware, plus das Elternverzeichnis bei `src/` (next.config liegt daneben). */
export function nextConfigDirectories(scannedPaths: readonly string[]): string[] {
    const directories = new Set<string>();
    for (const scannedPath of scannedPaths) {
        if (!NEXT_MIDDLEWARE_FILE.test(scannedPath)) continue;
        const directory = parentDirectory(scannedPath);
        directories.add(directory);
        if (directory === 'src' || directory.endsWith('/src')) directories.add(parentDirectory(directory));
    }
    return [...directories];
}

async function loadNextConfigsIn(directoryPath: string, port: CompanionGitHubPort): Promise<PrescanCompanionFile[]> {
    let entries: readonly CompanionDirectoryEntry[] | null;
    try {
        entries = await port.listDirectory(directoryPath);
    } catch (listError: unknown) {
        console.warn(`[Prescan] Companion-Listing für ${directoryPath || '.'} fehlgeschlagen: ${describeError(listError)}`);
        return [{ path: joinPath(directoryPath, 'next.config.*'), content: null }];
    }
    if (entries === null) return [];

    const companions: PrescanCompanionFile[] = [];
    for (const entry of entries.filter((candidate) => NEXT_CONFIG_NAME.test(candidate.name))) {
        const companionPath = joinPath(directoryPath, entry.name);
        const content = entry.isFile ? await readCompanionOrNull(companionPath, port) : null;
        companions.push({ path: companionPath, content });
    }
    return companions;
}

async function readCompanionOrNull(companionPath: string, port: CompanionGitHubPort): Promise<string | null> {
    try {
        return await port.readFile(companionPath);
    } catch (readError: unknown) {
        console.warn(`[Prescan] Companion-Fetch für ${companionPath} fehlgeschlagen: ${describeError(readError)}`);
        return null;
    }
}

// =============================================================================
// Default-Port (GitHub Contents API bei headSha)
// =============================================================================

interface ContentsEntry {
    readonly name: string;
    readonly type: string;
}

function buildGitHubPort(params: CompanionLoaderParams): CompanionGitHubPort {
    return {
        async listDirectory(directoryPath) {
            try {
                const entries = await githubFetch<ContentsEntry[]>(
                    `/repos/${params.repoFullName}/contents/${directoryPath}?ref=${params.headSha}`,
                    params.githubToken,
                    { signal: AbortSignal.timeout(COMPANION_FETCH_TIMEOUT_MS) },
                );
                if (!Array.isArray(entries)) throw new Error(`${directoryPath || '.'} ist kein Verzeichnis-Listing`);
                if (entries.length >= CONTENTS_LISTING_LIMIT) throw new Error(`Listing von ${directoryPath || '.'} abgeschnitten (${entries.length} Einträge)`);
                return entries.map((entry) => ({ name: entry.name, isFile: entry.type === 'file' }));
            } catch (listError: unknown) {
                if (listError instanceof GitHubApiError && listError.status === 404) return null;
                throw listError;
            }
        },
        async readFile(filePath) {
            try {
                return await fetchFileContent(
                    params.githubToken, params.repoFullName, filePath, params.headSha,
                    { signal: AbortSignal.timeout(COMPANION_FETCH_TIMEOUT_MS) },
                );
            } catch (readError: unknown) {
                if (readError instanceof GitHubApiError && readError.status === 404) return null;
                throw readError;
            }
        },
    };
}

function parentDirectory(filePath: string): string {
    const separatorIndex = filePath.lastIndexOf('/');
    return separatorIndex === -1 ? '' : filePath.slice(0, separatorIndex);
}

function joinPath(directoryPath: string, fileName: string): string {
    return directoryPath === '' ? fileName : `${directoryPath}/${fileName}`;
}

function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
