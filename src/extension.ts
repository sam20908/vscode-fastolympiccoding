import * as path from 'node:path';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as vscode from 'vscode';

import JudgeViewProvider from './views/judge/provider/JudgeViewProvider';
import StressViewProvider from './views/stress/provider/StressViewProvider';
import { ReadonlyStringProvider, resolveVariables } from '~utils/vscode';
import type { ILanguageSettings, IProblem } from '~common/provider';
import { compile } from '~utils/runtime';

let judgeViewProvider: JudgeViewProvider;
let stressViewProvider: StressViewProvider;

function registerViewProviders(context: vscode.ExtensionContext): void {
	judgeViewProvider = new JudgeViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			judgeViewProvider.getViewId(),
			judgeViewProvider,
		),
	);

	stressViewProvider = new StressViewProvider(context, judgeViewProvider);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			stressViewProvider.getViewId(),
			stressViewProvider,
		),
	);
}

function registerDocumentContentProviders(
	context: vscode.ExtensionContext,
): void {
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(
			ReadonlyStringProvider.SCHEME,
			new ReadonlyStringProvider(),
		),
	);
}

function registerCommands(context: vscode.ExtensionContext): void {
	const compilationStatusItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		10000,
	);
	compilationStatusItem.name = 'Compilation Status';
	compilationStatusItem.text = '$(zap) Compiling...';
	compilationStatusItem.backgroundColor = new vscode.ThemeColor(
		'statusBarItem.warningBackground',
	);
	compilationStatusItem.hide(); // enable and disable it as necessary
	context.subscriptions.push(compilationStatusItem);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand(
			'fastolympiccoding.compile',
			() => {
				const file = vscode.window.activeTextEditor?.document.fileName;
				if (!file) {
					return;
				}

				const config = vscode.workspace.getConfiguration('fastolympiccoding');
				const extension = path.extname(file);
				const runSettings = config.get<ILanguageSettings>(
					`runSettings.${extension}`,
				);
				if (!runSettings) {
					vscode.window.showWarningMessage(
						`No run setting detected for file extension "${extension}"`,
					);
					return;
				}
				if (runSettings.compileCommand) {
					void compile(file, runSettings.compileCommand, context); // we don't care about exit code of compilation
				}
			},
		),
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand('fastolympiccoding.runAll', () =>
			judgeViewProvider.runAll(),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand('fastolympiccoding.stopAll', () =>
			judgeViewProvider.stopAll(),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand(
			'fastolympiccoding.deleteAll',
			() => judgeViewProvider.deleteAll(),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand(
			'fastolympiccoding.stressTest',
			() => void stressViewProvider.run(),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand(
			'fastolympiccoding.clearData',
			() => {
				judgeViewProvider.clearData();
				stressViewProvider.clearData();
			},
		),
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand(
			'fastolympiccoding.insertFileTemplate',
			() => {
				void (async () => {
					const config = vscode.workspace.getConfiguration('fastolympiccoding');
					const baseDirectory = resolveVariables(
						// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
						config.get('fileTemplatesBaseDirectory')!,
					);
					const files = fs
						.readdirSync(baseDirectory, {
							recursive: true,
							withFileTypes: true,
						})
						.filter((value) => value.isFile());
					const items = files.map((file) => {
						return { label: file.name, description: file.path };
					});
					const pickedFile = await vscode.window.showQuickPick(items, {
						title: 'Insert File Template',
					});
					if (!pickedFile) {
						return;
					}

					const content = fs.readFileSync(
						path.join(pickedFile.description, pickedFile.label),
						{ encoding: 'utf-8' },
					);
					const inserted = vscode.window.activeTextEditor?.edit(
						(edit: vscode.TextEditorEdit) => {
							if (vscode.window.activeTextEditor) {
								edit.insert(
									vscode.window.activeTextEditor.selection.active,
									content,
								);
							}
						},
					);
					// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
					const foldTemplate = config.get<boolean>('foldFileTemplate')!;
					if (inserted && foldTemplate) {
						vscode.commands.executeCommand('editor.fold');
					}
				})();
			},
		),
	);
}

function listenForCompetitiveCompanion() {
	let problemDatas: IProblem[] = [];
	let cnt = 0;
	const server = http.createServer((req, res) => {
		if (req.method !== 'POST') {
			res.end();
			return;
		}

		let ccData = '';
		req.setEncoding('utf-8');
		req.on('data', (data) => {
			ccData += data;
		});
		req.on('end', () => {
			void (async () => {
				res.end();

				problemDatas.push(JSON.parse(ccData) as IProblem);
				if (problemDatas.length === 0) {
					return;
				}

				vscode.window.showInformationMessage(
					`Received data for "${problemDatas[problemDatas.length - 1].name}"`,
				);

				if (cnt === 0) {
					cnt = problemDatas[0].batch.size;
				}
				if (--cnt > 0) {
					return;
				}

				const file = vscode.window.activeTextEditor?.document.fileName;
				const workspace =
					vscode.workspace.workspaceFolders?.at(0)?.uri.fsPath ?? '';
				const config = vscode.workspace.getConfiguration('fastolympiccoding');
				// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
				const openSelectedFiles = config.get<boolean>('openSelectedFiles')!;
				// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
				const askForWhichFile = config.get<boolean>('askForWhichFile')!;
				// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
				const includePattern = config.get<string>('includePattern')!;
				// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
				const excludePattern = config.get<string>('excludePattern')!;
				const files = (
					await vscode.workspace.findFiles(includePattern, excludePattern)
				).map((file) => ({
					label: path.parse(file.fsPath).base,
					description: path.parse(path.relative(workspace, file.fsPath)).dir,
				}));
				const filePaths: string[] = [];
				for (let i = 0; i < problemDatas.length; i++) {
					let fileTo =
						problemDatas[i].batch.size === 1 && file
							? path.relative(workspace, file)
							: '';
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
						fileTo = await new Promise((resolve) => {
							pick.onDidAccept(() => {
								if (pick.selectedItems.length === 0) {
									resolve(pick.value);
								} else {
									resolve(
										path.join(
											pick.selectedItems[0].description ?? '',
											pick.selectedItems[0].label,
										),
									);
								}
								pick.hide();
							});
							pick.onDidHide(() => resolve(''));
						});
					}
					if (fileTo === '') {
						vscode.window.showWarningMessage(
							`No file to write testcases for "${problemDatas[i].name}"`,
						);
						continue;
					}
					fileTo = path.join(workspace, fileTo);
					if (fs.existsSync(fileTo) && !fs.lstatSync(fileTo).isFile()) {
						vscode.window.showWarningMessage(
							`${fileTo} is not a file! Skipped writing testcases for "${problemDatas[i].name}"`,
						);
						continue;
					}
					fs.writeFileSync(fileTo, '', { flag: 'a' }); // create the file if it doesn't exist

					judgeViewProvider.addFromCompetitiveCompanion(
						fileTo,
						problemDatas[i],
					);
					filePaths.push(fileTo);
				}
				if (openSelectedFiles) {
					for (const filePath of filePaths) {
						const document = await vscode.workspace.openTextDocument(
							vscode.Uri.file(filePath),
						);
						await vscode.window.showTextDocument(document);
					}
				}
				problemDatas = [];
			})();
		});
	});
	server.listen(1327);
}

function addActiveStatus(context: vscode.ExtensionContext): void {
	const statusItem = vscode.window.createStatusBarItem(
		'fastolympiccoding.active',
		vscode.StatusBarAlignment.Left,
	);
	statusItem.name = 'Fast Olympic Coding Indicator';
	statusItem.text = '$(zap)';
	statusItem.tooltip = 'Fast Olympic Coding is Active';
	statusItem.show();
	context.subscriptions.push(statusItem);
}

export function activate(context: vscode.ExtensionContext): void {
	registerViewProviders(context);
	registerCommands(context);
	registerDocumentContentProviders(context);
	listenForCompetitiveCompanion();
	addActiveStatus(context);
}
