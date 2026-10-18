/**
 * POST /api/repos/connect
 *
 * Verbindet ein GitHub Repository mit dem Anti-Slop Gatekeeper:
 * 1. Generiert ein einzigartiges HMAC-Secret für den Webhook
 * 2. Erstellt einen Webhook auf dem Repo via GitHub API
 * 3. Speichert den Repository-Eintrag in unserer DB
 */
import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { createWebhook } from '@/lib/github';
import { decryptToken } from '@/lib/crypto';
import { extractErrorMessage } from '@/lib/errors';
import { ingestRepository } from '@/lib/skeleton';
import * as crypto from 'crypto';


interface ConnectRequestBody {
    repoId: number;
    fullName: string;
    defaultBranch: string;
}


export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Nicht authentifiziert' },
                { status: 401 },
            );
        }

        const body = await request.json() as ConnectRequestBody;

        if (!body.repoId || !body.fullName) {
            return NextResponse.json(
                { error: 'repoId und fullName sind erforderlich.' },
                { status: 400 },
            );
        }

        // Prüfen ob das Repo bereits verbunden oder deaktiviert ist
        const { data: existingRepo } = await supabaseAdmin
            .from('repositories')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('github_repo_id', body.repoId)
            .single();

        // Wenn aktiv/syncing → bereits verbunden
        if (existingRepo && existingRepo.status !== 'deactivated') {
            return NextResponse.json(
                { error: 'Repository ist bereits verbunden.' },
                { status: 409 },
            );
        }

        // GitHub Token aus DB laden
        const { data: tokenRow, error: tokenError } = await supabaseAdmin
            .from('github_tokens')
            .select('encrypted_token, token_iv, token_tag')
            .eq('user_id', user.id)
            .single();

        if (tokenError || !tokenRow) {
            return NextResponse.json(
                { error: 'Kein GitHub Token gespeichert. Bitte erneut einloggen.' },
                { status: 401 },
            );
        }

        const githubToken = decryptToken({
            encryptedToken: tokenRow.encrypted_token,
            iv: tokenRow.token_iv,
            tag: tokenRow.token_tag,
        });

        // Webhook-Secret generieren (kryptographisch sicher)
        const webhookSecret = crypto.randomBytes(32).toString('hex');

        // Webhook-URL bestimmen (ngrok für local, Vercel für prod)
        const webhookBaseUrl = process.env.WEBHOOK_BASE_URL
            ?? process.env.NEXT_PUBLIC_VERCEL_URL
            ?? 'http://localhost:3000';

        const webhookUrl = webhookBaseUrl.startsWith('http')
            ? `${webhookBaseUrl}/api/webhook`
            : `https://${webhookBaseUrl}/api/webhook`;

        // Webhook auf GitHub anlegen
        const webhook = await createWebhook(
            githubToken,
            body.fullName,
            webhookUrl,
            webhookSecret,
        );

        let repoEntry: { id: string };

        if (existingRepo) {
            // Deaktiviertes Repo reaktivieren (behält die gleiche ID = Cache-Hit für Chunks)
            const { error: reactivateError } = await supabaseAdmin
                .from('repositories')
                .update({
                    status: 'syncing',
                    webhook_id: webhook.id,
                    webhook_secret: webhookSecret,
                })
                .eq('id', existingRepo.id);

            if (reactivateError) {
                console.error('[Connect] Reaktivierung fehlgeschlagen:', reactivateError);
                return NextResponse.json(
                    { error: 'Repository konnte nicht reaktiviert werden.' },
                    { status: 500 },
                );
            }

            repoEntry = { id: existingRepo.id as string };
            console.log(`[Connect] Repo ${body.fullName} reaktiviert (gecachte Chunks werden wiederverwendet).`);
        } else {
            // Neues Repo anlegen
            const { data: newRepo, error: insertError } = await supabaseAdmin
                .from('repositories')
                .insert({
                    user_id: user.id,
                    github_repo_id: body.repoId,
                    full_name: body.fullName,
                    default_branch: body.defaultBranch ?? 'main',
                    webhook_id: webhook.id,
                    webhook_secret: webhookSecret,
                    status: 'syncing',
                })
                .select()
                .single();

            if (insertError) {
                console.error('[Connect] DB Insert fehlgeschlagen, lösche Webhook:', insertError);
                try {
                    const { deleteWebhook: deleteWh } = await import('@/lib/github');
                    await deleteWh(githubToken, body.fullName, webhook.id);
                } catch (cleanupError: unknown) {
                    console.error('[Connect] Webhook-Cleanup fehlgeschlagen:', cleanupError);
                }

                return NextResponse.json(
                    { error: 'Repository konnte nicht gespeichert werden.' },
                    { status: 500 },
                );
            }

            repoEntry = { id: newRepo.id as string };
        }

        console.log(`[Connect] Repo ${body.fullName} verbunden (Webhook ID: ${webhook.id}), starte Skeleton-Ingestion...`);

        // Skeleton-Ingestion im Hintergrund starten (nach Response)
        after(async () => {
            try {
                console.log(`[Connect/Ingest] Starte Skeleton-Ingestion für ${body.fullName}...`);

                const chunkCount = await ingestRepository(
                    repoEntry.id,
                    githubToken,
                    body.fullName,
                    body.defaultBranch ?? 'main',
                );

                // Status auf 'active' setzen nach erfolgreicher Ingestion
                await supabaseAdmin
                    .from('repositories')
                    .update({ status: 'active' })
                    .eq('id', repoEntry.id);

                console.log(`[Connect/Ingest] Ingestion fertig: ${chunkCount} Skeleton-Chunks für ${body.fullName}.`);

            } catch (ingestError: unknown) {
                console.error(`[Connect/Ingest] Ingestion fehlgeschlagen für ${body.fullName}:`, ingestError);

                // Status auf 'error' setzen, Webhook bleibt aktiv
                await supabaseAdmin
                    .from('repositories')
                    .update({ status: 'error' })
                    .eq('id', repoEntry.id);
            }
        });

        return NextResponse.json({
            success: true,
            repository: {
                id: repoEntry.id,
                full_name: body.fullName,
                status: 'syncing',
                webhook_id: webhook.id,
            },
        });

    } catch (err: unknown) {
        console.error('[POST /api/repos/connect] Fehler:', err);
        return NextResponse.json(
            { error: extractErrorMessage(err) },
            { status: 500 },
        );
    }
}
