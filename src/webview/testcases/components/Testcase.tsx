import { deepSignal } from 'deepsignal'
import AutoresizeTextarea from './AutoresizeTextarea';

interface Props {
    index: number;
    input: string;
    stderr: string;
    stdout: string;
    elapsed: number;
    code: number;
    acceptedOutput: string;
    status: string;
    onAcceptTestcase: (testcase: number) => void;
    onEditTestcase: (testcase: number) => void;
    onSaveTestcase: (testcase: number, input: string) => void;
    onDeleteTestcase: (testcase: number) => void;
    onRunTestcase: (testcase: number) => void;
    onStopTestcase: (testcase: number) => void;
    onSendNewInput: (testcase: number, input: string) => void;
};

const AC_COLOR = '#475B45';
const WA_COLOR = '#6C4549';
const state = deepSignal({ newInput: '' });

const handleKeyUp = (index: number, event: KeyboardEvent, onSendNewInput: Function) => {
    if (event.key === 'Enter') {
        onSendNewInput(index, state.newInput);
        state.newInput = '';
    }
};

export default function App({
    index,
    input,
    stderr,
    stdout,
    elapsed,
    code,
    acceptedOutput,
    status,
    onAcceptTestcase,
    onEditTestcase,
    onSaveTestcase,
    onDeleteTestcase,
    onRunTestcase,
    onStopTestcase,
    onSendNewInput
}: Props) {
    // console.log('testcase ' + index + ' render');
    const output =
        <div>
            <div class="flex flex-row">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                    <path fill={"#AAD94C"} fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                </svg>
                <div class="grow">
                    <span class="text-base" style={{ whiteSpace: "pre-line" }}>{input}</span>
                </div>
            </div>
            {status === 'RUNNING' &&
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <AutoresizeTextarea input={state.$newInput!} onKeyUp={event => handleKeyUp(index, event, onSendNewInput)} />
                </div>
            }
            {stderr !== "" &&
                <div class="flex flex-row">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                        <path fill={"#6C4549"} fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                    </svg>
                    <div class="grow">
                        <span class="text-base" style={{ whiteSpace: "pre-line" }}>{stderr}</span>
                    </div>
                </div>
            }
            <div class="flex flex-row">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                    <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                </svg>
                <div class="grow">
                    <span class="text-base" style={{ whiteSpace: "pre-line" }}>{stdout}</span>
                </div>
            </div>
        </div>;

    if (status === '') {
        return <div class="container mx-auto mb-6">
            <div class="flex flex-row">
                <div class="w-6"></div>
                <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                    <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{
                        backgroundColor: !code ? null : (acceptedOutput !== '' || stdout === acceptedOutput ? AC_COLOR : WA_COLOR)
                    }}>test {index}</p>
                    <button class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" onClick={() => {
                        state.newInput = input;
                        onEditTestcase(index);
                    }}>edit</button>
                    <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: "#4C6179" }} onClick={() => {
                        state.newInput = ''; // may be adding additional inputs, so clear out previous inputs
                        onRunTestcase(index);
                    }}>run</button>
                    <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']">time: {elapsed}ms</p>
                </div>
            </div>
            {(acceptedOutput === '' || stdout !== acceptedOutput) &&
                <div>
                    {output}
                    <div class="flex flex-row">
                        <div class="w-6"></div>
                        <button class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{ backgroundColor: "#475B45" }} onClick={() => onAcceptTestcase(index)}>accept</button>
                    </div>
                </div>
            }
        </div>;
    }

    switch (status) {
        case 'COMPILING':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']">compiling</p>
                    </div>
                </div>
            </div>;
        case 'RUNNING':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']">test {index}</p>
                        <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: "#6C4549" }} onClick={() => onStopTestcase(index)}>stop</button>
                    </div>
                </div>
                {output}
            </div>;
        case 'EDITING':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']">test {index}</p>
                        <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: "#4C6179" }} onClick={() => onSaveTestcase(index, state.newInput)}>save</button>
                        <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: "#6C4549" }} onClick={() => onDeleteTestcase(index)}>delete</button>
                    </div>
                </div>
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <AutoresizeTextarea input={state.$newInput!} onKeyUp={() => { }} />
                </div>
            </div>;
        default:
            return <div></div>;
    }
}