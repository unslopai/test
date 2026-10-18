#!/usr/bin/env node
/**
 * unslop — Anti-AI-Slop Gatekeeper CLI.
 *
 * Befehle:
 *   unslop login                 API-Key konfigurieren
 *   unslop scan [options]        Lokalen Diff gegen die Merge-Base scannen
 *
 * Scan-Optionen:
 *   --json                Maschinenlesbare Ausgabe (ScanResult)
 *   --fail-on <level>     critical (Default) | warning | none
 *   --base <ref>          Explizite Basis statt origin/<default branch>
 *   --timeout <seconds>   Polling-Timeout (Default 120)
 */
import { runLogin } from './login.js';
import { runScan, parseScanOptions, UsageError } from './scan.js';

const USAGE = `unslop — Anti-AI-Slop Gatekeeper CLI

Usage:
  unslop login                          Configure your API key
  unslop scan [--json] [--fail-on critical|warning|none]
              [--base <ref>] [--timeout <seconds>]

Exit codes: 0 = clean/below threshold, 1 = findings at/above threshold, 2 = error.
Environment: UNSLOP_API_KEY, UNSLOP_BASE_URL override the config file.`;

async function main(): Promise<number> {
    const [command, ...commandArgs] = process.argv.slice(2);

    switch (command) {
        case 'login':
            return runLogin();
        case 'scan':
            try {
                return await runScan(parseScanOptions(commandArgs));
            } catch (optionError: unknown) {
                if (optionError instanceof UsageError) {
                    console.error(optionError.message);
                    return 2;
                }
                throw optionError;
            }
        case '--help':
        case 'help':
        case undefined:
            console.log(USAGE);
            return command === undefined ? 2 : 0;
        default:
            console.error(`Unknown command: ${command}\n\n${USAGE}`);
            return 2;
    }
}

main().then(
    (exitCode) => { process.exitCode = exitCode; },
    (fatalError: unknown) => {
        console.error(`Fatal: ${(fatalError as Error).message}`);
        process.exitCode = 2;
    },
);
