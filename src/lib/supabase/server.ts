import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { extractErrorMessage } from '@/lib/errors';


export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch (error: unknown) {
            throw new Error(
              `Supabase-Cookies konnten im Server-Kontext nicht gesetzt werden: ${extractErrorMessage(error)}`,
            );
          }
        },
      },
    },
  );
}
