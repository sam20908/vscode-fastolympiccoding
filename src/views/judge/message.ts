import type { ITestcase, Stdio } from '~common/common';

export enum Action {
	RUN = 0,
	STOP = 1,
	DELETE = 2,
	EDIT = 3,
	ACCEPT = 4,
	DECLINE = 5,
	TOGGLE_VISIBILITY = 6,
	TOGGLE_SKIP = 7,
	VIEW_DIFF = 8,
}

export enum ProviderMessageType {
	LOADED = 0,
	NEXT = 1,
	ACTION = 2,
	SAVE = 3,
	VIEW = 4,
	STDIN = 5,
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
export type ProviderMessage =
	| ILoadedMessage
	| INextMessage
	| IActionMessage
	| ISaveMessage
	| IViewMessage
	| IStdinMessage;

export enum WebviewMessageType {
	NEW = 0,
	SET = 1,
	STDIO = 2,
	DELETE = 3,
	SHOW = 4,
}
export interface INewMessage {
	type: WebviewMessageType.NEW;
	id: number;
}
export interface ISetMessage {
	type: WebviewMessageType.SET;
	id: number;
	property: keyof ITestcase;
	value: unknown;
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
export type WebviewMessage =
	| INewMessage
	| ISetMessage
	| IStdioMessage
	| IDeleteMessage
	| IShowMessage;
