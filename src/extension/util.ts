import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as child_process from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';

import { Status } from '../common';

const errorTerminal: Map<string, vscode.Terminal> = new Map();
const lastCompiled: Map<string, [string, string]> = new Map();
const compilePromise: Map<string, Promise<number>> = new Map();

async function getFileChecksum(file: string): Promise<string> {
    const hash = crypto.createHash('md5'); // good enough to verify file integrity with good speed
    hash.setEncoding('hex');
    const stream = fs.createReadStream(file);
    return new Promise(resolve => {
        stream.on('end', () => {
            hash.end();
            resolve(hash.read());
        });
        stream.pipe(hash);
    });
}

async function getDefaultBuildTaskName() {
    const tasks = await vscode.tasks.fetchTasks();
    for (const task of tasks) {
        if (task.group?.id === vscode.TaskGroup.Build.id && task.group?.isDefault) {
            return task.name;
        }
    }
    return '';
}

async function replaceAsync(string: string, regexp: RegExp, replacer: Function) {
    const replacements = await Promise.all(Array.from(string.matchAll(regexp), match => replacer(...match.slice(1), match.index, match[0])));
    let i = 0;
    return string.replace(regexp, () => replacements[i++]);
}

function normalizePath(str: string) {
    return path.normalize(os.platform() === 'win32' ? `"${str}"` : str.replace(/ /g, '\ '));
}

export interface ILanguageRunSettings {
    compileCommand?: string;
    runCommand: string;
}

export class RunningProcess {
    readonly process: child_process.ChildProcessWithoutNullStreams;
    readonly promise: Promise<number>;
    private _startTime: number = 0;
    private _endTime: number = 0;

    constructor(command: string, ...args: string[]) {
        this.process = child_process.spawn(command, args);
        this.process.stdout.setEncoding('utf-8');
        this.process.stderr.setEncoding('utf-8');
        this.promise = new Promise(resolve => {
            this.process.on('spawn', () => this._startTime = Date.now());
            this.process.on('error', () => resolve(-1));
            this.process.on('close', code => { this._endTime = Date.now(); resolve(code ?? 1); });
        });
    }

    get elapsed(): number {
        return this._endTime - this._startTime;
    }
};

export class Data {
    private static readonly INTERVAL: number = 30;
    private static _maxDisplayCharacters: number = vscode.workspace.getConfiguration('fastolympiccoding').get('maxDisplayCharacters')!;
    private static _maxDisplayLines: number = vscode.workspace.getConfiguration('fastolympiccoding').get('maxDisplayLines')!;
    private _data: string = ''; // full output with combined adjacent whitespaces
    private _shortData: string = ''; // shortened output without combined adjacent whitespaces
    private _pending: string = '';
    private _newlineCount: number = 0;
    private _shortened: boolean = false;
    private _lastWrite: number = -Infinity;
    public callback: Function | undefined = undefined;

    get data() {
        return this._data;
    }

    get shortData() {
        return this._shortData;
    }

    public write(data: string, last: boolean) {
        data = data.replace(/\r\n/g, '\n'); // just avoid \r\n entirely

        for (let i = 0; i < data.length;) {
            if (data[i] === ' ') {
                this._data += ' ';
                for (; i < data.length && data[i] === ' '; i++) { }
            } else {
                this._data += data[i++];
            }
        }
        if (this._shortened) {
            return;
        }

        for (let i = 0; i < data.length && this._shortData.length < Data._maxDisplayCharacters && this._newlineCount < Data._maxDisplayLines; i++) {
            if (data[i] === '\n') {
                this._newlineCount++;
            }
            this._shortData += data[i];
            this._pending += data[i];
        }

        const now = Date.now();
        if (now - this._lastWrite < Data.INTERVAL && !last) {
            return;
        }

        this._lastWrite = now;
        if (this._shortData.length === Data._maxDisplayCharacters || this._newlineCount === Data._maxDisplayLines) {
            this._shortData += '...';
            this._pending += '...';
            this._shortened = true;
        }
        if (this.callback) {
            this.callback(this._pending);
        }
        this._pending = '';
    }

    public reset() {
        this._data = '';
        this._shortData = '';
        this._pending = '';
        this._newlineCount = 0;
        this._shortened = false;
        this._lastWrite = -Infinity;
    }
}

export class DummyTerminal implements vscode.Pseudoterminal {
    private _writeEmitter: vscode.EventEmitter<string> = new vscode.EventEmitter();
    private _closeEmitter: vscode.EventEmitter<number> = new vscode.EventEmitter();

    onDidWrite: vscode.Event<string> = this._writeEmitter.event;
    onDidClose: vscode.Event<number> = this._closeEmitter.event;

    open(): void { }

    write(text: string): void {
        // VSCode requires \r\n for newline, but keep existing \r\n
        this._writeEmitter.fire(text.replace(/\n/g, '\r\n'));
    }

    close(): void {
        this._closeEmitter.fire(0);
    }
}

