import { ITestcase, Stdio } from '~common/common';

export enum Action {
  RUN,
  STOP,
  DELETE,
  EDIT,
  ACCEPT,
  DECLINE,
  TOGGLE_VISIBILITY,
  TOGGLE_SKIP,
  VIEW_DIFF,
}

export enum ProviderMessageType {
  LOADED,
  NEXT,
  ACTION,
  SAVE,
  VIEW,
  STDIN,
}
export interface ILoadedMessage {
  type: ProviderMessageType.LOADED;
}
export interface INextMessage {
  type: ProviderMessageType.NEXT;
}
export interface IActionMessage {
  type: ProviderMessageType.ACTION;
  id: number;
  action: Action;
}
export interface ISaveMessage {
  type: ProviderMessageType.SAVE;
  id: number;
  stdin: string;
  acceptedStdout: string;
}
export interface IViewMessage {
  type: ProviderMessageType.VIEW;
  id: number;
  stdio: Stdio;
}
export interface IStdinMessage {
  type: ProviderMessageType.STDIN;
  id: number;
  data: string;
}
export type ProviderMessage = ILoadedMessage | INextMessage | IActionMessage | ISaveMessage | IViewMessage | IStdinMessage;

export enum WebviewMessageType {
  NEW,
  SET,
  STDIO,
  DELETE,
  SHOW,
}
export interface INewMessage {
  type: WebviewMessageType.NEW;
  id: number;
}
export interface ISetMessage {
  type: WebviewMessageType.SET;
  id: number;
  property: keyof ITestcase
  value: unknown
}
export interface IStdioMessage {
  type: WebviewMessageType.STDIO;
  id: number;
  stdio: Stdio;
  data: string;
}
export interface IDeleteMessage {
  type: WebviewMessageType.DELETE;
  id: number;
}
export interface IShowMessage {
  type: WebviewMessageType.SHOW;
  visible: boolean;
}
export type WebviewMessage = INewMessage | ISetMessage | IStdioMessage | IDeleteMessage | IShowMessage;