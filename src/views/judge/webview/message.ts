import { ProviderMessage } from "../message";

// @ts-expect-error: acquireVscCodeApi is exposed by VSCode itself
const vscode = acquireVsCodeApi();

export const postMessage = (msg: ProviderMessage) => {
    vscode.postMessage(msg);
}