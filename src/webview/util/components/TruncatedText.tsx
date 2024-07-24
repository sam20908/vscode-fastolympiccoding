import { Signal, useComputed } from "@preact/signals";
import { BLUE_COLOR } from "../../common";

interface Props {
    maxLength: number;
    text: Signal<string>;
    onViewText: (content: string) => void;
}

export default function App({ text, maxLength, onViewText }: Props) {
    const truncatedText = useComputed(() => text.value.length > maxLength ? text.value.substring(0, maxLength - 3) + '...' : text.value);
    const isTruncated = useComputed(() => truncatedText.value.endsWith('...'));

    return <>
        <span class="text-base display-font" style={{ whiteSpace: "pre-line" }}>{truncatedText}</span>
        {isTruncated.value &&
            <div class="flex flex-row">
                <div class="w-6"></div>
                <button class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={() => onViewText(text.value)}>view full text</button>
            </div>
        }
    </>;
}