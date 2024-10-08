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
    process: RunningProcess | undefined;
}

export class StressTesterViewProvider extends BaseViewProvider<StressTesterMessageType> {
    private _state: IState[] = [
        { data: new Data(), status: Status.NA, process: undefined },
        { data: new Data(), status: Status.NA, process: undefined },
        { data: new Data(), status: Status.NA, process: undefined },
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
                this._saveState();
                break;
            case StressTesterMessageType.VIEW:
                {
                    const { id } = payload;
                    viewTextInEditor(this._state[id].data.data);
                }
                break;
            case StressTesterMessageType.ADD:
                this._add();
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
            return;
        }

        const storage = super.readStorage();
        const state: IData[] = storage[file] ?? [];
        for (let i = 0; i < state.length; i++) {
            this._state[i].data.write(state[i].data, true);
            this._state[i].status = state[i].status;
            this._state[i].process = undefined;
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
            const codes = await Promise.allSettled(promises);

            for (let i = 0; i < 3; i++) {
                const code = (codes[i] as PromiseFulfilledResult<number>).value;
                if (code) {
                    return;
                }
            }
        }

        for (let i = 0; i < 3; i++) {
            super._postMessage(StressTesterMessageType.STATUS, { id: i, status: Status.RUNNING });
        }

        this._stopFlag = false;
        while (!this._stopFlag) {
            super._postMessage(StressTesterMessageType.CLEAR);
            for (let i = 0; i < 3; i++) {
                this._state[i].data.reset();
            }

            this._state[1].process = await this._runFile(runSettings.runCommand, '${file}');
            this._state[1].process.process.stdout.on('data', data => this._state[1].data.write(data, false));
            this._state[1].process.process.stdout.on('end', () => this._state[1].data.write('', true));

            this._state[2].process = await this._runFile(runSettings.runCommand, config.get('goodSolutionFile')!);
            this._state[2].process.process.stdout.on('data', data => this._state[2].data.write(data, false));
            this._state[2].process.process.stdout.on('end', () => this._state[2].data.write('', true));

            const seed = Math.round(Math.random() * 9007199254740991);
            this._state[0].process = await this._runFile(runSettings.runCommand, config.get('generatorFile')!);
            this._state[0].process.process.stdin.write(`${seed}\n`);
            this._state[0].process.process.stdout.on('data', data => {
                this._state[0].data.write(data, false);
                this._state[1].process!.process.stdin.write(data);
                this._state[2].process!.process.stdin.write(data);
            });
            this._state[0].process.process.stdout.on('end', () => this._state[0].data.write('', true));

            const codes = await Promise.allSettled(this._state.map(value => value.process!.promise));
            let anyFailed = false;
            for (let i = 0; i < codes.length; i++) {
                const code = (codes[i] as PromiseFulfilledResult<number>).value;
                let status = Status.NA;
                if (code) {
                    anyFailed = true;
                    status = Status.RE;
                    super._postMessage(StressTesterMessageType.STATUS, { id: i, status: Status.RE });
                }
                this._state[i].status = status;
            }
            if (anyFailed) {
                break;
            }
            if (this._state[1].data.data !== this._state[2].data.data) {
                this._state[1].status = Status.WA;
                super._postMessage(StressTesterMessageType.STATUS, { id: 1, status: Status.WA });
                this._saveState();
                break;
            } else {
                await new Promise<void>(resolve => setTimeout(() => resolve(), delayBetweenTestcases));
                super._postMessage(StressTesterMessageType.CLEAR);
            }
        }
    }

    private _stop() {
        this._stopFlag = true;
        for (let i = 0; i < 3; i++) {
            this._state[i].process?.process.kill();
            super._postMessage(StressTesterMessageType.STATUS, { id: i, status: Status.RE });
        }
    }

    private _add() {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }

        this.testcaseViewProvider.nextTestcase({
            stdin: this._state[0].data.data,
            stderr: '',
            stdout: this._state[1].data.data,
            acceptedStdout: this._state[2].data.data,
            elapsed: 0,
            status: Status.WA,
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

    private async _runFile(runCommand: string, fileVariable: string) {
        const resolvedFile = await resolveVariables(fileVariable);
        const resolvedArgs = await resolveCommandArgs(runCommand, resolvedFile);
        return new RunningProcess(resolvedArgs[0], ...resolvedArgs.slice(1));
    }
}