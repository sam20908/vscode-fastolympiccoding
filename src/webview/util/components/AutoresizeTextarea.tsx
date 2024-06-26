import { Signal } from '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks'

interface Props {
    input: Signal<string>;
    onKeyUp: (event: KeyboardEvent) => void;
}

export default function App({ input, onKeyUp }: Props) {
    const textarea = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        textarea.current!.style.height = 'inherit';
        textarea.current!.style.height = `${textarea.current!.scrollHeight}px`;
    }, [input.value]);

    return <textarea ref={textarea} class="text-base" rows={1} style={{
        whiteSpace: "pre-line",
        resize: "none",
        border: "none",
        background: "none",
        width: "100%",
        overflowY: "hidden"
    }} value={input.value} onInput={e => input.value = e.currentTarget.value} onKeyUp={onKeyUp} placeholder="Input here..." />;
}