/**
 * Extension entry — wires up the state machine from VSCODE_UX_SPEC.md:
 * status bar as the state surface (V1), silent CLI login (V2), passive
 * non-repo states (V3/V4), connect-and-continue (V5), separate
 * 402/429 handling (V6), live stale marking (V7), folder resolution
 * via the active editor (V8). No scan-on-save — scans cost tokens.
 */
import * as vscode from 'vscode';
import { runScan, probeCliAvailable, resolveCliCommand } from './scanRunner';
import { publishScanResult, republishFile } from './diagnostics';
import { FindingsStore } from './findingsStore';
import { GatekeeperFixProvider, applyFixCommand, APPLY_FIX_COMMAND } from './applyFix';
import { ExtensionStateController, STATUS_BAR_ACTION_COMMAND } from './stateController';
import { collectGitFacts, initGitRepository, originRefsPresent, repoHasCommits } from './gitFacts';
import { resolveCliConfig } from './cliConfig';
import { runLoginFlow } from './loginFlow';
import { runConnectFlow } from './connectFlow';
import { changeTouchesAnchor, classifyMergeBaseRemedy } from './stateMachine';
import { sanitizeModelText } from './sanitize';
import { describeFindingVerification } from './verificationSummary';
import type { IntegrityNotice, NothingReviewedNotice } from './stateMachine';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('unslop');
const findingsStore = new FindingsStore();
let stateController: ExtensionStateController;

/** Once-per-session notifications (V6) — deliberately NOT persisted. */
const sessionNotificationsShown = { billing: false, quota: false };

/** Cognitive Integrity Score + verification balance of the last scan (null = no scan yet). */
let lastIntegrity: IntegrityNotice | null = null;

/**
 * Set when the last scan reviewed zero files (ROADMAP §3) — RESULTS then
 * renders the nothing-reviewed warning instead of "No slop ✓".
 * filesReviewed === 0 doubles as the guard for CLI versions that predate
 * the outcome field.
 */
let lastNothingReviewed: NothingReviewedNotice | null = null;

export function activate(extensionContext: vscode.ExtensionContext): void {
    stateController = new ExtensionStateController();

    extensionContext.subscriptions.push(
        diagnosticCollection,
        stateController,

        vscode.commands.registerCommand('unslop.scanChanges', () => scanChanges()),
        vscode.commands.registerCommand(STATUS_BAR_ACTION_COMMAND, () => dispatchStatusBarAction()),
        vscode.commands.registerCommand(APPLY_FIX_COMMAND, async (fileUri: vscode.Uri, issueKey: string) => {
            await applyFixCommand(fileUri, issueKey, findingsStore, diagnosticCollection);
            refreshResultsState();
        }),

        vscode.languages.registerCodeActionsProvider(
            { scheme: 'file' },
            new GatekeeperFixProvider(findingsStore),
            { providedCodeActionKinds: GatekeeperFixProvider.providedCodeActionKinds },
        ),

        vscode.workspace.onDidChangeWorkspaceFolders(() => void evaluateBaseState()),
        vscode.workspace.onDidChangeConfiguration((configEvent) => {
            if (configEvent.affectsConfiguration('unslop')) void evaluateBaseState();
        }),
        vscode.workspace.onDidChangeTextDocument((changeEvent) => markTouchedFindingsStale(changeEvent)),
    );

    void evaluateBaseState();
}

export function deactivate(): void {
    // All resources are attached to context.subscriptions.
}

// =============================================================================
// Base state (git facts + credentials; cheap, local — §2)
// =============================================================================

async function evaluateBaseState(): Promise<void> {
    if (findingsStore.hasAnyFindings()) {
        refreshResultsState();
        return;
    }

    const targetFolder = resolveTargetFolderQuietly();

    // Multiple folders without an active editor: the target is still open, but one
    // DOES exist — the state must not be NO_FOLDER, or the V8 QuickPick reached via
    // the status bar stays unreachable. The git facts are only known after the
    // selection; the CLI/key check is folder-independent and already runs.
    if (targetFolder.kind === 'ambiguous') {
        await applyCredentialState();
        return;
    }
    if (targetFolder.kind === 'none') {
        stateController.setState('NO_FOLDER');
        return;
    }

    const gitFacts = await collectGitFacts(targetFolder.folderPath);
    if (!gitFacts.isGitRepo) {
        stateController.setState('NOT_A_REPO');
        return;
    }
    if (!gitFacts.originFullName) {
        stateController.setState('NO_ORIGIN');
        return;
    }

    await applyCredentialState();
}

