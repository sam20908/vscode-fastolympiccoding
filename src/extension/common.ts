import * as vscode from 'vscode';

import { RunningProcess } from "./util/runUtil";

export interface ILanguageRunSettings {
    compileCommand?: string;
    runCommand: string;
}

export interface ITestcase {
    stdin: string;
    stderr: string;
    stdout: string;
    elapsed: number;
    status: number;
    acceptedOutput: string;
}

export const lastCompiled: Map<string, [number, string]> = new Map();
export const compileProcess: Map<string, RunningProcess> = new Map();
export const errorTerminal: Map<string, vscode.Terminal> = new Map();