import { useComputed, useSignal } from '@preact/signals';

import { ITestcase, Status, Stdio } from '~common/common';
import AutoresizeTextarea from './AutoresizeTextarea';
import { PreactObservable } from '~external/observable';
import { Action, ProviderMessageType } from '../message';
import { BLUE_COLOR, GREEN_COLOR, RED_COLOR } from '~common/webview';
import { postProviderMessage } from './message';

interface Props {
    id: number;
    testcase: PreactObservable<ITestcase>;
}

export default function ({ id, testcase }: Props) {
    const toggleVisibility = () => postProviderMessage({ type: ProviderMessageType.ACTION, id, action: Action.TOGGLE_VISIBILITY });
    const expandStdio = (stdio: Stdio) => postProviderMessage({ type: ProviderMessageType.VIEW, id, stdio });

    const newStdin = useSignal('');
    const headerBar = useComputed(() => {
        switch (testcase.status) {
            case Status.CE:
                return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={toggleVisibility}>CE</button>
            case Status.RE:
                return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={toggleVisibility}>RE</button>
            case Status.WA:
                return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={toggleVisibility}>WA</button>
            case Status.AC:
                return <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: GREEN_COLOR }} onClick={toggleVisibility}>AC</button>
            default:
                return <button class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font" onClick={toggleVisibility}>NA</button>
        }
    });
    const toggleSkipButton = useComputed(() => {
        if (testcase.skipped) {
            return <button class="text-base leading-tight bg-black px-3 w-fit display-font unfade" onClick={() => postProviderMessage({ type: ProviderMessageType.ACTION, id, action: Action.TOGGLE_SKIP })}>unskip</button>;
        } else {
            return <button class="text-base leading-tight bg-black px-3 w-fit display-font" onClick={() => postProviderMessage({ type: ProviderMessageType.ACTION, id, action: Action.TOGGLE_SKIP })}>skip</button>;
        }
    });

    const stdinArrowButton =
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1 shrink-0" onClick={() => expandStdio(Stdio.STDIN)}>
            <path fill={GREEN_COLOR} fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
        </svg>;
    const stderrArrowButton =
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1 shrink-0" onClick={() => expandStdio(Stdio.STDERR)}>
            <path fill={RED_COLOR} fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
        </svg>;
    const stdoutArrowButton =
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1 shrink-0" onClick={() => expandStdio(Stdio.STDOUT)}>
            <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
        </svg>;
    const acStdoutArrowButton =
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1 shrink-0" onClick={() => expandStdio(Stdio.ACCEPTED_STDOUT)}>
            <path fill={GREEN_COLOR} fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
        </svg>


    switch (testcase.status) {
        case Status.NA:
        case Status.WA:
        case Status.AC:
        case Status.RE:
        case Status.CE:
            return <div className={`container mx-auto mb-6 ${testcase.skipped && 'fade'}`}>
                <div class="flex flex-row unfade">
                    <div class="w-6 shrink-0"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow unfade">
                        {headerBar}
                        <button class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font" onClick={() => postProviderMessage({ type: ProviderMessageType.ACTION, id, action: Action.EDIT })}>edit</button>
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={() => {
                            newStdin.value = ''; // may be adding additional inputs, so clear out previous inputs
                            postProviderMessage({ type: ProviderMessageType.ACTION, id, action: Action.RUN });
                        }}>run</button>
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={() => postProviderMessage({ type: ProviderMessageType.ACTION, id, action: Action.DELETE })}>delete</button>
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font">{testcase.$elapsed}ms</p>
                        {toggleSkipButton}
                    </div>
                </div>
                {(!testcase.skipped && testcase.shown && !(testcase.status === Status.AC && !testcase.toggled)) &&
                    <>
                        {<div class="flex flex-row">
                            {stdinArrowButton}
                            <pre class="text-base display-font">{testcase.$stdin}</pre>
                        </div>}
                        {<div class="flex flex-row">
                            {stderrArrowButton}
                            <pre class="text-base display-font">{testcase.$stderr}</pre>
                        </div>}
                        {<div class="flex flex-row">
                            {stdoutArrowButton}
                            <pre class="text-base display-font">{testcase.$stdout}</pre>
                        </div>}
                        {(testcase.status === Status.WA) &&
                            <div class="flex flex-row">
                                {acStdoutArrowButton}
                                <pre class="text-base display-font">{testcase.$acceptedStdout}</pre>
                            </div>
                        }
                        {(testcase.status === Status.WA || testcase.status === Status.NA) &&
                            <div class="flex flex-row gap-x-2">
                                <div class="w-4 shrink-0"></div>
                                <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: GREEN_COLOR }} onClick={() => postProviderMessage({ type: ProviderMessageType.ACTION, id, action: Action.ACCEPT })}>accept</button>
                                {(testcase.status === Status.WA) &&
                                    <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={() => postProviderMessage({ type: ProviderMessageType.ACTION, id, action: Action.VIEW_DIFF })}>view diff</button>
                                }
                            </div>
                        }
                        {(testcase.status === Status.AC) &&
                            <div class="flex flex-row">
                                <div class="w-6 shrink-0"></div>
                                <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={() => postProviderMessage({ type: ProviderMessageType.ACTION, id, action: Action.DECLINE })}>decline</button>
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
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={() => postProviderMessage({ type: ProviderMessageType.ACTION, id, action: Action.STOP })}>stop</button>
                    </div>
                </div>
                {<div class="flex flex-row">
                    {stdinArrowButton}
                    <pre class="text-base display-font">{testcase.$stdin}</pre>
                </div>}
                <div class="flex flex-row">
                    <div class="w-6 shrink-0"></div>
                    <AutoresizeTextarea input={newStdin} onKeyUp={event => {
                        if (event.key === 'Enter') {
                            postProviderMessage({ type: ProviderMessageType.STDIN, id, data: newStdin.value });
                            newStdin.value = '';
                        }
                    }} />
                </div>
                {<div class="flex flex-row">
                    {stderrArrowButton}
                    <pre class="text-base display-font">{testcase.$stderr}</pre>
                </div>}
                {<div class="flex flex-row">
                    {stdoutArrowButton}
                    <pre class="text-base display-font">{testcase.$stdout}</pre>
                </div>}
            </div>;
        case Status.EDITING:
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6 shrink-0"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={() => {
                            const stdin = testcase.stdin;
                            const acceptedStdout = testcase.acceptedStdout;
                            // the extension host will send shortened version of both of these
                            testcase.stdin = '';
                            testcase.acceptedStdout = '';
                            postProviderMessage({ type: ProviderMessageType.SAVE, id, stdin, acceptedStdout });
                        }}>save</button>
                    </div>
                </div>
                <div class="flex flex-row">
                    {stdinArrowButton}
                    <AutoresizeTextarea input={testcase.$stdin!} onKeyUp={() => { }} />
                </div>
                <div class="flex flex-row">
                    {acStdoutArrowButton}
                    <AutoresizeTextarea input={testcase.$acceptedStdout!} onKeyUp={() => { }} />
                </div>
            </div>;
        default:
            return <></>;
    }
}