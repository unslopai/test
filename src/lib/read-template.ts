import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

export function readTemplate(relativePath: string): string {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf-8');
}
