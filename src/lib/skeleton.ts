/**
 * Skeleton-Extraktion und Ingestion (Strategy A).
 *
 * Extrahiert die API-Oberfläche eines Repos:
 * - Funktions-Signaturen (ohne Body)
 * - Interfaces & Type-Aliases
 * - Klassen-Definitionen (ohne Methoden-Body)
 * - Export-Statements
 *
 * Die eigentliche Implementierungslogik wird NICHT gespeichert,
 * um das "Shit in, Shit out"-Problem zu vermeiden.
 *
 * Ingestion läuft in Chunks, um Serverless-Timeouts zu umgehen.
 */
import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';
import { generateEmbeddings } from '@/lib/embeddings';
import { fetchRepoTree, fetchFileContent, type GitHubTreeEntry } from '@/lib/github';
import { detectRepoEcosystems } from '@/lib/pipeline/ecosystem-detection';

// =============================================================================
// Interfaces
// =============================================================================

/** Ein extrahierter Skeleton-Eintrag aus einer Datei. */
export interface SkeletonChunk {
    filePath: string;
    chunkType: 'function_signature' | 'interface' | 'type_alias' | 'class_definition' | 'export_statement';
    content: string;
    metadata: Record<string, unknown>;
}

// =============================================================================
// Skeleton Extraction
// =============================================================================

/**
 * Extrahiert die API-Oberfläche (Skeletons) aus TypeScript/JavaScript-Code.
 *
 * Verwendet Regex-basierte Extraktion (kein AST-Parser nötig,
 * hält die Dependencies minimal). Erfasst:
 * - Export-Funktions-Signaturen (async/sync, mit Parametern und Return-Type)
 * - Interfaces und Type-Aliases
 * - Klassen-Definitionen (nur Signatur, ohne Method-Body)
 * - Named Exports
 *
 * @param fileContent - Der vollständige Datei-Inhalt
 * @param filePath - Der relative Dateipfad
 * @returns Array von Skeleton-Chunks
 */
export function extractSkeletons(fileContent: string, filePath: string): SkeletonChunk[] {
    const chunks: SkeletonChunk[] = [];
    const lines = fileContent.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const trimmed = line.trim();

        // Interface-Definitionen
        if (/^export\s+(interface|type)\s+/.test(trimmed)) {
            const block = extractBlock(lines, lineIndex);
            const chunkType = trimmed.includes('interface') ? 'interface' : 'type_alias';

            chunks.push({
                filePath,
                chunkType,
                content: block.content,
                metadata: { startLine: lineIndex + 1, endLine: lineIndex + block.lineCount },
            });

            lineIndex += block.lineCount - 1;
            continue;
        }

        // Funktions-Signaturen (export function / export async function / export const ... = ...)
        if (/^export\s+(async\s+)?function\s+/.test(trimmed)) {
            const signature = extractFunctionSignature(lines, lineIndex);
            if (signature) {
                chunks.push({
                    filePath,
                    chunkType: 'function_signature',
                    content: signature.content,
                    metadata: { startLine: lineIndex + 1 },
                });
            }
            continue;
        }

        // Arrow-Function Exports: export const foo = (...) => ...
        if (/^export\s+const\s+\w+\s*[=:]/.test(trimmed) && (trimmed.includes('=>') || trimmed.includes('function'))) {
            const signature = extractArrowSignature(lines, lineIndex);
            if (signature) {
                chunks.push({
                    filePath,
                    chunkType: 'function_signature',
                    content: signature,
                    metadata: { startLine: lineIndex + 1 },
                });
            }
            continue;
        }

        // Klassen-Definitionen
        if (/^export\s+(abstract\s+)?class\s+/.test(trimmed)) {
            const classSkeleton = extractClassSkeleton(lines, lineIndex);
            if (classSkeleton) {
                chunks.push({
                    filePath,
                    chunkType: 'class_definition',
                    content: classSkeleton.content,
                    metadata: { startLine: lineIndex + 1, endLine: lineIndex + classSkeleton.lineCount },
                });
                lineIndex += classSkeleton.lineCount - 1;
            }
            continue;
        }

        // Standalone Type-Aliases (nicht exportiert, aber type X = ...)
        if (/^type\s+\w+/.test(trimmed) && !trimmed.startsWith('typeof')) {
            const block = extractBlock(lines, lineIndex);
            chunks.push({
                filePath,
                chunkType: 'type_alias',
                content: block.content,
                metadata: { startLine: lineIndex + 1, endLine: lineIndex + block.lineCount },
            });
            lineIndex += block.lineCount - 1;
            continue;
        }

        // Standalone Interfaces (nicht exportiert)
        if (/^interface\s+\w+/.test(trimmed)) {
            const block = extractBlock(lines, lineIndex);
            chunks.push({
                filePath,
                chunkType: 'interface',
                content: block.content,
                metadata: { startLine: lineIndex + 1, endLine: lineIndex + block.lineCount },
            });
            lineIndex += block.lineCount - 1;
            continue;
        }

        // Export-Variablen (export const X = ...)
        if (/^export\s+const\s+\w+/.test(trimmed) && !trimmed.includes('=>') && !trimmed.includes('function')) {
            chunks.push({
                filePath,
                chunkType: 'export_statement',
                content: trimmed.replace(/=\s*.+$/, '= ...').replace(/;\s*$/, ';'),
                metadata: { startLine: lineIndex + 1 },
            });
        }
    }

    return chunks;
}

