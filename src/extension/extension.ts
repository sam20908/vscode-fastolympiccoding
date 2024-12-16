import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http'
import * as vscode from 'vscode';

import { TestcasesViewProvider } from './providers/views/TestcasesViewProvider';
import { StressTesterViewProvider } from './providers/views/StressTesterViewProvider';
import { ReadonlyStringDocumentContentProvider, resolveVariables } from './util';

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

function registerDocumentContentProviders(context: vscode.ExtensionContext): void {
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(
        ReadonlyStringDocumentContentProvider.SCHEME,
        new ReadonlyStringDocumentContentProvider()
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
            const foldTemplate = config.get('foldFileTemplate')! as boolean;
            if (inserted && foldTemplate) {
                vscode.commands.executeCommand('editor.fold');
            }
        }
    ));
}

function listenForCompetitiveCompanion() {
    let problemDatas: any[] = [];
    let cnt = 0;
    const server = http.createServer((req, res) => {
        if (req.method !== 'POST') {
            res.end();
            return;
        }

        let ccData = '';
        req.setEncoding('utf-8');
        req.on('data', data => ccData += data);
        req.on('end', async () => {
            problemDatas.push(JSON.parse(ccData));
            res.end();
            vscode.window.showInformationMessage(`Received data for "${problemDatas.at(-1).name}"`);

            if (cnt === 0) {
                cnt = problemDatas[0].batch.size;
            }
            if (--cnt > 0) {
                return;
            }

            const file = vscode.window.activeTextEditor?.document.fileName;
            const workspace = vscode.workspace.workspaceFolders?.at(0)?.uri.fsPath ?? '';
            const config = vscode.workspace.getConfiguration('fastolympiccoding')
            const openSelectedFiles = config.get('openSelectedFiles')! as boolean;
            const askForWhichFile = config.get('askForWhichFile')! as boolean;
            const includePattern = config.get('includePattern')! as string;
            const excludePattern = config.get('excludePattern')! as string;
            const files = (await vscode.workspace.findFiles(includePattern, excludePattern)).map(file => ({
                label: path.parse(file.fsPath).base,
                description: path.parse(path.relative(workspace, file.fsPath)).dir,
            }));
            let filePaths: string[] = [];
            for (let i = 0; i < problemDatas.length; i++) {
                let fileTo = problemDatas[i].batch.size === 1 && file ? path.relative(workspace, file) : '';
                if (askForWhichFile || problemDatas[i].batch.size > 1 || !file) {
                    const pick = vscode.window.createQuickPick();
                    pick.title = `Testcases for "${problemDatas[i].name}"`;
                    pick.placeholder = 'Full file path to put testcases onto';
                    pick.value = fileTo;
                    pick.ignoreFocusOut = true;
                    pick.items = files;
                    pick.totalSteps = problemDatas[0].batch.size;
                    pick.step = i + 1;
                    pick.show();
                    fileTo = await new Promise(resolve => {
                        pick.onDidAccept(() => {
                            if (pick.selectedItems.length === 0) {
                                resolve(pick.value);
                            } else {
                                resolve(path.join(pick.selectedItems[0].description!, pick.selectedItems[0].label));
                            }
                            pick.hide();
                        });
                        pick.onDidHide(() => resolve(''));
                    });
                }
                if (fileTo === '') {
                    vscode.window.showWarningMessage(`No file to write testcases for "${problemDatas[i].name}"`);
                    continue;
                }
                fileTo = path.join(workspace, fileTo);
                if (fs.existsSync(fileTo) && !fs.lstatSync(fileTo).isFile()) {
                    vscode.window.showWarningMessage(`${fileTo} is not a file! Skipped writing testcases for "${problemDatas[i].name}"`);
                    continue;
                }
                fs.writeFileSync(fileTo, '', { flag: 'a' }); // create the file if it doesn't exist

                testcasesViewProvider.addFromCompetitiveCompanion(fileTo, problemDatas[i]);
                filePaths.push(fileTo);
            }
            if (openSelectedFiles) {
                for (const filePath of filePaths) {
                    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                    await vscode.window.showTextDocument(document);
                }
            }
            problemDatas = [];
        });
    });
    server.listen(1327);
}

export function activate(context: vscode.ExtensionContext): void {
    registerViewProviders(context);
    registerCommands(context);
    registerDocumentContentProviders(context);
    listenForCompetitiveCompanion();
}