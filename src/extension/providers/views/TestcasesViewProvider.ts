import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { Data, RunningProcess, ILanguageRunSettings, viewTextInEditor, resolveCommandArgs } from '../../util';
import { BaseViewProvider } from './BaseViewProvider';
import { ITestcasesMessage, Status, Stdio, TestcasesMessageType } from '../../../common';
import { compile, getExitCodeStatus } from '../../util';

interface ITestcase {
    stdin: string;
    stderr: string;
    stdout: string;
    acceptedStdout: string;
    elapsed: number;
    status: Status;
    showTestcase: boolean;
    toggled: boolean;
}

interface IState {
    stdin: Data;
    stderr: Data;
    stdout: Data;
    acceptedStdout: Data;
    elapsed: number;
    status: number;
    showTestcase: boolean;
    toggled: boolean;
    id: number;
    process: RunningProcess | undefined;
}

export class TestcasesViewProvider extends BaseViewProvider<TestcasesMessageType> {
    private _state: (IState | undefined)[] = [];
    private _order: number[] = [];

    onMessage(message: ITestcasesMessage) {
        const { type, payload } = message;
        switch (type) {
            case TestcasesMessageType.LOADED:
                this.loadSavedData();
                break;
            case TestcasesMessageType.NEXT_TESTCASE:
                this._run(this.nextTestcase());
                break;
            case TestcasesMessageType.RUN:
                this._run(payload.id);
                break;
            case TestcasesMessageType.STOP:
                this._stop(payload.id);
                break;
            case TestcasesMessageType.DELETE:
                this._delete(payload.id);
                break;
            case TestcasesMessageType.EDIT:
                this._edit(payload.id);
                break;
            case TestcasesMessageType.TOGGLE:
                this._toggle(payload.id);
                break;
            case TestcasesMessageType.SAVE:
                this._save(payload);
                break;
            case TestcasesMessageType.ACCEPT:
                this._accept(payload.id);
                break;
            case TestcasesMessageType.DECLINE:
                this._decline(payload.id);
                break;
            case TestcasesMessageType.VIEW:
                this._view(payload);
                break;
            case TestcasesMessageType.STDIN:
                this._stdin(payload);
                break;
            case TestcasesMessageType.DIFF:
                this._diff(payload);
                break;
        }
    }

    onDispose() {
        this.stopAll();
    }

    constructor(context: vscode.ExtensionContext) {
        super('testcases', context);

        vscode.window.onDidChangeActiveTextEditor(this.loadSavedData, this);
    }

    public loadSavedData() {
        this.stopAll();
        this._state = [];
        this._order = [];
        super._postMessage(TestcasesMessageType.CLEAR_TESTCASES);

        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }

