/**
 * Billing-Seite (Server Component: nur Auth-Gate, UI im Client).
 * Neue Oberfläche — Strings auf Englisch (SPEC D9).
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BillingClient } from './BillingClient';

export default async function BillingPage() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/login');
    }

    return <BillingClient />;
}
