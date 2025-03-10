import { batch, Signal, signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import Testcase from './components/Testcase';
import { IState, postMessage } from './common';
import { ITestcasesMessage, Status, Stdio, TestcasesMessageType } from '../../common';
import { deepSignal } from 'deepsignal';

const state = deepSignal<IState[]>([]);
const showView = signal(true);
const idToIndex: number[] = [];

window.addEventListener('message', (event: MessageEvent) => {
    const { type, payload } = event.data as ITestcasesMessage;
    switch (type) {
        case TestcasesMessageType.NEW_EMPTY_TESTCASE:
            {
                const { id } = payload;
                if (id === idToIndex.length) {
                    idToIndex.push(state.length);
                } else {
                    idToIndex[id] = state.length;
                }
                state.push({
                    stdin: signal(''),
                    stderr: signal(''),
                    stdout: signal(''),
                    acceptedStdout: signal(''),
                    elapsed: 0,
                    status: Status.NA,
                    showTestcase: true,
                    toggled: false,
                    id
                });
            }
            break;
        case TestcasesMessageType.STATUS:
            {
                const { id, status, elapsed } = payload;
                batch(() => {
                    state[idToIndex[id]].status = status;
                    state[idToIndex[id]].elapsed = elapsed ?? state[idToIndex[id]].elapsed;
                    // mirrored logic in extension host
                    if (status === Status.AC && !state[idToIndex[id]].toggled) {
                        state[idToIndex[id]].showTestcase = false;
                    }
                });
            }
            break;
        case TestcasesMessageType.STDIO:
            {
                const { id, data, stdio } = payload;
                switch (stdio) {
                    case Stdio.STDIN:
                        state[idToIndex[id]].stdin.value += data;
                        break;
                    case Stdio.STDERR:
                        state[idToIndex[id]].stderr.value += data;
                        break;
                    case Stdio.STDOUT:
                        state[idToIndex[id]].stdout.value += data;
                        break;
                    case Stdio.ACCEPTED_STDOUT:
                        state[idToIndex[id]].acceptedStdout.value += data;
                        break;
                }
            }
            break;
        case TestcasesMessageType.SET_VISIBILITY:
            {
                const { id, showTestcase, toggled } = payload;
                state[idToIndex[id]].showTestcase = showTestcase;
                state[idToIndex[id]].toggled = toggled;
            }
            break;
        case TestcasesMessageType.FULL_STDIN:
            {
                const { id, data } = payload;
                state[idToIndex[id]].stdin.value = data;
            }
            break;
        case TestcasesMessageType.CLEAR_OUTPUTS:
            {
                const { id } = payload;
                batch(() => {
                    state[idToIndex[id]].stderr.value = '';
                    state[idToIndex[id]].stdout.value = '';
                });
            }
            break;
        case TestcasesMessageType.CLEAR_TESTCASES:
            state.splice(0);
            idToIndex.splice(0);
            break;
        case TestcasesMessageType.DELETE_TESTCASE:
            {
                const { id } = payload;
                for (let i = 0; i < idToIndex.length; i++) {
                    if (idToIndex[i] > idToIndex[id]) {
                        idToIndex[i]--;
                    }
                }
                state.splice(idToIndex[id], 1);
            }
            break;
        case TestcasesMessageType.TOGGLE_VIEW:
            {
                const { value } = payload;
                showView.value = value;
            }
            break;
    }
});

export default function App() {
    useEffect(() => postMessage(TestcasesMessageType.LOADED), []);

    return <>
        {showView.value && <>{
            state.map(value => <Testcase key={value.id} testcase={value} />)}
            <button class="ml-6 text-base leading-tight bg-zinc-600 px-3 shrink-0 display-font" onClick={() => postMessage(TestcasesMessageType.NEXT_TESTCASE)}>
                next test
            </button>
        </>}
    </>;
}
