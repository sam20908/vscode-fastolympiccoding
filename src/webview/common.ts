import { Signal } from "@preact/signals";

export interface ITestcase {
    input: Signal<string>;
    stderr: Signal<string>;
    stdout: Signal<string>;
    elapsed: Signal<number>;
    code: Signal<number>;
    acceptedOutput: Signal<string>;
}

export interface ITestcaseState extends ITestcase {
    id: number;
    status: string;
};

export interface IMessage {
    type: string;
    payload?: any;
};

export interface ISettings {
    maxCharactersForOutput: number;
};

export const GREEN_COLOR = '#475B45';
export const RED_COLOR = '#6C4549';
export const BLUE_COLOR = '#4C6179';