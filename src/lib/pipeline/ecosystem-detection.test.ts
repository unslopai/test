/**
 * Unit Tests: Ecosystem Detection (BEST_PRACTICES_PLAN §9.2).
 *
 * Repo-Ebene (Tree + Manifeste), Diff-Ebene (Dateipfade) und das
 * PROC-009-Schnittmengen-Gate. Reines Modul — keine Mocks nötig.
 */
import { describe, expect, it, vi } from 'vitest';
import {
    detectDiffEcosystems,
    detectRepoEcosystems,
    intersectEcosystems,
} from '@/lib/pipeline/ecosystem-detection';

const NEXTJS_PACKAGE_JSON = JSON.stringify({
    dependencies: { next: '16.2.4', react: '19.0.0' },
    devDependencies: { typescript: '5.6.0' },
});

function stubManifestLoader(contentByPath: Record<string, string>) {
    return vi.fn(async (manifestPath: string) => contentByPath[manifestPath] ?? null);
}

describe('detectRepoEcosystems', () => {
    it('erkennt ein Next.js/TypeScript-Repo vollständig', async () => {
        const treePaths = ['package.json', 'tsconfig.json', 'src/app/page.tsx'];
        const loadManifest = stubManifestLoader({ 'package.json': NEXTJS_PACKAGE_JSON });

        const detectedEcosystems = await detectRepoEcosystems(treePaths, loadManifest);

        expect(detectedEcosystems).toEqual(['nextjs', 'react', 'typescript', 'nodejs']);
    });

    it('erkennt ein Go-Repo ohne Manifest-Fetch', async () => {
        const loadManifest = stubManifestLoader({});

        const detectedEcosystems = await detectRepoEcosystems(['go.mod', 'cmd/main.go'], loadManifest);

        expect(detectedEcosystems).toEqual(['go']);
        expect(loadManifest).not.toHaveBeenCalled();
    });

    it('erkennt java-spring nur bei Spring-Referenz im Java-Manifest', async () => {
        const springTree = ['pom.xml', 'src/main/java/App.java'];

        const withSpring = await detectRepoEcosystems(
            springTree,
            stubManifestLoader({ 'pom.xml': '<artifactId>spring-boot-starter-web</artifactId>' }),
        );
        const withoutSpring = await detectRepoEcosystems(
            springTree,
            stubManifestLoader({ 'pom.xml': '<artifactId>quarkus-core</artifactId>' }),
        );

        expect(withSpring).toEqual(['java-spring']);
        expect(withoutSpring).toEqual([]);
    });

    it('erkennt Python über die Manifest-Basenames', async () => {
        const detectedEcosystems = await detectRepoEcosystems(
            ['pyproject.toml', 'src/main.py'],
            stubManifestLoader({}),
        );

        expect(detectedEcosystems).toEqual(['python']);
    });

    it('ignoriert node_modules und vendor vollständig', async () => {
        const loadManifest = stubManifestLoader({});

        const detectedEcosystems = await detectRepoEcosystems(
            ['node_modules/leftpad/package.json', 'vendor/lib/go.mod'],
            loadManifest,
        );

        expect(detectedEcosystems).toEqual([]);
        expect(loadManifest).not.toHaveBeenCalled();
    });

    it('überlebt ein unparsebares package.json (nodejs bleibt, Frameworks entfallen)', async () => {
        const detectedEcosystems = await detectRepoEcosystems(
            ['package.json'],
            stubManifestLoader({ 'package.json': '{ kein json' }),
        );

        expect(detectedEcosystems).toEqual(['nodejs']);
    });

    it('deckelt Manifest-Fetches pro Familie und bevorzugt flache Pfade', async () => {
        const monorepoTree = [
            'apps/deep/nested/web/package.json',
            'package.json',
            'apps/api/package.json',
            'apps/web/package.json',
        ];
        const loadManifest = stubManifestLoader({});

        await detectRepoEcosystems(monorepoTree, loadManifest);

        expect(loadManifest).toHaveBeenCalledTimes(3);
        expect(loadManifest.mock.calls[0][0]).toBe('package.json');
    });
});

describe('detectDiffEcosystems', () => {
    it('mappt eine Next.js-Seite auf die volle JS-Familie', () => {
        expect(detectDiffEcosystems(['src/app/page.tsx'])).toEqual(
            ['nextjs', 'react', 'typescript', 'nodejs'],
        );
    });

    it('mappt reine TS-Utilities ohne React/Next', () => {
        expect(detectDiffEcosystems(['src/lib/util.ts'])).toEqual(['typescript', 'nodejs']);
    });

    it('mappt Python-, Go- und Java-Dateien auf ihre Ökosysteme', () => {
        expect(detectDiffEcosystems(['svc/main.py'])).toEqual(['python']);
        expect(detectDiffEcosystems(['pkg/handler.go'])).toEqual(['go']);
        expect(detectDiffEcosystems(['src/main/java/App.java'])).toEqual(['java-spring']);
    });

    it('liefert leer für unbekannte Dateitypen', () => {
        expect(detectDiffEcosystems(['README.md', 'Cargo.toml'])).toEqual([]);
    });
});

describe('intersectEcosystems (PROC-009-Gate)', () => {
    it('null Repo-Erkennung schließt das Gate komplett (ehrlicher Fallback)', () => {
        expect(intersectEcosystems(null, ['python', 'go'])).toEqual([]);
    });

    it('leere Repo-Erkennung schließt das Gate ebenfalls', () => {
        expect(intersectEcosystems([], ['python'])).toEqual([]);
    });

    it('liefert nur die Schnittmenge beider Ebenen', () => {
        const gatedEcosystems = intersectEcosystems(
            ['nextjs', 'react', 'typescript', 'nodejs'],
            ['python', 'typescript', 'nodejs'],
        );

        expect(gatedEcosystems).toEqual(['typescript', 'nodejs']);
    });
});
