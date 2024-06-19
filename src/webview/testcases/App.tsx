import { deepSignal } from 'deepsignal';
import { useEffect } from 'preact/hooks'
import { batch, signal } from '@preact/signals';

import Testcase from './components/Testcase';
import { IState, IMessage, ITestcase, ITestcaseState } from './Types';

// @ts-ignore
const vscode = acquireVsCodeApi();

let id: number[] = [];
let running: boolean[] = [];
const state = deepSignal<IState>({
    hasEditor: false,
    testcases: []
});

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
    newState.status = '';
    return newState;
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

    const time = Date.now();
    id.push(time);
    running.push(false);
    postMessage('SOURCE_CODE_RUN', { id: time, input: '' });
};

const handleRunAllTestcases = () => {
    batch(() => {
        for (let i = 0; i < id.length; i++) {
            handleRunTestcase(i);
        }
    });
};

const handleDeleteAllTestcases = () => {
    batch(() => {
        for (let i = 0; i < id.length; i++) {
            handleStopTestcase(i);
        }
        state.testcases = [];
    });

    id = [];
    postMessage('SAVE_TESTCASES', []);
};

const handleAcceptTestcase = (testcase: number) => {
    state.testcases[testcase].acceptedOutput.value = state.testcases[testcase].stdout.value;
    saveTestcases();
};

const handleEditTestcase = (testcase: number) => {
    batch(() => {
        state.testcases[testcase].acceptedOutput.value = '';
        state.testcases[testcase].code.value = 0;
        state.testcases[testcase].status = 'EDITING';
    });
};

const handleSaveTestcase = (testcase: number, input: string) => {
    batch(() => {
        state.testcases[testcase].input.value = input;
        state.testcases[testcase].status = '';
    });
    saveTestcases();
};

const handleDeleteTestcase = (testcase: number) => {
    state.testcases.splice(testcase, 1);
    id.splice(testcase, 1);
    saveTestcases();
};

const handleRunTestcase = (testcase: number) => {
    if (running[testcase]) {
        return; // already running
    }

    batch(() => {
        state.testcases[testcase].stdout.value = '';
        state.testcases[testcase].stderr.value = '';
    });
    postMessage('SOURCE_CODE_RUN', { id: id[testcase], input: state.testcases[testcase].input.value });
};

const handleStopTestcase = (testcase: number) => {
    if (running[testcase]) {
        postMessage('SOURCE_CODE_STOP', { id: id[testcase] });
    }
};

const updateStdio = (payloadId: number, property: keyof ITestcase, message: string) => {
    const testcase = id.findIndex(value => value === payloadId);
    (state.testcases[testcase][property].value as string) += message;
};

const handleSavedTestcasesMessage = (payload: any) => {
    state.hasEditor = !!payload;
    state.testcases = payload?.map((value: any): ITestcaseState => {
        const copy: any = newTestcaseState();
        for (const [k, v] of Object.entries(value)) {
            copy[k].value = v;
        }
        copy.status = '';
        return copy;
    }) ?? [];
    id = Array.from({ length: payload?.length ?? 0 }, (_, i) => i);
    running = Array(payload?.length ?? 0).fill(false);
};

const handleStatusMessage = (payload: any) => {
    const { id: payloadId, status, startTime } = payload;
    const testcase = id.findIndex(value => value === payloadId);

    state.testcases[testcase].status = status;
    if (status === 'RUNNING') {
        id[testcase] = startTime; // ID becomes start time of the source code for later events
        running[testcase] = true;
    }
};

const handleExitMessage = (payload: any) => {
    const { id: payloadId, code, elapsed } = payload;
    const testcase = id.findIndex(value => value === payloadId);

    batch(() => {
        state.testcases[testcase].code.value = code;
        state.testcases[testcase].elapsed.value = elapsed;
        state.testcases[testcase].status = '';
        running[testcase] = false;
    });
    saveTestcases();
};

const handleSendNewInput = (testcase: number, input: string) => {
    state.testcases[testcase].input.value += input;
    saveTestcases();
    postMessage('STDIN', { id: id[testcase], input });
};

window.addEventListener('message', handleMessage);

export default function App() {
    useEffect(() => postMessage('REQUEST_TESTCASES'), []);

    if (!state.hasEditor) {
        return <div></div>;
    }

    return (
        <>
            {state.testcases.map((_, index) =>
                <Testcase
                    index={index}
                    testcase={state.testcases.$![index]}
                    onAcceptTestcase={handleAcceptTestcase}
                    onEditTestcase={handleEditTestcase}
                    onSaveTestcase={handleSaveTestcase}
                    onDeleteTestcase={handleDeleteTestcase}
                    onRunTestcase={handleRunTestcase}
                    onStopTestcase={handleStopTestcase}
                    onSendNewInput={handleSendNewInput}
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