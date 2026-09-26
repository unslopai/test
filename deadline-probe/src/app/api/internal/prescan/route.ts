/**
 * POST /api/internal/prescan — Standalone-Invocation des deterministischen
 * Pre-Scanners (pre_scanner_design.md, ROADMAP §1b).
 *
 * Das ist der EINZIGE Ort im Next-Prozess, der @unslop/prescan zur Laufzeit
 * importiert: web-tree-sitter, Grammatiken, ESLint und der TS-Parser bleiben
 * damit in ihrer eigenen Serverless-Instance resident und teilen sich nie
 * mehr den Speicher mit der Vertex-Kaskade (OOM in draft-reviewer, 2026-07-20).
 *
 * Auth [SEC-002]: `x-internal-secret` gegen WORKER_INTERNAL_SECRET, fail-closed
 * (fehlendes Secret ⇒ 503, falsches ⇒ 401). Der Aufrufer ist ausschließlich
 * der pre-scanner-step; dessen Fail-Safe Gate absorbiert jede Antwort ≠ 200.
 */
import { NextResponse } from 'next/server';
import { runPrescan } from '@unslop/prescan';
import { resolvePrescanConfig } from '@unslop/prescan/config';
import { extractErrorMessage } from '@/lib/errors';
import { logMemory, logRssBreakdown } from '@/lib/memory-log';
import { INTERNAL_SECRET_HEADER, parseInternalPrescanRequest } from '@/lib/prescan/internal-contract';
import { supabaseRegistryCache } from '@/lib/prescan/registry-cache';
import type { PrescanResult } from '@unslop/prescan';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
    const authFailure = rejectUnauthorized(request);
    if (authFailure) return authFailure;

    const parsedRequest = parseInternalPrescanRequest(await readJsonBody(request));
    if (parsedRequest === null) {
        return NextResponse.json({ error: 'Ungültiger Prescan-Request.' }, { status: 400 });
    }

    // Baseline VOR dem Scan: trennt Modul-/Instance-Residenz von Scan-Arbeit
    // (Live 2026-08-23: 793 MB nach dem Scan bei lokal ~220 MB — Herkunft offen).
    logMemory('prescan-route-start');
    logRssBreakdown('prescan-route-start');
    try {
        const prescanResult: PrescanResult = await runPrescan(
            { files: parsedRequest.files, companionFiles: parsedRequest.companionFiles },
            resolvePrescanConfig(parsedRequest.rawPrescanConfig),
            {
                registryCache: supabaseRegistryCache,
                // Pro-Datei-RSS: trennt Einmal-Laden (Grammatik/ESLint) von Leck pro Datei.
                onFileScanned: (path) => logMemory(`file ${path}`),
                // Pro-Registry-Check-RSS (Run 11): Treppe pro Read vs. Sprung am Ende.
                onRegistryCandidateChecked: (candidateKey) => logMemory(`registry ${candidateKey}`),
            },
        );
        console.log(
            `[PrescanRoute] ${parsedRequest.repoFullName}@${parsedRequest.headSha.slice(0, 7)}: `
            + `${prescanResult.findings.length} Findings in ${prescanResult.filesScanned} Dateien, `
            + `${prescanResult.durationMs}ms, ${prescanResult.skippedChecks.length} skipped checks.`,
        );
        // Eigene Instance ⇒ eigene Messung: so bleibt der Engine-Footprint
        // (+274 MB vor dem Split) sichtbar, ohne den Worker zu belasten.
        logMemory('prescan-route');
        logRssBreakdown('prescan-route');
        return NextResponse.json(prescanResult);
    } catch (prescanError: unknown) {
        const failureMessage = extractErrorMessage(prescanError);
        console.error(
            `[PrescanRoute] ${parsedRequest.repoFullName}@${parsedRequest.headSha.slice(0, 7)}: `
            + `Scan fehlgeschlagen: ${failureMessage}`,
        );
        return NextResponse.json({ error: failureMessage }, { status: 500 });
    }
}

function rejectUnauthorized(request: Request): NextResponse | null {
    const configuredSecret = process.env.WORKER_INTERNAL_SECRET;
    if (!configuredSecret) {
        console.error('[PrescanRoute] WORKER_INTERNAL_SECRET ist nicht gesetzt — Route geschlossen.');
        return NextResponse.json({ error: 'Prescan-Route ist nicht konfiguriert.' }, { status: 503 });
    }
    if (request.headers.get(INTERNAL_SECRET_HEADER) !== configuredSecret) {
        return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }
    return null;
}

/** Kaputtes JSON ist ein 400, kein 500 — darum hier statt im try der Engine. */
async function readJsonBody(request: Request): Promise<unknown> {
    try {
        return await request.json();
    } catch {
        return null;
    }
}
