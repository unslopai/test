/**
 * tree-sitter-Engine-Tests — AST-Regeln gegen Fixture-Snippets
 * (positiv + negativ) über alle v1-Sprachen (pre_scanner_design.md §8).
 */
import { describe, expect, it } from 'vitest';
import { runTreeSitterEngine } from './tree-sitter-engine';
import type { PrescanLanguage } from '../language';

async function scanSource(language: PrescanLanguage, source: string, options: { isTestFile?: boolean; path?: string } = {}) {
    return runTreeSitterEngine({
        path: options.path ?? `fixture.${language}`,
        language,
        source,
        isTestFile: options.isTestFile ?? false,
    });
}

function ruleIdsOf(findings: readonly { ruleId: string }[]): string[] {
    return findings.map((finding) => finding.ruleId);
}

describe('MAINT-001/002 — exception swallowing', () => {
    it('flags empty catch (TS) as MAINT-001 and silent catch as MAINT-002', async () => {
        const emptyCatchFindings = await scanSource('typescript',
            'try { risky(); } catch (caughtError) {}');
        expect(ruleIdsOf(emptyCatchFindings)).toContain('MAINT-001');

        const silentCatchFindings = await scanSource('typescript',
            'try { risky(); } catch (caughtError) { fallbackValue = 1; }');
        expect(ruleIdsOf(silentCatchFindings)).toContain('MAINT-002');
    });

    it('accepts catch blocks that log or rethrow (TS)', async () => {
        const loggedCatch = await scanSource('typescript',
            'try { risky(); } catch (caughtError) { console.error("risky failed", caughtError); }');
        const rethrownCatch = await scanSource('typescript',
            'try { risky(); } catch (caughtError) { throw new Error("wrapped"); }');
        expect(ruleIdsOf(loggedCatch)).not.toContain('MAINT-001');
        expect(ruleIdsOf(loggedCatch)).not.toContain('MAINT-002');
        expect(ruleIdsOf(rethrownCatch)).not.toContain('MAINT-002');
    });

    it('accepts a catch that surfaces the caught error (TS, live FP unslopai/test#14)', async () => {
        const surfacedCatch = await scanSource('tsx',
            'try { risky(); } catch (err) { setError(err instanceof Error ? err.message : String(err)); }');
        expect(ruleIdsOf(surfacedCatch)).not.toContain('MAINT-002');

        const unusedParameterCatch = await scanSource('typescript',
            'try { risky(); } catch (err) { return null; }');
        expect(ruleIdsOf(unusedParameterCatch)).toContain('MAINT-002');
    });

    it('flags pass-only except (Python) as MAINT-001 and broad except as MAINT-002', async () => {
        const passOnlyFindings = await scanSource('python',
            'try:\n    risky()\nexcept Exception:\n    pass\n');
        expect(ruleIdsOf(passOnlyFindings)).toContain('MAINT-001');

        const broadExceptFindings = await scanSource('python',
            'try:\n    risky()\nexcept Exception:\n    fallback_value = 1\n');
        expect(ruleIdsOf(broadExceptFindings)).toContain('MAINT-002');

        const narrowLoggedFindings = await scanSource('python',
            'try:\n    risky()\nexcept ValueError as lookup_error:\n    logger.warning(lookup_error)\n');
        expect(ruleIdsOf(narrowLoggedFindings)).toHaveLength(0);
    });

    it('flags empty catch (Java) and .unwrap() after crypto (Rust)', async () => {
        const javaFindings = await scanSource('java',
            'class Demo { void run() { try { risky(); } catch (Exception ignored) {} } }');
        expect(ruleIdsOf(javaFindings)).toContain('MAINT-001');

        const rustFindings = await scanSource('rust',
            'fn seal(payload: &[u8]) { let ciphertext = cipher.encrypt(nonce, payload).unwrap(); }');
        expect(ruleIdsOf(rustFindings)).toContain('MAINT-002');

        const rustCleanFindings = await scanSource('rust',
            'fn parse_port(raw_port: &str) -> u16 { raw_port.parse().unwrap() }');
        expect(ruleIdsOf(rustCleanFindings)).not.toContain('MAINT-002');
    });
});

describe('ARCH-001..004 — complexity & structure', () => {
    it('flags a Python function above cognitive complexity 15', async () => {
        const deeplyBranchedFunction = [
            'def route_request(request):',
            ...Array.from({ length: 6 }, (_, branchIndex) => [
                `    if request.kind == ${branchIndex}:`,
                `        if request.priority > ${branchIndex}:`,
                `            if request.retries < ${branchIndex}:`,
                '                handle(request)',
            ]).flat(),
        ].join('\n');
        const complexityFindings = await scanSource('python', deeplyBranchedFunction);
        expect(ruleIdsOf(complexityFindings)).toContain('ARCH-001');
    });

    it('does not flag a flat function (ARCH-001) and skips test files (TEST-010)', async () => {
        const flatFunction = 'def add(first, second):\n    return first + second\n';
        expect(ruleIdsOf(await scanSource('python', flatFunction))).not.toContain('ARCH-001');

        const deeplyBranchedFunction = [
            'def test_routing():',
            ...Array.from({ length: 6 }, (_, branchIndex) => [
                `    if ${branchIndex} == 0:`,
                `        if ${branchIndex} == 1:`,
                `            if ${branchIndex} == 2:`,
                '                assert True',
            ]).flat(),
        ].join('\n');
        const testFileFindings = await scanSource('python', deeplyBranchedFunction,
            { isTestFile: true, path: 'test_routing.py' });
        expect(ruleIdsOf(testFileFindings)).not.toContain('ARCH-001');
        expect(ruleIdsOf(testFileFindings)).not.toContain('ARCH-002');
    });

    it('flags nesting depth > 5 (ARCH-002)', async () => {
        const sixLevelNesting = [
            'function deepDive(input) {',
            '  if (input.a) { if (input.b) { if (input.c) { if (input.d) { if (input.e) { if (input.f) {',
            '    return input;',
            '  } } } } } }',
            '}',
        ].join('\n');
        const nestingFindings = await scanSource('typescript', sixLevelNesting);
        expect(ruleIdsOf(nestingFindings)).toContain('ARCH-002');
    });

    it('does not count a flat else-if chain as nesting (ARCH-002 live FP, unslopai/test#14)', async () => {
        const elseIfChain = [
            'function compute(op) {',
            '  try {',
            "    if (op === 'a') { run(1); }",
            "    else if (op === 'b') { run(2); }",
            "    else if (op === 'c') { run(3); }",
            "    else if (op === 'd') { run(4); }",
            "    else if (op === 'e') { run(5); }",
            "    else if (op === 'f') { run(6); }",
            "    else if (op === 'g') { run(7); }",
            '  } catch (err) { report(err); }',
            '}',
        ].join('\n');
        const chainFindings = await scanSource('typescript', elseIfChain);
        expect(ruleIdsOf(chainFindings)).not.toContain('ARCH-002');
    });

    it('flags functions over 50 logical lines (ARCH-002)', async () => {
        const longFunctionBody = Array.from({ length: 55 }, (_, lineIndex) => `    total += ${lineIndex};`).join('\n');
        const longFunction = `function accumulate() {\n  let total = 0;\n${longFunctionBody}\n  return total;\n}`;
        const lengthFindings = await scanSource('typescript', longFunction);
        expect(ruleIdsOf(lengthFindings)).toContain('ARCH-002');
    });

    it('flags containers nested ≥ 3 (ARCH-003, Python) but not depth 2', async () => {
        const tripleNested = 'ROUTING_TABLE = {"eu": {"berlin": ["fra1", "fra2"]}}';
        expect(ruleIdsOf(await scanSource('python', tripleNested))).toContain('ARCH-003');

        const doubleNested = 'REGION_CODES = {"eu": ["fra1", "fra2"]}';
        expect(ruleIdsOf(await scanSource('python', doubleNested))).not.toContain('ARCH-003');
    });

    it('flags parameter lists over 5 (ARCH-004) across languages, excluding self', async () => {
        const wideJsFunction = 'function configure(host, port, user, password, timeout, retries) {}';
        expect(ruleIdsOf(await scanSource('typescript', wideJsFunction))).toContain('ARCH-004');

        const pythonMethodWithSelf = [
            'class Client:',
            '    def configure(self, host, port, user, password, timeout):',
            '        pass',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('python', pythonMethodWithSelf))).not.toContain('ARCH-004');
    });
});

