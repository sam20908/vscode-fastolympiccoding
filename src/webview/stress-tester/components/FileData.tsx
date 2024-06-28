import { Signal } from "@preact/signals";

import { ISettings, RED_COLOR } from "../../common";
import TruncatedText from "../../util/components/TruncatedText";

interface Props {
    settings: ISettings;
    code: number;
    status: string;
    filetype: string;
    data: Signal<string>;
    onViewText: (content: string) => void;
}

export default function App({ settings, code, status, filetype, data, onViewText }: Props) {
    const statusItem = (() => {
        if (code === -2)
            return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }}>WA</p>
        if (code === -1)
            return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }}>CTE</p>
        if (code)
            return <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']" style={{ backgroundColor: RED_COLOR }}>RTE</p>
        return <></>;
    })();

    switch (status) {
        case '':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']">{filetype}</p>
                        {statusItem}
                    </div>
                </div>
                <div class="flex flex-row">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                        <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                    </svg>
                    <div class="grow">
                        <TruncatedText maxLength={settings.maxCharactersForOutput} text={data} onViewText={onViewText} />
                    </div>
                </div>
            </div>;
        case 'COMPILING':
            return <div class="container mx-auto mb-6">
                <div class="flex flex-row">
                    <div class="w-6"></div>
                    <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']">{filetype}</p>
                        <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']">compiling</p>
                    </div>
                </div>
            </div>;
        case 'RUNNING':
            return <div class="flex flex-row">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1">
                    <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
                </svg>
                <div class="grow">
                    <p class="text-base leading-tight bg-zinc-600 px-3 w-fit font-['Consolas']">{filetype}</p>
                    <TruncatedText maxLength={settings.maxCharactersForOutput} text={data} onViewText={onViewText} />
                </div>
            </div>;
        default:
            return <></>;
    }
}