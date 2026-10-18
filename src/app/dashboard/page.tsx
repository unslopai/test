import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { extractErrorMessage } from '@/lib/errors';


interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
}


export default async function DashboardPage() {
  const supabase = await createClient();


  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }


  const {
    data: { session },
  } = await supabase.auth.getSession();

  const providerToken = session?.provider_token;


  let repos: GitHubRepo[] = [];
  let fetchError: string | null = null;

  if (providerToken) {
    try {
      const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          Authorization: `Bearer ${providerToken}`,
          Accept: 'application/vnd.github+json',
        },

        cache: 'no-store',
      });

      if (!res.ok) {
        fetchError = `GitHub API Fehler: ${res.status} ${res.statusText}`;
      } else {
        repos = await res.json();
      }
    } catch (err: unknown) {
      fetchError = extractErrorMessage(err);
    }
  } else {
    fetchError =
      'Kein GitHub Access Token vorhanden. Bitte melde dich erneut an, damit der Token gespeichert wird.';
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {user.email ?? user.user_metadata?.user_name}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-gray-800"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-6 text-2xl font-semibold">Deine Repositories</h2>

        {fetchError && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
            {fetchError}
          </div>
        )}

        {repos.length === 0 && !fetchError && (
          <p className="text-gray-500">Keine Repositories gefunden.</p>
        )}

        <ul className="grid gap-3">
          {repos.map((repo) => (
            <li
              key={repo.id}
              className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 transition hover:border-gray-700"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-white">
                    {repo.full_name}
                  </span>
                  {repo.private && (
                    <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-400">
                      Private
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="mt-1 truncate text-sm text-gray-500">
                    {repo.description}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-600">
                  {repo.language && <span>{repo.language}</span>}
                  {repo.stargazers_count > 0 && (
                    <span>⭐ {repo.stargazers_count}</span>
                  )}
                </div>
              </div>

              <button
                className="ml-4 shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 active:scale-[0.97]"
              >
                Diesen Repo verbinden
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
