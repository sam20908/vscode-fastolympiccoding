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

export interface IState {
    hasEditor: boolean,
    testcases: ITestcaseState[]
};