/** Folder-independent preconditions: CLI present, API key set. */
async function applyCredentialState(): Promise<void> {
    if (!(await probeCliAvailable())) {
        stateController.setState('CLI_MISSING');
        return;
    }
    stateController.setState(currentCliConfig().apiKey ? 'READY' : 'SIGNED_OUT');
}

function currentCliConfig() {
    const settings = vscode.workspace.getConfiguration('unslop');
    return resolveCliConfig({
        apiKeySetting: settings.get<string>('apiKey', ''),
        baseUrlSetting: settings.get<string>('baseUrl', ''),
    });
}

// =============================================================================
// V8 folder resolution. The cases are DELIBERATELY distinguishable: "no folder"
// (passive state) and "multiple folders, none selected" (QuickPick) are
// different situations — mapping them onto a shared null was exactly the
// dead end that made the V8 QuickPick unreachable.
// =============================================================================

interface ResolvedFolder {
    readonly kind: 'folder';
    readonly folderPath: string;
}

/** Result of the silent resolution: open ('ambiguous') is NOT empty ('none'). */
type QuietFolderTarget = ResolvedFolder | { readonly kind: 'none' } | { readonly kind: 'ambiguous' };

/** Result WITH QuickPick: 'ambiguous' is resolved here by construction. */
type ScanFolderTarget = ResolvedFolder | { readonly kind: 'none' } | { readonly kind: 'cancelled' };

/** V8 without UI: active editor → its folder; otherwise the only folder. */
function resolveTargetFolderQuietly(): QuietFolderTarget {
    const activeDocumentUri = vscode.window.activeTextEditor?.document.uri;
    if (activeDocumentUri) {
        const editorFolder = vscode.workspace.getWorkspaceFolder(activeDocumentUri);
        if (editorFolder) return { kind: 'folder', folderPath: editorFolder.uri.fsPath };
    }

    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    if (workspaceFolders.length === 0) return { kind: 'none' };
    if (workspaceFolders.length === 1) {
        return { kind: 'folder', folderPath: workspaceFolders[0].uri.fsPath };
    }
    return { kind: 'ambiguous' }; // V8: NEVER silently fall back to the first folder
}

/** V8 with UI: multi-root without an active editor → QuickPick ('cancelled' = aborted). */
async function resolveTargetFolder(): Promise<ScanFolderTarget> {
    const quietTarget = resolveTargetFolderQuietly();
    if (quietTarget.kind !== 'ambiguous') return quietTarget;

    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    const pickedFolder = await vscode.window.showQuickPick(
        workspaceFolders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath })),
        { placeHolder: 'Which folder should the Gatekeeper scan?' },
    );
    if (!pickedFolder) return { kind: 'cancelled' };
    return { kind: 'folder', folderPath: pickedFolder.description };
}

// =============================================================================
// Status bar dispatch (V1: click = the one meaningful action for the state)
// =============================================================================

async function dispatchStatusBarAction(): Promise<void> {
    switch (stateController.state) {
        case 'NO_FOLDER':
            void vscode.window.showInformationMessage(
                'Gatekeeper reviews git changes — open a git repository to scan.',
            );
            return;
        case 'NOT_A_REPO':
        case 'NO_ORIGIN':
            // These states are snapshots of a folder choice that is stored nowhere.
            // In multi-root without an active editor the choice came from the V8
            // QuickPick — a click must re-resolve the target (picker reappears),
            // not repeat a dead-end toast for a folder the user may not mean.
            return scanChanges();
        case 'SIGNED_OUT': {
            const loginSucceeded = await runLoginFlow(currentCliConfig().baseUrl);
            if (loginSucceeded) await evaluateBaseState();
            return;
        }
        case 'CLI_MISSING':
            return offerCliInstall();
        case 'PAUSED_BILLING':
            void vscode.env.openExternal(
                vscode.Uri.parse(`${currentCliConfig().baseUrl}/dashboard/settings/billing`),
            );
            return;
        case 'QUOTA_REACHED':
            void vscode.window.showInformationMessage(
                'Scan quota reached. The hourly window resets automatically; monthly quota resets on the 1st.',
            );
            return;
        case 'NOT_CONNECTED':
            return scanChanges(); // re-triggers the connect flow
        case 'SCANNING':
        case 'CONNECTING':
            return; // action in progress — deliberate no-op
        case 'RESULTS': {
            const counts = findingsStore.countsAll();
            if (counts.critical + counts.warning > 0 && counts.stale === 0) {
                void vscode.commands.executeCommand('workbench.actions.view.problems');
                return;
            }
            return scanChanges(); // clean or stale → re-scan
        }
        case 'SCAN_FAILED':
        case 'READY':
            return scanChanges();
    }
}

