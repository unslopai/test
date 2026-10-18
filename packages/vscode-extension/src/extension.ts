/**
 * Extension-Entry: Command-Registrierung und Verdrahtung.
 * Kein Scan-on-Save (SPEC.md D11) — Scans sind explizit und kosten Tokens.
 */
import * as vscode from 'vscode';
import { runScan, resolveRepoRoot, CliNotFoundError, ScanFailedError } from './scanRunner';
import { publishScanResult } from './diagnostics';
import { FindingsStore } from './findingsStore';
import { GatekeeperFixProvider, applyFixCommand, APPLY_FIX_COMMAND } from './applyFix';

export function activate(extensionContext: vscode.ExtensionContext): void {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('unslop');
    const findingsStore = new FindingsStore();

    extensionContext.subscriptions.push(
        diagnosticCollection,

        vscode.commands.registerCommand('unslop.scanChanges', () =>
            scanChanges(diagnosticCollection, findingsStore),
        ),

        vscode.commands.registerCommand(APPLY_FIX_COMMAND, (fileUri: vscode.Uri, issueKey: string) =>
            applyFixCommand(fileUri, issueKey, findingsStore, diagnosticCollection),
        ),

        vscode.languages.registerCodeActionsProvider(
            { scheme: 'file' },
            new GatekeeperFixProvider(findingsStore),
            { providedCodeActionKinds: GatekeeperFixProvider.providedCodeActionKinds },
        ),
    );
}

export function deactivate(): void {
    // Alle Ressourcen hängen an context.subscriptions.
}

async function scanChanges(
    diagnosticCollection: vscode.DiagnosticCollection,
    findingsStore: FindingsStore,
): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        void vscode.window.showErrorMessage('Open a folder inside your git repository first.');
        return;
    }

    try {
        const scanOutcome = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Gatekeeper: scanning current changes…',
                cancellable: false,
            },
            async () => {
                const repoRoot = await resolveRepoRoot(workspaceFolder);
                const scanResult = await runScan(workspaceFolder);
                return { repoRoot, scanResult };
            },
        );

        const findingCount = publishScanResult(
            scanOutcome.scanResult,
            scanOutcome.repoRoot,
            diagnosticCollection,
            findingsStore,
        );

        if (findingCount === 0) {
            void vscode.window.showInformationMessage(
                `Gatekeeper: no AI slop found (${scanOutcome.scanResult.filesReviewed} file(s) reviewed).`,
            );
        } else {
            void vscode.window.showWarningMessage(
                `Gatekeeper: ${findingCount} finding(s) — see the Problems panel.`,
            );
        }
    } catch (scanError: unknown) {
        await reportScanError(scanError);
    }
}

async function reportScanError(scanError: unknown): Promise<void> {
    if (scanError instanceof CliNotFoundError) {
        const choice = await vscode.window.showErrorMessage(
            'The unslop CLI was not found. Install it globally to use the Gatekeeper.',
            'Install (npm i -g @unslop/cli)',
        );
        if (choice) {
            const installTerminal = vscode.window.createTerminal('unslop install');
            installTerminal.show();
            installTerminal.sendText('npm i -g @unslop/cli');
        }
        return;
    }

    const message = scanError instanceof ScanFailedError
        ? scanError.message
        : `Unexpected error: ${(scanError as Error).message}`;
    void vscode.window.showErrorMessage(`Gatekeeper scan failed: ${message}`);
}
