#!/usr/bin/env node
/**
 * @unslop/mcp — stdio server bootstrap (MCP_SPEC.md §3.2, D2).
 *
 * Credential resolution is byte-identical to the CLI (@unslop/shared/node):
 * UNSLOP_API_KEY env → ~/.config/unslop/config.json → none. Startup is
 * non-fatal: missing credentials, a non-repo cwd, and an unreachable API all
 * produce a server that starts fine and answers with typed errors per call —
 * a server that refuses to start is invisible to the user.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { computeDiff, loadConfig, resolveRerollLimit } from '@unslop/shared/node';
import { createUnslopApiClient } from './unslop-client.js';
import { resolveRepoContext, resolveRepoIdentity } from './repo-context.js';
import { createUnslopMcpServer } from './server.js';

async function main(): Promise<void> {
    const clientConfig = loadConfig();

    const mcpServer = createUnslopMcpServer({
        api: createUnslopApiClient(clientConfig),
        resolveRepoContext,
        resolveRepoIdentity,
        buildDiff: (gitRoot, mergeBaseSha, pathFilters) => computeDiff(mergeBaseSha, gitRoot, pathFilters),
        baseUrl: clientConfig.baseUrl,
        rerollLimit: resolveRerollLimit(),
        waitMs: (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)),
    });

    // stdout belongs to the MCP protocol — diagnostics go to stderr only.
    await mcpServer.connect(new StdioServerTransport());
    console.error('[unslop-mcp] server ready (stdio).');
}

main().catch((fatalError: unknown) => {
    console.error(`[unslop-mcp] fatal: ${(fatalError as Error).message}`);
    process.exit(1);
});
