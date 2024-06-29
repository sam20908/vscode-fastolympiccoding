import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

import { BatchedSender, RunningProcess } from '../../util/runUtil';
import { DummyTerminal, resolveVariables, viewLargeTextAsFile } from '../../util/vscodeUtil';
import { BaseViewProvider, IMessage } from './BaseViewProvider';
import { ILanguageRunSettings } from '../../common';

interface ITestcase {
    input: string;
    stderr: string;
    stdout: string;
    elapsed: number;
    status: number;
    acceptedOutput: string;
}

interface IFileStorage {
    testcases: ITestcase[];
}

export class TestcasesViewProvider extends BaseViewProvider {
    private _lastCompiled: Map<string, [number, string]> = new Map();
    private _errorTerminal: Map<string, vscode.Terminal> = new Map();
    private _compileProcess: RunningProcess | undefined = undefined;
    private _processes: (RunningProcess | undefined)[] = [];
    private _stdoutSenders: BatchedSender[] = [];
    private _stderrSenders: BatchedSender[] = [];

    onMessage(message: IMessage): void {
        switch (message.type) {
            case 'LOADED':
                this._onLoaded();
                break;
            case 'SAVE':
                this._onSave(message.payload);
                break;
            case 'RUN':
                this._onRun(message.payload);
                break;
            case 'STOP':
                this._onStop(message.payload);
                break;
            case 'STDIN':
                this._onStdin(message.payload);
                break;
            case 'VIEW_TEXT':
                viewLargeTextAsFile(message.payload.content);
                break;
        }
    }

    constructor(context: vscode.ExtensionContext) {
        super('testcases', context);

        vscode.window.onDidChangeActiveTextEditor(this.loadSavedData, this);
        this.loadSavedData();
    }

    public async loadSavedData(): Promise<void> {
        this._killAllProcesses();

        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            super._postMessage('SAVED_DATA');
            return;
        }

        const storage = super._readStorage();
        const config = vscode.workspace.getConfiguration('fastolympiccoding');
        const settings: any = {
            maxDisplayCharacters: config.get('maxDisplayCharacters')
        };
        const data = storage[file] ?? { testcases: [] };
        const payload: any = { settings, ...data };
        super._postMessage('SAVED_DATA', payload);
    }

    public runAll(): void {
        if (!this._compileProcess) {
            super._postMessage('RUN_ALL');
        }
    }

    public deleteAll(): void {
        if (!this._compileProcess) {
            super._postMessage('DELETE_ALL');
        }
    }

    private _onExit(id: number, process: RunningProcess, exitCode: number | null): void {
        // if exitCode is null, the process crashed
        super._postMessage('EXIT', { id, elapsed: process.elapsed, code: exitCode ?? 1 });
        this._processes[id] = undefined;
    }

    private _onError(id: number, err: Error): void {
        super._postMessage('STDERR', { id, data: `${err.stack ?? '[No NodeJS callstack available]'}\n\nError when running the solution...` });
        super._postMessage('EXIT', { id: id, code: -1, elapsed: 0 });
    }

    private _onLoaded(): void {
        this.loadSavedData();
    }

    private _onSave(data?: IFileStorage): void {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (file) {
            super._writeStorage(file, data);
        }
    }

    private async _onRun({ id, stdin }: { id: number, stdin: string }): Promise<void> {
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
            super._postMessage('EXIT', { id, code: -1, elapsed: 0 });
            return;
        }

        if (runSettings.compileCommand) {
            if (this._compileProcess) {
                super._postMessage('STATUS', { status: 'COMPILING', id });
                const code = await this._compileProcess.promise; // another testcase is compiling
                if (code) {
                    super._postMessage('EXIT', { id, code, elapsed: 0 });
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

                    super._postMessage('STATUS', { status: 'COMPILING', id });
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

                    super._postMessage('EXIT', { id, code: -1, elapsed: 0 });

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
                    super._postMessage('EXIT', { id, code, elapsed: 0 });
                    return;
                }
            }
        }
        this._compileProcess = undefined;
        super._postMessage('STATUS', { status: 'RUNNING', id });

        const resolvedCommand = path.normalize(resolveVariables(runSettings.runCommand));
        const process = new RunningProcess(resolvedCommand);
        this._expandArraysIfNecesssary(id);
        this._processes[id] = process;
        this._stdoutSenders[id].callback = data => super._postMessage('STDOUT', { id, data });
        this._stderrSenders[id].callback = data => super._postMessage('STDERR', { id, data });

        process.process.stdin.write(stdin);
        process.process.stdout.on('data', data => this._stdoutSenders[id].send(data));
        process.process.stderr.on('data', data => this._stderrSenders[id].send(data));
        process.process.stdout.on('end', () => this._stdoutSenders[id].send('', true));
        process.process.stderr.on('end', () => this._stderrSenders[id].send('', true));
        process.process.on('error', this._onError.bind(this, id));
        process.process.on('exit', this._onExit.bind(this, id, process));

    }

    private _onStop({ id, removeListeners }: { id: number, removeListeners: boolean }): void {
        if (removeListeners) {
            this._processes[id]!.process.removeAllListeners();
        }
        this._processes[id]!.process.kill();
        this._processes[id] = undefined;
    }

    private _onStdin({ id, stdin }: { id: number, stdin: string }): void {
        this._processes[id]!.process.stdin.write(stdin);
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
        while (id >= this._processes.length) {
            this._processes.push(undefined);
            this._stdoutSenders.push(new BatchedSender());
            this._stderrSenders.push(new BatchedSender());
        }
    }
}