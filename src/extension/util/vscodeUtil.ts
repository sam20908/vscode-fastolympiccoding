// originally from https://github.com/DominicVonk/vscode-variables/blob/main/index.js

import * as vscode from 'vscode';
import * as process from 'process';
import * as os from 'os';
import * as path from 'path';

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

    close(): void { }
}

export function resolveVariables(string: string, recursive: boolean = false, inContextOfFile?: string): string {
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

        // VSCode variables
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
        string = string.replace(/\${pathSeparator}/g, path.sep);
        string = activeEditor ? string.replace(/\${lineNumber}/g, `${activeEditor.selection.start.line + 1}`) : string;
        string = activeEditor ? string.replace(/\${selectedText}/g, `${activeEditor.document.getText(new vscode.Range(activeEditor.selection.start, activeEditor.selection.end))}`) : string;
        string = string.replace(/\${env:(.*?)}/g, (match, _offset, _string) => process.env[match] ?? '');
        string = string.replace(/\${config:(.*?)}/g, (match, _offset, _string) => vscode.workspace.getConfiguration().get(match) ?? '');

        // Our own variables
        string = string.replace(/\${exeExtname}/, os.platform() === 'win32' ? '.exe' : '');
    } while (recursive && oldString !== string);
    return string;
}