import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

import { BatchedSender, RunningProcess } from '../../util/runUtil';
import { BaseViewProvider, IMessage } from "./BaseViewProvider";
import { ILanguageRunSettings } from '../../common';
import { DummyTerminal, resolveVariables, viewLargeTextAsFile } from '../../util/vscodeUtil';

interface IFileState<T> {
    solution: T;
    goodSolution: T;
    generator: T;
}

interface IStressTestData {
    data: IFileState<string>;
    code: IFileState<number>;
}

export class StressTesterViewProvider extends BaseViewProvider {
    private _lastCompiled: Map<string, [number, string]> = new Map();
    private _errorTerminal: Map<string, vscode.Terminal> = new Map();
    private _compileProcesses: RunningProcess[] = [];
    private _compilePromises: Promise<number>[] = [];
    private _runningProcesses: RunningProcess[] = [];
    private _stopFlag: boolean = true;
    private _fromIndexed: string[] = ['solution', 'goodSolution', 'generator'];

    onMessage(message: IMessage): void {
        switch (message.type) {
            case 'LOADED':
                this.loadSavedData();
                break;
            case 'SAVE':
                this._onSave(message.payload);
                break;
            case 'RUN':
                this._onRun();
                break;
            case 'STOP':
                this._onStop();
                break;
            case 'VIEW_TEXT':
                viewLargeTextAsFile(message.payload.content);
                break;
        }
    }

    constructor(context: vscode.ExtensionContext) {
        super('stress-tester', context);

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
        const data: IStressTestData = storage[file] ?? {
            data: {
                solution: '',
                goodSolution: '',
                generator: '',
            },
            code: {
                solution: 0,
                goodSolution: 0,
                generator: 0,
            },
        };
        const payload: any = { settings, ...data };
        super._postMessage('SAVED_DATA', payload);
    }

    private _onSave(data: IStressTestData): void {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (file) {
            super._writeStorage(file, data);
        }
    }

    private async _onRun(): Promise<void> {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }

        const extension = path.extname(file);
        const config = vscode.workspace.getConfiguration('fastolympiccoding');
        const forceCompilation: boolean = config.get('forceCompilation')!;
        const delayBetweenTestcases: number = config.get('delayBetweenTestcases')!;
        const runSettings: ILanguageRunSettings | undefined = config.get('runSettings', {} as any)[extension];
        if (!runSettings) {
            vscode.window.showWarningMessage(`No run setting detected for file extension "${extension}"`);
            super._postMessage('EXIT', { code: 0, from: 'solution' });
            super._postMessage('EXIT', { code: 0, from: 'goodSolution' });
            super._postMessage('EXIT', { code: 0, from: 'generator' });
            return;
        }

        if (runSettings.compileCommand) {
            if (this._compileProcesses.length > 0) {
                super._postMessage('STATUS', { status: 'COMPILING' });
                const codes = await Promise.allSettled(this._compilePromises);
                let anyFailed = false;
                for (const codeResult of codes) {
                    const code = (codeResult as PromiseFulfilledResult<number>).value;
                    anyFailed ||= code !== 0;
                }
                if (anyFailed) {
                    for (let i = 0; i < codes.length; i++) {
                        super._postMessage('EXIT', { code: (codes[i] as PromiseFulfilledResult<number>).value, from: this._fromIndexed[i] });
                    }
                    return;
                }
            } else {
                this._compilePromises = [
                    this._doCompile(runSettings.compileCommand!, '${file}', 'solution', forceCompilation),
                    this._doCompile(runSettings.compileCommand!, config.get('goodSolutionFile')!, 'goodSolution', forceCompilation),
                    this._doCompile(runSettings.compileCommand!, config.get('generatorFile')!, 'generator', forceCompilation),
                ]
                const codes = await Promise.allSettled(this._compilePromises);
                let anyFailed = false;
                for (const codeResult of codes) {
                    const code = (codeResult as PromiseFulfilledResult<number>).value;
                    anyFailed ||= code !== 0;
                }
                if (anyFailed) {
                    for (let i = 0; i < codes.length; i++) {
                        super._postMessage('EXIT', { code: (codes[i] as PromiseFulfilledResult<number>).value, from: this._fromIndexed[i] });
                    }
                    return;
                }
            }
        }
        this._compileProcesses = [];
        this._compilePromises = [];
        this._stopFlag = false;
        super._postMessage('STATUS', { status: 'RUNNING', from: 'solution' });
        super._postMessage('STATUS', { status: 'RUNNING', from: 'goodSolution' });
        super._postMessage('STATUS', { status: 'RUNNING', from: 'generator' });

