import React, { useLayoutEffect, useRef } from "preact/compat";

interface Props {
    input: string;
    onSetInput: (input: string) => void;
    onKeyUp: (event: KeyboardEvent) => void;
}

export default function App({ input, onSetInput, onKeyUp }: Props) {
    const textarea = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        textarea.current!.style.height = 'inherit';
        textarea.current!.style.height = `${textarea.current!.scrollHeight}px`;
    }, [input]);

    return <textarea ref={textarea} class="text-base" rows={1} style={{
        whiteSpace: "pre-line",
        resize: "none",
        border: "none",
        background: "none",
        width: "100%",
        overflowY: "hidden"
    }} value={input} onInput={event => onSetInput(event.currentTarget.value)} onKeyUp={onKeyUp} placeholder="Input here..." />;
}