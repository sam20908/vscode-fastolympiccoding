import * as path from 'path';
import * as vscode from 'vscode';

import { Data, RunningProcess, ILanguageRunSettings, viewTextInEditor, resolveVariables, resolveCommandArgs } from '../../util';
import { BaseViewProvider } from "./BaseViewProvider";
import { TestcasesViewProvider } from './TestcasesViewProvider';
import { IStressTesterMessage, Status, StressTesterMessageType } from '../../../common';
import { compile } from '../../util';

interface IData {
    data: string;
    status: Status;
}

interface IState {
    data: Data;
    status: Status;
    process: RunningProcess;
}

export class StressTesterViewProvider extends BaseViewProvider<StressTesterMessageType> {
    private _state: IState[] = [
        { data: new Data(), status: Status.NA, process: new RunningProcess() },
        { data: new Data(), status: Status.NA, process: new RunningProcess() },
        { data: new Data(), status: Status.NA, process: new RunningProcess() },
    ]; // [generator, solution, good solution]
    private _stopFlag: boolean = false;

    onMessage(message: IStressTesterMessage) {
        const { type, payload } = message;
        switch (type) {
            case StressTesterMessageType.LOADED:
                this.loadSavedData();
                break;
            case StressTesterMessageType.RUN:
                this.run();
                break;
            case StressTesterMessageType.STOP:
                this._stop();
                break;
            case StressTesterMessageType.VIEW:
                viewTextInEditor(this._state[payload.id].data.data);
                break;
            case StressTesterMessageType.ADD:
                this._add(payload);
                break;
        }
    }

    onDispose() {
        this._stop();
    }

    constructor(context: vscode.ExtensionContext, private testcaseViewProvider: TestcasesViewProvider) {
        super('stress-tester', context);

        this._state[0].data.callback = (data: string) => super._postMessage(StressTesterMessageType.STDIO, { id: 0, data });
        this._state[1].data.callback = (data: string) => super._postMessage(StressTesterMessageType.STDIO, { id: 1, data });
        this._state[2].data.callback = (data: string) => super._postMessage(StressTesterMessageType.STDIO, { id: 2, data });

        vscode.window.onDidChangeActiveTextEditor(this.loadSavedData, this);
    }

    public async loadSavedData(): Promise<void> {
        this._stop();
        for (let i = 0; i < 3; i++) {
            this._state[i].data.reset();
            this._state[i].status = Status.NA;
            super._postMessage(StressTesterMessageType.STATUS, { id: i, status: Status.NA });
        }
        super._postMessage(StressTesterMessageType.CLEAR);

        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            super._postMessage(StressTesterMessageType.TOGGLE_VIEW, { value: false });
            return;
        }