describe('SEC-004 — SQL interpolation', () => {
    it('flags f-string/format/concat SQL in Python, allows parameterized', async () => {
        const fStringQuery = 'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")';
        expect(ruleIdsOf(await scanSource('python', fStringQuery))).toContain('SEC-004');

        const formatQuery = 'cursor.execute("SELECT * FROM users WHERE id = {}".format(user_id))';
        expect(ruleIdsOf(await scanSource('python', formatQuery))).toContain('SEC-004');

        const parameterizedQuery = 'cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))';
        expect(ruleIdsOf(await scanSource('python', parameterizedQuery))).not.toContain('SEC-004');
    });

    it('flags template-literal and concatenated SQL in TS, allows static strings', async () => {
        const templateQuery = 'await database.query(`SELECT * FROM users WHERE id = ${userId}`);';
        expect(ruleIdsOf(await scanSource('typescript', templateQuery))).toContain('SEC-004');

        const concatenatedQuery = 'await database.query("SELECT * FROM users WHERE name = \'" + userName + "\'");';
        expect(ruleIdsOf(await scanSource('typescript', concatenatedQuery))).toContain('SEC-004');

        const staticQuery = 'await database.query("SELECT * FROM users WHERE id = $1", [userId]);';
        expect(ruleIdsOf(await scanSource('typescript', staticQuery))).not.toContain('SEC-004');
    });

    it('flags string-concatenated SQL in Java', async () => {
        const concatenatedJavaQuery = 'class Dao { void load(String userId) { statement.executeQuery("SELECT * FROM users WHERE id = " + userId); } }';
        expect(ruleIdsOf(await scanSource('java', concatenatedJavaQuery))).toContain('SEC-004');
    });
});

/**
 * r24-Fehlalarm (ROADMAP §1 Nebenbefund a): fünf parametrisierte Queries der
 * Filler-Dateien `product-repository.ts` und `stock-ledger.ts` wurden CRITICAL
 * gemeldet, weil eine modulweite Spaltenlisten-Konstante interpoliert bzw.
 * zwei Literale konkateniert wurden. Die Snippets spiegeln die fünf Fundstellen.
 */
