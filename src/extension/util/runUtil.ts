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
            this.process.on('exit', code => { this._endTime = Date.now(); resolve(code ?? 1); });
        });
    }

    get elapsed(): number {
        return this._endTime - this._startTime;
    }
};

export class BatchedSender {
    private static readonly BATCH_MS: number = 30;
    private _lastSent: number = -Infinity;
    private _pending: string = '';

    constructor(public callback?: (data: string) => any) { }

    public send(data: string, force: boolean = false): void {
        const now = Date.now();
        if (!this.callback || now - this._lastSent >= BatchedSender.BATCH_MS || force) {
            this.callback!(this._pending + data);
            this._lastSent = now;
            this._pending = '';
        } else {
            this._pending += data;
        }
    }
}