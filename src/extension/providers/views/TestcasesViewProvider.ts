import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

import { RunningProcess } from '../../util/runUtil';
import { DummyTerminal, resolveVariables } from '../../util/vscodeUtil';
import { BaseViewProvider, IMessage } from './BaseViewProvider';

interface ITestcase {
    input: string;
    stderr: string;
    stdout: string;
    elapsed: number;
    status: number;
    acceptedOutput: string;
}

interface IStorage {
    [name: string]: ITestcase[];
};

interface ILanguageRunSettings {
    compileCommand?: string;
    runCommand: string;
}

function readStorageState(path: string): IStorage {
    try {
        const content = fs.readFileSync(path, { encoding: 'utf-8' });
        return JSON.parse(content);
    } catch (_) {
        return {};
    }
}

function saveStorageState(path: string, state: IStorage): void {
    fs.writeFileSync(path, JSON.stringify(state));
}

export class TestcasesViewProvider extends BaseViewProvider {
    private static readonly IO_SEND_INTERVAL_MS = 20;

    private _state: IStorage = {};
    private _lastCompiled: Map<string, [number, string]> = new Map();
    private _errorTerminal: Map<string, vscode.Terminal> = new Map();
    private _compileProcess: RunningProcess | undefined = undefined;
    private _processes: (RunningProcess | undefined)[] = [];
    private _combinedStdoutTime: number[] = [];
    private _combinedStderrTime: number[] = [];
    private _combinedStdout: string[] = [];
    private _combinedStderr: string[] = [];

    onMessage(message: IMessage): void {
        switch (message.type) {
            case 'LOADED':
                this._onLoaded();
                break;
            case 'SAVE_TESTCASES':
                this._onSaveTestcases(message.payload);
                break;
            case 'SOURCE_CODE_RUN':
                this._onSourceCodeRun(message.payload);
                break;
            case 'SOURCE_CODE_STOP':
                this._onSourceCodeStop(message.payload);
                break;
            case 'STDIN':
                this._onStdin(message.payload);
                break;
            case 'VIEW_TEXT':
                this._onViewText(message.payload);
                break;
        }
    }

    constructor(context: vscode.ExtensionContext) {
        super('testcases', context);
        this.readSavedData();

        vscode.window.onDidChangeActiveTextEditor(this._onChangeActiveFile, this);
    }

    public readSavedData() {
        this._killAllProcesses();
        this._state = readStorageState(this.storagePath);
        this._onChangeActiveFile();
    }

    public removeCompileCache(file: string): void {
        if (this._compileProcess) {
            return; // already compiling
        }

        this._lastCompiled.delete(file);
    }

    public removeTestcases(file: string): void {
        delete this._state[file];

        if (file === vscode.window.activeTextEditor!.document.fileName) {
            this._killAllProcesses();
            super._postMessage('SAVED_TESTCASES', []);
        }
    }

    public runAll(): void {
        if (this._compileProcess) {
            return; // already compiling
        }

        super._postMessage('REQUEST_RUN_ALL');
    }

    public deleteAll(): void {
        if (this._compileProcess) {
            return; // already compiling
        }

        super._postMessage('REQUEST_DELETE_ALL');
    }

    public getCachedFiles(): string[] {
        return Object.keys(new Object(this._state));
    }

    private _onExit(id: number, process: RunningProcess, exitCode: number | null): void {
        // if exitCode is null, the process crashed
        super._postMessage('EXIT', { ids: [id], elapsed: process.elapsed, code: exitCode ?? 1 });
        this._processes[id] = undefined;
    }

    private _onError(id: number, err: Error): void {
        super._postMessage('STDERR', { id, data: `${err.stack ?? '[No NodeJS callstack available]'}\n\nError when running the solution...` });
        super._postMessage('EXIT', { ids: [id], code: -1, elapsed: 0 });
    }

