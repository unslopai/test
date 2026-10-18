/**
 * COND-002 (Type Capitulation) und COND-003 (Lexical Slop) als AST-Regeln:
 * positive und negative Snippets je Verhalten. Anlass und Fundstellen:
 * unslopai/test#30 und #36 (docs/benchmarks/LARGE_PR_CAMPAIGN.md §4).
 */
import { describe, expect, it } from 'vitest';
import { runTreeSitterEngine } from './tree-sitter-engine';
import type { PrescanLanguage } from '../language';
import type { PrescanFinding } from '../types';

interface ScanOptions {
    readonly language?: PrescanLanguage;
    readonly path?: string;
    readonly isTestFile?: boolean;
}

async function scanForRule(ruleId: string, sourceLines: readonly string[], options: ScanOptions = {}): Promise<PrescanFinding[]> {
    const astFindings = await runTreeSitterEngine({
        path: options.path ?? 'src/adapter/handler.ts',
        language: options.language ?? 'typescript',
        source: sourceLines.join('\n'),
        isTestFile: options.isTestFile ?? false,
    });
    return astFindings.filter((finding) => finding.ruleId === ruleId);
}

function linesOf(findings: readonly PrescanFinding[]): number[] {
    return findings.map((finding) => finding.line);
}

describe('COND-002 — type capitulation (TS/TSX)', () => {
    it('flags explicit any in annotations, generic arguments, casts and type-parameter defaults', async () => {
        const anyFindings = await scanForRule('COND-002', [
            'export const handle = (app: Hono<any, any>) => app;',
            'function readContext(context: any): string { return String(context); }',
            'const legacyPayload = JSON.parse(rawBody) as any;',
            'type Callback<TResult = any> = (callbackValue: TResult) => void;',
            'const anyone = company.any;',
        ]);

        expect(linesOf(anyFindings)).toEqual([1, 1, 2, 3, 4]);
        expect(anyFindings[0].severity).toBe('WARNING');
        expect(anyFindings[2].exactQuote).toBe('function readContext(context: any): string { return String(context); }');
    });

    it('flags @ts-ignore, @ts-nocheck and a bare @ts-expect-error, but not one with a reason', async () => {
        const directiveFindings = await scanForRule('COND-002', [
            '// @ts-nocheck',
            '// @ts-ignore',
            'import manifest from "__STATIC_CONTENT_MANIFEST";',
            '// @ts-expect-error',
            'registerAsset(manifest);',
            '/* @ts-expect-error */',
            'registerAsset(manifest);',
            '// @ts-expect-error WebSocketPair is not typed',
            'const socketPair = new WebSocketPair();',
            '// We avoid @ts-ignore in this module.',
        ]);

        expect(linesOf(directiveFindings)).toEqual([1, 2, 4, 6]);
    });

    it('flags the directives in JavaScript files as well', async () => {
        const directiveFindings = await scanForRule('COND-002', [
            '// @ts-ignore',
            'const assetManifest = require("./manifest.json");',
        ], { language: 'javascript', path: 'src/assets.js' });

        expect(linesOf(directiveFindings)).toEqual([1]);
    });

    it('flags `as unknown as`, also across parentheses, and leaves a single cast to unknown alone', async () => {
        const castFindings = await scanForRule('COND-002', [
            'const assetStream = content as unknown as ReadableStream;',
            'const edgeEvent = (rawEvent as unknown) as CloudFrontEdgeEvent;',
            'const opaquePayload = rawEvent as unknown;',
            'function narrow(untrustedInput: unknown): string { return String(untrustedInput); }',
            'const forcedEvent = (rawEvent as unknown)! as CloudFrontEdgeEvent;',
        ]);

        expect(linesOf(castFindings)).toEqual([1, 2, 5]);
    });

    it('reads directives in TSX and with a long reason, and quotes the hit on a long line', async () => {
        const longReason = 'the upstream typings lag behind the runtime. '.repeat(12);
        const tsxFindings = await scanForRule('COND-002', [
            'export function AssetBadge() {',
            '  return (<span>{/* @ts-ignore */}<Badge tone={7} /></span>);',
            '}',
            `// @ts-ignore ${longReason}`,
            `const padding = "${'x'.repeat(300)}"; const looseValue: any = 1;`,
        ], { language: 'tsx', path: 'src/AssetBadge.tsx' });

        expect(linesOf(tsxFindings)).toEqual([2, 4, 5]);
        expect(tsxFindings[2].exactQuote).toContain('looseValue: any');
    });

    it('reports test files too: THE LAW applies to tests', async () => {
        const testFileFindings = await scanForRule('COND-002', [
            'const sendRef: Promise<any> = new Promise((resolve) => resolve(undefined));',
        ], { path: 'src/websocket.test.ts', isTestFile: true });

        expect(linesOf(testFileFindings)).toEqual([1]);
    });
});

