import { deepSignal } from 'deepsignal';
import { useEffect } from 'preact/hooks'
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

interface IState {
    hasEditor: boolean,
    testcases: ITestcase[],
    statuses: string[],
};

const state = deepSignal<IState>({
    hasEditor: false,
    testcases: [],
    statuses: []
});
const newTestcase: ITestcase = {
    input: '',
    stderr: '',
    stdout: '',
    elapsed: 0,
    code: 0,
    acceptedOutput: ''
};
let testcaseId: number[] = [];

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

    state.testcases.push(newTestcase);
    state.statuses.push('');

    const id = Date.now();
    testcaseId.push(id);
    postMessage('SOURCE_CODE_RUN', { id, input: '' });
};

const handleRunAllTestcases = () => {
    for (let i = 0; i < testcaseId.length; i++) {
        handleRunTestcase(i);
    }
};

const handleDeleteAllTestcases = () => {
    for (let i = 0; i < testcaseId.length; i++) {
        handleStopTestcase(i);
    }

    state.testcases.length = 0;
    state.statuses.length = 0;
    testcaseId.length = 0;
    postMessage('SAVE_TESTCASES', []);
};

const handleAcceptTestcase = (testcase: number) => {
    console.log('accepting test ' + testcase);
    state.testcases[testcase].acceptedOutput = state.testcases[testcase].stdout;
    state.testcases[testcase].code = 1;
    saveTestcases();
};

const handleEditTestcase = (testcase: number) => {
    state.testcases[testcase].acceptedOutput = '';
    state.testcases[testcase].code = 0;
    state.statuses[testcase] = 'EDITING';
};

const handleSaveTestcase = (testcase: number, input: string) => {
    state.testcases[testcase].input = input;
    state.statuses[testcase] = '';
    saveTestcases();
};

const handleDeleteTestcase = (testcase: number) => {
    state.testcases.splice(testcase, 1);
    state.statuses.splice(testcase, 1);
    testcaseId.splice(testcase, 1);
    saveTestcases();
};

const handleRunTestcase = (testcase: number) => {
    if (testcaseId[testcase] !== -1) {
        handleStopTestcase(testcase); // already running, stop it first and then rerun
    }

    const id = testcaseId[testcase] === -1 ? testcase : testcaseId[testcase]; // re-use existing unique id if possible
    testcaseId[testcase] = id;
    state.testcases[testcase].stdout = '';
    state.testcases[testcase].stderr = '';
    postMessage('SOURCE_CODE_RUN', { id, input: state.testcases[testcase].input });
};

const handleStopTestcase = (testcase: number) => {
    if (testcaseId[testcase] !== -1) {
        postMessage('SOURCE_CODE_STOP', { id: testcaseId[testcase] });
    }
};

const updateStdio = (id: number, property: keyof ITestcase, message: string) => {
    const testcase = testcaseId.findIndex(value => value === id);
    (state.testcases[testcase][property] as string) += message;
};

const handleSavedTestcasesMessage = (payload: any) => {
    state.hasEditor = !!payload;
    state.testcases = payload;
    state.statuses = payload ? Array(payload.length).fill('') : [];
    testcaseId = payload ? Array(payload.length).fill(-1) : [];
};

const handleStatusMessage = (payload: any) => {
    const { id, status, startTime } = payload;
    const testcase = testcaseId.findIndex(value => value === id);

    state.statuses[testcase] = status;
    if (status === 'RUNNING') {
        testcaseId[testcase] = startTime; // ID becomes start time of the source code for later events
    }
};

const handleExitMessage = (payload: any) => {
    const { id, code, elapsed } = payload;
    const testcase = testcaseId.findIndex(value => value === id);

    state.testcases[testcase].code = code;
    state.testcases[testcase].elapsed = elapsed;
    saveTestcases();

    state.statuses[testcase] = '';
    testcaseId[testcase] = -1;
};

const handleSendNewInput = (testcase: number, input: string) => {
    state.testcases[testcase].input += input;
    saveTestcases();
    postMessage('STDIN', { id: testcaseId[testcase], input });
};

window.addEventListener('message', handleMessage);

export default function App() {
    useEffect(() => postMessage('REQUEST_TESTCASES'), []);
    // console.log('app render');

    if (!state.hasEditor) {
        return <div></div>;
    }

    return (
        <div>
            {state.testcases.map(({ input, stderr, stdout, elapsed, code, acceptedOutput }, index) =>
                <Testcase
                    index={index}
                    input={input}
                    stderr={stderr}
                    stdout={stdout}
                    elapsed={elapsed}
                    code={code}
                    status={state.statuses[index]}
                    acceptedOutput={acceptedOutput}
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