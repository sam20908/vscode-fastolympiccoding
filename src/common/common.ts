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

export interface ITestcase {
    stdin: string;
    stderr: string;
    stdout: string;
    acceptedStdout: string;
    elapsed: number;
    status: Status;
    shown: boolean;
    toggled: boolean;
    skipped: boolean;
}