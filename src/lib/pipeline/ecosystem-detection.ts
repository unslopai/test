/**
 * Ecosystem Detection — Phase 5 (BEST_PRACTICES_PLAN §9.2).
 *
 * Zwei Ebenen, ein Gate:
 * - Repo-Ebene (Ingest-Zeit): GitHub-Tree-Pfade + gezielte Manifest-Fetches
 *   (`package.json`, `pom.xml`, ...) → persistiert in
 *   `repositories.detected_ecosystems`. Stabil zwischen Scans, damit der
 *   gefilterte Law-Block den Cache-Contract des Prompt-Builders nicht bricht.
 * - Diff-Ebene (Review-Zeit): reine Pfad-Heuristik über die PR-Dateien.
 *
 * Retrieval-Gate = Schnittmenge beider Ebenen (PROC-009): ein reiner
 * Python-Diff in einem Monorepo zieht keine Next.js-Practices.
 *
 * Die Skeleton-Chunks enthalten KEINE Manifeste (nur .ts/.tsx/.js/.jsx/.mjs),
 * deshalb läuft die Repo-Erkennung über den Tree, nicht über code_chunks.
 */

// =============================================================================
// Vocabulary
// =============================================================================

/**
 * Muss den `ecosystem`-Keys des reference_practices-Korpus entsprechen.
 * Erweiterbar (z.B. 'rust' in Tier 2) — Keys ohne Korpus-Zeilen sind harmlos,
 * die Retrieval-RPC liefert dann schlicht nichts.
 */
export const KNOWN_ECOSYSTEMS = [
    'nextjs',
    'react',
    'typescript',
    'nodejs',
    'python',
    'go',
    'java-spring',
] as const;

export type Ecosystem = (typeof KNOWN_ECOSYSTEMS)[number];

/** Lädt den Inhalt eines Manifests aus dem Repo; null = nicht ladbar (non-fatal). */
export type ManifestLoader = (manifestPath: string) => Promise<string | null>;

/** Max. Manifest-Fetches pro Familie — Monorepo-Schutz gegen Fetch-Explosion. */
const MAX_MANIFEST_FETCHES_PER_FAMILY = 3;

// =============================================================================
// Repo-level detection (ingest time)
// =============================================================================

const IGNORED_TREE_SEGMENTS = ['node_modules/', 'vendor/', '.git/'];

const PYTHON_MANIFEST_BASENAMES = new Set(['pyproject.toml', 'requirements.txt', 'setup.py']);
const JAVA_MANIFEST_BASENAMES = new Set(['pom.xml', 'build.gradle', 'build.gradle.kts']);
const TYPESCRIPT_FILE_PATTERN = /\.(ts|tsx)$/;

/**
 * Erkennt die Ökosysteme eines Repos aus Tree-Pfaden + Manifest-Inhalten.
 * Ergebnis ist deterministisch sortiert (Reihenfolge von KNOWN_ECOSYSTEMS),
 * damit die persistierte Spalte über Re-Ingests byte-stabil bleibt.
 */
export async function detectRepoEcosystems(
    treePaths: readonly string[],
    loadManifest: ManifestLoader,
): Promise<Ecosystem[]> {
    const relevantPaths = treePaths.filter(
        (treePath) => !IGNORED_TREE_SEGMENTS.some((ignored) => treePath.includes(ignored)),
    );

    const detected = new Set<Ecosystem>();
    collectPathOnlySignals(relevantPaths, detected);
    await collectNodeFrameworkSignals(relevantPaths, loadManifest, detected);
    await collectJavaSpringSignal(relevantPaths, loadManifest, detected);

    return KNOWN_ECOSYSTEMS.filter((ecosystemKey) => detected.has(ecosystemKey));
}

function collectPathOnlySignals(relevantPaths: readonly string[], detected: Set<Ecosystem>): void {
    for (const treePath of relevantPaths) {
        const basename = extractBasename(treePath);

        if (basename === 'package.json') detected.add('nodejs');
        if (basename === 'go.mod') detected.add('go');
        if (basename === 'tsconfig.json' || TYPESCRIPT_FILE_PATTERN.test(basename)) {
            detected.add('typescript');
        }
        if (PYTHON_MANIFEST_BASENAMES.has(basename)) detected.add('python');
    }
}

/** Liest package.json-Dependencies, um nextjs/react vom bloßen nodejs zu trennen. */
async function collectNodeFrameworkSignals(
    relevantPaths: readonly string[],
    loadManifest: ManifestLoader,
    detected: Set<Ecosystem>,
): Promise<void> {
    const packageJsonPaths = selectShallowestPaths(relevantPaths, (basename) => basename === 'package.json');

    for (const manifestPath of packageJsonPaths) {
        if (detected.has('nextjs') && detected.has('react')) return;

        const dependencyNames = await readPackageJsonDependencies(manifestPath, loadManifest);
        if (dependencyNames.has('next')) detected.add('nextjs');
        if (dependencyNames.has('react')) detected.add('react');
    }
}

