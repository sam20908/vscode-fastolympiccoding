// originally from https://stackoverflow.com/a/42919752

const parent = (i: number) => ((i + 1) >>> 1) - 1;
const left = (i: number) => (i << 1) + 1;
const right = (i: number) => (i + 1) << 1;

export class PriorityQueue<T> {
    private _heap: T[] = [];

    constructor(readonly comparator = (a: T, b: T): boolean => a > b) {
    }

    get length() {
        return this._heap.length;
    }

    public peek(): T {
        return this._heap[0];
    }

    public push(...values: T[]): void {
        values.forEach(value => {
            this._heap.push(value);
            this._siftUp();
        });
    }

    public pop(): void {
        const bottom = length - 1;
        if (bottom > 0) {
            this._swap(0, bottom);
        }
        this._heap.pop();
        this._siftDown();
    }

    private _greater(i: number, j: number): boolean {
        return this.comparator(this._heap[i], this._heap[j]);
    }

    private _swap(i: number, j: number): void {
        [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
    }

    private _siftUp(): void {
        let node = this.length - 1;
        while (node > 0 && this._greater(node, parent(node))) {
            this._swap(node, parent(node));
            node = parent(node);
        }
    }

    private _siftDown(): void {
        let node = 0;
        while ((left(node) < length && this._greater(left(node), node)) || (right(node) < length && this._greater(right(node), node))) {
            let maxChild = (right(node) < length && this._greater(right(node), left(node))) ? right(node) : left(node);
            this._swap(node, maxChild);
            node = maxChild;
        }
    }
}