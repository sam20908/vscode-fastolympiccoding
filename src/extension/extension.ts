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
        testcasesViewProvider.runAll.bind(testcasesViewProvider)
    );
    context.subscriptions.push(runAllDisposable);

    const deleteAllDisposable = vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.deleteAll',
        testcasesViewProvider.deleteAll.bind(testcasesViewProvider)
    );
    context.subscriptions.push(deleteAllDisposable);
}

export function activate(context: vscode.ExtensionContext): void {
    registerViewProviders(context);
    registerCommands(context);
}