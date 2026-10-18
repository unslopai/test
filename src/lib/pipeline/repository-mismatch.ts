/**
 * Condition 12 „Repository Mismatch“ (REPO_CONTEXT_SPEC §7.1): Befunde, die
 * nur gegen eine Datei des Kontextpakets belegbar sind.
 *
 * Die Condition steht in der Registry (und damit im Cache-Prefix), ihr
 * Schalter ist aber das Kontextpaket selbst: ohne Paket fällt jeder Befund an
 * dieser Boundary. Jeder Befund nennt die Kontextdatei, auf die er sich
 * stützt; sie muss im Paket des Calls liegen. Schweregrad nach §7.1: CRITICAL
 * nur, wenn das Paket die betreffende Dateiart vollständig zeigt; „Zustand im
 * Speicher“ und „zweite Datenbank“ sind immer WARNING, weil sie eine
 * Entwurfsentscheidung sein können.
 */
import { findContextSection, isContextKindComplete } from '@unslop/shared/repo-context';
import type { RepoContextPackage, RepoContextSection, RepoContextSectionKind } from '@unslop/shared/repo-context';
import type { PipelineIssue, RepositoryMismatchEvidence, RepositoryMismatchKind } from '@/lib/pipeline/types';

export const REPOSITORY_MISMATCH_CONDITION_ID = 'COND-012';

/** Rule-String, den Draft, Validierung und Verifier führen. */
export const REPOSITORY_MISMATCH_RULE_LABEL = 'Condition 12 (Repository Mismatch)';

const REPOSITORY_MISMATCH_RULE_PATTERN = /^Condition 12\b/;

export const REPOSITORY_MISMATCH_KINDS: readonly RepositoryMismatchKind[] = [
    'schema', 'manifest', 'removed_api', 'unloaded_entry', 'in_memory_state', 'second_database',
];

/** Welche Dateiart des Pakets einen Befund dieser Art trägt (Vollständigkeits-Prüfung). */
const PROVING_SECTION_KIND: Readonly<Record<RepositoryMismatchKind, RepoContextSectionKind>> = {
    schema: 'schema',
    manifest: 'manifest',
    removed_api: 'manifest',
    unloaded_entry: 'entry_point',
    in_memory_state: 'schema',
    second_database: 'manifest',
};

/** Arten, die eine Entwurfsentscheidung sein können: nie CRITICAL (Spec §7.1). */
const ALWAYS_WARNING_KINDS: ReadonlySet<RepositoryMismatchKind> = new Set(['in_memory_state', 'second_database']);

/** Fällt `mismatch_kind` aus, entscheidet die Art der zitierten Datei; eine Aufrufer-Liste oder der Dateibaum belegen nichts. */
const DEFAULT_KIND_BY_SECTION: Partial<Record<RepoContextSectionKind, RepositoryMismatchKind>> = {
    schema: 'schema',
    manifest: 'manifest',
    entry_point: 'unloaded_entry',
};

export function isRepositoryMismatchRule(ruleReference: string): boolean {
    return REPOSITORY_MISMATCH_RULE_PATTERN.test(ruleReference);
}

function isRepositoryMismatchKind(rawKind: unknown): rawKind is RepositoryMismatchKind {
    return typeof rawKind === 'string' && REPOSITORY_MISMATCH_KINDS.some((knownKind) => knownKind === rawKind);
}

/**
 * Das Modell zitiert den Pfad meist exakt, gelegentlich mit der `[kind]`-Marke
 * des Headers davor. Ohne exakten Treffer gewinnt der längste enthaltene Pfad:
 * `services/auth/package.json` enthält auch `package.json` der Wurzel.
 */
function resolveCitedSection(contextPackage: RepoContextPackage, citedPath: string): RepoContextSection | null {
    const exactSection = findContextSection(contextPackage, citedPath.trim());
    if (exactSection) return exactSection;
    const containedSections = contextPackage.sections
        .filter((contextSection) => citedPath.includes(contextSection.path))
        .sort((first, second) => second.path.length - first.path.length);
    return containedSections[0] ?? null;
}

/** Modell-Rohwerte eines Issues (`context_path`, `mismatch_kind`) an der Validation-Boundary [ARCH-002]. */
export interface RawMismatchFields {
    readonly contextPath: unknown;
    readonly mismatchKind: unknown;
}

function resolveEvidence(
    rawFields: RawMismatchFields,
    contextPackage: RepoContextPackage | null,
): RepositoryMismatchEvidence | null {
    if (!contextPackage || typeof rawFields.contextPath !== 'string') return null;
    const citedSection = resolveCitedSection(contextPackage, rawFields.contextPath);
    if (!citedSection) return null;
    const mismatchKind = isRepositoryMismatchKind(rawFields.mismatchKind)
        ? rawFields.mismatchKind
        : DEFAULT_KIND_BY_SECTION[citedSection.kind];
    // Die Art muss zur zitierten Datei passen: ein Manifest belegt keine fehlende
    // Tabelle, ein Dateibaum oder eine Aufrufer-Liste belegen gar nichts.
    if (!mismatchKind || PROVING_SECTION_KIND[mismatchKind] !== citedSection.kind) return null;
    return { contextPath: citedSection.path, mismatchKind };
}

/**
 * Validation-Boundary für EIN Issue. Andere Regeln passieren unverändert.
 * Ein Condition-12-Issue ohne belegbare Kontextdatei im Paket dieses Calls
 * wird verworfen (null); sonst trägt es die Evidenz, den festen Rule-String
 * und höchstens den Schweregrad, den §7.1 erlaubt.
 */