const PUBLISH_TO_GITHUB_ACTION = 'Publish to GitHub';
const COPY_COMMAND_ACTION = 'Copy command';

/**
 * NO_ORIGIN guidance (V4). `[Publish to GitHub]` delegates to VS Code's native
 * GitHub extension (`github.publish`): auth, repo creation (public/private
 * prompt), initial commit for an empty repo, remote and push all happen there —
 * our extension still mutates nothing beyond §3.2's `git init`.
 */
async function showNoOriginGuidance(): Promise<void> {
    const guidanceChoice = await vscode.window.showInformationMessage(
        "This repository has no 'origin' remote. Gatekeeper identifies repositories by their GitHub origin.",
        PUBLISH_TO_GITHUB_ACTION,
        COPY_COMMAND_ACTION,
    );

    if (guidanceChoice === COPY_COMMAND_ACTION) {
        void vscode.env.clipboard.writeText('git remote add origin https://github.com/<owner>/<repo>.git');
        void vscode.window.showInformationMessage(
            'Command copied — run it in your terminal, push, then scan again.',
        );
        return;
    }

    if (guidanceChoice === PUBLISH_TO_GITHUB_ACTION) {
        // github.publish resolves when its UI opens, NOT when the flow finishes
        // (F5-observed 2026-08-10) — no post-publish automation is possible here
        // (an immediate git.fetch fired into the still-open dialog). The next
        // status-bar click re-resolves fresh git facts and proceeds; missing
        // remote-tracking refs surface the CLI's actionable fetch-first error.
        try {
            await vscode.commands.executeCommand('github.publish');
        } catch {
            // Built-in GitHub extension disabled/missing — the command doesn't exist.
            void vscode.window.showWarningMessage(
                "VS Code's GitHub extension isn't available — use 'Copy command' to add the remote manually.",
            );
        }
    }
}

const INITIALIZE_REPO_ACTION = 'Initialize Git Repository';

/**
 * NOT_A_REPO guidance (V3: info, never an alarm) with the one-click `git init`
 * (§3.2 amendment 2026-08-10). A fresh repo has no origin and no commits, so a
 * bare init would be a false affordance — after success the state re-evaluates
 * and chains straight into the NO_ORIGIN guidance for the next concrete step.
 */
async function showNotARepoGuidance(folderPath: string): Promise<void> {
    const guidanceChoice = await vscode.window.showInformationMessage(
        "Gatekeeper reviews git changes — this folder isn't a git repository.",
        INITIALIZE_REPO_ACTION,
    );
    if (guidanceChoice !== INITIALIZE_REPO_ACTION) return;

    if (!(await initGitRepository(folderPath))) {
        void vscode.window.showWarningMessage(
            'Gatekeeper could not initialize the repository — is git installed and the folder writable?',
        );
        return;
    }
    await evaluateBaseState();
    return showNoOriginGuidance();
}

// =============================================================================
// Scan flow (incl. login continuation, connect-and-continue, 402/429)
// =============================================================================

