/**
 * POST /api/webhook
 *
 * Empfängt GitHub Webhook-Events für Pull Requests.
 * Verarbeitet `pull_request.opened` und `pull_request.synchronize` Events.
 *
 * Ablauf:
 * 1. Raw Body lesen (für HMAC-Verifikation)
 * 2. Repository in DB finden → Webhook-Secret laden
 * 3. HMAC-Signatur verifizieren
 * 4. Event-Typ prüfen (nur pull_request.opened / synchronize)
 * 5. Job in review_jobs speichern
 * 6. Worker via after() im Hintergrund starten
 * 7. Sofort 200 OK zurückgeben
 */
import { NextResponse, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { processReviewJob } from "@/lib/worker";
import { verifyWebhookSignature } from "@/lib/github";

export const maxDuration = 60;


export async function POST(request: Request) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-hub-signature-256');
        const eventType = request.headers.get('x-github-event');

        // Kein GitHub-Event Header? Dann ist es kein echter Webhook.
        if (!eventType) {
            return NextResponse.json(
                { error: 'Fehlender X-GitHub-Event Header' },
                { status: 400 },
            );
        }

        // Ping-Events (GitHub sendet diese beim Webhook-Setup) → einfach bestätigen
        if (eventType === 'ping') {
            console.log('[Webhook] Ping Event empfangen — Webhook erfolgreich verbunden.');
            return NextResponse.json({ success: true, message: 'pong' });
        }

        // Nur pull_request Events verarbeiten
        if (eventType !== 'pull_request') {
            return NextResponse.json({
                success: true,
                message: `Event-Typ '${eventType}' wird ignoriert.`,
            });
        }

        const payload = JSON.parse(rawBody);
        const action = payload.action as string;

        // Nur 'opened' und 'synchronize' (neuer Push auf PR-Branch) verarbeiten
        if (action !== 'opened' && action !== 'synchronize') {
            return NextResponse.json({
                success: true,
                message: `PR-Action '${action}' wird ignoriert.`,
            });
        }

        const repoId = payload.repository?.id as number | undefined;
        const prNumber = payload.pull_request?.number as number | undefined;
        const prUrl = payload.pull_request?.html_url as string | undefined;
        const prHeadSha = payload.pull_request?.head?.sha as string | undefined;
        const repoFullName = payload.repository?.full_name as string | undefined;

        if (!repoId || !prNumber || !repoFullName) {
            return NextResponse.json(
                { error: 'Unvollständiger Payload: repository.id, pull_request.number und repository.full_name sind erforderlich.' },
                { status: 400 },
            );
        }

        // Repository in unserer DB finden
        const { data: repoEntry, error: repoError } = await supabase
            .from('repositories')
            .select('id, webhook_secret, user_id')
            .eq('github_repo_id', repoId)
            .single();

        if (repoError || !repoEntry) {
            console.warn(`[Webhook] Repository mit GitHub ID ${repoId} nicht in DB gefunden.`);
            return NextResponse.json(
                { error: 'Repository nicht registriert.' },
                { status: 404 },
            );
        }

        // HMAC-Signatur verifizieren
        if (!signature) {
            return NextResponse.json(
                { error: 'Fehlende Webhook-Signatur.' },
                { status: 401 },
            );
        }

        const isValid = verifyWebhookSignature(
            rawBody,
            signature,
            repoEntry.webhook_secret as string,
        );

        if (!isValid) {
            console.error(`[Webhook] Ungültige Signatur für Repo ${repoFullName}`);
            return NextResponse.json(
                { error: 'Ungültige Webhook-Signatur.' },
                { status: 401 },
            );
        }

        // Job in review_jobs speichern
        const { data: job, error: insertError } = await supabase
            .from('review_jobs')
            .insert({
                payload: {
                    repo_full_name: repoFullName,
                    pr_number: prNumber,
                    pr_url: prUrl,
                    pr_head_sha: prHeadSha,
                    action,
                },
                status: 'pending',
                source: 'webhook',
                repository_id: repoEntry.id,
                pr_number: prNumber,
                pr_url: prUrl,
            })
            .select()
            .single();

        if (insertError || !job) {
            console.error('[Webhook] Fehler beim Speichern des Jobs:', insertError);
            return NextResponse.json(
                { success: false, error: 'Konnte Job nicht erstellen' },
                { status: 500 },
            );
        }

        console.log(`[Webhook] Job ${job.id} erstellt für PR #${prNumber} in ${repoFullName}`);

        // Background-Verarbeitung starten (läuft NACH dem Response)
        after(async () => {
            await processReviewJob(job.id, repoEntry.user_id as string);
        });

        // Sofort 200 OK zurückgeben — GitHub wartet nicht
        return NextResponse.json({
            success: true,
            message: `Review für PR #${prNumber} in ${repoFullName} gestartet.`,
            jobId: job.id,
        });

    } catch (error: unknown) {
        console.error('[Webhook] Unerwarteter Fehler:', error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
