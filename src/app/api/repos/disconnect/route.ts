/**
 * POST /api/repos/disconnect
 *
 * Trennt ein GitHub Repository vom Anti-Slop Gatekeeper:
 * 1. Löscht den Webhook auf GitHub
 * 2. Setzt den Repository-Status auf 'deactivated' (Soft-Delete)
 * 3. Markiert zugehörige code_chunks als deaktiviert (30-Tage Cache)
 *
 * Das Repository und seine Chunks werden NICHT gelöscht, damit beim
 * Reaktivieren die Vektoren wiederverwendet werden können (Delta-Ingest).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { deleteWebhook } from '@/lib/github';
import { decryptToken } from '@/lib/crypto';
import { extractErrorMessage } from '@/lib/errors';
import { deactivateRepositoryChunks } from '@/lib/chunk-retention';


interface DisconnectRequestBody {
    repoId: number;
    fullName: string;
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

        const body = await request.json() as DisconnectRequestBody;

        if (!body.repoId || !body.fullName) {
            return NextResponse.json(
                { error: 'repoId und fullName sind erforderlich.' },
                { status: 400 },
            );
        }

        // Repository-Eintrag aus DB laden (für Webhook ID)
        const { data: repoEntry, error: fetchError } = await supabaseAdmin
            .from('repositories')
            .select('id, webhook_id, status')
            .eq('user_id', user.id)
            .eq('github_repo_id', body.repoId)
            .single();

        if (fetchError || !repoEntry) {
            return NextResponse.json(
                { error: 'Repository ist nicht verbunden.' },
                { status: 404 },
            );
        }

        // Schon getrennt: nichts anfassen. Ein zweites Trennen setzte sonst
        // updated_at neu und finge die 30-Tage-Löschfrist von vorn an.
        if (repoEntry.status === 'deactivated') {
            return NextResponse.json({
                success: true,
                message: `Repository ${body.fullName} war bereits getrennt.`,
            });
        }

        // Code-Chunks zuerst soft-deleten (Vektoren bleiben 30 Tage als Cache).
        // Wirft bei einem Fehler (500, Repo bleibt unverändert verbunden): ein
        // als getrennt gemeldetes Repo mit aktiven Skeletten widerspräche der
        // Datenschutzerklärung. Vor dem Webhook-Delete, damit ein Fehler hier
        // kein aktives Repo ohne Webhook hinterlässt.
        const nowIso = new Date().toISOString();
        await deactivateRepositoryChunks([repoEntry.id], nowIso);

        // Nur der OAuth-Pfad hat einen Repo-Webhook, den wir löschen müssten —
        // und nur dafür brauchen wir das User-Token. Ein App-Repo hier am
        // fehlenden github_tokens-Eintrag scheitern zu lassen, würde es
        // unlöschbar machen.
        if (repoEntry.webhook_id) {
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

            try {
                await deleteWebhook(
                    githubToken,
                    body.fullName,
                    repoEntry.webhook_id as number,
                );
            } catch (webhookError: unknown) {
                // Webhook könnte schon manuell gelöscht worden sein — wir loggen es und fahren fort
                console.warn('[Disconnect] Webhook konnte nicht gelöscht werden (evtl. bereits entfernt):', webhookError);
            }
        }

        // Repository-Eintrag soft-deleten (KEIN DELETE, sonst CASCADE löscht die Chunks).
        // installation_id bleibt bewusst stehen: die GitHub App ist weiterhin
        // installiert, nur das Review ist abbestellt. Reviews werden am
        // 'deactivated'-Gate übersprungen, und ein späteres "Aktivieren" erkennt
        // an der installation_id, dass es kein neuer OAuth-Webhook sein darf.
        const { error: repoUpdateError } = await supabaseAdmin
            .from('repositories')
            .update({
                status: 'deactivated',
                webhook_id: null,
                webhook_secret: null,
                updated_at: nowIso,
            })
            .eq('id', repoEntry.id);

        if (repoUpdateError) {
            console.error('[Disconnect] Fehler beim Deaktivieren des Repositories:', repoUpdateError);
            return NextResponse.json(
                { error: 'Datenbankfehler beim Deaktivieren.' },
                { status: 500 },
            );
        }

        console.log(`[Disconnect] Repo ${body.fullName} deaktiviert, Chunks eingefroren.`);

        return NextResponse.json({
            success: true,
            message: `Repository ${body.fullName} wurde getrennt.`,
        });

    } catch (err: unknown) {
        console.error('[POST /api/repos/disconnect] Fehler:', err);
        return NextResponse.json(
            { error: extractErrorMessage(err) },
            { status: 500 },
        );
    }
}
