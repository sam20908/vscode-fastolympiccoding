import { deepSignal } from "deepsignal";
import { useEffect } from "preact/hooks";
import { Signal, batch, effect, signal, useComputed } from "@preact/signals";

import FileData from './components/FileData';
import { BLUE_COLOR, IMessage, ISettings, RED_COLOR } from "../common";

interface IFileState<T> {
    generator: T;
    solution: T;
    goodSolution: T;
}

interface IState {
    settings?: ISettings;
    data: IFileState<string>;
    code: IFileState<number>;
    status: IFileState<string>;
}

// @ts-ignore
const vscode = acquireVsCodeApi();

const initialState: IState = {
    settings: undefined,
    data: {
        generator: '',
        solution: '',
        goodSolution: ''
    },
    code: {
        generator: 0,
        solution: 0,
        goodSolution: 0

    },
    status: {
        generator: '',
        solution: '',
        goodSolution: ''
    }
};
const state = deepSignal<IState>({ ...initialState });

const postMessage = (type: string, payload?: any) => {
    vscode.postMessage({ type, payload });
}

const handleMessage = (event: MessageEvent) => {
    const message: IMessage = event.data;
    switch (message.type) {
        case 'SAVED_DATA':
            handleSavedDataMessage(message.payload);
            break;
        case 'STATUS':
            handleStatusMessage(message.payload);
            break;
        case 'EXIT':
            handleExitMessage(message.payload);
            break;
        case 'DATA':
            handleDataMessage(message.payload);
            break;
        case 'CLEAR':
            handleClearMessage();
            break;
    }
};

const handleStressTest = () => {
    postMessage('RUN');
};

const handleStop = () => {
    batch(() => {
        state.status.generator = '';
        state.status.solution = '';
        state.status.goodSolution = '';
    });
    postMessage('STOP');
};

const handleViewText = (content: string) => {
    postMessage('VIEW_TEXT', { content });
};

const handleSavedDataMessage = (payload: any) => {
    Object.assign(state, payload ?? initialState);
};

const handleStatusMessage = ({ status, from }: { status: string, from: keyof IFileState<string> }) => {
    state.status[from] = status;
};

const handleExitMessage = ({ code, from }: { code: number, from: keyof IFileState<number> }) => {
    batch(() => {
        state.code[from] = code;
        state.status[from] = '';
    });
};

const handleDataMessage = ({ from, data }: { from: keyof IFileState<string>, data: string }) => {
    state.data[from] += data;
};

const handleClearMessage = () => {
    batch(() => {
        state.data.generator = '';
        state.data.solution = '';
        state.data.goodSolution = '';
    });
};

window.addEventListener('message', handleMessage);

export default function App() {
    useEffect(() => postMessage('LOADED'), []);
    const isRunning = useComputed(() => state.status.generator === 'RUNNING' && state.status.solution === 'RUNNING' && state.status.goodSolution === 'RUNNING');

    if (!state.settings) {
        return <></>;
    }

    return <>
        <div class="container mx-auto mb-6">
            <div class="flex flex-row">
                <div class="w-6"></div>
                <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                    {isRunning.value ?
                        <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }} onClick={handleStop}>stop</button> :
                        <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: BLUE_COLOR }} onClick={handleStressTest}>stress test</button>
                    }
                </div>
            </div>
        </div>
        <FileData settings={state.settings} code={state.code.generator} status={state.status.generator} filetype="Generator" data={state.data.$generator!} onViewText={handleViewText} />
        <FileData settings={state.settings} code={state.code.solution} status={state.status.solution} filetype="Solution" data={state.data.$solution!} onViewText={handleViewText} />
        <FileData settings={state.settings} code={state.code.goodSolution} status={state.status.goodSolution} filetype="Good Solution" data={state.data.$goodSolution!} onViewText={handleViewText} />
    </>;
}
