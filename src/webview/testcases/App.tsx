import { deepSignal } from 'deepsignal';
import { useEffect } from 'preact/hooks'
import { batch, signal } from '@preact/signals';

import Testcase from './components/Testcase';
import { Mex } from '../util/Mex';
import { IMessage, ITestcase, ITestcaseState, ISettings } from '../common';

interface IState {
    loaded: boolean;
    hasEditor: boolean;
    testcases: ITestcaseState[]
};

// @ts-ignore
const vscode = acquireVsCodeApi();

let running: boolean[] = [];
const mex = new Mex();
const state = deepSignal<IState>({
    loaded: false,
    hasEditor: false,
    testcases: []
});
let settings: ISettings;

const TESTCASE_TEMPLATE: any = {
    input: '',
    stderr: '',
    stdout: '',
    elapsed: 0,
    code: 0,
    acceptedOutput: ''
};
const newTestcaseState = (): ITestcaseState => {
    const newState: any = {};
    for (const [k, v] of Object.entries(TESTCASE_TEMPLATE)) {
        newState[k] = signal(v);
    }
    newState.id = mex.get();
    mex.add(newState.id);
    newState.status = '';
    return newState;
};

const findIndexFromId = (id: number): number => {
    return state.testcases.findIndex(value => value.id === id);
};

const postMessage = (type: string, payload?: any) => {
    vscode.postMessage({ type, payload });
}

const saveTestcases = () => {
    // deepsignal has proxies setup, and those cannot be cloned
    // we create a new array of raw testcase data ourselves

    const testcases: ITestcase[] = [];
    for (const testcase of state.testcases) {
        const copy: any = Object.create(TESTCASE_TEMPLATE);
        for (const key of Object.keys(TESTCASE_TEMPLATE)) {
            (copy[key] as any) = (testcase as any)[key].value;
        }
        testcases.push(copy);
    }
    postMessage('SAVE_TESTCASES', testcases);
};

const handleMessage = (event: MessageEvent) => {
    const message: IMessage = event.data;
    switch (message.type) {
        case 'SAVED_TESTCASES':
            handleSavedTestcasesMessage(message.payload);
            break;
        case 'SETTINGS':
            handleSettingsMessage(message.payload);
            break;
        case 'REQUEST_RUN_ALL':
            handleRunAllTestcases();
            break;
        case 'REQUEST_DELETE_ALL':
            handleDeleteAllTestcases();
            break;
        case 'STATUS':
            handleStatusMessage(message.payload);
            break;
        case 'EXIT':
            handleExitMessage(message.payload);
            break;
        case 'STDOUT':
            updateStdio(message.payload.id, 'stdout', message.payload.data);
            break;
        case 'STDERR':
            updateStdio(message.payload.id, 'stderr', message.payload.data);
            break;
    }
};

const handleNextTestcase = () => {
    state.testcases.push(newTestcaseState());
    running.push(false);
    postMessage('SOURCE_CODE_RUN', { ids: [state.testcases.at(-1)!.id], inputs: [''] });
};

const handleRunAllTestcases = () => {
    const ids: number[] = [];
    const inputs: string[] = [];

    batch(() => {
        for (let i = 0; i < running.length; i++) {
            if (running[i]) {
                continue;
            }

            ids.push(state.testcases[i].id);
            inputs.push(state.testcases[i].input.value);
            state.testcases[i].stdout.value = '';
            state.testcases[i].stderr.value = '';
        }
    });
    postMessage('SOURCE_CODE_RUN', { ids, inputs });
};

const handleDeleteAllTestcases = () => {
    batch(() => {
        for (let i = 0; i < running.length; i++) {
            handleStopTestcase(i, true);
        }
        state.testcases = [];
    });

    running = [];
    postMessage('SAVE_TESTCASES', []);
};

const handleAcceptTestcase = (id: number) => {
    const index = findIndexFromId(id);
    state.testcases[index].acceptedOutput.value = state.testcases[index].stdout.value;
    saveTestcases();
};

const handleEditTestcase = (id: number) => {
    const index = findIndexFromId(id);
    batch(() => {
        state.testcases[index].acceptedOutput.value = '';
        state.testcases[index].code.value = 0;
        state.testcases[index].status = 'EDITING';
    });
};

