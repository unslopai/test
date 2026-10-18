/**
 * Echte Produktausgabe für die Landing (MARKETING_CLAIMS.md §00 Punkt 1:
 * „Show, don't claim"). Jeder Eintrag ist wörtlich aus `review_jobs.result`
 * bzw. aus dem GitHub-PR übernommen — Regel, Zitat, Kritik und Fix werden
 * NICHT übersetzt oder geglättet. Wer hier etwas ändert, braucht einen neuen
 * Job als Beleg; die Job-ID steht am Eintrag.
 *
 * Alle drei Läufe stammen aus dem eigenen Test-Repository `unslopai/test`,
 * es sind keine Kundendaten.
 */

export type FindingSeverity = 'CRITICAL' | 'WARNING';

/** Wert von `issues[].verification` im gespeicherten Ergebnis. */
export type FindingVerification = 'deterministic' | 'confirmed' | 'unverified';

export interface RealFinding {
  readonly jobId: string;
  readonly rule: string;
  readonly severity: FindingSeverity;
  readonly verification: FindingVerification;
  readonly path: string;
  readonly line: number;
  readonly quotedLines: readonly string[];
  readonly fixLines: readonly string[];
  readonly critiqueParagraphs: readonly string[];
}

/**
 * Hero-Exponat: Job 3f26b2da, unslopai/test PR #20, 2026-09-30. Check Run
 * „Anti-Slop Gatekeeper" 07:06:21–07:06:37 UTC, conclusion `failure`;
 * Kommentar von `unslop-gatekeeper` an src/lib/user-lookup.ts:5.
 */
export const PULL_REQUEST_EXHIBIT = {
  repository: 'unslopai/test',
  pullRequestNumber: 20,
  path: 'src/lib/user-lookup.ts',
  flaggedLine: 5,
  addedLines: [
    "import type { Pool } from 'pg';",
    '',
    '/** Loads a user row by id. */',
    'export async function loadUserById(pool: Pool, userId: string) {',
    '    return pool.query(`SELECT id, email FROM users WHERE id = ${userId}`);',
    '}',
  ],
  botLogin: 'unslop-gatekeeper',
  rule: 'SEC-004 (SQL built by string interpolation)',
  severity: 'CRITICAL',
  critique:
    'The SQL statement is assembled from interpolated/concatenated values — SQL injection. Use parameterized queries exclusively.',
  checkName: 'Anti-Slop Gatekeeper',
  checkConclusion: 'failure',
  checkTitle: '1 critical slop finding',
  checkDurationSeconds: 16,
} as const;

/** Job 0cf82b14, CLI-Scan 2026-09-17, fix-probe.ts:4 — Verifier-Verdict CONFIRMED. */
export const CONFIRMED_MODEL_FINDING: RealFinding = {
  jobId: '0cf82b14',
  rule: 'Condition 1 (Silent Error Swallowing)',
  severity: 'CRITICAL',
  verification: 'confirmed',
  path: 'fix-probe.ts',
  line: 4,
  quotedLines: ['    } catch (e) {', '        console.error(e);'],
  fixLines: [
    '    } catch (e) {',
    '        throw new Error(`Failed to parse configuration: ${e instanceof Error ? e.message : String(e)}`);',
    '    }',
  ],
  critiqueParagraphs: [
    'The catch block performs passive logging and returns null instead of propagating the error or triggering a compensating mechanism, silently swallowing parsing failures.',
  ],
};

/**
 * Job f2c676ba, unslopai/test PR #17, 2026-09-26 — Eskalation aus Zeitgründen
 * übersprungen (`skipped_stages: ["escalation"]`, Budget für den Receipt
 * bewusst auf 150 s gesetzt, DEADLINE_GUARD_SPEC). Der zweite Absatz ist der
 * Hinweis, den der integrity-scorer an die Kritik anhängt.
 */
export const DOWNGRADED_MODEL_FINDING: RealFinding = {
  jobId: 'f2c676ba',
  rule: 'MAINT-007',
  severity: 'WARNING',
  verification: 'unverified',
  path: 'src/lib/prescan/companion-loader.ts',
  line: 138,
  quotedLines: [
    '                if (listError instanceof GitHubApiError && listError.status === 404) return null;',
  ],
  fixLines: [
    '                if (readError instanceof GitHubApiError && readError.status === 404) return null;',
  ],
  critiqueParagraphs: [
    "The catch block catches 'readError', but the condition references 'listError', which is out of scope. This causes a TypeScript compile error (TS2304: Cannot find name 'listError') and a runtime ReferenceError whenever fetchFileContent throws an error.",
    '⚠️ Downgraded to WARNING — this finding was flagged for Pro escalation, but the escalation was skipped (budget, API or time-limit degradation), so it could not be conclusively verified.',
  ],
};
