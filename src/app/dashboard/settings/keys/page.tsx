/**
 * API-Key-Verwaltung (Server Component: nur Auth-Gate, UI im Client).
 * Neue Oberfläche — Strings auf Englisch (SPEC.md D9).
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KeysClient } from './KeysClient';

export default async function ApiKeysPage() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/login');
    }

    return <KeysClient />;
}
