import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

export function readFixture(relativePath: string): string {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf-8');
}

console.log(readFixture(process.argv[2] ?? 'fixtures/a.json'));
