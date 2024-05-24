import React, { useEffect, useRef, useState } from "preact/compat";
import useEventListener from '../hooks/useEventListener';

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

function postMessage(type: string, payload?: any) {
    vscode.postMessage({ type, payload });
}

export default function App() {
    const [testcases, setTestcases] = useState<ITestcase[] | undefined>(undefined);
    const [statuses, setStatuses] = useState<string[]>([]);
    const testcaseId = useRef<number[]>([]);
    const running = useRef<boolean[]>([]);

    const updateStdio = (id: number, property: keyof ITestcase, message: string) => {
        const testcase = testcaseId.current.findIndex(value => value === id);

        setTestcases(prevTestcases => prevTestcases?.map((value, index) => index === testcase ? {
            ...value,
            [property]: value[property] + message
        } : value));
    };

    const handleMessage = event => {
        const message: IMessage = event.data;
        switch (message.type) {
            case 'SAVED_TESTCASES': {
                const savedTestcases = message.payload;
                setTestcases(savedTestcases);
                setStatuses(savedTestcases ? Array(savedTestcases.length).fill('') : []);
                testcaseId.current = savedTestcases ? [...Array(savedTestcases.length).keys()] : [];
                running.current = savedTestcases ? [...Array(savedTestcases.length).fill(false)] : [];
                break;
            }
            case 'REQUEST_RUN_ALL':
                handleRunAllTestcases();
                break;
            case 'REQUEST_DELETE_ALL':
                handleDeleteAllTestcases();
                break;
            case 'STATUS': {
                const { id, status, startTime } = message.payload;
                const testcase = testcaseId.current.findIndex(value => value === id);

                setStatuses(prevStatuses => prevStatuses.map((value, index) => index === testcase ? status : value));

                if (status === 'RUNNING') {
                    testcaseId.current[testcase] = startTime; // ID becomes start time of the source code for later events
                }
                break;
            }
            case 'EXIT': {
                const { id, code, elapsed } = message.payload;
                const testcase = testcaseId.current.findIndex(value => value === id);

                setTestcases(prevTestcases => {
                    const newTestcases = prevTestcases!.slice();
                    newTestcases[testcase].code = code;
                    newTestcases[testcase].elapsed = elapsed;
                    postMessage('SAVE_TESTCASES', newTestcases);
                    return newTestcases;
                });
                setStatuses(prevStatuses => prevStatuses.map((value, index) => index === testcase ? '' : value));

                running.current[testcase] = false;

                break;
            }
            case 'STDOUT':
                updateStdio(message.payload.id, 'stdout', message.payload.data);
                break;
            case 'STDERR':
                updateStdio(message.payload.id, 'stderr', message.payload.data);
                break;
        }
    };

    const handleNextTestcase = () => {
        const newTestcase: ITestcase = {
            input: '',
            stderr: '',
            stdout: '',
            elapsed: 0,
            code: 0,
            acceptedOutput: ''
        };
        setTestcases([...testcases ?? [], newTestcase]);
        setStatuses([...statuses, '']);

        const id = Date.now();
        testcaseId.current.push(id);
        postMessage('SOURCE_CODE_RUN', { id, input: '' });
    };

    const handleRunAllTestcases = () => {
        for (let i = 0; i < (testcases?.length ?? 0); i++) {
            handleRunTestcase(i);
        }
    };

    const handleDeleteAllTestcases = () => {
        setTestcases(() => []);
        setStatuses(() => []);
        testcaseId.current = [];
        running.current = [];
        postMessage('SAVE_TESTCASES', []);
    };

    const handleAcceptTestcase = testcase => {
        setTestcases(prevTestcases => {
            const newTestcases = prevTestcases!.slice();
            newTestcases[testcase].acceptedOutput = newTestcases[testcase].stdout;
            newTestcases[testcase].code = 1;
            postMessage('SAVE_TESTCASES', newTestcases);
            return newTestcases;
        });
    };

    const handleEditTestcase = testcase => {
        setStatuses(prevStatuses => prevStatuses.map((value, index) => index === testcase ? 'EDITING' : value));
        setTestcases(prevTestcases => prevTestcases?.map((value, index) => index === testcase ? {
            ...value,
            code: 0,
            acceptedOutput: ''
        } : value));

        return testcases![testcase].input;
    };

    const handleSaveTestcase = (testcase, input) => {
        setStatuses(prevStatuses => prevStatuses.map((value, index) => index === testcase ? '' : value));
        setTestcases(prevTestcases => {
            const newTestcases = prevTestcases!;
            newTestcases[testcase].input = input;
            postMessage('SAVE_TESTCASES', newTestcases);
            return newTestcases;
        });
    };

    const handleDeleteTestcase = testcase => {
        setStatuses(prevStatuses => [...prevStatuses.slice(0, testcase), ...prevStatuses.slice(testcase + 1)]);
        setTestcases(prevTestcases => {
            const newTestcases = [...prevTestcases!.slice(0, testcase), ...prevTestcases!.slice(testcase + 1)];
            postMessage('SAVE_TESTCASES', newTestcases);
            return newTestcases;
        });

        testcaseId.current.splice(testcase, 1);
        running.current.splice(testcase, 1);
    };

    const handleRunTestcase = testcase => {
        if (running.current[testcase]) {
            return;
        }

        // setTestcases(prevTestcases => prevTestcases?.map((value, index) => index === testcase ? {
        //     ...value,
        //     stderr: '',
        //     stdout: ''
        // } : value));
        setTestcases(prevTestcases => {
            const newTestcases = prevTestcases!.slice();
            newTestcases[testcase].stdout = '';
            newTestcases[testcase].stderr = '';
            postMessage('SOURCE_CODE_RUN', { id: testcaseId.current[testcase], input: prevTestcases![testcase].input });
            return newTestcases;
        });

        running.current[testcase] = true;
    };

    const handleStopTestcase = testcase => {
        postMessage('SOURCE_CODE_STOP', { id: testcaseId.current[testcase] });
    };

    const handleSendNewInput = (testcase: number, input: string) => {
        setTestcases(prevTestcases => {
            const newTestcases = prevTestcases!.slice();
            newTestcases[testcase].input += input;
            postMessage('SAVE_TESTCASES', newTestcases);
            return newTestcases;
        });

        postMessage('STDIN', { id: testcaseId.current[testcase], input });
    };

    useEventListener('message', handleMessage);
    useEffect(() => {
        postMessage('REQUEST_TESTCASES');
    }, []);

    if (!testcases) {
        return <div></div>;
    }

    return (
        <div>
            {testcases.map(({ input, stderr, stdout, elapsed, code, acceptedOutput }, index) =>
                <Testcase
                    index={index}
                    input={input}
                    stderr={stderr}
                    stdout={stdout}
                    elapsed={elapsed}
                    code={code}
                    status={statuses[index]}
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