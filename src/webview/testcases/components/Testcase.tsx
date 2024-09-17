import { Signal, useSignal } from '@preact/signals';

import { BLUE_COLOR, GREEN_COLOR, RED_COLOR, ISettings } from '../../common';
import TruncatedText from '../../util/components/TruncatedText';
import AutoresizeTextarea from '../../util/components/AutoresizeTextarea';

interface Props {
    settings: ISettings,
    stdin: Signal<string>;
    stdout: Signal<string>;
    stderr: Signal<string>;
    elapsed: number;
    code: number;
    acceptedOutput: Signal<string>;
    showTestcaseOnAccepted: Signal<boolean>;
    id: number;
    status: string;
    onAcceptTestcase: (id: number) => void;
    onEditTestcase: (id: number) => void;
    onSaveTestcase: (id: number, input: string) => void;
    onDeleteTestcase: (id: number, isIndex: boolean) => void;
    onRunTestcase: (id: number, isIndex: boolean) => void;
    onStopTestcase: (id: number, isIndex: boolean, removeListeners: boolean) => void;
    onToggleACVisibilityTestcase: (id: number) => void;
    onSendStdin: (id: number, input: string) => void;
    onViewText: (content: string) => void;
};

export default function App({
    settings, stdin, stdout, stderr, elapsed, code, acceptedOutput, showTestcaseOnAccepted, id, status,
    onAcceptTestcase,
    onEditTestcase,
    onSaveTestcase,
    onDeleteTestcase,
    onRunTestcase,
    onStopTestcase,
    onToggleACVisibilityTestcase,
    onSendStdin,
    onViewText
}: Props) {
    const newStdin = useSignal('');
    const statusItem = (() => {
        if (code === -1)
            return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }}>CE</p>
        if (code)
            return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }}>RE</p>
        if (acceptedOutput.value === '')
            return <></>;
        if (stdout.value === acceptedOutput.value)
            return <button class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font" style={{ backgroundColor: GREEN_COLOR }} onClick={() => onToggleACVisibilityTestcase(id)}>AC</button>
        return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }}>WA</p>
    })();

    const handleKeyUp = (index: number, event: KeyboardEvent, onSendStdin: Function) => {
        if (event.key === 'Enter') {
            onSendStdin(index, newStdin.value);
            newStdin.value = '';
        }
    };

    switch (status) {
        case '':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6 shrink-0"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        {statusItem}
                        <button class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font" onClick={() => {
                            newStdin.value = stdin.value;
                            onEditTestcase(id);
                        }}>edit</button>
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={() => {
                            newStdin.value = ''; // may be adding additional inputs, so clear out previous inputs
                            onRunTestcase(id, false);
                        }}>run</button>
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={() => onDeleteTestcase(id, false)}>delete</button>
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font">{elapsed}ms</p>
                    </div>
                </div>
                {(acceptedOutput.value === '' || stdout.value !== acceptedOutput.value || showTestcaseOnAccepted.value) &&
                    <>
                        <div class="flex flex-row">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                                <path fill={GREEN_COLOR} fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                            </svg>
                            <div class="grow">
                                <TruncatedText maxLength={settings.maxDisplayCharacters} text={stdin} onViewText={onViewText} />
                            </div>
                        </div>
                        <div class="flex flex-row">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                                <path fill={RED_COLOR} fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                            </svg>
                            <div class="grow">
                                <TruncatedText maxLength={settings.maxDisplayCharacters} text={stderr} onViewText={onViewText} />
                            </div>
                        </div>
                        <div class="flex flex-row">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                                <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                            </svg>
                            <div class="grow">
                                <TruncatedText maxLength={settings.maxDisplayCharacters} text={stdout} onViewText={onViewText} />
                            </div>
                        </div>
                        {(acceptedOutput.value !== '' && stdout.value !== acceptedOutput.value) &&
                            <div class="flex flex-row">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                                    <path fill={GREEN_COLOR} fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                                </svg>
                                <div class="grow">
                                    <TruncatedText maxLength={settings.maxDisplayCharacters} text={acceptedOutput} onViewText={onViewText} />
                                </div>
                            </div>
                        }
                        <div class="flex flex-row">
                            <div class="w-6"></div>
                            <button class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font" style={{ backgroundColor: GREEN_COLOR }} onClick={() => onAcceptTestcase(id)}>accept</button>
                        </div>
                    </>
                }
            </div>;
        case 'COMPILING':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font">compiling</p>
                    </div>
                </div>
            </div>;
        case 'RUNNING':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={() => onStopTestcase(id, false, false)}>stop</button>
                    </div>
                </div>
                <div class="flex flex-row">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                        <path fill={GREEN_COLOR} fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                    </svg>
                    <div class="grow">
                        <TruncatedText maxLength={settings.maxDisplayCharacters} text={stdin} onViewText={onViewText} />
                    </div>
                </div>
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <AutoresizeTextarea input={newStdin} onKeyUp={event => handleKeyUp(id, event, onSendStdin)} />
                </div>
                <div class="flex flex-row">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                        <path fill={RED_COLOR} fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                    </svg>
                    <div class="grow">
                        <TruncatedText maxLength={settings.maxDisplayCharacters} text={stderr} onViewText={onViewText} />
                    </div>
                </div>
                <div class="flex flex-row">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                        <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                    </svg>
                    <div class="grow">
                        <TruncatedText maxLength={settings.maxDisplayCharacters} text={stdout} onViewText={onViewText} />
                    </div>
                </div>
            </div>;
        case 'EDITING':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={() => onSaveTestcase(id, newStdin.value)}>save</button>
                        <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }} onClick={() => onDeleteTestcase(id, false)}>delete</button>
                    </div>
                </div>
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <AutoresizeTextarea input={newStdin} onKeyUp={() => { }} />
                </div>
            </div>;
        default:
            return <></>;
    }
}