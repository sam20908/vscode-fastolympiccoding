import { batch, signal, useComputed } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Status } from '~common/common';
import { BLUE_COLOR, RED_COLOR } from '~common/webview';
import { type PreactObservable, observable } from '~external/observable';
import {
	type IShowMessage,
	type IStatusMessage,
	type IStdioMessage,
	ProviderMessageType,
	type WebviewMessage,
	WebviewMessageType,
} from '../message';
import State from './State';
import { postProviderMessage } from './message';

interface IState {
	data: string;
	status: Status;
}

const state: PreactObservable<IState[]> = observable([
	{ data: '', status: Status.NA },
	{ data: '', status: Status.NA },
	{ data: '', status: Status.NA },
]);
const showView = signal(true);

const expand = (id: number) =>
	postProviderMessage({ type: ProviderMessageType.VIEW, id });
const add = (id: number) =>
	postProviderMessage({ type: ProviderMessageType.ADD, id });
const reset = () => postProviderMessage({ type: ProviderMessageType.RESET });

window.addEventListener('message', (event: MessageEvent<WebviewMessage>) => {
	switch (event.data.type) {
		case WebviewMessageType.STATUS:
			handleStatus(event.data);
			break;
		case WebviewMessageType.STDIO:
			handleStdio(event.data);
			break;
		case WebviewMessageType.CLEAR:
			handleClear();
			break;
		case WebviewMessageType.SHOW:
			handleShow(event.data);
			break;
	}
});

function handleStatus({ id, status }: IStatusMessage) {
	state[id].status = status;
}

function handleStdio({ id, data }: IStdioMessage) {
	state[id].data += data;
}

function handleClear() {
	batch(() => {
		for (let i = 0; i < 3; i++) {
			state[i].data = '';
			state[i].status = Status.NA;
		}
	});
}

function handleShow({ visible }: IShowMessage) {
	showView.value = visible;
}

export default function App() {
	useEffect(
		() => postProviderMessage({ type: ProviderMessageType.LOADED }),
		[],
	);

	const button = useComputed(() => {
		if (state[1].status === Status.RUNNING)
			return (
				<button
					type="button"
					class="text-base leading-tight px-3 w-fit display-font"
					style={{ backgroundColor: RED_COLOR }}
					onClick={() =>
						postProviderMessage({ type: ProviderMessageType.STOP })
					}
				>
					stop
				</button>
			);
		if (
			state[0].status === Status.COMPILING ||
			state[1].status === Status.COMPILING ||
			state[2].status === Status.COMPILING
		)
			return <></>;
		return (
			<button
				type="button"
				class="text-base leading-tight px-3 w-fit display-font"
				style={{ backgroundColor: BLUE_COLOR }}
				onClick={() => postProviderMessage({ type: ProviderMessageType.RUN })}
			>
				stress test
			</button>
		);
	});

	return (
		<>
			{showView.value && (
				<>
					<div class="container mx-auto mb-6">
						<div class="flex flex-row">
							<div class="w-6 shrink-0" />
							<div class="flex justify-start gap-x-2 bg-zinc-800 grow">
								{button}
								<button
									type="button"
									class="text-base leading-tight px-3 w-fit display-font"
									style={{ backgroundColor: BLUE_COLOR }}
									onClick={reset}
								>
									reset
								</button>
							</div>
						</div>
					</div>
					<State
						// biome-ignore lint/style/noNonNullAssertion: Guaranteed by the signals library
						data={state[0].$data!}
						status={state[0].status}
						id={0}
						onView={expand}
						onAdd={add}
					/>
					<State
						// biome-ignore lint/style/noNonNullAssertion: Guaranteed by the signals library
						data={state[1].$data!}
						status={state[1].status}
						id={1}
						onView={expand}
						onAdd={add}
					/>
					<State
						// biome-ignore lint/style/noNonNullAssertion: Guaranteed by the signals library
						data={state[2].$data!}
						status={state[2].status}
						id={2}
						onView={expand}
						onAdd={add}
					/>
				</>
			)}
		</>
	);
}
