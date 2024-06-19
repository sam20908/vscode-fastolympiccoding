import * as child_process from 'child_process';

export class RunningProcess {
    readonly process: child_process.ChildProcessWithoutNullStreams;
    readonly promise: Promise<number>;
    private _startTime: number = 0;
    private _endTime: number = 0;

    constructor(commandString: string) {
        const [command, ...args] = commandString.trim().split(' ');
        this.process = child_process.spawn(command, args);
        this.process.stdout.setEncoding('utf-8');
        this.process.stderr.setEncoding('utf-8');
        this.promise = new Promise(resolve => {
            this.process.on('spawn', () => this._startTime = Date.now());
            this.process.on('error', () => resolve(-1));
            this.process.on('exit', code => { this._endTime = Date.now(); resolve(code ?? 0); });
        });
    }

    get elapsed(): number {
        return this._endTime - this._startTime;
    }
};