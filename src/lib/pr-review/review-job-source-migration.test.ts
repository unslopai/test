/**
 * Guard: jede Quelle, die der Code nach `review_jobs.source` schreibt, steht im
 * CHECK der jüngsten Migration, die `review_jobs_source_check` definiert.
 * Ohne 'dashboard' im CHECK scheitert der Insert von „Review now“ erst zur
 * Laufzeit (GITHUB_APP_SPEC.md §4.10, Migration 064).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIRECTORY = path.resolve(__dirname, '../../../supabase/migrations');

/** Was der Code heute schreibt: webhook-Route, cli/scan, PR-Einreiche-Pfad (mcp, dashboard), Alt-Jobs. */
const WRITTEN_JOB_SOURCES: readonly string[] = ['manual', 'webhook', 'cli', 'mcp', 'dashboard'];

function readLatestSourceCheck(): { readonly migrationFile: string; readonly migrationSql: string } {
    const sourceCheckMigrations = readdirSync(MIGRATIONS_DIRECTORY)
        .filter((migrationFile) => migrationFile.endsWith('.sql'))
        .sort()
        .map((migrationFile) => ({
            migrationFile,
            migrationSql: readFileSync(path.join(MIGRATIONS_DIRECTORY, migrationFile), 'utf8'),
        }))
        .filter(({ migrationSql }) => /ADD CONSTRAINT review_jobs_source_check/.test(migrationSql));
    return sourceCheckMigrations[sourceCheckMigrations.length - 1];
}

function allowedSourcesOf(migrationSql: string): string[] {
    const sqlWithoutComments = migrationSql.replace(/--.*$/gm, '');
    const checkArray = /review_jobs_source_check\s+CHECK \(source = ANY \(ARRAY\[([^\]]*)\]/.exec(sqlWithoutComments)?.[1] ?? '';
    return [...checkArray.matchAll(/'([a-z_]+)'::text/g)].map((sourceMatch) => sourceMatch[1]);
}

describe('review_jobs.source CHECK', () => {
    it('is last redefined by migration 064', () => {
        expect(readLatestSourceCheck().migrationFile).toBe('064_review_jobs_source_dashboard.sql');
    });

    it('allows every source the code writes, dashboard included', () => {
        const allowedSources = allowedSourcesOf(readLatestSourceCheck().migrationSql);

        expect([...allowedSources].sort()).toEqual([...WRITTEN_JOB_SOURCES].sort());
    });

    it('documents the rollback to the previous CHECK', () => {
        const { migrationSql } = readLatestSourceCheck();

        expect(migrationSql).toMatch(/Rollback/);
        expect(migrationSql).toMatch(/--\s+CHECK \(source = ANY \(ARRAY\['manual'::text, 'webhook'::text, 'cli'::text, 'mcp'::text\]\)\);/);
    });
});
