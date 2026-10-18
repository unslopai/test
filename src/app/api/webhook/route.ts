import { NextResponse, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { processJob } from "@/lib/worker";

export const maxDuration = 60; // Hobby: 10s, Pro: bis 300s

export async function POST(request: Request) {
    try {
        const payload = await request.json();

        // 1. Job in Supabase speichern
        const { data: job, error } = await supabase
            .from('review_jobs')
            .insert({ payload, status: 'pending' })
            .select()
            .single();

        if (error || !job) {
            console.error("Fehler beim Speichern des Jobs:", error);
            return NextResponse.json(
                { success: false, error: "Konnte Job nicht erstellen" },
                { status: 500 }
            );
        }

        console.log(`[Webhook] Job ${job.id} erstellt, starte Background-Verarbeitung...`);

        // 2. Background-Verarbeitung starten (läuft NACH dem Response)
        after(async () => {
            await processJob(job.id);
        });

        // 3. Sofort 200 OK zurückgeben — GitHub wartet nicht
        return NextResponse.json({
            success: true,
            message: "Webhook received and queued",
            jobId: job.id,
        });

    } catch (error) {
        console.error("Error processing webhook:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