const handleSaveTestcase = (id: number, input: string) => {
    const index = findIndexFromId(id);
    batch(() => {
        state.testcases[index].input.value = input;
        state.testcases[index].status = '';
    });
    saveTestcases();
};

const handleDeleteTestcase = (id: number, isIndex: boolean) => {
    const index = isIndex ? id : findIndexFromId(id);
    mex.remove(state.testcases[index].id);
    state.testcases.splice(index, 1);
    running.splice(index, 1);
    saveTestcases();
};

const handleRunTestcase = (id: number, isIndex: boolean) => {
    const index = isIndex ? id : findIndexFromId(id);
    if (running[index]) {
        return; // already running
    }

    batch(() => {
        state.testcases[index].stdout.value = '';
        state.testcases[index].stderr.value = '';
    });
    postMessage('SOURCE_CODE_RUN', { ids: [state.testcases[index].id], inputs: [state.testcases[index].input.value] });
};

const handleStopTestcase = (id: number, removeListeners: boolean) => {
    const index = findIndexFromId(id);
    if (running[index]) {
        postMessage('SOURCE_CODE_STOP', { id: state.testcases[index].id, removeListeners });
    }
};

const updateStdio = (payloadId: number, property: keyof ITestcase, data: string) => {
    const index = findIndexFromId(payloadId);
    (state.testcases[index][property].value as string) += data;
};

const handleSavedTestcasesMessage = (payload: any) => {
    state.hasEditor = !!payload;
    state.testcases = payload?.map((value: any): ITestcaseState => {
        const copy: any = newTestcaseState();
        for (const [k, v] of Object.entries(value)) {
            copy[k].value = v;
        }
        return copy;
    }) ?? [];
    running = Array(payload?.length ?? 0).fill(false);
};

const handleSettingsMessage = (_settings: ISettings) => {
    state.loaded = true;
    settings = _settings;
};

const handleStatusMessage = (payload: any) => {
    const { ids, status } = payload;

    batch(() => {
        for (const payloadId of ids) {
            const index = findIndexFromId(payloadId);
            state.testcases[index].status = status;
            if (status === 'RUNNING') {
                running[index] = true;
            }
        }
    });
};

const handleExitMessage = (payload: any) => {
    const { ids, code, elapsed } = payload;

    batch(() => {
        for (const payloadId of ids) {
            const index = findIndexFromId(payloadId);
            state.testcases[index].code.value = code;
            state.testcases[index].elapsed.value = elapsed;
            state.testcases[index].status = '';
            running[index] = false;
        }
    });
    saveTestcases();
};

const handleSendNewInput = (id: number, input: string) => {
    const index = findIndexFromId(id);
    state.testcases[index].input.value += input;
    saveTestcases();
    postMessage('STDIN', { id: state.testcases[index].id, input });
};

const handleViewText = (content: string) => {
    postMessage('VIEW_TEXT', { content });
};

window.addEventListener('message', handleMessage);

export default function App() {
    useEffect(() => postMessage('LOADED'), []);

    if (!state.hasEditor) {
        return <div></div>;
    }
    if (!state.loaded) {
        return <p>Loading...</p>;
    }

    return (
        <>
            {state.testcases.map((_, index) =>
                <Testcase
                    key={state.testcases[index].id}
                    testcase={state.testcases[index]}
                    settings={settings}
                    onAcceptTestcase={handleAcceptTestcase}
                    onEditTestcase={handleEditTestcase}
                    onSaveTestcase={handleSaveTestcase}
                    onDeleteTestcase={handleDeleteTestcase}
                    onRunTestcase={handleRunTestcase}
                    onStopTestcase={handleStopTestcase}
                    onSendNewInput={handleSendNewInput}
                    onViewText={handleViewText}
                />)
            }
            <div class="flex flex-row justify-start gap-x-2 ml-6">
                <button class="text-base leading-tight bg-zinc-600 px-3 font-['Consolas']" onClick={handleNextTestcase}>
                    next test
                </button>
                <button class="text-base leading-tight bg-zinc-600 px-3 font-['Consolas']" style={{ backgroundColor: "#4C6179" }} onClick={handleRunAllTestcases}>
                    run all
                </button>
                <button class="text-base leading-tight bg-zinc-600 px-3 font-['Consolas']" style={{ backgroundColor: "#6C4549" }} onClick={handleDeleteAllTestcases}>
                    delete all
                </button>
            </div>
        </>
    );
}
