/**
 * Golden Standards Ingest-Skript.
 *
 * Befüllt die `golden_standards`-Tabelle mit kuratierten Best Practices,
 * Anti-Patterns und Architektur-Regeln aus der CSV-Datei.
 * Generiert Embeddings via Vertex AI und speichert alles in Supabase.
 *
 * Aufruf: npx tsx scripts/ingest-golden-standards.ts
 *
 * HINWEIS: Dieses Skript ist ein Standalone-Runner. Es nutzt direkt
 * die Supabase-Client und Vertex AI SDK, ohne Next.js Server-Kontext.
 */
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';

// .env.local laden (für lokale Entwicklung)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// =============================================================================
// Config
// =============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID!;
const BASE64_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64!;

const EMBEDDING_MODEL = 'text-embedding-005';
const EMBEDDING_DIMENSIONS = 768;
const CSV_FILE_PATH = path.join(process.cwd(), 'Golden_Database__-_Tabellenblatt1.csv');

// =============================================================================
// Golden Standard Definitions
// =============================================================================

interface GoldenStandardEntry {
    category: 'anti_pattern' | 'best_practice' | 'security' | 'performance';
    rule_id: string;
    title: string;
    content: string;
    code_example_bad?: string;
    code_example_good?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Liest die CSV und mappt sie in unser Datenbank-Format.
 */
function loadGoldenStandardsFromCSV(): GoldenStandardEntry[] {
    if (!fs.existsSync(CSV_FILE_PATH)) {
        console.error(`❌ CSV-Datei nicht gefunden: ${CSV_FILE_PATH}`);
        return [];
    }

    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
    
    // Parse the CSV
    const records: any[] = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
    });

    const standards: GoldenStandardEntry[] = [];

    for (const record of records) {
        // CSV Header: Rule ID, Kategorie, Schweregrad, Anti-Pattern Beschreibung (Ursprung und Auswirkung), Enforcement Instruction (Pipeline Check)
        const ruleId = record['Rule ID'];
        const csvCategory = record['Kategorie'];
        const severity = record['Schweregrad'];
        const description = record['Anti-Pattern Beschreibung (Ursprung und Auswirkung)'];
        const instruction = record['Enforcement Instruction (Pipeline Check)'];

        if (!ruleId || !description || !instruction) {
            console.warn(`⚠️  Überspringe unvollständigen Eintrag: ${JSON.stringify(record)}`);
            continue;
        }

        // Kategorie-Mapping für Supabase Check-Constraint
        // DB erlaubt: 'anti_pattern', 'best_practice', 'security', 'performance'
        let mappedCategory: GoldenStandardEntry['category'] = 'anti_pattern';
        if (csvCategory?.toLowerCase().includes('security')) {
            mappedCategory = 'security';
        } else if (csvCategory?.toLowerCase().includes('performance')) {
            mappedCategory = 'performance';
        }

        standards.push({
            rule_id: ruleId,
            category: mappedCategory,
            title: description, // Wir nutzen die Beschreibung als Title
            content: instruction, // Und die Instruction als Content für den LLM
            metadata: { severity, original_category: csvCategory },
        });
    }

    return standards;
}


// =============================================================================
// Main
// =============================================================================

async function main() {
    console.log('=== Golden Standards Ingest ===\n');

    // Validierung
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.');
        process.exit(1);
    }

    if (!PROJECT_ID || !BASE64_KEY) {
        console.error('❌ GOOGLE_PROJECT_ID und GOOGLE_SERVICE_ACCOUNT_BASE64 müssen gesetzt sein.');
        process.exit(1);
    }

    const GOLDEN_STANDARDS = loadGoldenStandardsFromCSV();

    if (GOLDEN_STANDARDS.length === 0) {
        console.log('⚠️  Keine Golden Standards gefunden oder CSV leer.');
        process.exit(0);
    }

    // Supabase Client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Vertex AI Client
    const decodedKey = Buffer.from(BASE64_KEY, 'base64').toString('utf-8');
    const tmpKeyPath = path.join(os.tmpdir(), 'vertex-key-ingest.json');
    fs.writeFileSync(tmpKeyPath, decodedKey);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpKeyPath;

    const ai = new GoogleGenAI({
        project: PROJECT_ID,
        location: 'europe-west3',
        // @ts-expect-error: Bekannter SDK-Typisierungsbug
        vertexai: { project: PROJECT_ID, location: 'europe-west3' },
    });

    console.log(`📊 ${GOLDEN_STANDARDS.length} Golden Standards zum Ingest...\n`);

    // Embeddings generieren
    let successCount = 0;

    for (const standard of GOLDEN_STANDARDS) {
        console.log(`  → ${standard.rule_id}`);

        try {
            // Embedding-Text zusammenbauen (Title + Content)
            const embeddingText = [
                standard.title,
                standard.content,
            ].filter(Boolean).join('\n\n');

            const response = await ai.models.embedContent({
                model: EMBEDDING_MODEL,
                contents: embeddingText,
                config: {
                    taskType: 'RETRIEVAL_DOCUMENT',
                    outputDimensionality: EMBEDDING_DIMENSIONS,
                },
            });

            const embedding = response.embeddings?.[0]?.values;

            if (!embedding) {
                console.error(`    ❌ Kein Embedding zurückgegeben`);
                continue;
            }

            // In Supabase speichern (upsert auf rule_id)
            const { error: upsertError } = await supabase
                .from('golden_standards')
                .upsert({
                    rule_id: standard.rule_id,
                    category: standard.category,
                    title: standard.title,
                    content: standard.content,
                    code_example_bad: standard.code_example_bad ?? null,
                    code_example_good: standard.code_example_good ?? null,
                    embedding: JSON.stringify(embedding),
                    metadata: standard.metadata ?? {},
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'rule_id',
                });

            if (upsertError) {
                console.error(`    ❌ DB Fehler: ${upsertError.message}`);
                continue;
            }

            console.log(`    ✅ Gespeichert (${embedding.length} dims)`);
            successCount++;

        } catch (entryError: unknown) {
            console.error(`    ❌ Fehler: ${entryError instanceof Error ? entryError.message : String(entryError)}`);
        }
    }

    console.log(`\n=== Ergebnis: ${successCount}/${GOLDEN_STANDARDS.length} erfolgreich ===`);

    // Cleanup
    try {
        fs.unlinkSync(tmpKeyPath);
    } catch {
        // ignore
    }
}

main().catch(console.error);
