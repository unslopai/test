/**
 * GET/POST /api/keys — API-Key-Verwaltung (Dashboard, Cookie-Session).
 *
 * POST erzeugt einen Key und liefert den Klartext GENAU EINMAL zurück;
 * danach existiert serverseitig nur noch der Hash.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { generateApiKey } from '@/lib/api-keys';

const MAX_LABEL_LENGTH = 60;
const MAX_KEYS_PER_USER = 10;

export async function GET() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { data: keyRows, error: listError } = await supabaseAdmin
        .from('api_keys')
        .select('id, key_prefix, label, last_used_at, revoked_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (listError) {
        console.error('[ApiKeys] Listen fehlgeschlagen:', listError);
        return NextResponse.json({ error: 'list_failed' }, { status: 500 });
    }

    return NextResponse.json({ keys: keyRows ?? [] });
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const requestBody = await request.json().catch(() => null) as { label?: string } | null;
    const keyLabel = (requestBody?.label ?? '').trim();
    if (!keyLabel || keyLabel.length > MAX_LABEL_LENGTH) {
        return NextResponse.json({ error: 'invalid_label' }, { status: 422 });
    }

    const { count: activeKeyCount } = await supabaseAdmin
        .from('api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('revoked_at', null);

    if ((activeKeyCount ?? 0) >= MAX_KEYS_PER_USER) {
        return NextResponse.json({ error: 'key_limit_reached' }, { status: 409 });
    }

    const generatedKey = generateApiKey();

    const { data: insertedKey, error: insertError } = await supabaseAdmin
        .from('api_keys')
        .insert({
            user_id: user.id,
            key_hash: generatedKey.keyHash,
            key_prefix: generatedKey.keyPrefix,
            label: keyLabel,
        })
        .select('id, key_prefix, label, created_at')
        .single();

    if (insertError || !insertedKey) {
        console.error('[ApiKeys] Erzeugen fehlgeschlagen:', insertError);
        return NextResponse.json({ error: 'create_failed' }, { status: 500 });
    }

    return NextResponse.json(
        { key: insertedKey, plaintextKey: generatedKey.plaintextKey },
        { status: 201 },
    );
}
