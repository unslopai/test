/**
 * Entrypoint des Schattenlaufs (LANGUAGE_COVERAGE_SPEC §6.4, Gate G8).
 *
 * Wie scripts/rule-recall-benchmark.ts: laedt .env.local, BEVOR Pipeline-Module
 * importiert werden (Supabase-/Vertex-Clients lesen Credentials beim Import).
 * Logik: scripts/lib/shadow-run.ts.
 */
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main(): Promise<void> {
    const { runShadowRun } = await import('./lib/shadow-run');
    await runShadowRun();
}

main().catch((shadowRunError: unknown) => {
    console.error('[shadow] Infrastruktur-Fehler:', shadowRunError);
    process.exitCode = 2;
});
