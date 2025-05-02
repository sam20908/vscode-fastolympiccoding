import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import { useRef } from 'preact/hooks';

import { type ITestcase, Status, Stdio } from '~common/common';
import {
	ArrowSvgInwards,
	ArrowSvgOutwards,
	BLUE_COLOR,
	GRAY_COLOR,
	GREEN_COLOR,
	RED_COLOR,
} from '~common/webview';
import type { PreactObservable } from '~external/observable';
import { Action, ProviderMessageType } from '../message';
import AutoresizeTextarea from './AutoresizeTextarea';
import { postProviderMessage } from './message';

interface Props {
	id: number;
	testcase: PreactObservable<ITestcase>;
}
interface ActionButtonProps {
	id: number;
	action: Action;
	backgroundColor: string;
	text: string;
	className?: string;
	onClickPrePost?: () => unknown;
}
interface StatusButtonProps {
	id: number;
	status: Status;
}

const ActionButton: FunctionComponent<ActionButtonProps> = ({
	id,
	action,
	backgroundColor,
	text,
	className,
	onClickPrePost,
}: ActionButtonProps) => (
	<button
		type="button"
		class={`text-base leading-tight px-3 w-fit display-font ${className}`}
		style={{ backgroundColor: backgroundColor }}
		onClick={() => {
			onClickPrePost?.();
			postProviderMessage({ type: ProviderMessageType.ACTION, id, action });
		}}
	>
		{text}
	</button>
);
const StatusButton: FunctionComponent<StatusButtonProps> = ({
	status,
	id,
}: StatusButtonProps) => {
	let color: string;
	let text: string;
	switch (status) {
		case Status.CE:
			color = RED_COLOR;
			text = 'CE';
			break;
		case Status.RE:
			color = RED_COLOR;
			text = 'RE';
			break;
		case Status.WA:
			color = RED_COLOR;
			text = 'WA';
			break;
		case Status.AC:
			color = GREEN_COLOR;
			text = 'AC';
			break;
		case Status.TL:
			color = RED_COLOR;
			text = 'TL';
			break;
		default:
			color = GRAY_COLOR;
			text = 'NA';
			break;
	}

	return (
		<ActionButton
			id={id}
			action={Action.TOGGLE_VISIBILITY}
			backgroundColor={color}
			text={text}
		/>
	);
};