// =============================================================================
// Block Extraction Helpers
// =============================================================================

interface ExtractedBlock {
    content: string;
    lineCount: number;
}

/**
 * Extrahiert einen vollständigen Code-Block der mit { beginnt und mit } endet.
 * Zählt geschweifte Klammern um den richtigen End-Punkt zu finden.
 */
function extractBlock(lines: string[], startIndex: number): ExtractedBlock {
    let braceDepth = 0;
    let foundBrace = false;
    const blockLines: string[] = [];

    for (let lineIdx = startIndex; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        blockLines.push(line);

        for (const char of line) {
            if (char === '{') {
                braceDepth++;
                foundBrace = true;
            } else if (char === '}') {
                braceDepth--;
            }
        }

        // Block ist komplett wenn wir mindestens eine { gesehen haben und depth wieder 0 ist
        if (foundBrace && braceDepth === 0) {
            break;
        }

        // Einzeiler ohne Klammern (z.B. type X = string;)
        if (!foundBrace && line.trim().endsWith(';')) {
            break;
        }

        // Safety: Maximal 100 Zeilen pro Block
        if (blockLines.length > 100) break;
    }

    return {
        content: blockLines.join('\n'),
        lineCount: blockLines.length,
    };
}

/**
 * Extrahiert die Signatur einer benannten Funktion (ohne Body).
 * Gibt nur die erste Zeile (Signatur) zurück, bis zur öffnenden Klammer.
 */
function extractFunctionSignature(
    lines: string[],
    startIndex: number,
): { content: string } | null {
    const signatureParts: string[] = [];

    for (let lineIdx = startIndex; lineIdx < lines.length && lineIdx < startIndex + 5; lineIdx++) {
        const line = lines[lineIdx];
        signatureParts.push(line.trim());

        // Signatur endet bei der öffnenden Klammer des Body
        if (line.includes('{')) {
            const fullSignature = signatureParts.join(' ');
            // Alles nach der letzten { abschneiden
            const signatureOnly = fullSignature.substring(0, fullSignature.lastIndexOf('{')).trim();
            return { content: signatureOnly };
        }
    }

    // Fallback: Erste Zeile als Signatur
    return signatureParts.length > 0
        ? { content: signatureParts[0] }
        : null;
}

/**
 * Extrahiert die Signatur einer Arrow-Function.
 * z.B. "export const foo = (bar: string): void =>"
 */
function extractArrowSignature(lines: string[], startIndex: number): string | null {
    const signatureParts: string[] = [];

    for (let lineIdx = startIndex; lineIdx < lines.length && lineIdx < startIndex + 5; lineIdx++) {
        const line = lines[lineIdx].trim();
        signatureParts.push(line);

        if (line.includes('=>')) {
            const fullSignature = signatureParts.join(' ');
            // Alles nach => abschneiden, aber => selbst behalten
            const arrowIndex = fullSignature.indexOf('=>');
            return fullSignature.substring(0, arrowIndex + 2).trim();
        }
    }

    return signatureParts.length > 0 ? signatureParts[0] : null;
}

