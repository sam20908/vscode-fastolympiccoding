import vscode from 'vscode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import child_process from 'child_process';

import { ReadonlyTerminal, resolveCommand } from './vscode';

export class Runnable {
  private _process: child_process.ChildProcessWithoutNullStreams | undefined = undefined;
  private _promise: Promise<void> | undefined = undefined;
  private _startTime: number = 0;
  private _endTime: number = 0;
  private _exitCode: number = 0;

  public run(command: string, cwd?: string, ...args: string[]) {
    this._process = child_process.spawn(command, args, { cwd });
    this._process.stdout.setEncoding('utf-8');
    this._process.stderr.setEncoding('utf-8');
    this._promise = new Promise(resolve => {
      this._process!.once('spawn', () => this._startTime = performance.now());
      this._process!.once('error', () => {
        this._startTime = performance.now();
        this._exitCode = -1;
        resolve();
      });
      this._process!.once('close', (code, signal) => {
        this._endTime = performance.now();
        this._exitCode = signal === 'SIGUSR1' ? 0 : (code ?? 1);
        resolve();
      });
    });
  }

  get process() {
    return this._process;
  }
  get promise() {
    return this._promise;
  }
  get elapsed(): number {
    return Math.round(this._endTime - this._startTime);
  }
  get exitCode(): number {
    return this._exitCode;
  }
};

export async function getFileChecksum(file: string): Promise<string> {
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

const errorTerminal: Map<string, vscode.Terminal> = new Map();
const lastCompiled: Map<string, [string, string]> = new Map(); // [file checksum, compile command]
const compilePromise: Map<string, Promise<number>> = new Map();
export async function compile(file: string, compileCommand: string, context: vscode.ExtensionContext): Promise<number> {
  errorTerminal.get(file)?.dispose();

  if (!fs.existsSync(file)) {
    vscode.window.showErrorMessage(`${file} does not exist`);
    return 1;
  }

  const resolvedArgs = await resolveCommand(compileCommand, file);
  const currentCommand = resolvedArgs.join(' ');
  const currentChecksum = await getFileChecksum(file);
  const [cachedChecksum, cachedCommand] = lastCompiled.get(file) ?? [-1, ''];
  if (currentChecksum === cachedChecksum && currentCommand === cachedCommand) {
    return 0; // avoid unnecessary recompilation
  }

  let promise = compilePromise.get(file);
  if (!promise) {
    promise = (async () => {
      const compilationStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10000);
      compilationStatusItem.name = 'Compilation Status';
      compilationStatusItem.text = `$(zap) ${path.basename(file)}`;
      compilationStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      compilationStatusItem.show();
      context.subscriptions.push(compilationStatusItem);

      const process = new Runnable();
      process.run(resolvedArgs[0], undefined, ...resolvedArgs.slice(1));

      let err = '';
      process.process!.stderr.on('data', data => err += data.toString());
      process.process!.on('error', data => err += data.stack);

      await process.promise;
      compilationStatusItem.dispose();
      if (!process.exitCode) {
        lastCompiled.set(file, [currentChecksum, currentCommand]);
        return 0;
      }

      const dummy = new ReadonlyTerminal();
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
      return process.exitCode;
    })();
    compilePromise.set(file, promise);
  }

  const code = await promise;
  compilePromise.delete(file);
  return code;
}