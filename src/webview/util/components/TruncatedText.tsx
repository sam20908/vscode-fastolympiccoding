import { Signal, useComputed } from "@preact/signals";
import { BLUE_COLOR, ISettings } from "../../common";

interface Props {
    settings: ISettings;
    text: Signal<string>;
}

export default function App({ text, settings }: Props) {
    const truncatedText = useComputed(() => {
        let truncatedText = '';
        let newlineCount = 0;
        for (let i = 0; i < Math.min(text.value.length, settings.maxDisplayCharacters) && newlineCount < settings.maxDisplayLines; i++) {
            truncatedText += text.value[i];
            if (text.value[i] === '\n') {
                ++newlineCount;
            }
        }
        if (truncatedText.length === settings.maxDisplayCharacters || newlineCount === settings.maxDisplayLines) {
            truncatedText = truncatedText.substring(0, truncatedText.length - 3) + '...';
        }
        return truncatedText;
    });

    return <span class="whitespace-pre-line text-base display-font">{truncatedText}</span>;
}