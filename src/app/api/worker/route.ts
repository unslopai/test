import { NextResponse } from "next/server";
import { getVertexClient } from "@/lib/vertex";
import { processJob } from "@/lib/worker";
import { extractErrorMessage } from "@/lib/errors";

export const maxDuration = 60;

export async function GET() {
    try {
        const ai = getVertexClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Antworte nur mit: OK',
        });

        return NextResponse.json({
            success: true,
            message: "Vertex AI Setup erfolgreich!",
            vertexResponse: response.text,
        });
    } catch (error: unknown) {
        console.error("Fehler im Worker Test:", error);
        return NextResponse.json(
            { success: false, error: extractErrorMessage(error) },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
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
