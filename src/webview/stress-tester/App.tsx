import { deepSignal } from "deepsignal";
import { useEffect } from "preact/hooks";
import { Signal, batch, signal, useComputed } from "@preact/signals";

import TruncatedText from "../util/components/TruncatedText";
import { Mex } from '../util/Mex';
import { BLUE_COLOR, RED_COLOR, IMessage, ISettings, IStressTestData, IStressTestDataState } from "../common";

interface IState {
    loaded: boolean;
    hasEditor: boolean;
    input: Signal<string>;
    stdout: Signal<string>;
    goodStdout: Signal<string>;
    code: number;
    status: string;
    data: IStressTestDataState[]
};

// @ts-ignore
const vscode = acquireVsCodeApi();

const mex = new Mex();
const state = deepSignal<IState>({
    loaded: false,
    hasEditor: false,
    input: signal(''),
    stdout: signal(''),
    goodStdout: signal(''),
    code: 0,
    status: '',
    data: []
});
let settings: ISettings;

const postMessage = (type: string, payload?: any) => {
    vscode.postMessage({ type, payload });
}

const handleMessage = (event: MessageEvent) => {
    const message: IMessage = event.data;
    switch (message.type) {
        case 'SAVED_DATA':
            handleSavedDataMessage(message.payload);
            break;
        case 'SETTINGS':
            handleSettingsMessage(message.payload);
            break;
        case 'STATUS':
            handleStatusMessage(message.payload);
            break;
        case 'EXIT':
            handleExitMessage(message.payload);
            break;
    }
};

const handleStressTest = () => {
    postMessage('STRESS_TEST');
};

const handleViewText = (data: string) => {

};

const handleSavedDataMessage = (data: IStressTestData) => {
    const newId = mex.get();
    mex.add(newId);
    state.data.push({ ...data, id: newId });
};

const handleSettingsMessage = (_settings: ISettings) => {
    state.loaded = true;
    settings = _settings;
};

const handleStatusMessage = ({ status }: { status: string }) => {
    state.status = status;
};

const handleExitMessage = ({ code }: { code: number }) => {
    batch(() => {
        state.code = code;
        state.status = '';
    });
};

window.addEventListener('message', handleMessage);

export default function App() {
    useEffect(() => postMessage('LOADED'), []);
    const statusItem = useComputed(() => {
        if (state.code === -1)
            return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }}>CTE</p>
        if (state.code)
            return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }}>RTE</p>
        return <></>;
    });

    switch (state.status) {
        case '':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        {statusItem}
                        <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: BLUE_COLOR }} onClick={handleStressTest}>stress test</button>
                    </div>
                </div>
            </div>;
        case 'COMPILING':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']">compiling</p>
                    </div>
                </div>
            </div>;
        default:
            return <>
                <div class="flex flex-row">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                        <path fill={"#AAD94C"} fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                    </svg>
                    <div class="grow">
                        <span class="text-base" style={{ whiteSpace: "pre-line" }}>{state.input}</span>
                    </div>
                </div>
                <div class="flex flex-row">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                        <path fill={RED_COLOR} fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                    </svg>
                    <div class="grow">
                        <TruncatedText maxLength={settings.maxCharactersForOutput} text={state.stdout} onViewText={handleViewText} />
                    </div>
                </div>
                <div class="flex flex-row">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                        <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                    </svg>
                    <div class="grow">
                        <TruncatedText maxLength={settings.maxCharactersForOutput} text={state.goodStdout} onViewText={handleViewText} />
                    </div>
                </div>
            </>;
    }
}
