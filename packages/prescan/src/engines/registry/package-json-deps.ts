/**
 * package.json-Dependencies für die Registry-Engine (SEC-035).
 *
 * Eine Zeile `"schlüssel": "text"` ist nur in einem Dependency-Abschnitt eine
 * Paket-Deklaration. Ohne diesen Kontext galten `displayName`,
 * `markdownDescription`, `bin`- und `exports`-Einträge als Pakete
 * (LANGUAGE_COVERAGE_SPEC §4.4). Der Abschnitt wird aus den sichtbaren Zeilen
 * rückwärts bestimmt. Zeigt ein Patch den Abschnittskopf nicht, entscheidet
 * die Form des Werts: nur eine Versionsangabe macht die Zeile zum Kandidaten.
 */

const DEPENDENCY_SECTIONS: ReadonlySet<string> = new Set([
    'dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies',
]);
/** Top-Level-Felder, deren Wert wie eine Version aussehen kann, ohne eine Dependency zu sein. */
const METADATA_KEYS: ReadonlySet<string> = new Set([
    'name', 'version', 'description', 'main', 'module', 'types', 'license', 'type', 'private', 'scripts',
    'exports', 'engines', 'packageManager', 'homepage', 'repository', 'author', 'files', 'bin', 'workspaces',
]);

const STRING_ENTRY = /^\s*"([^"]+)"\s*:\s*"([^"]*)"\s*,?\s*$/;
const NPM_PACKAGE_NAME = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/i;
const BLOCK_OPENING_KEY = /^\s*"([^"]+)"\s*:\s*[{[]\s*$/;
/** Werte, die nicht über diesen Namen aus der Registry aufgelöst werden. */
const NON_REGISTRY_SPEC = /^(?:workspace:|file:|link:|portal:|npm:|github:|git[+:]|https?:|[\w.-]+\/[\w.-]+)/;
const VERSION_SHAPED_SPEC = /^(?:[\^~<>=v\s]*\d|\*$|latest$)/;

type EnclosingBlock =
    | { readonly visibility: 'visible'; readonly key: string | null }
    | { readonly visibility: 'hidden' };

/** Paketname einer hinzugefügten package.json-Zeile, oder null, wenn sie keine Dependency deklariert. */
export function extractPackageJsonDependency(
    lineTexts: ReadonlyMap<number, string>,
    lineNumber: number,
): string | null {
    const entryMatch = STRING_ENTRY.exec(lineTexts.get(lineNumber) ?? '');
    if (!entryMatch) return null;
    const [, entryKey, entryValue] = entryMatch;
    if (!NPM_PACKAGE_NAME.test(entryKey) || NON_REGISTRY_SPEC.test(entryValue)) return null;

    const enclosingBlock = findEnclosingBlock(lineTexts, lineNumber);
    if (enclosingBlock.visibility === 'visible') {
        return enclosingBlock.key !== null && DEPENDENCY_SECTIONS.has(enclosingBlock.key) ? entryKey : null;
    }
    return !METADATA_KEYS.has(entryKey) && VERSION_SHAPED_SPEC.test(entryValue) ? entryKey : null;
}

/**
 * Sucht rückwärts die Zeile, die den Block um `lineNumber` öffnet. Bereits
 * geschlossene Geschwister-Blöcke werden über die Klammerbilanz übersprungen.
 * Endet die zusammenhängende Zeilenfolge vorher, ist der Block nicht sichtbar.
 */
function findEnclosingBlock(lineTexts: ReadonlyMap<number, string>, lineNumber: number): EnclosingBlock {
    let bracketBalance = 0;
    for (let candidateLine = lineNumber - 1; lineTexts.has(candidateLine); candidateLine -= 1) {
        const candidateText = lineTexts.get(candidateLine) ?? '';
        const netOpenings = countBrackets(candidateText, /[{[]/g) - countBrackets(candidateText, /[}\]]/g);
        if (netOpenings + bracketBalance > 0) {
            return { visibility: 'visible', key: BLOCK_OPENING_KEY.exec(candidateText)?.[1] ?? null };
        }
        bracketBalance += netOpenings;
    }
    return { visibility: 'hidden' };
}

function countBrackets(lineText: string, bracketPattern: RegExp): number {
    return lineText.match(bracketPattern)?.length ?? 0;
}

const PACKAGE_NAME_FIELD = /^\s*"name"\s*:\s*"([^"]+)"/m;

/** `name` eines package.json-Texts (erstes Vorkommen), für die Workspace-Erkennung. */
export function readPackageJsonName(manifestText: string): string | null {
    return PACKAGE_NAME_FIELD.exec(manifestText)?.[1] ?? null;
}
