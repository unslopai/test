import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const runShell = promisify(exec);
const VERSION_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;

export function parseVersion(versionTag: string): number[] | null {
    const versionMatch = VERSION_PATTERN.exec(versionTag);
    return versionMatch ? versionMatch.slice(1).map(Number) : null;
}

export async function runBackup(targetDirectory: string): Promise<string> {
    const backupOutput = await runShell(`tar -czf backup.tgz ${targetDirectory}`);
    return backupOutput.stdout;
}
