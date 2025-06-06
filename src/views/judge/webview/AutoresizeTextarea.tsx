import type { Signal } from '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact/jsx-runtime';

interface Props {
	input: Signal<string>;
	onKeyUp: (event: KeyboardEvent) => void;
}

export default function App({ input, onKeyUp }: Props) {
	const textarea = useRef<HTMLTextAreaElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Resize the textarea when the input changes
	useLayoutEffect(() => {
		// biome-ignore lint/style/noNonNullAssertion: Reference is guaranteed to be set
		textarea.current!.style.height = 'inherit';
		// biome-ignore lint/style/noNonNullAssertion: Reference is guaranteed to be set
		textarea.current!.style.height = `${textarea.current!.scrollHeight}px`;
	}, [input.value]);

	return (
		<textarea
			ref={textarea}
			class="text-base"
			rows={1}
			style={{
				whiteSpace: 'pre-line',
				resize: 'none',
				border: 'none',
				background: 'none',
				width: '100%',
				overflowY: 'hidden',
			}}
			value={input.value}
			onInput={(event: JSX.TargetedEvent<HTMLTextAreaElement>) => {
				input.value = event.currentTarget.value;
			}}
			onKeyUp={onKeyUp}
			placeholder="Input here..."
		/>
	);
}
