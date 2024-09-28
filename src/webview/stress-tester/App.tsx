import { deepSignal } from "deepsignal";
import { useEffect } from "preact/hooks";
import { batch, useComputed } from "@preact/signals";

import FileData from './components/FileData';
import { BLUE_COLOR, RED_COLOR } from "../common";
import { IStressTesterMessage, Status, StressTesterMessageType } from "../../common";

interface IState {
    data: string;
    status: Status;
}

// @ts-ignore
const vscode = acquireVsCodeApi();
const state = deepSignal<IState[]>([{ data: '', status: Status.NA }, { data: '', status: Status.NA }, { data: '', status: Status.NA }]);

const postMessage = (type: StressTesterMessageType, payload?: any) => vscode.postMessage({ type, payload });
const view = (id: number) => postMessage(StressTesterMessageType.VIEW, { id });

window.addEventListener('message', (event: MessageEvent) => {
    const message: IStressTesterMessage = event.data;
    const { type, payload } = message;
    switch (type) {
        case StressTesterMessageType.STATUS:
            {
                const { id, status } = payload;
                state[id].status = status;
            }
            break;
        case StressTesterMessageType.STDIO:
            {
                const { id, data } = payload;
                state[id].data += data;
            }
            break;
        case StressTesterMessageType.CLEAR:
            batch(() => {
                for (let i = 0; i < 3; i++) {
                    state[i].data = '';
                }
            });
            break;
    }
});

export default function App() {
    useEffect(() => postMessage(StressTesterMessageType.LOADED), []);

    const button = useComputed(() => {
        if (state[1].status === Status.RUNNING)
            return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={() => postMessage(StressTesterMessageType.STOP)}>stop</button>;
        if (state[0].status === Status.COMPILING || state[1].status === Status.COMPILING || state[2].status === Status.COMPILING)
            return <></>;
        return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={() => postMessage(StressTesterMessageType.RUN)}>stress test</button>;
    });

    return <>
        <div class="container mx-auto mb-6">
            <div class="flex flex-row">
                <div class="w-6 shrink-0"></div>
                <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                    {button}
                </div>
            </div>
        </div>
        <FileData data={state[0].$data!} status={state[0].status} id={0} onView={view} />
        <FileData data={state[1].$data!} status={state[1].status} id={1} onView={view} />
        <FileData data={state[2].$data!} status={state[2].status} id={2} onView={view} />
        {(state[1].status === Status.WA) &&
            <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6 shrink-0"></div>
                    <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={() => postMessage(StressTesterMessageType.ADD)}>add testcase</button>
                </div>
            </div>
        }
    </>;
}
