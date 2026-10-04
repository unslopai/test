/**
 * POST /api/webhook
 *
 * Ein Endpoint, zwei Delivery-Quellen (GITHUB_APP_SPEC.md §4.4):
 *
 *  - GitHub App     → Signatur gegen das GLOBALE App-Secret, Bot-Identität,
 *                     Check Runs, zusätzlich `installation`-Lifecycle-Events.
 *  - Legacy-Repo-Hook → Signatur gegen repositories.webhook_secret, User-OAuth-
 *                     Identität. Unverändert, damit bestehende Kunden weiterlaufen.
 *
 * Ablauf pull_request:
 *  1. Payload strukturell parsen [ARCH-002]
 *  2. Repo finden, Dupe-Guard (App-Repo + Legacy-Delivery → verwerfen)
 *  3. Signatur verifizieren (timing-safe)
 *  4. Repo-Status- und Billing-Gates (kein LLM-Call ohne Anspruch)
 *  5. Job anlegen, Check Run eröffnen, Worker via after() starten
 */
import { NextResponse, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { processReviewJob } from "@/lib/worker";
import { scheduleLazyReap } from "@/lib/lazy-reaper";
import { verifyWebhookSignature } from "@/lib/github";
import {
    GitHubAppAuthError,
    getAppWebhookSecret,
    getInstallationToken,
    isGitHubAppConfigured,
} from "@/lib/github-app";
import {
    parseCheckRunEvent,
    parseInstallationEvent,
    parseInstallationReposEvent,
    parsePullRequestEvent,
    parseWebhookBody,
} from "@/lib/github-webhook-payload";
import { findInstallation, handleInstallationEvent, handleInstallationReposEvent } from "@/lib/app-installation";
import { startGatekeeperCheckRun } from "@/lib/check-run";
import { selectDeliveryTarget } from "@/lib/webhook-delivery";
import { extractErrorMessage } from "@/lib/errors";
import { resolveEntitlement, consumeScanQuota } from "@/lib/billing/entitlements";
import { announceGateSkip } from "@/lib/gate-notice";
import type { DeliveryTarget, WebhookRepoRow } from "@/lib/webhook-delivery";
import type { GateKind } from "@/lib/gate-notice";
import type { PullRequestEventPayload } from "@/lib/github-webhook-payload";

// 300s: worst case der Router-Cascade sind 3 sequentielle LLM-Calls
// (Draft + Verify + Pro-Re-Verify) bzw. ein Pro-Volldurchlauf, plus GitHub-I/O.
export const maxDuration = 300;

// Das Speicherlimit dieser Function steht in vercel.json (3009 MB) und ist NICHT
// optional: der Pre-Scanner haelt web-tree-sitter samt Grammatiken, ESLint und
// den TypeScript-Parser im Modul-Scope derselben Instanz, in der danach die
// LLM-Cascade laeuft. Mit dem Vercel-Default wurde die Instanz im
// draft-reviewer per OOM getoetet (A/B belegt in ROADMAP §1b).

/** PR-Actions, die ein Review auslösen. Alles andere wird mit 200 quittiert. */
const REVIEWABLE_PR_ACTIONS = new Set(['opened', 'synchronize', 'reopened']);

/** Lifecycle-Events der GitHub App — kommen nie von einem Repo-Hook. */
const INSTALLATION_EVENT_TYPES = new Set(['installation', 'installation_repositories']);

export async function POST(request: Request) {
    // Job-Uhr (DEADLINE_GUARD_SPEC D1): der after()-Callback kennt den
    // Invocation-Start nicht, maxDuration zählt aber ab hier.
    const invocationStartedAtMs = Date.now();
    // Lazy Reaping (D10): räumt vom Plattform-Kill verwaiste Jobs ab —
    // gedrosselt, nach der Response, ohne diesen Request zu berühren.
    scheduleLazyReap('webhook');
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-hub-signature-256');
        const eventType = request.headers.get('x-github-event');

        // Kein GitHub-Event Header? Dann ist es kein echter Webhook.
        if (!eventType) {
            return NextResponse.json(
                { error: 'Fehlender X-GitHub-Event Header' },
                { status: 400 },
            );
        }

        // Ping-Events (GitHub sendet diese beim Webhook-Setup) → einfach bestätigen
        if (eventType === 'ping') {
            console.log('[Webhook] Ping Event empfangen — Webhook erfolgreich verbunden.');
            return NextResponse.json({ success: true, message: 'pong' });
        }

        const payload = parseWebhookBody(rawBody);
        if (payload === null) {
            return NextResponse.json({ error: 'Payload ist kein gültiges JSON.' }, { status: 400 });
        }

        if (INSTALLATION_EVENT_TYPES.has(eventType)) {
            return await handleAppLifecycleEvent(eventType, payload, rawBody, signature);
        }

        if (eventType === 'check_run') {
            return await handleCheckRunEvent(payload, rawBody, signature, invocationStartedAtMs);
        }

        if (eventType === 'pull_request') {
            return await handlePullRequestEvent(payload, rawBody, signature, invocationStartedAtMs);
        }

        return NextResponse.json({
            success: true,
            message: `Event-Typ '${eventType}' wird ignoriert.`,
        });

    } catch (error: unknown) {
        console.error('[Webhook] Unerwarteter Fehler:', error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}

// =============================================================================
// App-Lifecycle (installation / installation_repositories)
// =============================================================================

/**
 * Diese Events signiert GitHub mit dem globalen App-Secret — es gibt für sie
 * kein Repo und damit kein repo-spezifisches Secret.
 *
 * Sie werden bewusst SYNCHRON verarbeitet und ein Fehler wird als 500
 * beantwortet [MAINT-001]. Hinter `after()` wäre der 200 bereits raus, und weil
 * GitHub nach einem 200 nie nachliefert, wäre ein einziger transienter DB-Fehler
 * bei `installation.deleted` endgültig: die Repos zeigten für immer auf eine tote
 * Installation, jeder PR liefe in einen Job, der am Token stirbt. Mit dem 500
 * markiert GitHub die Delivery als fehlgeschlagen und sie bleibt manuell
 * nachlieferbar.
 */
async function handleAppLifecycleEvent(
    eventType: string,
    payload: unknown,
    rawBody: string,
    signature: string | null,
): Promise<NextResponse> {
    if (!isGitHubAppConfigured()) {
        console.warn(`[Webhook] '${eventType}'-Event empfangen, aber die GitHub App ist nicht konfiguriert.`);
        return NextResponse.json({ success: true, message: 'GitHub App ist in dieser Umgebung inaktiv.' });
    }

    if (!signature || !verifyWebhookSignature(rawBody, signature, getAppWebhookSecret())) {
        console.error(`[Webhook] Ungültige App-Signatur für '${eventType}'.`);
        return NextResponse.json({ error: 'Ungültige Webhook-Signatur.' }, { status: 401 });
    }

    try {
        await dispatchLifecycleEvent(eventType, payload);
    } catch (lifecycleError: unknown) {
        console.error(
            `[Webhook] Verarbeitung von '${eventType}' fehlgeschlagen: `
            + extractErrorMessage(lifecycleError),
        );
        return NextResponse.json(
            { success: false, error: `Event '${eventType}' konnte nicht verarbeitet werden.` },
            { status: 500 },
        );
    }

    return NextResponse.json({ success: true, message: `Event '${eventType}' verarbeitet.` });
}

async function dispatchLifecycleEvent(eventType: string, payload: unknown): Promise<void> {
    if (eventType === 'installation') {
        const installationEvent = parseInstallationEvent(payload);
        if (!installationEvent) {
            console.error('[Webhook] installation-Event ohne verwertbare Installation verworfen.');
            return;
        }
        await handleInstallationEvent(installationEvent);
        return;
    }

    const installationReposEvent = parseInstallationReposEvent(payload);
    if (!installationReposEvent) {
        console.error('[Webhook] installation_repositories-Event ohne Installation verworfen.');
        return;
    }
    await handleInstallationReposEvent(installationReposEvent);
}

// =============================================================================
// Pull Requests
// =============================================================================

async function handlePullRequestEvent(
    payload: unknown,
    rawBody: string,
    signature: string | null,
    invocationStartedAtMs: number,
): Promise<NextResponse> {
    const prEvent = parsePullRequestEvent(payload);

    if (!prEvent) {
        return NextResponse.json(
            { error: 'Unvollständiger Payload: repository.id, repository.full_name und pull_request.number sind erforderlich.' },
            { status: 400 },
        );
    }

    // 'reopened' zählt wie 'opened': Ein wieder geöffneter PR braucht ein
    // Review — der Filter hat sonst still den E2E-Pfad geschluckt.
    if (!REVIEWABLE_PR_ACTIONS.has(prEvent.action)) {
        return NextResponse.json({
            success: true,
            message: `PR-Action '${prEvent.action}' wird ignoriert.`,
        });
    }

    return triageAndStartReview(prEvent, rawBody, signature, invocationStartedAtMs);
}

/**
 * Re-Run-Button der GitHub-UI (GITHUB_APP_SPEC §4.8). Ein Re-Run ist ein NEUER
 * Scan und durchläuft dieselbe Gate-Kette wie pull_request — inklusive Quota:
 * ohne das wäre der Button ein kostenloser Bypass an der Kosten-Schranke vorbei.
 */
async function handleCheckRunEvent(
    payload: unknown,
    rawBody: string,
    signature: string | null,
    invocationStartedAtMs: number,
): Promise<NextResponse> {
    const checkRunEvent = parseCheckRunEvent(payload);

    if (!checkRunEvent) {
        return NextResponse.json(
            { error: 'Unvollständiger Payload: action, repository.id, repository.full_name und check_run sind erforderlich.' },
            { status: 400 },
        );
    }

    if (checkRunEvent.kind === 'ignored_action') {
        return NextResponse.json({
            success: true,
            message: `check_run-Action '${checkRunEvent.action}' wird ignoriert.`,
        });
    }

    if (checkRunEvent.kind === 'no_pull_request') {
        console.log('[Webhook] check_run.rerequested ohne zugeordneten PR (Fork/Push) — kein Review.');
        return NextResponse.json({
            success: true,
            message: 'Re-Run ohne zugeordneten Pull Request — kein Review.',
        });
    }

    console.log(
        `[Webhook] Re-Run angefordert für ${checkRunEvent.prEvent.repoFullName}#${checkRunEvent.prEvent.prNumber}.`,
    );
    return triageAndStartReview(checkRunEvent.prEvent, rawBody, signature, invocationStartedAtMs);
}

/**
 * Gemeinsame Zustellungs-Triage für pull_request und check_run (§4.4/§4.8):
 * Zeile + Signatur auflösen, dann die Gate-Kette starten.
 */
async function triageAndStartReview(
    prEvent: PullRequestEventPayload,
    rawBody: string,
    signature: string | null,
    invocationStartedAtMs: number,
): Promise<NextResponse> {
    const deliveryTarget = await resolveDeliveryTarget(prEvent, rawBody, signature);

    if (deliveryTarget.kind === 'unknown_repo') {
        console.warn(`[Webhook] Repository mit GitHub ID ${prEvent.githubRepoId} nicht in DB gefunden.`);
        return NextResponse.json({ error: 'Repository nicht registriert.' }, { status: 404 });
    }

    if (deliveryTarget.kind === 'invalid_signature') {
        console.error(`[Webhook] Signaturprüfung fehlgeschlagen für ${prEvent.repoFullName}.`);
        return NextResponse.json({ error: 'Ungültige Webhook-Signatur.' }, { status: 401 });
    }

    // Dupe-Guard (GITHUB_APP_SPEC D7): Das Repo läuft über die App, diese
    // Delivery kommt aber vom alten Repo-Hook. Ohne diesen Abbruch liefe jeder
    // PR zweimal durch die Pipeline — doppelte LLM-Kosten, zwei Reviews.
    if (deliveryTarget.kind === 'legacy_duplicate') {
        console.log(
            `[Webhook] Legacy-Hook-Delivery für App-Repo ${prEvent.repoFullName} verworfen (Doppel-Review verhindert).`,
        );
        return NextResponse.json({ success: true, message: 'Repo läuft über die GitHub App — Legacy-Delivery ignoriert.' });
    }

    return startReviewForDelivery(deliveryTarget, prEvent, invocationStartedAtMs);
}

/** Lädt die Kandidaten-Zeilen und übergibt die Auswahl an die reine Logik. */
async function resolveDeliveryTarget(
    prEvent: PullRequestEventPayload,
    rawBody: string,
    signature: string | null,
): Promise<DeliveryTarget> {
    const { data: repoRows, error: repoLookupError } = await supabase
        .from('repositories')
        .select('id, user_id, webhook_secret, installation_id, status')
        .eq('github_repo_id', prEvent.githubRepoId);

    if (repoLookupError) {
        console.error(`[Webhook] Repo-Lookup für ${prEvent.repoFullName} fehlgeschlagen:`, repoLookupError);
        throw new Error(`Repository-Lookup fehlgeschlagen: ${repoLookupError.message}`);
    }

    const candidateRepos: WebhookRepoRow[] = (repoRows ?? []).map((repoRow) => ({
        id: repoRow.id,
        userId: repoRow.user_id,
        webhookSecret: repoRow.webhook_secret,
        installationId: repoRow.installation_id,
        status: repoRow.status,
    }));

    return selectDeliveryTarget({
        candidateRepos,
        payloadInstallationId: prEvent.installationId,
        rawBody,
        signature,
        appWebhookSecret: isGitHubAppConfigured() ? getAppWebhookSecret() : null,
    });
}

// =============================================================================
// Gates + Job-Start
// =============================================================================

async function startReviewForDelivery(
    deliveryTarget: { kind: 'app'; repoRow: WebhookRepoRow; installationId: number } | { kind: 'legacy'; repoRow: WebhookRepoRow },
    prEvent: PullRequestEventPayload,
    invocationStartedAtMs: number,
): Promise<NextResponse> {
    const { repoRow } = deliveryTarget;

    if (deliveryTarget.kind === 'app' && !await isInstallationUsable(deliveryTarget.installationId)) {
        return NextResponse.json({
            success: true,
            message: 'Review übersprungen: GitHub App Installation ist nicht aktiv.',
        });
    }

    const statusGate = await applyRepoStatusGate(repoRow, prEvent);
    if (statusGate) {
        return statusGate;
    }

    const billingGate = await applyBillingGate(repoRow, prEvent);
    if (billingGate) {
        return billingGate;
    }

    const jobId = await createReviewJob(repoRow, prEvent);
    if (!jobId) {
        return NextResponse.json(
            { success: false, error: 'Konnte Job nicht erstellen' },
            { status: 500 },
        );
    }

    if (deliveryTarget.kind === 'app') {
        await openCheckRunForJob(deliveryTarget.installationId, jobId, repoRow.id, prEvent);
    }

    console.log(`[Webhook] Job ${jobId} erstellt für PR #${prEvent.prNumber} in ${prEvent.repoFullName}`);

    // Background-Verarbeitung starten (läuft NACH dem Response)
    after(async () => {
        await processReviewJob(jobId, repoRow.userId, invocationStartedAtMs);
    });

    // Sofort 200 OK zurückgeben — GitHub wartet nicht
    return NextResponse.json({
        success: true,
        message: `Review für PR #${prEvent.prNumber} in ${prEvent.repoFullName} gestartet.`,
        jobId,
    });
}

/**
 * Suspendierte oder gelöschte Installation: GitHub gibt uns kein Token mehr.
 * Sauber überspringen, statt den Job hinterher am Token-Abruf sterben zu lassen
 * (das erzeugte nur eine Serie an 'error'-Jobs und roten Check Runs).
 */
async function isInstallationUsable(installationId: number): Promise<boolean> {
    const installation = await findInstallation(installationId);

    if (!installation || installation.status !== 'active') {
        console.log(
            `[Webhook] Installation ${installationId} ist nicht aktiv `
            + `(${installation?.status ?? 'unbekannt'}) — Review übersprungen.`,
        );
        return false;
    }

    return true;
}

/**
 * Repo-Status-Gates. 'syncing' und 'error' laufen bewusst weiter durch (so war
 * es immer): ein fehlgeschlagener Ingest darf Reviews nicht dauerhaft abschalten.
 */
async function applyRepoStatusGate(
    repoRow: WebhookRepoRow,
    prEvent: PullRequestEventPayload,
): Promise<NextResponse | null> {
    if (repoRow.status === 'deactivated') {
        console.log(`[Webhook] Repo ${prEvent.repoFullName} ist deaktiviert — Review übersprungen.`);

        // Die App bleibt nach einem Disconnect installiert, GitHub liefert also
        // weiter. Ohne einen abschließenden Check Run stünde ein als `required`
        // konfigurierter Check für immer auf "Expected — waiting for status":
        // jeder PR des Kunden wäre unmergebar, ohne dass irgendwo stünde warum.
        scheduleGateNotice(repoRow, prEvent, 'reviews_disabled');

        return NextResponse.json({ success: true, message: 'Repository ist deaktiviert.' });
    }

    // Denial-of-Wallet-Schutz (D10): Ein PR darf NIEMALS die Skeleton-Ingestion
    // auslösen — sonst könnte ein Fremder die Kosten des Owners triggern.
    if (repoRow.status === 'pending_activation') {
        console.log(`[Webhook] Repo ${prEvent.repoFullName} ist nicht aktiviert — Review übersprungen.`);
        scheduleGateNotice(repoRow, prEvent, 'activation_required');
        return NextResponse.json({
            success: true,
            message: 'Review übersprungen: Repository ist noch nicht aktiviert.',
        });
    }

    return null;
}

/**
 * Paid-only-Gate (STRIPE_SPEC S2/S10): ohne aktives Abo/Trial/Comp-Grant KEIN
 * LLM-Call. Auch Webhook-Reviews zählen gegen die per-User-Quota — sonst wäre
 * die Kosten-Schranke über den PR-Pfad umgehbar.
 */
async function applyBillingGate(
    repoRow: WebhookRepoRow,
    prEvent: PullRequestEventPayload,
): Promise<NextResponse | null> {
    const entitlement = await resolveEntitlement(repoRow.userId);

    if (!entitlement.entitled) {
        console.log(
            `[Webhook] Review übersprungen (${entitlement.reason}) für ${prEvent.repoFullName}#${prEvent.prNumber}.`,
        );
        scheduleGateNotice(repoRow, prEvent, 'billing_paused');
        return NextResponse.json({
            success: true,
            message: `Review übersprungen: keine aktive Subscription (${entitlement.reason}).`,
        });
    }

    // 'webhook' = volle Fenster-Limits; die 20%-Reserve existiert genau für
    // diese Lane (MCP_SPEC.md §4.6, D10).
    const quotaOutcome = await consumeScanQuota(repoRow.userId, entitlement.plan, 'webhook');

    if (quotaOutcome !== 'allowed') {
        const isTrialExhausted = quotaOutcome === 'trial_exhausted';
        console.log(
            `[Webhook] Review übersprungen (${quotaOutcome}) für ${prEvent.repoFullName}#${prEvent.prNumber}.`,
        );
        scheduleGateNotice(repoRow, prEvent, isTrialExhausted ? 'trial_exhausted' : 'quota_exceeded');
        return NextResponse.json({
            success: true,
            message: isTrialExhausted
                ? 'Review übersprungen: Trial-Kontingent aufgebraucht.'
                : 'Review übersprungen: Scan-Quota erschöpft.',
        });
    }

    return null;
}

/** Kommentar (+ blockierender Check Run im App-Modus) nach dem Response. */
function scheduleGateNotice(
    repoRow: WebhookRepoRow,
    prEvent: PullRequestEventPayload,
    gateKind: GateKind,
): void {
    after(async () => {
        await announceGateSkip(
            { installationId: repoRow.installationId, ownerUserId: repoRow.userId },
            prEvent,
            gateKind,
        );
    });
}

async function createReviewJob(
    repoRow: WebhookRepoRow,
    prEvent: PullRequestEventPayload,
): Promise<string | null> {
    const { data: insertedJob, error: insertError } = await supabase
        .from('review_jobs')
        .insert({
            payload: {
                repo_full_name: prEvent.repoFullName,
                pr_number: prEvent.prNumber,
                pr_url: prEvent.prUrl,
                pr_head_sha: prEvent.prHeadSha,
                action: prEvent.action,
            },
            status: 'pending',
            source: 'webhook',
            repository_id: repoRow.id,
            pr_number: prEvent.prNumber,
            pr_url: prEvent.prUrl,
        })
        .select('id')
        .single();

    if (insertError || !insertedJob) {
        console.error('[Webhook] Fehler beim Speichern des Jobs:', insertError);
        return null;
    }

    return insertedJob.id;
}

/**
 * Eröffnet den Check Run und hängt ihn an den Job.
 *
 * Best effort: ohne HEAD-SHA gibt es nichts, woran ein Check hängen könnte, und
 * ein nicht beschaffbares Installation-Token wird hier nur geloggt — der Worker
 * failt den Job gleich darauf sichtbar und mit lesbarem Grund (D1).
 */
async function openCheckRunForJob(
    installationId: number,
    jobId: string,
    repositoryId: string,
    prEvent: PullRequestEventPayload,
): Promise<void> {
    if (!prEvent.prHeadSha) {
        console.warn(`[Webhook] PR ${prEvent.repoFullName}#${prEvent.prNumber} ohne HEAD-SHA — kein Check Run.`);
        return;
    }

    let installationToken: string;
    try {
        installationToken = await getInstallationToken(installationId);
    } catch (tokenError: unknown) {
        const failureReason = tokenError instanceof GitHubAppAuthError ? tokenError.reason : 'unknown';
        console.error(
            `[Webhook] Kein Installation-Token (${failureReason}) für ${prEvent.repoFullName} — `
            + `Check Run entfällt, der Job wird im Worker hart failen.`,
        );
        return;
    }

    const checkRunId = await startGatekeeperCheckRun(
        installationToken,
        prEvent.repoFullName,
        prEvent.prHeadSha,
    );

    if (checkRunId === null) {
        return;
    }

    const { error: attachError } = await supabase
        .from('review_jobs')
        .update({ check_run_id: checkRunId })
        .eq('id', jobId)
        .eq('repository_id', repositoryId);

    if (attachError) {
        console.error(`[Webhook] check_run_id ${checkRunId} nicht an Job ${jobId} anheftbar:`, attachError);
    }
}
