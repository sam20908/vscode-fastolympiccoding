import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http'
import * as vscode from 'vscode';

import { resolveVariables } from './util/vscodeUtil';
import { TestcasesViewProvider } from './providers/views/TestcasesViewProvider';
import { StressTesterViewProvider } from './providers/views/StressTesterViewProvider';
import { ITestcase } from './common';

let testcasesViewProvider: TestcasesViewProvider;
let stressTesterViewProvider: StressTesterViewProvider;

function registerViewProviders(context: vscode.ExtensionContext): void {
    testcasesViewProvider = new TestcasesViewProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(
        testcasesViewProvider.getViewId(),
        testcasesViewProvider
    ));

    stressTesterViewProvider = new StressTesterViewProvider(context);
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
        'fastolympiccoding.stressTest',
        () => stressTesterViewProvider.run()
    ));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.deleteAll',
        () => testcasesViewProvider.deleteAll()
    ));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand(
        'fastolympiccoding.clearData',
        () => {
            const path = testcasesViewProvider.storagePath;
            fs.writeFileSync(path, '{}');
            testcasesViewProvider.loadSavedData();
            stressTesterViewProvider.loadSavedData();
        }
    ));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand(
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
        req.on('end', () => {
            const file = vscode.window.activeTextEditor?.document.fileName;
            if (!file) {
                vscode.window.showWarningMessage("Received data from Competitive Companion, but no opened file to write data to...");
                res.end();
                return;
            }
            const data = JSON.parse(ccData);
            const testcases: ITestcase[] = [];
            for (const test of data['tests']) {
                testcases.push({
                    stdin: test['input'],
                    stderr: 'This is generated from Competitive Companion. Run this testcase to get rid of this message.',
                    stdout: '',
                    elapsed: 0,
                    status: 0,
                    acceptedOutput: test['output'],
                });
            }
            testcasesViewProvider.writeStorage(file, { testcases });
            testcasesViewProvider.loadSavedData();

            res.end();
        });
    });
    server.listen(1327);
}

export function activate(context: vscode.ExtensionContext): void {
    registerViewProviders(context);
    registerCommands(context);
    listenForCompetitiveCompanion();
}