        while (!this._stopFlag) {
            const solutionProcess = this._runFile(runSettings.runCommand, '${file}');
            const solutionSender = new BatchedSender(data => super._postMessage('DATA', { from: 'solution', data }));
            let output = '';
            solutionProcess.process.stdout.on('data', data => {
                solutionSender.send(data);
                output += data;
            });
            solutionProcess.process.stdout.on('end', () => solutionSender.send('', true));

            const goodSolutionProcess = this._runFile(runSettings.runCommand, config.get('goodSolutionFile')!);
            const goodSolutionSender = new BatchedSender(data => super._postMessage('DATA', { from: 'goodSolution', data }));
            let goodOutput = '';
            goodSolutionProcess.process.stdout.on('data', data => {
                goodSolutionSender.send(data);
                goodOutput += data;
            });
            goodSolutionProcess.process.stdout.on('end', () => goodSolutionSender.send('', true));

            const generatorProcess = this._runFile(runSettings.runCommand, config.get('generatorFile')!);
            const generatorSender = new BatchedSender(data => super._postMessage('DATA', { from: 'generator', data }));
            const seed = Math.round(Math.random() * 9223372036854775807);
            let input = '';
            generatorProcess.process.stdin.write(`${seed}\n`);
            generatorProcess.process.stdout.on('data', data => {
                generatorSender.send(data);
                solutionProcess.process.stdin.write(data);
                goodSolutionProcess.process.stdin.write(data);
                input += data;
            });
            generatorProcess.process.stdout.on('end', () => generatorSender.send('', true));

            this._runningProcesses = [solutionProcess, goodSolutionProcess, generatorProcess];
            const codes = await Promise.allSettled(this._runningProcesses.map(value => value.promise));
            this._runningProcesses = [];
            let anyFailed = false;
            for (let i = 0; i < codes.length; i++) {
                const code = (codes[i] as PromiseFulfilledResult<number>).value;
                anyFailed ||= code !== 0;
            }
            if (anyFailed) {
                for (let i = 0; i < codes.length; i++) {
                    super._postMessage('EXIT', { code: (codes[i] as PromiseFulfilledResult<number>).value, from: this._fromIndexed[i] });
                }
                return;
            }
            if (output !== goodOutput) {
                super._postMessage('EXIT', { code: -2, from: 'solution' });
                super._postMessage('EXIT', { code: -2, from: 'goodSolution' });
                super._postMessage('EXIT', { code: -2, from: 'generator' });
                super._writeStorage(vscode.window.activeTextEditor!.document.fileName, {
                    data: {
                        solution: output,
                        goodSolution: goodOutput,
                        generator: input,
                    },
                    code: {
                        solution: -2,
                        goodSolution: -2,
                        generator: -2,
                    },
                });
                break;
            } else {
                await new Promise<void>(resolve => setTimeout(() => resolve(), delayBetweenTestcases));
                super._postMessage('CLEAR');
            }
        }
    }

    private _onStop(): void {
        for (const process of this._runningProcesses) {
            process.process.kill();
        }
        this._stopFlag = true;

        const file = vscode.window.activeTextEditor?.document.fileName;
        if (file) {
            super._writeStorage(file); // no counterexample found, don't need to save anything
        }
    }

    private _killAllProcesses(): void {
        // Remove all listeners to avoid exiting 'EXIT' messages to webview because the states there would already been reset
        for (const process of this._compileProcesses) {
            process.process.removeAllListeners();
            process.process.kill();
        }
        this._compileProcesses = [];
        this._compilePromises = [];
        for (const process of this._runningProcesses) {
            process.process.removeAllListeners();
            process.process.kill();
        }
        this._runningProcesses = [];
    }

    private async _doCompile(compileCommand: string, fileVariable: string, from: string, forceCompilation: boolean): Promise<number> {
        const resolvedFile = resolveVariables(fileVariable);
        if (!fs.existsSync(resolvedFile)) {
            vscode.window.showErrorMessage(`${resolvedFile} does not exist!`);
            super._postMessage('EXIT', { code: -1, from });
            return -1;
        }

        const resolvedCommand = path.normalize(resolveVariables(compileCommand, false, resolvedFile));
        const lastModified = fs.statSync(resolvedFile).mtime.getTime();
        const [cachedModified, cachedCompileCommand] = this._lastCompiled.get(resolvedFile) ?? [-1, ''];
        if (cachedModified === lastModified && cachedCompileCommand === resolvedCommand && !forceCompilation) {
            super._postMessage('EXIT', { code: 0, from });
            return 0; // avoid unnecessary recompilation
        }

        super._postMessage('STATUS', { status: 'COMPILING', from });
        const process = new RunningProcess(resolvedCommand);
        this._compileProcesses.push(process);
        let compileError = '';
        process.process.stderr.on('data', data => compileError += data.toString());
        process.process.on('error', data => compileError += `${data.stack ?? 'Error encountered during compilation!'}\n\nWhen executing command "${resolvedCommand}`);

        const code = await process.promise;
        this._compileProcesses.splice(this._compileProcesses.findIndex(value => value === process), 1);
        if (!code) {
            this._lastCompiled.set(resolvedFile, [lastModified, resolvedCommand]);
            super._postMessage('EXIT', { code: 0, from });
            return 0;
        }

        super._postMessage('EXIT', { code: -1, from });

        const dummy = new DummyTerminal();
        const terminal = vscode.window.createTerminal({
            name: path.basename(resolvedFile),
            pty: dummy,
            iconPath: { id: 'zap' },
            location: { viewColumn: vscode.ViewColumn.Beside }
        });
        this._errorTerminal.set(resolvedFile, terminal);

        // FIXME remove this hack when https://github.com/microsoft/vscode/issues/87843 is resolved
        await new Promise<void>(resolve => setTimeout(() => resolve(), 400));

        dummy.write(compileError);
        terminal.show(true);
        return -1;
    }

    private _runFile(runCommand: string, fileVariable: string): RunningProcess {
        const resolvedFile = resolveVariables(fileVariable);
        const resolvedCommand = path.normalize(resolveVariables(runCommand, false, resolvedFile));
        return new RunningProcess(resolvedCommand);
    }
}