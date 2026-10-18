/**
 * Apply-Fix-Flow: CodeAction "Apply Gatekeeper Fix (Approved)".
 *
 * Der Klick auf die Action IST die Human-in-the-loop-Freigabe (SPEC.md D4).
 * Vor dem Anwenden gilt der Exact-Match-Contract (D5, matching.ts):
 * driftet der Code, wird verweigert und das Finding als stale markiert —
 * niemals fuzzy angewendet.
 */
import * as vscode from 'vscode';
import { verifyAnchor } from './matching';
import { FindingsStore, issueKeyOf } from './findingsStore';
import { DIAGNOSTIC_SOURCE, issueKeyForDiagnostic, republishFile } from './diagnostics';

export const APPLY_FIX_COMMAND = 'unslop.applyFix';

export class GatekeeperFixProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    constructor(private readonly findingsStore: FindingsStore) {}

    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range,
        context: vscode.CodeActionContext,
    ): vscode.CodeAction[] {
        const codeActions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== DIAGNOSTIC_SOURCE) continue;

            const issueKey = issueKeyForDiagnostic(diagnostic);
            const trackedFinding = this.findingsStore.lookup(document.uri, issueKey);
            if (!trackedFinding || trackedFinding.stale || !trackedFinding.issue.fixedCodeSnippet) continue;

            const fixAction = new vscode.CodeAction(
                'Apply Gatekeeper Fix (Approved)',
                vscode.CodeActionKind.QuickFix,
            );
            fixAction.diagnostics = [diagnostic];
            fixAction.command = {
                command: APPLY_FIX_COMMAND,
                title: 'Apply Gatekeeper Fix',
                arguments: [document.uri, issueKey],
            };
            codeActions.push(fixAction);
        }

        return codeActions;
    }
}

export async function applyFixCommand(
    fileUri: vscode.Uri,
    issueKey: string,
    findingsStore: FindingsStore,
    diagnosticCollection: vscode.DiagnosticCollection,
): Promise<void> {
    const trackedFinding = findingsStore.lookup(fileUri, issueKey);
    const fixedCodeSnippet = trackedFinding?.issue.fixedCodeSnippet;
    if (!trackedFinding || !fixedCodeSnippet) {
        void vscode.window.showWarningMessage('This finding has no applicable fix.');
        return;
    }

    const document = await vscode.workspace.openTextDocument(fileUri);
    const { issue } = trackedFinding;
    const verdict = verifyAnchor(document.getText(), issue);

    if (verdict !== 'match') {
        trackedFinding.stale = true;
        republishFile(fileUri, diagnosticCollection, findingsStore);

        const choice = await vscode.window.showWarningMessage(
            'The code at this location changed since the scan — fix not applied. Re-scan to refresh findings.',
            'Re-scan',
        );
        if (choice === 'Re-scan') {
            await vscode.commands.executeCommand('unslop.scanChanges');
        }
        return;
    }

    const replacementRange = new vscode.Range(
        new vscode.Position(issue.line - 1, 0),
        document.lineAt(issue.endLine - 1).range.end,
    );

    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.replace(fileUri, replacementRange, fixedCodeSnippet);
    const editApplied = await vscode.workspace.applyEdit(workspaceEdit);

    if (!editApplied) {
        void vscode.window.showErrorMessage('VS Code rejected the edit — fix not applied.');
        return;
    }

    findingsStore.remove(fileUri, issueKeyOf(issue.line, issue.rule));
    republishFile(fileUri, diagnosticCollection, findingsStore);
    void vscode.window.setStatusBarMessage('Gatekeeper fix applied.', 4000);
}
