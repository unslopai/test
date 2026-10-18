'use client';

/**
 * Data layer of the "Open pull requests" card (GITHUB_APP_SPEC.md §4.10):
 * GET /api/repos/[id]/pulls for the list. Same house pattern as
 * useScanHistory: promise chains, setState only in callbacks, one
 * AbortController for the in-flight request, aborted on unmount and on reload.
 * The "Review now" clicks live in useReviewSubmissions.
 *
 * A legacy repository (no app installation) never loads: the list needs the
 * installation token and the route would answer 409.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowRefocus, type LoadState } from '../../useDashboardSync';
import { readOpenPullRequests, type OpenPullRequestView } from './open-pull-requests-state';

export interface OpenPullRequestsSync {
    readonly pullRequests: readonly OpenPullRequestView[];
    readonly loadState: LoadState;
    readonly errorMessage: string | null;
    readonly refresh: () => void;
    readonly refreshSilently: () => void;
}

async function fetchOpenPullRequests(
    repoId: string,
    signal: AbortSignal,
    loadFailedMessage: string,
): Promise<OpenPullRequestView[]> {
    const response = await fetch(`/api/repos/${encodeURIComponent(repoId)}/pulls`, { signal });
    // Status first: a gateway error page is HTML, and its parser message must
    // never reach the error box. Error bodies carry only codes (SERVER_AUDIT_2026-09 L4).
    if (!response.ok) {
        throw new Error(loadFailedMessage);
    }
    const pullRequests = readOpenPullRequests(await response.json());
    if (pullRequests === null) {
        throw new Error(loadFailedMessage);
    }
    return pullRequests;
}

export function useOpenPullRequests(repoId: string, enabled: boolean, loadFailedMessage: string): OpenPullRequestsSync {
    const [pullRequests, setPullRequests] = useState<readonly OpenPullRequestView[]>([]);
    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const listRequestRef = useRef<AbortController | null>(null);

    const loadList = useCallback((silent: boolean) => {
        listRequestRef.current?.abort();
        const requestController = new AbortController();
        listRequestRef.current = requestController;
        return fetchOpenPullRequests(repoId, requestController.signal, loadFailedMessage)
            .then((loadedPullRequests) => {
                setPullRequests(loadedPullRequests);
                setLoadState('loaded');
                setErrorMessage(null);
            })
            .catch((loadError: unknown) => {
                if (loadError instanceof Error && loadError.name === 'AbortError') return;
                if (silent) {
                    // A background refresh must not replace a working list with an error.
                    console.error('[OpenPullRequests] Background refresh failed:', loadError);
                    return;
                }
                setErrorMessage(loadError instanceof Error ? loadError.message : loadFailedMessage);
                setLoadState('error');
            });
    }, [repoId, loadFailedMessage]);

    useEffect(() => {
        if (enabled) {
            void loadList(false);
        }
        return () => listRequestRef.current?.abort();
    }, [enabled, loadList]);

    const refresh = useCallback(() => {
        setLoadState('loading');
        setErrorMessage(null);
        void loadList(false);
    }, [loadList]);

    const refreshSilently = useCallback(() => {
        if (enabled) void loadList(true);
    }, [enabled, loadList]);
    useWindowRefocus(refreshSilently);

    return { pullRequests, loadState, errorMessage, refresh, refreshSilently };
}
