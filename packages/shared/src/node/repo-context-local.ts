/**
 * Kontextpaket aus dem Arbeitsverzeichnis (REPO_CONTEXT_SPEC §9 1b) für CLI,
 * Extension (über die CLI) und MCP-Server: dieselben Auswahlregeln wie der
 * Server (`../repo-context.ts`), gelesen wird der Stand auf der Platte inklusive
 * nicht committeter Änderungen. Dazu die Aufrufer geänderter Symbole per
 * `git grep` als Pfadliste mit Trefferzeile — im App-Pfad gibt es die nicht.
 *
 * Auswahl, keine Analyse: das Paket trägt Dateien, kein Urteil (MCP_SPEC D3).
 * Der Secret-Filter läuft über jeden Abschnitt; ein Treffer entfernt die
 * Datei aus dem Paket und nennt sie.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    DEFAULT_REPO_CONTEXT_MAX_TOKENS,
    buildRepoContextPackage,
    parseUnifiedDiffFiles,
} from '../repo-context.js';
import type {
    ChangedFileInput,
    RepoContextPackage,
    RepoContextReader,
    RepoContextSection,
} from '../repo-context.js';
import { GitError, grepWordInWorkTree, listWorkTreeFiles } from './git.js';
import { containsSecretLine } from './secret-filter.js';

/** Lokal kostet ein Lesezugriff nichts; der Deckel schützt nur vor Repos mit tausenden Migrationen. */
const LOCAL_MAX_FILE_READS = 200;
const MAX_LOCAL_FILE_BYTES = 200 * 1024;
const MAX_CALLER_SYMBOLS = 10;
const MAX_HITS_PER_SYMBOL = 5;
/** Kürzere Namen treffen per Wortsuche zu viel Unbeteiligtes. */
const MIN_SYMBOL_LENGTH = 4;

const DECLARED_SYMBOL_PATTERNS: readonly RegExp[] = [
    /\b(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)/,
    /\b(?:class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/,
    /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function\b)/,
    /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/,
    /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/,
];

function createWorkTreeReader(gitRoot: string): RepoContextReader {
    return {
        listPaths: () => Promise.resolve({ paths: listWorkTreeFiles(gitRoot), truncated: false }),
        readFile: (repoPath: string) => Promise.resolve(readWorkTreeFile(gitRoot, repoPath)),
    };
}

/** null = fehlt, liegt außerhalb der Wurzel, ist zu groß oder binär. */
function readWorkTreeFile(gitRoot: string, repoPath: string): string | null {
    const absolutePath = path.resolve(gitRoot, repoPath);
    if (!absolutePath.startsWith(path.resolve(gitRoot) + path.sep)) return null;
    try {
        const fileStats = fs.lstatSync(absolutePath, { throwIfNoEntry: false });
        if (!fileStats || !fileStats.isFile() || fileStats.size > MAX_LOCAL_FILE_BYTES) return null;
        const fileText = fs.readFileSync(absolutePath, 'utf-8');
        return fileText.includes('\0') ? null : fileText;
    } catch (readError: unknown) {
        // Eine einzelne unlesbare Datei (Rechte, zwischen Liste und Lesen gelöscht)
        // darf nicht das ganze Paket kosten: der Paketbau führt sie als Auslassung
        // `unreadable`. Alles außer einem Dateisystem-Fehler bleibt ein Fehler.
        if (readError instanceof Error && 'code' in readError) return null;
        throw readError;
    }
}

/** Namen, die auf geänderten Zeilen (hinzugefügt oder entfernt) bestehender Dateien deklariert werden. */
export function extractChangedSymbols(changedFiles: readonly ChangedFileInput[]): string[] {
    const changedSymbols = new Set<string>();
    for (const changedFile of changedFiles) {
        if (changedFile.status === 'added' || changedFile.status === 'removed') continue;
        for (const patchLine of (changedFile.patch ?? '').split('\n')) {
            if (!/^[+-](?![+-]{2})/.test(patchLine)) continue;
            for (const declarationPattern of DECLARED_SYMBOL_PATTERNS) {
                const declaredName = declarationPattern.exec(patchLine.slice(1))?.[1];
                if (declaredName && declaredName.length >= MIN_SYMBOL_LENGTH) changedSymbols.add(declaredName);
            }
        }
    }
    return [...changedSymbols].slice(0, MAX_CALLER_SYMBOLS);
}

/** `symbol: pfad:zeile` je Treffer außerhalb der geänderten Dateien; null = kein Aufrufer gefunden. */
function buildCallersSection(gitRoot: string, changedFiles: readonly ChangedFileInput[]): RepoContextSection | null {
    const changedPaths = new Set(changedFiles.map((changedFile) => changedFile.path));
    let callerLines: string[];
    try {
        callerLines = extractChangedSymbols(changedFiles).flatMap((changedSymbol) =>
            grepWordInWorkTree(changedSymbol, gitRoot)
                .filter((grepHit) => !changedPaths.has(grepHit.path))
                .slice(0, MAX_HITS_PER_SYMBOL)
                .map((grepHit) => `${changedSymbol}: ${grepHit.path}:${grepHit.line}`));
    } catch (grepError: unknown) {
        // Die Aufrufer-Liste ist ein Zusatz: scheitert die Suche (etwa am
        // Ausgabepuffer bei einem sehr häufigen Namen), entsteht das Paket
        // ohne sie. stderr, weil stdout im MCP-Server dem Protokoll gehört.
        if (!(grepError instanceof GitError)) throw grepError;
        console.error(`[unslop] callers of changed symbols not listed: ${grepError.message}`);
        return null;
    }
    if (callerLines.length === 0) return null;
    return {
        kind: 'callers',
        path: '(files that reference changed symbols)',
        content: callerLines.join('\n'),
        relatedPaths: [],
    };
}

/**
 * Baut das Paket für den Diff, der gleich hochgeladen wird. Wirft GitError
 * oder einen Dateisystem-Fehler; der Aufrufer scannt dann ohne Paket weiter.
 */
export async function buildLocalRepoContext(gitRoot: string, unifiedDiff: string): Promise<RepoContextPackage> {
    const changedFiles: ChangedFileInput[] = parseUnifiedDiffFiles(unifiedDiff).map((diffFile) => ({
        path: diffFile.filename,
        status: diffFile.status,
        patch: diffFile.patch,
    }));
    const callersSection = buildCallersSection(gitRoot, changedFiles);
    return buildRepoContextPackage({
        changedFiles,
        reader: createWorkTreeReader(gitRoot),
        maxTokens: DEFAULT_REPO_CONTEXT_MAX_TOKENS,
        maxFileReads: LOCAL_MAX_FILE_READS,
        containsSecret: containsSecretLine,
        ...(callersSection ? { callersSection } : {}),
    });
}