/**
 * Extrahiert ein Klassen-Skeleton: Klassen-Signatur + Methoden-Signaturen (ohne Body).
 */
function extractClassSkeleton(
    lines: string[],
    startIndex: number,
): ExtractedBlock | null {
    const block = extractBlock(lines, startIndex);
    const blockLines = block.content.split('\n');

    // Nur die Klassen-Signatur und Methoden-Signaturen behalten
    const skeletonLines: string[] = [];
    let inMethodBody = false;
    let methodBodyDepth = 0;

    for (const line of blockLines) {
        const trimmed = line.trim();

        if (inMethodBody) {
            for (const char of trimmed) {
                if (char === '{') methodBodyDepth++;
                if (char === '}') methodBodyDepth--;
            }
            if (methodBodyDepth <= 0) {
                inMethodBody = false;
                skeletonLines.push('  }');
            }
            continue;
        }

        // Methoden-Signatur erkennen (innerhalb der Klasse)
        if (/^\s*(public|private|protected|static|async|get|set)?\s*\w+\s*\(/.test(trimmed) && trimmed.includes('{')) {
            const sigPart = trimmed.substring(0, trimmed.indexOf('{')).trim();
            skeletonLines.push(`  ${sigPart} { ... }`);
            methodBodyDepth = 0;
            for (const char of trimmed) {
                if (char === '{') methodBodyDepth++;
                if (char === '}') methodBodyDepth--;
            }
            if (methodBodyDepth > 0) inMethodBody = true;
            continue;
        }

        skeletonLines.push(line);
    }

    return {
        content: skeletonLines.join('\n'),
        lineCount: block.lineCount,
    };
}

// =============================================================================
// Repository Ingestion (Chunked)
// =============================================================================

/** Dateien die beim Skeleton-Ingest ignoriert werden. */
const IGNORED_PATHS = [
    'node_modules/', '.next/', 'dist/', 'build/', '.git/',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '.env', '.env.local', '.env.production',
];

const INGESTABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

/**
 * Führt die Skeleton-Ingestion für ein Repository durch.
 *
 * Arbeitet in Chunks um Serverless-Timeouts zu umgehen:
 * 1. Lädt die Dateiliste via GitHub Tree API
 * 2. Filtert auf relevante Code-Dateien
 * 3. Verarbeitet Dateien in Batches (CHUNK_SIZE pro Aufruf)
 * 4. Speichert die Skeletons + Embeddings in Supabase
 *
 * @param repositoryId - Die Repository-ID in unserer DB
 * @param githubToken - GitHub Access Token
 * @param repoFullName - Repository im Format "owner/repo"
 * @param defaultBranch - Der Default-Branch des Repos
 * @returns Anzahl der verarbeiteten Chunks
 */
export async function ingestRepository(
    repositoryId: string,
    githubToken: string,
    repoFullName: string,
    defaultBranch: string = 'main',
): Promise<number> {
    console.log(`[Skeleton] Starte Delta-Ingestion für ${repoFullName} (Branch: ${defaultBranch})...`);

    // 1. Zuerst abgelaufene deaktivierte Chunks bereinigen (TTL Cleanup)
    // Zu Testzwecken auf 10 Sekunden gestellt (normalerweise 30 Tage: 30 * 24 * 60 * 60 * 1000)
    const ttlThreshold = new Date(Date.now() - 10 * 1000).toISOString();
    
    const { error: cleanupError } = await supabase
        .from('code_chunks')
        .delete()
        .eq('repository_id', repositoryId)
        .not('deactivated_at', 'is', null)
        .lt('deactivated_at', ttlThreshold);

    if (cleanupError) {
        console.error(`[Skeleton] Fehler beim TTL Cleanup für ${repoFullName}:`, cleanupError);
    } else {
        console.log(`[Skeleton] TTL Cleanup ausgeführt für alte Chunks (< ${ttlThreshold}).`);
    }

    // 2. Bestehende deaktivierte Chunks laden (Caching-Basis für Delta-Erkennung)
    const { data: cachedChunks } = await supabase
        .from('code_chunks')
        .select('id, file_path, content_hash, deactivated_at')
        .eq('repository_id', repositoryId)
        .not('deactivated_at', 'is', null);

    // Map: file_path+hash → chunk_id für Cache-Hits
    const cachedHashMap = new Map<string, string>();
    for (const chunk of (cachedChunks ?? [])) {
        if (chunk.content_hash) {
            cachedHashMap.set(`${chunk.file_path}::${chunk.content_hash}`, chunk.id as string);
        }
    }

    // Dateiliste via GitHub Tree API laden
    const tree = await fetchRepoTree(githubToken, repoFullName, defaultBranch);

    // Ökosystem-Erkennung (Phase 5, §9.2) — non-fatal: scheitert sie, bleibt die
    // Spalte auf ihrem alten Wert und die Pipeline fällt ehrlich zurück
    // (ungefilterter Law-Block, keine Practices). Die Ingestion läuft weiter.
    await detectAndPersistEcosystems(repositoryId, tree, githubToken, repoFullName, defaultBranch);

    // Nur relevante Code-Dateien
    const codeFiles = tree.filter((entry) =>
        entry.type === 'blob' &&
        INGESTABLE_EXTENSIONS.some((ext) => entry.path.endsWith(ext)) &&
        !IGNORED_PATHS.some((ignored) => entry.path.includes(ignored)),
    );

    console.log(`[Skeleton] ${codeFiles.length} Code-Dateien gefunden (von ${tree.length} total).`);

    if (codeFiles.length === 0) {
        console.log('[Skeleton] Keine Code-Dateien zum Verarbeiten.');
        return 0;
    }

    // In Chunks verarbeiten um Timeouts zu vermeiden
    const CHUNK_SIZE = 15;
    let totalChunks = 0;

    for (let chunkStart = 0; chunkStart < codeFiles.length; chunkStart += CHUNK_SIZE) {
        const fileChunk = codeFiles.slice(chunkStart, chunkStart + CHUNK_SIZE);

        console.log(
            `[Skeleton] Batch ${Math.floor(chunkStart / CHUNK_SIZE) + 1}/${Math.ceil(codeFiles.length / CHUNK_SIZE)} ` +
            `(${fileChunk.length} Dateien)...`,
        );

        const batchChunks = await processFileChunk(
            fileChunk,
            repositoryId,
            githubToken,
            repoFullName,
            defaultBranch,
            cachedHashMap,
        );

        totalChunks += batchChunks;
    }

    console.log(`[Skeleton] Delta-Ingestion abgeschlossen: ${totalChunks} Skeleton-Chunks verarbeitet.`);
    return totalChunks;
}

/**
 * Erkennt die Ökosysteme des Repos aus dem bereits geladenen Tree und
 * persistiert sie in `repositories.detected_ecosystems` (Phase 5, §9.2).
 *
 * Fehler sind bewusst non-fatal (Log statt Throw): eine gescheiterte Erkennung
 * darf die Skeleton-Ingestion nicht töten — der Fallback (alte/NULL-Spalte
 * ⇒ ungefilterter Law-Block, keine Practices) ist der ehrliche Zustand.
 */
async function detectAndPersistEcosystems(
    repositoryId: string,
    tree: GitHubTreeEntry[],
    githubToken: string,
    repoFullName: string,
    branch: string,
): Promise<void> {
    try {
        const blobPaths = tree
            .filter((treeEntry) => treeEntry.type === 'blob')
            .map((treeEntry) => treeEntry.path);

        const detectedEcosystems = await detectRepoEcosystems(blobPaths, async (manifestPath) => {
            try {
                return await fetchFileContent(githubToken, repoFullName, manifestPath, branch);
            } catch (manifestFetchError: unknown) {
                console.warn(
                    `[Skeleton] Manifest ${manifestPath} nicht ladbar — Signal entfällt:`,
                    manifestFetchError instanceof Error ? manifestFetchError.message : manifestFetchError,
                );
                return null;
            }
        });

        const { error: persistError } = await supabase
            .from('repositories')
            .update({ detected_ecosystems: detectedEcosystems })
            .eq('id', repositoryId);

        if (persistError) {
            console.error(
                `[Skeleton] detected_ecosystems für ${repoFullName} nicht persistierbar:`,
                persistError,
            );
            return;
        }

        console.log(`[Skeleton] Ökosysteme erkannt für ${repoFullName}: [${detectedEcosystems.join(', ')}]`);
    } catch (detectionError: unknown) {
        console.error(
            `[Skeleton] Ökosystem-Erkennung für ${repoFullName} fehlgeschlagen — Spalte bleibt unverändert:`,
            detectionError,
        );
    }
}

/**
 * Verarbeitet einen einzelnen Chunk von Dateien:
 * Lädt den Inhalt, extrahiert Skeletons, generiert Embeddings und speichert alles.
 *
 * @param files - Die zu verarbeitenden Dateien aus dem GitHub Tree
 * @param repositoryId - Die Repository-ID
 * @param githubToken - GitHub Access Token
 * @param repoFullName - Repository im Format "owner/repo"
 * @param branch - Der Branch
 * @returns Anzahl der gespeicherten Chunks
 */
async function processFileChunk(
    files: GitHubTreeEntry[],
    repositoryId: string,
    githubToken: string,
    repoFullName: string,
    branch: string,
    cachedHashMap: Map<string, string>,
): Promise<number> {
    const allSkeletons: SkeletonChunk[] = [];
    const skeletonHashes: string[] = [];
    const cacheHitIds: string[] = [];

    for (const file of files) {
        try {
            const fileContent = await fetchFileContent(githubToken, repoFullName, file.path, branch);
            const skeletons = extractSkeletons(fileContent, file.path);

            for (const skeleton of skeletons) {
                const skeletonText = `${skeleton.filePath} [${skeleton.chunkType}]: ${skeleton.content}`;
                const contentHash = createHash('sha256').update(skeletonText).digest('hex');
                const cacheKey = `${skeleton.filePath}::${contentHash}`;

                if (cachedHashMap.has(cacheKey)) {
                    // Cache-Hit: Chunk reaktivieren statt neu vectorisieren
                    cacheHitIds.push(cachedHashMap.get(cacheKey)!);
                } else {
                    allSkeletons.push(skeleton);
                    skeletonHashes.push(contentHash);
                }
            }
        } catch (fileError: unknown) {
            console.warn(`[Skeleton] Datei ${file.path} konnte nicht geladen werden:`, fileError);
        }
    }

    // Cache-Hits reaktivieren (deactivated_at zurücksetzen)
    if (cacheHitIds.length > 0) {
        await supabase
            .from('code_chunks')
            .update({ deactivated_at: null, last_synced_at: new Date().toISOString() })
            .in('id', cacheHitIds);
        console.log(`[Skeleton] ${cacheHitIds.length} Chunks aus Cache reaktiviert.`);
    }

    if (allSkeletons.length === 0) return cacheHitIds.length;

    // Neue/geänderte Chunks vectorisieren
    const texts = allSkeletons.map((skeleton) =>
        `${skeleton.filePath} [${skeleton.chunkType}]: ${skeleton.content}`,
    );

    const embeddings = await generateEmbeddings(texts, 'RETRIEVAL_DOCUMENT');

    const nowIso = new Date().toISOString();
    const rows = allSkeletons.map((skeleton, idx) => ({
        repository_id: repositoryId,
        file_path: skeleton.filePath,
        chunk_type: skeleton.chunkType,
        content: skeleton.content,
        content_hash: skeletonHashes[idx],
        embedding: JSON.stringify(embeddings[idx]),
        metadata: skeleton.metadata,
        last_synced_at: nowIso,
        deactivated_at: null,
    }));

    const { error: insertError } = await supabase
        .from('code_chunks')
        .insert(rows);

    if (insertError) {
        console.error('[Skeleton] Fehler beim Speichern der Chunks:', insertError);
        throw new Error(`Skeleton-Chunks konnten nicht gespeichert werden: ${insertError.message}`);
    }

    console.log(`[Skeleton] ${allSkeletons.length} neue Chunks vectorisiert, ${cacheHitIds.length} aus Cache.`);
    return allSkeletons.length + cacheHitIds.length;
}
