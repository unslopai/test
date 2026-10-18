import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getVertexClient } from "@/lib/vertex";
import { extractErrorMessage } from "@/lib/errors";

interface ServiceStatus {
    status: string;
    table?: string;
    rowCount?: number;
    model?: string;
    region?: string;
    response?: string | undefined;
    error?: string;
}

interface HealthCheckResults {
    supabase?: ServiceStatus;
    vertexAI?: ServiceStatus;
}

export async function GET() {
    const results: HealthCheckResults = {};

    try {
        const { error, count } = await supabase
            .from('code_chunks')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        results.supabase = {
            status: '✅ Verbunden',
            table: 'code_chunks',
            rowCount: count ?? 0,
        };
    } catch (error: unknown) {
        results.supabase = {
            status: '❌ Fehler',
            error: extractErrorMessage(error),
        };
    }

    try {
        const ai = getVertexClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Antworte nur mit: OK',
        });
        results.vertexAI = {
            status: '✅ Verbunden',
            model: 'gemini-2.5-flash',
            region: 'europe-west3',
            response: response.text,
        };
    } catch (error: unknown) {
        results.vertexAI = {
            status: '❌ Fehler',
            error: extractErrorMessage(error),
        };
    }

    const allGood = results.supabase?.status?.includes('✅') && results.vertexAI?.status?.includes('✅');

    return NextResponse.json({
        overall: allGood ? '🟢 Alles läuft!' : '🔴 Probleme gefunden',
        ...results,
    });
}