export default function ({ id, testcase }: Props) {
	const viewStdio = (stdio: Stdio) =>
		postProviderMessage({ type: ProviderMessageType.VIEW, id, stdio });

	const newStdin = useSignal('');
	const newTimeLimitInput = useRef<HTMLInputElement>(null);

	const StdinRow: FunctionComponent = () => (
		<div class="flex flex-row">
			<ArrowSvgInwards color="#FFFFFF" onClick={() => viewStdio(Stdio.STDIN)} />
			<pre class="text-base display-font">{testcase.$stdin}</pre>
		</div>
	);
	const StderrRow: FunctionComponent = () => (
		<div class="flex flex-row">
			<ArrowSvgOutwards
				color={RED_COLOR}
				onClick={() => viewStdio(Stdio.STDERR)}
			/>
			<pre class="text-base display-font">{testcase.$stderr}</pre>
		</div>
	);
	const StdoutRow: FunctionComponent = () => (
		<div class="flex flex-row">
			<ArrowSvgOutwards
				color="#FFFFFF"
				onClick={() => viewStdio(Stdio.STDOUT)}
			/>
			<pre class="text-base display-font">{testcase.$stdout}</pre>
		</div>
	);
	const AcceptedStdoutRow: FunctionComponent = () => (
		<div class="flex flex-row">
			<ArrowSvgOutwards
				color={GREEN_COLOR}
				onClick={() => viewStdio(Stdio.ACCEPTED_STDOUT)}
			/>
			<pre class="text-base display-font">{testcase.$acceptedStdout}</pre>
		</div>
	);

	switch (testcase.status) {
		case Status.NA:
		case Status.WA:
		case Status.AC:
		case Status.RE:
		case Status.CE:
		case Status.TL:
			return (
				<div className={`container mx-auto mb-6 ${testcase.skipped && 'fade'}`}>
					<div class="flex flex-row unfade">
						<div class="w-6 shrink-0" />
						<div class="flex justify-start gap-x-2 bg-zinc-800 grow unfade">
							<StatusButton id={id} status={testcase.status} />
							<ActionButton
								id={id}
								action={Action.EDIT}
								backgroundColor={GRAY_COLOR}
								text="edit"
							/>
							<ActionButton
								id={id}
								action={Action.RUN}
								backgroundColor={BLUE_COLOR}
								text="run"
								onClickPrePost={() => {
									newStdin.value = ''; // may be adding additional inputs, so clear out previous inputs
								}}
							/>
							<ActionButton
								id={id}
								action={Action.DELETE}
								backgroundColor={RED_COLOR}
								text="delete"
							/>
							<p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font">
								{testcase.$elapsed}ms
							</p>
							<ActionButton
								id={id}
								action={Action.TOGGLE_SKIP}
								backgroundColor="#000000"
								text={testcase.skipped ? 'unskip' : 'skip'}
								className="unfade"
							/>
						</div>
					</div>
					{!testcase.skipped &&
						testcase.shown &&
						!(testcase.status === Status.AC && !testcase.toggled) && (
							<>
								<StdinRow />
								<StderrRow />
								<StdoutRow />
								{testcase.status === Status.WA && <AcceptedStdoutRow />}
								{(testcase.status === Status.WA ||
									testcase.status === Status.NA) && (
									<div class="flex flex-row gap-x-2">
										<div class="w-4 shrink-0" />
										<ActionButton
											id={id}
											action={Action.ACCEPT}
											backgroundColor={GREEN_COLOR}
											text="accept"
										/>
										{testcase.status === Status.WA && (
											<ActionButton
												id={id}
												action={Action.COMPARE}
												backgroundColor={BLUE_COLOR}
												text="compare"
											/>
										)}
									</div>
								)}
								{testcase.status === Status.AC && (
									<div class="flex flex-row">
										<div class="w-6 shrink-0" />
										<ActionButton
											id={id}
											action={Action.DECLINE}
											backgroundColor={RED_COLOR}
											text="decline"
										/>
									</div>
								)}
							</>
						)}
				</div>
			);
		case Status.COMPILING:
			return (
				<div class="container mx-auto mb-6">
					<div class="flex flex-row">
						<div class="w-6 shrink-0" />
						<div class="flex justify-start gap-x-2 bg-zinc-800 grow">
							<p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font">
								compiling
							</p>
						</div>
					</div>
				</div>
			);
		case Status.RUNNING:
			return (
				<div class="container mx-auto mb-6">
					<div class="flex flex-row">
						<div class="w-6 shrink-0" />
						<div class="flex justify-start gap-x-2 bg-zinc-800 grow">
							<ActionButton
								id={id}
								action={Action.STOP}
								backgroundColor={RED_COLOR}
								text="stop"
							/>
						</div>
					</div>
					<StdinRow />
					<div class="flex flex-row">
						<div class="w-6 shrink-0" />
						<AutoresizeTextarea
							input={newStdin}
							onKeyUp={(event) => {
								if (event.key === 'Enter') {
									postProviderMessage({
										type: ProviderMessageType.STDIN,
										id,
										data: newStdin.value,
									});
									newStdin.value = '';
								}
							}}
						/>
					</div>
					<StderrRow />
					<StdoutRow />
				</div>
			);
		case Status.EDITING:
			return (
				<div class="container mx-auto mb-6">
					<div class="flex flex-row">
						<div class="w-6 shrink-0" />
						<div class="flex justify-start gap-x-2 bg-zinc-800 grow">
							<button
								type="button"
								class="text-base leading-tight px-3 w-fit display-font"
								style={{ backgroundColor: BLUE_COLOR }}
								onClick={() => {
									const stdin = testcase.stdin;
									const acceptedStdout = testcase.acceptedStdout;
									// the extension host will send shortened version of both of these
									testcase.stdin = '';
									testcase.acceptedStdout = '';
									postProviderMessage({
										type: ProviderMessageType.SAVE,
										id,
										stdin,
										acceptedStdout,
										// biome-ignore lint/style/noNonNullAssertion: Ref is always set
										timeLimit: Number(newTimeLimitInput.current!.value),
									});
								}}
							>
								save
							</button>
						</div>
					</div>
					<div class="flex flex-row">
						<ArrowSvgInwards color="#FFFFFF" />
						{/* biome-ignore lint/style/noNonNullAssertion: Guaranteed by the signals library */}
						<AutoresizeTextarea input={testcase.$stdin!} onKeyUp={() => {}} />
					</div>
					<div class="flex flex-row">
						<ArrowSvgOutwards color={GREEN_COLOR} />
						<AutoresizeTextarea
							// biome-ignore lint/style/noNonNullAssertion: uaranteed by the signals library
							input={testcase.$acceptedStdout!}
							onKeyUp={() => {}}
						/>
					</div>
					<div class="flex flex-row">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							fill="currentColor"
							class="w-4 h-4 mr-2 mt-1 shrink-0"
							viewBox="0 0 16 16"
						>
							<title>Clock</title>
							<path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z" />
							<path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0" />
						</svg>
						<input
							class="text-base"
							type="number"
							value={testcase.timeLimit}
							style={{
								whiteSpace: 'pre-line',
								resize: 'none',
								border: 'none',
								background: 'none',
								width: '100%',
								overflowY: 'hidden',
							}}
							ref={newTimeLimitInput}
							min={0}
						/>
					</div>
				</div>
			);
	}
}
