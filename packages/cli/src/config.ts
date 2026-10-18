/**
 * CLI-Konfiguration: API-Key + Backend-URL.
 *
 * Auflösungsreihenfolge: Env (UNSLOP_API_KEY / UNSLOP_BASE_URL, CI-Pfad)
 * überschreibt die Config-Datei (~/.config/unslop/config.json, Mode 0600).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const DEFAULT_BASE_URL = 'https://unslop.dev';

export interface CliConfig {
    readonly apiKey: string | null;
    readonly baseUrl: string;
}

function configFilePath(): string {
    return path.join(os.homedir(), '.config', 'unslop', 'config.json');
}

interface StoredConfig {
    apiKey?: string;
    baseUrl?: string;
}

function readStoredConfig(): StoredConfig {
    try {
        return JSON.parse(fs.readFileSync(configFilePath(), 'utf-8')) as StoredConfig;
    } catch {
        return {};
    }
}

export function loadConfig(): CliConfig {
    const storedConfig = readStoredConfig();
    return {
        apiKey: process.env.UNSLOP_API_KEY ?? storedConfig.apiKey ?? null,
        baseUrl: normalizeBaseUrl(process.env.UNSLOP_BASE_URL ?? storedConfig.baseUrl ?? DEFAULT_BASE_URL),
    };
}

export function saveConfig(apiKey: string, baseUrl: string | null): string {
    const targetPath = configFilePath();
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    const storedConfig: StoredConfig = { apiKey };
    if (baseUrl) storedConfig.baseUrl = normalizeBaseUrl(baseUrl);

    fs.writeFileSync(targetPath, JSON.stringify(storedConfig, null, 2) + '\n', { mode: 0o600 });
    return targetPath;
}

function normalizeBaseUrl(rawUrl: string): string {
    return rawUrl.replace(/\/+$/, '');
}
