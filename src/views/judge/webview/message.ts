import { ProviderMessage } from '../message';

const vscode = acquireVsCodeApi();

export const postProviderMessage = (msg: ProviderMessage) => {
  vscode.postMessage(msg);
};