import { useComputed, useSignal } from '@preact/signals';

import { BLUE_COLOR, GREEN_COLOR, RED_COLOR, ITestcaseState, ISettings } from '../../common';
import TruncatedText from '../../util/components/TruncatedText';
import AutoresizeTextarea from '../../util/components/AutoresizeTextarea';

interface Props {
    testcase: ITestcaseState,
    settings: ISettings,
    onAcceptTestcase: (id: number) => void;
    onEditTestcase: (id: number) => void;
    onSaveTestcase: (id: number, input: string) => void;
    onDeleteTestcase: (id: number, isIndex: boolean) => void;
    onRunTestcase: (id: number, isIndex: boolean) => void;
    onStopTestcase: (id: number, removeListeners: boolean) => void;
    onSendNewInput: (id: number, input: string) => void;
    onViewText: (content: string) => void;
};

export default function App({
    testcase,
    settings,
    onAcceptTestcase,
    onEditTestcase,
    onSaveTestcase,
    onDeleteTestcase,
    onRunTestcase,
    onStopTestcase,
    onSendNewInput,
    onViewText
}: Props) {
    const { input, stderr, stdout, elapsed, code, acceptedOutput, id, status } = testcase;
    const newInput = useSignal('');
    const statusItem = useComputed(() => {
        if (code.value === -1)
            return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }}>CTE</p>
        if (code.value)
            return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }}>RTE</p>
        if (acceptedOutput.value === '')
            return <></>;
        if (stdout.value === acceptedOutput.value)
            return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{ backgroundColor: GREEN_COLOR }}>AC</p>
        return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }}>WA</p>
    });

    const handleKeyUp = (index: number, event: KeyboardEvent, onSendNewInput: Function) => {
        if (event.key === 'Enter') {
            onSendNewInput(index, newInput.value);
            newInput.value = '';
        }
    };

    switch (status) {
        case '':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        {statusItem}
                        <button class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" onClick={() => {
                            newInput.value = input.value;
                            onEditTestcase(id);
                        }}>edit</button>
                        <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: BLUE_COLOR }} onClick={() => {
                            newInput.value = ''; // may be adding additional inputs, so clear out previous inputs
                            onRunTestcase(id, false);
                        }}>run</button>
                        <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }} onClick={() => onDeleteTestcase(id, false)}>delete</button>
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']">time: {elapsed}ms</p>
                    </div>
                </div>
                {(acceptedOutput.value === '' || stdout.value !== acceptedOutput.value) &&
                    <div>
                        <div class="flex flex-row">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                                <path fill={"#AAD94C"} fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                            </svg>
                            <div class="grow">
                                <span class="text-base" style={{ whiteSpace: "pre-line" }}>{input}</span>
                            </div>
                        </div>
                        <div class="flex flex-row">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                                <path fill={RED_COLOR} fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                            </svg>
                            <div class="grow">
                                <TruncatedText maxLength={settings.maxCharactersForOutput} text={stderr} onViewText={onViewText} />
                            </div>
                        </div>
                        <div class="flex flex-row">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                                <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                            </svg>
                            <div class="grow">
                                <TruncatedText maxLength={settings.maxCharactersForOutput} text={stdout} onViewText={onViewText} />
                            </div>
                        </div>
                        <div class="flex flex-row">
                            <div class="w-6"></div>
                            <button class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{ backgroundColor: GREEN_COLOR }} onClick={() => onAcceptTestcase(id)}>accept</button>
                        </div>
                    </div>
                }
            </div>;
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
                        <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }} onClick={() => onStopTestcase(id, false)}>stop</button>
                    </div>
                </div>
                <div>
                    <div class="flex flex-row">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                            <path fill={"#AAD94C"} fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                        </svg>
                        <div class="grow">
                            <span class="text-base" style={{ whiteSpace: "pre-line" }}>{input}</span>
                        </div>
                    </div>
                    <div class="flex flex-row">
                        <div class="w-6"></div>
                        <AutoresizeTextarea input={newInput} onKeyUp={event => handleKeyUp(id, event, onSendNewInput)} />
                    </div>
                    <div class="flex flex-row">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                            <path fill={RED_COLOR} fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                        </svg>
                        <div class="grow">
                            <TruncatedText maxLength={settings.maxCharactersForOutput} text={stderr} onViewText={onViewText} />
                        </div>
                    </div>
                    <div class="flex flex-row">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                            <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                        </svg>
                        <div class="grow">
                            <TruncatedText maxLength={settings.maxCharactersForOutput} text={stdout} onViewText={onViewText} />
                        </div>
                    </div>
                </div>
            </div>;
        case 'EDITING':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: BLUE_COLOR }} onClick={() => onSaveTestcase(id, newInput.value)}>save</button>
                        <button class="text-base leading-tight px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }} onClick={() => onDeleteTestcase(id, false)}>delete</button>
                    </div>
                </div>
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <AutoresizeTextarea input={newInput} onKeyUp={() => { }} />
                </div>
            </div>;
        default:
            return <></>;
    }
}