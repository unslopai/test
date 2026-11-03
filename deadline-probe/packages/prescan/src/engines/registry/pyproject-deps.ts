/**
 * pyproject.toml-Dependencies für die Registry-Engine (SEC-035, v4).
 *
 * Ein zeilenweiser TOML-Scanner statt eines vollen Parsers: Tabellen-Header,
 * Array-Kontexte über Zeilengrenzen und Poetry-Tabellen reichen, um jede
 * Dependency-Deklaration einer Zeile zuzuordnen. Kandidaten entstehen nur
 * für Added Lines — Kontextzeilen liefern den Tabellen-/Array-Zustand.
 *
 * Abgedeckt: PEP 621 (`[project] dependencies`, `[project.optional-dependencies]`),
 * PEP 735 (`[dependency-groups]`), `[build-system] requires`, Poetry
 * (`[tool.poetry.dependencies]`, `dev-dependencies`, `group.<x>.dependencies`),
 * uv (`[tool.uv] dev-dependencies`) und PDM (`[tool.pdm.dev-dependencies]`).
 */

export interface PyprojectCandidate {
    readonly line: number;
    readonly lineText: string;
    readonly packageName: string;
}

const TABLE_HEADER = /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(?:#.*)?$/;
const KEY_ASSIGNMENT = /^\s*("[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)\s*=\s*(.*)$/;
const QUOTED_STRING = /"((?:[^"\\]|\\.)*)"|'([^']*)'/g;
const INLINE_TABLE = /\{[^}]*\}/g;
const PEP_508_NAME = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/;
const POETRY_DEPENDENCY_TABLE = /^tool\.poetry\.(dependencies|dev-dependencies|group\.[^.]+\.dependencies)$/;
const POETRY_NON_PACKAGE_KEYS: ReadonlySet<string> = new Set(['python']);

/** Tabellen, in denen JEDER Schlüssel ein Array von Requirement-Strings ist. */
const ARRAY_PER_KEY_TABLES: ReadonlySet<string> = new Set([
    'project.optional-dependencies',
    'dependency-groups',
    'tool.pdm.dev-dependencies',
]);

/** Tabelle → Schlüssel, dessen Wert ein Array von Requirement-Strings ist. */
const ARRAY_KEYS_BY_TABLE: ReadonlyMap<string, ReadonlySet<string>> = new Map([
    ['project', new Set(['dependencies'])],
    ['build-system', new Set(['requires'])],
    ['tool.uv', new Set(['dev-dependencies'])],
]);

interface ScanState {
    currentTable: string;
    /** Offenes Requirement-Array über mehrere Zeilen. */
    inRequirementArray: boolean;
}

export function extractPyprojectCandidates(
    lineTexts: ReadonlyMap<number, string>,
    addedLines: ReadonlySet<number>,
): PyprojectCandidate[] {
    const orderedLines = [...lineTexts.keys()].sort((left, right) => left - right);
    const scanState: ScanState = { currentTable: '', inRequirementArray: false };
    const candidates: PyprojectCandidate[] = [];

    for (const lineNumber of orderedLines) {
        const lineText = lineTexts.get(lineNumber) ?? '';
        const lineCandidates = scanLine(scanState, lineText);
        if (!addedLines.has(lineNumber)) continue;
        for (const packageName of lineCandidates) candidates.push({ line: lineNumber, lineText, packageName });
    }
    return candidates;
}

/** Aktualisiert den Zustand und liefert die Package-Namen dieser Zeile. */
function scanLine(scanState: ScanState, lineText: string): string[] {
    const headerMatch = TABLE_HEADER.exec(lineText);
    if (headerMatch) {
        scanState.currentTable = headerMatch[1].trim();
        scanState.inRequirementArray = false;
        return [];
    }
    if (scanState.inRequirementArray) {
        if (bracketBalance(lineText) < 0) scanState.inRequirementArray = false;
        return requirementNamesIn(lineText);
    }

    const assignmentMatch = KEY_ASSIGNMENT.exec(lineText);
    if (!assignmentMatch) return [];
    const key = assignmentMatch[1].replace(/^["']|["']$/g, '');
    const valueText = assignmentMatch[2];

    if (POETRY_DEPENDENCY_TABLE.test(scanState.currentTable)) {
        return POETRY_NON_PACKAGE_KEYS.has(key) ? [] : [key];
    }
    if (!isRequirementArrayKey(scanState.currentTable, key)) return [];

    const opensArray = valueText.trimStart().startsWith('[');
    if (!opensArray) return [];
    scanState.inRequirementArray = bracketBalance(valueText) > 0;
    return requirementNamesIn(valueText);
}

function isRequirementArrayKey(table: string, key: string): boolean {
    return ARRAY_PER_KEY_TABLES.has(table) || (ARRAY_KEYS_BY_TABLE.get(table)?.has(key) ?? false);
}

/** Öffnende minus schließende eckige Klammern der Zeile; Klammern in Strings zählen nicht. */
function bracketBalance(lineText: string): number {
    const withoutStrings = lineText.replace(QUOTED_STRING, '""');
    const opening = (withoutStrings.match(/\[/g) ?? []).length;
    const closing = (withoutStrings.match(/\]/g) ?? []).length;
    return opening - closing;
}

/** Requirement-Strings der Zeile; Inline-Tables (`{ include-group = "dev" }`) sind keine Packages. */
function requirementNamesIn(lineText: string): string[] {
    const names: string[] = [];
    for (const stringMatch of lineText.replace(INLINE_TABLE, '').matchAll(QUOTED_STRING)) {
        const requirement = stringMatch[1] ?? stringMatch[2] ?? '';
        const nameMatch = PEP_508_NAME.exec(requirement);
        if (nameMatch) names.push(nameMatch[1]);
    }
    return names;
}