        const storage = super.readStorage();
        const fileData = storage[file] ?? [];
        for (let i = 0; i < fileData.length; i++) {
            const testcase = this._createTestcase(fileData[i], i);
            this._state.push(testcase);
        }
    }

    public addFromCompetitiveCompanion(data: any) {
        this.deleteAll();

        const showStderrMessage = vscode.workspace.getConfiguration('fastolympiccoding').get('showTestcaseStderrMessage') as boolean;
        for (const test of data['tests']) {
            this.nextTestcase({
                stdin: test['input'],
                stderr: showStderrMessage ? 'This is generated from Competitive Companion. Run this testcase to get rid of this message.' : '',
                stdout: '',
                acceptedStdout: test['output'],
                elapsed: 0,
                status: Status.WA,
                showTestcase: true,
                toggled: false,
            });
        }
    }

    public nextTestcase(testcase?: ITestcase) {
        let id = 0;
        for (; id < this._state.length; id++) {
            if (!this._state[id]) {
                break;
            }
        }

        const newTestcase = this._createTestcase(testcase, id);
        if (id === this._state.length) {
            this._state.push(newTestcase);
        } else {
            this._state[id] = newTestcase;
        }

        this._saveState();
        return id;
    }

    public runAll() {
        for (let i = 0; i < this._state.length; i++) {
            if (this._state[i]) {
                this._run(i);
            }
        }
    }

    public stopAll() {
        for (let i = 0; i < this._state.length; i++) {
            if (this._state[i]) {
                this._stop(i);
            }
        }
    }

    public deleteAll() {
        for (let i = 0; i < this._state.length; i++) {
            if (this._state[i]) {
                this._delete(i);
            }
        }
    }

    private _onClose(id: number, process: RunningProcess, exitCode: number | null) {
        const status = getExitCodeStatus(exitCode, this._state[id]!.stdout.data, this._state[id]!.acceptedStdout.data);
        const elapsed = process.elapsed;
        super._postMessage(TestcasesMessageType.STATUS, { id, status, elapsed })
        this._state[id]!.process = undefined;
        this._state[id]!.status = status;
        this._state[id]!.elapsed = elapsed;
        if (!this._state[id]!.toggled) {
            this._state[id]!.showTestcase = status !== Status.AC;
            super._postMessage(TestcasesMessageType.TOGGLE_STATUS, { id, status: status !== Status.AC, toggled: false });
        }
        this._saveState();
    }

    private _onError(id: number, data: Error) {
        super._postMessage(TestcasesMessageType.STDIO, { id, data, stdio: Stdio.STDERR });
        super._postMessage(TestcasesMessageType.STATUS, { id, status: Status.RE });
        this._saveState();
    }

    private _saveState() {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }

        const testcases: ITestcase[] = [];
        for (const i of this._order) {
            testcases.push({
                stdin: this._state[i]!.stdin.data,
                stderr: this._state[i]!.stderr.data,
                stdout: this._state[i]!.stdout.data,
                acceptedStdout: this._state[i]!.acceptedStdout.data,
                elapsed: this._state[i]!.elapsed,
                status: this._state[i]!.status,
                showTestcase: this._state[i]!.showTestcase,
                toggled: this._state[i]!.toggled,
            });
        }
        super.writeStorage(file, testcases);
    }

    private _createTestcase(testcase: ITestcase | undefined, id: number) {
        super._postMessage(TestcasesMessageType.NEW_EMPTY_TESTCASE, { id });
        const newTestcase: IState = {
            stdin: new Data(),
            stderr: new Data(),
            stdout: new Data(),
            acceptedStdout: new Data(),
            elapsed: testcase?.elapsed ?? 0,
            status: testcase?.status ?? Status.NA,
            showTestcase: testcase?.showTestcase ?? true,
            toggled: testcase?.toggled ?? false,
            id,
            process: undefined,
        };
        newTestcase.stdin.callback = (data: string) => super._postMessage(TestcasesMessageType.STDIO, { id, data, stdio: Stdio.STDIN });
        newTestcase.stderr.callback = (data: string) => super._postMessage(TestcasesMessageType.STDIO, { id, data, stdio: Stdio.STDERR });
        newTestcase.stdout.callback = (data: string) => super._postMessage(TestcasesMessageType.STDIO, { id, data, stdio: Stdio.STDOUT });
        newTestcase.acceptedStdout.callback = (data: string) => super._postMessage(TestcasesMessageType.STDIO, { id, data, stdio: Stdio.ACCEPTED_STDOUT });
        newTestcase.stdin.write(testcase?.stdin ?? '', true);
        newTestcase.stderr.write(testcase?.stderr ?? '', true);
        newTestcase.stdout.write(testcase?.stdout ?? '', true);
        newTestcase.acceptedStdout.write(testcase?.acceptedStdout ?? '', true);
        super._postMessage(TestcasesMessageType.STATUS, { id, status: newTestcase.status, elapsed: newTestcase.elapsed });
        super._postMessage(TestcasesMessageType.TOGGLE_STATUS, { id, status: newTestcase.showTestcase, toggled: newTestcase.toggled });
        this._order.push(id);
        return newTestcase;
    }

    private async _run(id: number): Promise<void> {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }

        if (this._state[id]!.process) { // prevent process leak
            this._stop(id);
            await this._state[id]!.process.promise; // wait for status update to be sent
        }

        super._postMessage(TestcasesMessageType.STATUS, { id, status: Status.COMPILING });

        const config = vscode.workspace.getConfiguration('fastolympiccoding');
        const extension = path.extname(file);
        const runSettings: ILanguageRunSettings | undefined = config.get<any>('runSettings')[extension];
        if (!runSettings) {
            vscode.window.showWarningMessage(`No run setting detected for file extension "${extension}"`);
            return;
        }

        if (runSettings.compileCommand) {
            const code = await compile(file, runSettings.compileCommand);
            if (code) {
                super._postMessage(TestcasesMessageType.STATUS, { id, status: Status.CE });
                return;
            }
        }
        super._postMessage(TestcasesMessageType.CLEAR_OUTPUTS, { id });
        super._postMessage(TestcasesMessageType.STATUS, { id, status: Status.RUNNING });

        const resolvedArgs = await resolveCommandArgs(runSettings.runCommand);
        const process = new RunningProcess(resolvedArgs[0], ...resolvedArgs.slice(1));
        this._state[id]!.process = process;
        this._state[id]!.stderr.reset();
        this._state[id]!.stdout.reset();

        process.process.stdin.write(this._state[id]!.stdin.data);
        process.process.stderr.on('data', (data: string) => this._state[id]!.stderr.write(data, false));
        process.process.stdout.on('data', (data: string) => this._state[id]!.stdout.write(data, false));
        process.process.stderr.on('end', () => this._state[id]!.stderr.write('', true));
        process.process.stdout.on('end', () => this._state[id]!.stdout.write('', true));
        process.process.on('error', this._onError.bind(this, id));
        process.process.on('close', this._onClose.bind(this, id, process));
    }

    private _stop(id: number) {
        this._state[id]!.process?.process.kill();
    }

    private _delete(id: number) {
        this._stop(id);
        this._state[id] = undefined;
        super._postMessage(TestcasesMessageType.DELETE_TESTCASE, { id });

        const index = this._order.findIndex(value => value === id);
        this._order.splice(index, 1);

        this._saveState();
    }

    private _edit(id: number) {
        super._postMessage(TestcasesMessageType.FULL_STDIN, { id, data: this._state[id]!.stdin.data });
        super._postMessage(TestcasesMessageType.STATUS, { id, status: Status.EDITING });
    }

    private _toggle(id: number) {
        this._state[id]!.showTestcase = !this._state[id]!.showTestcase;
        this._state[id]!.toggled = true;
        super._postMessage(TestcasesMessageType.TOGGLE_STATUS, { id, status: this._state[id]!.showTestcase, toggled: true });
        this._saveState();
    }

    private _save({ id, data }: { id: number, data: string }) {
        this._state[id]!.stdin.reset();
        this._state[id]!.stdin.write(data, true);
        super._postMessage(TestcasesMessageType.STATUS, { id, status: this._state[id]!.status });
        this._saveState();
    }

    private _accept(id: number) {
        if (!this._state[id]!.toggled) {
            this._state[id]!.showTestcase = false;
            super._postMessage(TestcasesMessageType.TOGGLE_STATUS, { id, status: false, toggled: false });
        }
        this._state[id]!.status = Status.AC;
        this._state[id]!.acceptedStdout.reset();
        this._state[id]!.acceptedStdout.write(this._state[id]!.stdout.data, true);
        super._postMessage(TestcasesMessageType.STATUS, { id, status: Status.AC });
        this._saveState();
    }

    private _decline(id: number) {
        this._state[id]!.acceptedStdout.reset();
        this._state[id]!.status = Status.NA;
        super._postMessage(TestcasesMessageType.STATUS, { id, status: Status.NA });
        this._saveState();
    }

    private _view({ id, stdin }: { id: number, stdin: Stdio }) {
        switch (stdin) {
            case Stdio.STDIN:
                viewTextInEditor(this._state[id]!['stdin'].data);
                break;
            case Stdio.STDERR:
                viewTextInEditor(this._state[id]!['stderr'].data);
                break;
            case Stdio.STDOUT:
                viewTextInEditor(this._state[id]!['stdout'].data);
                break;
            case Stdio.ACCEPTED_STDOUT:
                viewTextInEditor(this._state[id]!['acceptedStdout'].data);
                break;
        }
    }

    private _stdin({ id, data }: { id: number, data: string }) {
        this._state[id]!.process?.process.stdin.write(data);
        this._state[id]!.stdin.write(data, false);
    }

    private _diff({ id }: { id: number }) {
        fs.mkdtemp(fs.realpathSync(os.tmpdir()) + path.sep, (err, folder) => {
            if (err) {
                vscode.window.showErrorMessage(`Diff failed to open: ${err}`);
                return;
            }
            
            const outFile = path.join(folder, `${id}.out`);
            const acOutFile = path.join(folder, `${id}.ac.out`);
            fs.writeFileSync(outFile, `OUTPUT:\n\n${this._state[id]!.stdout.data}`);
            fs.writeFileSync(acOutFile, `ACCEPTED OUTPUT:\n\n${this._state[id]!.acceptedStdout.data}`);
            vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(outFile), vscode.Uri.file(acOutFile), `Diff: Testcase #${id}`);
        });
    }
}