    private async _onChangeActiveFile(): Promise<void> {
        this._killAllProcesses();

        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            super._postMessage('SAVED_TESTCASES');
            return;
        }
        super._postMessage('SAVED_TESTCASES', this._state[file] ?? []);
    }

    private _onLoaded(): void {
        this._onChangeActiveFile(); // give webview saved data

        const config = vscode.workspace.getConfiguration('fastolympiccoding');
        const testcaseViewSettings: any = {};
        testcaseViewSettings.maxCharactersForOutput = config.get('maxCharactersForOutput');
        super._postMessage('SETTINGS', testcaseViewSettings);
    }

    private _onSaveTestcases(data: ITestcase[]): void {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }

        if (data.length === 0) {
            delete this._state[file];
        } else {
            this._state[file] = data;
        }
        saveStorageState(this.storagePath, this._state);
    }

    private async _onSourceCodeRun({ ids, inputs }: { ids: number[], inputs: string[] }): Promise<void> {
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
            super._postMessage('EXIT', { ids, code: -1, elapsed: 0 });
            return;
        }

        if (runSettings.compileCommand) {
            if (this._compileProcess) {
                super._postMessage('STATUS', { status: 'COMPILING', ids });
                const code = await this._compileProcess.promise; // another testcase is compiling
                if (code) {
                    super._postMessage('EXIT', { ids, code, elapsed: 0 });
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

                    super._postMessage('STATUS', { status: 'COMPILING', ids });
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

                    super._postMessage('EXIT', { ids, code: -1, elapsed: 0 });

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
                    super._postMessage('EXIT', { ids, code, elapsed: 0 });
                    return;
                }
            }
        }
        this._compileProcess = undefined;
        super._postMessage('STATUS', { status: 'RUNNING', ids });

        const resolvedCommand = path.normalize(resolveVariables(runSettings.runCommand));
        for (let i = 0; i < ids.length; i++) {
            const process = new RunningProcess(resolvedCommand);
            this._expandArraysIfNecesssary(ids[i]);
            this._processes[ids[i]] = process;

            process.process.stdin.write(inputs[i]);
            process.process.stdout.on('data', this._sendCombinedData.bind(this, 'STDOUT', ids[i], this._combinedStdoutTime, this._combinedStdout));
            process.process.stderr.on('data', this._sendCombinedData.bind(this, 'STDERR', ids[i], this._combinedStderrTime, this._combinedStderr));
            process.process.stdout.on('end', () => this._sendLeftoverData('STDOUT', ids[i], this._combinedStdout));
            process.process.stderr.on('end', () => this._sendLeftoverData('STDERR', ids[i], this._combinedStderr));
            process.process.on('error', this._onError.bind(this, ids[i]));
            process.process.on('exit', this._onExit.bind(this, ids[i], process));
        }

    }

    private _onSourceCodeStop({ id, removeListeners }: { id: number, removeListeners: boolean }): void {
        if (removeListeners) {
            this._processes[id]!.process.removeAllListeners();
        }
        this._processes[id]!.process.kill();
        this._processes[id] = undefined;
    }

    private _onStdin({ id, input }: { id: number, input: string }): void {
        this._processes[id]!.process.stdin.write(input);
    }

    private async _onViewText({ content }: { content: string }): Promise<void> {
        const document = await vscode.workspace.openTextDocument({ content });
        vscode.window.showTextDocument(document);
    }

    private _sendCombinedData(type: string, id: number, combinedTime: number[], combinedData: string[], data: string): void {
        const now = Date.now();
        if (now - combinedTime[id] >= TestcasesViewProvider.IO_SEND_INTERVAL_MS) {
            super._postMessage(type, { id, data: combinedData[id] + data });
            combinedTime[id] = now;
            combinedData[id] = '';
        } else {
            combinedData[id] += data;
        }
    }

    private _sendLeftoverData(type: string, id: number, combinedData: string[]): void {
        super._postMessage(type, { id, data: combinedData[id] });
        combinedData[id] = '';
    }

    private _killAllProcesses(): void {
        // Remove all listeners to avoid exiting 'EXIT' messages to webview because the states there would already been reset
        this._compileProcess?.process.removeAllListeners();
        this._compileProcess?.process.kill();
        this._compileProcess = undefined;
        for (let i = 0; i < this._processes.length; i++) {
            this._processes[i]?.process.removeAllListeners();
            this._processes[i]?.process.kill();
            this._processes[i] = undefined;
        }
    }

    private _expandArraysIfNecesssary(id: number): void {
        if (id === this._processes.length) {
            this._processes.push(undefined);
            this._combinedStdoutTime.push(-Infinity);
            this._combinedStderrTime.push(-Infinity);
            this._combinedStdout.push('');
            this._combinedStderr.push('');
        }
    }
}