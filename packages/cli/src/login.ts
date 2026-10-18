/**
 * `unslop login` — API-Key (+ optionale Backend-URL) interaktiv erfassen
 * und in ~/.config/unslop/config.json (0600) speichern.
 */
import * as readline from 'node:readline/promises';
import { saveConfig } from './config.js';

export async function runLogin(): Promise<number> {
    const promptInterface = readline.createInterface({ input: process.stdin, output: process.stderr });

    try {
        const apiKey = (await promptInterface.question('API key (from the dashboard, starts with usk_): ')).trim();
        if (!apiKey.startsWith('usk_')) {
            console.error('That does not look like a Gatekeeper API key (expected usk_ prefix).');
            return 2;
        }

        const baseUrlInput = (await promptInterface.question('Backend URL (Enter for default): ')).trim();
        const configPath = saveConfig(apiKey, baseUrlInput.length > 0 ? baseUrlInput : null);

        console.error(`Saved to ${configPath}.`);
        console.error('Tip: in CI, use the UNSLOP_API_KEY environment variable instead.');
        return 0;
    } finally {
        promptInterface.close();
    }
}
