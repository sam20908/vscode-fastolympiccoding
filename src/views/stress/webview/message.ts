import { ProviderMessage } from "../message";

// eslint-disable-next-line
const vscode = acquireVsCodeApi();

export const postProviderMessage = (msg: ProviderMessage) => {
  // eslint-disable-next-line
  vscode.postMessage(msg);
}