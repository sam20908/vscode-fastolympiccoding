import { deepSignal } from "deepsignal";
import { Status, TestcasesMessageType } from "../../common";

// @ts-ignore
export const vscode = acquireVsCodeApi();

export const state = deepSignal<IState[]>([]);
export let idToIndex: number[] = [];

export interface IState {
    stdin: string;
    stderr: string;
    stdout: string;
    acceptedStdout: string;
    elapsed: number;
    status: Status;
    showTestcase: boolean;
    toggled: boolean;
    id: number;
}

export const postMessage = (type: TestcasesMessageType, payload?: any) => {
    vscode.postMessage({ type, payload });
}