'use client';

/**
 * Client-Wrapper für das Dashboard.
 *
 * Lädt die Repo-Liste aus dem API-Endpoint und rendert die UI.
 * Getrennt vom Server Component (page.tsx), um interaktive Elemente
 * (Connect/Disconnect-Buttons, Refresh) zu ermöglichen.
 *
 * Live-Updates: Ein Supabase-Realtime-Channel subscribed auf UPDATE-Events
 * der `repositories`-Tabelle und patcht den lokalen State, ohne einen
 * kompletten API-Refetch auszulösen.
 */
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import RepoActions from './RepoActions';


interface RepoWithStatus {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    private: boolean;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    updated_at: string;
    default_branch: string;
    gatekeeper_status: 'unconnected' | 'active' | 'syncing' | 'error';
    gatekeeper_repo_id: string | null;
}

type LoadState = 'loading' | 'loaded' | 'error';

interface DashboardClientProps {
    userEmail: string;
    userName: string | null;
}

/** Payload einer Realtime-UPDATE-Nachricht auf der `repositories`-Tabelle. */
interface RepoRealtimePayload {
    new: {
        id: string;
        github_repo_id: number;
        status: string;
    };
}


export default function DashboardClient({ userEmail, userName }: DashboardClientProps) {
    const [repos, setRepos] = useState<RepoWithStatus[]>([]);
    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fetchRepos = useCallback(async (signal?: AbortSignal): Promise<RepoWithStatus[]> => {
        const response = await fetch('/api/repos', { signal });
        const responseBody = await response.json();

        if (!response.ok) {
            throw new Error(responseBody.error ?? 'Repos konnten nicht geladen werden.');
        }

        return responseBody.repos as RepoWithStatus[];
    }, []);

    const loadRepos = useCallback(async () => {
        setLoadState('loading');
        setErrorMessage(null);

        try {
            const nextRepos = await fetchRepos();
            setRepos(nextRepos);
            setLoadState('loaded');
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }
            setErrorMessage(err instanceof Error ? err.message : 'Netzwerkfehler');
            setLoadState('error');
        }
    }, [fetchRepos]);

    // Initiales Laden der Repos
    useEffect(() => {
        const controller = new AbortController();

        void fetchRepos(controller.signal)
            .then((nextRepos) => {
                setRepos(nextRepos);
                setLoadState('loaded');
            })
            .catch((err: unknown) => {
                if (err instanceof Error && err.name === 'AbortError') {
                    return;
                }
                setErrorMessage(err instanceof Error ? err.message : 'Netzwerkfehler');
                setLoadState('error');
            });

        return () => controller.abort();
    }, [fetchRepos]);

    // Supabase Realtime: Live-Updates für Repo-Status-Änderungen (syncing → active/error)
    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel('repositories-status')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'repositories' },
                (payload) => {
                    const updatedRow = (payload as unknown as RepoRealtimePayload).new;
                    const dbStatus = updatedRow.status;
                    const displayStatus = dbStatus === 'deactivated' ? 'unconnected' : dbStatus;

                    setRepos((previousRepos) =>
                        previousRepos.map((repo) => {
                            // Match via interne ID oder GitHub-Repo-ID
                            const matchesById = repo.gatekeeper_repo_id === updatedRow.id;
                            const matchesByGithubId = repo.id === updatedRow.github_repo_id;
                            if (!matchesById && !matchesByGithubId) return repo;
                            return {
                                ...repo,
                                gatekeeper_status: displayStatus as RepoWithStatus['gatekeeper_status'],
                                gatekeeper_repo_id: displayStatus === 'unconnected' ? null : updatedRow.id,
                            };
                        }),
                    );
                },
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, []);


    // Billing-Banner: Scans sind ohne aktives Abo/Trial pausiert (STRIPE_SPEC §9).
    const [scansArePaused, setScansArePaused] = useState(false);

    useEffect(() => {
        const billingAbortController = new AbortController();

        void fetch('/api/billing/status', { signal: billingAbortController.signal })
            .then(async (response) => {
                if (!response.ok) return;
                const billingStatus = await response.json() as { entitled: boolean };
                setScansArePaused(!billingStatus.entitled);
            })
            .catch(() => {
                // Banner ist rein informativ — Fehler hier nie eskalieren.
            });

        return () => billingAbortController.abort();
    }, []);

    const activeCount = repos.filter((repo) => repo.gatekeeper_status === 'active').length;

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
                        {activeCount > 0 && (
                            <span className="rounded-full bg-emerald-900/50 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                                {activeCount} aktiv
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">
                            {userName ?? userEmail}
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
                {scansArePaused && (
                    <div className="mb-6 rounded-lg border border-yellow-700 bg-yellow-950/60 px-4 py-3 text-sm">
                        ⚠️ Scans are paused — no active subscription or trial.{' '}
                        <a href="/dashboard/settings/billing" className="font-medium text-yellow-300 underline hover:text-yellow-200">
                            Start your 14-day trial
                        </a>
                    </div>
                )}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">Deine Repositories</h2>
                    <button
                        onClick={() => {
                            void loadRepos();
                        }}
                        disabled={loadState === 'loading'}
                        className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-gray-800 disabled:opacity-50"
                    >
                        {loadState === 'loading' ? 'Laden...' : 'Aktualisieren'}
                    </button>
                </div>

                {errorMessage && (
                    <div className="mb-6 rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                        {errorMessage}
                    </div>
                )}

                {loadState === 'loading' && repos.length === 0 && (
                    <div className="flex items-center gap-3 py-12 text-gray-500">
                        <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Lade Repositories...
                    </div>
                )}

                {loadState === 'loaded' && repos.length === 0 && (
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
                                    {/* Status-Indikator */}
                                    <span
                                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                            repo.gatekeeper_status === 'active'
                                                ? 'bg-emerald-500'
                                                : repo.gatekeeper_status === 'syncing'
                                                  ? 'bg-yellow-500 animate-pulse'
                                                  : repo.gatekeeper_status === 'error'
                                                    ? 'bg-red-500'
                                                    : 'bg-gray-600'
                                        }`}
                                        title={
                                            repo.gatekeeper_status === 'active'
                                                ? 'Gatekeeper aktiv'
                                                : repo.gatekeeper_status === 'syncing'
                                                  ? 'Synchronisiert...'
                                                  : repo.gatekeeper_status === 'error'
                                                    ? 'Fehler'
                                                    : 'Nicht verbunden'
                                        }
                                    />

                                    <a
                                        href={repo.html_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate font-medium text-white hover:underline"
                                    >
                                        {repo.full_name}
                                    </a>

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
                                        <span>★ {repo.stargazers_count}</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {repo.gatekeeper_status === 'active' && repo.gatekeeper_repo_id && (
                                    <a
                                        href={`/dashboard/repos/${repo.gatekeeper_repo_id}/settings`}
                                        title="Pipeline-Einstellungen"
                                        className="shrink-0 rounded-lg border border-gray-700 p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.212-1.281c-.063-.374-.313-.686-.645-.87a6.47 6.47 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7.72 7.72 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                        </svg>
                                    </a>
                                )}
                                <RepoActions
                                    repoId={repo.id}
                                    fullName={repo.full_name}
                                    defaultBranch={repo.default_branch}
                                    gatekeeperStatus={repo.gatekeeper_status}
                                    onStatusChange={() => {
                                        void loadRepos();
                                    }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            </main>
        </div>
    );
}
