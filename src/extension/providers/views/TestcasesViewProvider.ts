import * as path from 'path';
import * as vscode from 'vscode';

import { BatchedSender, getFileChecksum, RunningProcess } from '../../util/runUtil';
import { DummyTerminal, resolveVariables, viewLargeTextAsFile } from '../../util/vscodeUtil';
import { BaseViewProvider, IMessage } from './BaseViewProvider';
import { compileProcess, errorTerminal, ILanguageRunSettings, ITestcase, lastCompiled } from '../../common';

interface IFileStorage {
    testcases: ITestcase[];
}

export class TestcasesViewProvider extends BaseViewProvider {
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

    onDispose(): void {
        for (let id = 0; id < this._processes.length; id++) {
            this._onStop({ id, removeListeners: true });
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

        const storage = super.readStorage();
        const config = vscode.workspace.getConfiguration('fastolympiccoding');
        const settings: any = {
            maxDisplayCharacters: config.get('maxDisplayCharacters'),
            maxDisplayLines: config.get('maxDisplayLines'),
        };
        const data = storage[file] ?? { testcases: [] };
        const testcases: ITestcase[] = [];
        for (const testcase of data.testcases) {
            testcases.push({
                stdin: testcase.stdin ?? '',
                stderr: testcase.stderr ?? '',
                stdout: testcase.stdout ?? '',
                elapsed: testcase.elapsed ?? 0,
                status: testcase.status ?? 0,
                acceptedOutput: testcase.acceptedOutput ?? '',
                showTestcase: testcase.showTestcase ?? true,
            });
        }
        const payload: any = { settings, testcases };
        super._postMessage('SAVED_DATA', payload);
    }

    public runAll(): void {
        super._postMessage('RUN_ALL');
    }

    public deleteAll(): void {
        super._postMessage('DELETE_ALL');
    }

    private _onClose(id: number, process: RunningProcess, exitCode: number | null): void {
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
            super.writeStorage(file, data);
        }
    }

    private async _onRun({ ids, stdins }: { ids: number[], stdins: string[] }): Promise<void> {
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
            for (const id of ids) {
                super._postMessage('EXIT', { id, code: -1, elapsed: 0 });
            }
            return;
        }

        await vscode.commands.executeCommand('workbench.action.files.save', file);
        await new Promise<void>(resolve => setTimeout(() => resolve(), 100)); // FIXME: file not saved *immediate* by vscode

        if (runSettings.compileCommand) {
            errorTerminal.get(file)?.dispose();

            if (compileProcess.has(file)) {
                for (const id of ids) {
                    super._postMessage('STATUS', { status: 'COMPILING', id });
                }
                const code = await compileProcess.get(file)!.promise; // another testcase is compiling
                if (code) {
                    for (const id of ids) {
                        super._postMessage('EXIT', { id, code, elapsed: 0 });
                    }
                    return;
                }
            } else {
                const code = await (async () => {
                    const resolvedCommand = path.normalize(resolveVariables(runSettings.compileCommand!));
                    const currentChecksum = await getFileChecksum(file);
                    const [cachedChecksum, cachedCompileCommand] = lastCompiled.get(file) ?? [-1, ''];
                    if (currentChecksum === cachedChecksum && cachedCompileCommand === resolvedCommand && !forceCompilation) {
                        return 0; // avoid unnecessary recompilation
                    }

                    for (const id of ids) {
                        super._postMessage('STATUS', { status: 'COMPILING', id });
                    }
                    const process = new RunningProcess(resolvedCommand);
                    compileProcess.set(file, process);
                    let compileError = '';
                    process.process.stderr.on('data', data => compileError += data.toString());
                    process.process.on('error', data => compileError += `${data.stack ?? 'Error encountered during compilation!'}\n\nWhen executing command "${resolvedCommand}`);

                    const code = await process.promise;
                    compileProcess.delete(file);
                    if (!code) {
                        lastCompiled.set(file, [currentChecksum, resolvedCommand]);
                        return 0;
                    }
                    for (const id of ids) {
                        super._postMessage('EXIT', { id, code: -1, elapsed: 0 });
                    }

                    const dummy = new DummyTerminal();
                    const terminal = vscode.window.createTerminal({
                        name: path.basename(file),
                        pty: dummy,
                        iconPath: { id: 'zap' },
                        location: { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }
                    });
                    errorTerminal.set(file, terminal);

                    // FIXME remove this hack when https://github.com/microsoft/vscode/issues/87843 is resolved
                    await new Promise<void>(resolve => setTimeout(() => resolve(), 400));

                    dummy.write(compileError);
                    terminal.show(true);
                    return -1;
                })();
                if (code) {
                    for (const id of ids) {
                        super._postMessage('EXIT', { id, code, elapsed: 0 });
                    }
                    return;
                }
            }
        }
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const stdin = stdins[i];
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
            process.process.on('close', this._onClose.bind(this, id, process));
        }

    }

    private _onStop({ id, removeListeners }: { id: number, removeListeners: boolean }): void {
        if (removeListeners) {
            this._processes[id]?.process.removeAllListeners();
        }
        this._processes[id]?.process.kill();
        this._processes[id] = undefined;
    }

    private _onStdin({ id, stdin }: { id: number, stdin: string }): void {
        this._processes[id]!.process.stdin.write(stdin);
    }

    private _killAllProcesses(): void {
        // Remove all listeners to avoid exiting 'EXIT' messages to webview because the states there would already been reset
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