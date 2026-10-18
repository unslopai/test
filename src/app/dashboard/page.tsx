/**
 * Dashboard Page (Server Component).
 *
 * Authentifiziert den User serverseitig und übergibt die User-Daten
 * an den DashboardClient. Die interaktive Repo-Liste wird clientseitig
 * gerendert, damit Connect/Disconnect-Buttons funktionieren.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardClient from './DashboardClient';


export default async function DashboardPage() {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        redirect('/login');
    }

    const userEmail = user.email ?? '';
    const userName = (user.user_metadata?.user_name as string) ?? null;

    return (
        <DashboardClient
            userEmail={userEmail}
            userName={userName}
        />
    );
}
