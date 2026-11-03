/**
 * SEC-019-Tests — Next-Middleware (r08-Fixture) mit den Fail-Safe-Negativen aus
 * Design §9.1 (Request-Header, computed Namen, headers-Objekte, lokale
 * Security-Module, next.config-Begleitdatei) und den sieben False-Positive-Fällen
 * aus dem Review vom 2026-09-24, die alle still bleiben müssen.
 */
import { describe, expect, it } from 'vitest';
import { runSecurityHeaderChecks } from './security-headers';
import type { PrescanCompanionFile } from '../../types';

const NEXT_MIDDLEWARE = [
    "import { NextResponse } from 'next/server';",
    "import type { NextRequest } from 'next/server';",
    '',
    'export function middleware(request: NextRequest) {',
    '  const forwardedResponse = NextResponse.next();',
    "  forwardedResponse.headers.set('x-request-id', crypto.randomUUID());",
    "  forwardedResponse.headers.set('x-request-path', request.nextUrl.pathname);",
    '  return forwardedResponse;',
    '}',
    '',
    'export const config = {',
    "  matcher: ['/((?!_next/static|favicon.ico).*)'],",
    '};',
].join('\n');

function checkNext(source: string, nextConfigs: readonly PrescanCompanionFile[] = []) {
    return runSecurityHeaderChecks({ path: 'middleware.ts', language: 'typescript', source, nextConfigs });
}

describe('SEC-019 — Next.js middleware', () => {
    it('flags a middleware that shapes response headers without any security header (r08 fixture)', () => {
        const { findings, skippedChecks } = checkNext(NEXT_MIDDLEWARE);
        expect(findings.map((finding) => [finding.ruleId, finding.severity, finding.line])).toEqual([['SEC-019', 'WARNING', 6]]);
        expect(findings[0].exactQuote).toContain("headers.set('x-request-id'");
        expect(skippedChecks).toEqual([]);
    });

    it('stays silent when a security header is set, or when only request headers are touched', () => {
        const withCsp = NEXT_MIDDLEWARE.replace("'x-request-path'", "'Content-Security-Policy'");
        expect(checkNext(withCsp).findings).toEqual([]);

        const requestOnly = [
            "import { NextResponse } from 'next/server';",
            'export function proxy(request: NextRequest) {',
            "  request.headers.set('x-path-locale', 'de');",
            '  return NextResponse.next({ request });',
            '}',
        ].join('\n');
        expect(runSecurityHeaderChecks({ path: 'src/proxy.ts', language: 'typescript', source: requestOnly, nextConfigs: [] }).findings).toEqual([]);
    });

    it('stays silent on computed header names, headers objects and local security modules (fail-safe)', () => {
        const computedNames = NEXT_MIDDLEWARE.replace(
            "forwardedResponse.headers.set('x-request-id', crypto.randomUUID());",
            'for (const [name, value] of Object.entries(SECURITY_HEADERS)) forwardedResponse.headers.set(name, value);',
        );
        expect(checkNext(computedNames).findings).toEqual([]);

        const headersObject = NEXT_MIDDLEWARE.replace('NextResponse.next()', 'NextResponse.next({ headers: baseHeaders })');
        expect(checkNext(headersObject).findings).toEqual([]);

        const localSecurityImport = `import { applySecurityHeaders } from './lib/security-headers';\n${NEXT_MIDDLEWARE}`;
        expect(checkNext(localSecurityImport).findings).toEqual([]);
    });

    it('defers to a next.config that configures the headers, and reports an unreadable one as skipped', () => {
        const hardenedConfig = { path: 'next.config.ts', content: "headers: [{ key: 'X-Frame-Options', value: 'DENY' }]" };
        expect(checkNext(NEXT_MIDDLEWARE, [hardenedConfig]).findings).toEqual([]);

        const bareConfig = { path: 'next.config.ts', content: 'export default { reactStrictMode: true };' };
        expect(checkNext(NEXT_MIDDLEWARE, [bareConfig]).findings).toHaveLength(1);

        const unreadable = checkNext(NEXT_MIDDLEWARE, [{ path: 'next.config.mjs', content: null }]);
        expect(unreadable.findings).toEqual([]);
        expect(unreadable.skippedChecks).toEqual([{ ruleId: 'SEC-019', reason: 'companion-unavailable: next.config.mjs', path: 'middleware.ts' }]);
    });

    it('ignores files that merely look like a middleware but do not use next/server', () => {
        const plainModule = "export function middleware(ctx) { ctx.res.headers.set('x-a', '1'); }";
        expect(checkNext(plainModule).findings).toEqual([]);
    });
});

