import * as child_process from 'child_process';

function executeCommand(commandString: string): [child_process.ChildProcessWithoutNullStreams, Promise<number | null>] {
    const [command, ...args] = commandString.split(' ');
    const process = child_process.spawn(command, args);
    process.stdout.setEncoding('utf-8');
    process.stderr.setEncoding('utf-8');

    return [process, new Promise(resolve => {
        process.on('exit', resolve);
        process.on('error', () => resolve(-1));
    })];
}

export class RunningProcess {
    readonly process: child_process.ChildProcessWithoutNullStreams;
    readonly spawnPromise: Promise<boolean>;
    readonly executionPromise: Promise<number | null>;
    private _startTime: number = 0;
    private _endTime: number | undefined = undefined;

    constructor(commandString: string) {
        const [process, promise] = executeCommand(commandString);
        this.spawnPromise = new Promise(resolve => {
            process.on('spawn', () => {
                this._startTime = Date.now();
                resolve(true);
            });
            process.on('error', () => resolve(false));
        });
        process.on('exit', () => this._endTime = Date.now());
        this.process = process;
        this.executionPromise = promise;
    }

    public getStartTime(): number {
        return this._startTime;
    }

    public getEndTime(): number {
        return this._endTime ?? this._startTime; // process can be forcefully killed
    }
};