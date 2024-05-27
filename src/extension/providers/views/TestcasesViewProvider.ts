import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

import { Mutex } from '../../util/mutex';
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
    private _state: IStorage;
    private _lastCompiled: Map<string, [number, string]> = new Map();
    private _errorTerminal: Map<string, vscode.Terminal> = new Map();
    private _compileProcess: RunningProcess | undefined = undefined;
    private _processes: RunningProcess[] = [];
    private _lastRunMutex: Mutex = new Mutex();
    private _terminalMutex: Mutex = new Mutex();
    private _lastRun: number = -1;

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

                this._state[file] = message.payload;
                const storagePath = this._context.globalStorageUri.fsPath;
                saveStorageState(storagePath, this._state);
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
                                if (code) {
                                    super._postMessage('EXIT', { id, code: -1, elapsed: 0 });

                                    const unlock = await this._terminalMutex.lock();
                                    this._errorTerminal.get(file)?.dispose();
                                    const dummy = new DummyTerminal();
                                    const terminal = vscode.window.createTerminal({
                                        name: path.basename(file),
                                        pty: dummy,
                                        iconPath: { id: 'zap' }
                                    });

                                    // FIXME remove this hack when https://github.com/microsoft/vscode/issues/87843 is resolved
                                    await new Promise<void>(resolve => setTimeout(() => resolve(), 400));

                                    dummy.write(compileError);
                                    terminal.show();
                                    this._errorTerminal.set(file, terminal);
                                    unlock();

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

                    const unlock = await this._lastRunMutex.lock();
                    while (Date.now() <= this._lastRun) { } // wait until the time is different

                    const process = new RunningProcess(resolvedCommand);
                    process.process.on('error', this._onError.bind(this, id));

                    const spawned = await process.spawnPromise;
                    if (!spawned) {
                        unlock();
                        return;
                    }

                    super._postMessage('STATUS', { status: 'RUNNING', id, startTime: process.getStartTime() });
                    this._processes.push(process);
                    process.process.stdin.write(input);
                    process.process.stdout.on('data', this._onStdout.bind(this, process));
                    process.process.stderr.on('data', this._onStderr.bind(this, process));
                    process.process.on('exit', this._onExit.bind(this, process));
                    unlock();
                })();
                break;
            case 'SOURCE_CODE_STOP': {
                const process = this._processes.find(process => process.getStartTime(), message.payload.id)!;
                process.process.kill();
                break;
            }
            case 'STDIN': {
                const { id, input } = message.payload;
                const process = this._processes.find(process => process.getStartTime() === id)!;
                process.process.stdin.write(input);
                break;
            }
        }
    }

    constructor(context: vscode.ExtensionContext) {
        super('testcases', context);

        const storagePath = this._context.globalStorageUri.fsPath;
        this._state = readStorageState(storagePath);

        vscode.window.onDidChangeActiveTextEditor(this._onChangeActiveFile, this);
    }

    public runAll(): void {
        super._postMessage('REQUEST_RUN_ALL');
    }

    public deleteAll(): void {
        super._postMessage('REQUEST_DELETE_ALL');
    }

    private _onStdout(process: RunningProcess, data: string): void {
        super._postMessage('STDOUT', { id: process.getStartTime(), data });
    }

    private _onStderr(process: RunningProcess, data: string): void {
        super._postMessage('STDERR', { id: process.getStartTime(), data });
    }

    private _onExit(process: RunningProcess, exitCode: number | null): void {
        const code = exitCode ?? 0;
        const elapsed = process.getEndTime() - process.getStartTime();
        const startTime = process.getStartTime();
        super._postMessage('EXIT', { id: startTime, code, elapsed });

        const index = this._processes.findIndex(value => value.getStartTime() === startTime);
        this._processes.splice(index, 1);
    }

    private _onError(id: number, err: Error): void {
        super._postMessage('STDERR', { id, data: `${err.stack ?? '[No NodeJS callstack available]'}\n\nError when running the solution...` });
        super._postMessage('EXIT', { id, code: -1, elapsed: 0 });
    }

    private async _onChangeActiveFile(): Promise<void> {
        // Remove all listeners to avoid exiting 'EXIT' messages to webview because the states there would already been reset
        if (this._compileProcess) {
            this._compileProcess.process.removeAllListeners();
            this._compileProcess.process.kill();
        }
        for (const process of this._processes) {
            process.process.removeAllListeners();
            process.process.kill();
        }

        this._compileProcess = undefined;
        this._processes = [];

        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            super._postMessage('SAVED_TESTCASES');
            return;
        }
        super._postMessage('SAVED_TESTCASES', this._state[file] ?? []);
    }
}