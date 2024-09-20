import { deepSignal } from 'deepsignal';
import { useEffect } from 'preact/hooks'
import { batch } from '@preact/signals';

import Testcase from './components/Testcase';
import { Mex } from '../util/Mex';
import { IMessage, ITestcase, ITestcaseState, ISettings, BLUE_COLOR, RED_COLOR } from '../common';

interface IState {
    settings?: ISettings;
    testcases: ITestcaseState[]
};

// @ts-ignore
const vscode = acquireVsCodeApi();

const mex = new Mex();
const initialState: IState = {
    settings: undefined,
    testcases: []
};
const state = deepSignal<IState>({ ...initialState });

const findIndexFromId = (id: number): number => {
    return state.testcases.findIndex(value => value.id === id);
};

const isRunning = (index: number): boolean => {
    return ['COMPILING', 'RUNNING'].indexOf(state.testcases[index].status) > -1;
};

const postMessage = (type: string, payload?: any) => {
    vscode.postMessage({ type, payload });
}

const saveTestcases = () => {
    const testcases: ITestcase[] = [];
    for (const testcase of state.testcases) {
        testcases.push({
            stdin: testcase.stdin,
            stdout: testcase.stdout,
            stderr: testcase.stderr,
            code: testcase.code,
            elapsed: testcase.elapsed,
            acceptedOutput: testcase.acceptedOutput,
            showTestcase: testcase.showTestcase,
        });
    }
    postMessage('SAVE', { testcases });
};

const handleMessage = (event: MessageEvent) => {
    const message: IMessage = event.data;
    switch (message.type) {
        case 'SAVED_DATA':
            handleSavedDataMessage(message.payload);
            break;
        case 'RUN_ALL':
            handleRunAllTestcasesMessage();
            break;
        case 'DELETE_ALL':
            handleDeleteAllTestcasesMessage();
            break;
        case 'STATUS':
            handleStatusMessage(message.payload);
            break;
        case 'EXIT':
            handleExitMessage(message.payload);
            break;
        case 'STDOUT':
            handleOutputMessage(message.payload.id, 'stdout', message.payload.data);
            break;
        case 'STDERR':
            handleOutputMessage(message.payload.id, 'stderr', message.payload.data);
            break;
    }
};

const handleNextTestcase = () => {
    const newId = mex.get();
    mex.add(newId);
    state.testcases.push({
        stdin: '',
        stdout: '',
        stderr: '',
        elapsed: 0,
        code: 0,
        acceptedOutput: '',
        showTestcase: true,
        id: newId,
        status: '',
    });
    postMessage('RUN', { id: newId, stdin: '' });
};

const handleRunAllTestcasesMessage = () => {
    batch(() => {
        for (let i = 0; i < state.testcases.length; i++) {
            if (!isRunning(i)) {
                handleRunTestcase(i, true);
            }
        }
    });
};

const handleDeleteAllTestcasesMessage = () => {
    batch(() => {
        for (let i = 0; i < state.testcases.length; i++) {
            handleStopTestcase(i, true, true);
        }
        state.testcases = [];
    });

    postMessage('SAVE', { testcases: [] });
};

const handleAcceptTestcase = (id: number) => {
    const index = findIndexFromId(id);
    state.testcases[index].acceptedOutput = state.testcases[index].stdout;
    saveTestcases();
};

const handleEditTestcase = (id: number) => {
    const index = findIndexFromId(id);
    batch(() => {
        state.testcases[index].acceptedOutput = '';
        state.testcases[index].code = 0;
        state.testcases[index].status = 'EDITING';
    });
};

const handleSaveTestcase = (id: number, stdin: string) => {
    const index = findIndexFromId(id);
    batch(() => {
        state.testcases[index].stdin = stdin;
        state.testcases[index].status = '';
    });
    saveTestcases();
};

const handleDeleteTestcase = (id: number, isIndex: boolean) => {
    const index = isIndex ? id : findIndexFromId(id);
    mex.remove(state.testcases[index].id);
    state.testcases.splice(index, 1);
    saveTestcases();
};

const handleRunTestcase = (id: number, isIndex: boolean) => {
    const index = isIndex ? id : findIndexFromId(id);
    if (isRunning(index)) {
        return;
    }

    batch(() => {
        state.testcases[index].stdout = '';
        state.testcases[index].stderr = '';
    });
    postMessage('RUN', { id: state.testcases[index].id, stdin: state.testcases[index].stdin });
};

