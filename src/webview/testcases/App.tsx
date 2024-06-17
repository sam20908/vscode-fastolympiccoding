import { Shallow, deepSignal, shallow } from 'deepsignal';
import { useEffect } from 'preact/hooks'
import { batch } from '@preact/signals';
import Testcase from './components/Testcase';

// @ts-ignore
const vscode = acquireVsCodeApi();

interface ITestcase {
    input: string;
    stderr: string;
    stdout: string;
    elapsed: number;
    code: number;
    acceptedOutput: string;
}

interface IMessage {
    type: string;
    payload?: any;
};

interface ITestcaseState extends ITestcase {
    status: string;
};

interface IState {
    hasEditor: boolean,
    testcases: ITestcaseState[],
    id: Shallow<number[]>,
    running: Shallow<boolean[]>
};

const state = deepSignal<IState>({
    hasEditor: false,
    testcases: [],
    id: shallow([]),
    running: shallow([])
});
const newTestcase: ITestcase = {
    input: '',
    stderr: '',
    stdout: '',
    elapsed: 0,
    code: 0,
    acceptedOutput: ''
};

const postMessage = (type: string, payload?: any) => {
    vscode.postMessage({ type, payload });
}

const saveTestcases = () => {
    // deepsignal has proxies setup, and those cannot be cloned
    // we create a new array of raw testcase data ourselves

    const testcases: ITestcase[] = [];
    for (const testcase of state.$testcases!.peek()) {
        const obj: any = newTestcase;
        for (const key of Object.keys(newTestcase)) {
            (obj[key] as any) = (testcase as any)[key];
        }
        testcases.push(obj);
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
    state.testcases.push({ ...newTestcase, status: '' });

    const id = Date.now();
    state.id.push(id);
    postMessage('SOURCE_CODE_RUN', { id, input: '' });
};

const handleRunAllTestcases = () => {
    batch(() => {
        for (let i = 0; i < state.id.length; i++) {
            handleRunTestcase(i);
        }
    });
};

const handleDeleteAllTestcases = () => {
    batch(() => {
        for (let i = 0; i < state.id.length; i++) {
            handleStopTestcase(i);
        }
        state.testcases = [];
    });

    state.id = shallow([]);
    postMessage('SAVE_TESTCASES', []);
};

const handleAcceptTestcase = (testcase: number) => {
    batch(() => {
        state.testcases[testcase].acceptedOutput = state.testcases[testcase].stdout;
        state.testcases[testcase].code = 1;
    });
    saveTestcases();
};

const handleEditTestcase = (testcase: number) => {
    batch(() => {
        state.testcases[testcase].acceptedOutput = '';
        state.testcases[testcase].code = 0;
        state.testcases[testcase].status = 'EDITING';
    });
};

const handleSaveTestcase = (testcase: number, input: string) => {
    batch(() => {
        state.testcases[testcase].input = input;
        state.testcases[testcase].status = '';
        saveTestcases();
    });
};

const handleDeleteTestcase = (testcase: number) => {
    state.testcases.splice(testcase, 1);
    state.id.splice(testcase, 1);
    saveTestcases();
};

const handleRunTestcase = (testcase: number) => {
    if (state.running[testcase]) {
        handleStopTestcase(testcase); // already running, stop it first and then rerun
    }

    const id = state.id[testcase] === -1 ? testcase : state.id[testcase]; // re-use existing unique id if possible
    state.id[testcase] = id;
    batch(() => {
        state.testcases[testcase].stdout = '';
        state.testcases[testcase].stderr = '';
    });
    postMessage('SOURCE_CODE_RUN', { id, input: state.testcases[testcase].input });
};

const handleStopTestcase = (testcase: number) => {
    if (state.running[testcase]) {
        postMessage('SOURCE_CODE_STOP', { id: state.id[testcase] });
    }
};

const updateStdio = (id: number, property: keyof ITestcase, message: string) => {
    const testcase = state.id.findIndex(value => value === id);
    (state.testcases[testcase][property] as string) += message;
};

const handleSavedTestcasesMessage = (payload: any) => {
    state.hasEditor = !!payload;
    state.testcases = payload?.map((value: ITestcase): ITestcaseState => {
        return {
            ...value,
            status: ''
        };
    }) ?? [];
    state.id = shallow(Array(payload?.length ?? 0).fill(-1));
    state.running = shallow(Array(payload?.length ?? 0).fill(false));
};

const handleStatusMessage = (payload: any) => {
    const { id, status, startTime } = payload;
    const testcase = state.id.findIndex(value => value === id);

    state.testcases[testcase].status = status;
    if (status === 'RUNNING') {
        state.id[testcase] = startTime; // ID becomes start time of the source code for later events
        state.running[testcase] = true;
    }
};

const handleExitMessage = (payload: any) => {
    const { id, code, elapsed } = payload;
    const testcase = state.id.findIndex(value => value === id);

    batch(() => {
        state.testcases[testcase].code = code;
        state.testcases[testcase].elapsed = elapsed;
        state.testcases[testcase].status = '';
        state.running[testcase] = false;
    });
    saveTestcases();
};

const handleSendNewInput = (testcase: number, input: string) => {
    state.testcases[testcase].input += input;
    saveTestcases();
    postMessage('STDIN', { id: state.id[testcase], input });
};

window.addEventListener('message', handleMessage);

export default function App() {
    useEffect(() => postMessage('REQUEST_TESTCASES'), []);

    if (!state.hasEditor) {
        return <div></div>;
    }

    return (
        <div>
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
        </div>
    );
}