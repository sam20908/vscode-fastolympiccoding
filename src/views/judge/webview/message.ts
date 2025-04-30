import { ProviderMessage } from "../message";

const vscode = acquireVsCodeApi();

export const postMessage = (msg: ProviderMessage) => {
    vscode.postMessage(msg);
}