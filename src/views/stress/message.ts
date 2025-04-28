import { Status } from "~common/common";

export enum WebviewMessageType {
  STATUS,
  STDIO,
  CLEAR,
  SHOW,
};
export interface IStatusMessage {
  type: WebviewMessageType.STATUS;
  id: number;
  status: Status;
}
export interface IStdioMessage {
  type: WebviewMessageType.STDIO;
  id: number;
  data: string;
}
export interface IClearMessage {
  type: WebviewMessageType.CLEAR;
}
export interface IShowMessage {
  type: WebviewMessageType.SHOW;
  visible: boolean;
}
export type WebviewMessage = IStatusMessage | IStdioMessage | IClearMessage | IShowMessage;

export enum ProviderMessageType {
  LOADED,
  RUN,
  STOP,
  VIEW,
  ADD,
}
export interface ILoadedMessage {
  type: ProviderMessageType.LOADED;
}
export interface IRunMessage {
  type: ProviderMessageType.RUN;
}
export interface IStopMessage {
  type: ProviderMessageType.STOP;
}
export interface IViewMessage {
  type: ProviderMessageType.VIEW;
  id: number;
}
export interface IAddMessage {
  type: ProviderMessageType.ADD;
  id: number;
}
export type ProviderMessage = ILoadedMessage | IRunMessage | IStopMessage | IViewMessage | IAddMessage;