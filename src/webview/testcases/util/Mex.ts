import { PriorityQueue } from "./PriorityQueue";

export class Mex {
    private _smallestMissing: PriorityQueue<number> = new PriorityQueue((a, b) => a < b);
    private _have: boolean[] = []

    public get(): number {
        return this._smallestMissing.length ? this._smallestMissing.peek() : this._have.length;
    }

    public add(x: number) {
        if (x === this._have.length) {
            this._have.push(true);
        } else {
            this._have[x] = true;
            this._maintainHeapInvariant();
        }
    }

    public remove(x: number): void {
        if (x === this._have.length - 1) {
            this._have[this._have.length - 1] = false;
            while (this._have.length && !this._have[this._have.length - 1]) {
                this._have.pop();
            }
            this._maintainHeapInvariant();
        } else {
            this._have[x] = false;
            this._smallestMissing.push(x);
        }
    }

    private _maintainHeapInvariant(): void {
        while (this._smallestMissing.length && (this._smallestMissing.peek() >= this._have.length || this._have[this._smallestMissing.peek()])) {
            this._smallestMissing.pop();
        }
    }
}