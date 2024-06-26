import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

import { RunningProcess } from '../../util/runUtil';
import { BaseViewProvider, IMessage } from "./BaseViewProvider";
import { ILanguageRunSettings } from '../../common';
import { DummyTerminal, resolveVariables } from '../../util/vscodeUtil';

interface IStressTestData {
    input: string;
    stdout: string;
    goodStdout: string;
}

interface IStorage {
    [name: string]: IStressTestData[]
}

function readFileJson(path: string): any {
    try {
        const content = fs.readFileSync(path, { encoding: 'utf-8' });
        return JSON.parse(content);
    } catch (_) {
        return {};
    }
}

function readStorageState(path: string): IStorage {
    const state: IStorage = {};
    for (const [file, obj] of Object.entries(readFileJson(path))) {
        state[file] = (obj as any).stressTestDatas;
    }
    return state;
}

function updateStorageState(path: string, file: string, stressTestDatas: IStressTestData[] | undefined): void {
    const fileData = readFileJson(path);
    if (!stressTestDatas) {
        delete fileData[file];
    } else {
        fileData[file] = { ...fileData[file], stressTestDatas };
    }
    fs.writeFileSync(path, JSON.stringify(fileData));
}

export class StressTesterViewProvider extends BaseViewProvider {
    private _state: IStorage = {};
    private _lastCompiled: Map<string, [number, string]> = new Map();
    private _errorTerminal: Map<string, vscode.Terminal> = new Map();
    private _compileProcess: RunningProcess | undefined = undefined;
    private _runningProcess: RunningProcess | undefined = undefined;

    onMessage(message: IMessage): void {
        switch (message.type) {
            case 'LOADED':
                this._onLoaded();
                break;
            case 'STRESS_TEST':
                this._onStressTest();
                break;
        }
    }

    constructor(context: vscode.ExtensionContext) {
        super('stress-tester', context);

        vscode.window.onDidChangeActiveTextEditor(this._onChangeActiveFile, this);
    }

    public readSavedData() {
        this._killAllProcesses();
        this._state = readStorageState(this.storagePath);
        this._onChangeActiveFile();
    }

    private async _onChangeActiveFile(): Promise<void> {
        // this._killAllProcesses();

        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            super._postMessage('SAVED_DATA');
            return;
        }
        super._postMessage('SAVED_DATA', this._state[file] ?? []);
    }

    private _onLoaded(): void {
        this._onChangeActiveFile();
    }

    private async _onStressTest(): Promise<void> {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }

        const extension = path.extname(file);
        const config = vscode.workspace.getConfiguration('fastolympiccoding');
        const forceCompilation: boolean = config.get('forceCompilation')!;
        const runSettings: ILanguageRunSettings | undefined = config.get('runSettings', {} as any)[extension];
        if (!runSettings) {
            vscode.window.showWarningMessage(`No run setting detected for file extension "${extension}"`);
            // FIXME post err
            return;
        }

        if (runSettings.compileCommand) {
            if (this._compileProcess) {
                super._postMessage('STATUS', { status: 'COMPILING' });
                const code = await this._compileProcess.promise; // another testcase is compiling
                if (code) {
                    super._postMessage('EXIT', { code });
                    return;
                }
            } else {
                const code = await (async () => {
                    this._errorTerminal.get(file)?.dispose();

                    const resolvedCommand = path.normalize(resolveVariables(runSettings.compileCommand!));
                    const lastModified = fs.statSync(file).mtime.getTime();
                    const [cachedModified, cachedCompileCommand] = this._lastCompiled.get(file) ?? [-1, ''];
                    if (cachedModified === lastModified && cachedCompileCommand === resolvedCommand && !forceCompilation) {
                        return 0; // avoid unnecessary recompilation
                    }

                    super._postMessage('STATUS', { status: 'COMPILING' });
                    const process = new RunningProcess(resolvedCommand);
                    this._compileProcess = process;
                    let compileError = '';
                    process.process.stderr.on('data', data => compileError += data.toString());
                    process.process.on('error', data => compileError += `${data.stack ?? 'Error encountered during compilation!'}\n\nWhen executing command "${resolvedCommand}`);

                    const code = await process.promise;
                    this._compileProcess = undefined;
                    if (!code) {
                        this._lastCompiled.set(file, [lastModified, resolvedCommand]);
                        return 0;
                    }

                    super._postMessage('EXIT', { code: -1 });

                    const dummy = new DummyTerminal();
                    const terminal = vscode.window.createTerminal({
                        name: path.basename(file),
                        pty: dummy,
                        iconPath: { id: 'zap' },
                        location: { viewColumn: vscode.ViewColumn.Beside }
                    });
                    this._errorTerminal.set(file, terminal);

                    // FIXME remove this hack when https://github.com/microsoft/vscode/issues/87843 is resolved
                    await new Promise<void>(resolve => setTimeout(() => resolve(), 400));

                    dummy.write(compileError);
                    terminal.show(true);
                    return -1;
                })();
                if (code) {
                    super._postMessage('EXIT', { code });
                    return;
                }
            }
        }
        this._compileProcess = undefined;
        super._postMessage('STATUS', { status: 'RUNNING' });

        while (0) {
            // FIXME Implement
        }
    }

    private _killAllProcesses(): void {
        // Remove all listeners to avoid exiting 'EXIT' messages to webview because the states there would already been reset
        this._compileProcess?.process.removeAllListeners();
        this._compileProcess?.process.kill();
        this._compileProcess = undefined;
        this._runningProcess?.process.removeAllListeners();
        this._runningProcess?.process.kill();
        this._runningProcess = undefined;
    }
}