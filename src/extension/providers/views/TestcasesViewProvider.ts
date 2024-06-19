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
    private _state: IStorage = {};
    private _lastCompiled: Map<string, [number, string]> = new Map();
    private _errorTerminal: Map<string, vscode.Terminal> = new Map();
    private _compileProcess: RunningProcess | undefined = undefined;
    private _processes: Map<number, RunningProcess> = new Map();

    onMessage(message: IMessage): void {
        switch (message.type) {
            case 'REQUEST_TESTCASES':
                this._onChangeActiveFile(); // give webview saved data
                break;
            case 'SAVE_TESTCASES':
                const file = vscode.window.activeTextEditor?.document.fileName;
                if (!file) {
                    return;
                }

                if (message.payload.length === 0) {
                    delete this._state[file];
                } else {
                    this._state[file] = message.payload;
                }
                saveStorageState(this.storagePath, this._state);
                break;
            case 'SOURCE_CODE_RUN':
                (async () => {
                    const { id, input } = message.payload;
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
                            const code = await this._compileProcess.executionPromise; // another testcase is compiling
                            if (code !== 0) {
                                super._postMessage('EXIT', { id, code: -1, elapsed: 0 });
                                return;
                            }
                        } else {
                            const code = await (async () => {
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

                                const code = await process.executionPromise;
                                this._compileProcess = undefined;
                                if (code === null) {
                                    return -1; // forcefully terminated
                                }

                                this._errorTerminal.get(file)?.dispose();
                                if (code) {
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
                                }

                                this._lastCompiled.set(file, [lastModified, resolvedCommand]);
                                return 0;
                            })();
                            if (code) {
                                return;
                            }
                        }
                    }

                    const resolvedCommand = path.normalize(resolveVariables(runSettings.runCommand));
                    const process = new RunningProcess(resolvedCommand);
                    process.process.on('error', this._onError.bind(this, id));

                    const spawned = await process.spawnPromise;
                    if (!spawned) {
                        return;
                    }

                    this._processes.set(id, process);
                    super._postMessage('STATUS', { status: 'RUNNING', id });
                    process.process.stdin.write(input);
                    process.process.stdout.on('data', this._onStdout.bind(this, id));
                    process.process.stderr.on('data', this._onStderr.bind(this, id));
                    process.process.on('exit', this._onExit.bind(this, id, process));
                })();
                break;
            case 'SOURCE_CODE_STOP': {
                const { id, removeListeners } = message.payload;
                const process = this._processes.get(id)!;
                
                if (removeListeners) {
                    process.process.removeAllListeners();
                }
                process.process.kill();
                this._processes.delete(id);
                break;
            }
            case 'STDIN':
                this._processes.get(message.payload.id)!.process.stdin.write(message.payload.input);
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

    private _killAllProcesses(): void {
        // Remove all listeners to avoid exiting 'EXIT' messages to webview because the states there would already been reset
        if (this._compileProcess) {
            this._compileProcess.process.removeAllListeners();
            this._compileProcess.process.kill();
        }
        for (const process of this._processes.values()) {
            process.process.removeAllListeners();
            process.process.kill();
        }
        this._compileProcess = undefined;
        this._processes.clear();
    }

    private _onStdout(id: number, data: string): void {
        super._postMessage('STDOUT', { id, data });
    }

    private _onStderr(id: number, data: string): void {
        super._postMessage('STDERR', { id, data });
    }

    private _onExit(id: number, process: RunningProcess, exitCode: number | null): void {
        const code = exitCode ?? 0;
        const elapsed = process.getEndTime() - process.getStartTime();
        super._postMessage('EXIT', { id, code, elapsed });
        this._processes.delete(id);
    }

    private _onError(id: number, err: Error): void {
        super._postMessage('STDERR', { id, data: `${err.stack ?? '[No NodeJS callstack available]'}\n\nError when running the solution...` });
        super._postMessage('EXIT', { id, code: -1, elapsed: 0 });
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
}