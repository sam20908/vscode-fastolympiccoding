import path from 'path';
import vscode from 'vscode';

import { ITestcase, Status, Stdio } from '~common/common';
import { ILanguageSettings } from '~common/provider';
import BaseViewProvider from '~utils/BaseViewProvider';
import { openInNewEditor, ReadonlyStringProvider, resolveCommand, resolveVariables, TextHandler } from '~utils/vscode';
import { compile, Runnable } from '~utils/runtime';
import { ProviderMessageType, ProviderMessage, WebviewMessage, WebviewMessageType, IActionMessage, Action, IViewMessage, ISaveMessage, IStdinMessage } from '../message';

interface IState extends Omit<ITestcase, 'stdin' | 'stderr' | 'stdout' | 'acceptedStdout'> {
    stdin: TextHandler;
    stderr: TextHandler;
    stdout: TextHandler;
    acceptedStdout: TextHandler;
    id: number;
    process: Runnable;
}

function getExitCodeStatus(code: number | null, stdout: string, acceptedStdout: string) {
    if (code === null || code)
        return Status.RE;
    else if (acceptedStdout === '\n')
        return Status.NA;
    else if (stdout === acceptedStdout)
        return Status.AC;
    else
        return Status.WA;
}

export default class extends BaseViewProvider<ProviderMessage, WebviewMessage> {
    private _testcases: Map<number, IState> = new Map(); // Map also remembers insertion order :D
    private _newId: number = 0;

    onMessage(msg: ProviderMessage) {
        switch (msg.type) {
            case ProviderMessageType.LOADED:
                this.loadCurrentFileTestcases();
                break;
            case ProviderMessageType.NEXT:
                this._run(this.addTestcaseToFile());
                break;
            case ProviderMessageType.ACTION:
                this._action(msg);
                break;
            case ProviderMessageType.SAVE:
                this._save(msg);
                break;
            case ProviderMessageType.VIEW:
                this._viewStdio(msg);
                break;
            case ProviderMessageType.STDIN:
                this._stdin(msg);
                break;
        }
    }

    onDispose() {
        this.stopAll();
    }

    constructor(context: vscode.ExtensionContext) {
        super('testcases', context);

        vscode.window.onDidChangeActiveTextEditor(this.loadCurrentFileTestcases, this);
    }

    public loadCurrentFileTestcases() {
        this.stopAll();
        for (const id of this._testcases.keys()) {
            super._postMessage({ type: WebviewMessageType.DELETE, id });
        }
        this._testcases.clear();

        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            super._postMessage({ type: WebviewMessageType.SHOW, visible: false });
            return;
        }
        super._postMessage({ type: WebviewMessageType.SHOW, visible: true });

