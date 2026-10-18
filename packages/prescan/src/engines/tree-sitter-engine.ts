/**
 * tree-sitter-Engine — WASM-Grammatiken (web-tree-sitter), lazy geladen,
 * Parser-Instanzen im Modul-Scope gecacht (Vercel Warm-Invocations, §7.6).
 *
 * Grammatik-Quelle sind die prebuilt WASMs aus `tree-sitter-wasms` — bewusst
 * KEINE vendorten Binaries im Repo; Vercel traced sie via
 * outputFileTracingIncludes (next.config.ts).
 */
import { existsSync } from 'node:fs';
import * as nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { Language, Parser } from 'web-tree-sitter';
import { collectCodeExecutionFindings } from '../rules/ast/code-execution-rules';
import { collectComplexityFindings } from '../rules/ast/complexity-rules';
import { collectCorrectnessFindings } from '../rules/ast/correctness-rules';
import { collectExceptionFindings } from '../rules/ast/exception-rules';
import { collectLexicalFindings } from '../rules/ast/lexical-rules';
import { collectReactFindings } from '../rules/ast/react-rules';
import { collectSecurityFindings } from '../rules/ast/security-rules';
import { collectTestFindings } from '../rules/ast/test-rules';
import { collectTypeCapitulationFindings } from '../rules/ast/type-rules';
import { buildWantedNodeTypes, collectNodesByType, nodeTextFiltersFor } from '../rules/ast/ast-shared';
import type { PrescanLanguage } from '../language';
import type { AstRuleContext } from '../rules/ast/ast-shared';
import type { PrescanFinding } from '../types';

const GRAMMAR_FILE_BY_LANGUAGE: Readonly<Partial<Record<PrescanLanguage, string>>> = {
    typescript: 'tree-sitter-typescript.wasm',
    tsx: 'tree-sitter-tsx.wasm',
    javascript: 'tree-sitter-javascript.wasm',
    python: 'tree-sitter-python.wasm',
    java: 'tree-sitter-java.wasm',
    go: 'tree-sitter-go.wasm',
    rust: 'tree-sitter-rust.wasm',
    c: 'tree-sitter-c.wasm',
    cpp: 'tree-sitter-cpp.wasm',
};

let parserInitPromise: Promise<void> | null = null;
const languageCache = new Map<PrescanLanguage, Promise<Language>>();

function ensureParserInitialized(): Promise<void> {
    parserInitPromise ??= Parser.init();
    return parserInitPromise;
}

function loadGrammar(language: PrescanLanguage, grammarFile: string): Promise<Language> {
    const cachedLanguage = languageCache.get(language);
    if (cachedLanguage) return cachedLanguage;

    const languagePromise = Language.load(resolveGrammarPath(grammarFile));
    languageCache.set(language, languagePromise);
    return languagePromise;
}

/**
 * Grammatik-Pfad rein über das Dateisystem auflösen — bewusst KEIN
 * require.resolve mit Template-String: Turbopack würde das Verzeichnis
 * globben und jede WASM als ES-Modul zu bundeln versuchen (199 Build-Fehler).
 */
function resolveGrammarPath(grammarFile: string): string {
    const packageRelativeRoot = nodePath.resolve(
        nodePath.dirname(fileURLToPath(import.meta.url)),
        '../../..', 'node_modules', 'tree-sitter-wasms', 'out',
    );
    const candidateRoots = [
        nodePath.join(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out'),
        packageRelativeRoot,
    ];

    for (const candidateRoot of candidateRoots) {
        const grammarPath = nodePath.join(candidateRoot, grammarFile);
        if (existsSync(grammarPath)) return grammarPath;
    }
    throw new Error(`tree-sitter grammar not found: ${grammarFile} (searched: ${candidateRoots.join(', ')})`);
}

export interface TreeSitterEngineInput {
    readonly path: string;
    readonly language: PrescanLanguage;
    readonly source: string;
    readonly isTestFile: boolean;
}

/**
 * Parst die Datei und lässt alle AST-Regel-Module über die Node-Buckets
 * laufen. Wirft bei Grammatik-/Parse-Fehlern — der Aufrufer (runPrescan)
 * fängt pro Datei×Engine und protokolliert in skippedChecks (§7.5).
 */
export async function runTreeSitterEngine(input: TreeSitterEngineInput): Promise<PrescanFinding[]> {
    const grammarFile = GRAMMAR_FILE_BY_LANGUAGE[input.language];
    if (!grammarFile) return [];

    await ensureParserInitialized();
    const grammar = await loadGrammar(input.language, grammarFile);

    const parser = new Parser();
    try {
        parser.setLanguage(grammar);
        const tree = parser.parse(input.source);
        if (!tree) {
            throw new Error(`tree-sitter returned no tree for ${input.path}`);
        }

        try {
            const wantedNodeTypes = buildWantedNodeTypes(input.language);
            const context: AstRuleContext = {
                path: input.path,
                language: input.language,
                source: input.source,
                isTestFile: input.isTestFile,
                nodesByType: collectNodesByType(tree.rootNode, wantedNodeTypes, nodeTextFiltersFor(input.language)),
                wantedNodeTypes,
                findings: [],
            };

            collectExceptionFindings(context);
            collectComplexityFindings(context);
            collectSecurityFindings(context);
            collectCodeExecutionFindings(context);
            collectTestFindings(context);
            collectReactFindings(context);
            collectCorrectnessFindings(context);
            collectTypeCapitulationFindings(context);
            collectLexicalFindings(context);
            return context.findings;
        } finally {
            tree.delete();
        }
    } finally {
        parser.delete();
    }
}
