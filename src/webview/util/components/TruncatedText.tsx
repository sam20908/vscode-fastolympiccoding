import { Signal, useComputed } from "@preact/signals";
import { BLUE_COLOR, ISettings } from "../../common";

interface Props {
    settings: ISettings;
    text: Signal<string>;
    onViewText: (content: string) => void;
}

export default function App({ text, settings, onViewText }: Props) {
    const truncatedData = useComputed(() => {
        let truncatedText = '';
        let newlineCount = 0;
        let isTruncated = false;
        for (let i = 0; i < Math.min(text.value.length, settings.maxDisplayCharacters) && newlineCount < settings.maxDisplayLines; i++) {
            truncatedText += text.value[i];
            if (text.value[i] === '\n') {
                newlineCount++;
                isTruncated = true;
            }
        }
        if (truncatedText.length === settings.maxDisplayCharacters) {
            isTruncated = true;
            truncatedText = truncatedText.substring(0, -3);
        }
        return { truncatedText, isTruncated };
    });

    return <>
        <span class="whitespace-pre-line text-base display-font">{truncatedData.value.truncatedText}</span>
        {truncatedData.value.isTruncated &&
            <div class="flex flex-row">
                <div class="w-6"></div>
                <button class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: BLUE_COLOR }} onClick={() => onViewText(text.value)}>view full text</button>
            </div>
        }
    </>;
}