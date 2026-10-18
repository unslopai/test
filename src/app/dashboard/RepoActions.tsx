'use client';

/**
 * Client-Komponente für die Connect/Disconnect-Buttons im Dashboard.
 *
 * Diese Komponente wird als Client Component extrahiert, damit der Rest
 * des Dashboards ein Server Component bleiben kann. Verwaltet den
 * Loading-State und die API-Aufrufe für Connect/Disconnect.
 */
import { useState } from 'react';


interface RepoActionsProps {
    repoId: number;
    fullName: string;
    defaultBranch: string;
    gatekeeperStatus: 'unconnected' | 'active' | 'syncing' | 'error';
    /** Callback wenn sich der Status ändert, triggert einen Page-Refresh */
    onStatusChange: () => void;
}

type ActionState = 'idle' | 'connecting' | 'disconnecting';


export default function RepoActions({
    repoId,
    fullName,
    defaultBranch,
    gatekeeperStatus,
    onStatusChange,
}: RepoActionsProps) {
    const [actionState, setActionState] = useState<ActionState>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);


    const handleConnect = async () => {
        setActionState('connecting');
        setErrorMessage(null);

        try {
            const response = await fetch('/api/repos/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoId, fullName, defaultBranch }),
            });

            const responseBody = await response.json();

            if (!response.ok) {
                setErrorMessage(responseBody.error ?? 'Verbindung fehlgeschlagen.');
                return;
            }

            onStatusChange();
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler');
        } finally {
            setActionState('idle');
        }
    };


    const handleDisconnect = async () => {
        setActionState('disconnecting');
        setErrorMessage(null);

        try {
            const response = await fetch('/api/repos/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoId, fullName }),
            });

            const responseBody = await response.json();

            if (!response.ok) {
                setErrorMessage(responseBody.error ?? 'Trennung fehlgeschlagen.');
                return;
            }

            onStatusChange();
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler');
        } finally {
            setActionState('idle');
        }
    };


    return (
        <div className="flex flex-col items-end gap-1.5">
            {gatekeeperStatus === 'unconnected' && (
                <button
                    id={`connect-${repoId}`}
                    onClick={handleConnect}
                    disabled={actionState !== 'idle'}
                    className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {actionState === 'connecting' ? (
                        <span className="flex items-center gap-2">
                            <LoadingSpinner />
                            Verbinde...
                        </span>
                    ) : (
                        'Aktivieren'
                    )}
                </button>
            )}

            {gatekeeperStatus === 'active' && (
                <button
                    id={`disconnect-${repoId}`}
                    onClick={handleDisconnect}
                    disabled={actionState !== 'idle'}
                    className="shrink-0 rounded-lg border border-red-800 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-900/30 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {actionState === 'disconnecting' ? (
                        <span className="flex items-center gap-2">
                            <LoadingSpinner />
                            Trenne...
                        </span>
                    ) : (
                        'Deaktivieren'
                    )}
                </button>
            )}

            {gatekeeperStatus === 'syncing' && (
                <span className="flex items-center gap-2 text-sm text-yellow-400">
                    <LoadingSpinner />
                    Synchronisiere...
                </span>
            )}

            {gatekeeperStatus === 'error' && (
                <button
                    onClick={handleConnect}
                    disabled={actionState !== 'idle'}
                    className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-500"
                >
                    Erneut verbinden
                </button>
            )}

            {errorMessage && (
                <p className="max-w-[200px] text-right text-xs text-red-400">
                    {errorMessage}
                </p>
            )}
        </div>
    );
}


/**
 * Minimaler CSS-animierter Loading-Spinner.
 * Vermeidet externe Dependencies für ein simples Lade-Indikator.
 */
function LoadingSpinner() {
    return (
        <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
}
