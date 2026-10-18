/**
 * GET/PUT /api/repos/[id]/settings — OPERATOR-ONLY.
 *
 * Lädt oder speichert die Pipeline-Konfiguration eines Repositories.
 * Seit OPERATOR_SETTINGS_SPEC.md (D1/D2/D4): Der User muss authentifiziert,
 * Operator UND Eigentümer des Repos sein. Nicht-Operatoren erhalten die
 * byte-gleiche 404 wie für ein fremdes Repo — die Route ist für Kunden
 * nicht von einer nicht existenten unterscheidbar.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { isOperatorUser } from '@/lib/operator';
import { DEFAULT_PIPELINE_CONFIG } from '@/lib/pipeline/defaults';
import { ALL_CONDITION_IDS } from '@/lib/pipeline/conditions';
import type { PipelineConfig } from '@/lib/pipeline/types';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/** Byte-gleich für Nicht-Operator, Nicht-Owner und nicht existentes Repo (D4). */
function repoNotFoundResponse(): NextResponse {
    return NextResponse.json({ error: 'Repository nicht gefunden.' }, { status: 404 });
}

// =============================================================================
// GET — Pipeline-Config laden
// =============================================================================

export async function GET(_request: Request, { params }: RouteParams) {
    const { id: repoId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 });
    }

    if (!isOperatorUser(user.id)) {
        return repoNotFoundResponse();
    }

    const { data: repoRow, error: repoError } = await supabaseAdmin
        .from('repositories')
        .select('id, full_name, pipeline_config')
        .eq('id', repoId)
        .eq('user_id', user.id)
        .single();

    if (repoError || !repoRow) {
        return repoNotFoundResponse();
    }

    const pipelineConfig = repoRow.pipeline_config ?? DEFAULT_PIPELINE_CONFIG;

    return NextResponse.json({
        repoId: repoRow.id,
        fullName: repoRow.full_name,
        config: pipelineConfig,
        defaults: DEFAULT_PIPELINE_CONFIG,
        availableConditionIds: ALL_CONDITION_IDS,
    });
}

// =============================================================================
// PUT — Pipeline-Config speichern
// =============================================================================

export async function PUT(request: Request, { params }: RouteParams) {
    const { id: repoId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 });
    }

    if (!isOperatorUser(user.id)) {
        return repoNotFoundResponse();
    }

    let requestBody: unknown;
    try {
        requestBody = await request.json();
    } catch {
        return NextResponse.json({ error: 'Ungültiges JSON.' }, { status: 400 });
    }

    const validatedConfig = validatePipelineConfig(requestBody);

    if (!validatedConfig) {
        return NextResponse.json(
            { error: 'Ungültiges Config-Format. Erwartet: { enabledStepIds, activeConditionIds, overrideSmartDetection }.' },
            { status: 400 },
        );
    }

    // .select().single() macht den Row-Match sichtbar: ohne ihn meldete ein
    // PUT auf ein fremdes/nicht existentes Repo 200 {success:true}, obwohl
    // nichts geschrieben wurde [MAINT-001].
    const { data: updatedRow, error: updateError } = await supabaseAdmin
        .from('repositories')
        .update({
            pipeline_config: validatedConfig,
            updated_at: new Date().toISOString(),
        })
        .eq('id', repoId)
        .eq('user_id', user.id)
        .select('id')
        .single();

    if (updateError || !updatedRow) {
        // PGRST116 = kein Row-Match (fremdes/nicht existentes Repo) → dieselbe
        // 404 wie GET; jeder andere DB-Fehler bleibt ein 500.
        if (!updatedRow && (!updateError || updateError.code === 'PGRST116')) {
            return repoNotFoundResponse();
        }
        console.error('[RepoSettings] Fehler beim Speichern:', updateError);
        return NextResponse.json(
            { error: 'Konfiguration konnte nicht gespeichert werden.' },
            { status: 500 },
        );
    }

    return NextResponse.json({ success: true, config: validatedConfig });
}

