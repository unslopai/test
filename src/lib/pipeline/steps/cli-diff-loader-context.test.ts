/**
 * CliDiffLoaderStep und das hochgeladene Repo-Kontextpaket (REPO_CONTEXT_SPEC
 * §12 Frage 3): der Inhalt verlässt `review_jobs.payload`, sobald der Job ihn
 * gelesen hat — auch wenn der Diff nichts Reviewbares enthält.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cliDiffLoaderStep } from '@/lib/pipeline/steps/cli-diff-loader-step';
import { buildPipelineContext } from '@/lib/pipeline/testing/context-fixture';

const { payloadUpdateMock, storedPayload } = vi.hoisted(() => ({
    payloadUpdateMock: vi.fn(),
    storedPayload: { current: {} as Record<string, unknown> },
}));

vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({
                eq: () => ({ single: () => Promise.resolve({ data: { id: 'job-under-test', payload: storedPayload.current }, error: null }) }),
            }),
            update: (jobUpdate: { payload: Record<string, unknown> }) => {
                payloadUpdateMock(jobUpdate);
                return { eq: () => ({ select: () => Promise.resolve({ data: [{ id: 'job-under-test' }], error: null }) }) };
            },
        }),
    },
}));

const CONTEXT_PACKAGE = {
    sections: [{ kind: 'schema', path: 'db/schema.sql', content: 'create table contact_messages (id int);', relatedPaths: [] }],
    omissions: [],
};

function buildLocalDiff(changedPath: string): string {
    return [
        `diff --git a/${changedPath} b/${changedPath}`,
        `--- a/${changedPath}`,
        `+++ b/${changedPath}`,
        '@@ -1 +1,2 @@',
        ' first line',
        '+second line',
        '',
    ].join('\n');
}

describe('cliDiffLoaderStep — hochgeladenes Kontextpaket', () => {
    beforeEach(() => {
        payloadUpdateMock.mockReset();
    });

    it('ersetzt den Paket-Inhalt im Payload durch Pfadliste und Größe und reicht das Paket im Speicher weiter', async () => {
        storedPayload.current = { diff: buildLocalDiff('src/lib/orders.ts'), context_package: CONTEXT_PACKAGE, dirty: true };

        const loadedContext = await cliDiffLoaderStep.execute(buildPipelineContext());

        const persistedPayload = payloadUpdateMock.mock.calls[0][0].payload;
        expect(persistedPayload.context_package).toBeNull();
        expect(persistedPayload.context_package_summary).toMatchObject({ paths: ['db/schema.sql'] });
        expect(JSON.stringify(persistedPayload)).not.toContain('contact_messages');
        expect(persistedPayload.diff).toBe(storedPayload.current.diff);
        expect(loadedContext.uploadedContextPackage).toEqual(CONTEXT_PACKAGE);
    });

    it('bereinigt den Payload auch, wenn der Diff keine reviewbare Datei enthält', async () => {
        storedPayload.current = { diff: buildLocalDiff('docs/notes.xyz'), context_package: CONTEXT_PACKAGE };

        await cliDiffLoaderStep.execute(buildPipelineContext());

        expect(payloadUpdateMock.mock.calls[0][0].payload.context_package).toBeNull();
    });

    it('schreibt den Payload nicht an, wenn kein Paket hochgeladen wurde', async () => {
        storedPayload.current = { diff: buildLocalDiff('src/lib/orders.ts') };

        const loadedContext = await cliDiffLoaderStep.execute(buildPipelineContext());

        expect(payloadUpdateMock).not.toHaveBeenCalled();
        expect(loadedContext.uploadedContextPackage).toBeUndefined();
    });
});