describe('SEC-004 — module-owned text is not an injection (r24 false positive)', () => {
    const productColumnsConstant = "const PRODUCT_COLUMNS = 'product_id, workspace_id, sku, title, status, weight_grams, updated_at';";

    it('accepts a module const column list inside a parameterized template (product-repository.ts:83)', async () => {
        const constantColumnsQuery = [
            productColumnsConstant,
            'export class ProductRepository {',
            '    constructor(private readonly pool: Pool) {}',
            '    async findBySku(workspaceId: string, sku: string) {',
            '        return this.pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE workspace_id = $1 AND sku = $2`, [workspaceId, sku]);',
            '    }',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', constantColumnsQuery))).not.toContain('SEC-004');
    });

    it('accepts the constant template concatenated with literal clauses (product-repository.ts:95 and :100)', async () => {
        const keysetPageQueries = [
            productColumnsConstant,
            'async function listPage(pool: Pool, workspaceId: string, cursorPosition: Cursor | null, pageSize: number) {',
            '    return cursorPosition === null',
            '        ? await pool.query(',
            '            `SELECT ${PRODUCT_COLUMNS} FROM products WHERE workspace_id = $1 ` +',
            "            'ORDER BY updated_at DESC, product_id DESC LIMIT $2',",
            '            [workspaceId, pageSize + 1],',
            '        )',
            '        : await pool.query(',
            '            `SELECT ${PRODUCT_COLUMNS} FROM products WHERE workspace_id = $1 ` +',
            "            'AND (updated_at, product_id) < ($2, $3) ORDER BY updated_at DESC, product_id DESC LIMIT $4',",
            '            [workspaceId, cursorPosition.updatedAt, cursorPosition.productId, pageSize + 1],',
            '        );',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', keysetPageQueries))).not.toContain('SEC-004');
    });

    it('accepts literal-only concatenations (product-repository.ts:149, stock-ledger.ts:71)', async () => {
        const upsertQuery = [
            'const draftUpsert = await transactionClient.query(',
            "    'INSERT INTO products (product_id, workspace_id, sku, title, status, weight_grams, updated_at) ' +",
            '    "VALUES (gen_random_uuid(), $1, $2, $3, \'draft\', $4, now()) " +',
            "    'ON CONFLICT (workspace_id, sku) DO UPDATE SET title = EXCLUDED.title, ' +",
            "    'weight_grams = EXCLUDED.weight_grams, updated_at = now()',",
            '    [workspaceId, productDraft.sku, productDraft.title, productDraft.weightGrams],',
            ');',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', upsertQuery))).not.toContain('SEC-004');

        const ledgerInsert = [
            'await transactionClient.query(',
            "    'INSERT INTO stock_ledger (entry_id, workspace_id, sku, kind, quantity_delta, reference, recorded_at) ' +",
            "    'VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())',",
            '    [entryDraft.workspaceId, entryDraft.sku, entryDraft.kind, entryDraft.quantityDelta, entryDraft.reference],',
            ');',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', ledgerInsert))).not.toContain('SEC-004');
    });

    it('accepts exported, as-const and derived module constants', async () => {
        const derivedConstants = [
            "export const BASE_COLUMNS = 'id, status';",
            "const AUDIT_COLUMNS = 'created_at, updated_at' as const;",
            "const ALL_COLUMNS = BASE_COLUMNS + ', ' + AUDIT_COLUMNS;",
            'export function load(pool: Pool, workspaceId: string) {',
            '    return pool.query(`SELECT ${ALL_COLUMNS} FROM products WHERE workspace_id = $1`, [workspaceId]);',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', derivedConstants))).not.toContain('SEC-004');
    });

    it('still flags user input next to a constant column list', async () => {
        const mixedQuery = [
            productColumnsConstant,
            'export function load(pool: Pool, productId: string) {',
            '    return pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE product_id = ${productId}`);',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', mixedQuery))).toContain('SEC-004');
    });

    it('still flags a let binding and a module const fed from the environment or a call', async () => {
        const mutableBinding = [
            "let tableName = 'products';",
            'export function load(pool: Pool) { return pool.query(`SELECT * FROM ${tableName}`); }',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', mutableBinding))).toContain('SEC-004');

        const environmentConstant = [
            'const tableName = process.env.PRODUCT_TABLE;',
            'export function load(pool: Pool) { return pool.query(`SELECT * FROM ${tableName}`); }',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', environmentConstant))).toContain('SEC-004');

        const computedConstant = [
            'const orderClause = resolveOrderClause();',
            "export function load(pool: Pool) { return pool.query('SELECT * FROM products ' + orderClause); }",
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', computedConstant))).toContain('SEC-004');
    });

    it('still flags a parameter or a local declaration that shadows the module constant', async () => {
        const shadowingParameter = [
            productColumnsConstant,
            'export function load(pool: Pool, PRODUCT_COLUMNS: string) {',
            '    return pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products`);',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', shadowingParameter))).toContain('SEC-004');

        const shadowingDeclaration = [
            productColumnsConstant,
            'export function load(pool: Pool, request: Request) {',
            '    const { PRODUCT_COLUMNS } = request.query;',
            '    return pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products`);',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', shadowingDeclaration))).toContain('SEC-004');
    });
});

describe('SEC-006 — unsafe deserialization', () => {
    it('flags pickle.load, unsafe yaml.load and torch.load without weights_only', async () => {
        const pythonSinks = [
            'payload = pickle.loads(raw_bytes)',
            'config = yaml.load(config_text)',
            'model = torch.load(checkpoint_path)',
        ].join('\n');
        const sinkFindings = await scanSource('python', pythonSinks);
        expect(ruleIdsOf(sinkFindings).filter((ruleId) => ruleId === 'SEC-006')).toHaveLength(3);
    });

    it('accepts safe loaders', async () => {
        const safeLoaders = [
            'config = yaml.load(config_text, Loader=yaml.SafeLoader)',
            'model = torch.load(checkpoint_path, weights_only=True)',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('python', safeLoaders))).not.toContain('SEC-006');
    });

    it('flags ObjectInputStream and enableDefaultTyping in Java', async () => {
        const javaSinks = 'class Loader { void read(InputStream raw) { ObjectInputStream input = new ObjectInputStream(raw); mapper.enableDefaultTyping(); } }';
        const javaFindings = await scanSource('java', javaSinks);
        expect(ruleIdsOf(javaFindings).filter((ruleId) => ruleId === 'SEC-006')).toHaveLength(2);
    });
});

describe('SEC-009 — command injection', () => {
    it('flags subprocess shell=True with non-literal and os.system with variables', async () => {
        const shellTrueCall = 'subprocess.run(f"convert {input_path}", shell=True)';
        expect(ruleIdsOf(await scanSource('python', shellTrueCall))).toContain('SEC-009');

        const osSystemCall = 'os.system("ping " + host_name)';
        expect(ruleIdsOf(await scanSource('python', osSystemCall))).toContain('SEC-009');

        const literalShellCall = 'subprocess.run("ls -la", shell=True)';
        expect(ruleIdsOf(await scanSource('python', literalShellCall))).not.toContain('SEC-009');

        const argumentListCall = 'subprocess.run(["convert", input_path])';
        expect(ruleIdsOf(await scanSource('python', argumentListCall))).not.toContain('SEC-009');
    });

    it('flags child_process.exec with template substitution in TS', async () => {
        const execWithTemplate = [
            "import { exec } from 'child_process';",
            'exec(`convert ${uploadPath}`);',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', execWithTemplate))).toContain('SEC-009');

        const execWithLiteral = [
            "import { exec } from 'child_process';",
            "exec('ls -la');",
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', execWithLiteral))).not.toContain('SEC-009');
    });

    it('flags Runtime.exec and ProcessBuilder with non-literal args in Java', async () => {
        const runtimeExec = 'class Shell { void run(String cmd) { Runtime.getRuntime().exec(cmd); } }';
        expect(ruleIdsOf(await scanSource('java', runtimeExec))).toContain('SEC-009');

        const processBuilder = 'class Shell { void run(String cmd) { new ProcessBuilder(cmd).start(); } }';
        expect(ruleIdsOf(await scanSource('java', processBuilder))).toContain('SEC-009');
    });
});

async function severitiesOf(ruleId: string, language: PrescanLanguage, source: string): Promise<string[]> {
    const findings = await scanSource(language, source);
    return findings.filter((finding) => finding.ruleId === ruleId).map((finding) => finding.severity);
}

describe('SEC-009 — Python program position without shell=True', () => {
    it.each([
        ['shlex.split of a request value (arXiv 2609.12708 "fix")', 'import shlex, subprocess\nsubprocess.call(shlex.split(request.args.get("command")))', ['CRITICAL']],
        ['list whose program is assigned from the request in the same function', 'def convert():\n    tool = request.form["tool"]\n    subprocess.run([tool, "--version"])', ['CRITICAL']],
        ['args= keyword with the program from self.request (class-based view)', 'class RunView:\n    def post(self):\n        subprocess.run(args=[self.request.POST["bin"]])', ['CRITICAL']],
        ['shlex.split of a variable without visible source', 'def run_hook(hook_line):\n    subprocess.run(shlex.split(hook_line))', ['WARNING']],
        ['shlex.split whose only "req." is inside a string literal', 'def run(tool):\n    subprocess.run(shlex.split(f"{tool} --out=req.json"))', ['WARNING']],
    ])('reports %s', async (_caseName, pythonSource, expectedSeverities) => {
        expect(await severitiesOf('SEC-009', 'python', pythonSource)).toEqual(expectedSeverities);
    });

    it.each([
        ['a literal program with non-literal arguments', 'subprocess.run(["git", "log", request.args["ref"]])'],
        ['a bare variable (cannot tell whether it is a safe list)', 'def run(cmd):\n    subprocess.run(cmd)'],
        ['a tool path without visible request source (pip, ffmpeg scripts)', 'def lint(linter_path):\n    subprocess.check_call([linter_path, "-q"])'],
        ['urllib.request, which is no request source', 'def fetch(url):\n    tool = urllib.request.urlopen(url).read()\n    subprocess.run([tool])'],
        ['shlex.split with a literal first word (f-string)', 'subprocess.run(shlex.split(f"git log {request.args[\'ref\']}"))'],
        ['shlex.split with a literal first word (concatenation)', 'subprocess.run(shlex.split("git log " + ref))'],
        ['shlex.split of a literal', 'subprocess.run(shlex.split("ls -la"))'],
        ['shlex.split of a module constant', 'LINT_COMMAND = "ruff check ."\ndef lint():\n    subprocess.run(shlex.split(LINT_COMMAND))'],
        ['shlex.split of a concatenation that starts with complete literals', 'subprocess.run(shlex.split("git" + " log " + ref))'],
        ['shlex.split of an implicit concatenation with a literal first word', 'subprocess.run(shlex.split("git " f"log {ref}"))'],
        ['the pytest request fixture (request.param)', '@pytest.fixture(params=["black", "ruff"])\ndef formatter(request):\n    return subprocess.run([request.param, "--version"])'],
        ['a tool from request.getfixturevalue, one hop', 'def test_tool(request):\n    tool = request.getfixturevalue("tool_path")\n    subprocess.check_call([tool, "--help"])'],
        ['a request assignment in a nested function', 'def outer(editor):\n    def handler(request):\n        editor = request.args["e"]\n    subprocess.run([editor, "file"])'],
        ['module-level code next to a view with the same variable name', 'def view(request):\n    tool = request.args["tool"]\ntool = sys.argv[1]\nsubprocess.run([tool, "--version"])'],
        ['an attribute assignment from the request (self is not tainted)', 'class Export:\n    def post(self, request):\n        self.export_name = request.POST.get("name")\n        subprocess.run([self.pandoc_path, "-o", "out.pdf"])'],
    ])('stays silent on %s', async (_caseName, pythonSource) => {
        expect(await severitiesOf('SEC-009', 'python', pythonSource)).toEqual([]);
    });

    it('keeps exactly one CRITICAL for the shell=True form', async () => {
        expect(await severitiesOf('SEC-009', 'python', 'subprocess.run(f"convert {path}", shell=True)')).toEqual(['CRITICAL']);
    });
});

describe('SEC-009 — Python calls resolved through their imports', () => {
    it.each([
        ['run imported from subprocess with shell=True', 'from subprocess import run\nrun(f"convert {path}", shell=True)', ['CRITICAL']],
        ['subprocess imported as sp with shell=True', 'import subprocess as sp\ndef convert(command):\n    sp.call(command, shell=True)', ['CRITICAL']],
        ['system imported from os', 'from os import system\nsystem("ping " + host_name)', ['CRITICAL']],
        ['split imported from shlex', 'import subprocess\nfrom shlex import split\ndef run_hook(hook_line):\n    subprocess.run(split(hook_line))', ['WARNING']],
        ['renamed Popen and split with a request value', 'from subprocess import Popen as P\nfrom shlex import split as sx\nP(sx(request.args["command"]))', ['CRITICAL']],
        ['os.execvp with a request value as program', 'def launch():\n    tool = request.args["tool"]\n    os.execvp(tool, [tool, "--version"])', ['CRITICAL']],
        ['os.spawnv with a request value as program (after the mode)', 'os.spawnv(os.P_WAIT, request.form["bin"], ["bin"])', ['CRITICAL']],
        ['asyncio.create_subprocess_shell with an f-string', 'async def convert(path):\n    await asyncio.create_subprocess_shell(f"ffmpeg -i {path} out.mp4")', ['CRITICAL']],
        ['asyncio.create_subprocess_exec of shlex.split of a variable', 'async def run_hook(hook_line):\n    await asyncio.create_subprocess_exec(*shlex.split(hook_line))', ['WARNING']],
        ['asyncio.create_subprocess_exec with a request value as program', 'async def probe():\n    await asyncio.create_subprocess_exec(request.args["bin"], "--help")', ['CRITICAL']],
        ['create_subprocess_shell imported from asyncio.subprocess', 'from asyncio.subprocess import create_subprocess_shell\nasync def run(cmd):\n    await create_subprocess_shell(cmd)', ['CRITICAL']],
        ['create_subprocess_shell with cmd= as keyword', 'async def listing(directory):\n    await asyncio.create_subprocess_shell(cmd=f"ls {directory}")', ['CRITICAL']],
        ['module subprocess next to a function-local asyncio subprocess import', 'import subprocess\nasync def stream():\n    from asyncio import subprocess\ndef convert(command):\n    subprocess.run(command, shell=True)', ['CRITICAL']],
    ])('reports %s', async (_caseName, pythonSource, expectedSeverities) => {
        expect(await severitiesOf('SEC-009', 'python', pythonSource)).toEqual(expectedSeverities);
    });

    it.each([
        ['run imported from another module', 'from tasks import run\nrun(command, shell=True)'],
        ['split without a shlex import', 'def run_hook(hook_line):\n    subprocess.run(split(hook_line))'],
        ['os.execv restarting the interpreter', 'os.execv(sys.executable, [sys.executable] + sys.argv)'],
        ['os.execvp with an editor path without visible request source', 'def edit(editor, path):\n    os.execvp(editor, [editor, path])'],
        ['os.spawnl with a literal program', 'os.spawnl(os.P_NOWAIT, "/usr/bin/true", "true")'],
        ['asyncio.create_subprocess_shell with a literal', 'async def listing():\n    await asyncio.create_subprocess_shell("ls -la")'],
        ['asyncio.create_subprocess_shell with a literal cmd= keyword', 'async def listing():\n    await asyncio.create_subprocess_shell(cmd="ls -la")'],
        ['asyncio.create_subprocess_exec with a literal program', 'async def log(ref):\n    await asyncio.create_subprocess_exec("git", "log", ref)'],
        ['asyncio.create_subprocess_exec of a prepared argv list', 'async def run(argv):\n    await asyncio.create_subprocess_exec(*argv)'],
    ])('stays silent on %s', async (_caseName, pythonSource) => {
        expect(await severitiesOf('SEC-009', 'python', pythonSource)).toEqual([]);
    });

    it('keeps exactly one CRITICAL for the aliased shell=True form', async () => {
        expect(await severitiesOf('SEC-009', 'python', 'import subprocess as sp\nsp.run(shlex.split(request.args["c"]), shell=True)')).toEqual(['CRITICAL']);
    });
});

describe('SEC-009 — JS/TS spawn/execFile from child_process', () => {
    it.each([
        ['spawn with a request value as program', "import { spawn } from 'child_process';\napp.get('/run', (req, res) => { spawn(req.query.cmd, ['--help']); });", ['CRITICAL']],
        ['renamed execFile, program destructured from the request', "const { execFile: runFile } = require('node:child_process');\nfunction handle(req) { const { tool } = req.body; runFile(tool, []); }", ['CRITICAL']],
        ['namespace import with a request value as program', "import * as cp from 'child_process';\nexport function probe(req: Request) { cp.execFileSync(req.body.binary, []); }", ['CRITICAL']],
        ['require(...).spawnSync bound to a name', "const spawnSync = require('child_process').spawnSync;\nfunction probe(req) { spawnSync(req.query.bin, []); }", ['CRITICAL']],
        ['shell: true with a request value in the arguments', "import { spawn } from 'child_process';\nfunction install(req) { spawn('npm', ['install', req.body.pkg], { shell: true }); }", ['CRITICAL']],
        ['shell: true with a parameter in the arguments', "import { spawn } from 'child_process';\nexport function install(pkg: string) { spawn('npm', ['install', pkg], { shell: true }); }", ['WARNING']],
        ['shell: true with a command built from a template', "import { spawn } from 'child_process';\nexport function convert(file: string) { spawn(`convert ${file} out.png`, { shell: true }); }", ['WARNING']],
        ['shell on Windows only with a parameter in the arguments', "import { execFile } from 'child_process';\nexport function install(cli: string, extensionId: string) { execFile(cli, ['--install-extension', extensionId], { shell: process.platform === 'win32' }); }", ['WARNING']],
        ['promisify(execFile) under an alias with a request value as program', "import { execFile } from 'node:child_process';\nimport { promisify } from 'node:util';\nconst execFileAsync = promisify(execFile);\nexport async function probe(req: Request) { await execFileAsync(req.body.tool, ['--version']); }", ['CRITICAL']],
        ['a program from req?.body (optional chaining)', "import { spawn } from 'child_process';\nfunction handle(req) { spawn(req?.body.tool, []); }", ['CRITICAL']],
        ['a program from the Koa request body', "import { spawn } from 'child_process';\nrouter.post('/run', async (ctx) => { const { tool } = ctx.request.body; spawn(tool, []); });", ['CRITICAL']],
    ])('reports %s', async (_caseName, typescriptSource, expectedSeverities) => {
        expect(await severitiesOf('SEC-009', 'typescript', typescriptSource)).toEqual(expectedSeverities);
    });

    it.each([
        ['a literal program with non-literal arguments', "import { spawn } from 'child_process';\nspawn('git', [req.query.ref]);"],
        ['a program without visible request source (editor, CLI path)', "import * as cp from 'child_process';\nexport function openEditor(editor: string, file: string) { cp.spawn(editor, [file]); }"],
        ['an opaque program with shell and literal arguments (VS Code CLI probe)', "import { execFile } from 'child_process';\nexecFile(resolveCliCommand(), ['--help'], { shell: process.platform === 'win32' }, onExit);"],
        ['the running node binary', "import { execFileSync } from 'child_process';\nexecFileSync(process.execPath, [scriptPath]);"],
        ['a ternary of literals', "import { spawn } from 'child_process';\nspawn(isWindows ? 'npm.cmd' : 'npm', args);"],
        ['shell: true with literals and module constants only', "import { spawn } from 'child_process';\nconst NPM_INSTALL = 'install';\nspawn('npm', [NPM_INSTALL, '--silent'], { shell: true });"],
        ['spawn methods of other objects', "import { spawn } from 'child_process';\ngit.spawn(req.query.args);\nspawk.spawn(req.query.cmd);"],
        ['spawn without a child_process import', "import { spawn } from './process-pool';\nspawn(req.query.worker, []);"],
        ['a request assignment in another function', "import { spawn } from 'child_process';\nfunction handler(req) { const editor = req.query.e; }\nconst editor = process.env.EDITOR;\nspawn(editor, [file]);"],
        ['a request value written to an object property', "import * as cp from 'child_process';\nfunction handle(req, res) { res.locals.q = req.query.q; cp.spawn(res.app.get('tool'), []); }"],
        ['a destructuring default that names the program', "import { spawn } from 'child_process';\nfunction handle(req) { const { cmd = fallbackTool } = req.body; spawn(fallbackTool, []); }"],
        ['shell: undefined', "import { spawn } from 'child_process';\nexport function install(pkg: string) { spawn('npm', ['install', pkg], { shell: undefined }); }"],
        ['shell with numeric arguments only', "import { spawn } from 'child_process';\nspawn('npx', ['serve', '-p', 3000], { shell: true });"],
    ])('stays silent on %s', async (_caseName, typescriptSource) => {
        expect(await severitiesOf('SEC-009', 'typescript', typescriptSource)).toEqual([]);
    });
});

describe('SEC-009 — JS/TS exec/execSync resolved through child_process bindings', () => {
    it.each([
        ['promisify(exec) under an alias (r20/r24 backup-runner.ts)', "import { exec } from 'node:child_process';\nimport { promisify } from 'node:util';\nconst execAsync = promisify(exec);\nexport async function backup(slug: string) { const dumpCommand = 'pg_dump ' + slug; await execAsync(dumpCommand, { shell: '/bin/bash' }); }"],
        ['util.promisify of a namespace member', "import * as cp from 'child_process';\nimport util from 'util';\nconst run = util.promisify(cp.exec);\nrun(`tar -czf ${archive}`);"],
        ['util.promisify of require(...).exec', "const util = require('util');\nconst exec = util.promisify(require('child_process').exec);\nexec(command);"],
        ['execSync destructured from await import()', "export async function build(target: string) { const { execSync } = await import('node:child_process'); execSync(`make ${target}`); }"],
        ['a namespace from await import()', "export async function build(target: string) { const cp = await import('child_process'); cp.execSync('make ' + target); }"],
        ['require(...).exec called inline', "require('child_process').exec(userCommand);"],
        ['a default import used as namespace', "import childProcess from 'node:child_process';\nchildProcess.execSync(buildCommand);"],
        ['exec renamed in a require destructuring', "const { exec: sh } = require('child_process');\nsh(command);"],
        ['exec destructured from a namespace', "import * as cp from 'child_process';\nconst { execSync } = cp;\nexecSync(command);"],
        ['a plain alias of cp.exec', "const cp = require('child_process');\nconst shell = cp.exec;\nshell(command);"],
        ['a TypeScript import-equals require', "import cp = require('child_process');\ncp.exec(userCommand);"],
        ['the default export imported by name', "import { default as cp } from 'node:child_process';\ncp.execSync(userCommand);"],
        ['the default export destructured from await import()', "export async function run(command: string) { const { default: cp } = await import('child_process'); cp.exec(command); }"],
        ['a template whose placeholder is not module text', "import { exec } from 'child_process';\nconst BRANCH = 'main';\nexec(`git log ${BRANCH} ${ref}`);"],
    ])('reports %s as CRITICAL', async (_caseName, typescriptSource) => {
        expect(await severitiesOf('SEC-009', 'typescript', typescriptSource)).toEqual(['CRITICAL']);
    });

    it.each([
        ['RegExp.prototype.exec next to a child_process import', "import { spawn } from 'child_process';\nconst LINE_PATTERN = /^(\\w+)=(.*)$/;\nexport function parse(line: string) { return LINE_PATTERN.exec(line); }"],
        ['regex.exec in a loop next to execFileSync', "import { execFileSync } from 'node:child_process';\nconst pattern = /diff --git a\\/(.+) b\\//g;\nlet match;\nwhile ((match = pattern.exec(output)) !== null) { files.push(match[1]); }"],
        ['db.exec next to a child_process require', "const { spawnSync } = require('child_process');\ndb.exec(schemaSql);\ndatabase.execSync(migration);"],
        ['exec when child_process is only mentioned in a comment', "// Unlike child_process, this runner never starts a shell.\nimport { exec } from './sql-runner';\nexec(statement);\nconst found = matcher.exec(text);"],
        ['promisify of another function next to a child_process import', "import { exec } from 'child_process';\nimport { promisify } from 'util';\nconst readFileAsync = promisify(fs.readFile);\nreadFileAsync(configPath);"],
        ['exec with a literal command through promisify', "import { exec } from 'child_process';\nconst execAsync = require('util').promisify(exec);\nexecAsync('git status --porcelain');"],
        ['a dynamic import of another module', "export async function load(sql: string) { const { exec } = await import('./database'); exec(sql); }"],
        ['a module constant through promisify', "import { exec } from 'child_process';\nimport { promisify } from 'util';\nconst execAsync = promisify(exec);\nconst STATUS_COMMAND = 'git status --porcelain';\nexport async function status() { return execAsync(STATUS_COMMAND); }"],
        ['a template built only from module constants', "import { execSync } from 'child_process';\nconst BRANCH = 'main';\nexecSync(`git log ${BRANCH}`);"],
    ])('stays silent on %s', async (_caseName, typescriptSource) => {
        expect(await severitiesOf('SEC-009', 'typescript', typescriptSource)).toEqual([]);
    });
});

describe('SEC-011 — Python eval/exec with a non-literal argument', () => {
    it.each([
        ['eval of a request value assigned in the same function (r03)', 'def preview():\n    formula = request.json["discount_formula"]\n    return eval(formula, {"total": 1})', ['CRITICAL']],
        ['eval of a parameter (r20)', 'def evaluate_rule(expression, scope):\n    return eval(expression, scope)', ['WARNING']],
        ['exec of compiled file contents', 'def load(path, namespace):\n    exec(compile(open(path).read(), path, "exec"), namespace)', ['WARNING']],
        ['builtins.exec of an f-string with interpolation', 'builtins.exec(f"result = {expression}")', ['WARNING']],
        ['eval of the pytest request fixture', 'def value(request):\n    return eval(request.param)', ['WARNING']],
        ['eval of an attribute next to a request write on self', 'class Rule:\n    def post(self):\n        self.q = self.request.GET.get("q")\n        return eval(self.formula)', ['WARNING']],
    ])('reports %s', async (_caseName, pythonSource, expectedSeverities) => {
        expect(await severitiesOf('SEC-011', 'python', pythonSource)).toEqual(expectedSeverities);
    });

    it.each([
        ['ast.literal_eval', 'config = ast.literal_eval(raw_text)'],
        ['a method named eval on another object (pandas)', 'filtered = frame.eval(user_expression)'],
        ['eval of a literal', 'total = eval("1 + 2")'],
        ['exec of a parenthesised literal', 'exec(("counter = 1"))'],
    ])('stays silent on %s', async (_caseName, pythonSource) => {
        expect(await severitiesOf('SEC-011', 'python', pythonSource)).toEqual([]);
    });
});

describe('SEC-016 — weak RSA modulus', () => {
    it('flags modulus < 2048 in Java, TS and Python', async () => {
        const javaKeygen = 'class Keys { void gen() throws Exception { KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA"); generator.initialize(1024); } }';
        expect(ruleIdsOf(await scanSource('java', javaKeygen))).toContain('SEC-016');

        const nodeKeygen = "crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });";
        expect(ruleIdsOf(await scanSource('typescript', nodeKeygen))).toContain('SEC-016');

        const pythonKeygen = 'private_key = RSA.generate(1024)';
        expect(ruleIdsOf(await scanSource('python', pythonKeygen))).toContain('SEC-016');
    });

    it('accepts modulus >= 2048', async () => {
        const strongKeygen = "crypto.generateKeyPairSync('rsa', { modulusLength: 4096 });";
        expect(ruleIdsOf(await scanSource('typescript', strongKeygen))).not.toContain('SEC-016');
    });
});

describe('SEC-022 — cookie flags', () => {
    it('flags session cookies missing flags as CRITICAL', async () => {
        const flaglessSessionCookie = "res.cookie('session_id', sessionToken, { maxAge: 3600 });";
        const cookieFindings = await scanSource('typescript', flaglessSessionCookie);
        const sec022Finding = cookieFindings.find((finding) => finding.ruleId === 'SEC-022');
        expect(sec022Finding?.severity).toBe('CRITICAL');
    });

    it('accepts cookies with all three flags', async () => {
        const hardenedCookie = "res.cookie('session_id', sessionToken, { httpOnly: true, secure: true, sameSite: 'lax' });";
        expect(ruleIdsOf(await scanSource('typescript', hardenedCookie))).not.toContain('SEC-022');
    });
});

describe('SEC-026 — XSS sinks', () => {
    it('flags unsanitized dangerouslySetInnerHTML, accepts DOMPurify', async () => {
        const rawHtmlComponent = 'const Preview = () => <div dangerouslySetInnerHTML={{ __html: userContent }} />;';
        expect(ruleIdsOf(await scanSource('tsx', rawHtmlComponent))).toContain('SEC-026');

        const sanitizedComponent = 'const Preview = () => <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />;';
        expect(ruleIdsOf(await scanSource('tsx', sanitizedComponent))).not.toContain('SEC-026');
    });

    it('flags innerHTML assignment and document.write', async () => {
        const domSinks = [
            'container.innerHTML = userContent;',
            'document.write(userContent);',
        ].join('\n');
        const sinkFindings = await scanSource('typescript', domSinks);
        expect(ruleIdsOf(sinkFindings).filter((ruleId) => ruleId === 'SEC-026')).toHaveLength(2);

        const staticAssignment = 'container.innerHTML = "<p>static</p>";';
        expect(ruleIdsOf(await scanSource('typescript', staticAssignment))).not.toContain('SEC-026');
    });
});

describe('TEST-001/002 — assertion checks (test files only)', () => {
    it('flags assertion-free JS tests, accepts asserting ones', async () => {
        const assertionFreeTest = "it('renders', () => { render(<App />); });";
        const testFindings = await scanSource('tsx', assertionFreeTest,
            { isTestFile: true, path: 'app.test.tsx' });
        expect(ruleIdsOf(testFindings)).toContain('TEST-001');

        const assertingTest = "it('renders', () => { expect(render(<App />)).toBeTruthy(); });";
        const cleanFindings = await scanSource('tsx', assertingTest,
            { isTestFile: true, path: 'app.test.tsx' });
        expect(ruleIdsOf(cleanFindings)).not.toContain('TEST-001');
    });

    it('flags assertion-free Python tests and message-less multi-asserts', async () => {
        const assertionFreeTest = 'def test_sync():\n    run_sync()\n';
        const pyFindings = await scanSource('python', assertionFreeTest,
            { isTestFile: true, path: 'test_sync.py' });
        expect(ruleIdsOf(pyFindings)).toContain('TEST-001');

        const messagelessAsserts = 'def test_totals():\n    assert total == 5\n    assert count == 2\n';
        const rouletteFindings = await scanSource('python', messagelessAsserts,
            { isTestFile: true, path: 'test_totals.py' });
        expect(ruleIdsOf(rouletteFindings)).toContain('TEST-002');
    });

    it('never runs TEST-001 on non-test files', async () => {
        const productionHelper = "it('looks like a test name but is prod code', () => {});";
        expect(ruleIdsOf(await scanSource('typescript', productionHelper))).not.toContain('TEST-001');
    });
});

describe('TEST-002 — expect-style assertion roulette (v2)', () => {
    it('flags >= 4 message-less expect() asserts in one test', async () => {
        const rouletteTest = [
            "it('quotes a parcel', () => {",
            '    const quote = buildQuote(input);',
            "    expect(quote.carrier).toBe('dhl');",
            '    expect(quote.priceCents).toBe(499);',
            '    expect(quote.estimatedDays).toBe(2);',
            '    expect(quote.trackingIncluded).toBe(true);',
            '});',
        ].join('\n');
        const rouletteFindings = await scanSource('typescript', rouletteTest,
            { isTestFile: true, path: 'quote.test.ts' });
        expect(ruleIdsOf(rouletteFindings)).toContain('TEST-002');
    });

    it('accepts 3 expects, and 4 expects carrying messages', async () => {
        const threeExpects = [
            "it('quotes a parcel', () => {",
            "    expect(quote.carrier).toBe('dhl');",
            '    expect(quote.priceCents).toBe(499);',
            '    expect(quote.estimatedDays).toBe(2);',
            '});',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', threeExpects,
            { isTestFile: true, path: 'quote.test.ts' }))).not.toContain('TEST-002');

        const labeledExpects = [
            "it('quotes a parcel', () => {",
            "    expect(quote.carrier, 'carrier').toBe('dhl');",
            "    expect(quote.priceCents, 'price').toBe(499);",
            "    expect(quote.estimatedDays, 'eta').toBe(2);",
            "    expect(quote.trackingIncluded, 'tracking').toBe(true);",
            '});',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('typescript', labeledExpects,
            { isTestFile: true, path: 'quote.test.ts' }))).not.toContain('TEST-002');
    });
});

describe('TEST-005 — tautological assertions', () => {
    it('flags expect(true).toBe(true) and expect(x).toEqual(x)', async () => {
        const literalTautology = "it('runs tiers', () => { applyTiers(); expect(true).toBe(true); });";
        expect(ruleIdsOf(await scanSource('typescript', literalTautology,
            { isTestFile: true, path: 'tiers.test.ts' }))).toContain('TEST-005');

        const selfComparison = "it('totals', () => { const total = sum(rows); expect(total).toEqual(total); });";
        expect(ruleIdsOf(await scanSource('typescript', selfComparison,
            { isTestFile: true, path: 'totals.test.ts' }))).toContain('TEST-005');

        const literalTruthy = "it('flags', () => { expect(1).toBeTruthy(); });";
        expect(ruleIdsOf(await scanSource('typescript', literalTruthy,
            { isTestFile: true, path: 'flags.test.ts' }))).toContain('TEST-005');
    });

    it('accepts real assertions and repeated calls', async () => {
        const realAssertion = "it('charges', () => { expect(receipt.status).toBe('succeeded'); });";
        expect(ruleIdsOf(await scanSource('typescript', realAssertion,
            { isTestFile: true, path: 'charge.test.ts' }))).not.toContain('TEST-005');

        const repeatedCall = "it('is stable', () => { expect(render()).toEqual(render()); });";
        expect(ruleIdsOf(await scanSource('typescript', repeatedCall,
            { isTestFile: true, path: 'render.test.ts' }))).not.toContain('TEST-005');
    });

    it('flags Python assert True / x == x, accepts real asserts', async () => {
        const pythonTautology = 'def test_tiers():\n    apply_tiers()\n    assert True\n';
        expect(ruleIdsOf(await scanSource('python', pythonTautology,
            { isTestFile: true, path: 'test_tiers.py' }))).toContain('TEST-005');

        const pythonSelfCompare = 'def test_total():\n    total = sum_rows(rows)\n    assert total == total\n';
        expect(ruleIdsOf(await scanSource('python', pythonSelfCompare,
            { isTestFile: true, path: 'test_total.py' }))).toContain('TEST-005');

        const pythonReal = 'def test_total():\n    assert sum_rows(rows) == 42\n';
        expect(ruleIdsOf(await scanSource('python', pythonReal,
            { isTestFile: true, path: 'test_total.py' }))).not.toContain('TEST-005');
    });
});

describe('COND-011 — JSX nesting / god component (tsx only)', () => {
    const deeplyNestedComponent = [
        'export function OrderSummary({ order }: { order: OrderView | null }) {',
        '  return (',
        '    <div className="order-summary">',
        '      {order ? (',
        '        order.lineItems.length > 0 ? (',
        '          <ul>',
        '            {order.lineItems.map((lineItem) => (',
        '              <li key={lineItem.sku}>',
        '                {lineItem.inStock ? (',
        '                  lineItem.discounted ? <strong>{lineItem.title}</strong> : <span>{lineItem.title}</span>',
        '                ) : (',
        '                  <em>{lineItem.title} is backordered</em>',
        '                )}',
        '              </li>',
        '            ))}',
        '          </ul>',
        '        ) : <p>No line items.</p>',
        '      ) : <p>No order selected.</p>}',
        '    </div>',
        '  );',
        '}',
    ].join('\n');

    it('flags conditional JSX nesting deeper than 4 levels', async () => {
        const nestingFindings = await scanSource('tsx', deeplyNestedComponent, { path: 'OrderSummary.tsx' });
        expect(ruleIdsOf(nestingFindings)).toContain('COND-011');
    });

    it('accepts deep but purely static markup and shallow conditional JSX', async () => {
        const staticMarkup = [
            'export function StaticCard() {',
            '  return (',
            '    <div><section><ul><li><span>static</span></li></ul></section></div>',
            '  );',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('tsx', staticMarkup, { path: 'StaticCard.tsx' })))
            .not.toContain('COND-011');

        const shallowConditional = [
            'export function MemberList({ members }: { members: Member[] }) {',
            '  return <ul>{members.map((member) => <li key={member.id}>{member.fullName}</li>)}</ul>;',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('tsx', shallowConditional, { path: 'MemberList.tsx' })))
            .not.toContain('COND-011');
    });

    it('flags more than 2 useEffect declarations in one component', async () => {
        const effectHeavyComponent = [
            'export function Dashboard() {',
            '  useEffect(() => { syncA(); }, []);',
            '  useEffect(() => { syncB(); }, []);',
            '  useEffect(() => { syncC(); }, []);',
            '  return <div>ok</div>;',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('tsx', effectHeavyComponent, { path: 'Dashboard.tsx' })))
            .toContain('COND-011');

        const twoEffectComponent = [
            'export function Panel() {',
            '  useEffect(() => { syncA(); }, []);',
            '  useEffect(() => { syncB(); }, []);',
            '  return <div>ok</div>;',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('tsx', twoEffectComponent, { path: 'Panel.tsx' })))
            .not.toContain('COND-011');
    });
});

describe('ARCH-005 — Go nil-map write', () => {
    const nilMapLedger = [
        'package quota',
        '',
        'type UsageLedger struct {',
        '\tcallCountsByTenant map[string]int',
        '}',
        '',
        'func NewUsageLedger() *UsageLedger {',
        '\treturn &UsageLedger{}',
        '}',
        '',
        'func (ledger *UsageLedger) RecordCall(tenantID string) {',
        '\tledger.callCountsByTenant[tenantID]++',
        '}',
    ].join('\n');

    it('flags a write to a map field left nil by an empty composite literal', async () => {
        const nilMapFindings = await scanSource('go', nilMapLedger, { path: 'usage_ledger.go' });
        expect(ruleIdsOf(nilMapFindings)).toContain('ARCH-005');
    });

    it('accepts make() in the composite literal and field assignment inits', async () => {
        const madeInLiteral = nilMapLedger.replace(
            'return &UsageLedger{}',
            'return &UsageLedger{callCountsByTenant: make(map[string]int)}',
        );
        expect(ruleIdsOf(await scanSource('go', madeInLiteral, { path: 'usage_ledger.go' })))
            .not.toContain('ARCH-005');

        const madeByAssignment = nilMapLedger.replace(
            '\tledger.callCountsByTenant[tenantID]++',
            '\tledger.callCountsByTenant = make(map[string]int)\n\tledger.callCountsByTenant[tenantID]++',
        );
        expect(ruleIdsOf(await scanSource('go', madeByAssignment, { path: 'usage_ledger.go' })))
            .not.toContain('ARCH-005');
    });

    it('stays silent without in-file evidence (no bare literal, or deserializer present)', async () => {
        const noLiteralInFile = [
            'package presence',
            '',
            'type PresenceTracker struct {',
            '\tlastSeen map[string]int64',
            '}',
            '',
            'func (tracker *PresenceTracker) MarkSeen(userID string, unixSeconds int64) {',
            '\ttracker.lastSeen[userID] = unixSeconds',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('go', noLiteralInFile, { path: 'presence_tracker.go' })))
            .not.toContain('ARCH-005');

        const unmarshalFile = nilMapLedger + '\n\nfunc load(raw []byte, ledger *UsageLedger) error {\n\treturn json.Unmarshal(raw, ledger)\n}';
        expect(ruleIdsOf(await scanSource('go', unmarshalFile, { path: 'usage_ledger.go' })))
            .not.toContain('ARCH-005');
    });
});

describe('CONC-003 — volatile as thread signal (C)', () => {
    it('flags a file-scope volatile scalar in a file that talks about threads', async () => {
        const volatileFlag = [
            '/* Written by the control thread, polled by the worker thread. */',
            'static volatile int shutdown_requested = 0;',
            '',
            'void control_request_shutdown(void)',
            '{',
            '    shutdown_requested = 1;',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('c', volatileFlag, { path: 'shutdown-flag.c' })))
            .toContain('CONC-003');
    });

    it('exempts sig_atomic_t, volatile pointers (MMIO), locals, and thread-free files', async () => {
        const signalIdiom = [
            '/* Polled from the main thread loop; set by the SIGINT handler. */',
            'static volatile sig_atomic_t interrupt_requested = 0;',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('c', signalIdiom, { path: 'sigint.c' })))
            .not.toContain('CONC-003');

        const mmioRegister = [
            '/* DMA control register, shared with the transfer thread. */',
            'static volatile unsigned int *dma_control_register = (unsigned int *)0x40001000;',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('c', mmioRegister, { path: 'dma.c' })))
            .not.toContain('CONC-003');

        const localSetjmp = [
            '/* Worker thread entry point. */',
            'int run_with_recovery(void)',
            '{',
            '    volatile int attempts = 0;',
            '    return attempts;',
            '}',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('c', localSetjmp, { path: 'recovery.c' })))
            .not.toContain('CONC-003');

        const threadFreeVolatile = [
            '/* Timer tick counter incremented by the hardware ISR. */',
            'static volatile unsigned long tick_count = 0;',
        ].join('\n');
        expect(ruleIdsOf(await scanSource('c', threadFreeVolatile, { path: 'ticks.c' })))
            .not.toContain('CONC-003');
    });
});
