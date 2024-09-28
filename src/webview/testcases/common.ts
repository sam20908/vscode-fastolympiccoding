import { Signal } from "@preact/signals";
import { Status, TestcasesMessageType } from "../../common";

// @ts-ignore
const vscode = acquireVsCodeApi();

export interface IState {
    stdin: Signal<string>;
    stderr: Signal<string>;
    stdout: Signal<string>;
    acceptedStdout: Signal<string>;
    elapsed: number;
    status: Status;
    showTestcase: boolean;
    toggled: boolean;
    id: number;
}

export const postMessage = (type: TestcasesMessageType, payload?: any) => {
    vscode.postMessage({ type, payload });
}