        const storage = super.readStorage();
        const fileData = storage[file] ?? [];
        for (let i = 0; i < fileData.length; i++) {
            this._testcases.set(this._newId, this._createTestcaseState(fileData[i], this._newId))
            this._newId++;
        }
    }

    public addFromCompetitiveCompanion(file: string, data: any) {
        const testcases: ITestcase[] = data['tests'].map((test: any): ITestcase => {
            return {
                stdin: test['input'],
                stderr: '',
                stdout: '',
                acceptedStdout: test['output'],
                elapsed: 0,
                status: Status.WA,
                shown: true,
                toggled: false,
                skipped: false,
            };
        });

        if (file === vscode.window.activeTextEditor?.document.fileName) {
            this.deleteAll();

            for (const testcase of testcases) {
                this.addTestcaseToFile(file, testcase);
            }
        } else {
            super.writeStorage(file, testcases);
        }
    }

    public addTestcaseToFile(file?: string, testcase?: ITestcase) {
        const pickedFile = file ?? vscode.window.activeTextEditor?.document.fileName;
        if (!pickedFile) {
            return -1;
        }

        if (pickedFile === vscode.window.activeTextEditor?.document.fileName) {
            this._testcases.set(this._newId, this._createTestcaseState(testcase, this._newId));
            this._saveTestcases();
            return this._newId++;
        } else if (testcase) {
            const storage = super.readStorage();
            const fileData: ITestcase[] = storage[pickedFile] ?? [];
            fileData.push(testcase);
            super.writeStorage(pickedFile, fileData);
        }

        return -1;
    }

    public runAll() {
        for (const id of this._testcases.keys()) {
            this._run(id);
        }
    }

    public stopAll() {
        for (const id of this._testcases.keys()) {
            this._stop(id);
        }
    }

    public deleteAll() {
        for (const id of this._testcases.keys()) {
            this._delete(id);
        }
    }

    private _action({ id, action }: IActionMessage) {
        switch (action) {
            case Action.RUN:
                this._run(id);
                break;
            case Action.STOP:
                this._stop(id);
                break;
            case Action.DELETE:
                this._delete(id);
                break;
            case Action.EDIT:
                this._edit(id);
                break;
            case Action.ACCEPT:
                this._accept(id);
                break;
            case Action.DECLINE:
                this._decline(id);
                break;
            case Action.TOGGLE_VISIBILITY:
                this._toggleVisibility(id);
                break;
            case Action.TOGGLE_SKIP:
                this._toggleSkip(id);
                break;
            case Action.VIEW_DIFF:
                this._viewDiff(id);
                break;
        }
    }

    private _saveTestcases() {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }

        const testcases: ITestcase[] = [];
        for (const testcase of this._testcases.values()) {
            testcases.push({
                stdin: testcase.stdin.data,
                stderr: testcase.stderr.data,
                stdout: testcase.stdout.data,
                acceptedStdout: testcase.acceptedStdout.data,
                elapsed: testcase.elapsed,
                status: testcase.status,
                shown: testcase.shown,
                toggled: testcase.toggled,
                skipped: testcase.skipped,
            });
        }
        super.writeStorage(file, testcases);
    }

    private _createTestcaseState(testcase: ITestcase | undefined, id: number) {
        // create a new testcase in webview and fill it in later
        super._postMessage({ type: WebviewMessageType.NEW, id });

        const newTestcase: IState = {
            stdin: new TextHandler(),
            stderr: new TextHandler(),
            stdout: new TextHandler(),
            acceptedStdout: new TextHandler(),
            elapsed: testcase?.elapsed ?? 0,
            status: testcase?.status ?? Status.NA,
            shown: testcase?.shown ?? true,
            toggled: testcase?.toggled ?? false,
            skipped: testcase?.skipped ?? false,
            id,
            process: new Runnable(),
        };

        newTestcase.stdin.callback = (data: string) => super._postMessage({ type: WebviewMessageType.STDIO, id, stdio: Stdio.STDIN, data });
        newTestcase.stderr.callback = (data: string) => super._postMessage({ type: WebviewMessageType.STDIO, id, stdio: Stdio.STDERR, data });
        newTestcase.stdout.callback = (data: string) => super._postMessage({ type: WebviewMessageType.STDIO, id, stdio: Stdio.STDOUT, data });
        newTestcase.acceptedStdout.callback = (data: string) => super._postMessage({ type: WebviewMessageType.STDIO, id, stdio: Stdio.ACCEPTED_STDOUT, data });

        newTestcase.stdin.write(testcase?.stdin ?? '', !!testcase);
        newTestcase.stderr.write(testcase?.stderr ?? '', !!testcase);
        newTestcase.stdout.write(testcase?.stdout ?? '', !!testcase);
        newTestcase.acceptedStdout.write(testcase?.acceptedStdout ?? '', true);

        super._postMessage({ type: WebviewMessageType.SET, id, property: 'status', value: newTestcase.status });
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'elapsed', value: newTestcase.elapsed });

        return newTestcase;
    }

    private async _run(id: number): Promise<void> {
        const file = vscode.window.activeTextEditor?.document.fileName;
        if (!file) {
            return;
        }
        const testcase = this._testcases.get(id)!;

        // stop already-running process
        this._stop(id);
        await testcase.process.promise;

        if (testcase.skipped) {
            return;
        }

        const config = vscode.workspace.getConfiguration('fastolympiccoding');
        const extension = path.extname(file);
        const runSettings: ILanguageSettings | undefined = config.get<any>('runSettings')[extension];
        if (!runSettings) {
            vscode.window.showWarningMessage(`No run setting detected for file extension "${extension}"`);
            return;
        }

        if (runSettings.compileCommand) {
            super._postMessage({ type: WebviewMessageType.SET, id, property: 'status', value: Status.COMPILING });
            const code = await compile(file, runSettings.compileCommand, this._context);
            if (code) {
                super._postMessage({ type: WebviewMessageType.SET, id, property: 'status', value: Status.CE });
                return;
            }

            // the user switched to a different file during compilation, so double check we're on the same file
            // FIXME: rethink this because it doesn't seem reliable enough...
            if (vscode.window.activeTextEditor?.document.fileName !== file) {
                return;
            }
        }

        super._postMessage({ type: WebviewMessageType.SET, id, property: 'stderr', value: '' });
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'stdout', value: '' });
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'status', value: Status.RUNNING });

        const resolvedArgs = await resolveCommand(runSettings.runCommand);
        const cwd = runSettings.currentWorkingDirectory ? await resolveVariables(runSettings.currentWorkingDirectory) : undefined;
        testcase.stderr.reset();
        testcase.stdout.reset();
        testcase.process.run(resolvedArgs[0], cwd, ...resolvedArgs.slice(1));

        testcase.process.process!.stdin.write(testcase.stdin.data);
        testcase.process.process!.stderr.on('data', (data: string) => testcase.stderr.write(data, false));
        testcase.process.process!.stdout.on('data', (data: string) => testcase.stdout.write(data, false));
        testcase.process.process!.stderr.once('end', () => testcase.stderr.write('', true));
        testcase.process.process!.stdout.once('end', () => testcase.stdout.write('', true));
        testcase.process.process!.once('error', (data: Error) => {
            super._postMessage({ type: WebviewMessageType.STDIO, id, stdio: Stdio.STDERR, data: data.message });
            super._postMessage({ type: WebviewMessageType.SET, id, property: 'status', value: Status.RE });
            this._saveTestcases();
        });
        testcase.process.process!.once('close', (exitCode: number | null) => {
            testcase.process.process!.stderr.removeAllListeners('data');
            testcase.process.process!.stdout.removeAllListeners('data');
            testcase.status = getExitCodeStatus(exitCode, testcase.stdout.data, testcase.acceptedStdout.data);
            testcase.elapsed = testcase.process.elapsed;
            super._postMessage({ type: WebviewMessageType.SET, id, property: 'status', value: testcase.status });
            super._postMessage({ type: WebviewMessageType.SET, id, property: 'elapsed', value: testcase.elapsed });

            this._saveTestcases();
        })
    }

    private _stop(id: number) {
        this._testcases.get(id)!.process.process?.kill();
    }

    private _delete(id: number) {
        this._stop(id);
        super._postMessage({ type: WebviewMessageType.DELETE, id });
        this._testcases.delete(id);
        this._saveTestcases();
    }

    private _edit(id: number) {
        const testcase = this._testcases.get(id)!;
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'status', value: Status.EDITING });
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'stdin', value: testcase.stdin.data });
    }

    private _accept(id: number) {
        const testcase = this._testcases.get(id)!;

        super._postMessage({ type: WebviewMessageType.SET, id, property: 'status', value: Status.AC });
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'acceptedStdout', value: '' });
        testcase.status = Status.AC;
        testcase.acceptedStdout.reset();
        testcase.acceptedStdout.write(testcase.stdout.data, true);

        this._saveTestcases();
    }

    private _decline(id: number) {
        const testcase = this._testcases.get(id)!;

        testcase.status = Status.NA;
        testcase.acceptedStdout.reset();
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'status', value: testcase.status });
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'acceptedStdout', value: '' });
        this._saveTestcases();
    }

    private _toggleVisibility(id: number) {
        const testcase = this._testcases.get(id)!;

        testcase.shown = testcase.toggled ? !testcase.shown : testcase.status === Status.AC;
        testcase.toggled = true;
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'shown', value: testcase.shown });
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'toggled', value: true });
        this._saveTestcases();
    }

    private _toggleSkip(id: number) {
        const testcase = this._testcases.get(id)!;

        testcase.skipped = !testcase.skipped;
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'skipped', value: testcase.skipped });
        this._saveTestcases();
    }

    private _viewDiff(id: number) {
        const testcase = this._testcases.get(id)!;
        const stdout = vscode.Uri.parse(`${ReadonlyStringProvider.SCHEME}:OUTPUT:\n\n${testcase.stdout.data}`);
        const acStdout = vscode.Uri.parse(`${ReadonlyStringProvider.SCHEME}:ACCEPTED OUTPUT:\n\n${testcase.acceptedStdout.data}`);

        vscode.commands.executeCommand('vscode.diff', stdout, acStdout, `Diff: Testcase #${id + 1}`);
    }

    private _viewStdio({ id, stdio }: IViewMessage) {
        const testcase = this._testcases.get(id)!;

        switch (stdio) {
            case Stdio.STDIN:
                openInNewEditor(testcase.stdin.data);
                break;
            case Stdio.STDERR:
                openInNewEditor(testcase.stderr.data);
                break;
            case Stdio.STDOUT:
                openInNewEditor(testcase.stdout.data);
                break;
            case Stdio.ACCEPTED_STDOUT:
                openInNewEditor(testcase.acceptedStdout.data);
                break;
        }
    }

    private _stdin({ id, data }: IStdinMessage) {
        const testcase = this._testcases.get(id)!;
        testcase.process.process!.stdin.write(data);
        testcase.stdin.write(data, false);
    }

    private _save({ id, stdin, acceptedStdout }: ISaveMessage) {
        const testcase = this._testcases.get(id)!;

        super._postMessage({ type: WebviewMessageType.SET, id, property: 'stdin', value: '' });
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'acceptedStdout', value: '' });
        testcase.stdin.reset();
        testcase.acceptedStdout.reset();
        testcase.stdin.write(stdin, true);
        testcase.acceptedStdout.write(acceptedStdout, true);
        testcase.status = getExitCodeStatus(testcase.process.exitCode, testcase.stdout.data, testcase.acceptedStdout.data);
        super._postMessage({ type: WebviewMessageType.SET, id, property: 'status', value: testcase.status });

        this._saveTestcases();
    }
}