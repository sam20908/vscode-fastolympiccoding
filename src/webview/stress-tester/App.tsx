import { deepSignal } from "deepsignal";
import { useEffect } from "preact/hooks";
import { batch, useComputed } from "@preact/signals";

import FileData from './components/FileData';
import { BLUE_COLOR, IMessage, ISettings, RED_COLOR } from "../common";

interface IFileState<T> {
    generator: T;
    solution: T;
    goodSolution: T;
}

interface IStressTestData {
    data: IFileState<string>;
    code: IFileState<number>;
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
        goodSolution: '',
    },
    code: {
        generator: 0,
        solution: 0,
        goodSolution: 0,

    },
    status: {
        generator: '',
        solution: '',
        goodSolution: '',
    },
};
const state = deepSignal<IState>({ ...initialState });

const postMessage = (type: string, payload?: any) => {
    vscode.postMessage({ type, payload });
}

const saveData = () => {
    postMessage('SAVE', {
        data: {
            generator: state.data.generator,
            solution: state.data.solution,
            goodSolution: state.data.goodSolution,
        },
        code: {
            generator: state.code.generator,
            solution: state.code.solution,
            goodSolution: state.code.goodSolution,
        },
    });
};

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

const handleAddTestcase = (input: string) => {
    postMessage('ADD', { input });
};

const handleStop = () => {
    // don't rely on the provider to send exit messages, as it can ruin the status if clicking start and stop rapidly
    batch(() => {
        state.status.solution = '';
        state.status.goodSolution = '';
        state.status.generator = '';
    });
    postMessage('STOP');
};

const handleViewText = (content: string) => {
    postMessage('VIEW_TEXT', { content });
};

const handleSavedDataMessage = (payload: IStressTestData) => {
    const newState = payload ?? initialState;
    Object.assign(state, newState);
    // assign these manually to trigger update
    batch(() => {
        state.data.solution = newState.data.solution;
        state.data.goodSolution = newState.data.goodSolution;
        state.data.generator = newState.data.generator;
    });
};

const handleStatusMessage = ({ status, from }: { status: string, from: keyof IFileState<string> }) => {
    state.status[from] = status;
};

const handleExitMessage = ({ code, from }: { code: number, from: keyof IFileState<number> }) => {
    batch(() => {
        state.code[from] = code;
        state.status[from] = '';
    });
    saveData();
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
    const button = useComputed(() => {
        if (state.status.generator === 'RUNNING' && state.status.solution === 'RUNNING' && state.status.goodSolution === 'RUNNING')
            return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={handleStop}>stop</button>;
        if (state.status.generator === 'COMPILING' || state.status.solution === 'COMPILING' || state.status.goodSolution === 'COMPILING')
            return <></>;
        return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={handleStressTest}>stress test</button>;
    });

    if (!state.settings) {
        return <></>;
    }

    return <>
        <div class="container mx-auto mb-6">
            <div class="flex flex-row">
                <div class="w-6 shrink-0"></div>
                <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                    {button}
                </div>
            </div>
        </div>
        <FileData settings={state.settings} code={state.code.generator} status={state.status.generator} filetype="Generator" data={state.data.$generator!} onViewText={handleViewText} />
        <FileData settings={state.settings} code={state.code.solution} status={state.status.solution} filetype="Solution" data={state.data.$solution!} onViewText={handleViewText} />
        <FileData settings={state.settings} code={state.code.goodSolution} status={state.status.goodSolution} filetype="Good Solution" data={state.data.$goodSolution!} onViewText={handleViewText} />
        {(state.code.solution === -2) &&
            <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6 shrink-0"></div>
                    <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={() => handleAddTestcase(state.data.generator)}>add testcase</button>
                </div>
            </div>
        }
    </>;
}
