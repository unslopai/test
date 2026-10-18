import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { encryptToken } from '@/lib/crypto';


function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const origin = getPublicOrigin(request);

  const nextParam = searchParams.get('next');
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData?.session) {

      // GitHub Provider Token verschlüsselt in der Datenbank speichern,
      // damit der Worker asynchron im Namen des Users mit der GitHub API sprechen kann.
      const providerToken = sessionData.session.provider_token;
      const userId = sessionData.session.user.id;
      const githubUsername = sessionData.session.user.user_metadata?.user_name as string | undefined;

      if (providerToken) {
        const encrypted = encryptToken(providerToken);

        const { error: upsertError } = await supabaseAdmin
          .from('github_tokens')
          .upsert(
            {
              user_id: userId,
              encrypted_token: encrypted.encryptedToken,
              token_iv: encrypted.iv,
              token_tag: encrypted.tag,
              scopes: 'repo,admin:repo_hook',
              github_username: githubUsername ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          );

        if (upsertError) {
          console.error('[Auth Callback] github_tokens upsert fehlgeschlagen:', upsertError);
          return NextResponse.redirect(`${origin}/auth/auth-code-error`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }


  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
