import { signal, useComputed } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import Testcase from './Testcase';
import { observable } from '~external/observable';
import {
	type IDeleteMessage,
	type INewMessage,
	type ISetMessage,
	type IShowMessage,
	type IStdioMessage,
	ProviderMessageType,
	type WebviewMessage,
	WebviewMessageType,
} from '../message';
import { type ITestcase, Status, Stdio } from '~common/common';
import { postProviderMessage } from './message';

const testcases = observable(new Map<number, ITestcase>());
const show = signal(true);

window.addEventListener('message', (msg: MessageEvent<WebviewMessage>) => {
	switch (msg.data.type) {
		case WebviewMessageType.NEW:
			handleNew(msg.data);
			break;
		case WebviewMessageType.SET:
			handleSet(msg.data);
			break;
		case WebviewMessageType.STDIO:
			handleStdio(msg.data);
			break;
		case WebviewMessageType.DELETE:
			handleDelete(msg.data);
			break;
		case WebviewMessageType.SHOW:
			handleShow(msg.data);
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
	// biome-ignore lint/style/noNonNullAssertion: Guaranteed by the provider
	(testcases.get(id)![property] as unknown) = value;
}

function handleStdio({ id, data, stdio }: IStdioMessage) {
	switch (stdio) {
		case Stdio.STDIN:
			// biome-ignore lint/style/noNonNullAssertion: Guaranteed by the provider
			testcases.get(id)!.stdin += data;
			break;
		case Stdio.STDERR:
			// biome-ignore lint/style/noNonNullAssertion: Guaranteed by the provider
			testcases.get(id)!.stderr += data;
			break;
		case Stdio.STDOUT:
			// biome-ignore lint/style/noNonNullAssertion: Guaranteed by the provider
			testcases.get(id)!.stdout += data;
			break;
		case Stdio.ACCEPTED_STDOUT:
			// biome-ignore lint/style/noNonNullAssertion: Guaranteed by the provider
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
	useEffect(
		() => postProviderMessage({ type: ProviderMessageType.LOADED }),
		[],
	);
	const testcaseComponents = useComputed(() => {
		const components = [];
		for (const [id, testcase] of testcases.entries()) {
			components.push(<Testcase key={id} id={id} testcase={testcase} />);
		}
		return components;
	});

	return (
		<>
			{show.value && (
				<>
					{testcaseComponents}
					<button
						type="button"
						class="ml-6 text-base leading-tight bg-zinc-600 px-3 shrink-0 display-font"
						onClick={() =>
							postProviderMessage({ type: ProviderMessageType.NEXT })
						}
					>
						next test
					</button>
				</>
			)}
		</>
	);
}
