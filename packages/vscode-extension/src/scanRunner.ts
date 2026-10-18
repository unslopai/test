/**
 * Führt `unslop scan --json` als Kindprozess aus und parst das ScanResult.
 *
 * CLI-Auflösung: Setting unslop.cliPath, sonst 'unslop' aus PATH.
 * ENOENT wird als CliNotFoundError gemeldet (Install-Prompt in extension.ts).
 */
import { execFile } from 'node:child_process';
import type { ExecFileException } from 'node:child_process';
import type { ScanResult } from '@unslop/shared';
import * as vscode from 'vscode';

export class CliNotFoundError extends Error {}
export class ScanFailedError extends Error {}

const SCAN_TIMEOUT_MS = 180_000;

export function resolveCliCommand(): string {
    const configuredPath = vscode.workspace.getConfiguration('unslop').get<string>('cliPath', '').trim();
    return configuredPath.length > 0 ? configuredPath : 'unslop';
}

/** Ermittelt die Wurzel des git-Repos (Findings-Pfade sind repo-relativ). */
export function resolveRepoRoot(workspaceFolder: string): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(
            'git',
            ['rev-parse', '--show-toplevel'],
            { cwd: workspaceFolder, encoding: 'utf-8' },
            (gitError, stdout) => {
                if (gitError) {
                    reject(new ScanFailedError('The workspace folder is not inside a git repository.'));
                    return;
                }
                resolve(stdout.trim());
            },
        );
    });
}

export function runScan(workspaceFolder: string): Promise<ScanResult> {
    const cliCommand = resolveCliCommand();
    const settings = vscode.workspace.getConfiguration('unslop');

    const childEnv = { ...process.env };
    const apiKeySetting = settings.get<string>('apiKey', '').trim();
    const baseUrlSetting = settings.get<string>('baseUrl', '').trim();
    if (apiKeySetting) childEnv.UNSLOP_API_KEY = apiKeySetting;
    if (baseUrlSetting) childEnv.UNSLOP_BASE_URL = baseUrlSetting;

    return new Promise((resolve, reject) => {
        execFile(
            cliCommand,
            ['scan', '--json', '--fail-on', 'none'],
            {
                cwd: workspaceFolder,
                env: childEnv,
                timeout: SCAN_TIMEOUT_MS,
                maxBuffer: 10 * 1024 * 1024,
                encoding: 'utf-8',
                shell: process.platform === 'win32', // npm-Shims (unslop.cmd) brauchen eine Shell
            },
            (spawnError, stdout, stderr) => {
                if (spawnError && isCommandNotFound(spawnError, stderr)) {
                    reject(new CliNotFoundError(cliCommand));
                    return;
                }
                // Exit-Code 1 (Findings) ist hier KEIN Fehler — --fail-on none verhindert ihn ohnehin.
                if (spawnError && stdout.trim().length === 0) {
                    reject(new ScanFailedError(stderr.trim() || spawnError.message));
                    return;
                }
                try {
                    resolve(JSON.parse(stdout.trim()) as ScanResult);
                } catch {
                    reject(new ScanFailedError(`CLI returned invalid JSON: ${stdout.substring(0, 200)}`));
                }
            },
        );
    });
}

function isCommandNotFound(spawnError: ExecFileException, stderr: string): boolean {
    if (spawnError.code === 'ENOENT') return true;
    // Unter shell:true (Windows) meldet cmd.exe "is not recognized" statt ENOENT.
    return /is not recognized|command not found/i.test(stderr);
}