export function resolveRepositoryMismatchIssue(
    issue: PipelineIssue,
    rawFields: RawMismatchFields,
    contextPackage: RepoContextPackage | null,
): PipelineIssue | null {
    if (!isRepositoryMismatchRule(issue.rule)) return issue;
    const mismatchEvidence = resolveEvidence(rawFields, contextPackage);
    if (!mismatchEvidence || !contextPackage) return null;

    const mayBeCritical = !ALWAYS_WARNING_KINDS.has(mismatchEvidence.mismatchKind)
        && isContextKindComplete(contextPackage, PROVING_SECTION_KIND[mismatchEvidence.mismatchKind]);
    return {
        ...issue,
        rule: REPOSITORY_MISMATCH_RULE_LABEL,
        severity: issue.severity === 'CRITICAL' && mayBeCritical ? 'CRITICAL' : 'WARNING',
        repoMismatch: mismatchEvidence,
    };
}

/**
 * Aggregations-Schlüssel: zwei Mismatch-Befunde derselben Datei gegen
 * verschiedene Kontextdateien oder Arten sind verschiedene Claims mit
 * verschiedenen Prüffragen und dürfen nicht zu einem Finding verschmelzen.
 */
export function repositoryMismatchGroupKey(issue: PipelineIssue): string | null {
    return issue.repoMismatch ? `${issue.repoMismatch.mismatchKind}\0${issue.repoMismatch.contextPath}` : null;
}

// =============================================================================
// Feste Verifier-Fragen (Spec §7.1: am Ausschnitt beantwortbar)
// =============================================================================

const VERIFICATION_QUESTIONS: Readonly<Record<RepositoryMismatchKind, string>> = {
    schema:
        'Does the code quoted at {path}:{line} read or write a database table or column that the schema excerpt '
        + '"{contextPath}" under REPOSITORY CONTEXT EXCERPTS does not define? Answer CONFIRMED if the excerpt defines '
        + 'no table or column of that name and no other shown schema excerpt does. Answer REFUTED if a shown excerpt '
        + 'defines it. Answer UNCERTAIN if the quoted code names no table or column, if the excerpt is not shown, or '
        + 'if the excerpts say that schema files are not shown.',
    manifest:
        'Does the code quoted at {path}:{line} import or require a third-party package that the manifest excerpt '
        + '"{contextPath}" under REPOSITORY CONTEXT EXCERPTS does not declare? Answer CONFIRMED if no dependency list '
        + 'of any shown manifest excerpt declares it. Answer REFUTED if one declares it (also under a distribution '
        + 'name that differs from the import name, such as "pyyaml" for "yaml"), or if the import is a '
        + 'standard-library, built-in or relative module, a path alias (such as "@/…", "~/…" or "#…") or a package '
        + 'of the same workspace. Answer UNCERTAIN if the quoted code imports nothing or the excerpt is not shown.',
    removed_api:
        'Does the code quoted at {path}:{line} call an API that the major version of its package pinned in the '
        + 'manifest excerpt "{contextPath}" under REPOSITORY CONTEXT EXCERPTS no longer provides? Answer CONFIRMED only '
        + 'if you are certain that this major version removed the API. Answer REFUTED if that version still provides '
        + 'it. Answer UNCERTAIN in every other case.',
    unloaded_entry:
        'Judging from the entry point excerpt "{contextPath}" under REPOSITORY CONTEXT EXCERPTS: does the code quoted '
        + 'at {path}:{line} start its own server, or define a route, handler or module, that this entry point never '
        + 'loads? Answer CONFIRMED if the excerpt neither imports nor mounts the changed file and the quoted code '
        + 'stands up its own listener or an unmounted route. Answer REFUTED if the excerpt loads it. Answer UNCERTAIN '
        + 'if the excerpt is not the entry point of that file\'s service or is not shown.',
    in_memory_state:
        'Does the code quoted at {path}:{line} keep application data (such as users, tokens or orders) in process '
        + 'memory although the schema excerpt "{contextPath}" under REPOSITORY CONTEXT EXCERPTS defines a table for '
        + 'that data? Answer CONFIRMED if the excerpt has a table for it and the quoted code stores it in a variable, '
        + 'map or array instead. Answer REFUTED if the excerpt has no such table or the quoted code is not long-lived '
        + 'state. Answer UNCERTAIN if you cannot tell.',
    second_database:
        'Does the code quoted at {path}:{line} introduce a database or database driver other than the one the '
        + 'excerpt "{contextPath}" under REPOSITORY CONTEXT EXCERPTS shows this repository already uses? Answer '
        + 'CONFIRMED if the excerpt shows a different database or driver in use. Answer REFUTED if it is the same one '
        + 'or the excerpt shows none. Answer UNCERTAIN if you cannot tell.',
};

/** null = kein Mismatch-Issue; sonst die feste Frage mit Fundort und Kontextdatei. */
export function buildRepositoryMismatchQuestion(issue: PipelineIssue): string | null {
    if (!issue.repoMismatch) return null;
    const { contextPath, mismatchKind } = issue.repoMismatch;
    // Ersetzungsfunktionen: Pfade sind Fremdtext, `$&` oder `{line}` darin dürfen nichts auslösen.
    const placeholderValues: Readonly<Record<string, string>> = {
        '{path}': issue.path,
        '{line}': String(issue.line),
        '{contextPath}': contextPath,
    };
    return VERIFICATION_QUESTIONS[mismatchKind].replace(
        /\{path\}|\{line\}|\{contextPath\}/g,
        (placeholder) => placeholderValues[placeholder] ?? placeholder,
    );
}

/** Abschnittsart, an der die feste Frage eines Befunds dieser Art zu beantworten ist. */
export function provingSectionKind(mismatchKind: RepositoryMismatchKind): RepoContextSectionKind {
    return PROVING_SECTION_KIND[mismatchKind];
}
