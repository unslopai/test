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
 *
 * Die Keys ab `java` haben keine Korpus-Zeilen (LANGUAGE_COVERAGE_SPEC §6.6):
 * sie existieren für den Law-Filter und heißen wie die `applies_to`-Tags der
 * Golden Standards. Ohne sie nahm der Filter 31 Regeln aus jedem Repo mit
 * erkanntem Ökosystem. Neue Keys nur anhängen: die Reihenfolge bestimmt die
 * persistierte Spalte.
 */
export const KNOWN_ECOSYSTEMS = [
    'nextjs',
    'react',
    'typescript',
    'nodejs',
    'python',
    'go',
    'java-spring',
    'java',
    'c',
    'cpp',
    'terraform',
    'powershell',
    'kubernetes',
    'solidity',
    'rust',
    'kotlin',
    'scala',
    'haskell',
    'elixir',
    'cobol',
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

const JAVA_MANIFEST_BASENAMES = new Set(['pom.xml', 'build.gradle', 'build.gradle.kts']);

/** Manifeste und Projektdateien, deren bloße Existenz ein Ökosystem belegt. */
const MANIFEST_BASENAME_ECOSYSTEMS: ReadonlyMap<string, Ecosystem> = new Map([
    ['package.json', 'nodejs'],
    ['tsconfig.json', 'typescript'],
    ['go.mod', 'go'],
    ['pyproject.toml', 'python'],
    ['requirements.txt', 'python'],
    ['setup.py', 'python'],
    ['Cargo.toml', 'rust'],
    ['Chart.yaml', 'kubernetes'],
    ['kustomization.yaml', 'kubernetes'],
    ['kustomization.yml', 'kubernetes'],
]);

/**
 * Quelldatei-Endungen als Pfadsignal (LANGUAGE_COVERAGE_SPEC §6.6): eine
 * Sprache ohne Manifest (Go ohne `go.mod`, Java ohne Spring, C, Terraform,
 * PowerShell) ist sonst für den Law-Filter unsichtbar. Eine Datei genügt —
 * wie schon bei `.ts`. Gilt für Repo- und Diff-Ebene.
 *
 * Jedes `applies_to`-Tag der Tabelle außer `aws` hat hier ein Signal. Sonst
 * verlöre ein Repo, das bisher `[]` hatte (ungefilterter Block), mit dem
 * ersten erkannten Pfad die Regeln seiner eigentlichen Sprache.
 */
const SOURCE_EXTENSION_ECOSYSTEMS: ReadonlyMap<string, Ecosystem> = new Map([
    ['.ts', 'typescript'],
    ['.tsx', 'typescript'],
    ['.js', 'nodejs'],
    ['.jsx', 'nodejs'],
    ['.mjs', 'nodejs'],
    ['.cjs', 'nodejs'],
    ['.rs', 'rust'],
    ['.kt', 'kotlin'],
    ['.kts', 'kotlin'],
    ['.scala', 'scala'],
    ['.hs', 'haskell'],
    ['.ex', 'elixir'],
    ['.exs', 'elixir'],
    ['.cbl', 'cobol'],
    ['.cob', 'cobol'],
    ['.py', 'python'],
    ['.go', 'go'],
    ['.java', 'java'],
    ['.c', 'c'],
    ['.h', 'c'],
    ['.cpp', 'cpp'],
    ['.cc', 'cpp'],
    ['.cxx', 'cpp'],
    ['.hpp', 'cpp'],
    ['.tf', 'terraform'],
    ['.ps1', 'powershell'],
    ['.psm1', 'powershell'],
    ['.sol', 'solidity'],
]);

/**
 * Kubernetes-Manifeste haben keine eigene Endung. Als Signal zählt YAML unter
 * einem der üblichen Verzeichnisse; `Chart.yaml` und `kustomization.yaml`
 * stehen in MANIFEST_BASENAME_ECOSYSTEMS. Ohne Inhalts-Fetch: ein falsches
 * Signal kostet nur zwölf zusätzliche Regeln im Prompt.
 */
const KUBERNETES_MANIFEST_PATH_PATTERN = /(^|\/)(k8s|kubernetes|manifests|helm|charts|kustomize)\/.*\.ya?ml$/i;

/** Ökosysteme, die eine Quelldatei belegt — für Repo-Tree und Diff dieselbe Tabelle. */
function detectSourceFileEcosystems(filePath: string): Ecosystem[] {
    const sourceEcosystems: Ecosystem[] = [];
    const extensionEcosystem = SOURCE_EXTENSION_ECOSYSTEMS.get(extractExtension(filePath));
    if (extensionEcosystem) sourceEcosystems.push(extensionEcosystem);
    if (KUBERNETES_MANIFEST_PATH_PATTERN.test(filePath)) sourceEcosystems.push('kubernetes');
    return sourceEcosystems;
}

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
        const manifestEcosystem = MANIFEST_BASENAME_ECOSYSTEMS.get(extractBasename(treePath));
        if (manifestEcosystem) detected.add(manifestEcosystem);
        for (const sourceEcosystem of detectSourceFileEcosystems(treePath)) detected.add(sourceEcosystem);
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
/** Kandidaten für die Spring-Practices; ob das Repo Spring nutzt, entscheidet die Schnittmenge. */
const JAVA_SPRING_CANDIDATE_EXTENSIONS = new Set(['.java', '.kt', '.kts']);

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
        if (JAVA_SPRING_CANDIDATE_EXTENSIONS.has(extension)) detected.add('java-spring');
        for (const sourceEcosystem of detectSourceFileEcosystems(filePath)) detected.add(sourceEcosystem);
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
