'use client';

/**
 * API-Key-Verwaltung: erstellen (Klartext wird genau einmal angezeigt),
 * auflisten, widerrufen. Konsumiert /api/keys.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface ApiKeyRow {
    readonly id: string;
    readonly key_prefix: string;
    readonly label: string;
    readonly last_used_at: string | null;
    readonly revoked_at: string | null;
    readonly created_at: string;
}

export function KeysClient() {
    const [apiKeys, setApiKeys] = useState<readonly ApiKeyRow[]>([]);
    const [newKeyLabel, setNewKeyLabel] = useState('');
    const [freshPlaintextKey, setFreshPlaintextKey] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchKeys = useCallback(async (abortSignal?: AbortSignal): Promise<ApiKeyRow[]> => {
        const response = await fetch('/api/keys', { signal: abortSignal });
        if (!response.ok) {
            throw new Error('Could not load API keys.');
        }
        const responseBody = await response.json() as { keys: ApiKeyRow[] };
        return responseBody.keys;
    }, []);

    const loadKeys = useCallback(async () => {
        try {
            setApiKeys(await fetchKeys());
        } catch {
            setLoadError('Could not load API keys.');
        }
    }, [fetchKeys]);

    useEffect(() => {
        const abortController = new AbortController();

        void fetchKeys(abortController.signal)
            .then((keyRows) => setApiKeys(keyRows))
            .catch((fetchError: unknown) => {
                if (fetchError instanceof Error && fetchError.name === 'AbortError') return;
                setLoadError('Could not load API keys.');
            });

        return () => abortController.abort();
    }, [fetchKeys]);

    async function createKey() {
        setIsCreating(true);
        setFreshPlaintextKey(null);
        try {
            const response = await fetch('/api/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: newKeyLabel }),
            });
            if (!response.ok) {
                setLoadError('Key creation failed.');
                return;
            }
            const responseBody = await response.json() as { plaintextKey: string };
            setFreshPlaintextKey(responseBody.plaintextKey);
            setNewKeyLabel('');
            await loadKeys();
        } finally {
            setIsCreating(false);
        }
    }

    async function revokeKey(keyId: string) {
        await fetch(`/api/keys/${keyId}`, { method: 'DELETE' });
        await loadKeys();
    }

    return (
        <main className="min-h-screen bg-gray-950 text-white p-8">
            <div className="max-w-2xl mx-auto">
                <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">
                    ← Dashboard
                </Link>
                <h1 className="text-2xl font-bold mt-4 mb-2">API Keys</h1>
                <p className="text-gray-400 mb-6 text-sm">
                    Machine credentials for the CLI, IDE extension, and CI. Keys are shown once at creation.
                </p>

                {loadError && <p className="text-red-400 mb-4">{loadError}</p>}

                <div className="flex gap-2 mb-6">
                    <input
                        value={newKeyLabel}
                        onChange={(changeEvent) => setNewKeyLabel(changeEvent.target.value)}
                        placeholder="Label (e.g. laptop-cli, ci-pipeline)"
                        maxLength={60}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                    />
                    <button
                        onClick={() => void createKey()}
                        disabled={isCreating || newKeyLabel.trim().length === 0}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium"
                    >
                        {isCreating ? 'Creating…' : 'Create key'}
                    </button>
                </div>

                {freshPlaintextKey && (
                    <div className="bg-emerald-950 border border-emerald-700 rounded p-4 mb-6">
                        <p className="text-sm text-emerald-300 mb-2 font-medium">
                            Copy this key now — it will not be shown again:
                        </p>
                        <code className="block bg-gray-900 rounded px-3 py-2 text-sm break-all select-all">
                            {freshPlaintextKey}
                        </code>
                    </div>
                )}

                <ul className="space-y-2">
                    {apiKeys.map((keyRow) => (
                        <li
                            key={keyRow.id}
                            className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded px-4 py-3"
                        >
                            <div>
                                <span className="font-medium text-sm">{keyRow.label}</span>
                                <span className="ml-3 text-gray-500 text-sm font-mono">{keyRow.key_prefix}…</span>
                                <p className="text-xs text-gray-500 mt-1">
                                    {keyRow.revoked_at
                                        ? 'Revoked'
                                        : keyRow.last_used_at
                                            ? `Last used ${new Date(keyRow.last_used_at).toLocaleString()}`
                                            : 'Never used'}
                                </p>
                            </div>
                            {!keyRow.revoked_at && (
                                <button
                                    onClick={() => void revokeKey(keyRow.id)}
                                    className="text-red-400 hover:text-red-300 text-sm"
                                >
                                    Revoke
                                </button>
                            )}
                        </li>
                    ))}
                    {apiKeys.length === 0 && (
                        <li className="text-gray-500 text-sm">No API keys yet.</li>
                    )}
                </ul>
            </div>
        </main>
    );
}