async function scanChanges(alreadyRetriedAfterConnect = false): Promise<void> {
    const targetFolder = await resolveTargetFolder();
    if (targetFolder.kind === 'cancelled') {
        return; // A cancelled QuickPick is not an error — the state stays as it was.
    }
    if (targetFolder.kind === 'none') {
        stateController.setState('NO_FOLDER');
        void vscode.window.showInformationMessage(
            'Gatekeeper reviews git changes — open a git repository to scan.',
        );
        return;
    }

    const gitFacts = await collectGitFacts(targetFolder.folderPath);
    if (!gitFacts.isGitRepo) {
        stateController.setState('NOT_A_REPO');
        return showNotARepoGuidance(targetFolder.folderPath);
    }
    if (!gitFacts.originFullName || !gitFacts.repoRoot) {
        stateController.setState('NO_ORIGIN');
        return showNoOriginGuidance();
    }

    const cliConfig = currentCliConfig();
    if (!cliConfig.apiKey) {
        stateController.setState('SIGNED_OUT');
        const loginSucceeded = await runLoginFlow(cliConfig.baseUrl);
        if (!loginSucceeded) return;
        // §3.1: a login triggered by a scan continues the scan automatically.
        return scanChanges(alreadyRetriedAfterConnect);
    }

    stateController.setState('SCANNING');
    const scanOutcome = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: 'Gatekeeper: scanning current changes…',
        },
        () => runScan(targetFolder.folderPath),
    );

    switch (scanOutcome.kind) {
        case 'ok': {
            publishScanResult(scanOutcome.result, gitFacts.repoRoot, diagnosticCollection, findingsStore);
            lastIntegrity = {
                score: scanOutcome.result.cognitiveIntegrityScore,
                verificationSummary: describeFindingVerification(scanOutcome.result.issues),
            };
            const scanReviewedNothing = scanOutcome.result.outcome === 'nothing_reviewed'
                || scanOutcome.result.filesReviewed === 0;
            lastNothingReviewed = scanReviewedNothing
                ? {
                    // summary/paths cross the wire — same ingest hygiene as diagnostics (ROADMAP §12).
                    reason: sanitizeModelText(scanOutcome.result.summary),
                    omittedFiles: (scanOutcome.result.omittedFiles ?? []).map(sanitizeModelText),
                }
                : null;
            refreshResultsState();
            return;
        }
        case 'cli_missing':
            stateController.setState('CLI_MISSING');
            return offerCliInstall();
        case 'not_connected': {
            stateController.setState('NOT_CONNECTED', undefined, gitFacts.originFullName);
            if (alreadyRetriedAfterConnect) {
                void vscode.window.showWarningMessage(
                    'The repository still reports as not connected — check the dashboard.',
                );
                return;
            }
            const connected = await runConnectFlow(cliConfig, gitFacts.originFullName);
            if (connected) {
                return scanChanges(true); // §3.3: the original scan continues automatically
            }
            return;
        }
        case 'paywalled': {
            stateController.setState('PAUSED_BILLING');
            if (!sessionNotificationsShown.billing) {
                sessionNotificationsShown.billing = true;
                const billingChoice = await vscode.window.showWarningMessage(
                    'Gatekeeper scans are paused — no active subscription or trial.',
                    'Open billing',
                    'Dismiss',
                );
                if (billingChoice === 'Open billing') {
                    void vscode.env.openExternal(
                        vscode.Uri.parse(`${cliConfig.baseUrl}/dashboard/settings/billing`),
                    );
                }
            }
            return;
        }
        case 'quota': {
            stateController.setState('QUOTA_REACHED');
            if (!sessionNotificationsShown.quota) {
                sessionNotificationsShown.quota = true;
                void vscode.window.showInformationMessage(
                    'Scan quota reached. The hourly window resets automatically; monthly quota resets on the 1st.',
                );
            }
            return;
        }
        case 'unauthorized':
            stateController.setState('SIGNED_OUT');
            void vscode.window.showWarningMessage(
                'Your Gatekeeper API key is invalid or revoked — sign in again.',
            );
            return;
        case 'stalled':
            stateController.setState('SCAN_FAILED');
            return offerRetry('The scan timed out on the server — retry; if it persists, check the dashboard.');
        case 'model_unavailable':
            stateController.setState('SCAN_FAILED');
            return offerRetry('The AI model is temporarily out of capacity — nothing is wrong with your repository. Retry in a minute.');
        case 'review_timeout':
            stateController.setState('SCAN_FAILED');
            return offerRetry('The review exceeded the time limit for this plan — retry; large change sets take longest.');
        case 'generic':
            return handleGenericScanFailure(scanOutcome.detail, targetFolder.folderPath);
    }
}

/**
 * §4.2: the CLI differentiates the repository states behind a failed
 * merge-base (Z1–Z5) — each state gets the ONE action that actually cures it,
 * instead of the old blanket [Fetch Remote]. Z3/Z4 and Z5 deliberately offer
 * no re-scan action: neither fetching nor retrying can change those states.
 */
async function handleGenericScanFailure(failureDetail: string, folderPath: string): Promise<void> {
    stateController.setState('SCAN_FAILED');
    const failureMessage = `Gatekeeper scan failed: ${failureDetail.substring(0, 200)}`;
    switch (classifyMergeBaseRemedy(failureDetail)) {
        case 'fetch_remote':
            return offerFetchAndRescan(failureMessage, folderPath);
        case 'push_branch':
            return offerPushAndRescan(failureMessage, folderPath);
        case 'create_commit':
            return offerInitialCommit(failureMessage, folderPath);
        case 'remote_not_found':
            return showRemoteNotFoundExplainer();
        case 'unrelated_history':
            void vscode.window.showErrorMessage(failureMessage);
            return;
        case 'none':
            return offerRetry(failureMessage);
    }
}

