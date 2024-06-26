import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

import { resolveVariables } from './util/vscodeUtil';
import { TestcasesViewProvider } from './providers/views/TestcasesViewProvider';
import { StressTesterViewProvider } from './providers/views/StressTesterViewProvider';

let testcasesViewProvider: TestcasesViewProvider;
let stressTesterViewProvider: StressTesterViewProvider;

function registerViewProviders(context: vscode.ExtensionContext): void {
    testcasesViewProvider = new TestcasesViewProvider(context);
    const testcasesDisposable = vscode.window.registerWebviewViewProvider(
        testcasesViewProvider.getViewId(),
        testcasesViewProvider
    );
    context.subscriptions.push(testcasesDisposable);

    stressTesterViewProvider = new StressTesterViewProvider(context);
    const stressTesterDisposable = vscode.window.registerWebviewViewProvider(
        stressTesterViewProvider.getViewId(),
        stressTesterViewProvider
    );
    context.subscriptions.push(stressTesterDisposable);
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

    const insertFileSnippetDisposable = vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.insertFileTemplate',
        async () => {
            const config = vscode.workspace.getConfiguration('fastolympiccoding');
            const baseDirectory = resolveVariables(config.get('fileTemplatesBaseDirectory')!);
            const files = fs.readdirSync(baseDirectory, { recursive: true, withFileTypes: true }).filter(value => value.isFile());
            const items = files.map(file => { return { label: file.name, description: file.path }; });
            const pickedFile = await vscode.window.showQuickPick(items, { title: 'Insert File Template' })
            if (!pickedFile) {
                return;
            }

            const content = fs.readFileSync(path.join(pickedFile.description, pickedFile.label), { encoding: 'utf-8' });
            const inserted = vscode.window.activeTextEditor?.edit((edit) => {
                edit.insert(vscode.window.activeTextEditor!.selection.active, content);
            });
            const foldTemplate = config.get('foldFileTemplate')!;
            if (inserted && foldTemplate) {
                vscode.commands.executeCommand('editor.fold');
            }
        }
    );
    context.subscriptions.push(insertFileSnippetDisposable);
}

export function activate(context: vscode.ExtensionContext): void {
    registerViewProviders(context);
    registerCommands(context);
}