export async function resolveVariables(string: string, recursive: boolean = false, inContextOfFile?: string): Promise<string> {
    const workspaces = vscode.workspace.workspaceFolders;
    const workspace = vscode.workspace.workspaceFolders?.at(0);
    const activeEditor = inContextOfFile ? undefined : vscode.window.activeTextEditor;
    const absoluteFilePath = inContextOfFile ?? activeEditor?.document.uri.fsPath;
    const parsedPath = absoluteFilePath ? path.parse(absoluteFilePath) : undefined;

    let activeWorkspace = workspace;
    let relativeFilePath = absoluteFilePath;
    for (const workspace of (workspaces ?? [])) {
        if (absoluteFilePath?.includes(workspace.uri.fsPath)) {
            activeWorkspace = workspace;
            relativeFilePath = absoluteFilePath?.replace(workspace.uri.fsPath, '').substring(path.sep.length);
            break;
        }
    }

    let oldString = '';
    do {
        oldString = string;

        string = workspace ? string.replace(/\${userHome}/g, os.homedir()) : string;
        string = workspace ? string.replace(/\${workspaceFolder}/g, workspace.uri.fsPath) : string;
        string = workspace ? string.replace(/\${workspaceFolderBasename}/g, workspace.name) : string;
        string = absoluteFilePath ? string.replace(/\${file}/g, absoluteFilePath) : string;
        string = activeWorkspace ? string.replace(/\${fileWorkspaceFolder}/g, activeWorkspace.uri.fsPath) : string;
        string = relativeFilePath ? string.replace(/\${relativeFile}/g, relativeFilePath) : string;
        string = relativeFilePath ? string.replace(/\${relativeFileDirname}/g, relativeFilePath.substring(0, relativeFilePath.lastIndexOf(path.sep))) : string;
        string = parsedPath ? string.replace(/\${fileBasename}/g, parsedPath.base) : string;
        string = parsedPath ? string.replace(/\${fileBasenameNoExtension}/g, parsedPath.name) : string;
        string = parsedPath ? string.replace(/\${fileExtname}/g, parsedPath.ext) : string;
        string = parsedPath ? string.replace(/\${fileDirname}/g, parsedPath.dir) : string;
        string = parsedPath ? string.replace(/\${fileDirnameBasename}/g, parsedPath.dir.substring(parsedPath.dir.lastIndexOf(path.sep) + 1)) : string;
        string = parsedPath ? string.replace(/\${cwd}/g, parsedPath.dir) : string;
        string = activeEditor ? string.replace(/\${lineNumber}/g, `${activeEditor.selection.start.line + 1}`) : string;
        string = activeEditor ? string.replace(/\${selectedText}/g, `${activeEditor.document.getText(new vscode.Range(activeEditor.selection.start, activeEditor.selection.end))}`) : string;
        string = string.replace(/\${execPath}/g, process.execPath);
        string = await replaceAsync(string, /\${defaultBuildTask}/g, async () => await getDefaultBuildTaskName()); // only get name when necessary because it's slow
        string = string.replace(/\${pathSeparator}/g, path.sep);
        string = string.replace(/\${\/}/g, path.sep);
        string = string.replace(/\${env:(.*?)}/g, match => process.env[match] ?? '');
        string = string.replace(/\${config:(.*?)}/g, match => vscode.workspace.getConfiguration().get(match) ?? '');
        string = string.replace(/\${exeExtname}/, os.platform() === 'win32' ? '.exe' : '');
        string = await replaceAsync(string, /\${path:(.*?)}/g, async (match: string) => normalizePath(await resolveVariables(match, false, inContextOfFile)));
    } while (recursive && oldString !== string);
    return string;
}

export async function viewTextInEditor(content: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument({ content });
    vscode.window.showTextDocument(document);
}

export async function resolveCommandArgs(command: string, inContextOfFile?: string) {
    const args = command.trim().split(' ');
    return await Promise.all(args.map(arg => resolveVariables(arg, false, inContextOfFile)));
}

export async function compile(file: string, compileCommand: string): Promise<number> {
    errorTerminal.get(file)?.dispose();

    if (!fs.existsSync(file)) {
        vscode.window.showErrorMessage(`${file} does not exist`);
        return 1;
    }

    const resolvedArgs = await resolveCommandArgs(compileCommand, file);
    const currentCommand = resolvedArgs.join(' ');
    const currentChecksum = await getFileChecksum(file);
    const [cachedChecksum, cachedCommand] = lastCompiled.get(file) ?? [-1, ''];
    if (currentChecksum === cachedChecksum && currentCommand === cachedCommand) {
        return 0; // avoid unnecessary recompilation
    }

    let promise = compilePromise.get(file);
    if (!promise) {
        promise = (async () => {
            const process = new RunningProcess(resolvedArgs[0], ...resolvedArgs.slice(1));
            let err = '';
            process.process.stderr.on('data', data => err += data.toString());
            process.process.on('error', data => err += data.stack);

            const code = await process.promise;
            if (!code) {
                lastCompiled.set(file, [currentChecksum, currentCommand]);
                return 0;
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

            dummy.write(err);
            terminal.show(true);
            return code;
        })();
        compilePromise.set(file, promise);
    }

    const code = await promise;
    compilePromise.delete(file);
    return code;
}

export function getExitCodeStatus(code: number | null, stdout: string, acceptedStdout: string) {
    if (code === null || code)
        return Status.RE;
    else if (acceptedStdout === '')
        return Status.NA;
    else if (stdout === acceptedStdout)
        return Status.AC;
    else
        return Status.WA;
}