function refreshResultsState(): void {
    // The score belongs to the last scan and survives stale recomputations —
    // an edit in the editor does not change the confidence of the review.
    stateController.setState('RESULTS', findingsStore.countsAll(), undefined, lastIntegrity, lastNothingReviewed);
}

async function offerRetry(failureMessage: string): Promise<void> {
    const retryChoice = await vscode.window.showErrorMessage(failureMessage, 'Retry');
    if (retryChoice === 'Retry') await scanChanges();
}

const FETCH_REMOTE_ACTION = 'Fetch Remote';

/**
 * §4.2: the fetch-first GitError gets `[Fetch Remote]` instead of `[Retry]`.
 * Safe here, unlike post-publish automation: a remote provably exists (the
 * scan got past origin resolution to the merge-base) and no dialog is open.
 * The fetch itself runs in VS Code's built-in git extension (V4: not ours).
 * A fetch that produces no origin refs means GitHub's masked 404 (wrong
 * account on a private repo) — that gets our explainer instead of silence
 * next to VS Code's raw "Repository not found" toast.
 */
async function offerFetchAndRescan(failureMessage: string, folderPath: string): Promise<void> {
    const fetchChoice = await vscode.window.showErrorMessage(failureMessage, FETCH_REMOTE_ACTION);
    if (fetchChoice !== FETCH_REMOTE_ACTION) return;

    try {
        await vscode.commands.executeCommand('git.fetch');
    } catch {
        void vscode.window.showWarningMessage(
            "VS Code's git extension couldn't fetch — run 'git fetch' in your terminal, then re-scan.",
        );
        return;
    }
    if (await originRefsPresent(folderPath)) {
        return scanChanges();
    }
    const noRefsChoice = await vscode.window.showWarningMessage(
        "The fetch brought no remote branches. If the repository exists but is private, GitHub deliberately "
        + `answers 'not found' to the wrong account — ${ACCOUNT_CHECKLIST}`,
        COPY_FIX_COMMAND_ACTION,
    );
    if (noRefsChoice === COPY_FIX_COMMAND_ACTION) copyCredentialFixCommand();
}

const COPY_FIX_COMMAND_ACTION = 'Copy fix command';
const CREDENTIAL_USE_HTTP_PATH_TIP = 'git config --global credential.useHttpPath true';

/**
 * Editor-neutral wording on purpose: VS Code forks move the Accounts menu
 * (Antigravity: top right, VS Code: bottom left) — a hardcoded position was
 * wrong for every fork (F5 finding 2026-08-31).
 */
const ACCOUNT_CHECKLIST =
    "check your editor's Accounts menu and the credential manager entry 'git:https://github.com'. "
    + `Tip for multiple accounts: ${CREDENTIAL_USE_HTTP_PATH_TIP}`;

/** V4 copy pattern: the one actionable step in the checklist lands on the clipboard. */
function copyCredentialFixCommand(): void {
    void vscode.env.clipboard.writeText(CREDENTIAL_USE_HTTP_PATH_TIP);
    void vscode.window.showInformationMessage(
        'Command copied — run it in your terminal, sign in with the right account, then scan again.',
    );
}

const PUSH_BRANCH_ACTION = 'Push Branch';

/**
 * §4.2 Z2: the remote exists but is empty — fetching cannot cure that, the
 * local branch has to be pushed. The push runs in VS Code's built-in git
 * extension (V4: not ours); like the fetch and commit chains, the re-scan
 * only starts once the push provably created remote-tracking refs — a
 * pending or cancelled push dialog ends the chain without a loop.
 */
async function offerPushAndRescan(failureMessage: string, folderPath: string): Promise<void> {
    const pushChoice = await vscode.window.showErrorMessage(failureMessage, PUSH_BRANCH_ACTION);
    if (pushChoice !== PUSH_BRANCH_ACTION) return;

    try {
        await vscode.commands.executeCommand('git.push');
    } catch {
        void vscode.window.showWarningMessage(
            "VS Code's git extension couldn't push — run 'git push -u origin <branch>' in your terminal, then re-scan.",
        );
        return;
    }
    if (await originRefsPresent(folderPath)) {
        return scanChanges();
    }
    void vscode.window.showWarningMessage(
        'The push created no remote branches yet — push from the Source Control view or your terminal, then re-scan.',
    );
}