describe('COND-003 — generic names on newly introduced bindings (JS/TS)', () => {
    it('flags generic variables, parameters of author-defined functions and `e` in catch', async () => {
        const namingFindings = await scanForRule('COND-003', [
            'export async function loadRetryBudget(accountId: string, item: BudgetRow): Promise<number> {',
            '    try {',
            '        const data = await fetchBudget(accountId);',
            '        let temp1 = data.remaining;',
            '        return temp1 + item.bonus;',
            '    } catch (e) {',
            '        throw new Error(`budget lookup failed: ${String(e)}`);',
            '    }',
            '}',
            'const toLabel = (result: BudgetRow) => result.label;',
            'class BudgetStore { save(data: BudgetRow): void { persist(data); } }',
        ]);

        expect(linesOf(namingFindings)).toEqual([1, 3, 4, 6, 10, 11]);
        expect(namingFindings[1].explanation).toContain('`data`');
        expect(namingFindings[1].severity).toBe('WARNING');
    });

    it('flags plain JavaScript parameters and variables', async () => {
        const namingFindings = await scanForRule('COND-003', [
            'function summarize(data) {',
            '    var result = data.length;',
            '    return result;',
            '}',
        ], { language: 'javascript', path: 'lib/summarize.js' });

        expect(linesOf(namingFindings)).toEqual([1, 2]);
    });

    it('treats default and rest parameters and CommonJS exports alike in JS and TS', async () => {
        const javascriptFindings = await scanForRule('COND-003', [
            'function withDefault(data = {}, ...result) { return [data, result]; }',
            'module.exports = function (item) { return item; };',
            'exports.run = (data) => data;',
            'socket.onmessage = function (data) { consume(data); };',
            'function pick(chosen = data) { return chosen; }',
        ], { language: 'javascript', path: 'lib/defaults.js' });
        const typescriptFindings = await scanForRule('COND-003', [
            'function withDefault(data = {}, ...result: string[]) { return [data, result]; }',
        ]);

        expect(linesOf(javascriptFindings)).toEqual([1, 1, 2, 3]);
        expect(linesOf(typescriptFindings)).toEqual([1, 1]);
    });

    it('ignores ambient declarations and names with more than two digits', async () => {
        const ambientFindings = await scanForRule('COND-003', [
            'declare const data: BudgetRow;',
            'declare module "budget-kit" { const result: string; export function publish(item: BudgetRow): void; }',
            'const item123456 = loadBudget();',
        ], { path: 'src/types/vendor.d.ts' });

        expect(ambientFindings).toEqual([]);
    });

    it('stays silent where the name belongs to a foreign API or a convention', async () => {
        const conventionFindings = await scanForRule('COND-003', [
            'const { data, error } = await supabase.from("budgets").select("remaining");',
            'const [item] = budgetRows;',
            'const remaining = response.data.result;',
            'const payload = { data: remaining, result: 1 };',
            'budgetRows.map((item) => item.remaining);',
            'socket.on("data", (data) => consume(data));',
            'fetchBudget().then(function (result) { consume(result); });',
            'const query = useQuery({ onSuccess: (data) => consume(data) });',
            'form.addEventListener("submit", (e) => e.preventDefault());',
            'const onSubmit = (e: SubmitEvent) => e.preventDefault();',
            'for (const item of budgetRows) consume(item);',
            'interface BudgetSink { write(data: BudgetRow): void }',
            'declare function publish(result: BudgetRow): void;',
            'const metadata = loadMetadata();',
            'const resultSet = loadResultSet();',
        ]);

        expect(conventionFindings).toEqual([]);
    });

    it('does not report test files', async () => {
        const testFileFindings = await scanForRule('COND-003', [
            'const data = buildFixture();',
        ], { path: 'src/budget.test.ts', isTestFile: true });

        expect(testFileFindings).toEqual([]);
    });

    it('does not report helpers under a test directory that isTestFile misses', async () => {
        const helperFindings = await scanForRule('COND-003', [
            'const result = await resolveAllowScripts(registryClient);',
        ], { language: 'javascript', path: 'workspaces/arborist/test/unreviewed-scripts.js' });

        expect(helperFindings).toEqual([]);
    });
});

describe('COND-002/003 — only JS/TS', () => {
    it('ignores Python sources', async () => {
        const pythonSource = ['data = load()  # @ts-ignore', 'result = data'];
        const typeFindings = await scanForRule('COND-002', pythonSource, { language: 'python', path: 'svc/loader.py' });
        const namingFindings = await scanForRule('COND-003', pythonSource, { language: 'python', path: 'svc/loader.py' });

        expect([...typeFindings, ...namingFindings]).toEqual([]);
    });
});
