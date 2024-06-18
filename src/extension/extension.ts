import * as fs from 'fs';
import * as vscode from 'vscode';

import { TestcasesViewProvider } from './providers/views/TestcasesViewProvider';

let testcasesViewProvider: TestcasesViewProvider;

function registerViewProviders(context: vscode.ExtensionContext): void {
    testcasesViewProvider = new TestcasesViewProvider(context);
    const testcasesDisposable = vscode.window.registerWebviewViewProvider(
        testcasesViewProvider.getViewId(),
        testcasesViewProvider
    );
    context.subscriptions.push(testcasesDisposable);
}

function registerCommands(context: vscode.ExtensionContext): void {
    const runAllDisposable = vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.runAll',
        () => testcasesViewProvider.runAll()
    );
    context.subscriptions.push(runAllDisposable);

    const recompileAndRunAllDisposable = vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.recompileAndRunAll',
        () => {
            testcasesViewProvider.removeCompileCache(vscode.window.activeTextEditor!.document.fileName);
            testcasesViewProvider.runAll();
        }
    );
    context.subscriptions.push(recompileAndRunAllDisposable);

    const deleteAllDisposable = vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.deleteAll',
        () => testcasesViewProvider.deleteAll()
    );
    context.subscriptions.push(deleteAllDisposable);

    const clearTestcasesDisposable = vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.clearTestcases',
        async () => {
            const files = testcasesViewProvider.getCachedFiles();
            const pickedFiles = await vscode.window.showQuickPick(files, { canPickMany: true });
            for (const file of (pickedFiles ?? [])) {
                testcasesViewProvider.removeTestcases(file);
            }
        }
    );
    context.subscriptions.push(clearTestcasesDisposable);

    const clearDataDisposable = vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.clearData',
        () => {
            const path = testcasesViewProvider.storagePath;
            fs.writeFileSync(path, '{}');
            testcasesViewProvider.readSavedData();
        }
    );
    context.subscriptions.push(clearDataDisposable);
}

export function activate(context: vscode.ExtensionContext): void {
    registerViewProviders(context);
    registerCommands(context);
}