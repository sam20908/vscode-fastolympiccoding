export class Mutex {
    private _current: Promise<void> = Promise.resolve();

    public lock(): Promise<() => void> {
        let resolver: () => void;
        const promise = new Promise<void>(resolve => resolver = () => resolve());
        const currentResolver = this._current.then(() => resolver);
        this._current = promise;
        return currentResolver;
    }
}