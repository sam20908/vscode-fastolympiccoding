import vscode from 'vscode';
import path from 'path';
import os from 'os';

export class ReadonlyTerminal implements vscode.Pseudoterminal {
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

// keeps 2 versions of input:
// 1. "condensed" version which all of 2 or more consecutive whitespaces are removed
// 2. "shortened" version which respects the specified maximum boundaries from the settings (not condensed like above)
export class TextHandler {
  private static readonly INTERVAL: number = 30;
  private static _maxDisplayCharacters: number = vscode.workspace.getConfiguration('fastolympiccoding').get('maxDisplayCharacters')!;
  private static _maxDisplayLines: number = vscode.workspace.getConfiguration('fastolympiccoding').get('maxDisplayLines')!;
  private _data: string = '';
  private _shortDataLength: number = 0;
  private _pending: string = '';
  private _spacesCount: number = 0;
  private _newlineCount: number = 0;
  private _lastWrite: number = -Infinity;
  public callback: Function | undefined = undefined;

  get data() {
    return this._data;
  }

  public write(data: string, last: boolean) {
    data = data.replace(/\r\n/g, '\n'); // just avoid \r\n entirely

    // Competitive Companion removes trailing spaces for every line
    for (let i = 0; i < data.length; i++) {
      if (data[i] === ' ') {
        this._spacesCount++;
      } else if (data[i] === '\n') {
        this._data += '\n';
        this._spacesCount = 0;
      } else {
        this._data += ' '.repeat(this._spacesCount);
        this._data += data[i];
        this._spacesCount = 0;
      }
    }
    if (last && this._data.at(-1) !== '\n') {
      this._data += '\n';
    }
    if (this._shortDataLength > TextHandler._maxDisplayCharacters) {
      return;
    }

    for (let i = 0; i < data.length && this._shortDataLength < TextHandler._maxDisplayCharacters && this._newlineCount < TextHandler._maxDisplayLines; i++) {
      if (data[i] === '\n') {
        this._newlineCount++;
      }
      this._shortDataLength++;
      this._pending += data[i];
    }

    const now = Date.now();
    if (now - this._lastWrite < TextHandler.INTERVAL && !last) {
      return;
    }

    this._lastWrite = now;
    if (this._shortDataLength === TextHandler._maxDisplayCharacters || this._newlineCount === TextHandler._maxDisplayLines) {
      this._pending += '...';
      this._shortDataLength = TextHandler._maxDisplayCharacters + 1;
    }
    if (this.callback) {
      this.callback(this._pending);
    }
    this._pending = '';
  }

  public reset() {
    this._data = '';
    this._shortDataLength = 0;
    this._pending = '';
    this._spacesCount = 0;
    this._newlineCount = 0;
    this._lastWrite = -Infinity;
  }
}

export async function getDefaultBuildTaskName() {
  const tasks = await vscode.tasks.fetchTasks();
  for (const task of tasks) {
    if (task.group?.id === vscode.TaskGroup.Build.id && task.group?.isDefault) {
      return task.name;
    }
  }
  return '';
}

export class ReadonlyStringProvider implements vscode.TextDocumentContentProvider {
  public static SCHEME: string = "fastolympiccoding";
  provideTextDocumentContent(uri: vscode.Uri): vscode.ProviderResult<string> {
    return uri.path;
  }
}

export async function replaceAsync(string: string, regexp: RegExp, replacer: Function) {
  const replacements = await Promise.all(Array.from(string.matchAll(regexp), match => replacer(...match.slice(1), match.index, match[0])));
  let i = 0;
  return string.replace(regexp, () => replacements[i++]);
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
    string = await replaceAsync(string, /\${path:(.*?)}/g, async (match: string) => path.normalize(await resolveVariables(match, false, inContextOfFile)));
  } while (recursive && oldString !== string);
  return string;
}

export async function resolveCommand(command: string, inContextOfFile?: string) {
  const args = command.trim().split(' ');
  return await Promise.all(args.map(arg => resolveVariables(arg, false, inContextOfFile)));
}

export async function openInNewEditor(content: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({ content });
  vscode.window.showTextDocument(document);
}