export interface ITestcase {
    stdin: string;
    stderr: string;
    stdout: string;
    elapsed: number;
    code: number;
    acceptedOutput: string;
    showTestcaseOnAccepted: boolean;
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
    maxDisplayCharacters: number;
};

export const GREEN_COLOR = '#475B45';
export const RED_COLOR = '#6C4549';
export const BLUE_COLOR = '#4C6179';