describe('SEC-019 — review 2026-09-24 false-positive cases (all silent)', () => {
    it('case 1: response escapes into a helper imported via the @/ alias', () => {
        const aliasHelper = [
            "import { NextResponse } from 'next/server';",
            "import { withSecurityHeaders } from '@/lib/security';",
            'export function middleware() {',
            '  const response = NextResponse.next();',
            "  response.headers.set('x-request-id', crypto.randomUUID());",
            '  return withSecurityHeaders(response);',
            '}',
        ].join('\n');
        expect(checkNext(aliasHelper)).toEqual({ findings: [], skippedChecks: [] });
    });

    it('case 2: next.config.js has a headers() function whose header names live in another module', () => {
        const importedHeadersConfig = {
            path: 'next.config.js',
            content: [
                "const { securityHeaders } = require('./config/headers');",
                'module.exports = {',
                "  async headers() { return [{ source: '/(.*)', headers: securityHeaders }]; },",
                '};',
            ].join('\n'),
        };
        expect(checkNext(NEXT_MIDDLEWARE, [importedHeadersConfig]).findings).toEqual([]);
    });

    it('case 3: response comes from @nosecone/next, or the export is wrapped by next-safe-middleware', () => {
        const noseconeOrigin = [
            "import { NextResponse } from 'next/server';",
            "import { createMiddleware } from '@nosecone/next';",
            'const noseconeMiddleware = createMiddleware();',
            'export async function middleware() {',
            '  const response = await noseconeMiddleware();',
            "  response.headers.set('x-request-id', crypto.randomUUID());",
            '  return response;',
            '}',
        ].join('\n');
        expect(checkNext(noseconeOrigin).findings).toEqual([]);

        const nextSafeChain = [
            "import { NextResponse } from 'next/server';",
            "import { chain, nextSafe } from '@next-safe/middleware';",
            'function tagRequest() {',
            '  const response = NextResponse.next();',
            "  response.headers.set('x-request-id', crypto.randomUUID());",
            '  return response;',
            '}',
            'export default chain(nextSafe({ isDev: false }), tagRequest);',
        ].join('\n');
        expect(checkNext(nextSafeChain).findings).toEqual([]);
    });

    it('cases 4–6: Express bootstraps (lusca, inline require, @/ alias middleware) are no longer checked', () => {
        const expressApp = (middlewareLine: string, importLine = '') => [
            importLine,
            "import express from 'express';",
            'const app = express();',
            middlewareLine,
            'app.listen(3000);',
        ].join('\n');
        const expressCases = [
            expressApp('app.use(lusca({ csp, xframe, hsts }));', "import lusca from 'lusca';"),
            expressApp("app.use(require('./middleware/security'));"),
            expressApp('app.use(hardening);', "import { hardening } from '@/middleware/hardening';"),
        ];
        for (const source of expressCases) {
            expect(runSecurityHeaderChecks({ path: 'server.js', language: 'javascript', source, nextConfigs: [] }).findings).toEqual([]);
        }
    });

    it('case 7: a gunicorn-served Flask module with hardening applied in extensions.py is no longer checked', () => {
        const gunicornFlask = [
            'from flask import Flask, jsonify',
            'from extensions import init_extensions',
            '',
            'app = Flask(__name__)',
            'init_extensions(app)',
            '',
            '@app.get("/jobs")',
            'def jobs():',
            '    return jsonify(result=job_runner.run())',
        ].join('\n');
        expect(runSecurityHeaderChecks({ path: 'app.py', language: 'python', source: gunicornFlask, nextConfigs: [] }).findings).toEqual([]);
    });

    it('treats ~/ and #/ specifiers as local security imports as well', () => {
        for (const specifier of ['~/lib/security-headers', '#/lib/security-headers']) {
            const aliasImport = `import { applySecurityHeaders } from '${specifier}';\n${NEXT_MIDDLEWARE}`;
            expect(checkNext(aliasImport).findings).toEqual([]);
        }
    });
});
