export enum Status {
    CE,
    RE,
    WA,
    AC,
    NA,
    COMPILING,
    RUNNING,
    EDITING,
}

export enum Stdio {
    STDIN,
    STDERR,
    STDOUT,
    ACCEPTED_STDOUT,
}

export enum TestcasesMessageType {
    // sent by extension host
    NEW_EMPTY_TESTCASE,
    SET_STATUS,
    APPEND_STDIO,
    SET_VISIBILITY,
    SET_SKIP,
    FULL_STDIN,
    CLEAR_OUTPUTS,
    CLEAR_TESTCASES,
    DELETE_TESTCASE,
    SET_WEBVIEW_VISIBILITY,
    // sent by webview
    LOADED,
    NEXT_TESTCASE,
    RUN,
    STOP,
    DELETE,
    EDIT,
    TOGGLE_VISIBILITY,
    SAVE,
    ACCEPT,
    DECLINE,
    TOGGLE_SKIP,
    VIEW_TEXT,
    STDIN,
    DIFF,
}

export enum StressTesterMessageType {
    // sent by extension host
    STATUS,
    STDIO,
    CLEAR,
    TOGGLE_VIEW,
    // sent by webview
    LOADED,
    RUN,
    STOP,
    VIEW,
    ADD,
}

export interface IMessage<T> {
    type: T;
    payload?: any;
}

export interface ITestcasesMessage extends IMessage<TestcasesMessageType> { }
export interface IStressTesterMessage extends IMessage<StressTesterMessageType> { }