        super._postMessage(StressTesterMessageType.TOGGLE_VIEW, { value: true });
        const storage = super.readStorage();
        const state: IData[] = storage[file] ?? [];
        for (let i = 0; i < state.length; i++) {
            this._state[i].data.write(state[i].data, true);
            this._state[i].status = state[i].status;
            super._postMessage(StressTesterMessageType.STATUS, { id: i, status: state[i].status });
        }
    }

    public async run(): Promise<void> {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }

        const extension = path.extname(file);
        const config = vscode.workspace.getConfiguration('fastolympiccoding');
        const delayBetweenTestcases: number = config.get('delayBetweenTestcases')!;
        const runSettings: ILanguageRunSettings | undefined = config.get<any>('runSettings')[extension];
        if (!runSettings) {
            vscode.window.showWarningMessage(`No run setting detected for file extension "${extension}"`);
            return;
        }

        if (runSettings.compileCommand) {
            for (let i = 0; i < 3; i++) {
                super._postMessage(StressTesterMessageType.STATUS, { id: i, status: Status.COMPILING });
            }
            const callback = (id: number, code: number) => {
                const status = code ? Status.CE : Status.NA;
                this._state[id].status = status;
                super._postMessage(StressTesterMessageType.STATUS, { id, status });
                return code;
            };
            const promises = [
                compile(await resolveVariables(config.get('generatorFile')!), runSettings.compileCommand).then(callback.bind(this, 0)),
                compile(await resolveVariables('${file}'), runSettings.compileCommand).then(callback.bind(this, 1)),
                compile(await resolveVariables(config.get('goodSolutionFile')!), runSettings.compileCommand).then(callback.bind(this, 2)),
            ];
            const codes = await Promise.all(promises);

            for (let i = 0; i < 3; i++) {
                if (codes[i]) {
                    return;
                }
            }
        }

        for (let i = 0; i < 3; i++) {
            super._postMessage(StressTesterMessageType.STATUS, { id: i, status: Status.RUNNING });
        }

        const cwd = runSettings.currentWorkingDirectory ? await resolveVariables(runSettings.currentWorkingDirectory) : undefined;
        const maxRuntime = config.get('maxRuntime')! as number;
        const start = Date.now();
        let anyFailed = false;
        this._stopFlag = false;
        while (!this._stopFlag && (maxRuntime === -1 || Date.now() - start <= maxRuntime)) {
            super._postMessage(StressTesterMessageType.CLEAR);
            for (let i = 0; i < 3; i++) {
                this._state[i].data.reset();
            }

            const solutionRunArguments = await this._resolveRunArguments(runSettings.runCommand, '${file}');
            this._state[1].process.run(solutionRunArguments[0], cwd, ...solutionRunArguments.slice(1));
            this._state[1].process.process!.on('error', data => this._state[1].data.write(data.message, true));
            this._state[1].process.process!.stdout.on('data', data => this._state[1].data.write(data, false));
            this._state[1].process.process!.stdout.once('end', () => this._state[1].data.write('', true));

            const goodSolutionRunArguments = await this._resolveRunArguments(runSettings.runCommand, config.get('goodSolutionFile')!);
            this._state[2].process.run(goodSolutionRunArguments[0], cwd, ...goodSolutionRunArguments.slice(1));
            this._state[2].process.process!.on('error', data => this._state[2].data.write(data.message, true));
            this._state[2].process.process!.stdout.on('data', data => this._state[2].data.write(data, false));
            this._state[2].process.process!.stdout.once('end', () => this._state[2].data.write('', true));

            const seed = Math.round(Math.random() * 9007199254740991);
            const generatorRunArguments = await this._resolveRunArguments(runSettings.runCommand, config.get('generatorFile')!);
            this._state[0].process.run(generatorRunArguments[0], cwd, ...generatorRunArguments.slice(1));
            this._state[0].process.process!.on('error', data => this._state[0].data.write(data.message, true));
            this._state[0].process.process!.stdin.write(`${seed}\n`);
            this._state[0].process.process!.stdout.on('data', data => {
                this._state[0].data.write(data, false);
                this._state[1].process.process!.stdin.write(data);
                this._state[2].process.process!.stdin.write(data);
            });
            this._state[0].process.process!.stdout.once('end', () => this._state[0].data.write('', true));

            for (let i = 0; i < 3; i++) {
                // if any process fails then the other 2 should be gracefully closed
                this._state[i].process.process!.once('close', code => {
                    if (code === null) {
                        for (let j = 0; j < 3; j++) {
                            if (j !== i) {
                                this._state[j].process.process!.kill('SIGUSR1');
                            }
                        }
                    }
                });
            }

            await Promise.allSettled(this._state.map(value => value.process!.promise));
            for (let i = 0; i < 3; i++) {
                anyFailed ||= !!this._state[i].process!.exitCode;
                this._state[i].status = this._state[i].process!.exitCode === 0 ? Status.NA : Status.RE;
            }
            if (anyFailed || this._state[1].data.data !== this._state[2].data.data) {
                break;
            }
            await new Promise<void>(resolve => setTimeout(() => resolve(), delayBetweenTestcases));
        }

        if (!anyFailed && this._state[1].data.data !== this._state[2].data.data) {
            this._state[1].status = Status.WA;
        }
        for (let i = 0; i < 3; i++) {
            super._postMessage(StressTesterMessageType.STATUS, { id: i, status: this._state[i].status });
        }
        this._saveState();
    }

    private _stop() {
        this._stopFlag = true;
        for (let i = 0; i < 3; i++) {
            this._state[i].process.process?.kill('SIGUSR1');
        }
    }

    private async _add({ id }: { id: number }) {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }

        let resolvedFile;
        if (id == 0) {
            resolvedFile = await resolveVariables(vscode.workspace.getConfiguration('fastolympiccoding').get('generatorFile')!);
        } else if (id == 1) {
            resolvedFile = file;
        } else {
            resolvedFile = await resolveVariables(vscode.workspace.getConfiguration('fastolympiccoding').get('goodSolutionFile')!);
        }

        this.testcaseViewProvider.nextTestcase(resolvedFile, {
            stdin: this._state[0].data.data,
            stderr: '',
            stdout: this._state[1].data.data,
            acceptedStdout: this._state[2].data.data,
            elapsed: 0,
            status: this._state[id].status,
            showTestcase: true,
            toggled: false,
        });
    }

    private _saveState() {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }

        super.writeStorage(file, this._state.map<IData>(value => {
            return {
                data: value.data.data,
                status: value.status,
            };
        }));
    }

    private async _resolveRunArguments(runCommand: string, fileVariable: string) {
        const resolvedFile = await resolveVariables(fileVariable);
        const resolvedArgs = await resolveCommandArgs(runCommand, resolvedFile);
        return resolvedArgs;
    }
}