// =============================================================================
// Validation
// =============================================================================

const VALID_STEP_IDS = new Set([
    'diff-loader',
    'pre-scanner',
    'rag-loader',
    'complexity-router',
    'draft-reviewer',
    'claim-verifier',
    'escalation-reviewer',
    'second-opinion-reviewer',
    'integrity-scorer',
    'github-reporter',
]);
const VALID_CONDITION_IDS = new Set(ALL_CONDITION_IDS);

/** Cascade-Felder, die per Repo übersteuerbar sind (SPEC.md §7 / Friction Slider). */
const CASCADE_OVERRIDE_FIELDS = [
    'confidenceThreshold',
    'heuristicMaxDiffTokens',
    'heuristicMaxFiles',
    'proDirectMaxDiffTokens',
    'verifierBatchCap',
    // Datei-Batch-Chunking des Drafts (LARGE_DIFF_RECALL_SPEC Option A).
    'draftBatchMaxTokens',
    // Slop Score Gating (Upcoming §6): 1-100; weglassen/0 = Gate aus.
    'minIntegrityScore',
] as const;

function validatePipelineConfig(rawInput: unknown): PipelineConfig | null {
    if (!rawInput || typeof rawInput !== 'object') return null;

    const candidate = rawInput as Record<string, unknown>;

    if (!Array.isArray(candidate.enabledStepIds)) return null;
    if (!Array.isArray(candidate.activeConditionIds)) return null;
    if (typeof candidate.overrideSmartDetection !== 'boolean') return null;

    const validStepIds = candidate.enabledStepIds.filter(
        (stepId: unknown): stepId is string => typeof stepId === 'string' && VALID_STEP_IDS.has(stepId),
    );

    const validConditionIds = candidate.activeConditionIds.filter(
        (condId: unknown): condId is string => typeof condId === 'string' && VALID_CONDITION_IDS.has(condId),
    );

    const cascadeOverrides = validateCascadeOverrides(candidate.cascade);

    return {
        enabledStepIds: validStepIds,
        activeConditionIds: validConditionIds,
        overrideSmartDetection: candidate.overrideSmartDetection,
        ...(cascadeOverrides ? { cascade: cascadeOverrides } : {}),
        // Der prescan-Block wird strukturell durchgereicht (Feld-Validierung
        // macht resolvePrescanConfig im Worker). Ohne dieses Pass-Through
        // würde JEDER Settings-Save die Prescan-Konfiguration eines Repos
        // stillschweigend löschen — dieselbe Falle, die der cascade-Block
        // oben bereits dokumentiert.
        ...(candidate.prescan !== undefined ? { prescan: candidate.prescan } : {}),
    };
}

/**
 * Validiert die cascade-Overrides eines PUT-Requests. Nur positive, endliche
 * Zahlen werden übernommen — sonst würde ein Settings-Save den per Migration
 * geseedeten cascade-Block stillschweigend löschen oder korrumpieren.
 */
function validateCascadeOverrides(rawCascade: unknown): PipelineConfig['cascade'] | null {
    if (!rawCascade || typeof rawCascade !== 'object') return null;

    const cascadeCandidate = rawCascade as Record<string, unknown>;
    const acceptedOverrides: Record<string, number> = {};

    for (const overrideField of CASCADE_OVERRIDE_FIELDS) {
        const fieldValue = cascadeCandidate[overrideField];
        if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue) || fieldValue <= 0) {
            continue;
        }
        // minIntegrityScore lebt auf der 0-100-Skala — ein Wert darüber würde
        // im Worker still auf den Default zurückfallen (stiller No-Op-Save).
        if (overrideField === 'minIntegrityScore' && fieldValue > 100) {
            continue;
        }
        acceptedOverrides[overrideField] = fieldValue;
    }

    return Object.keys(acceptedOverrides).length > 0 ? acceptedOverrides : null;
}
