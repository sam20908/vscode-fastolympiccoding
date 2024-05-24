import * as child_process from 'child_process';

function executeCommand(commandString: string): [child_process.ChildProcessWithoutNullStreams, Promise<number>] {
    const [command, ...args] = commandString.split(' ');
    const process = child_process.spawn(command, args);
    process.stdout.setEncoding('utf-8');
    process.stderr.setEncoding('utf-8');

    return [process, new Promise(resolve => {
        process.on('exit', code => resolve(code ?? 0));
    })];
}

export class RunningProcess {
    readonly process: child_process.ChildProcessWithoutNullStreams;
    readonly spawnPromise: Promise<void>;
    readonly executionPromise: Promise<number>;
    private _startTime: number = 0;
    private _endTime: number = 0;

    constructor(commandString: string) {
        const [process, promise] = executeCommand(commandString);
        this.spawnPromise = new Promise(resolve => process.on('spawn', () => {
            this._startTime = Date.now();
            resolve();
        }));
        process.on('exit', () => this._endTime = Date.now());
        this.process = process;
        this.executionPromise = promise;
    }

    public getStartTime(): number {
        return this._startTime;
    }

    public getEndTime(): number {
        return this._endTime;
    }
};