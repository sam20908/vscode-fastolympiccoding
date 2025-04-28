import { signal, useComputed } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import Testcase from './Testcase';
import { observable } from '~utils/observable';
import { IDeleteMessage, INewMessage, ISetMessage, IShowMessage, IStdioMessage, ProviderMessageType, WebviewMessage, WebviewMessageType } from '../message';
import { ITestcase, Status, Stdio } from '~common/common';

const testcases = observable(new Map<number, ITestcase>());
const show = signal(true);

window.addEventListener('message', (event: MessageEvent<WebviewMessage>) => {
    switch (event.data.type) {
        case WebviewMessageType.NEW:
            handleNew(event.data);
            break;
        case WebviewMessageType.SET:
            handleSet(event.data);
            break;
        case WebviewMessageType.STDIO:
            handleStdio(event.data);
            break;
        case WebviewMessageType.DELETE:
            handleDelete(event.data);
            break;
        case WebviewMessageType.SHOW:
            handleShow(event.data);
            break;
    }
});

function handleNew({ id }: INewMessage) {
    if (!testcases.get(id)) {
        testcases.set(id, {
            stdin: '',
            stderr: '',
            stdout: '',
            acceptedStdout: '',
            elapsed: 0,
            status: Status.NA,
            shown: true,
            toggled: false,
            skipped: false,
        });
    }
}

function handleSet({ id, property, value }: ISetMessage) {
    (testcases.get(id)![property] as any) = value;
}

function handleStdio({ id, data, stdio }: IStdioMessage) {
    switch (stdio) {
        case Stdio.STDIN:
            testcases.get(id)!.stdin += data;
            break;
        case Stdio.STDERR:
            testcases.get(id)!.stderr += data;
            break;
        case Stdio.STDOUT:
            testcases.get(id)!.stdout += data;
            break;
        case Stdio.ACCEPTED_STDOUT:
            testcases.get(id)!.acceptedStdout += data;
            break;
    }
}

function handleDelete({ id }: IDeleteMessage) {
    testcases.delete(id);
}

function handleShow({ visible }: IShowMessage) {
    show.value = visible;
}

export default function () {
    useEffect(() => postMessage({ type: ProviderMessageType.LOADED }), []);
    const testcaseComponents = useComputed(() => {
        const components = [];
        for (const [id, testcase] of testcases.entries()) {
            components.push(<Testcase key={id} id={id} testcase={testcase} />);
        }
        return components;
    });

    console.log('main component');
    return <>{
        show.value && <>{testcaseComponents}
            <button class="ml-6 text-base leading-tight bg-zinc-600 px-3 shrink-0 display-font" onClick={() => postMessage({ type: ProviderMessageType.NEXT })}>next test</button>
        </>}
    </>;
}