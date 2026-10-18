/**
 * POST /api/worker — Manueller Job-Trigger (nur intern).
 *
 * Gesichert via x-internal-secret (WORKER_INTERNAL_SECRET). Der frühere
 * Zustand (unauthentifiziert) war ein offenes Loch: beliebige Dritte konnten
 * Jobs triggern und LLM-Kosten erzeugen (SPEC.md §3.3, Lockdown).
 */
import { NextResponse } from "next/server";
import { processJob } from "@/lib/worker";
import { extractErrorMessage } from "@/lib/errors";
import { hasValidInternalSecret } from "@/lib/api-keys";

export const maxDuration = 60;

export async function GET(request: Request) {
    if (!hasValidInternalSecret(request)) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Leichtgewichtiger Health-Check ohne LLM-Call (Kosten!). Vertex-Health: /api/test.
    return NextResponse.json({ success: true, message: 'Worker erreichbar.' });
}

export async function POST(request: Request) {
    if (!hasValidInternalSecret(request)) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    try {
        const { jobId } = await request.json();

        if (!jobId) {
            return NextResponse.json(
                { success: false, error: "jobId ist erforderlich" },
                { status: 400 }
            );
        }

        await processJob(jobId);

        return NextResponse.json({
            success: true,
            message: `Job ${jobId} verarbeitet`,
        });
    } catch (error: unknown) {
        console.error("Fehler beim manuellen Worker-Aufruf:", error);
        return NextResponse.json(
            { success: false, error: extractErrorMessage(error) },
            { status: 500 }
        );
    }
}