async function readPackageJsonDependencies(
    manifestPath: string,
    loadManifest: ManifestLoader,
): Promise<Set<string>> {
    const manifestContent = await loadManifest(manifestPath);
    if (!manifestContent) return new Set();

    try {
        const parsedManifest: unknown = JSON.parse(manifestContent);
        if (!parsedManifest || typeof parsedManifest !== 'object') return new Set();

        const manifestRecord = parsedManifest as Record<string, unknown>;
        return new Set([
            ...extractDependencyKeys(manifestRecord.dependencies),
            ...extractDependencyKeys(manifestRecord.devDependencies),
        ]);
    } catch (parseError: unknown) {
        // Recovery: ein unparsebares package.json (z.B. JSON5/Kommentare) kostet
        // nur die next/react-Verfeinerung — nodejs ist über den Pfad schon erkannt.
        console.warn(
            `[EcosystemDetection] package.json ${manifestPath} nicht parsebar — überspringe Framework-Signale:`,
            parseError instanceof Error ? parseError.message : parseError,
        );
        return new Set();
    }
}

function extractDependencyKeys(dependencyBlock: unknown): string[] {
    if (!dependencyBlock || typeof dependencyBlock !== 'object') return [];
    return Object.keys(dependencyBlock as Record<string, unknown>);
}

/** Java-Manifeste sind nur mit Spring-Referenz ein java-spring-Signal (§9.2). */
async function collectJavaSpringSignal(
    relevantPaths: readonly string[],
    loadManifest: ManifestLoader,
    detected: Set<Ecosystem>,
): Promise<void> {
    const javaManifestPaths = selectShallowestPaths(
        relevantPaths,
        (basename) => JAVA_MANIFEST_BASENAMES.has(basename),
    );

    for (const manifestPath of javaManifestPaths) {
        const manifestContent = await loadManifest(manifestPath);
        if (manifestContent && /spring-boot|org\.springframework/.test(manifestContent)) {
            detected.add('java-spring');
            return;
        }
    }
}

/** Wählt die flachsten Treffer (Root zuerst), gedeckelt pro Manifest-Familie. */
function selectShallowestPaths(
    relevantPaths: readonly string[],
    basenameMatcher: (basename: string) => boolean,
): string[] {
    return relevantPaths
        .filter((treePath) => basenameMatcher(extractBasename(treePath)))
        .sort((leftPath, rightPath) =>
            countPathSegments(leftPath) - countPathSegments(rightPath)
            || leftPath.localeCompare(rightPath),
        )
        .slice(0, MAX_MANIFEST_FETCHES_PER_FAMILY);
}

// =============================================================================
// Diff-level detection (review time, pure)
// =============================================================================

const JS_FAMILY_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const REACT_EXTENSIONS = new Set(['.tsx', '.jsx']);
/** Deckungsgleich mit der Smart-Context-Detection im Prompt-Builder. */
const NEXTJS_BASENAMES = new Set(['layout.tsx', 'page.tsx', 'route.ts', 'route.tsx', 'middleware.ts']);
const JAVA_EXTENSIONS = new Set(['.java', '.kt', '.kts']);

/**
 * Kandidaten-Ökosysteme eines Diffs, rein aus den Dateipfaden.
 * Bewusst großzügig (jede JS-Datei ⇒ typescript+nodejs): präzise wird es
 * erst durch die Schnittmenge mit der Repo-Erkennung.
 */
export function detectDiffEcosystems(filePaths: readonly string[]): Ecosystem[] {
    const detected = new Set<Ecosystem>();

    for (const filePath of filePaths) {
        const extension = extractExtension(filePath);
        const basename = extractBasename(filePath);

        if (JS_FAMILY_EXTENSIONS.has(extension)) {
            detected.add('typescript');
            detected.add('nodejs');
        }
        if (REACT_EXTENSIONS.has(extension)) detected.add('react');
        if (NEXTJS_BASENAMES.has(basename)) detected.add('nextjs');
        if (extension === '.py') detected.add('python');
        if (extension === '.go') detected.add('go');
        if (JAVA_EXTENSIONS.has(extension)) detected.add('java-spring');
    }

    return KNOWN_ECOSYSTEMS.filter((ecosystemKey) => detected.has(ecosystemKey));
}

/**
 * Das PROC-009-Gate: Practices werden nur für die Schnittmenge retrieved.
 * `repoEcosystems = null` heißt "Repo seit dem Feature nicht re-ingested"
 * → leere Schnittmenge, kein Retrieval (ehrlicher Fallback, §9.1).
 */
export function intersectEcosystems(
    repoEcosystems: readonly string[] | null,
    diffEcosystems: readonly Ecosystem[],
): Ecosystem[] {
    if (!repoEcosystems || repoEcosystems.length === 0) return [];
    return diffEcosystems.filter((diffEcosystem) => repoEcosystems.includes(diffEcosystem));
}

// =============================================================================
// Path utilities
// =============================================================================

function extractBasename(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
}

function extractExtension(filePath: string): string {
    const basename = extractBasename(filePath);
    const lastDot = basename.lastIndexOf('.');
    return lastDot >= 0 ? basename.substring(lastDot).toLowerCase() : '';
}

function countPathSegments(filePath: string): number {
    return filePath.split('/').length;
}
