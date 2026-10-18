/**
 * Unit Tests: Validation-Boundary und Prüffragen von Condition 12
 * (REPO_CONTEXT_SPEC §7.1).
 */
import { describe, expect, it } from 'vitest';
import {
    REPOSITORY_MISMATCH_RULE_LABEL,
    buildRepositoryMismatchQuestion,
    repositoryMismatchGroupKey,
    resolveRepositoryMismatchIssue,
} from '@/lib/pipeline/repository-mismatch';
import { buildReviewIssue } from '@/lib/pipeline/testing/context-fixture';
import type { RepoContextPackage } from '@unslop/shared/repo-context';

const COMPLETE_PACKAGE: RepoContextPackage = {
    sections: [
        { kind: 'schema', path: 'db/schema.sql', content: 'create table contact_messages (id int);', relatedPaths: [] },
        { kind: 'manifest', path: 'web/package.json', content: '{"dependencies":{"pg":"^8"}}', relatedPaths: [] },
    ],
    omissions: [],
    schemaCandidateCount: 1,
    pathListTruncated: false,
};

const MISMATCH_ISSUE = buildReviewIssue({ rule: 'Condition 12 (Repository Mismatch)', severity: 'CRITICAL' });

describe('resolveRepositoryMismatchIssue', () => {
    it('lässt andere Regeln unverändert durch', () => {
        const lexicalIssue = buildReviewIssue();

        expect(resolveRepositoryMismatchIssue(lexicalIssue, { contextPath: undefined, mismatchKind: undefined }, null))
            .toBe(lexicalIssue);
    });

    it('verwirft den Befund ohne Paket und ohne zitierte Datei im Paket', () => {
        const citedSchema = { contextPath: 'db/schema.sql', mismatchKind: 'schema' };

        expect(resolveRepositoryMismatchIssue(MISMATCH_ISSUE, citedSchema, null)).toBeNull();
        expect(resolveRepositoryMismatchIssue(
            MISMATCH_ISSUE, { contextPath: 'config/secret.yml', mismatchKind: 'schema' }, COMPLETE_PACKAGE,
        )).toBeNull();
        expect(resolveRepositoryMismatchIssue(
            MISMATCH_ISSUE, { contextPath: 42, mismatchKind: 'schema' }, COMPLETE_PACKAGE,
        )).toBeNull();
    });

    it('trägt Evidenz und festen Rule-String; CRITICAL bleibt bei vollständig gezeigtem Schema', () => {
        const resolvedIssue = resolveRepositoryMismatchIssue(
            { ...MISMATCH_ISSUE, rule: 'Condition 12 (anything the model wrote)' },
            { contextPath: '[schema] db/schema.sql', mismatchKind: 'schema' },
            COMPLETE_PACKAGE,
        );

        expect(resolvedIssue?.rule).toBe(REPOSITORY_MISMATCH_RULE_LABEL);
        expect(resolvedIssue?.severity).toBe('CRITICAL');
        expect(resolvedIssue?.repoMismatch).toEqual({ contextPath: 'db/schema.sql', mismatchKind: 'schema' });
    });

    it('stuft auf WARNING ab, wenn die Dateiart unvollständig ist oder die Art eine Entwurfsentscheidung sein kann', () => {
        const twoSchemaCandidates = { ...COMPLETE_PACKAGE, schemaCandidateCount: 2 };
        const citedSchema = { contextPath: 'db/schema.sql', mismatchKind: 'schema' };

        expect(resolveRepositoryMismatchIssue(MISMATCH_ISSUE, citedSchema, twoSchemaCandidates)?.severity).toBe('WARNING');
        expect(resolveRepositoryMismatchIssue(
            MISMATCH_ISSUE, { contextPath: 'db/schema.sql', mismatchKind: 'in_memory_state' }, COMPLETE_PACKAGE,
        )?.severity).toBe('WARNING');
        expect(resolveRepositoryMismatchIssue(
            MISMATCH_ISSUE, { contextPath: 'web/package.json', mismatchKind: 'second_database' }, COMPLETE_PACKAGE,
        )?.severity).toBe('WARNING');
    });

    it('verwirft einen Befund, dessen Art nicht zur zitierten Datei passt', () => {
        const treePackage: RepoContextPackage = {
            ...COMPLETE_PACKAGE,
            sections: [
                ...COMPLETE_PACKAGE.sections,
                { kind: 'file_tree', path: '(file tree near the changed files)', content: 'web/app/', relatedPaths: [] },
            ],
        };

        // Ein Manifest belegt keine fehlende Tabelle, ein Dateibaum belegt nichts.
        expect(resolveRepositoryMismatchIssue(
            MISMATCH_ISSUE, { contextPath: 'web/package.json', mismatchKind: 'schema' }, treePackage,
        )).toBeNull();
        expect(resolveRepositoryMismatchIssue(
            MISMATCH_ISSUE, { contextPath: '(file tree near the changed files)', mismatchKind: 'unloaded_entry' }, treePackage,
        )).toBeNull();
    });

    it('leitet eine fehlende Art aus der zitierten Datei ab', () => {
        const resolvedIssue = resolveRepositoryMismatchIssue(
            MISMATCH_ISSUE, { contextPath: 'web/package.json', mismatchKind: 'made-up' }, COMPLETE_PACKAGE,
        );

        expect(resolvedIssue?.repoMismatch?.mismatchKind).toBe('manifest');
    });
});

describe('Prüffrage und Aggregations-Schlüssel', () => {
    it('baut die feste Frage mit Fundort und Kontextdatei', () => {
        const resolvedIssue = resolveRepositoryMismatchIssue(
            { ...MISMATCH_ISSUE, path: 'web/app/api/contact/route.ts', line: 17 },
            { contextPath: 'db/schema.sql', mismatchKind: 'schema' },
            COMPLETE_PACKAGE,
        );
        const verificationQuestion = resolvedIssue ? buildRepositoryMismatchQuestion(resolvedIssue) : null;

        expect(verificationQuestion).toContain('web/app/api/contact/route.ts:17');
        expect(verificationQuestion).toContain('schema excerpt "db/schema.sql"');
        expect(buildRepositoryMismatchQuestion(buildReviewIssue())).toBeNull();
        // Pfade sind Fremdtext: Ersetzungsmuster darin bleiben wörtlich.
        expect(buildRepositoryMismatchQuestion({
            ...MISMATCH_ISSUE, path: 'app/$&/{line}.ts', repoMismatch: { contextPath: 'db/schema.sql', mismatchKind: 'schema' },
        })).toContain('app/$&/{line}.ts:42');
    });

    it('trennt Befunde derselben Datei nach Art und Kontextdatei', () => {
        const schemaIssue = { ...MISMATCH_ISSUE, repoMismatch: { contextPath: 'db/schema.sql', mismatchKind: 'schema' as const } };
        const manifestIssue = { ...MISMATCH_ISSUE, repoMismatch: { contextPath: 'web/package.json', mismatchKind: 'manifest' as const } };

        expect(repositoryMismatchGroupKey(schemaIssue)).not.toBe(repositoryMismatchGroupKey(manifestIssue));
        expect(repositoryMismatchGroupKey(buildReviewIssue())).toBeNull();
    });
});
