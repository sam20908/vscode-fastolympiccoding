import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http'
import * as vscode from 'vscode';

import { TestcasesViewProvider } from './providers/views/TestcasesViewProvider';
import { StressTesterViewProvider } from './providers/views/StressTesterViewProvider';
import { resolveVariables } from './util';

let testcasesViewProvider: TestcasesViewProvider;
let stressTesterViewProvider: StressTesterViewProvider;

function registerViewProviders(context: vscode.ExtensionContext): void {
    testcasesViewProvider = new TestcasesViewProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(
        testcasesViewProvider.getViewId(),
        testcasesViewProvider
    ));

    stressTesterViewProvider = new StressTesterViewProvider(context, testcasesViewProvider);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(
        stressTesterViewProvider.getViewId(),
        stressTesterViewProvider
    ));
}

function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.runAll',
        () => testcasesViewProvider.runAll()
    ));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.stopAll',
        () => testcasesViewProvider.stopAll()
    ));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.deleteAll',
        () => testcasesViewProvider.deleteAll()
    ));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.stressTest',
        () => stressTesterViewProvider.run()
    ));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.clearData',
        () => {
            testcasesViewProvider.clearData();
            stressTesterViewProvider.clearData();
        }
    ));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.insertFileTemplate',
        async () => {
            const config = vscode.workspace.getConfiguration('fastolympiccoding');
            const baseDirectory = await resolveVariables(config.get('fileTemplatesBaseDirectory')!);
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
    ));
}

function listenForCompetitiveCompanion() {
    const server = http.createServer((req, res) => {
        if (req.method !== 'POST') {
            res.end();
            return;
        }

        let ccData = '';
        req.setEncoding('utf-8');
        req.on('data', data => ccData += data);
        req.on('end', async () => {
            res.end();

            const jsonData = JSON.parse(ccData);
            const askForWhichFile = vscode.workspace.getConfiguration('fastolympiccoding').get('askForWhichFile', false);
            let fileTo = vscode.window.activeTextEditor?.document.fileName;
            if (askForWhichFile) {
                fileTo = await vscode.window.showInputBox({
                    title: `Testcases for "${jsonData.name}"`,
                    placeHolder: 'File path here...',
                    value: vscode.window.activeTextEditor?.document.fileName,
                    prompt: 'The file to put the testcases onto',
                    ignoreFocusOut: true,
                });
            }
            if (fileTo === undefined || fileTo === '') {
                vscode.window.showWarningMessage("No file specified to write testcases onto");
                return;
            }
            fs.writeFileSync(fileTo, '', { flag: 'a' }); // create the file if it doesn't exist

            testcasesViewProvider.addFromCompetitiveCompanion(fileTo, jsonData);
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fileTo));
            vscode.window.showTextDocument(document);
        });
    });
    server.listen(1327);
}

export function activate(context: vscode.ExtensionContext): void {
    registerViewProviders(context);
    registerCommands(context);
    listenForCompetitiveCompanion();
}