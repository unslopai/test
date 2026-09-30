/**
 * Einmaliger Beleg-Export vor dem Start der Löschjobs (LEGAL_PAGES_SPEC §4a.4).
 *
 * Migration 052 löscht Review-Aufträge nach 90 Tagen. Deren IDs stehen als
 * Belege in docs/ROADMAP_ARCHIVE.md, in Specs und im Benchmark-Log. Dieses
 * Skript sichert vorher, was einen Beleg ausmacht: Kennungen, Status,
 * Zeitstempel, Modell, Token- und Score-Zahlen sowie die Modellaufrufe.
 *
 * Es schreibt KEINEN Inhalt: kein Diff, kein Finding-Text, kein Code, keine
 * `verdicts`. Von den Findings bleibt nur die Anzahl; die Liste wird dafür in
 * den Prozess geladen, aber weder geschrieben noch ausgegeben (PostgREST kann
 * ein JSON-Array nicht zählen). Gedacht ist es für den
 * Bestand vor dem ersten fremden Kunden (eigene Repos und Fixtures); für
 * Kundendaten nicht verwenden, weil Repo-Namen sonst länger als 90 Tage im
 * Git lägen.
 *
 *   npx tsx scripts/export-receipt-jobs.ts --before 2026-10-20
 *   npx tsx scripts/export-receipt-jobs.ts --before 2026-10-20 --out docs/receipts/review-jobs-pre-launch.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const DEFAULT_OUTPUT_PATH = 'docs/receipts/review-jobs-pre-launch.json';
const PAGE_SIZE = 500;

const JOB_COLUMNS = [
    'id', 'created_at', 'updated_at', 'status', 'source', 'repository_id', 'pr_number', 'model',
    'prompt_tokens', 'cached_tokens', 'output_tokens', 'integrity_score', 'escalated',
    'escalation_reason', 'cascade_route', 'check_run_id', 'reroll_count',
    'repo_full_name:payload->>repo_full_name', 'fixture:payload->>fixture', 'label:payload->>label',
    'files_reviewed:result->files_reviewed', 'has_slop:result->review->has_slop',
    'degradations:result->degradations', 'issues:result->review->issues',
].join(', ');

const LLM_CALL_COLUMNS = [
    'id', 'created_at', 'job_id', 'repo_id', 'phase', 'model', 'status', 'prompt_tokens',
    'cached_tokens', 'output_tokens', 'latency_ms', 'claims_total', 'claims_confirmed',
    'claims_refuted', 'claims_uncertain', 'cache_status',
].join(', ');

interface ExportRequest {
    readonly beforeIso: string;
    readonly outputPath: string;
}

type ExportedRow = Record<string, unknown>;

function parseArguments(argv: readonly string[]): ExportRequest | null {
    let beforeDate: string | null = null;
    let outputPath = DEFAULT_OUTPUT_PATH;

    for (let flagIndex = 0; flagIndex < argv.length; flagIndex += 2) {
        const flagValue = argv[flagIndex + 1];
        if (flagValue === undefined) return null;
        if (argv[flagIndex] === '--before') beforeDate = flagValue;
        else if (argv[flagIndex] === '--out') outputPath = flagValue;
        else return null;
    }

    if (beforeDate === null || Number.isNaN(Date.parse(beforeDate))) return null;
    return { beforeIso: new Date(beforeDate).toISOString(), outputPath };
}

function isRowList(candidateRows: unknown): candidateRows is ExportedRow[] {
    return Array.isArray(candidateRows)
        && candidateRows.every((candidateRow) => typeof candidateRow === 'object' && candidateRow !== null);
}

/** Lädt alle Zeilen vor dem Stichtag, seitenweise (PostgREST deckelt eine Antwort). */
async function fetchRowsBefore(
    supabase: SupabaseClient,
    table: string,
    columns: string,
    beforeIso: string,
): Promise<ExportedRow[]> {
    const exportedRows: ExportedRow[] = [];

    for (let pageStart = 0; ; pageStart += PAGE_SIZE) {
        const { data: pageRows, error: pageError } = await supabase
            .from(table)
            .select(columns)
            .lt('created_at', beforeIso)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(pageStart, pageStart + PAGE_SIZE - 1);

        if (pageError) throw new Error(`${table}: ${pageError.message}`);
        if (!isRowList(pageRows)) throw new Error(`${table}: unerwartete Antwortform`);
        exportedRows.push(...pageRows);
        if (pageRows.length < PAGE_SIZE) return exportedRows;
    }
}

/** Ersetzt die Finding-Liste durch ihre Zählung: der Text der Findings wird nicht exportiert. */
function reduceIssuesToCounts(jobRow: ExportedRow): ExportedRow {
    const { issues: persistedIssues, ...receiptFields } = jobRow;
    const issueList = isRowList(persistedIssues) ? persistedIssues : [];
    return {
        ...receiptFields,
        issue_count: issueList.length,
        critical_count: issueList.filter((persistedIssue) => persistedIssue.severity === 'CRITICAL').length,
    };
}

async function exportReceipts(exportRequest: ExportRequest, supabase: SupabaseClient): Promise<void> {
    const jobRows = await fetchRowsBefore(supabase, 'review_jobs', JOB_COLUMNS, exportRequest.beforeIso);
    const llmCallRows = await fetchRowsBefore(
        supabase, 'review_job_llm_calls', LLM_CALL_COLUMNS, exportRequest.beforeIso,
    );

    const receiptArchive = {
        exported_at: new Date().toISOString(),
        created_before: exportRequest.beforeIso,
        note: 'Metadata only: no diff, no finding text, no code, no verdicts (LEGAL_PAGES_SPEC §4a.4).',
        job_count: jobRows.length,
        llm_call_count: llmCallRows.length,
        jobs: jobRows.map(reduceIssuesToCounts),
        llm_calls: llmCallRows,
    };

    mkdirSync(dirname(exportRequest.outputPath), { recursive: true });
    writeFileSync(exportRequest.outputPath, `${JSON.stringify(receiptArchive, null, 1)}\n`, 'utf8');
    console.log(
        `${jobRows.length} Aufträge und ${llmCallRows.length} Modellaufrufe nach ${exportRequest.outputPath} geschrieben.`,
    );
}

async function main(): Promise<void> {
    const exportRequest = parseArguments(process.argv.slice(2));
    if (!exportRequest) {
        console.error('Usage: npx tsx scripts/export-receipt-jobs.ts --before <YYYY-MM-DD> [--out <Datei>]');
        process.exitCode = 1;
        return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen in .env.local.');
        process.exitCode = 1;
        return;
    }

    try {
        await exportReceipts(exportRequest, createClient(supabaseUrl, serviceRoleKey));
    } catch (exportError: unknown) {
        console.error(`Export fehlgeschlagen: ${exportError instanceof Error ? exportError.message : String(exportError)}`);
        process.exitCode = 1;
    }
}

void main();