const handleStopTestcase = (id: number, isIndex: boolean, removeListeners: boolean) => {
    const index = isIndex ? id : findIndexFromId(id);
    if (isRunning(index)) {
        postMessage('STOP', { id: state.testcases[index].id, removeListeners });
    }
};

const handleToggleACVisibilityTestcase = (id: number) => {
    const index = findIndexFromId(id);
    state.testcases[index].showTestcase = !state.testcases[index].showTestcase;
};

const handleOutputMessage = (payloadId: number, property: keyof ITestcase, data: string) => {
    const index = findIndexFromId(payloadId);
    for (let i = 0; i < data.length; i++) {
        // default to newline when there's empty string to trick algorithm to avoid adding whitespace at beginning
        const lastChar = (state.testcases[index][property] as string).at(-1) ?? '\n';
        if (data[i] === ' ') {
            if (lastChar !== ' ' && lastChar !== '\n') {
                (state.testcases[index][property] as string) += ' ';
            }
        } else if (data[i] === '\n') {
            if (lastChar === ' ') {
                (state.testcases[index][property] as string) = (state.testcases[index][property] as string).slice(0, -1) + '\n';
            } else if (lastChar !== '\n') {
                (state.testcases[index][property] as string) += '\n';
            }
        } else {
            (state.testcases[index][property] as string) += data[i]
        }
    }
};

const handleSavedDataMessage = (payload?: any) => {
    const newState = payload ?? initialState;
    const testcases = newState.testcases.map((value: ITestcase) => {
        const newId = mex.get();
        mex.add(newId);
        return { ...value, id: newId, status: '' };
    });
    Object.assign(state, { ...newState, testcases });
};

const handleStatusMessage = (payload: any) => {
    const { id, status } = payload;
    const index = findIndexFromId(id);
    state.testcases[index].status = status;
};

const handleExitMessage = (payload: any) => {
    const { id, code, elapsed } = payload;
    const index = findIndexFromId(id);

    batch(() => {
        state.testcases[index].code = code;
        state.testcases[index].elapsed = elapsed;
        state.testcases[index].status = '';
    });
    saveTestcases();
};

const handleSendStdin = (id: number, stdin: string) => {
    const index = findIndexFromId(id);
    state.testcases[index].stdin += stdin;
    saveTestcases();
    postMessage('STDIN', { id: state.testcases[index].id, stdin });
};

const handleViewText = (content: string) => {
    postMessage('VIEW_TEXT', { content });
};

window.addEventListener('message', handleMessage);

export default function App() {
    useEffect(() => postMessage('LOADED'), []);

    if (!state.settings) {
        return <div></div>;
    }

    return <>
        {state.testcases.map(value =>
            <Testcase
                key={value.id}
                stdin={value.$stdin!}
                stdout={value.$stdout!}
                stderr={value.$stderr!}
                elapsed={value.elapsed}
                code={value.code}
                acceptedOutput={value.$acceptedOutput!}
                showTestcase={value.$showTestcase!}
                id={value.id}
                status={value.status}
                settings={state.settings!}
                onAcceptTestcase={handleAcceptTestcase}
                onEditTestcase={handleEditTestcase}
                onSaveTestcase={handleSaveTestcase}
                onDeleteTestcase={handleDeleteTestcase}
                onRunTestcase={handleRunTestcase}
                onStopTestcase={handleStopTestcase}
                onToggleACVisibilityTestcase={handleToggleACVisibilityTestcase}
                onSendStdin={handleSendStdin}
                onViewText={handleViewText}
            />)
        }
        <div class="flex flex-row justify-start gap-x-2 ml-6">
            <button class="text-base leading-tight bg-zinc-600 px-3 shrink-0 display-font" onClick={handleNextTestcase}>
                next test
            </button>
            <button class="text-base leading-tight bg-zinc-600 px-3 shrink-0 display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={handleRunAllTestcasesMessage}>
                run all
            </button>
            <button class="text-base leading-tight bg-zinc-600 px-3 shrink-0 display-font" style={{ backgroundColor: RED_COLOR }} onClick={handleDeleteAllTestcasesMessage}>
                delete all
            </button>
        </div>
    </>;
}
