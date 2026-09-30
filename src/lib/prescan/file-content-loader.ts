/**
 * File-Content-Loader für den Pre-Scanner (pre_scanner_design.md §7.1).
 *
 * PR-Jobs: voller Datei-Inhalt bei headSha via GitHub Contents API — ASTs
 * lassen sich nicht aus Patches bauen (PROC-004). Nutzt exakt den Auth-Pfad
 * des diff-loaders (App- und OAuth-Token funktionieren identisch).
 * CLI-Jobs haben kein GitHub-Token: content bleibt null (Degraded Mode).
 */
import { mapWithConcurrency } from '@/lib/concurrency';
import { fetchFileContent } from '@/lib/github';
import type { PullRequestFile } from '@/lib/github';
import type { PrescanFile } from '@unslop/prescan';

const FETCH_CONCURRENCY = 4;

export interface FileContentLoaderParams {
    readonly githubToken: string;
    readonly repoFullName: string;
    readonly headSha: string;
    readonly files: readonly PullRequestFile[];
    readonly maxFileBytes: number;
}

/**
 * Lädt Inhalte parallel (Pool von 4). Einzelne Fetch-Fehler degradieren NUR
 * die betroffene Datei auf Patch-only (content: null) — der Core protokolliert
 * das als skippedChecks; ein Totalausfall wirft und wird vom Fail-Safe Gate
 * des Steps absorbiert.
 */
export async function loadPrescanFiles(params: FileContentLoaderParams): Promise<PrescanFile[]> {
    const scannableFiles = params.files.filter(
        (file) => file.patch !== undefined && file.status !== 'removed',
    );

    return await mapWithConcurrency(scannableFiles, FETCH_CONCURRENCY, async (file) => ({
        path: file.filename,
        content: await fetchContentOrNull(params, file),
        patch: file.patch ?? '',
    }));
}

async function fetchContentOrNull(
    params: FileContentLoaderParams,
    file: PullRequestFile,
): Promise<string | null> {
    if (!params.githubToken) return null;

    try {
        const fileContent = await fetchFileContent(
            params.githubToken,
            params.repoFullName,
            file.filename,
            params.headSha,
        );
        // Oversized-Inhalte hier nicht abschneiden — der Core meldet size-cap
        // ehrlich als filesSkipped statt auf halben Dateien zu scannen.
        return fileContent;
    } catch (fetchError: unknown) {
        console.warn(
            `[Prescan] Content-Fetch für ${file.filename}@${params.headSha} fehlgeschlagen — `
            + `Datei läuft im Patch-only-Modus: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        );
        return null;
    }
}
