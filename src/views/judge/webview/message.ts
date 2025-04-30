import { ProviderMessage } from '../message';

const vscode = acquireVsCodeApi(); // eslint-disable-line

export const postProviderMessage = (msg: ProviderMessage) => {
  vscode.postMessage(msg); // eslint-disable-line
};