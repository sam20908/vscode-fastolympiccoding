import { ProviderMessage } from "../message";

// @ts-ignore
const vscode = acquireVsCodeApi();

export const postMessage = (msg: ProviderMessage) => {
    vscode.postMessage(msg);
}