/**
 * §4.2 Z3/Z4: GitHub answered 'not found' for origin. The two causes are
 * indistinguishable from outside (GitHub masks private repositories to the
 * wrong account), so the explainer names both — deliberately without a
 * re-scan action, because neither fetching nor retrying can cure this state.
 * The only offered button copies the multi-account fix command (V4 pattern).
 */
async function showRemoteNotFoundExplainer(): Promise<void> {
    const explainerChoice = await vscode.window.showErrorMessage(
        "Gatekeeper scan failed: GitHub reports the 'origin' repository as not found. Either it doesn't exist yet "
        + '(publish it first), or it is private and the active GitHub account cannot see it — GitHub deliberately '
        + `masks private repositories as 'not found' to the wrong account. To fix it, ${ACCOUNT_CHECKLIST}`,
        COPY_FIX_COMMAND_ACTION,
    );
    if (explainerChoice === COPY_FIX_COMMAND_ACTION) copyCredentialFixCommand();
}

const CREATE_COMMIT_ACTION = 'Create Initial Commit';

/**
 * §4.2: zero-commits failure. The commit itself runs in VS Code's built-in git
 * extension (`git.commitAll` — V4: not ours). Whether that command awaits its
 * message editor is as undocumented as github.publish's semantics were, so
 * instead of chaining blindly the re-scan only starts once HEAD provably
 * exists; a pending/cancelled commit ends the chain and the next shield click
 * continues it.
 */
async function offerInitialCommit(failureMessage: string, folderPath: string): Promise<void> {
    const commitChoice = await vscode.window.showErrorMessage(failureMessage, CREATE_COMMIT_ACTION);
    if (commitChoice !== CREATE_COMMIT_ACTION) return;

    try {
        await vscode.commands.executeCommand('git.commitAll');
    } catch {
        void vscode.window.showWarningMessage(
            "VS Code's git extension couldn't commit — commit in the Source Control view, then re-scan.",
        );
        return;
    }
    if (await repoHasCommits(folderPath)) {
        return scanChanges();
    }
}

// =============================================================================
// CLI installation (§4.1: terminal + re-probe, no manual reload)
// =============================================================================

async function offerCliInstall(): Promise<void> {
    const installChoice = await vscode.window.showErrorMessage(
        'The unslop CLI was not found. Install it globally to use the Gatekeeper.',
        'Install (npm i -g @unslop/cli)',
    );
    if (!installChoice) return;

    const installTerminal = vscode.window.createTerminal('unslop install');
    installTerminal.show();
    installTerminal.sendText('npm i -g @unslop/cli');

    // Re-probe every 10s, max 5 minutes — on success re-evaluate the state.
    for (let probeAttempt = 0; probeAttempt < 30; probeAttempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        if (await probeCliAvailable()) {
            void vscode.window.setStatusBarMessage(`✔ CLI found (${resolveCliCommand()}).`, 5000);
            await evaluateBaseState();
            return;
        }
    }
}

// =============================================================================
// Live stale marking (V7): edits on flagged lines gray out immediately
// =============================================================================

function markTouchedFindingsStale(changeEvent: vscode.TextDocumentChangeEvent): void {
    const trackedFindings = findingsStore.findingsFor(changeEvent.document.uri);
    if (trackedFindings.length === 0) return;

    let anyFindingWentStale = false;

    for (const contentChange of changeEvent.contentChanges) {
        const newlineCount = (contentChange.text.match(/\n/g) ?? []).length;
        const replacedLineCount = contentChange.range.end.line - contentChange.range.start.line;
        const addedLineDelta = newlineCount - replacedLineCount;

        for (const tracked of trackedFindings) {
            if (tracked.stale) continue;
            const touchesAnchor = changeTouchesAnchor(
                { startLine: contentChange.range.start.line, endLine: contentChange.range.end.line },
                { startLine: tracked.issue.line - 1, endLine: tracked.issue.endLine - 1 },
                addedLineDelta,
            );
            if (touchesAnchor) {
                tracked.stale = true;
                anyFindingWentStale = true;
            }
        }
    }

    if (anyFindingWentStale) {
        republishFile(changeEvent.document.uri, diagnosticCollection, findingsStore);
        refreshResultsState();
    }
}
