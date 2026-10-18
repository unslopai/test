/**
 * DELETE /api/keys/[id] — Widerruft einen API-Key (Soft-Revoke via revoked_at).
 * Cookie-Session, Owner-Check über user_id.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { id: keyId } = await params;

    const { data: revokedKey, error: revokeError } = await supabaseAdmin
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId)
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .select('id')
        .single();

    if (revokeError || !revokedKey) {
        return NextResponse.json({ error: 'key_not_found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
