import { batch, useSignal } from '@preact/signals';

import { idToIndex, IState, postMessage, state } from '../common';
import { BLUE_COLOR, GREEN_COLOR, RED_COLOR } from '../../common';
import AutoresizeTextarea from '../../util/components/AutoresizeTextarea';
import { Status, TestcasesMessageType } from '../../../common';

export default function app({ testcase: { stdin, stderr, stdout, acceptedStdout, elapsed, status, showTestcase, toggled, id } }: { testcase: IState }) {
    const toggle = () => postMessage(TestcasesMessageType.TOGGLE, { id });
    const view = (stdin: string) => postMessage(TestcasesMessageType.VIEW, { id, stdin });

    const newStdin = useSignal('');
    const statusItem = (() => {
        if (status === Status.CE)
            return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={toggle}>CE</button>
        if (status === Status.RE)
            return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={toggle}>RE</button>
        if (status === Status.WA)
            return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={toggle}>WA</button>
        if (status === Status.AC)
            return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: GREEN_COLOR }} onClick={toggle}>AC</button>
        return <button class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font" onClick={toggle}>NA</button>
    })();

    const stdinArrowButton =
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1 shrink-0" onClick={() => view('stdin')}>
            <path fill={GREEN_COLOR} fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
        </svg>;
    const stderrArrowButton =
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1 shrink-0" onClick={() => view('stderr')}>
            <path fill={RED_COLOR} fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
        </svg>;
    const stdoutArrowButton =
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1 shrink-0" onClick={() => view('stdout')}>
            <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
        </svg>;

    const stdinElement = <div class="flex flex-row">
        {stdinArrowButton}
        <span class="whitespace-pre-line text-base display-font">{stdin}</span>
    </div>;
    const stderrElement = <div class="flex flex-row">
        {stderrArrowButton}
        <span class="whitespace-pre-line text-base display-font">{stderr}</span>
    </div>;
    const stdoutElement = <div class="flex flex-row">
        {stdoutArrowButton}
        <span class="whitespace-pre-line text-base display-font">{stdout}</span>
    </div>;

    switch (status) {
        case Status.NA:
        case Status.WA:
        case Status.AC:
        case Status.RE:
        case Status.CE:
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6 shrink-0"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        {statusItem}
                        <button class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font" onClick={() => postMessage(TestcasesMessageType.EDIT, { id })}>edit</button>
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={() => {
                            newStdin.value = ''; // may be adding additional inputs, so clear out previous inputs
                            postMessage(TestcasesMessageType.RUN, { id });
                        }}>run</button>
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={() => postMessage(TestcasesMessageType.DELETE, { id })}>delete</button>
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font">{elapsed}ms</p>
                    </div>
                </div>
                {(showTestcase && !(status === Status.AC && !toggled)) &&
                    <>
                        {stdinElement}
                        {stderrElement}
                        {stdoutElement}
                        {(status === Status.WA) &&
                            <div class="flex flex-row">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1 shrink-0">
                                    <path fill={GREEN_COLOR} fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                                </svg>
                                <span class="whitespace-pre-line text-base display-font">{acceptedStdout}</span>
                            </div>
                        }
                        {(status === Status.WA || status === Status.NA) &&
                            <div class="flex flex-row">
                                <div class="w-6 shrink-0"></div>
                                <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: GREEN_COLOR }} onClick={() => postMessage(TestcasesMessageType.ACCEPT, { id })}>accept</button>
                            </div>
                        }
                        {(status === Status.AC) &&
                            <div class="flex flex-row">
                                <div class="w-6 shrink-0"></div>
                                <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={() => postMessage(TestcasesMessageType.DECLINE, { id })}>decline</button>
                            </div>
                        }
                    </>
                }
            </div>;
        case Status.COMPILING:
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6 shrink-0"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font">compiling</p>
                    </div>
                </div>
            </div>;
        case Status.RUNNING:
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6 shrink-0"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={() => postMessage(TestcasesMessageType.STOP, { id })}>stop</button>
                    </div>
                </div>
                {stdinElement}
                <div class="flex flex-row">
                    <div class="w-6 shrink-0"></div>
                    <AutoresizeTextarea input={newStdin} onKeyUp={event => {
                        if (event.key === 'Enter') {
                            postMessage(TestcasesMessageType.STDIN, { id, data: newStdin.value });
                            newStdin.value = '';
                        }
                    }} />
                </div>
                {stderrElement}
                {stdoutElement}
            </div>;
        case Status.EDITING:
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6 shrink-0"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={() => {
                            const data = state[id]!.stdin
                            state[id]!.stdin = ''; // the extension host will send the shortened version
                            postMessage(TestcasesMessageType.SAVE, { id, data });
                        }}>save</button>
                    </div>
                </div>
                <div class="flex flex-row">
                    <div class="w-6 shrink-0"></div>
                    <AutoresizeTextarea input={state[id].$stdin!} onKeyUp={() => { }} />
                </div>
            </div>;
        default:
            return <></>;
    }
}